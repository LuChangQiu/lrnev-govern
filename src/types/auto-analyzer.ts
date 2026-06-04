export interface CodebaseInfo {
  schema_version: 1;
  generated_at: string;
  analyzer: 'AutoAnalyzer';
  project_root: string;
  tech_stack: TechStackItem[];
  primary_language: string;
  package_managers: string[];
  dependencies: Record<string, string[]>;
  directories: DirectoryInfo[];
  /** 根级文件清单（不限白名单，给 AI 当"地图"用，如 pom.xml/build.gradle）。 */
  root_files: string[];
  sample_files: string[];
  notes: string[];
}

export interface TechStackItem {
  ecosystem: 'node' | 'python' | 'rust' | 'go';
  language: string;
  manifest: string;
  name?: string;
  version?: string;
}

export interface DirectoryInfo {
  path: string;
  kind: 'source' | 'test' | 'docs' | 'config' | 'build' | 'other';
}
