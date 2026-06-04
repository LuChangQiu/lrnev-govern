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
