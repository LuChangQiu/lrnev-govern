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

  it('F-03: BM25 让短而精准的文档胜过长文档高频词，且召回集不缩小', async () => {
    const scene = await scenes.create({ name: 'user-management' });
    const short = await specs.create({ scene: scene.data.id, name: 'short-precise' });
    const long = await specs.create({ scene: scene.data.id, name: 'long-noisy' });
    const reqPath = (specId: string): string => `.lrnev/scenes/${scene.data.id}/specs/${specId}/requirements.md`;
    // 短而精准：标题即登录，仅一次。长而泛泛：大量无关噪声中只零星提到登录——BM25 的长度归一化让前者胜出。
    await fs.write(reqPath(short.data.spec), '登录\n');
    await fs.write(
      reqPath(long.data.spec),
      '订单 支付 报表 配置 权限 用户 流程 状态 字段 校验 缓存 索引 摘要 迁移 钩子 队列 通道 网关\n'.repeat(12)
        + '登录 登录\n',
    );

    const res = await searcher.search({ query: '登录' });
    const paths = res.data.results.map((r) => r.path);
    // 两个都被召回（BM25 只改排序、不缩召回集）
    expect(paths.some((p) => p.includes(short.data.spec))).toBe(true);
    expect(paths.some((p) => p.includes(long.data.spec))).toBe(true);
    // 短而精准排在长而高频之前
    const shortIdx = res.data.results.findIndex((r) => r.path.includes(short.data.spec));
    const longIdx = res.data.results.findIndex((r) => r.path.includes(long.data.spec));
    expect(shortIdx).toBeLessThan(longIdx);
  });
});
