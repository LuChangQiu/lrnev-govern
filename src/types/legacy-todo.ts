export interface LegacyTodoPlaceholder {
  line: number;
  text: string;
}

export interface LegacyTodoReplacement extends LegacyTodoPlaceholder {
  replacement: string;
}

export interface LegacyTodoMigrationResult {
  content: string;
  replacements: LegacyTodoReplacement[];
}
