/**
 * Task 类型定义
 *
 * Task 是 Spec 内的最小工作单位，全部存储在 tasks.md 中。
 *
 * 状态机：
 *   pending → in_progress → completed
 *           → blocked       → failed → pending（可重试）
 */

/** Task 状态枚举 */
export const TaskStatus = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  BLOCKED: 'blocked',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

/**
 * Task 状态机合法转换表。
 *
 * key 为当前状态，value 为允许转换到的状态列表。
 * completed 是终态，failed 可重试（→ pending）。
 */
export const VALID_TASK_TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  pending: ['in_progress', 'blocked'],
  in_progress: ['completed', 'failed', 'blocked'],
  blocked: ['pending', 'in_progress'],
  completed: [],
  failed: ['pending'],
} as const;

/** Task 对象 */
export interface Task {
  /** 任务 ID（在 Spec 内唯一），例如 "T-001" */
  id: string;

  /** 所属 Spec ID */
  spec: string;

  /** 所属 Scene ID */
  scene: string;

  /** 任务标题 */
  title: string;

  /** 任务描述（可含 markdown） */
  description?: string;

  /** 当前状态 */
  status: TaskStatus;

  /** 验收标准列表 */
  acceptance?: string[];

  /** 依赖的其他 Task ID 列表 */
  depends_on?: string[];

  /** Parent Task ID. lrnev records hierarchy only; clients orchestrate execution. */
  parent?: string;

  /** 对应的需求/设计锚点，例如 F-01 或 design#3.2 */
  validates?: string[];

  /** Direct children for hierarchy-aware output; flat task lists remain intact. */
  children?: Task[];

  /** 创建时间 */
  created: string;

  /** 最后更新时间 */
  updated?: string;

  /** 状态变更历史 */
  history?: TaskStatusChange[];
}

/** Task 的人读投影视图，不暴露治理 meta/history/时间戳等存储细节。 */
export interface ReadableTask {
  id: string;
  title: string;
  status: TaskStatus;
  acceptance: string[];
  parent?: string;
  validates: string[];
}

/** 状态变更记录 */
export interface TaskStatusChange {
  from: TaskStatus;
  to: TaskStatus;
  at: string;
  reason?: string;
}

/** 创建 Task 的输入 */
export interface CreateTaskInput {
  scene: string;
  spec: string;
  title: string;
  description?: string;
  acceptance?: string[];
  depends_on?: string[];
  parent?: string;
  validates?: string[];
}

/** 更新 Task 状态的输入 */
export interface UpdateTaskInput {
  scene: string;
  spec: string;
  task_id: string;
  status: TaskStatus;
  reason?: string;
  agent_id?: string;
  claim_ttl_seconds?: number;
  touches_files?: string[];
}

export type TaskListView = 'raw' | 'readable';

/**
 * 检查状态转换是否合法
 *
 * @param from 当前状态
 * @param to 目标状态
 * @returns 是否允许转换
 */
export function isValidTransition(from: TaskStatus, to: TaskStatus): boolean {
  return VALID_TASK_TRANSITIONS[from].includes(to);
}
