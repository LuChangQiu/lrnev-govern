export type HookEvent =
  | 'spec.create'
  | 'spec.gate_passed.ready'
  | 'spec.gate_passed.completion'
  | 'task.create'
  | 'task.update.in_progress'
  | 'task.update.completed'
  | 'task.update.failed'
  | 'task.update.blocked'
  | 'adr.create'
  | 'error.record';

export type HookMode = 'sync' | 'async';
export type HookFailurePolicy = 'abort' | 'warn' | 'silent';
export type HookStatus = 'success' | 'failed' | 'timeout';

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
  exit_code: number;
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
