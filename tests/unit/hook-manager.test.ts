import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { dir as tmpDir, type DirectoryResult } from 'tmp-promise';

import { HookManager, eventMatches } from '../../src/core/HookManager.js';
import { FileStorage } from '../../src/storage/FileStorage.js';
import { ensureWorkspace } from '../../src/storage/WorkspaceLocator.js';

describe('HookManager', () => {
  let workspace: DirectoryResult;
  let fs: FileStorage;
  let hooks: HookManager;

  beforeEach(async () => {
    workspace = await tmpDir({ unsafeCleanup: true });
    await ensureWorkspace(workspace.path);
    fs = new FileStorage(workspace.path);
    hooks = new HookManager(fs);
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  it('list 应读取 hooks.json 并补齐配置默认值', async () => {
    await fs.writeJson('.lrnev/config/lrnev.json', {
      hooks: { default_timeout_ms: 1234 },
    });
    await fs.writeJson('.lrnev/config/hooks.json', [
      {
        name: 'commit-task',
        event: 'task.update.completed',
        command: ['git', 'status'],
      },
    ]);

    const res = await hooks.list();

    expect(res.ok).toBe(true);
    expect(res.data.implemented).toBe(true);
    expect(res.data.hooks).toEqual([
      expect.objectContaining({
        name: 'commit-task',
        event: 'task.update.completed',
        command: ['git', 'status'],
        timeout_ms: 1234,
        mode: 'async',
        enabled: true,
        env: {},
        on_failure: 'warn',
      }),
    ]);
  });

  it('无 hooks.json 时应返回空配置且保持向后兼容', async () => {
    const res = await hooks.list();

    expect(res.ok).toBe(true);
    expect(res.data.hooks).toEqual([]);
    expect(res.data.issues).toEqual([]);
  });

  it('非法条目应跳过并保留合法条目', async () => {
    await fs.writeJson('.lrnev/config/hooks.json', [
      {
        name: 'valid-hook',
        event: 'task.update.*',
        command: ['node', '-v'],
      },
      {
        name: 'Bad Name',
        event: 'task.update.completed',
        command: [],
      },
    ]);

    const res = await hooks.list();

    expect(res.ok).toBe(true);
    expect(res.data.hooks.map((hook) => hook.name)).toEqual(['valid-hook']);
    expect(res.data.issues.length).toBeGreaterThan(0);
    expect(res.warnings?.join('\n')).toContain('hooks.json 配置无效');
  });

  it('重复 name 应只保留第一条并记录 issue', async () => {
    await fs.writeJson('.lrnev/config/hooks.json', [
      { name: 'same-hook', event: 'task.create', command: ['node', '-v'] },
      { name: 'same-hook', event: 'task.update.completed', command: ['node', '-v'] },
    ]);

    const res = await hooks.list();

    expect(res.data.hooks).toHaveLength(1);
    expect(res.data.issues[0]?.message).toContain('重复');
  });

  it('cwd 含父目录跳转时应拒绝该条配置', async () => {
    await fs.writeJson('.lrnev/config/hooks.json', [
      {
        name: 'bad-cwd',
        event: 'task.create',
        command: ['node', '-v'],
        cwd: '../outside',
      },
    ]);

    const res = await hooks.list();

    expect(res.data.hooks).toEqual([]);
    expect(res.data.issues[0]?.message).toContain('cwd 越出工作区');
  });

  it('eventMatches 应支持精确匹配和前缀通配', () => {
    expect(eventMatches('task.update.completed', 'task.update.completed')).toBe(true);
    expect(eventMatches('task.update.*', 'task.update.failed')).toBe(true);
    expect(eventMatches('task.update.*', 'task.create')).toBe(false);
  });

  it('F-02: hooks.recent_list_limit 配置应控制默认日志读取数量', async () => {
    await fs.writeJson('.lrnev/config/lrnev.json', {
      hooks: { recent_list_limit: 1 },
    });
    await fs.write('.lrnev/state/hook-log.jsonl', [
      JSON.stringify(hookRecord('one')),
      JSON.stringify(hookRecord('two')),
      '',
    ].join('\n'));

    const res = await hooks.tailLog();

    expect(res.data.map((item) => item.hook)).toEqual(['two']);
  });
});

function hookRecord(hook: string) {
  return {
    ts: '2026-06-02T00:00:00.000Z',
    event: 'task.create',
    hook,
    mode: 'sync',
    status: 'success',
    duration_ms: 1,
    exit_code: 0,
    stdout_tail: 'ok',
    stderr_tail: '',
  };
}
