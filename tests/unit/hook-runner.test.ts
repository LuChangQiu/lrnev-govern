import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { dir as tmpDir, type DirectoryResult } from 'tmp-promise';

import { HookManager } from '../../src/core/HookManager.js';
import { FileStorage } from '../../src/storage/FileStorage.js';
import { ensureWorkspace } from '../../src/storage/WorkspaceLocator.js';
import { isLrnevError } from '../../src/shared/errors.js';

describe('HookRunner / HookManager.trigger', () => {
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

  it('sync hook 成功时应阻塞并写入日志', async () => {
    await fs.writeJson('.lrnev/config/hooks.json', [{
      name: 'sync-ok',
      event: 'task.create',
      command: ['node', '-e', 'console.log(process.env.LRNEV_EVENT + ":" + JSON.parse(process.env.LRNEV_PAYLOAD).task_id)'],
      mode: 'sync',
    }]);

    const result = await hooks.trigger('task.create', { task_id: 'T-001' });
    const records = await hooks.readRecentRecords(1);

    expect(result.matched).toBe(1);
    expect(result.warnings).toEqual([]);
    expect(records[0]).toMatchObject({
      hook: 'sync-ok',
      event: 'task.create',
      mode: 'sync',
      status: 'success',
      exit_code: 0,
    });
    expect(records[0]?.stdout_tail).toContain('task.create:T-001');
  });

  it('sync warn 失败时应继续并返回 warning', async () => {
    await fs.writeJson('.lrnev/config/hooks.json', [{
      name: 'sync-warn',
      event: 'task.update.completed',
      command: ['node', '-e', 'process.exit(2)'],
      mode: 'sync',
      on_failure: 'warn',
    }]);

    const result = await hooks.trigger('task.update.completed', {});

    expect(result.warnings.join('\n')).toContain('sync-warn');
    expect((await hooks.readRecentRecords(1))[0]?.status).toBe('failed');
  });

  it('sync abort 失败时应抛 HOOK_FAILED', async () => {
    await fs.writeJson('.lrnev/config/hooks.json', [{
      name: 'sync-abort',
      event: 'task.update.failed',
      command: ['node', '-e', 'process.exit(3)'],
      mode: 'sync',
      on_failure: 'abort',
    }]);

    try {
      await hooks.trigger('task.update.failed', {});
      expect.fail('should throw');
    } catch (err) {
      expect(isLrnevError(err)).toBe(true);
      if (isLrnevError(err)) expect(err.code).toBe('HOOK_FAILED');
    }
  });

  it('async hook 应立即返回并最终写入日志', async () => {
    await fs.writeJson('.lrnev/config/hooks.json', [{
      name: 'async-ok',
      event: 'task.update.*',
      command: ['node', '-e', 'console.log("done")'],
      mode: 'async',
    }]);

    const result = await hooks.trigger('task.update.completed', {});

    expect(result.matched).toBe(1);
    expect(await hooks.readRecentRecords(1)).toEqual([]);
    await waitFor(async () => (await hooks.readRecentRecords(1))[0]?.hook === 'async-ok');
    expect((await hooks.readRecentRecords(1))[0]).toMatchObject({
      hook: 'async-ok',
      mode: 'async',
      status: 'success',
    });
  });

  it('sync hook 超时时应记录 timeout 并按 warn 返回', async () => {
    await fs.writeJson('.lrnev/config/hooks.json', [{
      name: 'timeout-hook',
      event: 'task.create',
      command: ['node', '-e', 'for (;;) {}'],
      mode: 'sync',
      timeout_ms: 50,
      on_failure: 'warn',
    }]);

    const result = await hooks.trigger('task.create', {});
    const latest = (await hooks.readRecentRecords(1))[0];

    expect(result.warnings.join('\n')).toContain('timeout-hook');
    expect(latest?.status).toBe('timeout');
  });

  it('字符串命令应通过平台 shell 执行', async () => {
    await fs.writeJson('.lrnev/config/hooks.json', [{
      name: 'shell-form',
      event: 'task.create',
      command: process.platform === 'win32' ? 'echo %LRNEV_HOOK_NAME%' : 'printf "$LRNEV_HOOK_NAME"',
      mode: 'sync',
    }]);

    await hooks.trigger('task.create', {});
    expect((await hooks.readRecentRecords(1))[0]?.stdout_tail).toContain('shell-form');
  });

  it('cwd 应在工作区内生效', async () => {
    await fs.mkdir('subdir');
    await fs.writeJson('.lrnev/config/hooks.json', [{
      name: 'cwd-hook',
      event: 'task.create',
      command: ['node', '-e', 'console.log(process.cwd().endsWith("subdir"))'],
      mode: 'sync',
      cwd: 'subdir',
    }]);

    await hooks.trigger('task.create', {});
    expect((await hooks.readRecentRecords(1))[0]?.stdout_tail).toContain('true');
  });

  it('F-02: hooks.output_tail_bytes 配置应控制 hook 输出截断长度', async () => {
    await fs.writeJson('.lrnev/config/lrnev.json', {
      hooks: { output_tail_bytes: 3 },
    });
    await fs.writeJson('.lrnev/config/hooks.json', [{
      name: 'tail-hook',
      event: 'task.create',
      command: ['node', '-e', 'process.stdout.write("abcdef")'],
      mode: 'sync',
    }]);

    await hooks.trigger('task.create', {});

    expect((await hooks.readRecentRecords(1))[0]?.stdout_tail).toBe('def');
  });
});

async function waitFor(check: () => Promise<boolean>): Promise<void> {
  for (let i = 0; i < 5000; i++) {
    if (await check()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  throw new Error('condition not met');
}
