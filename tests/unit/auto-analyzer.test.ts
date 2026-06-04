/**
 * AutoAnalyzer 单元测试。
 *
 * 覆盖 Node / Python / Rust / Go manifest 探测、依赖提取、目录分类和样本文件。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { dir as tmpDir, type DirectoryResult } from 'tmp-promise';

import { AutoAnalyzer } from '../../src/core/AutoAnalyzer.js';
import { FileStorage } from '../../src/storage/FileStorage.js';
import { ensureWorkspace } from '../../src/storage/WorkspaceLocator.js';

describe('AutoAnalyzer', () => {
  let workspace: DirectoryResult;
  let fs: FileStorage;

  beforeEach(async () => {
    workspace = await tmpDir({ unsafeCleanup: true });
    await ensureWorkspace(workspace.path);
    fs = new FileStorage(workspace.path);
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  it('应探测 package.json、依赖、包管理器和 TypeScript', async () => {
    await fs.writeJson('package.json', {
      name: 'demo',
      version: '1.2.3',
      dependencies: { commander: '^12.0.0' },
      devDependencies: { typescript: '^5.0.0' },
    });
    await fs.write('package-lock.json', '{}');
    await fs.write('tsconfig.json', '{}');
    await fs.write('src/index.ts', 'export const x = 1;\n');

    const result = await new AutoAnalyzer(fs).analyze();

    expect(result.data.primary_language).toBe('typescript');
    expect(result.data.tech_stack[0]).toMatchObject({
      ecosystem: 'node',
      language: 'typescript',
      manifest: 'package.json',
      name: 'demo',
      version: '1.2.3',
    });
    expect(result.data.package_managers).toContain('npm');
    expect(result.data.dependencies.node).toEqual(['commander', 'typescript']);
    expect(result.data.sample_files).toContain('src/index.ts');
    expect(fs.exists('.lrnev/auto/codebase.json')).toBe(true);
  });

  it('F-10: 应输出根级文件清单 root_files 并忽略噪音目录(.idea/logs)', async () => {
    await fs.write('pom.xml', '<project><artifactId>demo</artifactId></project>\n');
    await fs.write('README.md', '# demo\n');
    await fs.write('backend/App.java', 'class App {}\n');
    await fs.write('.idea/workspace.xml', '<x/>\n');
    await fs.write('logs/app.log', 'log\n');

    const result = await new AutoAnalyzer(fs).analyze();

    expect(result.data.root_files).toContain('pom.xml');
    expect(result.data.root_files).toContain('README.md');
    expect(result.data.directories.some((d) => d.path === 'backend')).toBe(true);
    expect(result.data.directories.some((d) => d.path === '.idea')).toBe(false);
    expect(result.data.directories.some((d) => d.path === 'logs')).toBe(false);
    // 11-F03: 未确定性识别技术栈(Java)时应有澄清 note，说明是预期、由 AI 识别
    expect(result.data.tech_stack).toHaveLength(0);
    expect(result.data.notes.join('\n')).toContain('未确定性识别技术栈');
  });

  it('11-F03: 已识别技术栈时不应追加"未识别"澄清 note', async () => {
    await fs.writeJson('package.json', { name: 'demo' });
    const result = await new AutoAnalyzer(fs).analyze();
    expect(result.data.tech_stack.length).toBeGreaterThan(0);
    expect(result.data.notes.join('\n')).not.toContain('未确定性识别技术栈');
  });

  it('F-09: 应在有限深度内探测子目录 package.json 和源码样本', async () => {
    await fs.writeJson('product/lrnev-govern/package.json', {
      name: 'lrnev-govern',
      version: '0.1.0',
      dependencies: { commander: '^12.0.0' },
    });
    await fs.write('product/lrnev-govern/package-lock.json', '{}');
    await fs.write('product/lrnev-govern/tsconfig.json', '{}');
    await fs.write('product/lrnev-govern/src/index.ts', 'export const x = 1;\n');
    await fs.writeJson('node_modules/ignored/package.json', { name: 'ignored' });

    const result = await new AutoAnalyzer(fs).analyze();

    expect(result.data.tech_stack[0]).toMatchObject({
      ecosystem: 'node',
      language: 'typescript',
      manifest: 'product/lrnev-govern/package.json',
      name: 'lrnev-govern',
      version: '0.1.0',
    });
    expect(result.data.package_managers).toContain('npm');
    expect(result.data.dependencies.node).toEqual(['commander']);
    expect(result.data.sample_files).toContain('product/lrnev-govern/src/index.ts');
    expect(result.data.directories).toEqual(expect.arrayContaining([
      { path: 'product/lrnev-govern', kind: 'source' },
      { path: 'product/lrnev-govern/src', kind: 'source' },
    ]));
    expect(result.data.tech_stack.some((item) => item.manifest.includes('node_modules'))).toBe(false);
  });

  it('应探测 pyproject.toml、Cargo.toml 和 go.mod', async () => {
    await fs.write(
      'pyproject.toml',
      [
        '[project]',
        'name = "py-demo"',
        'version = "0.1.0"',
        'dependencies = ["requests", "pydantic"]',
      ].join('\n'),
    );
    await fs.write('Cargo.toml', '[package]\nname = "rs-demo"\nversion = "0.2.0"\n[dependencies]\nserde = "1"\n');
    await fs.write('go.mod', 'module example.com/demo\nrequire github.com/stretchr/testify v1.8.0\n');

    const result = await new AutoAnalyzer(fs).analyze();
    const ecosystems = result.data.tech_stack.map((item) => item.ecosystem);

    expect(ecosystems).toEqual(expect.arrayContaining(['python', 'rust', 'go']));
    expect(result.data.dependencies.python).toEqual(['pydantic', 'requests']);
    expect(result.data.dependencies.rust).toEqual(['serde']);
    expect(result.data.dependencies.go).toEqual(['github.com/stretchr/testify']);
  });

  it('应扫描顶层目录并分类', async () => {
    await fs.mkdir('src');
    await fs.mkdir('tests');
    await fs.mkdir('docs');
    await fs.mkdir('node_modules');

    const result = await new AutoAnalyzer(fs).analyze();
    expect(result.data.directories).toEqual(
      expect.arrayContaining([
        { path: 'src', kind: 'source' },
        { path: 'tests', kind: 'test' },
        { path: 'docs', kind: 'docs' },
      ]),
    );
    expect(result.data.directories.some((dir) => dir.path === 'node_modules')).toBe(false);
  });
  it('F-02: auto_analyzer 配置应控制 manifest 深度、抽样数量和忽略目录', async () => {
    await fs.writeJson('.lrnev/config/lrnev.json', {
      auto_analyzer: {
        max_manifest_depth: 1,
        max_sample_files: 1,
        ignore_dirs: ['vendor'],
      },
    });
    await fs.writeJson('apps/demo/package.json', { name: 'too-deep' });
    await fs.writeJson('pkg/package.json', { name: 'visible' });
    await fs.write('pkg/src/a.ts', 'export const a = 1;\n');
    await fs.write('pkg/src/b.ts', 'export const b = 1;\n');
    await fs.writeJson('vendor/ignored/package.json', { name: 'ignored' });
    await fs.write('vendor/src/ignored.ts', 'export const ignored = 1;\n');

    const result = await new AutoAnalyzer(fs).analyze();

    expect(result.data.tech_stack.map((item) => item.name)).toEqual(['visible']);
    expect(result.data.sample_files).toHaveLength(1);
    expect(result.data.sample_files[0]).toMatch(/^pkg\/src\//);
  });
});
