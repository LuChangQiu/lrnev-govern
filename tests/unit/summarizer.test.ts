/**
 * Summarizer 单元测试。
 *
 * 覆盖 L0/L1 路径计算、摘要保存，以及列表 URI 拒绝。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { dir as tmpDir, type DirectoryResult } from 'tmp-promise';

import { FileStorage } from '../../src/storage/FileStorage.js';
import { ensureWorkspace } from '../../src/storage/WorkspaceLocator.js';
import { SceneManager } from '../../src/core/SceneManager.js';
import { SpecManager } from '../../src/core/SpecManager.js';
import { Summarizer, summaryPathFor } from '../../src/core/Summarizer.js';

describe('Summarizer', () => {
  let workspace: DirectoryResult;
  let fs: FileStorage;
  let scenes: SceneManager;
  let specs: SpecManager;
  let summarizer: Summarizer;

  beforeEach(async () => {
    workspace = await tmpDir({ unsafeCleanup: true });
    await ensureWorkspace(workspace.path);
    fs = new FileStorage(workspace.path);
    scenes = new SceneManager(fs);
    specs = new SpecManager(fs, scenes);
    summarizer = new Summarizer(fs);
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  it('summaryPathFor 应按目标文档生成独立摘要路径', () => {
    expect(summaryPathFor('.lrnev/PROJECT.md', 'L0')).toBe('.lrnev/.PROJECT.abstract.md');
    expect(summaryPathFor('.lrnev/ARCHITECTURE.md', 'L1')).toBe('.lrnev/.ARCHITECTURE.overview.md');
    expect(summaryPathFor('.lrnev/scenes/01-demo/scene.md', 'L0')).toBe('.lrnev/scenes/01-demo/.scene.abstract.md');
    expect(summaryPathFor('.lrnev/scenes/01-demo/architecture.md', 'L1')).toBe('.lrnev/scenes/01-demo/.architecture.overview.md');
    expect(summaryPathFor('.lrnev/scenes/01-demo/roadmap.md', 'L0')).toBe('.lrnev/scenes/01-demo/.roadmap.abstract.md');
  });

  it('应保存 Scene 的 L0/L1 摘要', async () => {
    const scene = await scenes.create({ name: 'user-management' });
    const res = await summarizer.saveSummary({
      uri: `context://scene/${scene.data.id}`,
      l0: '用户管理 Scene',
      l1: '负责用户资料、权限和登录相关能力。',
    });

    expect(res.data.saved.map((item) => item.level)).toEqual(['L0', 'L1']);
    expect(await fs.read(`.lrnev/scenes/${scene.data.id}/.scene.abstract.md`)).toBe('用户管理 Scene\n');
    expect(await fs.read(`.lrnev/scenes/${scene.data.id}/.scene.overview.md`)).toContain('用户资料');
  });

  it('应保存 Spec 的 L0 摘要', async () => {
    const scene = await scenes.create({ name: 'user-management' });
    const spec = await specs.create({ scene: scene.data.id, name: 'user-login' });
    await summarizer.saveSummary({
      uri: `context://spec/${scene.data.id}/${spec.data.spec}`,
      l0: '用户登录需求',
    });

    expect(await fs.read(`.lrnev/scenes/${scene.data.id}/specs/${spec.data.spec}/.requirements.abstract.md`)).toBe('用户登录需求\n');
  });

  it('project 与 architecture 摘要应并存且不覆盖', async () => {
    // I-6 后 summarize 校验目标存在；真实场景里 init 已建这两份，测试里显式补上。
    await fs.write('.lrnev/PROJECT.md', '# Project');
    await fs.write('.lrnev/ARCHITECTURE.md', '# Architecture');
    await summarizer.saveSummary({
      uri: 'context://project',
      l0: '项目摘要',
      l1: '项目概览',
    });
    await summarizer.saveSummary({
      uri: 'context://project/architecture',
      l0: '架构摘要',
      l1: '架构概览',
    });

    expect(await fs.read('.lrnev/.PROJECT.abstract.md')).toBe('项目摘要\n');
    expect(await fs.read('.lrnev/.PROJECT.overview.md')).toBe('项目概览\n');
    expect(await fs.read('.lrnev/.ARCHITECTURE.abstract.md')).toBe('架构摘要\n');
    expect(await fs.read('.lrnev/.ARCHITECTURE.overview.md')).toBe('架构概览\n');
  });

  it('Scene 三个文档的摘要应互不覆盖', async () => {
    const scene = await scenes.create({ name: 'user-management' });
    await summarizer.saveSummary({ uri: `context://scene/${scene.data.id}`, l0: 'scene 摘要' });
    await summarizer.saveSummary({ uri: `context://scene/${scene.data.id}/architecture`, l0: 'architecture 摘要' });
    await summarizer.saveSummary({ uri: `context://scene/${scene.data.id}/roadmap`, l0: 'roadmap 摘要' });

    expect(await fs.read(`.lrnev/scenes/${scene.data.id}/.scene.abstract.md`)).toBe('scene 摘要\n');
    expect(await fs.read(`.lrnev/scenes/${scene.data.id}/.architecture.abstract.md`)).toBe('architecture 摘要\n');
    expect(await fs.read(`.lrnev/scenes/${scene.data.id}/.roadmap.abstract.md`)).toBe('roadmap 摘要\n');
  });

  it('列表 URI 不能保存摘要', async () => {
    await expect(summarizer.saveSummary({ uri: 'context://scene', l0: '列表' })).rejects.toThrow();
  });

  it('应拒绝为不存在的目标建孤儿摘要，且不凭空建目录/文件（I-6）', async () => {
    const ghostDir = '.lrnev/scenes/01-ghost-scene/specs/99-99-ghost-spec';
    await expect(
      summarizer.saveSummary({ uri: 'context://spec/01-ghost-scene/99-99-ghost-spec/tasks', l0: '幽灵摘要' }),
    ).rejects.toThrow();
    expect(fs.exists(ghostDir)).toBe(false);
    expect(fs.exists(`${ghostDir}/.tasks.abstract.md`)).toBe(false);
  });

  it('真实存在的目标仍可正常保存摘要（不回归）', async () => {
    const scene = await scenes.create({ name: 'user-management' });
    const spec = await specs.create({ scene: scene.data.id, name: 'user-login' });
    const res = await summarizer.saveSummary({
      uri: `context://spec/${scene.data.id}/${spec.data.spec}/tasks`,
      l0: '任务摘要',
    });
    expect(res.ok).toBe(true);
  });

  it('未提供 l0/l1 应拒绝', async () => {
    const scene = await scenes.create({ name: 'user-management' });
    await expect(summarizer.saveSummary({ uri: `context://scene/${scene.data.id}` })).rejects.toThrow();
  });
});
