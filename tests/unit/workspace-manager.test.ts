/**
 * WorkspaceManager 单元测试。
 *
 * 覆盖 lrnev_init 的核心行为：完整初始化、幂等不覆盖用户内容、
 * steering 写入与最小 codebase 探测。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { dir as tmpDir, type DirectoryResult } from 'tmp-promise';

import { FileStorage } from '../../src/storage/FileStorage.js';
import { WorkspaceManager } from '../../src/core/WorkspaceManager.js';
import { DEFAULT_SCENE_ID, SceneManager } from '../../src/core/SceneManager.js';
import { SpecManager } from '../../src/core/SpecManager.js';

describe('WorkspaceManager', () => {
  let workspace: DirectoryResult;
  let fs: FileStorage;
  let manager: WorkspaceManager;

  beforeEach(async () => {
    workspace = await tmpDir({ unsafeCleanup: true });
    fs = new FileStorage(workspace.path);
    manager = new WorkspaceManager();
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  it('应在空目录中初始化完整 .lrnev 工作区', async () => {
    const res = await manager.init({ root: workspace.path, project_name: 'demo-project' });

    expect(res.ok).toBe(true);
    expect(res.data.was_new).toBe(true);
    expect(fs.exists('.lrnev/PROJECT.md')).toBe(true);
    expect(fs.exists('.lrnev/ARCHITECTURE.md')).toBe(true);
    expect(fs.exists('.lrnev/steering/CORE_PRINCIPLES.md')).toBe(true);
    expect(fs.exists('.lrnev/steering/SCOPE_RULES.md')).toBe(true);
    expect(fs.exists('.lrnev/steering/ADR_TRIGGERS.md')).toBe(true);
    expect(fs.exists('.lrnev/steering/MEMORY_TRIGGERS.md')).toBe(true);
    expect(fs.exists('.lrnev/auto/codebase.json')).toBe(true);
    expect(fs.exists(`.lrnev/scenes/${DEFAULT_SCENE_ID}/scene.md`)).toBe(true);
    expect(res.data.codebase_detected).toBe(false);
    expect(res.ai_followup?.instructions.join('\n')).not.toContain('校对并补全');
    expect(res.ai_followup?.instructions.join('\n')).not.toContain('识别技术栈与架构');
    expect(res.ai_followup?.suggested_tools?.[0]?.name).toBe('spec_create');
  });

  it('adopt should create only the default Scene and allow direct Spec creation', async () => {
    await fs.write('src/index.ts', 'export const value = 1;\n');

    const res = await manager.init({ root: workspace.path, project_name: 'demo-project' });
    const sceneDirs = await fs.list('.lrnev/scenes/*');
    const scenes = new SceneManager(fs);
    const specs = new SpecManager(fs, scenes);
    const spec = await specs.create({ name: 'new-feature' });

    expect(res.ok).toBe(true);
    expect(sceneDirs).toEqual([
      `.lrnev/scenes/${DEFAULT_SCENE_ID}`,
    ]);
    expect(spec.data.scene).toBe(DEFAULT_SCENE_ID);
    expect(spec.data.spec).toBe('01-00-new-feature');
  });

  it('PROJECT.md 应使用项目名模板变量', async () => {
    await manager.init({ root: workspace.path, project_name: 'demo-project' });
    const project = await fs.read('.lrnev/PROJECT.md');
    expect(project).toContain('# demo-project');
    expect(project).toContain("title: 'demo-project'");
  });

  it('重复初始化不应覆盖用户已有文档', async () => {
    await manager.init({ root: workspace.path, project_name: 'demo-project' });
    await fs.write('.lrnev/PROJECT.md', '# 用户自定义内容\n');

    const res = await manager.init({ root: workspace.path, project_name: 'demo-project' });

    expect(res.data.was_new).toBe(false);
    expect(res.data.files_existing).toContain('.lrnev/PROJECT.md');
    expect(await fs.read('.lrnev/PROJECT.md')).toBe('# 用户自定义内容\n');
  });

  it('有 package.json 时应记录最小 codebase 探测结果', async () => {
    await fs.write('package.json', JSON.stringify({ name: 'demo' }));

    const res = await manager.init({ root: workspace.path, project_name: 'demo-project' });
    const codebase = await fs.readJson<{
      analyzer: string;
      primary_language: string;
      tech_stack: Array<{ manifest: string; ecosystem: string; language: string }>;
    }>('.lrnev/auto/codebase.json');

    expect(res.data.codebase_detected).toBe(true);
    expect(codebase.analyzer).toBe('AutoAnalyzer');
    expect(codebase.primary_language).toBe('javascript');
    expect(codebase.tech_stack[0]).toEqual({ manifest: 'package.json', ecosystem: 'node', language: 'javascript', name: 'demo' });
  });

  it('F-09: 已有代码项目应预填 ARCHITECTURE 技术栈和目录并引导 AI 补判断内容', async () => {
    await fs.writeJson('product/lrnev-govern/package.json', {
      name: 'lrnev-govern',
      version: '0.1.0',
      devDependencies: { typescript: '^5.6.0' },
    });
    await fs.write('product/lrnev-govern/tsconfig.json', '{}');
    await fs.write('product/lrnev-govern/src/index.ts', 'export const value = 1;\n');

    const res = await manager.init({ root: workspace.path, project_name: 'demo-project' });
    const architecture = await fs.read('.lrnev/ARCHITECTURE.md');

    expect(res.data.codebase_detected).toBe(true);
    expect(architecture).toContain('- typescript (node) lrnev-govern 0.1.0 - product/lrnev-govern/package.json');
    expect(architecture).toContain('- product/lrnev-govern/src/ (source)');
    expect(architecture).not.toContain('### 技术栈\n\n- TODO');
    expect(res.ai_followup?.instructions.join('\n')).toContain('已预填部分技术栈/目录到 ARCHITECTURE.md');
    expect(res.ai_followup?.instructions.join('\n')).toContain('校对并补全');
  });

  it('F-10-01: Java/Maven 项目(pom.xml + backend/frontend，无 src/lib/app)应判为已有项目并引导 AI 识别', async () => {
    await fs.write('pom.xml', '<project><artifactId>xpaas-boot</artifactId></project>\n');
    await fs.write('backend/Application.java', 'public class Application {}\n');
    await fs.write('frontend/index.html', '<html></html>\n');
    await fs.write('.idea/workspace.xml', '<x/>\n');

    const res = await manager.init({ root: workspace.path, project_name: 'xpaas-boot' });
    const codebase = await fs.readJson<{ root_files: string[]; tech_stack: unknown[]; directories: Array<{ path: string }> }>(
      '.lrnev/auto/codebase.json',
    );
    const followup = res.ai_followup?.instructions.join('\n') ?? '';

    // 生态无关：没认出 pom.xml 的技术栈，但仍判为已有项目
    expect(res.data.codebase_detected).toBe(true);
    expect(codebase.tech_stack).toHaveLength(0);
    // root_files 给 AI 当地图，含 pom.xml
    expect(codebase.root_files).toContain('pom.xml');
    // 未探到技术栈时也引导 AI 去识别并写回，不再死局
    expect(followup).toContain('识别技术栈与架构');
    expect(followup).toContain('PROJECT.md');
    // .idea 噪音不进目录地图
    expect(codebase.directories.some((d) => d.path === '.idea')).toBe(false);
  });

  it('F-10-03: 向上查找命中祖先 .lrnev 时应在 followup 提示确认工作区根', async () => {
    const originalCwd = process.cwd();
    try {
      await manager.init({ root: workspace.path, project_name: 'ancestor' });
      await fs.write('sub/deep/keep.txt', 'x\n');
      process.chdir(`${workspace.path}/sub/deep`);

      const res = await manager.init({});
      const followup = res.ai_followup?.instructions.join('\n') ?? '';

      expect(followup).toContain('向上查找命中');
      expect(followup).toContain('LRNEV_WORKSPACE');
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('缺失 steering 文件时再次初始化应补齐', async () => {
    await manager.init({ root: workspace.path, project_name: 'demo-project' });
    await fs.rm('.lrnev/steering/ADR_TRIGGERS.md');

    const res = await manager.init({ root: workspace.path, project_name: 'demo-project' });

    expect(fs.exists('.lrnev/steering/ADR_TRIGGERS.md')).toBe(true);
    expect(res.data.files_created).toContain('.lrnev/steering/ADR_TRIGGERS.md');
  });
});
