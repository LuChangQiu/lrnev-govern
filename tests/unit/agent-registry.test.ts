import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { dir as tmpDir, type DirectoryResult } from 'tmp-promise';
import { hostname } from 'node:os';

import {
  AgentRegistry,
  AGENT_REGISTRY_REL,
  computeAgentStatus,
  defaultIsPidAlive,
} from '../../src/core/AgentRegistry.js';
import { ClaimStore } from '../../src/core/ClaimStore.js';
import { FileStorage } from '../../src/storage/FileStorage.js';
import { ensureWorkspace } from '../../src/storage/WorkspaceLocator.js';
import { isLrnevError } from '../../src/shared/errors.js';

describe('AgentRegistry', () => {
  let workspace: DirectoryResult;
  let fs: FileStorage;
  let registry: AgentRegistry;
  let claims: ClaimStore;

  beforeEach(async () => {
    workspace = await tmpDir({ unsafeCleanup: true });
    await ensureWorkspace(workspace.path);
    fs = new FileStorage(workspace.path);
    registry = new AgentRegistry(fs);
    claims = new ClaimStore(fs);
  });

  afterEach(async () => {
    vi.useRealTimers();
    await workspace.cleanup();
  });

  it('F-01: register 应写入 AgentInfo 并返回指定 agent_id', async () => {
    const res = await registry.register({ agent_id: 'agent-a', client: 'codex' });

    expect(res.ok).toBe(true);
    expect(res.data).toEqual(expect.objectContaining({
      agent_id: 'agent-a',
      pid: process.pid,
      client: 'codex',
      status: 'active',
    }));
    expect(fs.exists(AGENT_REGISTRY_REL)).toBe(true);

    const raw = await fs.readJson<Record<string, unknown>>(AGENT_REGISTRY_REL);
    expect(Object.keys(raw)).toEqual(['agent-a']);
  });

  it('F-01: 未传 agent_id 时应生成 host-pid-rand 形式 id', async () => {
    const res = await registry.register({ client: 'cli' });

    expect(res.data.agent_id).toContain(`-${process.pid}-`);
    expect(res.data.client).toBe('cli');
  });

  it('F-01: 重复注册同一 agent_id 应更新而非插入重复记录', async () => {
    const first = await registry.register({ agent_id: 'agent-a', client: 'first' });

    const second = await registry.register({ agent_id: 'agent-a', client: 'second' });
    const list = await registry.list();

    expect(list.data.agents).toHaveLength(1);
    expect(second.data.client).toBe('second');
    expect(second.data.started_at).toBe(first.data.started_at);
    expect(new Date(second.data.last_heartbeat).getTime()).toBeGreaterThanOrEqual(
      new Date(first.data.last_heartbeat).getTime(),
    );
  });

  it('F-01: registry.json 损坏时应降级为空表并返回 issue', async () => {
    await fs.write(AGENT_REGISTRY_REL, '{bad json');

    const list = await registry.list();

    expect(list.ok).toBe(true);
    expect(list.data.agents).toEqual([]);
    expect(list.data.issues[0]?.code).toBe('AGENT_REGISTRY_INVALID');
    expect(list.warnings?.join('\n')).toContain('JSON 解析失败');
  });

  it('F-02: heartbeat 应更新 last_heartbeat 并把 status 改回 active', async () => {
    const registered = await registry.register({ agent_id: 'agent-a' });
    await fs.writeJson(AGENT_REGISTRY_REL, {
      'agent-a': {
        ...registered.data,
        last_heartbeat: '2026-01-01T00:00:00.000Z',
        status: 'dead',
      },
    });

    const heartbeat = await registry.heartbeat('agent-a');

    expect(heartbeat.ok).toBe(true);
    expect(heartbeat.data.status).toBe('active');
    expect(new Date(heartbeat.data.last_heartbeat).getTime()).toBeGreaterThan(
      new Date('2026-01-01T00:00:00.000Z').getTime(),
    );
    const raw = await fs.readJson<Record<string, { last_heartbeat: string; status: string }>>(AGENT_REGISTRY_REL);
    expect(raw['agent-a']?.last_heartbeat).toBe(heartbeat.data.last_heartbeat);
    expect(raw['agent-a']?.status).toBe('active');
  });

  it('F-08: heartbeat 应续租该 Agent 持有的活跃 task claim', async () => {
    await registry.register({ agent_id: 'agent-a' });
    const first = await claims.claim({
      scene: '01-user-management',
      spec: '01-00-user-login',
      task: 'T-001',
      agent_id: 'agent-a',
      ttl_seconds: 1,
    });
    const heartbeat = await registry.heartbeat('agent-a');
    const active = await claims.listActive();

    expect(new Date(active[0]!.expires_at).getTime()).toBeGreaterThan(
      new Date(first.claim.expires_at).getTime(),
    );
    expect(heartbeat.ai_followup?.instructions.join('\n')).toContain('已续租该 Agent 名下 1 个 task claim');
  });

  it('F-02: heartbeat 未注册 agent_id 应抛 AGENT_NOT_REGISTERED', async () => {
    try {
      await registry.heartbeat('missing-agent');
      expect.fail('should throw');
    } catch (err) {
      expect(isLrnevError(err)).toBe(true);
      if (isLrnevError(err)) expect(err.code).toBe('AGENT_NOT_REGISTERED');
    }
  });

  it('F-02: heartbeat 单次读改写开销应保持轻量', async () => {
    await registry.register({ agent_id: 'agent-a' });
    const readJson = vi.spyOn(fs, 'readJson');
    const writeJson = vi.spyOn(fs, 'writeJson');

    for (let i = 0; i < 10; i++) {
      await registry.heartbeat('agent-a');
    }

    expect(readJson).toHaveBeenCalledTimes(10);
    expect(writeJson).toHaveBeenCalledTimes(10);
  });

  it('F-03: agent_list 应惰性计算 90s 以上未心跳 Agent 为 dead', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:01:31.000Z'));
    const oldHeartbeat = '2026-01-01T00:00:00.000Z';
    await fs.writeJson(AGENT_REGISTRY_REL, {
      'agent-a': agentInfo({ agent_id: 'agent-a', last_heartbeat: oldHeartbeat, status: 'active' }),
    });

    const list = await registry.list();

    expect(list.data.agents[0]?.status).toBe('dead');
    const raw = await fs.readJson<Record<string, { status: string }>>(AGENT_REGISTRY_REL);
    expect(raw['agent-a']?.status).toBe('active');
  });

  it('F-03: agent.heartbeat_dead_ms 配置应覆盖失活阈值', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:01.500Z'));
    await fs.writeJson('.lrnev/config/lrnev.json', {
      agent: { heartbeat_dead_ms: 1000 },
    });
    const oldHeartbeat = '2026-01-01T00:00:00.000Z';
    await fs.writeJson(AGENT_REGISTRY_REL, {
      'agent-a': agentInfo({ agent_id: 'agent-a', last_heartbeat: oldHeartbeat, status: 'active' }),
    });

    const list = await registry.list();

    expect(list.data.agents[0]?.status).toBe('dead');
  });

  it('F-03: 同 host 且 pid 在世应判 active(忽略很旧的心跳)', () => {
    const status = computeAgentStatus(
      sameHostAgent({ last_heartbeat: '2000-01-01T00:00:00.000Z' }),
      90_000,
      { isPidAlive: () => true },
    );
    expect(status).toBe('active');
  });

  it('F-03: 同 host 但 pid 不在世应判 dead(忽略很新的心跳)', () => {
    const status = computeAgentStatus(
      sameHostAgent({ last_heartbeat: new Date().toISOString() }),
      90_000,
      { isPidAlive: () => false },
    );
    expect(status).toBe('dead');
  });

  it('F-07: 跨 host 应回退心跳年龄,不调用 pid 探活', () => {
    const probe = vi.fn(() => true);
    const agent = sameHostAgent({ host: 'another-host', last_heartbeat: '2026-01-01T00:00:00.000Z' });

    const dead = computeAgentStatus(agent, 1000, {
      now: new Date('2026-01-01T00:00:05.000Z').getTime(),
      isPidAlive: probe,
    });
    const alive = computeAgentStatus(agent, 1000, {
      now: new Date('2026-01-01T00:00:00.500Z').getTime(),
      isPidAlive: probe,
    });

    expect(dead).toBe('dead');
    expect(alive).toBe('active');
    expect(probe).not.toHaveBeenCalled();
  });

  it('F-07: pid 非法(<=0)应回退心跳年龄,不调用 pid 探活', () => {
    const probe = vi.fn(() => false);
    const status = computeAgentStatus(
      sameHostAgent({ pid: 0, last_heartbeat: new Date().toISOString() }),
      90_000,
      { isPidAlive: probe },
    );
    expect(status).toBe('active');
    expect(probe).not.toHaveBeenCalled();
  });

  it('defaultIsPidAlive: 当前进程判活,极大不存在 pid 判死', () => {
    expect(defaultIsPidAlive(process.pid)).toBe(true);
    expect(defaultIsPidAlive(2 ** 30)).toBe(false);
  });

  it('F-04: isAgentDead 对未注册 agent 返回 false(向后兼容)', async () => {
    expect(await registry.isAgentDead('nobody')).toBe(false);
  });

  it('F-04: isAgentDead 对同 host 已死 pid 的已注册 agent 返回 true', async () => {
    await fs.writeJson(AGENT_REGISTRY_REL, {
      ghost: sameHostAgent({ agent_id: 'ghost', pid: 2 ** 30, last_heartbeat: new Date().toISOString() }),
    });
    expect(await registry.isAgentDead('ghost')).toBe(true);
  });

  it('F-02/F-04: unregisterAndReleaseClaims 应删注册记录并释放其 claim,且对未知 agent 静默', async () => {
    await registry.register({ agent_id: 'agent-a' });
    await claims.claim({ scene: '00-default', spec: '01-00-login', task: 'T-001', agent_id: 'agent-a' });
    await claims.claim({ scene: '00-default', spec: '01-00-login', task: 'T-002', agent_id: 'agent-a' });

    const res = await registry.unregisterAndReleaseClaims('agent-a');

    expect(res.released).toBe(2);
    expect((await registry.list()).data.agents).toHaveLength(0);
    expect(await claims.listAll()).toHaveLength(0);
    await expect(registry.unregisterAndReleaseClaims('agent-a')).resolves.toEqual({ released: 0 });
  });

  function sameHostAgent(overrides: Partial<{
    agent_id: string;
    pid: number;
    host: string;
    last_heartbeat: string;
  }> = {}) {
    return {
      agent_id: overrides.agent_id ?? 'agent-a',
      pid: overrides.pid ?? 12345,
      host: overrides.host ?? hostname(),
      started_at: '2026-01-01T00:00:00.000Z',
      last_heartbeat: overrides.last_heartbeat ?? new Date().toISOString(),
      status: 'active' as const,
    };
  }

  function agentInfo(overrides: Partial<{
    agent_id: string;
    last_heartbeat: string;
    status: 'active' | 'dead';
  }>) {
    const id = overrides.agent_id ?? 'agent-a';
    return {
      agent_id: id,
      pid: process.pid,
      host: 'host',
      started_at: new Date().toISOString(),
      last_heartbeat: overrides.last_heartbeat ?? new Date().toISOString(),
      status: overrides.status ?? 'active',
    };
  }
});
