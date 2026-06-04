/**
 * Searcher 单元测试。
 *
 * 覆盖目录优先检索：L0 摘要加权、scope 过滤、无结果提示。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { dir as tmpDir, type DirectoryResult } from 'tmp-promise';

import { FileStorage } from '../../src/storage/FileStorage.js';
import { ensureWorkspace } from '../../src/storage/WorkspaceLocator.js';
import { SceneManager } from '../../src/core/SceneManager.js';
import { SpecManager } from '../../src/core/SpecManager.js';
import { Summarizer } from '../../src/core/Summarizer.js';
import { Searcher } from '../../src/core/Searcher.js';

describe('Searcher', () => {
  let workspace: DirectoryResult;
  let fs: FileStorage;
  let scenes: SceneManager;
  let specs: SpecManager;
  let summarizer: Summarizer;
  let searcher: Searcher;

  beforeEach(async () => {
    workspace = await tmpDir({ unsafeCleanup: true });
    await ensureWorkspace(workspace.path);
    fs = new FileStorage(workspace.path);
    scenes = new SceneManager(fs);
    specs = new SpecManager(fs, scenes);
    summarizer = new Summarizer(fs);
    searcher = new Searcher(fs);
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  it('应优先命中 L0 摘要并返回 context URI', async () => {
    const scene = await scenes.create({ name: 'user-management' });
    await summarizer.saveSummary({
      uri: `context://scene/${scene.data.id}`,
      l0: '用户权限与登录',
    });

    const res = await searcher.search({ query: '权限' });
    expect(res.data.results[0]?.uri).toBe(`context://scene/${scene.data.id}`);
    expect(res.data.results[0]?.matched_level).toBe('L0');
  });

  it('scope=scene 时应只搜索该 Scene 下内容', async () => {
    const user = await scenes.create({ name: 'user-management' });
    const order = await scenes.create({ name: 'order-management' });
    await specs.create({ scene: user.data.id, name: 'user-login' });
    await specs.create({ scene: order.data.id, name: 'order-create' });
    await summarizer.saveSummary({
      uri: `context://scene/${user.data.id}`,
      l0: '登录 权限 用户',
    });
    await summarizer.saveSummary({
      uri: `context://scene/${order.data.id}`,
      l0: '订单 创建 支付',
    });

    const res = await searcher.search({ query: '订单', scope: `scene:${user.data.id}` });
    expect(res.data.results).toHaveLength(0);
  });

  it('无匹配时应返回空结果和 ai_followup', async () => {
    await scenes.create({ name: 'user-management' });
    const res = await searcher.search({ query: '完全不存在的关键词' });
    expect(res.data.results).toEqual([]);
    expect(res.ai_followup?.instructions.join('\n')).toContain('没有找到');
  });
  it('F-02: search 配置应控制 top_k、snippet_length 和 L0 加权', async () => {
    await fs.writeJson('.lrnev/config/lrnev.json', {
      search: { top_k: 1, snippet_length: 6, use_l0_ranking: false },
    });
    const scene = await scenes.create({ name: 'user-management' });
    await summarizer.saveSummary({
      uri: `context://scene/${scene.data.id}`,
      l0: 'alpha beta',
    });
    await fs.write('.lrnev/PROJECT.md', 'alpha alpha alpha alpha long-snippet-text\n');

    const res = await searcher.search({ query: 'alpha' });

    expect(res.data.results).toHaveLength(1);
    expect(res.data.results[0]?.uri).toBe('context://project');
    expect(res.data.results[0]?.snippet.length).toBeLessThanOrEqual(6);
  });
});
