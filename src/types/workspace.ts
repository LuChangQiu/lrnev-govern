export interface InitWorkspaceInput {
  /** 可选：显式指定工作区根；不传则按 WorkspaceLocator 规则定位。 */
  root?: string;
  /** 可选：项目名；不传则使用目录名。 */
  project_name?: string;
  /** M2 占位 flag，当前 no-op；默认 init 保持被动。 */
  scan?: boolean;
  /**
   * 可选（ADR 0003，2026-09）：在项目根生成指针式 AGENTS.md（引用 .lrnev/steering）。
   * CLI 交互询问得到 y 或显式 --with-agents-md 时置 true；已存在则跳过不覆盖。
   */
  with_agents_md?: boolean;
}

export interface InitWorkspaceResult {
  root: string;
  was_new: boolean;
  files_created: string[];
  files_existing: string[];
  directories_ensured: string[];
  codebase_detected: boolean;
  /** ADR 0003：AGENTS.md 生成结果（created / skipped-existing / not-requested）。 */
  agents_md?: 'created' | 'skipped-existing';
}
