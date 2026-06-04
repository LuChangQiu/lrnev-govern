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
import { Summarizer } from '../../src/core/Summarizer.js';

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

  it('应保存 Scene 的 L0/L1 摘要', async () => {
    const scene = await scenes.create({ name: 'user-management' });
    const res = await summarizer.saveSummary({
      uri: `context://scene/${scene.data.id}`,
      l0: '用户管理 Scene',
      l1: '负责用户资料、权限和登录相关能力。',
    });

    expect(res.data.saved.map((item) => item.level)).toEqual(['L0', 'L1']);
    expect(await fs.read(`.lrnev/scenes/${scene.data.id}/.abstract.md`)).toBe('用户管理 Scene\n');
    expect(await fs.read(`.lrnev/scenes/${scene.data.id}/.overview.md`)).toContain('用户资料');
  });

  it('应保存 Spec 的 L0 摘要', async () => {
    const scene = await scenes.create({ name: 'user-management' });
    const spec = await specs.create({ scene: scene.data.id, name: 'user-login' });
    await summarizer.saveSummary({
      uri: `context://spec/${scene.data.id}/${spec.data.spec}`,
      l0: '用户登录需求',
    });

    expect(await fs.read(`.lrnev/scenes/${scene.data.id}/specs/${spec.data.spec}/.abstract.md`)).toBe('用户登录需求\n');
  });

  it('列表 URI 不能保存摘要', async () => {
    await expect(summarizer.saveSummary({ uri: 'context://scene', l0: '列表' })).rejects.toThrow();
  });

  it('未提供 l0/l1 应拒绝', async () => {
    const scene = await scenes.create({ name: 'user-management' });
    await expect(summarizer.saveSummary({ uri: `context://scene/${scene.data.id}` })).rejects.toThrow();
  });
});
