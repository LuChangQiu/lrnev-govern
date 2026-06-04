/**
 * SessionCommit 单元测试。
 *
 * 覆盖批量保存、去重跳过和无效候选跳过。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { dir as tmpDir, type DirectoryResult } from 'tmp-promise';

import { FileStorage } from '../../src/storage/FileStorage.js';
import { ensureWorkspace } from '../../src/storage/WorkspaceLocator.js';
import { SceneManager } from '../../src/core/SceneManager.js';
import { MemoryManager } from '../../src/core/MemoryManager.js';
import { SessionCommit } from '../../src/core/SessionCommit.js';
import { MemoryCategory } from '../../src/types/memory.js';

describe('SessionCommit', () => {
  let workspace: DirectoryResult;
  let fs: FileStorage;
  let commit: SessionCommit;

  beforeEach(async () => {
    workspace = await tmpDir({ unsafeCleanup: true });
    await ensureWorkspace(workspace.path);
    fs = new FileStorage(workspace.path);
    const scenes = new SceneManager(fs);
    commit = new SessionCommit(new MemoryManager(fs, scenes));
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  it('应批量保存候选记忆', async () => {
    const res = await commit.commit({
      summary: '本轮确认了偏好和事实。',
      scope: 'global',
      candidates: [
        {
          category: MemoryCategory.PREFERENCES,
          content: '注释使用中文。',
          source: 'user-message',
        },
        {
          category: MemoryCategory.FACTS,
          content: '项目源码在 product/lrnev-govern。',
          source: 'workspace',
        },
      ],
    });

    expect(res.data.saved).toHaveLength(2);
    expect(res.data.skipped).toHaveLength(0);
  });

  it('重复候选应跳过并返回 similar_to', async () => {
    const res = await commit.commit({
      summary: '重复偏好。',
      candidates: [
        {
          category: MemoryCategory.PREFERENCES,
          content: '注释使用中文。',
          source: 'msg-1',
        },
        {
          category: MemoryCategory.PREFERENCES,
          content: '注释使用中文。',
          source: 'msg-2',
        },
      ],
    });

    expect(res.data.saved).toHaveLength(1);
    expect(res.data.skipped[0]?.reason).toBe('duplicate');
    expect(res.data.skipped[0]?.similar_to).toBe(res.data.saved[0]?.id);
  });

  it('无效候选应跳过', async () => {
    const res = await commit.commit({
      summary: '包含无效候选。',
      candidates: [
        {
          category: MemoryCategory.FACTS,
          content: '有效事实。',
          source: 'msg',
        },
        {
          category: MemoryCategory.FACTS,
          content: '',
          source: '',
        },
      ],
    });

    expect(res.data.saved).toHaveLength(1);
    expect(res.data.skipped[0]?.reason).toBe('invalid');
  });
  it('F-02: memory.max_candidates_per_commit 配置应限制单次候选数量', async () => {
    await fs.writeJson('.lrnev/config/lrnev.json', {
      memory: { max_candidates_per_commit: 1 },
    });

    const res = await commit.commit({
      summary: '候选数量限制。',
      candidates: [
        {
          category: MemoryCategory.FACTS,
          content: '事实一。',
          source: 'msg-1',
        },
        {
          category: MemoryCategory.FACTS,
          content: '事实二。',
          source: 'msg-2',
        },
      ],
    });

    expect(res.data.saved).toHaveLength(1);
    expect(res.data.skipped).toEqual([
      expect.objectContaining({ reason: 'rejected' }),
    ]);
  });
});
