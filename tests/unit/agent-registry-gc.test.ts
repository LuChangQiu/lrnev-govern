import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { dir as tmpDir, type DirectoryResult } from 'tmp-promise';
import { hostname } from 'node:os';

import { AgentRegistry, AGENT_REGISTRY_REL } from '../../src/core/AgentRegistry.js';
import { FileStorage } from '../../src/storage/FileStorage.js';
import { ensureWorkspace } from '../../src/storage/WorkspaceLocator.js';

describe('AgentRegistry 机会式 GC（scene 03 / 01-00-auto-gc）', () => {
  let workspace: DirectoryResult;
  let fs: FileStorage;
  let registry: AgentRegistry;

  const DAY = 24 * 60 * 60 * 1000;
  const isoAgo = (ms: number) => new Date(Date.now() - ms).toISOString();

  function mkAgent(id: string, overrides: Partial<{
    pid: number;
    host: string;
    last_heartbeat: string;
    status: 'active' | 'dead';
  }> = {}) {
    return {
      agent_id: id,
      pid: overrides.pid ?? process.pid,
      host: overrides.host ?? hostname(),
      started_at: isoAgo(10 * DAY),
      last_heartbeat: overrides.last_heartbeat ?? new Date().toISOString(),
      status: overrides.status ?? ('active' as const),
    };
  }

  function mkClaim(task: string, claimedBy: string, expiresAt: string) {
    return {
      scene: '01-s',
      spec: '01-00-x',
      task,
      claimed_by: claimedBy,
      claimed_at: isoAgo(DAY),
      expires_at: expiresAt,
    };
  }

  const claimRel = (task: string) => `.lrnev/runtime/claims/01-s__01-00-x__${task}.json`;

  beforeEach(async () => {
    workspace = await tmpDir({ unsafeCleanup: true });
    await ensureWorkspace(workspace.path);
    fs = new FileStorage(workspace.path);
    registry = new AgentRegistry(fs);
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  it('F-01: 本机 pid 判死且无未过期 claim 的记录 register 时立即清理', async () => {
    await fs.writeJson(AGENT_REGISTRY_REL, {
      'dead-local': mkAgent('dead-local', { pid: 2 ** 30 }),
    });

    const res = await registry.register({ agent_id: 'newcomer' });

    const raw = await fs.readJson<Record<string, unknown>>(AGENT_REGISTRY_REL);
    expect(Object.keys(raw).sort()).toEqual(['newcomer']);
    expect(res.data.gc).toEqual({ removed_agents: 1, removed_claims: 0 });
  });

  it('F-01: 跨主机心跳判死但未超保留期的记录保留，status 回写 dead', async () => {
    await fs.writeJson(AGENT_REGISTRY_REL, {
      'remote-recent': mkAgent('remote-recent', { host: 'other-host', last_heartbeat: isoAgo(DAY) }),
    });

    const res = await registry.register({ agent_id: 'newcomer' });

    const raw = await fs.readJson<Record<string, { status: string }>>(AGENT_REGISTRY_REL);
    expect(Object.keys(raw).sort()).toEqual(['newcomer', 'remote-recent']);
    expect(raw['remote-recent']!.status).toBe('dead');
    expect(res.data.gc).toBeUndefined();
  });

  it('F-01: 跨主机心跳判死且超保留期、无未过期 claim 的记录被清理', async () => {
    await fs.writeJson(AGENT_REGISTRY_REL, {
      'remote-stale': mkAgent('remote-stale', { host: 'other-host', last_heartbeat: isoAgo(8 * DAY) }),
    });

    const res = await registry.register({ agent_id: 'newcomer' });

    const raw = await fs.readJson<Record<string, unknown>>(AGENT_REGISTRY_REL);
    expect(Object.keys(raw).sort()).toEqual(['newcomer']);
    expect(res.data.gc).toEqual({ removed_agents: 1, removed_claims: 0 });
  });

  it('F-01: 死 agent 名下仍有未过期 claim 时记录与 claim 均保留', async () => {
    await fs.writeJson(AGENT_REGISTRY_REL, {
      'dead-with-claim': mkAgent('dead-with-claim', { pid: 2 ** 30 }),
    });
    await fs.writeJson(claimRel('T-001'), mkClaim('T-001', 'dead-with-claim', isoAgo(-60_000)));

    const res = await registry.register({ agent_id: 'newcomer' });

    const raw = await fs.readJson<Record<string, { status: string }>>(AGENT_REGISTRY_REL);
    expect(Object.keys(raw).sort()).toEqual(['dead-with-claim', 'newcomer']);
    expect(raw['dead-with-claim']!.status).toBe('dead');
    expect(fs.exists(claimRel('T-001'))).toBe(true);
    expect(res.data.gc).toBeUndefined();
  });

  it('F-01: active 记录不被清理', async () => {
    await fs.writeJson(AGENT_REGISTRY_REL, {
      alive: mkAgent('alive', { pid: process.pid }),
    });

    await registry.register({ agent_id: 'newcomer' });

    const raw = await fs.readJson<Record<string, unknown>>(AGENT_REGISTRY_REL);
    expect(Object.keys(raw).sort()).toEqual(['alive', 'newcomer']);
  });

  it('F-02: 本机死属主的过期 claim 立即删除（agent 记录被清时一并计数）', async () => {
    await fs.writeJson(AGENT_REGISTRY_REL, {
      'dead-local': mkAgent('dead-local', { pid: 2 ** 30 }),
    });
    await fs.writeJson(claimRel('T-001'), mkClaim('T-001', 'dead-local', isoAgo(60_000)));

    const res = await registry.register({ agent_id: 'newcomer' });

    expect(fs.exists(claimRel('T-001'))).toBe(false);
    expect(res.data.gc).toEqual({ removed_agents: 1, removed_claims: 1 });
  });

  it('F-02: 本机死属主（因持未过期 claim 而保留）的过期 claim 也删除', async () => {
    await fs.writeJson(AGENT_REGISTRY_REL, {
      'dead-mixed': mkAgent('dead-mixed', { pid: 2 ** 30 }),
    });
    await fs.writeJson(claimRel('T-001'), mkClaim('T-001', 'dead-mixed', isoAgo(-60_000)));
    await fs.writeJson(claimRel('T-002'), mkClaim('T-002', 'dead-mixed', isoAgo(60_000)));

    const res = await registry.register({ agent_id: 'newcomer' });

    expect(fs.exists(claimRel('T-001'))).toBe(true);
    expect(fs.exists(claimRel('T-002'))).toBe(false);
    const raw = await fs.readJson<Record<string, unknown>>(AGENT_REGISTRY_REL);
    expect(Object.keys(raw).sort()).toEqual(['dead-mixed', 'newcomer']);
    expect(res.data.gc).toEqual({ removed_agents: 0, removed_claims: 1 });
  });

  it('F-02: 未注册属主的过期 claim 超保留期删除、未超保留期保留', async () => {
    await fs.writeJson(claimRel('T-001'), mkClaim('T-001', 'ghost', isoAgo(8 * DAY)));
    await fs.writeJson(claimRel('T-002'), mkClaim('T-002', 'ghost', isoAgo(60 * 60 * 1000)));

    const res = await registry.register({ agent_id: 'newcomer' });

    expect(fs.exists(claimRel('T-001'))).toBe(false);
    expect(fs.exists(claimRel('T-002'))).toBe(true);
    expect(res.data.gc).toEqual({ removed_agents: 0, removed_claims: 1 });
  });

  it('F-02: 未过期 claim 一律不动（含未注册属主）', async () => {
    await fs.writeJson(claimRel('T-001'), mkClaim('T-001', 'ghost', isoAgo(-60_000)));

    await registry.register({ agent_id: 'newcomer' });

    expect(fs.exists(claimRel('T-001'))).toBe(true);
  });

  it('F-03: 幸存条目 status 回写计算真值且字段结构不变（旧版可解析）', async () => {
    await fs.writeJson(AGENT_REGISTRY_REL, {
      'dead-with-claim': mkAgent('dead-with-claim', { pid: 2 ** 30, status: 'active' }),
    });
    await fs.writeJson(claimRel('T-001'), mkClaim('T-001', 'dead-with-claim', isoAgo(-60_000)));

    await registry.register({ agent_id: 'newcomer' });

    const raw = await fs.readJson<Record<string, Record<string, unknown>>>(AGENT_REGISTRY_REL);
    const survivor = raw['dead-with-claim']!;
    expect(survivor.status).toBe('dead');
    for (const field of ['agent_id', 'pid', 'host', 'started_at', 'last_heartbeat', 'status']) {
      expect(survivor).toHaveProperty(field);
    }
    const { registry: parsed, issues } = await registry.loadRegistry();
    expect(issues).toEqual([]);
    expect(Object.keys(parsed).sort()).toEqual(['dead-with-claim', 'newcomer']);
  });

  it('F-04: auto_gc=false 时不清理、不回写、无 gc 字段', async () => {
    await fs.writeJson('.lrnev/config/lrnev.json', { agent: { auto_gc: false } });
    await fs.writeJson(AGENT_REGISTRY_REL, {
      'dead-local': mkAgent('dead-local', { pid: 2 ** 30 }),
    });
    await fs.writeJson(claimRel('T-001'), mkClaim('T-001', 'dead-local', isoAgo(60_000)));

    const res = await registry.register({ agent_id: 'newcomer' });

    const raw = await fs.readJson<Record<string, { status: string }>>(AGENT_REGISTRY_REL);
    expect(Object.keys(raw).sort()).toEqual(['dead-local', 'newcomer']);
    expect(raw['dead-local']!.status).toBe('active');
    expect(fs.exists(claimRel('T-001'))).toBe(true);
    expect(res.data.gc).toBeUndefined();
  });

  it('F-04: gc_retention_days 非法值（负数）按默认 7 天防御回退', async () => {
    await fs.writeJson('.lrnev/config/lrnev.json', { agent: { gc_retention_days: -5 } });
    await fs.writeJson(AGENT_REGISTRY_REL, {
      'remote-3d': mkAgent('remote-3d', { host: 'other-host', last_heartbeat: isoAgo(3 * DAY) }),
      'remote-8d': mkAgent('remote-8d', { host: 'other-host', last_heartbeat: isoAgo(8 * DAY) }),
    });

    await registry.register({ agent_id: 'newcomer' });

    const raw = await fs.readJson<Record<string, unknown>>(AGENT_REGISTRY_REL);
    expect(Object.keys(raw).sort()).toEqual(['newcomer', 'remote-3d']);
  });

  it('F-05: 无清理时返回不含 gc 字段，followup 不含 GC 文案', async () => {
    const res = await registry.register({ agent_id: 'newcomer' });

    expect(res.data.gc).toBeUndefined();
    expect(res.data).not.toHaveProperty('gc');
    for (const line of res.ai_followup?.instructions ?? []) {
      expect(line).not.toMatch(/GC|清扫/);
    }
  });

  it('F-05: 有清理时 followup 仍不含 GC 文案（不占注意力预算）', async () => {
    await fs.writeJson(AGENT_REGISTRY_REL, {
      'dead-local': mkAgent('dead-local', { pid: 2 ** 30 }),
    });

    const res = await registry.register({ agent_id: 'newcomer' });

    expect(res.data.gc).toEqual({ removed_agents: 1, removed_claims: 0 });
    for (const line of res.ai_followup?.instructions ?? []) {
      expect(line).not.toMatch(/GC|清扫/);
    }
  });

  it('F-06: claims 目录存在损坏 JSON 时 register 正常成功且损坏文件保留', async () => {
    await fs.writeJson(AGENT_REGISTRY_REL, {
      'dead-local': mkAgent('dead-local', { pid: 2 ** 30 }),
    });
    await fs.write('.lrnev/runtime/claims/broken.json', '{ not valid json');

    const res = await registry.register({ agent_id: 'newcomer' });

    expect(res.ok).toBe(true);
    expect(fs.exists('.lrnev/runtime/claims/broken.json')).toBe(true);
    const raw = await fs.readJson<Record<string, unknown>>(AGENT_REGISTRY_REL);
    expect(Object.keys(raw).sort()).toEqual(['newcomer']);
  });

  it('gc 不落盘：registry.json 中任何条目不含 gc 字段', async () => {
    await fs.writeJson(AGENT_REGISTRY_REL, {
      'dead-local': mkAgent('dead-local', { pid: 2 ** 30 }),
    });

    await registry.register({ agent_id: 'newcomer' });

    const raw = await fs.readJson<Record<string, Record<string, unknown>>>(AGENT_REGISTRY_REL);
    for (const entry of Object.values(raw)) {
      expect(entry).not.toHaveProperty('gc');
    }
  });
});
