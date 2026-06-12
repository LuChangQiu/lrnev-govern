/**
 * TaskManager —— Task 管理（状态机 + tasks.md 结构化读写）
 *
 * 职责：
 *   1. list(scene, spec)         —— 列出 Spec 内所有 Task
 *   2. create(input)             —— 在 tasks.md 追加新 Task
 *   3. update(input)             —— 状态机校验 + 改 tasks.md
 *   4. get(scene, spec, taskId)  —— 读单个 Task
 *
 * tasks.md 结构（lrnev 约定）：
 *   ---
 *   spec: '...'
 *   ...
 *   ---
 *
 *   # 标题
 *
 *   ## 阶段 X
 *
 *   ### T-001 任务标题 <!-- lrnev-task: status=pending, created=2026-05-28 -->
 *   描述...
 *   - **验收**：...
 *
 * 关键设计：
 *   - 用 HTML 注释承载状态元数据（不污染人类阅读）
 *   - Task ID 由 manager 分配（T-001 / T-002 ...），Scene 全局递增（在 Spec 内）
 *   - 阶段名（## X）由用户在模板里编辑，本 manager 不强制
 *   - 创建 Task 时若无 ## 章节则塞进默认 "## 任务" 章节
 *   - 只治理 tasks.md 与运行态 claim，不调用 LLM、不 spawn agent、不读取或锁定源码文件
 */

import { FileStorage } from '../storage/FileStorage.js';
import { LrnevError, ErrorCode } from '../shared/errors.js';
import { SceneManager } from './SceneManager.js';
import { SpecManager } from './SpecManager.js';
import { appendHookWarnings, getHookManager } from './HookManager.js';
import { ClaimStore } from './ClaimStore.js';
import { AgentRegistry } from './AgentRegistry.js';
import type {
  Task,
  TaskStatus,
  ReadableTask,
  CreateTaskInput,
  UpdateTaskInput,
  TaskListView,
} from '../types/task.js';
import { VALID_TASK_TRANSITIONS, isValidTransition } from '../types/task.js';
import type { SpecStatus } from '../types/spec.js';
import type { AiFollowupResponse } from '../types/response.js';
import type {
  ClaimTaskInput,
  ReleaseTaskClaimInput,
  TaskClaimReleaseResult,
  TaskClaimResult,
} from '../types/claim.js';

/** 嵌入 Task 标题行的元数据注释正则 */
const META_REGEX = /<!--\s*lrnev-task:\s*([^>]*?)\s*-->/;

/** Task 标题行格式：### T-001 标题 <!-- lrnev-task: ... -->（meta 注释必填，作为"真 lrnev Task"的标记） */
const TASK_HEADING_LINE_RE = /^###\s+T-\d{3,}\s/;
const TASK_HEADING_REGEX =
  /^###\s+(T-\d{3,})\s+(.+?)\s+<!--\s*lrnev-task:\s*([^>]*?)\s*-->\s*$/;

/** Task 历史行格式：<!-- lrnev-task-history: [...JSON...] --> */
const HISTORY_LINE_REGEX = /^<!--\s*lrnev-task-history:\s*(.+?)\s*-->\s*$/;

export class TaskManager {
  constructor(
    private readonly fs: FileStorage,
    private readonly sceneManager: SceneManager,
    private readonly specManager: SpecManager,
  ) {}

  /** 列出 Spec 下所有 Task */
  async list(sceneInput: string, specInput: string): Promise<Task[]>;
  async list(sceneInput: string, specInput: string, options: { view: 'raw' }): Promise<Task[]>;
  async list(sceneInput: string, specInput: string, options: { view: 'readable' }): Promise<ReadableTask[]>;
  async list(
    sceneInput: string,
    specInput: string,
    options: { view?: TaskListView } = {},
  ): Promise<Task[] | ReadableTask[]> {
    const sceneId = await this.sceneManager.resolveId(sceneInput);
    const specId = await this.specManager.resolveId(sceneId, specInput);
    const tasksPath = this.tasksPath(sceneId, specId);

    if (!this.fs.exists(tasksPath)) return [];
    const content = await this.fs.read(tasksPath);
    const tasks = attachTaskChildren(parseTasksFromMarkdown(content, sceneId, specId));
    return options.view === 'readable' ? tasks.map(toReadableTask) : tasks;
  }

  /** 读单个 Task */
  async get(
    sceneInput: string,
    specInput: string,
    taskId: string,
  ): Promise<Task> {
    const tasks = await this.list(sceneInput, specInput);
    const task = tasks.find((t) => t.id === taskId);
    if (!task) {
      throw new LrnevError(
        ErrorCode.TASK_NOT_FOUND,
        `Task "${taskId}" 不存在于 Spec "${specInput}"`,
        { field: 'task_id' },
      );
    }
    return task;
  }

  /**
   * 创建 Task。
   *
   * 行为：
   *   - 自动分配 T-XXX 编号（Spec 内递增）
   *   - 追加到 tasks.md 末尾（如果有 ## 章节则进最后一个；否则建 "## 任务"）
   *   - 默认状态 pending
   */
  async create(input: CreateTaskInput): Promise<AiFollowupResponse<Task>> {
    if (!input.title || input.title.trim().length === 0) {
      throw new LrnevError(ErrorCode.INVALID_INPUT, 'Task 标题不能为空', {
        field: 'title',
      });
    }

    const sceneId = await this.sceneManager.resolveId(input.scene);
    const specId = await this.specManager.resolveId(sceneId, input.spec);
    const tasksPath = this.tasksPath(sceneId, specId);

    const task = await this.withTasksFileLock(sceneId, specId, async () => {
      if (!this.fs.exists(tasksPath)) {
        throw new LrnevError(
          ErrorCode.FILE_NOT_FOUND,
          `tasks.md 不存在：${tasksPath}`,
          { field: 'spec', hint: '先确认 scene/spec 参数是否正确；若 Spec 骨架缺失，请重新调用 spec_create，若疑似损坏请运行 lrnev_doctor。' },
        );
      }

      const content = await this.fs.read(tasksPath);
      const existing = parseTasksFromMarkdown(content, sceneId, specId);
      const existingIds = new Set(existing.map((t) => t.id));
      if (input.parent && !existingIds.has(input.parent)) {
        throw new LrnevError(
          ErrorCode.TASK_NOT_FOUND,
          `父 Task "${input.parent}" 不存在`,
          { field: 'parent' },
        );
      }
      // I-7（存在性部分）: depends_on 指向不存在的 task ID 时硬拒、不落盘（坏结构引用，与 parent 同类）。
      const missingDeps = findMissingReferences(input.depends_on ?? [], existingIds);
      if (missingDeps.length > 0) {
        throw new LrnevError(
          ErrorCode.TASK_NOT_FOUND,
          `depends_on 指向不存在的 Task：${missingDeps.join('、')}`,
          { field: 'depends_on', hint: '先用 task_list 确认依赖的 Task ID，或去掉不存在的依赖。' },
        );
      }

      const nextNum = computeNextTaskNumber(existing);
      const taskId = formatTaskId(nextNum);

      const now = new Date().toISOString();
      const newTask: Task = {
        id: taskId,
        scene: sceneId,
        spec: specId,
        title: input.title,
        description: input.description ?? '',
        status: 'pending',
        acceptance: input.acceptance ?? [],
        depends_on: input.depends_on ?? [],
        ...(input.parent && { parent: input.parent }),
        validates: input.validates ?? [],
        created: now,
      };

      const updated = input.parent
        ? insertChildTaskToMarkdown(content, input.parent, newTask)
        : appendTaskToMarkdown(content, newTask);
      await this.fs.write(tasksPath, updated);
      return newTask;
    });

    const hookResult = await getHookManager(this.fs.root).trigger('task.create', {
      scene: sceneId,
      spec: specId,
      task_id: task.id,
      title: task.title,
      status: task.status,
      parent: task.parent,
      validates: task.validates,
    });

    return appendHookWarnings({
      ok: true,
      data: task,
      ai_followup: {
        instructions: [
          `Task "${task.id}" 已创建，状态为 pending`,
          '开始工作前调 task_update 把状态改为 in_progress',
          '完成后调 task_update 改为 completed，注意状态机限制',
        ],
        suggested_tools: [
          {
            name: 'task_update',
            args_template: {
              scene: sceneId,
              spec: specId,
              task_id: task.id,
              status: 'in_progress',
            },
            reason: '开始工作时调用',
          },
          {
            name: 'summarize_save',
            args_template: {
              uri: `context://spec/${sceneId}/${specId}/tasks`,
              l0: '<任务清单一句话摘要>',
              l1: '<任务拆分、状态和依赖概览>',
            },
            reason: 'Task 变更后更新 tasks.md 摘要',
          },
        ],
      },
    }, hookResult.warnings);
  }

  /**
   * 更新 Task 状态。
   *
   * 状态机校验：非法转换抛 INVALID_STATUS_TRANSITION，文件不修改。
   */
  async update(input: UpdateTaskInput): Promise<AiFollowupResponse<Task>> {
    const sceneId = await this.sceneManager.resolveId(input.scene);
    const specId = await this.specManager.resolveId(sceneId, input.spec);
    const tasksPath = this.tasksPath(sceneId, specId);

    const { updatedTask, parentReadyId, previousStatus } = await this.withTasksFileLock(sceneId, specId, async () => {
      const content = await this.fs.read(tasksPath);
      const tasks = parseTasksFromMarkdown(content, sceneId, specId);
      const task = tasks.find((t) => t.id === input.task_id);
      if (!task) {
        throw new LrnevError(
          ErrorCode.TASK_NOT_FOUND,
          `Task "${input.task_id}" 不存在`,
          { field: 'task_id' },
        );
      }

      if (!isValidTransition(task.status, input.status)) {
        throw new LrnevError(
          ErrorCode.INVALID_STATUS_TRANSITION,
          `非法状态转换：${task.status} → ${input.status}`,
          {
            field: 'status',
            hint: statusTransitionHint(task.status),
          },
        );
      }

      const now = new Date().toISOString();
      const updatedTask: Task = {
        ...task,
        status: input.status,
        updated: now,
        history: [
          ...(task.history ?? []),
          {
            from: task.status,
            to: input.status,
            at: now,
            ...(input.reason !== undefined && { reason: input.reason }),
          },
        ],
      };

      const updatedContent = updateTaskInMarkdown(content, updatedTask);
      await this.fs.write(tasksPath, updatedContent);

      const tasksAfter = tasks.map((t) => (t.id === updatedTask.id ? updatedTask : t));
      return {
        updatedTask,
        previousStatus: task.status,
        parentReadyId: findCompletedParentReadyForClose(updatedTask, tasksAfter),
      };
    });
    const specStatus = await this.readSpecStatus(sceneId, specId);
    const claimResult = await this.updateClaimForTask(input, sceneId, specId);
    const hookResult = await getHookManager(this.fs.root).trigger(`task.update.${input.status}`, {
      scene: sceneId,
      spec: specId,
      task_id: updatedTask.id,
      title: updatedTask.title,
      from: previousStatus,
      to: input.status,
      reason: input.reason,
    });

    return appendHookWarnings({
      ok: true,
      data: updatedTask,
      ai_followup: buildFollowupAfterUpdate(updatedTask, input.status, specStatus, parentReadyId, claimResult),
    }, hookResult.warnings);
  }

  async claim(input: ClaimTaskInput): Promise<AiFollowupResponse<TaskClaimResult>> {
    const sceneId = await this.sceneManager.resolveId(input.scene);
    const specId = await this.specManager.resolveId(sceneId, input.spec);
    await this.get(sceneId, specId, input.task);
    const claims = this.newClaimStore();
    const result = await claims.claim({
      ...input,
      scene: sceneId,
      spec: specId,
    });
    const hasParallelContext = await hasParallelClaimContext(claims, result);
    return {
      ok: true,
      data: result,
      ai_followup: buildClaimResponseFollowup(result, hasParallelContext),
    };
  }

  async releaseClaim(input: ReleaseTaskClaimInput): Promise<AiFollowupResponse<TaskClaimReleaseResult>> {
    const sceneId = await this.sceneManager.resolveId(input.scene);
    const specId = await this.specManager.resolveId(sceneId, input.spec);
    await this.get(sceneId, specId, input.task);
    const result = await new ClaimStore(this.fs).release({
      ...input,
      scene: sceneId,
      spec: specId,
    });
    return {
      ok: true,
      data: result,
      ai_followup: buildReleaseClaimResponseFollowup(result),
    };
  }

  /** Tasks.md 相对路径 */
  private tasksPath(sceneId: string, specId: string): string {
    return `.lrnev/scenes/${sceneId}/specs/${specId}/tasks.md`;
  }

  /** 构造带"属主死活"感知的 ClaimStore;属主已死的 claim 视为可接手。 */
  private newClaimStore(): ClaimStore {
    const registry = new AgentRegistry(this.fs);
    return new ClaimStore(this.fs, (agentId) => registry.isAgentDead(agentId));
  }

  private async withTasksFileLock<T>(sceneId: string, specId: string, fn: () => Promise<T>): Promise<T> {
    // 边界：lrnev 只记录父子任务并串行化 tasks.md 写入；
    // 不执行客户端工作，也不裁决源码文件冲突。
    return this.fs.withDirectoryLock(
      `.lrnev/locks/tasks-${safeId(sceneId)}-${safeId(specId)}.lockdir`,
      fn,
    );
  }

  private async readSpecStatus(sceneId: string, specId: string): Promise<SpecStatus | undefined> {
    try {
      return (await this.specManager.get(sceneId, specId)).status;
    } catch {
      return undefined;
    }
  }

  private async updateClaimForTask(
    input: UpdateTaskInput,
    sceneId: string,
    specId: string,
  ): Promise<TaskUpdateClaimResult | undefined> {
    if (!input.agent_id) return undefined;
    // touches_files 由调用方声明；这里不读源码做冲突裁决，避免治理工具越界成代码执行器。
    const claims = this.newClaimStore();
    if (input.status === 'in_progress') {
      const result = await claims.claim({
        scene: sceneId,
        spec: specId,
        task: input.task_id,
        agent_id: input.agent_id,
        ttl_seconds: input.claim_ttl_seconds,
        touches_files: input.touches_files,
      });
      return {
        kind: 'claim',
        result,
        hasParallelContext: await hasParallelClaimContext(claims, result),
      };
    }
    if (input.status === 'completed' || input.status === 'failed') {
      return {
        kind: 'release',
        result: await claims.release({
          scene: sceneId,
          spec: specId,
          task: input.task_id,
          agent_id: input.agent_id,
        }),
      };
    }
    return undefined;
  }
}

type TaskUpdateClaimResult =
  | { kind: 'claim'; result: TaskClaimResult; hasParallelContext?: boolean }
  | { kind: 'release'; result: TaskClaimReleaseResult };

/* ============== 纯函数工具（可独立测试） ============== */

/** 格式化 Task ID：1 → "T-001" */
/**
 * 返回 ids 中不在 pool 内的项，用于引用存在性硬校验。
 * depends_on（task id 池）与 S6 的 validates F-xx/D-xx（文档锚点池）复用此谓词，口径一致。
 */
export function findMissingReferences(ids: string[], pool: Set<string>): string[] {
  return ids.filter((id) => !pool.has(id));
}

export function formatTaskId(n: number): string {
  return `T-${String(n).padStart(3, '0')}`;
}

/** 解析 "T-007" → 7 */
function parseTaskNumber(id: string): number {
  const m = /^T-(\d+)$/.exec(id);
  return m ? parseInt(m[1]!, 10) : 0;
}

/** 计算下一个 Task 序号（max + 1） */
export function computeNextTaskNumber(existing: Task[]): number {
  let max = 0;
  for (const t of existing) {
    const n = parseTaskNumber(t.id);
    if (n > max) max = n;
  }
  return max + 1;
}

/** Task 的人读投影视图，刻意不暴露 history、children、时间戳或存储 meta。 */
export function toReadableTask(task: Task): ReadableTask {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    acceptance: [...(task.acceptance ?? [])],
    ...(task.parent && { parent: task.parent }),
    validates: [...(task.validates ?? [])],
  };
}

/**
 * 把 task 追加到 tasks.md 内容里。
 *
 * 策略：
 *   - 若已有 ## 章节，追加到最后一个 ## 章节末尾
 *   - 若无 ##，则在文件末尾建一个 "## 任务" 章节再追加
 */
export function appendTaskToMarkdown(content: string, task: Task): string {
  const block = renderTaskBlock(task);
  const trimmed = content.replace(/\s+$/, '');

  if (/^##\s+/m.test(trimmed)) {
    return trimmed + '\n\n' + block + '\n';
  }
  return trimmed + '\n\n## 任务\n\n' + block + '\n';
}

/** 把子任务插到父任务块末尾。 */
export function insertChildTaskToMarkdown(content: string, parentId: string, task: Task): string {
  const lines = content.split('\n');
  const tail = findParentBlockTail(lines, parentId);
  if (tail === null) {
    throw new LrnevError(
      ErrorCode.TASK_NOT_FOUND,
      `父 Task "${parentId}" 不存在`,
      { field: 'parent' },
    );
  }

  const block = renderTaskBlock(task).split('\n');
  const newLines = [
    ...lines.slice(0, tail),
    '',
    ...block,
    '',
    ...lines.slice(tail),
  ];
  return normalizeMarkdownEnd(normalizeBlankLines(newLines.join('\n')));
}

/**
 * 把 Task 序列化为 Markdown 块。
 *
 * 形态：
 *   ### T-001 标题 <!-- lrnev-task: status=pending, created=..., ... -->
 *   描述
 *
 *   - **验收**：...
 */
export function renderTaskBlock(task: Task): string {
  const meta = encodeTaskMeta(task);
  const lines: string[] = [];
  lines.push(`### ${task.id} ${task.title} <!-- lrnev-task: ${meta} -->`);
  if (task.history && task.history.length > 0) {
    lines.push(`<!-- lrnev-task-history: ${JSON.stringify(task.history)} -->`);
  }
  if (task.description && task.description.trim().length > 0) {
    lines.push('');
    lines.push(task.description.trim());
  }
  if (task.acceptance && task.acceptance.length > 0) {
    lines.push('');
    lines.push('**验收**：');
    for (const a of task.acceptance) {
      lines.push(`- ${a}`);
    }
  }
  if (task.depends_on && task.depends_on.length > 0) {
    lines.push('');
    lines.push(`**依赖**：${task.depends_on.join(', ')}`);
  }
  return lines.join('\n');
}

/**
 * 用更新后的 task 替换 tasks.md 中对应块。
 *
 * 实现：先按 Task ID 找到原标题行 + 下一块边界，替换整段。
 */
export function updateTaskInMarkdown(content: string, task: Task): string {
  const lines = content.split('\n');
  const range = findTaskBlockRange(lines, task.id);
  if (!range) {
    // 不存在则追加
    return appendTaskToMarkdown(content, task);
  }
  const block = renderTaskBlock(task).split('\n');
  const newLines = [...lines.slice(0, range.start), ...block, '', ...lines.slice(range.end)];
  // 清理连续空行
  return normalizeMarkdownEnd(normalizeBlankLines(newLines.join('\n')));
}

/** 压缩连续空行（最多保留 2 个换行） */
function normalizeBlankLines(s: string): string {
  return s.replace(/\n{3,}/g, '\n\n');
}

function normalizeMarkdownEnd(s: string): string {
  return s.replace(/\s+$/, '') + '\n';
}

function findTaskBlockRange(lines: string[], taskId: string): { start: number; end: number } | null {
  const start = lines.findIndex((line) => {
    const m = TASK_HEADING_REGEX.exec(line);
    return m !== null && m[1] === taskId;
  });
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (TASK_HEADING_LINE_RE.test(lines[i]!)) {
      end = i;
      break;
    }
  }
  return { start, end };
}

function findParentBlockTail(lines: string[], parentId: string): number | null {
  const own = findTaskBlockRange(lines, parentId);
  if (!own) return null;

  // 追加到已有同父子任务之后，保证 tasks.md 顺序和 children 投影视图顺序一致。
  let tail = own.end;
  while (tail < lines.length) {
    const next = findNextTaskBlock(lines, tail);
    if (!next || next.meta.parent !== parentId) break;
    tail = next.range.end;
  }
  return tail;
}

function findNextTaskBlock(
  lines: string[],
  from: number,
): { range: { start: number; end: number }; meta: Record<string, string> } | null {
  for (let i = from; i < lines.length; i++) {
    const match = TASK_HEADING_REGEX.exec(lines[i]!);
    if (!match) continue;
    const id = match[1]!;
    const range = findTaskBlockRange(lines, id);
    if (!range) return null;
    return {
      range,
      meta: decodeTaskMeta(match[3]!),
    };
  }
  return null;
}

/**
 * 把 Task 元数据编码为注释字符串。
 *
 * 形式：status=pending, created=2026-05-28T01:00:00Z, updated=...
 *
 * 简单 KV 拼接（不嵌套），便于人类阅读。
 */
function encodeTaskMeta(task: Task): string {
  const parts: string[] = [`status=${task.status}`, `created=${task.created}`];
  if (task.updated) parts.push(`updated=${task.updated}`);
  if (task.depends_on && task.depends_on.length > 0) {
    parts.push(`depends_on=${task.depends_on.join('|')}`);
  }
  if (task.parent) {
    parts.push(`parent=${task.parent}`);
  }
  if (task.validates && task.validates.length > 0) {
    parts.push(`validates=${task.validates.join('|')}`);
  }
  return parts.join(', ');
}

/** 解析注释字符串 → KV 字典 */
function decodeTaskMeta(meta: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of meta.split(',')) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const k = trimmed.slice(0, eq).trim();
    const v = trimmed.slice(eq + 1).trim();
    result[k] = v;
  }
  return result;
}

/**
 * 从完整 tasks.md 文本里解析所有 Task。
 *
 * 算法：
 *   1. 按行扫描
 *   2. 遇到 "### T-XXX ... <!-- lrnev-task: ... -->" 开始新 Task
 *   3. 收集到下一个 Task 标题或文件末尾之前的所有行作为块内容
 *   4. 从块内容里提取 description / acceptance / depends_on
 */
export function parseTasksFromMarkdown(
  content: string,
  sceneId: string,
  specId: string,
): Task[] {
  const lines = content.split('\n');
  const tasks: Task[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const m = TASK_HEADING_REGEX.exec(line);
    if (!m) {
      i++;
      continue;
    }
    const id = m[1]!;
    const title = m[2]!.trim();
    const metaRaw = m[3]!;
    const meta = decodeTaskMeta(metaRaw);

    // 收集块内容到下一个 Task 标题；首行可能是 history 注释
    const blockLines: string[] = [];
    let history: Task['history'] | undefined;
    i++;
    while (i < lines.length) {
      const next = lines[i]!;
      if (TASK_HEADING_LINE_RE.test(next)) break;
      // history 注释只识别紧跟在标题后的行（不含中间空行干扰，trim 后判断）
      const hMatch = HISTORY_LINE_REGEX.exec(next.trim());
      if (hMatch && history === undefined && blockLines.every((l) => l.trim() === '')) {
        try {
          history = JSON.parse(hMatch[1]!) as Task['history'];
        } catch {
          // 损坏的 history JSON：丢弃，不阻断解析
        }
      } else {
        blockLines.push(next);
      }
      i++;
    }

    const block = blockLines.join('\n').trim();
    const { description, acceptance, depends_on } = parseTaskBlockContent(block);

    const status = (meta.status as TaskStatus) || 'pending';
    const created = meta.created || new Date().toISOString();
    const updated = meta.updated;
    const deps = meta.depends_on
      ? meta.depends_on.split('|').map((s) => s.trim()).filter(Boolean)
      : depends_on;
    const validates = meta.validates
      ? meta.validates.split('|').map((s) => s.trim()).filter(Boolean)
      : [];

    tasks.push({
      id,
      scene: sceneId,
      spec: specId,
      title,
      description,
      status,
      acceptance,
      depends_on: deps,
      ...(meta.parent && { parent: meta.parent }),
      ...(validates.length > 0 && { validates }),
      created,
      ...(updated && { updated }),
      ...(history && history.length > 0 && { history }),
    });
  }
  return tasks;
}

/** 解析 Task 块内容（描述 / 验收 / 依赖） */
function parseTaskBlockContent(block: string): {
  description: string;
  acceptance: string[];
  depends_on: string[];
} {
  const acceptance: string[] = [];
  const depends_on: string[] = [];
  const descLines: string[] = [];
  let mode: 'desc' | 'acceptance' = 'desc';

  for (const rawLine of block.split('\n')) {
    const line = rawLine;
    if (/\*\*验收\*\*/.test(line)) {
      mode = 'acceptance';
      // 同行可能有冒号后跟首项（"**验收**："）跳过
      continue;
    }
    if (/^\*\*依赖\*\*[：:]\s*/.test(line.trim())) {
      const after = line.replace(/^\s*\*\*依赖\*\*[：:]\s*/, '');
      depends_on.push(...after.split(/[,，]/).map((s) => s.trim()).filter(Boolean));
      mode = 'desc';
      continue;
    }
    if (mode === 'acceptance') {
      const m = /^\s*-\s+(.*)$/.exec(line);
      if (m) {
        acceptance.push(m[1]!.trim());
      } else if (line.trim() === '') {
        // 空行不切换模式
      } else {
        // 验收段结束
        descLines.push(line);
        mode = 'desc';
      }
    } else {
      descLines.push(line);
    }
  }
  return {
    description: descLines.join('\n').trim(),
    acceptance,
    depends_on,
  };
}

export function attachTaskChildren(tasks: Task[]): Task[] {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  for (const task of tasks) {
    delete task.children;
  }
  for (const task of tasks) {
    if (!task.parent) continue;
    const parent = byId.get(task.parent);
    if (!parent) continue;
    parent.children = [...(parent.children ?? []), task];
  }
  return tasks;
}

function findCompletedParentReadyForClose(task: Task, tasks: Task[]): string | undefined {
  if (task.status !== 'completed' || !task.parent) return undefined;
  const siblings = tasks.filter((candidate) => candidate.parent === task.parent);
  if (siblings.length === 0) return undefined;
  return siblings.every((candidate) => candidate.status === 'completed') ? task.parent : undefined;
}

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '_');
}

function statusTransitionHint(status: TaskStatus): string {
  const allowed = VALID_TASK_TRANSITIONS[status];
  if (allowed.length === 0) {
    return `${status} 是终态，不能继续改状态；如需返工，请调用 task_create 新建后续修复任务。`;
  }
  return `当前状态 ${status} 只允许转换到：${allowed.join('、')}；请用 task_update 选择其中一个状态。completed 是终态，返工请新建 task。`;
}

/** 状态变更后给 AI 的后续建议 */
function buildFollowupAfterUpdate(
  task: Task,
  newStatus: TaskStatus,
  specStatus?: SpecStatus,
  parentReadyId?: string,
  claimResult?: TaskUpdateClaimResult,
): AiFollowupResponse<Task>['ai_followup'] {
  if (newStatus === 'in_progress') {
    const reviewInstruction = task.validates && task.validates.length > 0
      ? `先读 requirements/design 中与 ${task.validates.join('、')} 对应的段落`
      : '先回看本 Spec 的 requirements 目标与验收标准';
    const instructions = [
      `Task "${task.id}" 已进入 in_progress。${reviewInstruction}，确认验收口径后再动手。`,
      '可把 spec.status 改为 in-progress；gate 检查不依赖 status。',
      '这个任务可考虑按文件不相交的边界拆成子任务并行；并行方式由客户端或用户决定，可用 task_create(parent=本任务) 记录。',
      '并行前请确认各子任务改的源码文件不重叠；lrnev 只锁 tasks.md，不能锁源码文件或裁决源码冲突。',
    ];
    if (specStatus === 'completed') {
      instructions.push('当前 spec.status 是 completed；回退到 in-progress 表示有未完成工作，请检查剩余任务。');
    }
    appendClaimFollowup(instructions, claimResult);
    return {
      instructions,
    };
  }
  if (newStatus === 'completed') {
    const instructions = [
      `Task "${task.id}" 已完成`,
      '若该 Spec 的所有 Task 都完成，可调 spec_gate_check(gate=completion) 验收',
    ];
    if (parentReadyId) {
      instructions.push(`父任务 "${parentReadyId}" 的所有子任务已 completed；请检查父任务自身验收，确认后可标为 completed。`);
    }
    appendClaimFollowup(instructions, claimResult);
    return {
      instructions,
      suggested_tools: [
        {
          name: 'spec_gate_check',
          args_template: { scene: task.scene, spec: task.spec, gate: 'completion' },
          reason: '所有 Task 都完成时校验 Spec 完成',
        },
        {
          name: 'summarize_save',
          args_template: {
            uri: `context://spec/${task.scene}/${task.spec}/tasks`,
            l0: '<任务完成状态一句话摘要>',
            l1: '<已完成任务、剩余风险和验收状态概览>',
          },
          reason: 'Task 状态变更后更新 tasks.md 摘要',
        },
      ],
    };
  }
  if (newStatus === 'failed') {
    const instructions = [
      `Task "${task.id}" 标记 failed`,
      '建议调 error_record 把失败原因记录到 errorbook',
      '修复后可调 task_update 把状态改回 pending 重试',
    ];
    appendClaimFollowup(instructions, claimResult);
    return {
      instructions,
      suggested_tools: [
        {
          name: 'error_record',
          args_template: {
            symptom: '<失败现象>',
            root_cause: '<根因>',
            fix_action: '<拟定修复>',
            scope: 'global',
          },
          reason: '把失败沉淀为知识，避免重复踩坑',
        },
      ],
    };
  }
  if (newStatus === 'blocked') {
    return {
      instructions: [
        `Task "${task.id}" 被阻塞，请说明阻塞原因`,
        '解除阻塞后调 task_update 切回 pending 或 in_progress',
      ],
    };
  }
  return { instructions: [`Task "${task.id}" 状态已更新为 ${newStatus}`] };
}

function buildClaimResponseFollowup(
  result: TaskClaimResult,
  hasParallelContext?: boolean,
): AiFollowupResponse<TaskClaimResult>['ai_followup'] {
  const instructions: string[] = [];
  appendClaimFollowup(instructions, { kind: 'claim', result, hasParallelContext });
  instructions.push('claim 是运行态软占用，不改 tasks.md；agent 进程退出时会自动释放,无需定时心跳维持。');
  return {
    instructions,
    suggested_tools: [
      {
        name: 'project_status',
        args_template: { scene: result.claim.scene },
        reason: '查看当前 active_agents、active_claims 与可领取任务',
      },
    ],
  };
}

function buildReleaseClaimResponseFollowup(
  result: TaskClaimReleaseResult,
): AiFollowupResponse<TaskClaimReleaseResult>['ai_followup'] {
  const instructions: string[] = [];
  appendClaimFollowup(instructions, { kind: 'release', result });
  return { instructions };
}

function appendClaimFollowup(
  instructions: string[],
  claimResult: TaskUpdateClaimResult | undefined,
): void {
  if (!claimResult) return;
  if (claimResult.kind === 'claim') {
    if (claimResult.result.claimed) {
      instructions.push(`已登记 task claim：${claimResult.result.claim.task} 由 ${claimResult.result.claim.claimed_by} 处理。`);
    }
    if (claimResult.result.conflict) {
      instructions.push(
        `该 Task 已有活跃 claim：${claimResult.result.conflict.claimed_by} 正在处理。lrnev 不阻止继续，但请先确认是否需要错开工作。`,
      );
    }
    for (const overlap of claimResult.result.overlaps ?? []) {
      instructions.push(
        `touches_files 重叠警告：${overlap.claimed_by} 的 ${overlap.scene}/${overlap.spec}/${overlap.task} 也声明修改 ${overlap.touches_files.join('、')}；lrnev 不阻止，请确认是否错开。`,
      );
    }
    if (claimResult.hasParallelContext && !hasDeclaredTouchesFiles(claimResult.result.claim)) {
      instructions.push('多窗口并行时，可在 task_claim / task_update 传 touches_files 声明本任务预计修改的文件，便于 lrnev 给出重叠提示；这不是源码锁，也不会强制阻止。');
    }
    return;
  }
  if (claimResult.result.released) {
    instructions.push(`已释放 task claim：${claimResult.result.task}。`);
  } else {
    instructions.push(`未释放 task claim：${claimResult.result.task} 可能不存在，或不属于当前 agent_id。`);
  }
}

async function hasParallelClaimContext(claims: ClaimStore, result: TaskClaimResult): Promise<boolean> {
  if (result.conflict) return true;
  try {
    const active = await claims.listActive();
    const agents = new Set(active.map((claim) => claim.claimed_by));
    return active.length > 1 || agents.size > 1;
  } catch {
    // 运行态 claim 只服务提示；读取失败不能阻断任务流转。
    return false;
  }
}

function hasDeclaredTouchesFiles(claim: TaskClaimResult['claim']): boolean {
  return (claim.touches_files?.length ?? 0) > 0;
}

// 兼容 import：未使用但保留可观测
void META_REGEX;
