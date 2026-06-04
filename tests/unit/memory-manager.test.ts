/**
 * MemoryManager 单元测试。
 *
 * 覆盖 save / search / forget、source 必填、同类去重、五类目录和 Scene scope。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { dir as tmpDir, type DirectoryResult } from 'tmp-promise';

import { FileStorage } from '../../src/storage/FileStorage.js';
import { ensureWorkspace } from '../../src/storage/WorkspaceLocator.js';
import { SceneManager } from '../../src/core/SceneManager.js';
import { MemoryManager } from '../../src/core/MemoryManager.js';
import { MemoryCategory } from '../../src/types/memory.js';

describe('MemoryManager', () => {
  let workspace: DirectoryResult;
  let fs: FileStorage;
  let scenes: SceneManager;
  let memories: MemoryManager;

  beforeEach(async () => {
    workspace = await tmpDir({ unsafeCleanup: true });
    await ensureWorkspace(workspace.path);
    fs = new FileStorage(workspace.path);
    scenes = new SceneManager(fs);
    memories = new MemoryManager(fs, scenes);
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  it('save 应写入记忆并确保五类目录存在', async () => {
    const res = await memories.save({
      category: MemoryCategory.PREFERENCES,
      content: '注释需要使用中文。',
      source: 'user-message',
      scope: 'global',
    });

    expect(res.data.id).toMatch(/^preferences-/);
    expect(fs.exists(`.lrnev/memory/preferences/${res.data.id}.md`)).toBe(true);
    for (const category of Object.values(MemoryCategory)) {
      expect(fs.exists(`.lrnev/memory/${category}`)).toBe(true);
    }
  });

  it('source 缺失应拒绝保存', async () => {
    await expect(memories.save({
      category: MemoryCategory.FACTS,
      content: '项目使用 MCP。',
      source: '',
      scope: 'global',
    })).rejects.toThrow();
  });

  it('同类别相似内容应去重并返回已有条目', async () => {
    const first = await memories.save({
      category: MemoryCategory.PREFERENCES,
      content: '代码注释需要使用中文',
      source: 'msg-1',
      scope: 'global',
    });
    const second = await memories.save({
      category: MemoryCategory.PREFERENCES,
      content: '代码注释需要使用中文',
      source: 'msg-2',
      scope: 'global',
    });

    expect(second.data.id).toBe(first.data.id);
    expect(second.warnings?.[0]).toContain('相似记忆');
  });

  it('search 应按内容命中', async () => {
    const saved = await memories.save({
      category: MemoryCategory.FACTS,
      content: '项目源码位于 product/lrnev-govern。',
      source: 'workspace',
      scope: 'global',
    });

    const results = await memories.search({ query: 'lrnev-govern', scope: 'global' });
    expect(results[0]?.id).toBe(saved.data.id);
  });

  it('forget 应删除记忆文件', async () => {
    const saved = await memories.save({
      category: MemoryCategory.PATTERNS,
      content: 'Manager 类负责核心业务逻辑。',
      source: 'design.md',
      scope: 'global',
    });

    const res = await memories.forget({
      id: saved.data.id,
      category: MemoryCategory.PATTERNS,
      scope: 'global',
    });
    expect(res.data.deleted).toBe(true);
    expect(fs.exists(`.lrnev/memory/patterns/${saved.data.id}.md`)).toBe(false);
  });

  it('Scene scope 应写入 Scene memory', async () => {
    const scene = await scenes.create({ name: 'user-management' });
    const saved = await memories.save({
      category: MemoryCategory.FACTS,
      content: '用户管理 Scene 负责用户资料。',
      source: 'scene.md',
      scope: `scene:${scene.data.id}`,
    });

    expect(saved.data.scope).toBe(`scene:${scene.data.id}`);
    expect(fs.exists(`.lrnev/scenes/${scene.data.id}/memory/facts/${saved.data.id}.md`)).toBe(true);
  });
  it('F-02: memory.dedup_similarity_threshold 配置应控制去重阈值', async () => {
    await fs.writeJson('.lrnev/config/lrnev.json', {
      memory: { dedup_similarity_threshold: 1 },
    });
    const first = await memories.save({
      category: MemoryCategory.PREFERENCES,
      content: 'alpha beta gamma',
      source: 'msg-1',
      scope: 'global',
    });
    const second = await memories.save({
      category: MemoryCategory.PREFERENCES,
      content: 'alpha beta delta',
      source: 'msg-2',
      scope: 'global',
    });

    expect(second.data.id).not.toBe(first.data.id);
  });
});
