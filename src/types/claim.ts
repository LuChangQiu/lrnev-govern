export interface TaskClaim {
  scene: string;
  spec: string;
  task: string;
  claimed_by: string;
  claimed_at: string;
  expires_at: string;
  touches_files?: string[];
}

export interface ClaimTaskInput {
  scene: string;
  spec: string;
  task: string;
  agent_id: string;
  ttl_seconds?: number;
  touches_files?: string[];
}

export interface ReleaseTaskClaimInput {
  scene: string;
  spec: string;
  task: string;
  agent_id: string;
}

export interface TaskClaimOverlap {
  scene: string;
  spec: string;
  task: string;
  claimed_by: string;
  touches_files: string[];
}

export interface TaskClaimResult {
  claim: TaskClaim;
  claimed: boolean;
  conflict?: TaskClaim;
  overlaps?: TaskClaimOverlap[];
}

export interface TaskClaimReleaseResult {
  scene: string;
  spec: string;
  task: string;
  released: boolean;
}
