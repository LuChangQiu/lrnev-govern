import { randomBytes } from 'node:crypto';
import { hostname } from 'node:os';

import { loadConfig, DEFAULT_CONFIG } from '../shared/config.js';
import { LrnevError, ErrorCode } from '../shared/errors.js';
import { FileStorage } from '../storage/FileStorage.js';
import { ClaimStore } from './ClaimStore.js';
import type { AiFollowupResponse } from '../types/response.js';
import type { TaskClaim } from '../types/claim.js';
import type {
  AgentGcSummary,
  AgentInfo,
  AgentListResult,
  AgentRegisterResult,
  AgentRegistryIssue,
  AgentStatus,
  RegisterAgentInput,
  UnregisterAgentInput,
} from '../types/agent.js';

export const AGENT_REGISTRY_REL = '.lrnev/agents/registry.json';
const AGENT_REGISTRY_LOCK_REL = '.lrnev/locks/agent-registry.lockdir';

type AgentRegistryFile = Record<string, AgentInfo>;

/**
 * AgentRegistry 记录客户端会话的注册、心跳和存活状态。
 *
 * registry 只保存事实与租约，不启动进程；是否运行多个 AI 客户端由外部环境决定。
 */
export class AgentRegistry {
  constructor(private readonly fs: FileStorage) {}

  async register(input: RegisterAgentInput = {}): Promise<AiFollowupResponse<AgentRegisterResult>> {
    const agentConfig = loadConfig(this.fs.root).agent;
    const { agent, gc } = await this.withRegistryLock(async () => {
      const { registry } = await this.loadRegistry();
      const now = new Date().toISOString();
      const agentId = input.agent_id?.trim() || makeAgentId();
      const existing = registry[agentId];
      const info: AgentInfo = {
        agent_id: agentId,
        pid: process.pid,
        host: hostname(),
        ...(input.client?.trim() && { client: input.client.trim() }),
        started_at: existing?.started_at ?? now,
        last_heartbeat: now,
        status: 'active',
      };
      registry[agentId] = info;

      // 机会式 GC:best-effort,任何异常不影响注册主流程;与注册写合并为同一次 saveRegistry。
      let gcSummary: AgentGcSummary | undefined;
      if (agentConfig.auto_gc) {
        try {
          gcSummary = await this.sweepRegistry(registry, agentId, agentConfig);
        } catch {
          gcSummary = undefined;
        }
      }

      await this.saveRegistry(registry);
      return { agent: info, gc: gcSummary };
    });

    const hasGcActivity = gc !== undefined && (gc.removed_agents > 0 || gc.removed_claims > 0);
    return {
      ok: true,
      data: {
        ...agent,
        ...(hasGcActivity && { gc }),
      },
      ai_followup: {
        instructions: [
          `Agent "${agent.agent_id}" 已注册并标记 active。`,
          '存活随进程自动判定(stdio 连接生命周期 + 同主机 pid 探活),通常无需定时心跳。',
          '跨主机协作、或需要刷新人类可读的"上次活动时间"时,可调用 agent_heartbeat;它也会顺带续租该 Agent 的 task claim。',
          '开始处理 Task 前调用 task_claim,或在 task_update(in_progress) 时传入 agent_id 自动登记 claim。',
        ],
      },
    };
  }

  /**
   * 机会式 GC 清扫:register 锁内对 registry 与 claims 做一次卫生整理。
   *
   * 判据与死亡确定性对齐(见 scene 03 ADR-0001):
   * - 本机 pid 判死 = 确定性死亡(重连拿新 agent_id,不会复活),立即可清;
   * - 跨主机心跳判死 = 推断性死亡,超过 gc_retention_days 保留期才清;
   * - 两类都要求名下无未过期 claim(dead 但持未过期 claim 的保留为接手线索);
   * - 过期 claim 按属主状态独立清扫,删除经 removeStale 按 claim 锁重读判据。
   *
   * 顺手把幸存条目的落盘 status 回写为计算真值(文件语义:最近一次写路径触达时的快照)。
   * 注意:不可复用 unregisterAndReleaseClaims——它内部再取 withRegistryLock,目录锁不可重入。
   */
  private async sweepRegistry(
    registry: AgentRegistryFile,
    selfId: string,
    agentConfig: { heartbeat_dead_ms: number; gc_retention_days: number },
  ): Promise<AgentGcSummary> {
    const now = Date.now();
    const deadMs = agentConfig.heartbeat_dead_ms;
    const retentionMs = normalizeRetentionDays(agentConfig.gc_retention_days) * 24 * 60 * 60 * 1000;
    const claimStore = new ClaimStore(this.fs);
    const allClaims = await claimStore.listAll();
    const unexpiredOwners = new Set(
      allClaims
        .filter((claim) => new Date(claim.expires_at).getTime() > now)
        .map((claim) => claim.claimed_by),
    );

    // 属主状态快照:claim 清扫要看"清理前"的注册信息,与条目删除顺序解耦。
    const ownerSnapshot = new Map(Object.entries(registry).map(([id, info]) => [id, info]));

    let removedAgents = 0;
    for (const [agentId, info] of Object.entries(registry)) {
      if (agentId === selfId) continue;
      const status = computeAgentStatus(info, deadMs, { now });
      if (status !== 'dead') {
        if (info.status !== status) registry[agentId] = { ...info, status };
        continue;
      }
      if (unexpiredOwners.has(agentId)) {
        if (info.status !== 'dead') registry[agentId] = { ...info, status: 'dead' };
        continue;
      }
      if (!isLocalRecord(info) && !isPastRetention(info.last_heartbeat, now, retentionMs)) {
        if (info.status !== 'dead') registry[agentId] = { ...info, status: 'dead' };
        continue;
      }
      delete registry[agentId];
      removedAgents += 1;
    }

    let removedClaims = 0;
    for (const claim of allClaims) {
      if (!(await this.isClaimSweepable(claim, ownerSnapshot, now, deadMs, retentionMs))) continue;
      try {
        if (await claimStore.removeStale(claim)) removedClaims += 1;
      } catch {
        // 单个 claim 删除失败(损坏/占用)跳过,留待下次;doctor 负责报告。
      }
    }

    return { removed_agents: removedAgents, removed_claims: removedClaims };
  }

  /**
   * 过期 claim 是否可清(F-02):属主 active 不清;本机死属主立即清;
   * 跨主机死属主/未注册属主须过期超保留期才清。
   */
  private async isClaimSweepable(
    claim: TaskClaim,
    ownerSnapshot: Map<string, AgentInfo>,
    now: number,
    deadMs: number,
    retentionMs: number,
  ): Promise<boolean> {
    const expiresMs = new Date(claim.expires_at).getTime();
    if (!Number.isFinite(expiresMs) || expiresMs > now) return false;
    const owner = ownerSnapshot.get(claim.claimed_by);
    if (!owner) {
      return now - expiresMs > retentionMs;
    }
    if (computeAgentStatus(owner, deadMs, { now }) !== 'dead') return false;
    if (isLocalRecord(owner)) return true;
    return now - expiresMs > retentionMs;
  }

  async list(): Promise<AiFollowupResponse<AgentListResult>> {
    const { registry, issues } = await this.loadRegistry();
    const deadMs = loadConfig(this.fs.root).agent.heartbeat_dead_ms;
    return {
      ok: true,
      data: {
        agents: Object.values(registry)
          .map((agent) => ({ ...agent, status: computeAgentStatus(agent, deadMs) }))
          .sort((a, b) => a.agent_id.localeCompare(b.agent_id)),
        registry_path: AGENT_REGISTRY_REL,
        issues,
      },
      ...(issues.length > 0 && { warnings: issues.map((issue) => issue.message) }),
      ai_followup: {
        instructions: issues.length > 0
          ? ['Agent registry 损坏，已按空表降级；请运行 doctor 查看并修复。']
          : ['已读取 Agent 注册表。'],
      },
    };
  }

  async heartbeat(agentId: string): Promise<AiFollowupResponse<AgentInfo>> {
    const agent = await this.withRegistryLock(async () => {
      const { registry } = await this.loadRegistry();
      const existing = registry[agentId];
      if (!existing) {
        throw new LrnevError(ErrorCode.AGENT_NOT_REGISTERED, `Agent 未注册：${agentId}`, {
          field: 'agent_id',
          hint: '先调用 agent_register 注册；通过 stdio 启动时一般已自动注册。',
        });
      }
      const updated: AgentInfo = {
        ...existing,
        last_heartbeat: new Date().toISOString(),
        status: 'active',
      };
      registry[agentId] = updated;
      await this.saveRegistry(registry);
      return updated;
    });

    const refreshedClaims = await new ClaimStore(this.fs).refreshForAgent(agentId);

    return {
      ok: true,
      data: agent,
      ai_followup: {
        instructions: [
          `Agent "${agent.agent_id}" 心跳已更新。`,
          refreshedClaims.length > 0
            ? `已续租该 Agent 名下 ${refreshedClaims.length} 个 task claim。`
            : '该 Agent 当前没有需要续租的 task claim。',
          '继续保持定时 agent_heartbeat；退出前调用 agent_unregister 清理会话状态。',
        ],
      },
    };
  }

  async get(agentId: string): Promise<AgentInfo | undefined> {
    const { registry } = await this.loadRegistry();
    return registry[agentId];
  }

  /**
   * 判断某 agent 是否已死(供 ClaimStore 决定 claim 是否可被接手)。
   *
   * 未注册的 agent_id 返回 false:不强制回收,退回 TTL 语义,保证未注册用法向后兼容。
   * 已注册的按 computeAgentStatus(pid 探活为主)判定。
   */
  async isAgentDead(agentId: string): Promise<boolean> {
    const { registry } = await this.loadRegistry();
    const agent = registry[agentId];
    if (!agent) return false;
    const deadMs = loadConfig(this.fs.root).agent.heartbeat_dead_ms;
    return computeAgentStatus(agent, deadMs) === 'dead';
  }

  /**
   * 优雅退出清理:删除该 agent 的注册记录并释放其名下所有 claim。幂等、静默。
   *
   * 供 server 连接断开钩子复用;与 unregister 不同,找不到 agent 不抛错。
   */
  async unregisterAndReleaseClaims(agentId: string): Promise<{ released: number }> {
    await this.withRegistryLock(async () => {
      const { registry } = await this.loadRegistry();
      if (registry[agentId]) {
        delete registry[agentId];
        await this.saveRegistry(registry);
      }
    });
    const released = await new ClaimStore(this.fs).releaseAllByAgent(agentId);
    return { released: released.length };
  }

  async unregister(input: UnregisterAgentInput): Promise<AiFollowupResponse<{ agent_id: string }>> {
    await this.withRegistryLock(async () => {
      const { registry } = await this.loadRegistry();
      const existing = registry[input.agent_id];
      if (!existing) {
        throw new LrnevError(ErrorCode.AGENT_NOT_REGISTERED, `Agent 未注册：${input.agent_id}`, {
          field: 'agent_id',
          hint: '确认 agent_id 是否正确，或先调用 agent_list 查看当前注册表。',
        });
      }
      delete registry[input.agent_id];
      await this.saveRegistry(registry);
    });

    return {
      ok: true,
      data: {
        agent_id: input.agent_id,
      },
      ai_followup: {
        instructions: [
          `Agent "${input.agent_id}" 已注销。`,
          '如该 Agent 仍有活跃 task claim，请先用 task_release 释放，或等待租约过期后由其他会话接手。',
          '如仍有协作会话运行，请调用 project_status 确认剩余 Agent 和 active_claims。',
        ],
      },
    };
  }

  async loadRegistry(): Promise<{ registry: AgentRegistryFile; issues: AgentRegistryIssue[] }> {
    if (!this.fs.exists(AGENT_REGISTRY_REL)) {
      return { registry: {}, issues: [] };
    }

    let parsed: unknown;
    try {
      parsed = await this.fs.readJson<unknown>(AGENT_REGISTRY_REL);
    } catch (err) {
      return {
        registry: {},
        issues: [registryIssue(err instanceof Error ? err.message : String(err))],
      };
    }

    if (!isPlainObject(parsed)) {
      return {
        registry: {},
        issues: [registryIssue('registry.json 顶层必须是对象')],
      };
    }

    const registry: AgentRegistryFile = {};
    const issues: AgentRegistryIssue[] = [];
    for (const [agentId, value] of Object.entries(parsed)) {
      const normalized = normalizeAgentInfo(agentId, value);
      if (!normalized) {
        issues.push(registryIssue(`Agent "${agentId}" 记录无效，已跳过`));
        continue;
      }
      registry[agentId] = normalized;
    }
    return { registry, issues };
  }

  private async withRegistryLock<T>(fn: () => Promise<T>): Promise<T> {
    return this.fs.withDirectoryLock(AGENT_REGISTRY_LOCK_REL, fn);
  }

  private async saveRegistry(registry: AgentRegistryFile): Promise<void> {
    await this.fs.writeJson(AGENT_REGISTRY_REL, registry);
  }
}

/**
 * 存活判定的探针参数。默认用真实 hostname + process.kill 探活,测试可注入。
 */
export interface AgentStatusProbe {
  now?: number;
  currentHost?: string;
  isPidAlive?: (pid: number) => boolean;
}

/**
 * 判定 Agent 活/死。
 *
 * 主信号:同 host 且 pid 合法时,用 `process.kill(pid,0)` 探测进程是否在世
 * ——这是 stdio 子进程模型下可靠且免费的存活信号,不依赖任何客户端定时心跳。
 * 兜底:跨 host(无法探本机外 pid)或 pid 缺失/非法时,回退到 last_heartbeat 年龄阈值。
 */
export function computeAgentStatus(agent: AgentInfo, deadMs: number, probe: AgentStatusProbe = {}): AgentStatus {
  const now = probe.now ?? Date.now();
  const currentHost = probe.currentHost ?? hostname();
  const isPidAlive = probe.isPidAlive ?? defaultIsPidAlive;

  if (agent.host === currentHost && Number.isInteger(agent.pid) && agent.pid > 0) {
    return isPidAlive(agent.pid) ? 'active' : 'dead';
  }

  const lastHeartbeat = new Date(agent.last_heartbeat).getTime();
  if (!Number.isFinite(lastHeartbeat)) return 'dead';
  return now - lastHeartbeat > deadMs ? 'dead' : 'active';
}

/** 用信号 0 探测 pid 是否在世:不存在(ESRCH)=死;存在但无权限(EPERM)=活;其余按死处理。 */
export function defaultIsPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/** 记录是否为本机记录:host 相同且 pid 合法——此时 computeAgentStatus 走 pid 探活,判死为确定性死亡。 */
function isLocalRecord(agent: AgentInfo): boolean {
  return agent.host === hostname() && Number.isInteger(agent.pid) && agent.pid > 0;
}

/** last_heartbeat 是否已超过保留期;时间戳非法视为超期(无法证明其新鲜)。 */
function isPastRetention(lastHeartbeat: string, nowMs: number, retentionMs: number): boolean {
  const heartbeatMs = new Date(lastHeartbeat).getTime();
  if (!Number.isFinite(heartbeatMs)) return true;
  return nowMs - heartbeatMs > retentionMs;
}

/** gc_retention_days 防御回退:config 的 deepMerge 只挡类型不符,同类型非法值(负数/0/NaN)在此按默认值处理。 */
function normalizeRetentionDays(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_CONFIG.agent.gc_retention_days;
}

function normalizeAgentInfo(agentId: string, value: unknown): AgentInfo | null {
  if (!isPlainObject(value)) return null;
  if (
    value.agent_id !== agentId
    || typeof value.pid !== 'number'
    || typeof value.host !== 'string'
    || typeof value.started_at !== 'string'
    || typeof value.last_heartbeat !== 'string'
    || !isAgentStatus(value.status)
  ) {
    return null;
  }
  return {
    agent_id: value.agent_id,
    pid: value.pid,
    host: value.host,
    ...(typeof value.client === 'string' && { client: value.client }),
    started_at: value.started_at,
    last_heartbeat: value.last_heartbeat,
    status: value.status,
  };
}

function isAgentStatus(value: unknown): value is AgentStatus {
  return value === 'active' || value === 'dead';
}

function registryIssue(message: string): AgentRegistryIssue {
  return {
    code: 'AGENT_REGISTRY_INVALID',
    message,
    path: AGENT_REGISTRY_REL,
  };
}

function makeAgentId(): string {
  const host = hostname().replace(/[^a-zA-Z0-9._-]+/g, '-');
  return `${host}-${process.pid}-${randomBytes(2).toString('hex')}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
