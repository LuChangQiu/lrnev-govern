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
