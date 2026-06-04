export interface InitWorkspaceInput {
  /** 可选：显式指定工作区根；不传则按 WorkspaceLocator 规则定位。 */
  root?: string;
  /** 可选：项目名；不传则使用目录名。 */
  project_name?: string;
  /** M2 占位 flag，当前 no-op；默认 init 保持被动。 */
  scan?: boolean;
}

export interface InitWorkspaceResult {
  root: string;
  was_new: boolean;
  files_created: string[];
  files_existing: string[];
  directories_ensured: string[];
  codebase_detected: boolean;
}
