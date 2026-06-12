/**
 * ADRManager 单元测试。
 *
 * 覆盖全局 / Scene ADR 的独立编号、索引更新和读取。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { dir as tmpDir, type DirectoryResult } from 'tmp-promise';

import { FileStorage } from '../../src/storage/FileStorage.js';
import { ensureWorkspace } from '../../src/storage/WorkspaceLocator.js';
import { SceneManager } from '../../src/core/SceneManager.js';
import { ADRManager } from '../../src/core/ADRManager.js';

describe('ADRManager', () => {
  let workspace: DirectoryResult;
  let fs: FileStorage;
  let scenes: SceneManager;
  let adrs: ADRManager;

  beforeEach(async () => {
    workspace = await tmpDir({ unsafeCleanup: true });
    await ensureWorkspace(workspace.path);
    fs = new FileStorage(workspace.path);
    scenes = new SceneManager(fs);
    adrs = new ADRManager(fs, scenes);
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  it('全局 ADR 应递增编号并更新 README 索引', async () => {
    const first = await adrs.create({
      title: 'Use file storage',
      scope: 'global',
      context: 'M1 需要简单可靠的存储。',
      decision: '使用文件系统作为事实来源。',
      alternatives: ['SQLite：暂不需要索引层'],
      consequences: '更容易被 AI 直接读取。',
    });
    const second = await adrs.create({
      title: 'Use MCP stdio',
      scope: 'global',
      context: '需要兼容多个 MCP 客户端。',
      decision: '使用标准 stdio transport。',
    });

    expect(first.data.number).toBe('0001');
    expect(second.data.number).toBe('0002');
    expect(fs.exists('.lrnev/decisions/adr/0001-use-file-storage.md')).toBe(true);
    const index = await fs.read('.lrnev/decisions/adr/README.md');
    expect(index).toContain('0001. Use file storage');
    expect(index).toContain('0002. Use MCP stdio');
  });

  it('Scene ADR 与全局 ADR 应编号独立', async () => {
    const scene = await scenes.create({ name: 'user-management' });
    await adrs.create({
      title: 'Global decision',
      scope: 'global',
      context: '全局上下文',
      decision: '全局决策',
    });
    const sceneAdr = await adrs.create({
      title: 'Scene decision',
      scope: `scene:${scene.data.id}`,
      context: 'Scene 内上下文',
      decision: 'Scene 内决策',
    });

    expect(sceneAdr.data.number).toBe('0001');
    expect(fs.exists(`.lrnev/scenes/${scene.data.id}/decisions/adr/0001-scene-decision.md`)).toBe(true);
    const sceneList = await adrs.list(`scene:${scene.data.id}`);
    expect(sceneList).toHaveLength(1);
    expect(sceneList[0]?.title).toBe('Scene decision');
  });

  it('get 应解析 ADR 主体章节', async () => {
    await adrs.create({
      title: 'Use JSON',
      scope: 'global',
      context: '需要机器可读。',
      decision: '输出 JSON。',
      alternatives: ['YAML：可读但解析边界更多'],
      consequences: '协议层更稳定。',
    });

    const got = await adrs.get('global', '1');
    expect(got.title).toBe('Use JSON');
    expect(got.body.context).toContain('需要机器可读');
    expect(got.body.decision).toContain('输出 JSON');
    expect(got.body.alternatives?.join('\n')).toContain('YAML');
  });

  it('S5(I-17): supersedes 应读时反算 superseded_by，且不回写旧 ADR 文件', async () => {
    const first = await adrs.create({
      title: 'Old decision', scope: 'global', context: 'c1', decision: 'd1',
    });
    const oldPath = first.data.path;
    const before = await fs.read(oldPath.replace(/\\/g, '/').split(`${workspace.path.replace(/\\/g, '/')}/`)[1] ?? oldPath);
    await adrs.create({
      title: 'New decision', scope: 'global', context: 'c2', decision: 'd2', supersedes: ['1'],
    });

    const oldGot = await adrs.get('global', '1');
    expect(oldGot.superseded_by).toEqual(['0002']);
    expect(oldGot.status).toBe('proposed');

    const after = await fs.read(oldPath.replace(/\\/g, '/').split(`${workspace.path.replace(/\\/g, '/')}/`)[1] ?? oldPath);
    expect(after).toBe(before);

    const list = await adrs.list('global');
    expect(list.find((a) => a.number === '0001')?.superseded_by).toEqual(['0002']);
    expect(list.find((a) => a.number === '0002')?.superseded_by).toBeUndefined();
  });

  it('S5 复核修复: supersedes 非正整数应拒绝，合法编号归一化为四位', async () => {
    await adrs.create({ title: 'Base', scope: 'global', context: 'c', decision: 'd' });
    await expect(adrs.create({
      title: 'Bad', scope: 'global', context: 'c', decision: 'd', supersedes: ['ADR-1'],
    })).rejects.toThrow(/不合法/);
    await expect(adrs.create({
      title: 'Bad2', scope: 'global', context: 'c', decision: 'd', supersedes: ['0'],
    })).rejects.toThrow(/不合法/);

    const ok = await adrs.create({
      title: 'Good', scope: 'global', context: 'c', decision: 'd', supersedes: [' 1 '],
    });
    expect(ok.data.supersedes).toEqual(['0001']);
    const old = await adrs.get('global', '1');
    expect(old.superseded_by).toEqual([ok.data.number]);
  });
});
