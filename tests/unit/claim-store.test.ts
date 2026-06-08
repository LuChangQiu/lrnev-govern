import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { dir as tmpDir, type DirectoryResult } from 'tmp-promise';

import { ClaimStore } from '../../src/core/ClaimStore.js';
import { FileStorage } from '../../src/storage/FileStorage.js';
import { ensureWorkspace } from '../../src/storage/WorkspaceLocator.js';
import type { TaskClaim, TaskClaimResult } from '../../src/types/claim.js';

describe('ClaimStore', () => {
  let workspace: DirectoryResult;
  let fs: FileStorage;
  let claims: ClaimStore;

  beforeEach(async () => {
    workspace = await tmpDir({ unsafeCleanup: true });
    await ensureWorkspace(workspace.path);
    fs = new FileStorage(workspace.path);
    claims = new ClaimStore(fs);
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  it('claims and releases a task claim', async () => {
    const claimed = await claims.claim({
      scene: '00-default',
      spec: '01-00-login',
      task: 'T-001',
      agent_id: 'agent-a',
      touches_files: ['src/auth.ts', 'src/auth.ts'],
    });

    expect(claimed.claimed).toBe(true);
    expect(claimed.claim).toMatchObject({
      scene: '00-default',
      spec: '01-00-login',
      task: 'T-001',
      claimed_by: 'agent-a',
      touches_files: ['src/auth.ts'],
    });
    expect(await claims.listActive()).toEqual([expect.objectContaining({ claimed_by: 'agent-a' })]);

    const released = await claims.release({
      scene: '00-default',
      spec: '01-00-login',
      task: 'T-001',
      agent_id: 'agent-a',
    });

    expect(released.released).toBe(true);
    expect(await claims.listActive()).toEqual([]);
  });

  it('returns a soft conflict when another active agent already claimed the task', async () => {
    await claims.claim({
      scene: '00-default',
      spec: '01-00-login',
      task: 'T-001',
      agent_id: 'agent-a',
    });

    const result = await claims.claim({
      scene: '00-default',
      spec: '01-00-login',
      task: 'T-001',
      agent_id: 'agent-b',
    });

    expect(result.claimed).toBe(false);
    expect(result.conflict).toMatchObject({ claimed_by: 'agent-a' });
    expect(await claims.listActive()).toEqual([expect.objectContaining({ claimed_by: 'agent-a' })]);
  });

  it('returns touches_files overlaps without blocking different task claims', async () => {
    await claims.claim({
      scene: '00-default',
      spec: '01-00-login',
      task: 'T-001',
      agent_id: 'agent-a',
      touches_files: ['src/auth.ts', 'src/session.ts'],
    });

    const result = await claims.claim({
      scene: '00-default',
      spec: '01-00-login',
      task: 'T-002',
      agent_id: 'agent-b',
      touches_files: ['src/auth.ts', 'src/profile.ts'],
    });

    expect(result.claimed).toBe(true);
    expect(result.overlaps).toEqual([
      {
        scene: '00-default',
        spec: '01-00-login',
        task: 'T-001',
        claimed_by: 'agent-a',
        touches_files: ['src/auth.ts'],
      },
    ]);
  });

  it('serializes concurrent claims so only one agent becomes the holder', async () => {
    const results = await Promise.all([
      claims.claim({ scene: '00-default', spec: '01-00-login', task: 'T-001', agent_id: 'agent-a' }),
      claims.claim({ scene: '00-default', spec: '01-00-login', task: 'T-001', agent_id: 'agent-b' }),
    ]);

    expect(results.filter((result) => result.claimed)).toHaveLength(1);
    expect(results.filter((result) => !result.claimed && result.conflict)).toHaveLength(1);
    const active = await claims.listActive();
    expect(active).toHaveLength(1);
    expect(active[0]?.claimed_by).toBe(results.find((result) => result.claimed)?.claim.claimed_by);
  });

  it('filters expired claims from listActive but allows a new claim', async () => {
    await fs.writeJson('.lrnev/runtime/claims/00-default__01-00-login__T-001.json', {
      scene: '00-default',
      spec: '01-00-login',
      task: 'T-001',
      claimed_by: 'agent-old',
      claimed_at: '2026-01-01T00:00:00.000Z',
      expires_at: '2026-01-01T00:00:01.000Z',
    } satisfies TaskClaim);

    expect(await claims.listActive()).toEqual([]);

    const result = await claims.claim({
      scene: '00-default',
      spec: '01-00-login',
      task: 'T-001',
      agent_id: 'agent-new',
    });

    expect(result.claimed).toBe(true);
    expect(result.conflict).toMatchObject({ claimed_by: 'agent-old' });
    expect(await claims.listActive()).toEqual([expect.objectContaining({ claimed_by: 'agent-new' })]);
  });

  it('does not release claims owned by another agent', async () => {
    await claims.claim({
      scene: '00-default',
      spec: '01-00-login',
      task: 'T-001',
      agent_id: 'agent-a',
    });

    const released = await claims.release({
      scene: '00-default',
      spec: '01-00-login',
      task: 'T-001',
      agent_id: 'agent-b',
    });

    expect(released.released).toBe(false);
    expect(await claims.listActive()).toEqual([expect.objectContaining({ claimed_by: 'agent-a' })]);
  });

  it('F-02: claim.max_ttl_seconds 配置应限制 task claim 租约上限', async () => {
    await fs.writeJson('.lrnev/config/lrnev.json', {
      claim: { max_ttl_seconds: 2 },
    });

    await expect(claims.claim({
      scene: '00-default',
      spec: '01-00-login',
      task: 'T-001',
      agent_id: 'agent-a',
      ttl_seconds: 3,
    })).rejects.toThrow();
  });

  it('refreshForAgent extends active claims for that agent only', async () => {
    const a = await claims.claim({
      scene: '00-default',
      spec: '01-00-login',
      task: 'T-001',
      agent_id: 'agent-a',
      ttl_seconds: 1,
    });
    const b = await claims.claim({
      scene: '00-default',
      spec: '02-00-profile',
      task: 'T-001',
      agent_id: 'agent-b',
      ttl_seconds: 1,
    });

    const refreshed = await claims.refreshForAgent('agent-a');

    expect(refreshed).toHaveLength(1);
    expect(refreshed[0]?.claimed_by).toBe('agent-a');
    expect(refreshed[0]?.expires_at.localeCompare(a.claim.expires_at)).toBeGreaterThan(0);
    expect((await claims.listActive()).find((claim) => claim.claimed_by === 'agent-b')?.expires_at).toBe(b.claim.expires_at);
  });

  it('F-08: claim 写入锁与 tasks.md 物理写锁应互不干扰', async () => {
    let result: TaskClaimResult | undefined;
    await fs.withDirectoryLock('.lrnev/locks/tasks-00-default-01-00-login.lockdir', async () => {
      result = await claims.claim({
        scene: '00-default',
        spec: '01-00-login',
        task: 'T-001',
        agent_id: 'agent-a',
      });
    });

    expect(result).toMatchObject({ claimed: true, claim: { claimed_by: 'agent-a' } });
  });

  it('F-04: 属主 agent 已死时他人可立即接手(无需等 TTL)', async () => {
    const dead = new Set(['agent-dead']);
    const store = new ClaimStore(fs, async (id) => dead.has(id));
    await store.claim({ scene: '00-default', spec: '01-00-login', task: 'T-001', agent_id: 'agent-dead' });

    const res = await store.claim({ scene: '00-default', spec: '01-00-login', task: 'T-001', agent_id: 'agent-b' });

    expect(res.claimed).toBe(true);
    expect(res.conflict).toMatchObject({ claimed_by: 'agent-dead' });
    expect(await store.listActive()).toEqual([expect.objectContaining({ claimed_by: 'agent-b' })]);
  });

  it('F-04: 属主 agent 仍活时他人被拒', async () => {
    const store = new ClaimStore(fs, async () => false);
    await store.claim({ scene: '00-default', spec: '01-00-login', task: 'T-001', agent_id: 'agent-a' });

    const res = await store.claim({ scene: '00-default', spec: '01-00-login', task: 'T-001', agent_id: 'agent-b' });

    expect(res.claimed).toBe(false);
    expect(res.conflict).toMatchObject({ claimed_by: 'agent-a' });
  });

  it('F-04: 属主已死的 claim 不计入 listActive,但 listAll 仍可见文件', async () => {
    const dead = new Set(['agent-dead']);
    const store = new ClaimStore(fs, async (id) => dead.has(id));
    await store.claim({ scene: '00-default', spec: '01-00-login', task: 'T-001', agent_id: 'agent-dead' });

    expect(await store.listActive()).toEqual([]);
    expect(await store.listAll()).toHaveLength(1);
  });

  it('F-02: releaseAllByAgent 只删除指定 agent 的 claim', async () => {
    await claims.claim({ scene: '00-default', spec: '01-00-login', task: 'T-001', agent_id: 'agent-a' });
    await claims.claim({ scene: '00-default', spec: '01-00-login', task: 'T-002', agent_id: 'agent-a' });
    await claims.claim({ scene: '00-default', spec: '01-00-login', task: 'T-003', agent_id: 'agent-b' });

    const released = await claims.releaseAllByAgent('agent-a');

    expect(released).toHaveLength(2);
    expect(await claims.listAll()).toEqual([expect.objectContaining({ claimed_by: 'agent-b' })]);
  });
});
