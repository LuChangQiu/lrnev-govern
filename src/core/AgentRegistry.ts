import { randomBytes } from 'node:crypto';
import { hostname } from 'node:os';

import { loadConfig } from '../shared/config.js';
import { LrnevError, ErrorCode } from '../shared/errors.js';
import { FileStorage } from '../storage/FileStorage.js';
import { ClaimStore } from './ClaimStore.js';
import type { AiFollowupResponse } from '../types/response.js';
import type {
  AgentInfo,
  AgentListResult,
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

  async register(input: RegisterAgentInput = {}): Promise<AiFollowupResponse<AgentInfo>> {
    const agent = await this.withRegistryLock(async () => {
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
      await this.saveRegistry(registry);
      return info;
    });

    return {
      ok: true,
      data: agent,
      ai_followup: {
        instructions: [
          `Agent "${agent.agent_id}" 已注册并标记 active。`,
          `客户端应定期调用 agent_heartbeat 续写 last_heartbeat；建议间隔 ${Math.max(1, Math.floor(loadConfig(this.fs.root).agent.heartbeat_dead_ms / 3000))} 秒。`,
          '开始处理 Task 前调用 task_claim，或在 task_update(in_progress) 时传入 agent_id 自动登记 claim。',
        ],
      },
    };
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
          hint: '先调用 agent_register 注册，再定期发送 heartbeat。',
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

export function computeAgentStatus(agent: AgentInfo, deadMs: number, nowMs = Date.now()): AgentStatus {
  const lastHeartbeat = new Date(agent.last_heartbeat).getTime();
  if (!Number.isFinite(lastHeartbeat)) return 'dead';
  return nowMs - lastHeartbeat > deadMs ? 'dead' : 'active';
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
