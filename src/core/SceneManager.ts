/**
 * SceneManager —— Scene 管理（增删查 + 序号分配）
 *
 * 职责（详见 design.md 第 6.1 节）：
 *   1. list()      —— 扫描 .lrnev/scenes/&#42;/scene.md 列出所有 Scene
 *   2. get(id)     —— 读单个 Scene（路径 + frontmatter + spec 数量）
 *   3. create()    —— 序号自动分配 + 三文档（scene/architecture/roadmap）+ ai_followup
 *   4. resolveId() —— 支持纯名字 / 纯序号 / 完整 id 三种输入
 *
 * 序号策略：
 *   - 扫描现有目录 max+1，不再使用 scene-numbers.json 状态文件
 *   - 创建临界区用独占目录锁保护，避免并发会话拿到同一序号
 *   - 删除最高序号后会复用该序号；引用依赖 name/路径，序号复用可接受
 */

import { createHash } from 'node:crypto';

import { parseFrontmatter, serializeFrontmatter } from '../storage/FrontmatterCodec.js';
import { FileStorage } from '../storage/FileStorage.js';
import { LrnevError, ErrorCode } from '../shared/errors.js';
import { loadConfig } from '../shared/config.js';
import { renderTemplate, today, toTitleCase } from './Templates.js';
import { GoalAssessor } from './GoalAssessor.js';
import type {
  Scene,
  SceneFrontmatter,
  CreateSceneInput,
} from '../types/scene.js';
import type { AiFollowupResponse } from '../types/response.js';
import type { GoalAssessmentKind } from '../types/goal.js';

/** Scene 目录基址 */
const SCENES_DIR = '.lrnev/scenes';
export const DEFAULT_SCENE_ID = '00-default';
const DEFAULT_SCENE_NAME = 'default';
const SPEC_SPLITTING_RUBRIC = [
  'Spec 粒度：一个 Spec 只装一个可交付特性。判断要不要拆成多个 Spec，请按三条标尺自查：',
  '1. 两块需求能否分别独立验收/独立上线？能 -> 拆成两个 Spec。',
  '2. 它们是否共享同一套验收标准？共享 -> 合并为一个 Spec。',
  '3. 某块方案不确定、要先调研？是 -> 那块单独做研究型 Spec 或先记 ADR。',
];

type SharedSceneDocument = 'architecture' | 'roadmap';

interface SharedSceneDocumentSnapshot {
  scene: string;
  document: SharedSceneDocument;
  path: string;
  content: string;
  revision: string;
}

interface UpdateSharedSceneDocumentInput {
  scene: string;
  document: SharedSceneDocument;
  content: string;
  expected_revision: string;
}

export class SceneManager {
  constructor(
    private readonly fs: FileStorage,
    private readonly goalAssessor = new GoalAssessor(),
  ) {}

  /**
   * 列出所有 Scene。
   *
   * 实现：glob 找到所有 scenes/&#42;/scene.md，逐个解析 frontmatter。
   * 顺序按目录名升序（即序号升序）。
   */
  async list(): Promise<Scene[]> {
    const files = await this.fs.list('.lrnev/scenes/*/scene.md');
    files.sort();
    const scenes: Scene[] = [];
    for (const file of files) {
      const id = extractSceneIdFromPath(file);
      if (!id) continue;
      try {
        scenes.push(await this.get(id));
      } catch (err) {
        scenes.push(makeBrokenScene(this.fs, id, file, err));
      }
    }
    return scenes;
  }

  /**
   * 读单个 Scene 详情。
   *
   * @throws LrnevError(SCENE_NOT_FOUND) 不存在或缺 scene.md
   */
  async get(id: string): Promise<Scene> {
    const resolvedId = isFullSceneId(id) ? id : await this.resolveId(id);
    const sceneDir = `${SCENES_DIR}/${resolvedId}`;
    if (!this.fs.exists(sceneDir)) {
      throw new LrnevError(ErrorCode.SCENE_NOT_FOUND, `Scene "${id}" 不存在`, {
        field: 'scene_id',
        hint: '先调用 scene_list 查看完整 Scene id；若需要新业务场景，请调用 scene_create 创建。',
      });
    }
    const scenePath = `${SCENES_DIR}/${resolvedId}/scene.md`;
    if (!this.fs.exists(scenePath)) {
      throw new LrnevError(
        ErrorCode.SCENE_CORRUPTED,
        `Scene "${id}" 的 scene.md 缺失`,
        { field: 'scene_id', hint: '运行 lrnev_doctor 定位损坏文件；若无法恢复，请调用 scene_create 重建业务 Scene。' },
      );
    }

    const content = await this.fs.read(scenePath);
    const parsed = parseFrontmatter<SceneFrontmatter>(content);

    const specPattern = `.lrnev/scenes/${resolvedId}/specs/*/requirements.md`;
    const specFiles = await this.fs.list(specPattern);

    return {
      ...parsed.frontmatter,
      // 容错：如果 frontmatter 缺字段，从目录名补齐
      id: parsed.frontmatter.id ?? resolvedId,
      number: parsed.frontmatter.number ?? extractNumber(resolvedId),
      name: parsed.frontmatter.name ?? extractName(resolvedId),
      status: parsed.frontmatter.status ?? 'draft',
      created: parsed.frontmatter.created ?? today(),
      path: this.fs.abs(`${SCENES_DIR}/${resolvedId}`),
      spec_count: specFiles.length,
    };
  }

  /**
   * 创建 Scene。
   *
   * 流程：
   *   1. 校验 name（kebab-case）
   *   2. 分配序号（用户指定 or 自动取 next）
   *   3. 校验 id 不冲突
   *   4. 渲染三文档模板
   *   5. 写入 + 更新 scene-numbers.json
   *   6. 返回 ai_followup
   */
  async create(input: CreateSceneInput): Promise<AiFollowupResponse<Scene>> {
    validateName(input.name);

    const scene = await this.fs.withDirectoryLock(
      '.lrnev/locks/create-scene.lockdir',
      () => this.createUnderLock(input),
    );

    const instructions = [
      `Scene "${scene.id}" 已创建，三份文档（scene.md / architecture.md / roadmap.md）在 ${SCENES_DIR}/${scene.id}`,
      '请协助用户填充 scene.md 的"业务背景"、"边界与范围"、"关键术语"等小节',
      '填充完毕后调用 summarize_save 生成 L0/L1 摘要',
      '如有跨 Spec 的架构约束，同时编辑 architecture.md',
      // 这里给确定性标尺，不替 AI 决定拆几个 Spec；GoalAssessor 也只作为辅助信号。
      ...SPEC_SPLITTING_RUBRIC,
      ...this.assessSplittingSignal(input.intent),
    ];
    const suggestedTools = [
      {
        name: 'summarize_save',
        args_template: {
          uri: `context://scene/${scene.id}`,
          l0: '<一句话摘要>',
          l1: '<约 2000 token 概览>',
        },
        reason: '生成 L0/L1 后供未来检索使用',
      },
      {
        name: 'spec_create',
        args_template: { scene: scene.id, name: '<feature-name>' },
        reason: 'Scene 准备好后可开始创建 Spec',
      },
      ...this.splittingSuggestedTools(input.intent),
    ];

    return {
      ok: true,
      data: scene,
      ai_followup: {
        instructions,
        suggested_tools: suggestedTools,
      },
    };
  }

  /**
   * 解析用户输入的 Scene 标识。
   *
   * 支持三种输入：
   *   1. 完整 id："01-user-management"
   *   2. 纯序号："01" / "1"
   *   3. 纯名字："user-management"
   *
   * @throws LrnevError(SCENE_NOT_FOUND) 找不到
   */
  async ensureExists(id: string = DEFAULT_SCENE_ID): Promise<Scene> {
    if (id !== DEFAULT_SCENE_ID) {
      return this.get(id);
    }

    const scenePath = `${SCENES_DIR}/${DEFAULT_SCENE_ID}/scene.md`;
    if (this.fs.exists(scenePath)) {
      return this.get(DEFAULT_SCENE_ID);
    }

    return this.fs.withDirectoryLock(
      '.lrnev/locks/ensure-default-scene.lockdir',
      () => this.ensureDefaultSceneUnderLock(),
    );
  }

  async resolveId(input: string): Promise<string> {
    if (!input) {
      throw new LrnevError(ErrorCode.INVALID_INPUT, 'Scene 标识不能为空', {
        field: 'scene_id',
      });
    }

    // 形如 "01-xxx" 已经是完整 id
    if (/^\d+-/.test(input)) {
      const dir = `${SCENES_DIR}/${input}`;
      if (this.fs.exists(dir)) return input;
      throw new LrnevError(ErrorCode.SCENE_NOT_FOUND, `Scene "${input}" 不存在`, {
        field: 'scene_id',
        hint: '先调用 scene_list 查看完整 Scene id；不要用不存在的完整 id 重试。',
      });
    }

    // 纯数字 → 找序号匹配
    if (/^\d+$/.test(input)) {
      const num = parseInt(input, 10);
      const files = await this.fs.list('.lrnev/scenes/*/scene.md');
      for (const file of files) {
        const id = extractSceneIdFromPath(file);
        if (id && extractNumber(id) === num) return id;
      }
      throw new LrnevError(
        ErrorCode.SCENE_NOT_FOUND,
        `找不到序号为 ${num} 的 Scene`,
        { field: 'scene_id', hint: '先调用 scene_list 查看现有 Scene，再用完整 id 重试。' },
      );
    }

    // 纯名字 → 找名字匹配
    const files = await this.fs.list('.lrnev/scenes/*/scene.md');
    for (const file of files) {
      const id = extractSceneIdFromPath(file);
      if (id && extractName(id) === input) return id;
    }
    throw new LrnevError(
      ErrorCode.SCENE_NOT_FOUND,
      `找不到名为 "${input}" 的 Scene`,
      { field: 'scene_id', hint: '使用 scene_list 查看现有 Scene；若这是新业务场景，请调用 scene_create。' },
    );
  }

  async getSharedDocument(
    sceneInput: string,
    document: SharedSceneDocument,
  ): Promise<SharedSceneDocumentSnapshot> {
    const sceneId = await this.resolveId(sceneInput);
    const path = this.sharedDocumentPath(sceneId, document);
    if (!this.fs.exists(path)) {
      throw new LrnevError(
        ErrorCode.SCENE_CORRUPTED,
        `Scene "${sceneInput}" 的 ${document}.md 缺失`,
        { field: 'document', hint: '运行 lrnev_doctor 定位损坏文件；恢复文档后重新读取并合并修改。' },
      );
    }
    const content = await this.fs.read(path);
    return {
      scene: sceneId,
      document,
      path: this.fs.abs(path),
      content,
      revision: hashContent(content),
    };
  }

  async updateSharedDocument(
    input: UpdateSharedSceneDocumentInput,
  ): Promise<AiFollowupResponse<SharedSceneDocumentSnapshot>> {
    const sceneId = await this.resolveId(input.scene);
    const document = input.document;
    const lockPath = `.lrnev/locks/scene-${safeId(sceneId)}-${document}.lockdir`;
    return this.fs.withDirectoryLock(lockPath, async () => {
      const current = await this.getSharedDocument(sceneId, document);
      if (current.revision !== input.expected_revision) {
        throw new LrnevError(
          ErrorCode.INVALID_INPUT,
          `Scene "${sceneId}" 的 ${document}.md 已被修改，拒绝覆盖`,
          {
            field: 'expected_revision',
            hint: '重新读取最新文档，合并修改后再写入',
          },
        );
      }

      const relPath = this.sharedDocumentPath(sceneId, document);
      await this.fs.write(relPath, input.content);
      const updated = await this.getSharedDocument(sceneId, document);
      return {
        ok: true,
        data: updated,
        ai_followup: {
          instructions: [
            `${document}.md 已更新。`,
            '如果另一个会话写入失败，请让它重新读取最新文档并合并修改。',
          ],
        },
      };
    });
  }

  private async createUnderLock(input: CreateSceneInput): Promise<Scene> {
    const sameName = (await this.list()).find((s) => s.name === input.name);
    if (sameName) {
      throw new LrnevError(
        ErrorCode.INVALID_INPUT,
        `已有同名 Scene："${sameName.id}"`,
        {
          field: 'name',
          hint: '同名 Scene 会让 resolveId 产生歧义，请换名字',
        },
      );
    }

    let number = input.number ?? await this.nextSceneNumber();
    const maxAttempts = input.number === undefined ? loadConfig(this.fs.root).scene.create_max_attempts : 1;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const id = formatSceneId(number, input.name);
      const sceneDir = `${SCENES_DIR}/${id}`;
      const date = today();
      const titleName = toTitleCase(input.name);
      const sceneVars = {
        id,
        number,
        name: input.name,
        name_title: titleName,
        date,
        intent: input.intent ?? '',
      };

      const sceneMd = await renderTemplate('scene', 'scene.md', sceneVars);
      const archMd = await renderTemplate('scene', 'architecture.md', sceneVars);
      const roadMd = await renderTemplate('scene', 'roadmap.md', sceneVars);

      if (!await this.fs.mkdirExclusive(sceneDir)) {
        if (input.number !== undefined) {
          throw new LrnevError(
            ErrorCode.INVALID_INPUT,
            `Scene "${id}" 已存在`,
            { field: 'name', hint: '换一个名字或使用 scene_get 查看现有 Scene' },
          );
        }
        number++;
        continue;
      }

      await this.fs.write(`${sceneDir}/scene.md`, sceneMd);
      await this.fs.write(`${sceneDir}/architecture.md`, archMd);
      await this.fs.write(`${sceneDir}/roadmap.md`, roadMd);
      await this.fs.mkdir(`${sceneDir}/specs`);
      return this.get(id);
    }

    throw new LrnevError(
      ErrorCode.INVALID_INPUT,
      `Scene 序号分配重试耗尽：${input.name}`,
      { field: 'number', hint: '检查 .lrnev/scenes 是否有并发创建或损坏目录' },
    );
  }

  private async ensureDefaultSceneUnderLock(): Promise<Scene> {
    const scenePath = `${SCENES_DIR}/${DEFAULT_SCENE_ID}/scene.md`;
    if (this.fs.exists(scenePath)) {
      return this.get(DEFAULT_SCENE_ID);
    }

    const sceneDir = `${SCENES_DIR}/${DEFAULT_SCENE_ID}`;
    const date = today();
    const sceneMd = await renderTemplate('scene', 'scene.md', {
      id: DEFAULT_SCENE_ID,
      number: 0,
      name: DEFAULT_SCENE_NAME,
      name_title: 'Default',
      date,
      intent: 'Default landing scene for specs without an explicit scene.',
    });

    await this.fs.mkdir(sceneDir);
    await this.fs.write(scenePath, sceneMd);
    await this.fs.mkdir(`${sceneDir}/specs`);
    return this.get(DEFAULT_SCENE_ID);
  }

  private async nextSceneNumber(): Promise<number> {
    const dirs = await this.fs.list(`${SCENES_DIR}/*`);
    let max = 0;
    for (const dir of dirs) {
      const id = extractSceneIdFromDir(dir);
      if (!id) continue;
      const n = extractNumber(id);
      if (n > max) max = n;
    }
    return max + 1;
  }

  private sharedDocumentPath(sceneId: string, document: SharedSceneDocument): string {
    return `${SCENES_DIR}/${sceneId}/${document}.md`;
  }

  private assessSplittingSignal(intent?: string): string[] {
    const text = intent?.trim();
    if (!text) return [];
    try {
      const assessment = this.goalAssessor.assess(text).data;
      return [splittingSignalInstruction(assessment.kind, assessment.reasons[0])];
    } catch {
      return [];
    }
  }

  private splittingSuggestedTools(intent?: string) {
    const text = intent?.trim();
    if (!text) return [];
    try {
      const assessment = this.goalAssessor.assess(text).data;
      if (assessment.kind !== 'multi-spec-program') return [];
      return [
        {
          name: 'assess_goal',
          args_template: { goal: text },
          reason: '需要更细粒度评估单/多 Spec 拆分时调用',
        },
      ];
    } catch {
      return [];
    }
  }
}

function splittingSignalInstruction(kind: GoalAssessmentKind, reason?: string): string {
  if (kind === 'multi-spec-program') {
    return `信号提示：你的意图里有多特性迹象，多半要拆；请用上面三条标尺确认。${reason ? `辅助原因：${reason}` : ''}`;
  }
  if (kind === 'research-program') {
    return '信号提示：意图含调研/选型/不确定，考虑先做研究型 Spec 或记 ADR，再拆实现 Spec。';
  }
  return '信号提示：启发式未明确判定为多特性；请按上面三条标尺自行判断是否要拆分（不要因为这条信号就少拆）。';
}

/**
 * 校验 Scene name（kebab-case + 不含特殊字符）。
 *
 * 规则：
 *   - 仅小写字母、数字、短横线
 *   - 不能以短横线开头 / 结尾
 *   - 长度 2 ~ 64
 */
function validateName(name: string): void {
  if (!name) {
    throw new LrnevError(ErrorCode.INVALID_INPUT, 'Scene name 不能为空', {
      field: 'name',
    });
  }
  if (name.length < 2 || name.length > 64) {
    throw new LrnevError(ErrorCode.INVALID_INPUT, `Scene name 长度需在 2~64 之间："${name}"`, {
      field: 'name',
    });
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
    throw new LrnevError(
      ErrorCode.INVALID_INPUT,
      `Scene name 必须是 kebab-case（小写字母 / 数字 / 短横线）："${name}"`,
      {
        field: 'name',
        hint: '例：user-management、order-fulfillment',
      },
    );
  }
}

/** 把序号 + name 拼成完整 id：1 + "user-management" → "01-user-management" */
function formatSceneId(number: number, name: string): string {
  if (!Number.isInteger(number) || number <= 0 || number > 99) {
    throw new LrnevError(
      ErrorCode.INVALID_INPUT,
      `Scene 序号必须是 1~99 整数：${number}`,
      { field: 'number' },
    );
  }
  return `${String(number).padStart(2, '0')}-${name}`;
}

/** 从 "01-user-management" 抽序号 → 1 */
function extractNumber(id: string): number {
  const m = /^(\d+)-/.exec(id);
  return m ? parseInt(m[1]!, 10) : 0;
}

/** 从 "01-user-management" 抽 name → "user-management" */
function extractName(id: string): string {
  const m = /^\d+-(.+)$/.exec(id);
  return m ? m[1]! : id;
}

/** 从 "scenes/01-user-management/scene.md" 抽 id */
function extractSceneIdFromPath(path: string): string | null {
  const m = /^\.lrnev\/scenes\/([^/]+)\/scene\.md$/.exec(path);
  return m ? m[1]! : null;
}

function extractSceneIdFromDir(path: string): string | null {
  const m = /^\.lrnev\/scenes\/([^/]+)$/.exec(path);
  return m ? m[1]! : null;
}

function isFullSceneId(input: string): boolean {
  return /^\d+-/.test(input);
}

function makeBrokenScene(fs: FileStorage, id: string, scenePath: string, err: unknown): Scene {
  return {
    id,
    number: extractNumber(id),
    name: extractName(id),
    status: 'draft',
    created: today(),
    path: fs.abs(`${SCENES_DIR}/${id}`),
    spec_count: 0,
    broken: {
      error: err instanceof Error ? err.message : String(err),
      path: fs.abs(scenePath),
    },
  };
}

function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '_');
}

// 让生产代码也能复用这些工具函数
export { formatSceneId, extractNumber, extractName, validateName };
// 为序列化骨架预留（未用，suppress lint）
void serializeFrontmatter;
