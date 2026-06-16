/**
 * SpecManager —— Spec 管理（增删查 + Scene 内序号 + 版本号）
 *
 * 职责（详见 design.md 第 6.2 节）：
 *   1. list(scene)       —— 列出该 Scene 下所有 Spec
 *   2. get(scene, spec)  —— 读单个 Spec（路径 + frontmatter + 三文档存在性）
 *   3. create(...)       —— Scene 内序号 + 三文档（requirements/design/tasks）+ ai_followup
 *   4. resolveId(...)    —— 用户输入归一化
 *
 * 命名约定：
 *   "{NN:02d}-{VV:02d}-{kebab-name}"
 *   NN：Scene 内递增序号（不重用）
 *   VV：版本号，默认 00（重写时升 01/02...）
 *
 * 例：01-00-user-registration、02-00-user-login、01-01-user-registration(重写版)
 */

import { parseFrontmatter, serializeFrontmatter } from '../storage/FrontmatterCodec.js';
import { FileStorage } from '../storage/FileStorage.js';
import { LrnevError, ErrorCode } from '../shared/errors.js';
import { loadConfig } from '../shared/config.js';
import { renderTemplate, today, toTitleCase } from './Templates.js';
import { DEFAULT_SCENE_ID, SceneManager } from './SceneManager.js';
import { appendHookWarnings, getHookManager } from './HookManager.js';
import { EARS_ACCEPTANCE_EXAMPLE } from '../mcp/guidance.js';
import { VALID_SPEC_TRANSITIONS, isValidSpecTransition } from '../types/spec.js';
import type {
  Spec,
  SpecFrontmatter,
  SpecStatus,
  SpecDocument,
  CreateSpecInput,
} from '../types/spec.js';
import type { AiFollowupResponse } from '../types/response.js';

const SPEC_DOCS: SpecDocument[] = ['requirements', 'design', 'tasks'];

interface ExistingSpecInfo {
  spec: string;
  number: number;
  version: number;
  name: string;
}

export class SpecManager {
  constructor(
    private readonly fs: FileStorage,
    private readonly sceneManager: SceneManager,
  ) {}

  /**
   * 列出某 Scene 下所有 Spec。
   *
   * @param sceneInput 任意 Scene 标识（id/数字/名字），由 SceneManager.resolveId 归一化
   */
  async list(sceneInput: string): Promise<Spec[]> {
    const sceneId = await this.sceneManager.resolveId(sceneInput);
    const pattern = `.lrnev/scenes/${sceneId}/specs/*`;
    const files = await this.fs.list(pattern);
    files.sort();

    const specs: Spec[] = [];
    for (const file of files) {
      const specId = extractSpecIdFromPath(file);
      if (!specId) continue;
      try {
        specs.push(await this.get(sceneId, specId));
      } catch (err) {
        specs.push(makeBrokenSpec(this.fs, sceneId, specId, `${file}/requirements.md`, err));
      }
    }
    return specs;
  }

  /**
   * 读单个 Spec 详情。
   *
   * @param sceneInput Scene 标识
   * @param specInput  Spec 标识（完整 id 或 "01-00" 这种前缀）
   */
  async get(sceneInput: string, specInput: string): Promise<Spec> {
    const sceneId = await this.sceneManager.resolveId(sceneInput);
    const directDir = `.lrnev/scenes/${sceneId}/specs/${specInput}`;
    const specId = isFullSpecId(specInput) && this.fs.exists(directDir)
      ? specInput
      : await this.resolveId(sceneId, specInput);
    const dir = `.lrnev/scenes/${sceneId}/specs/${specId}`;
    const reqPath = `${dir}/requirements.md`;

    if (!this.fs.exists(reqPath)) {
      if (this.fs.exists(dir)) {
        throw new LrnevError(
          ErrorCode.SPEC_CORRUPTED,
          `Spec "${specInput}" 的 requirements.md 缺失`,
          { field: 'spec_id', hint: '运行 lrnev_doctor 定位损坏文件；若无法恢复，请用 spec_create 重新创建 Spec 骨架。' },
        );
      }
      throw new LrnevError(
        ErrorCode.SPEC_NOT_FOUND,
        `Spec "${specInput}" 不存在`,
        { field: 'spec_id', hint: '先调用 spec_list 查看当前 Scene 的完整 Spec id；若确实没有，请调用 spec_create 创建。' },
      );
    }

    const content = await this.fs.read(reqPath);
    const parsed = parseFrontmatter<SpecFrontmatter>(content);

    const { number, version, name } = parseSpecParts(specId);
    const documents = {
      requirements: this.fs.exists(`${dir}/requirements.md`),
      design: this.fs.exists(`${dir}/design.md`),
      tasks: this.fs.exists(`${dir}/tasks.md`),
    };

    return {
      ...parsed.frontmatter,
      spec: parsed.frontmatter.spec ?? specId,
      scene: parsed.frontmatter.scene ?? sceneId,
      status: parsed.frontmatter.status ?? 'draft',
      created: parsed.frontmatter.created ?? today(),
      path: this.fs.abs(dir),
      number,
      version,
      name,
      documents,
    };
  }

  /**
   * 按状态机更新 Spec 状态（draft→ready→in-progress→completed→archived）。
   *
   * 激活 types/spec.ts 的 VALID_SPEC_TRANSITIONS：合法转换写回 requirements.md
   * frontmatter（status + updated），非法转换抛 INVALID_STATUS_TRANSITION。
   * 相同状态幂等返回，不报错。lrnev 不替 AI 决定何时改状态，只提供这条改的通道。
   */
  async updateStatus(
    sceneInput: string,
    specInput: string,
    status: SpecStatus,
    reason?: string,
  ): Promise<AiFollowupResponse<Spec>> {
    const current = await this.get(sceneInput, specInput);
    const from = current.status;

    if (from !== status) {
      if (!isValidSpecTransition(from, status)) {
        const allowed = VALID_SPEC_TRANSITIONS[from];
        throw new LrnevError(
          ErrorCode.INVALID_STATUS_TRANSITION,
          `非法 Spec 状态转换：${from} → ${status}`,
          {
            field: 'status',
            hint: allowed.length > 0
              ? `当前 ${from} 只允许转换到：${allowed.join('、')}`
              : `${from} 是终态，不能再转换；如需重做请用 spec_create 开新版`,
          },
        );
      }
      const reqPath = `.lrnev/scenes/${current.scene}/specs/${current.spec}/requirements.md`;
      const content = await this.fs.read(reqPath);
      const parsed = parseFrontmatter<SpecFrontmatter>(content);
      const next = { ...parsed.frontmatter, status, updated: today() };
      await this.fs.write(reqPath, serializeFrontmatter(next, parsed.body));
    }

    const data = await this.get(current.scene, current.spec);
    const instructions = from === status
      ? [`Spec "${data.spec}" 已是 ${status}，无需变更。`]
      : [`Spec "${data.spec}" 状态 ${from} → ${status}${reason ? `（${reason}）` : ''}。`];
    if (status === 'archived') {
      instructions.push('已归档：该 Spec 的待办任务不再出现在 project_status 的可领任务列表。');
    }
    return { ok: true, data, ai_followup: { instructions } };
  }

  /**
   * 创建 Spec。
   *
   * 流程：
   *   1. 校验 Scene 存在
   *   2. 校验 name 是 kebab-case
   *   3. 分配 Scene 内序号（不重用）
   *   4. 校验 id 不冲突
   *   5. 渲染三文档模板
   *   6. 返回 ai_followup
   */
  async create(input: CreateSpecInput): Promise<AiFollowupResponse<Spec>> {
    const sceneId = input.scene === undefined
      ? (await this.sceneManager.ensureExists(DEFAULT_SCENE_ID)).id
      : await this.sceneManager.resolveId(input.scene);
    validateSpecName(input.name);

    const version = input.version ?? 0;
    if (!Number.isInteger(version) || version < 0 || version > 99) {
      throw new LrnevError(
        ErrorCode.INVALID_INPUT,
        `Spec 版本号必须是 0~99 整数：${version}`,
        { field: 'version' },
      );
    }

    const { spec, siblingSpecIds } = await this.fs.withDirectoryLock(
      `.lrnev/locks/create-spec-${safeId(sceneId)}.lockdir`,
      () => this.createUnderLock(sceneId, input, version),
    );

    const hookResult = await getHookManager(this.fs.root).trigger('spec.create', {
      scene: sceneId,
      spec: spec.spec,
      name: spec.name,
      path: spec.path,
      priority: input.priority,
    });

    const instructions = [
      `Spec "${spec.spec}" 已创建于 Scene "${sceneId}"，路径 .lrnev/scenes/${sceneId}/specs/${spec.spec}`,
      '分流提醒（你正在开 spec，先确认该不该开、开在哪）：若这其实是给已完成特性加的小增量，通常该 context_search 找到对应 spec 用 task_create 落位、而非新开；若确是独立新特性，scene 选择——优先归入已有匹配业务域 scene；只有用户明确确认、或上下文非常清楚这是会承载多个 spec 的新业务域，才 scene_create；零散无稳定业务域的小型独立特性才落 00-default（兜底）。scene / 00-default 难回退，拿不准就问用户、别默认。',
      '请协助用户填充 requirements.md 的"目标"、"用户故事"、"详细需求"',
      '需求填完后调用 spec_gate_check(gate=ready) 检查',
      '通过后再填 design.md（技术方案），最后填 tasks.md（任务清单）',
      '关键决策出现时主动询问用户是否生成 ADR（参考 context://steering/adr）',
      EARS_ACCEPTANCE_EXAMPLE,
    ];
    if (siblingSpecIds.length > 0) {
      instructions.push(
        `本 Scene 已有 Spec：${siblingSpecIds.join('、')}。你的改动可能与它们相关，建议先读它们按文档键控的 L0 摘要或用 context_search 确认有无冲突/复用。`,
      );
    }

    const suggestedTools: Array<{ name: string; args_template: Record<string, unknown>; reason: string }> = [
      {
        name: 'spec_gate_check',
        args_template: { scene: sceneId, spec: spec.spec, gate: 'ready' },
        reason: '需求填完后检查是否可进入实施',
      },
      {
        name: 'summarize_save',
        args_template: {
          uri: `context://spec/${sceneId}/${spec.spec}`,
          l0: '<一句话摘要>',
          l1: '<约 2000 token 概览>',
        },
        reason: '需求稳定后生成 L0/L1，便于跨 Spec 检索',
      },
    ];

    // 重写版引导归档旧版：version>0 且存在同名、更低版本的旧 Spec 时，
    // surface 归档动作（不自动归档，是否归档由 AI/用户判断）。
    if (version > 0) {
      const prevId = siblingSpecIds
        .map((id) => ({ id, parts: tryParseSpecParts(id) }))
        .filter((s) => s.parts && s.parts.name === input.name && s.parts.version < version)
        .sort((a, b) => b.parts!.version - a.parts!.version)[0]?.id;
      if (prevId) {
        instructions.push(
          `检测到这是 ${prevId} 的重写版。若旧版方案已被本版取代，可用 spec_update 把 ${prevId} 标记为 archived（归档后它的待办任务不再出现在 project_status 的可领列表）；是否归档由你和用户判断，lrnev 不自动归档。`,
        );
        suggestedTools.push({
          name: 'spec_update',
          args_template: { scene: sceneId, spec: prevId, status: 'archived' },
          reason: '旧版方案已被本重写版取代时归档旧版',
        });
      }
    }

    return appendHookWarnings({
      ok: true,
      data: spec,
      ai_followup: {
        instructions,
        suggested_tools: suggestedTools,
      },
    }, hookResult.warnings);
  }

  /**
   * 解析 Spec 标识。
   *
   * 支持：
   *   1. 完整 id："01-00-user-login"
   *   2. 序号-版本前缀："01-00" / "01"（仅当 Scene 内唯一时）
   *   3. 纯名字："user-login"（仅当 Scene 内唯一时）
   */
  async resolveId(sceneInput: string, input: string): Promise<string> {
    const sceneId = await this.sceneManager.resolveId(sceneInput);

    if (!input) {
      throw new LrnevError(ErrorCode.INVALID_INPUT, 'Spec 标识不能为空', {
        field: 'spec_id',
      });
    }

    const pattern = `.lrnev/scenes/${sceneId}/specs/*/requirements.md`;
    const files = await this.fs.list(pattern);
    const allIds = files.map(extractSpecIdFromPath).filter((x): x is string => !!x).sort();

    // 完整 id 命中
    if (allIds.includes(input)) return input;

    // 序号-版本前缀（如 01-00）
    if (/^\d+(-\d+)?$/.test(input)) {
      const candidates = allIds.filter((id) => id.startsWith(input + '-'));
      if (candidates.length === 1) return candidates[0]!;
      if (candidates.length > 1) {
        throw new LrnevError(
          ErrorCode.AMBIGUOUS_REF,
          `Spec 前缀 "${input}" 不唯一：${candidates.join(', ')}`,
          {
            field: 'spec_id',
            hint: '请从 candidates 选择一个完整 Spec id，并用该完整 id 重新调用当前工具。',
            candidates,
          },
        );
      }
    }

    // 纯名字（最后一段）
    const byName = allIds.filter((id) => tryParseSpecParts(id)?.name === input);
    if (byName.length === 1) return byName[0]!;
    if (byName.length > 1) {
      throw new LrnevError(
        ErrorCode.AMBIGUOUS_REF,
        `Spec 名 "${input}" 不唯一：${byName.join(', ')}`,
        {
          field: 'spec_id',
          hint: '请从 candidates 选择一个完整 Spec id，并用该完整 id 重新调用当前工具。',
          candidates: byName,
        },
      );
    }

    throw new LrnevError(
      ErrorCode.SPEC_NOT_FOUND,
      `Scene "${sceneId}" 内找不到 Spec "${input}"`,
      { field: 'spec_id', hint: '先调用 spec_list 查看现有 Spec；若这是新特性，请调用 spec_create 创建。' },
    );
  }

  /**
   * 决定新 Spec 的主序号。
   *
   * 首版（version=0）或全新名字：使用 Scene 内下一个递增序号。
   * 重写版（同名 version>0）：沿用该名字已有 Spec 的主序号，只递增版本位，
   * 这样 `01-00-foo` 的重写版会是 `01-01-foo`，符合 design.md 的版本语义。
   */
  private resolveNumberForCreate(existing: ExistingSpecInfo[], name: string, version: number): number {
    const sameNameSpecs = existing.filter((s) => s.name === name);
    if (sameNameSpecs.length > 0) {
      if (version === 0) {
        return this.nextNumberFromExisting(existing);
      }
      return Math.min(...sameNameSpecs.map((s) => s.number));
    }
    return this.nextNumberFromExisting(existing);
  }

  private nextNumberFromExisting(existing: ExistingSpecInfo[]): number {
    let max = 0;
    for (const spec of existing) {
      if (spec.number > max) max = spec.number;
    }
    return max + 1;
  }

  private async createUnderLock(
    sceneId: string,
    input: CreateSpecInput,
    version: number,
  ): Promise<{ spec: Spec; siblingSpecIds: string[] }> {
    const existing = await this.listExistingSpecInfo(sceneId);
    const siblingSpecIds = existing.map((s) => s.spec);
    const sameName = existing.find((s) => s.name === input.name && s.version === version);
    if (sameName) {
      throw new LrnevError(
        ErrorCode.INVALID_INPUT,
        `Scene "${sceneId}" 内已有同名 Spec："${sameName.spec}"`,
        { field: 'name', hint: '若是重写，请指定 version > 0' },
      );
    }

    let number = this.resolveNumberForCreate(existing, input.name, version);
    const maxAttempts = loadConfig(this.fs.root).spec.create_max_attempts;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const specId = formatSpecId(number, version, input.name);
      const dir = `.lrnev/scenes/${sceneId}/specs/${specId}`;
      const date = today();
      const titleName = `${String(number).padStart(2, '0')}-${String(version).padStart(2, '0')} ${toTitleCase(input.name)}`;
      const vars = {
        spec_id: specId,
        scene_id: sceneId,
        name_title: titleName,
        date,
        priority_line: input.priority ? `priority: ${input.priority}\n` : '',
      };

      const requirements = await renderTemplate('spec', 'requirements.md', vars);
      const design = await renderTemplate('spec', 'design.md', vars);
      const tasksTmpl = await renderTemplate('spec', 'tasks.md', vars);

      if (!await this.fs.mkdirExclusive(dir)) {
        number++;
        continue;
      }

      await this.fs.write(`${dir}/requirements.md`, requirements);
      await this.fs.write(`${dir}/design.md`, design);
      await this.fs.write(`${dir}/tasks.md`, tasksTmpl);

      return {
        spec: await this.get(sceneId, specId),
        siblingSpecIds,
      };
    }

    throw new LrnevError(
      ErrorCode.INVALID_INPUT,
      `Spec 序号分配重试耗尽：${input.name}`,
      { field: 'number', hint: '检查该 Scene 下 specs 目录是否有并发创建或损坏目录' },
    );
  }

  /** 列出 Scene 下已有 Spec 的 id/序号/版本信息，供分配序号与轻量依赖提示复用。 */
  private async listExistingSpecInfo(sceneId: string): Promise<ExistingSpecInfo[]> {
    const dirs = await this.fs.list(`.lrnev/scenes/${sceneId}/specs/*`);
    const specs = dirs
      .map(extractSpecIdFromPath)
      .filter((id): id is string => !!id)
      .sort();
    const existing: ExistingSpecInfo[] = [];
    for (const spec of specs) {
      const parts = tryParseSpecParts(spec);
      if (parts) existing.push({ spec, ...parts });
    }
    return existing;
  }
}

/** 校验 Spec name */
function validateSpecName(name: string): void {
  if (!name) {
    throw new LrnevError(ErrorCode.INVALID_INPUT, 'Spec name 不能为空', { field: 'name' });
  }
  if (name.length < 2 || name.length > 64) {
    throw new LrnevError(ErrorCode.INVALID_INPUT, `Spec name 长度需在 2~64："${name}"`, {
      field: 'name',
    });
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
    throw new LrnevError(
      ErrorCode.INVALID_INPUT,
      `Spec name 必须是 kebab-case："${name}"`,
      { field: 'name', hint: '例：user-login、password-reset' },
    );
  }
}

/** {NN:02d}-{VV:02d}-{name} */
export function formatSpecId(number: number, version: number, name: string): string {
  assertTwoDigitNumber(number, 'number', 'Spec 序号', 1);
  assertTwoDigitNumber(version, 'version', 'Spec 版本号', 0);
  return `${String(number).padStart(2, '0')}-${String(version).padStart(2, '0')}-${name}`;
}

/** 拆分 "01-00-user-login" → { number: 1, version: 0, name: 'user-login' } */
export function parseSpecParts(specId: string): {
  number: number;
  version: number;
  name: string;
} {
  const m = /^(\d{2})-(\d{2})-([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(specId);
  if (!m) {
    throw new LrnevError(
      ErrorCode.INVALID_INPUT,
      `Spec id 格式无效："${specId}"，应为 {NN}-{VV}-{kebab-name}`,
      { field: 'spec_id' },
    );
  }
  const number = parseInt(m[1]!, 10);
  const version = parseInt(m[2]!, 10);
  if (number < 1) {
    throw new LrnevError(
      ErrorCode.INVALID_INPUT,
      `Spec 序号必须是 1~99 整数："${specId}"`,
      { field: 'spec_id' },
    );
  }
  return {
    number,
    version,
    name: m[3]!,
  };
}

export function tryParseSpecParts(specId: string): {
  number: number;
  version: number;
  name: string;
} | null {
  try {
    return parseSpecParts(specId);
  } catch {
    return null;
  }
}

function assertTwoDigitNumber(
  value: number,
  field: string,
  label: string,
  min: number,
): void {
  if (!Number.isInteger(value) || value < min || value > 99) {
    throw new LrnevError(
      ErrorCode.INVALID_INPUT,
      `${label}必须是 ${min}~99 整数：${value}`,
      { field },
    );
  }
}

/** 从 "scenes/{scene}/specs/{spec}/requirements.md" 抽 specId */
function extractSpecIdFromPath(path: string): string | null {
  const m = /^\.lrnev\/scenes\/[^/]+\/specs\/([^/]+)(?:\/requirements\.md)?$/.exec(path);
  return m ? m[1]! : null;
}

function isFullSpecId(input: string): boolean {
  return /^\d+-\d+-/.test(input);
}

function makeBrokenSpec(
  fs: FileStorage,
  sceneId: string,
  specId: string,
  requirementsPath: string,
  err: unknown,
): Spec {
  const { number, version, name } = tryParseSpecParts(specId) ?? {
    number: -1,
    version: -1,
    name: specId,
  };
  const dir = `.lrnev/scenes/${sceneId}/specs/${specId}`;
  return {
    spec: specId,
    scene: sceneId,
    status: 'draft',
    created: today(),
    path: fs.abs(dir),
    number,
    version,
    name,
    documents: {
      requirements: fs.exists(`${dir}/requirements.md`),
      design: fs.exists(`${dir}/design.md`),
      tasks: fs.exists(`${dir}/tasks.md`),
    },
    broken: {
      error: err instanceof Error ? err.message : String(err),
      path: fs.abs(requirementsPath),
    },
  };
}

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '_');
}

export { SPEC_DOCS, validateSpecName };
