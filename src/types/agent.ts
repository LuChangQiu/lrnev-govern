export type AgentStatus = 'active' | 'dead';

export interface AgentInfo {
  agent_id: string;
  pid: number;
  host: string;
  client?: string;
  started_at: string;
  last_heartbeat: string;
  status: AgentStatus;
}

export interface AgentRegistryIssue {
  code: 'AGENT_REGISTRY_INVALID';
  message: string;
  path: string;
}

export interface RegisterAgentInput {
  agent_id?: string;
  client?: string;
}

export interface AgentListResult {
  agents: AgentInfo[];
  registry_path: string;
  issues: AgentRegistryIssue[];
}

export interface UnregisterAgentInput {
  agent_id: string;
}

/** register 时机会式 GC 的清理摘要；两计数均为 0 时不出现在返回中。 */
export interface AgentGcSummary {
  removed_agents: number;
  removed_claims: number;
}

/**
 * register 的返回数据：AgentInfo + 可选 gc 摘要。
 * 独立于 AgentInfo——AgentInfo 同时是 registry.json 的落盘结构，gc 不落盘。
 */
export type AgentRegisterResult = AgentInfo & { gc?: AgentGcSummary };
