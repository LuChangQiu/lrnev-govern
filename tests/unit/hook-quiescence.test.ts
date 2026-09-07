import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { dir as tmpDir, type DirectoryResult } from 'tmp-promise';

import { HookManager } from '../../src/core/HookManager.js';
import { DetachedHookTracker } from '../../src/core/DetachedHookTracker.js';
import { FileStorage } from '../../src/storage/FileStorage.js';
import { ensureWorkspace } from '../../src/storage/WorkspaceLocator.js';
import type { HookRecord } from '../../src/types/hooks.js';

/**
 * ADR-0003「Hook Drain 边界与超时策略」验收：
 * - (a) async hook 先写 invoked 再跑子进程（触发证据不丢）
 * - (b) drain 等待在飞链完成（success 落库）
 * - (c) drain 超时补写 timed_out（用户能看到"被触发但未完成"）
 * - (d) drain 幂等：重复调用不抛错、不重复补写
 *
 * hook 命令统一用 process.execPath 起 node 子进程（跨平台）；
 * 时长参数化（sleep/drain 都是几十~几百 ms），整组测试控制在数秒内。
 */

describe('hook quiescence（ADR-0003 drain 边界与超时策略）', () => {
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

  /** 写一个 async 测试 hook：sleepMs 后以 0 退出。 */
  async function writeSleepHook(name: string, sleepMs: number): Promise<void> {
    await fs.writeJson('.lrnev/config/hooks.json', [{
      name,
      event: 'task.update.*',
      command: [process.execPath, '-e', `setTimeout(() => process.exit(0), ${sleepMs})`],
      mode: 'async',
      timeout_ms: 60_000, // 别让 hook 自身超时干扰 drain 语义
    }]);
  }

  function recordsOf(records: HookRecord[], hook: string): HookRecord[] {
    return records.filter((record) => record.hook === hook);
  }

  it('(a) async hook 触发后先落 invoked 记录，drain 等链完成后出现 success', async () => {
    await writeSleepHook('quiesce-invoked', 500);

    const result = await hooks.trigger('task.update.completed', {});
    expect(result.matched).toBe(1);

    // invoked 是"触发证据"，先于子进程结束出现；此刻 success 尚未落库
    await waitFor(async () => {
      const records = await hooks.readRecentRecords(20);
      return recordsOf(records, 'quiesce-invoked').some((record) => record.status === 'invoked');
    });
    const invoked = (await hooks.readRecentRecords(20))
      .find((record) => record.hook === 'quiesce-invoked' && record.status === 'invoked');
    expect(invoked).toMatchObject({
      event: 'task.update.completed', // 触发原事件，与终态记录一致
      mode: 'async',
      status: 'invoked',
      duration_ms: 0,
    });
    expect(invoked?.exit_code).toBeUndefined(); // 尚无进程退出码

    // 短 drain 等链完成 → 随后出现 success；顺序 invoked → success（先写保证）
    await hooks.drainDetached(2000);
    const statuses = recordsOf(await hooks.readRecentRecords(20), 'quiesce-invoked')
      .map((record) => record.status);
    expect(statuses).toEqual(['invoked', 'success']);
  });

  it('(b) drain 应等待在飞链完成：hook 300ms 完成，drain(2000) 后日志含 success', async () => {
    await writeSleepHook('quiesce-waited', 300);

    await hooks.trigger('task.update.completed', {});
    const started = Date.now();
    await hooks.drainDetached(2000);

    // drain 真正等待了链 settle（而非立即返回）
    expect(Date.now() - started).toBeGreaterThanOrEqual(250);

    const records = recordsOf(await hooks.readRecentRecords(20), 'quiesce-waited');
    expect(records.map((record) => record.status)).toEqual(['invoked', 'success']);
    expect(records[1]).toMatchObject({ status: 'success', mode: 'async', exit_code: 0 });
  });

  it('(c) drain 超时应对仍 pending 的链补写 timed_out（事件保留原事件）', async () => {
    await writeSleepHook('quiesce-slow', 700);

    await hooks.trigger('task.update.completed', {});
    const started = Date.now();
    await hooks.drainDetached(100); // 100ms 远小于 hook 的 700ms

    expect(Date.now() - started).toBeLessThan(400); // 不被长 hook 拖住

    const timedOut = (await hooks.readRecentRecords(20))
      .filter((record) => record.hook === 'quiesce-slow' && record.status === 'timed_out');
    expect(timedOut).toHaveLength(1);
    expect(timedOut[0]).toMatchObject({
      // event 语义（实现偏离 ADR 草案的 'drain'）：保留触发原事件便于 tail-log 按事件过滤
      event: 'task.update.completed',
      mode: 'async',
      status: 'timed_out',
    });
    expect(timedOut[0]?.exit_code).toBeUndefined();
    expect(timedOut[0]?.stderr_tail).toContain('drain');
    expect(timedOut[0]?.duration_ms).toBeGreaterThanOrEqual(0);

    // 链本身仍在跑：等它自然完成后应有终态记录（drain 后 tracker 仍可再次等待）
    await waitFor(async () => {
      const records = await hooks.readRecentRecords(20);
      return recordsOf(records, 'quiesce-slow').some((record) => record.status === 'success');
    });
    const statuses = recordsOf(await hooks.readRecentRecords(20), 'quiesce-slow')
      .map((record) => record.status);
    // 触发证据 → 超时补写 → 实际完成，三段都可排查
    expect(statuses).toEqual(['invoked', 'timed_out', 'success']);
  });

  it('(d) 连续两次 drain 幂等：不抛错、不重复补写', async () => {
    await writeSleepHook('quiesce-idempotent', 700);

    await hooks.trigger('task.update.completed', {});
    await expect(hooks.drainDetached(80)).resolves.toBeUndefined();
    await expect(hooks.drainDetached(80)).resolves.toBeUndefined();

    const timedOut = (await hooks.readRecentRecords(20))
      .filter((record) => record.hook === 'quiesce-idempotent' && record.status === 'timed_out');
    expect(timedOut).toHaveLength(1); // 第二次 drain 不重复补写

    // 清理：等链自然完成，避免 afterEach 清理时子进程还在跑
    await waitFor(async () => {
      const records = await hooks.readRecentRecords(20);
      return recordsOf(records, 'quiesce-idempotent').some((record) => record.status === 'success');
    });
  });
});

describe('DetachedHookTracker（纯单测：并发共享、幂等与复用）', () => {
  it('并发 drain 共享同一次等待；超时补写每链一次', async () => {
    const reported: string[] = [];
    const tracker = new DetachedHookTracker({
      onTimedOut: (pending) => { for (const item of pending) reported.push(item.name); },
    });

    // 一条由测试释放的链
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    tracker.track('slow', 'task.create', gate);

    // 第一次 drain 进行中再发起第二次（50ms）：应并入同一次 400ms 等待，
    // 而不是被 50ms 单独放行提前返回
    const first = tracker.drain(400);
    await sleep(60);
    const secondStarted = Date.now();
    await tracker.drain(50);
    expect(Date.now() - secondStarted).toBeGreaterThanOrEqual(300);
    await first;

    // 超时补写只发生一次（并发/重复 drain 均不重复）
    expect(reported).toEqual(['slow']);

    // 超时补写后释放链：后续 drain 走 settle 分支，不再补写
    release();
    await tracker.drain(500);
    expect(reported).toEqual(['slow']);
    expect(tracker.size).toBe(0);
  });

  it('track 的链 settle 后自动移除；drain 后 tracker 仍可复用', async () => {
    const reported: string[] = [];
    const tracker = new DetachedHookTracker({
      onTimedOut: (pending) => { for (const item of pending) reported.push(item.name); },
    });

    tracker.track('gone', 'task.create', Promise.resolve());
    await sleep(10); // 让 settle 移除先跑
    await tracker.drain(30);
    expect(tracker.size).toBe(0);
    expect(reported).toEqual([]);

    // 复用：新链进入下一次 drain（正常 settle，不补写）
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    tracker.track('fast', 'task.create', gate);
    release();
    await tracker.drain(500);
    expect(reported).toEqual([]);
    expect(tracker.size).toBe(0);

    // 空 tracker drain 立即返回
    await expect(tracker.drain()).resolves.toBeUndefined();
  });
});

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(check: () => Promise<boolean>, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('waitFor 条件超时未满足');
}
