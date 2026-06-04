import { gunzip } from 'node:zlib';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { dir as tmpDir, type DirectoryResult } from 'tmp-promise';

import { HookLog } from '../../src/core/HookLog.js';
import { HOOK_LOG_REL } from '../../src/core/HookManager.js';
import { FileStorage } from '../../src/storage/FileStorage.js';
import { ensureWorkspace } from '../../src/storage/WorkspaceLocator.js';
import type { HookRecord } from '../../src/types/hooks.js';

const unzip = promisify(gunzip);

describe('HookLog', () => {
  let workspace: DirectoryResult;
  let fs: FileStorage;

  beforeEach(async () => {
    workspace = await tmpDir({ unsafeCleanup: true });
    await ensureWorkspace(workspace.path);
    fs = new FileStorage(workspace.path);
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  it('append 后 tail 应读出最近记录', async () => {
    const log = new HookLog(fs);
    await log.append(record('task.create', 'one'));
    await log.append(record('task.update.completed', 'two'));

    expect((await log.tail(1)).map((item) => item.hook)).toEqual(['two']);
    expect((await log.tail(5)).map((item) => item.hook)).toEqual(['one', 'two']);
  });

  it('达到阈值时应 rotate 为 gzip 并清空当前 log', async () => {
    const log = new HookLog(fs, 10);
    await fs.write(HOOK_LOG_REL, `${JSON.stringify(record('task.create', 'old'))}\n`);

    await log.append(record('task.create', 'new'));

    const rotated = await fs.list('.lrnev/state/hook-log.*.jsonl.gz');
    expect(rotated).toHaveLength(1);
    const zipped = await readFile(fs.abs(rotated[0]!));
    const unzipped = (await unzip(zipped)).toString('utf-8');
    expect(unzipped).toContain('"hook":"old"');
    expect(await log.tail(10)).toEqual([expect.objectContaining({ hook: 'new' })]);
  });

  it('F-02: hooks.log_rotate_bytes 配置应控制默认轮转阈值', async () => {
    await fs.writeJson('.lrnev/config/lrnev.json', {
      hooks: { log_rotate_bytes: 10 },
    });
    const log = new HookLog(fs);
    await fs.write(HOOK_LOG_REL, `${JSON.stringify(record('task.create', 'old'))}\n`);

    await log.append(record('task.create', 'new'));

    const rotated = await fs.list('.lrnev/state/hook-log.*.jsonl.gz');
    expect(rotated).toHaveLength(1);
  });
});

function record(event: string, hook: string): HookRecord {
  return {
    ts: '2026-06-02T00:00:00.000Z',
    event,
    hook,
    mode: 'sync',
    status: 'success',
    duration_ms: 1,
    exit_code: 0,
    stdout_tail: 'ok',
    stderr_tail: '',
  };
}
