export type HookEvent =
  | 'spec.create'
  | 'spec.gate_passed.ready'
  | 'spec.gate_passed.completion'
  | 'task.create'
  | 'task.update.pending'
  | 'task.update.in_progress'
  | 'task.update.completed'
  | 'task.update.failed'
  | 'task.update.blocked'
  | 'adr.create'
  | 'error.record';

export type HookMode = 'sync' | 'async';
export type HookFailurePolicy = 'abort' | 'warn' | 'silent';
/**
 * Hook 执行状态（ADR-0003「Hook Drain 边界与超时策略」accepted 2026-08-28）：
 * - invoked    — async hook 已触发、记录先写（drain 超时时用户仍能看到"被触发但未完成"）
 * - success    — 子进程退出码 0
 * - failed     — 子进程非零退出或 spawn 失败
 * - timeout    — hook 自身超时被 kill（runProcess 内 timeout_ms 控制）
 * - timed_out  — 进程退出 drain 等待超时，hook 可能仍在运行（区别于 failed）
 */
export type HookStatus = 'success' | 'failed' | 'timeout' | 'invoked' | 'timed_out';

export interface HookConfig {
  name: string;
  event: HookEvent | `${string}*` | string;
  command: string | string[];
  timeout_ms: number;
  mode: HookMode;
  enabled: boolean;
  env: Record<string, string>;
  cwd?: string;
  on_failure: HookFailurePolicy;
}

export interface HookConfigIssue {
  index?: number;
  name?: string;
  code: 'HOOK_CONFIG_INVALID';
  message: string;
  path: string;
}

export interface HookRecord {
  ts: string;
  event: string;
  hook: string;
  mode: HookMode;
  status: HookStatus;
  duration_ms: number;
  /** invoked/timed_out 记录可能无进程退出码。 */
  exit_code?: number;
  stdout_tail?: string;
  stderr_tail?: string;
}

export interface HookWarning {
  hook: string;
  status: HookStatus;
  message: string;
}

export interface HookListResult {
  implemented: true;
  hooks: HookConfig[];
  recent: HookRecord[];
  config_path: string;
  issues: HookConfigIssue[];
}

export interface TriggerHookResult {
  event: string;
  matched: number;
  warnings: string[];
}
