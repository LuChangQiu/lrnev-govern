import type { LegacyTodoReplacement } from './legacy-todo.js';

export type DiagnosticSeverity = 'error' | 'warning' | 'info';

export interface DiagnosticIssue {
  code: string;
  severity: DiagnosticSeverity;
  message: string;
  path?: string;
  suggestion?: string;
}

export interface DiagnosticReport {
  ok: boolean;
  checked_at: string;
  summary: {
    errors: number;
    warnings: number;
    info: number;
  };
  issues: DiagnosticIssue[];
}

export interface TodoMigrationReport {
  ok: true;
  migrated_at: string;
  scanned_files: number;
  changed_files: number;
  replacements: number;
  files: Array<{
    path: string;
    replacements: LegacyTodoReplacement[];
  }>;
}

export interface SummaryMigrationReport {
  ok: true;
  migrated_at: string;
  removed_count: number;
  removed: string[];
}

/** S5(I-12): 显式 dead-agent GC 的执行报告。 */
export interface AgentGcReport {
  ok: true;
  gc_at: string;
  removed: string[];
  /** 随被删 agent 一并清掉的其名下已过期 claim 数（未过期 claim 的属主不会被删）。 */
  released_expired_claims: number;
  kept_active: number;
  kept_dead_with_claims: number;
}
