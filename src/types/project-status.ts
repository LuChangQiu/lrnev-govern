import type { AgentStatus } from './agent.js';
import type { TaskClaim } from './claim.js';
import type { Scope } from './response.js';
import type { Scene } from './scene.js';
import type { SpecPriority, SpecStatus } from './spec.js';
import type { TaskStatus } from './task.js';

export interface ProjectStatusSnapshot {
  generated_at: string;
  scenes: ProjectStatusScene[];
  specs: ProjectStatusSpec[];
  active_agents: ProjectStatusActiveAgent[];
  active_tasks: ProjectStatusTask[];
  recent_adrs: ProjectStatusAdr[];
  open_errors: ProjectStatusError[];
}

export interface ProjectStatusInput {
  scene?: string;
}

export interface ProjectStatusScene {
  id: string;
  name: string;
  status: Scene['status'];
  spec_count: number;
}

export interface ProjectStatusSpec {
  scene: string;
  spec: string;
  name: string;
  number: number;
  version: number;
  status: SpecStatus;
  priority?: SpecPriority;
  created?: string;
  active_task_count: number;
  task_counts: ProjectStatusTaskCounts;
  free_tasks_count: number;
  claimable_next: ProjectStatusTaskBrief[];
}

export type ProjectStatusTaskCounts = Record<TaskStatus, number>;

export interface ProjectStatusTaskBrief {
  id: string;
  title: string;
}

export interface ProjectStatusActiveAgent {
  agent_id: string;
  status: AgentStatus;
  active_claims: ProjectStatusActiveClaim[];
  client?: string;
  last_heartbeat: string;
  current_task_hint?: string;
}

export interface ProjectStatusActiveClaim {
  scene: string;
  spec: string;
  task: string;
  touches_files?: string[];
}

export interface ProjectStatusTask {
  scene: string;
  spec: string;
  id: string;
  title: string;
  status: Extract<TaskStatus, 'in_progress' | 'blocked'>;
  parent?: string;
  children?: ProjectStatusTask[];
  created: string;
  updated?: string;
}

export interface ProjectStatusAdr {
  scope: Scope;
  number: string;
  title: string;
  status?: string;
  created?: string;
  path: string;
}

export interface ProjectStatusError {
  scope: Scope;
  id: string;
  status?: string;
  last_seen?: string;
  path: string;
}

export type ProjectStatusClaimsByAgent = Map<string, ProjectStatusActiveClaim[]>;
export type ProjectStatusActiveClaimSource = TaskClaim;
