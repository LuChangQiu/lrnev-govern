import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { dir as tmpDir, type DirectoryResult } from 'tmp-promise';

import { FileStorage } from '../../src/storage/FileStorage.js';
import { ensureWorkspace } from '../../src/storage/WorkspaceLocator.js';
import { SceneManager } from '../../src/core/SceneManager.js';
import { ErrorbookManager, computeFingerprint } from '../../src/core/ErrorbookManager.js';

describe('ErrorbookManager', () => {
  let workspace: DirectoryResult;
  let fs: FileStorage;
  let scenes: SceneManager;
  let errors: ErrorbookManager;

  beforeEach(async () => {
    workspace = await tmpDir({ unsafeCleanup: true });
    await ensureWorkspace(workspace.path);
    fs = new FileStorage(workspace.path);
    scenes = new SceneManager(fs);
    errors = new ErrorbookManager(fs, scenes);
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  it('computeFingerprint 应对白空白和大小写稳定', () => {
    expect(computeFingerprint('  Build Failed ', ' Missing ENV ')).toBe(
      computeFingerprint('build failed', 'missing env'),
    );
  });

  it('record 应写入 incidents 并返回 ai_followup', async () => {
    const res = await errors.record({
      symptom: '构建失败',
      root_cause: '缺少环境变量',
      fix_action: '补充 .env 配置',
      scope: 'global',
    });

    expect(res.data.status).toBe('incident');
    expect(res.data.occurrence_count).toBe(1);
    expect(fs.exists(`.lrnev/errorbook/incidents/${res.data.id}.md`)).toBe(true);
    expect(res.ai_followup?.suggested_tools?.[0]?.name).toBe('error_promote');
  });

  it('相同指纹重复 record 应自动 merge occurrence_count', async () => {
    const first = await errors.record({
      symptom: '构建失败',
      root_cause: '缺少环境变量',
      fix_action: '补充 .env 配置',
      scope: 'global',
      references: ['commit-a'],
    });
    const second = await errors.record({
      symptom: ' 构建失败 ',
      root_cause: '缺少环境变量',
      fix_action: '补充 CI secrets',
      scope: 'global',
      references: ['commit-b'],
    });

    expect(second.data.id).toBe(first.data.id);
    expect(second.data.occurrence_count).toBe(2);
    expect(second.data.body.references).toEqual(['commit-a', 'commit-b']);
  });

  it('promote 未提供 verification 应拒绝', async () => {
    const recorded = await errors.record({
      symptom: '运行时报错',
      root_cause: '空指针',
      fix_action: '补空值判断',
      scope: 'global',
    });

    await expect(errors.promote({ id: recorded.data.id, scope: 'global' })).rejects.toThrow();
  });

  it('promote 应移动到 promoted 并更新状态', async () => {
    const recorded = await errors.record({
      symptom: '运行时报错',
      root_cause: '空指针',
      fix_action: '补空值判断',
      verification: '单元测试通过',
      scope: 'global',
    });

    const promoted = await errors.promote({ id: recorded.data.id, scope: 'global' });
    expect(promoted.data.status).toBe('promoted');
    expect(fs.exists(`.lrnev/errorbook/incidents/${recorded.data.id}.md`)).toBe(false);
    expect(fs.exists(`.lrnev/errorbook/promoted/${recorded.data.id}.md`)).toBe(true);
  });

  it('search 应搜索 incidents 和 promoted', async () => {
    const recorded = await errors.record({
      symptom: '登录失败',
      root_cause: 'token 过期',
      fix_action: '刷新 token',
      verification: '集成测试通过',
      scope: 'global',
    });
    await errors.promote({ id: recorded.data.id, scope: 'global' });

    const results = await errors.search({ query: 'token', scope: 'global' });
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe(recorded.data.id);
  });

  it('11-F01: search 应支持多词自然语言召回 + 指纹兼容 + 按命中排序', async () => {
    const a = await errors.record({
      symptom: 'ready gate failed because requirements headings were renamed',
      root_cause: 'section titles must match template',
      fix_action: 'restore Chinese template headings',
      scope: 'global',
    });
    const b = await errors.record({
      symptom: '构建超时',
      root_cause: '网络很慢',
      fix_action: '增加重试',
      scope: 'global',
    });

    // 多词自然语言：旧实现(整段子串)会空，新实现按 token 召回
    const nl = await errors.search({ query: 'requirements headings ready gate', scope: 'global' });
    expect(nl.map((entry) => entry.id)).toContain(a.data.id);
    expect(nl[0]?.id).toBe(a.data.id);
    expect(nl.map((entry) => entry.id)).not.toContain(b.data.id);

    // 指纹/ID 仍精确召回
    const byId = await errors.search({ query: a.data.id, scope: 'global' });
    expect(byId.map((entry) => entry.id)).toContain(a.data.id);

    // 全是分隔符的 query 视为空，报错
    await expect(errors.search({ query: '  、，  ', scope: 'global' })).rejects.toThrow();
  });

  it('Scene scope 应写入 Scene errorbook', async () => {
    const scene = await scenes.create({ name: 'user-management' });
    const res = await errors.record({
      symptom: 'Scene 内错误',
      root_cause: 'Scene 配置错误',
      fix_action: '修正配置',
      scope: `scene:${scene.data.id}`,
    });

    expect(res.data.scope).toBe(`scene:${scene.data.id}`);
    expect(fs.exists(`.lrnev/scenes/${scene.data.id}/errorbook/incidents/${res.data.id}.md`)).toBe(true);
  });

  it('F-02: errorbook.fingerprint_length 配置应控制记录指纹长度', async () => {
    await fs.writeJson('.lrnev/config/lrnev.json', {
      errorbook: { fingerprint_length: 8 },
    });

    const res = await errors.record({
      symptom: '构建失败',
      root_cause: '缺少环境变量',
      fix_action: '补充 .env 配置',
      scope: 'global',
    });

    expect(res.data.fingerprint).toHaveLength(8);
    expect(res.data.id).toHaveLength(8);
  });
});
