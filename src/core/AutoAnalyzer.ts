/**
 * AutoAnalyzer —— 代码库轻量自动分析。
 *
 * M1 不调用任何 LLM / embedding，只基于仓库文件做确定性探测：
 * package.json / pyproject.toml / Cargo.toml / go.mod、依赖、主语言、
 * 顶层目录结构和少量源码样本路径。
 */

import { FileStorage } from '../storage/FileStorage.js';
import { loadConfig } from '../shared/config.js';
import type { AiFollowupResponse } from '../types/response.js';
import type { CodebaseInfo, DirectoryInfo, TechStackItem } from '../types/auto-analyzer.js';

const MANIFEST_FILES = ['package.json', 'pyproject.toml', 'Cargo.toml', 'go.mod'] as const;
const SOURCE_FILE_PATTERNS = [
  'src/**/*.{ts,tsx,js,jsx,py,rs,go}',
  'lib/**/*.{ts,tsx,js,jsx,py,rs,go}',
  'app/**/*.{ts,tsx,js,jsx,py,rs,go}',
  'crates/**/*.rs',
  'tests/**/*.{ts,tsx,js,jsx,py,rs,go}',
];
const KNOWN_DIRECTORY_NAMES = ['src', 'lib', 'app', 'crates', 'tests', 'test', 'docs', 'bin', 'scripts'];

export class AutoAnalyzer {
  constructor(private readonly fs: FileStorage) {}

  async analyze(): Promise<AiFollowupResponse<CodebaseInfo>> {
    const techStack: TechStackItem[] = [];
    const dependencies: Record<string, string[]> = {};
    const packageManagers: string[] = [];

    const manifests = await this.findManifestFiles();
    for (const manifest of manifests) {
      const dir = dirnameRel(manifest);
      switch (basenameRel(manifest)) {
        case 'package.json': {
          const pkg = await this.fs.readJson<Record<string, unknown>>(manifest);
          techStack.push({
            ecosystem: 'node',
            language: detectNodeLanguage(this.fs, dir),
            manifest,
            ...(typeof pkg.name === 'string' && { name: pkg.name }),
            ...(typeof pkg.version === 'string' && { version: pkg.version }),
          });
          mergeDeps(dependencies, 'node', collectPackageJsonDeps(pkg));
          if (this.fs.exists(joinRel(dir, 'package-lock.json'))) packageManagers.push('npm');
          if (this.fs.exists(joinRel(dir, 'pnpm-lock.yaml'))) packageManagers.push('pnpm');
          if (this.fs.exists(joinRel(dir, 'yarn.lock'))) packageManagers.push('yarn');
          break;
        }
        case 'pyproject.toml': {
          const pyproject = await this.fs.read(manifest);
          techStack.push({
            ecosystem: 'python',
            language: 'python',
            manifest,
            ...extractTomlNameVersion(pyproject),
          });
          mergeDeps(dependencies, 'python', collectPyprojectDeps(pyproject));
          if (this.fs.exists(joinRel(dir, 'uv.lock'))) packageManagers.push('uv');
          if (this.fs.exists(joinRel(dir, 'poetry.lock'))) packageManagers.push('poetry');
          break;
        }
        case 'Cargo.toml': {
          const cargo = await this.fs.read(manifest);
          techStack.push({
            ecosystem: 'rust',
            language: 'rust',
            manifest,
            ...extractTomlNameVersion(cargo),
          });
          mergeDeps(dependencies, 'rust', collectCargoDeps(cargo));
          if (this.fs.exists(joinRel(dir, 'Cargo.lock'))) packageManagers.push('cargo');
          break;
        }
        case 'go.mod': {
          const goMod = await this.fs.read(manifest);
          techStack.push({
            ecosystem: 'go',
            language: 'go',
            manifest,
            name: extractGoModuleName(goMod),
          });
          mergeDeps(dependencies, 'go', collectGoDeps(goMod));
          packageManagers.push('go');
          break;
        }
      }
    }

    const manifestDirs = [...new Set(manifests.map(dirnameRel))];
    const directories = await this.scanDirectories(manifestDirs);
    const rootFiles = await this.scanRootFiles();
    const sampleFiles = await this.sampleSourceFiles(manifestDirs);
    const primaryLanguage = techStack[0]?.language ?? inferLanguageFromSamples(sampleFiles);

    const info: CodebaseInfo = {
      schema_version: 1,
      generated_at: new Date().toISOString(),
      analyzer: 'AutoAnalyzer',
      project_root: this.fs.root,
      tech_stack: techStack,
      primary_language: primaryLanguage,
      package_managers: [...new Set(packageManagers)],
      dependencies,
      directories,
      root_files: rootFiles,
      sample_files: sampleFiles,
      notes: [
        '该分析不调用 LLM / embedding，只做确定性文件探测。',
        '请 AI 抽样阅读 sample_files 后补充 coding_style / architecture_notes 字段。',
        ...(techStack.length === 0 && (directories.length > 0 || rootFiles.length > 0)
          ? ['未确定性识别技术栈（非 JS/Py/Rust/Go 生态，属预期，不是探测失败）。请按 root_files 列出的构建文件（如 pom.xml/build.gradle）由 AI 识别技术栈与架构，写入 ARCHITECTURE.md / PROJECT.md。']
          : []),
      ],
    };

    await this.fs.writeJson('.lrnev/auto/codebase.json', info);

    return {
      ok: true,
      data: info,
      ai_followup: {
        instructions: [
          `请阅读 auto/codebase.json 的 sample_files 中最多 ${this.config().max_sample_files} 个源码文件。`,
          '总结编码风格、模块边界和测试约定，并写回 .lrnev/auto/codebase.json 的 coding_style / architecture_notes 字段。',
          '不要调用外部 LLM 或 embedding 服务；只基于当前项目源码总结。',
        ],
      },
    };
  }

  private async findManifestFiles(): Promise<string[]> {
    const found = new Set<string>();
    const maxDepth = this.config().max_manifest_depth;
    for (let depth = 0; depth <= maxDepth; depth++) {
      const prefix = depth === 0 ? '' : `${Array.from({ length: depth }, () => '*').join('/')}/`;
      for (const manifest of MANIFEST_FILES) {
        for (const match of await this.fs.list(`${prefix}${manifest}`, { dot: true })) {
          if (manifestDepth(match) > maxDepth || this.isIgnoredPath(match)) continue;
          found.add(match);
        }
      }
    }
    return [...found].sort((a, b) => manifestDepth(a) - manifestDepth(b) || a.localeCompare(b));
  }

  private async scanDirectories(manifestDirs: string[]): Promise<DirectoryInfo[]> {
    const directories = new Map<string, DirectoryInfo['kind']>();
    const entries = await this.fs.list('*', { dot: true });
    for (const entry of entries) {
      if (entry.includes('/') || this.isIgnoredPath(entry) || entry.startsWith('.lrnev')) continue;
      const stat = await this.fs.stat(entry).catch(() => null);
      if (!stat?.isDirectory) continue;
      directories.set(entry, classifyDirectory(entry));
    }

    for (const dir of manifestDirs) {
      if (!dir || this.isIgnoredPath(dir)) continue;
      const stat = await this.fs.stat(dir).catch(() => null);
      if (stat?.isDirectory) directories.set(dir, 'source');
      for (const child of KNOWN_DIRECTORY_NAMES) {
        const path = joinRel(dir, child);
        const childStat = await this.fs.stat(path).catch(() => null);
        if (childStat?.isDirectory) directories.set(path, classifyDirectory(path));
      }
    }

    return [...directories.entries()]
      .map(([path, kind]) => ({ path, kind }))
      .sort((a, b) => a.path.localeCompare(b.path));
  }

  /**
   * 列出根级文件清单（不限白名单）。
   *
   * 这是给客户端 AI 的"地图"：让它看到 pom.xml / build.gradle / composer.json 等
   * lrnev 不解析的构建文件，由 AI 自己识别技术栈，而不是靠脚本穷举生态。
   */
  private async scanRootFiles(): Promise<string[]> {
    const files: string[] = [];
    const entries = await this.fs.list('*', { dot: true });
    for (const entry of entries) {
      if (entry.includes('/') || this.isIgnoredPath(entry) || entry.startsWith('.lrnev')) continue;
      const stat = await this.fs.stat(entry).catch(() => null);
      if (!stat?.isFile) continue;
      files.push(entry);
    }
    return files.sort();
  }

  private async sampleSourceFiles(manifestDirs: string[]): Promise<string[]> {
    const bases = [...new Set(['', ...manifestDirs])];
    const files: string[] = [];
    for (const base of bases) {
      for (const pattern of SOURCE_FILE_PATTERNS) {
        const matches = await this.fs.list(joinRel(base, pattern));
        for (const match of matches) {
          if (this.isIgnoredPath(match)) continue;
          files.push(match);
        }
      }
    }
    return [...new Set(files)].sort().slice(0, this.config().max_sample_files);
  }

  private config() {
    return loadConfig(this.fs.root).auto_analyzer;
  }

  private isIgnoredPath(path: string): boolean {
    const segments = path.split('/');
    return this.config().ignore_dirs.some((dir) => segments.includes(dir));
  }
}

function detectNodeLanguage(fs: FileStorage, dir: string): string {
  if (fs.exists(joinRel(dir, 'tsconfig.json'))) return 'typescript';
  return 'javascript';
}

function mergeDeps(target: Record<string, string[]>, ecosystem: string, values: string[]): void {
  target[ecosystem] = [...new Set([...(target[ecosystem] ?? []), ...values])].sort();
}

function collectPackageJsonDeps(pkg: Record<string, unknown>): string[] {
  const deps = {
    ...(isObject(pkg.dependencies) ? pkg.dependencies : {}),
    ...(isObject(pkg.devDependencies) ? pkg.devDependencies : {}),
    ...(isObject(pkg.peerDependencies) ? pkg.peerDependencies : {}),
  };
  return Object.keys(deps).sort();
}

function collectPyprojectDeps(text: string): string[] {
  return collectTomlArrayValues(text, ['dependencies']);
}

function collectCargoDeps(text: string): string[] {
  const deps: string[] = [];
  let inDependencies = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (/^\[dependencies\]/.test(line)) {
      inDependencies = true;
      continue;
    }
    if (/^\[.+\]/.test(line)) inDependencies = false;
    if (inDependencies && /^[A-Za-z0-9_-]+\s*=/.test(line)) {
      deps.push(line.split('=')[0]!.trim());
    }
  }
  return deps.sort();
}

function collectGoDeps(text: string): string[] {
  const deps: string[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    const singleRequire = /^require\s+([\w./-]+)\s+v\d/.exec(line);
    if (singleRequire) {
      deps.push(singleRequire[1]!);
      continue;
    }
    if (/^[\w./-]+\s+v\d/.test(line)) {
      deps.push(line.split(/\s+/)[0]!);
    }
  }
  return deps.sort();
}

function collectTomlArrayValues(text: string, keys: string[]): string[] {
  const deps: string[] = [];
  for (const key of keys) {
    const regex = new RegExp(`${key}\\s*=\\s*\\[([\\s\\S]*?)\\]`, 'm');
    const match = regex.exec(text);
    if (!match) continue;
    const body = match[1]!;
    for (const item of body.split(',')) {
      const cleaned = item.trim().replace(/^['"]|['"]$/g, '');
      if (cleaned) deps.push(cleaned);
    }
  }
  return deps.sort();
}

function extractTomlNameVersion(text: string): { name?: string; version?: string } {
  const name = /^name\s*=\s*["']([^"']+)["']/m.exec(text)?.[1];
  const version = /^version\s*=\s*["']([^"']+)["']/m.exec(text)?.[1];
  return {
    ...(name && { name }),
    ...(version && { version }),
  };
}

function extractGoModuleName(text: string): string | undefined {
  return /^module\s+(.+)$/m.exec(text)?.[1]?.trim();
}

function classifyDirectory(path: string): DirectoryInfo['kind'] {
  const leaf = basenameRel(path);
  if (/^(src|lib|app|crates|openviking|product)$/.test(leaf)) return 'source';
  if (/^(test|tests|__tests__|spec)$/.test(leaf)) return 'test';
  if (/^(doc|docs|documentation)$/.test(leaf)) return 'docs';
  if (/^(\.github|config|configs|scripts)$/.test(leaf)) return 'config';
  if (/^(dist|build|target|coverage)$/.test(leaf)) return 'build';
  return 'other';
}

function inferLanguageFromSamples(files: string[]): string {
  const counts = new Map<string, number>();
  for (const file of files) {
    const lang = extensionToLanguage(file);
    if (!lang) continue;
    counts.set(lang, (counts.get(lang) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'unknown';
}

function extensionToLanguage(file: string): string | null {
  if (/\.(ts|tsx)$/.test(file)) return 'typescript';
  if (/\.(js|jsx)$/.test(file)) return 'javascript';
  if (/\.py$/.test(file)) return 'python';
  if (/\.rs$/.test(file)) return 'rust';
  if (/\.go$/.test(file)) return 'go';
  return null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function dirnameRel(path: string): string {
  const index = path.lastIndexOf('/');
  return index === -1 ? '' : path.slice(0, index);
}

function basenameRel(path: string): string {
  const index = path.lastIndexOf('/');
  return index === -1 ? path : path.slice(index + 1);
}

function joinRel(base: string, child: string): string {
  return base ? `${base}/${child}` : child;
}

function manifestDepth(path: string): number {
  const dir = dirnameRel(path);
  return dir ? dir.split('/').length : 0;
}
