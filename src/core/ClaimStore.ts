import { loadConfig } from '../shared/config.js';
import { LrnevError, ErrorCode } from '../shared/errors.js';
import { FileStorage } from '../storage/FileStorage.js';
import type {
  ClaimTaskInput,
  ReleaseTaskClaimInput,
  TaskClaim,
  TaskClaimOverlap,
  TaskClaimReleaseResult,
  TaskClaimResult,
} from '../types/claim.js';

export const CLAIMS_DIR_REL = '.lrnev/runtime/claims';

/**
 * ClaimStore 管理 Task 的运行态软占用。
 *
 * claim 只是协作提示，不是源码锁；touches_files 只用于重叠提醒。
 * 单个 Task claim 用短目录锁串行化，是为了把“读现有 claim → 判断过期 → 写入新 claim”放进同一个临界区。
 */
export class ClaimStore {
  constructor(private readonly fs: FileStorage) {}

  async claim(input: ClaimTaskInput): Promise<TaskClaimResult> {
    this.validateClaimInput(input);
    return this.fs.withDirectoryLock(claimLockPath(input.scene, input.spec, input.task), async () => {
      const existing = await this.readClaim(input.scene, input.spec, input.task);
      if (existing && !isExpired(existing) && existing.claimed_by !== input.agent_id) {
        return {
          claim: existing,
          claimed: false,
          conflict: existing,
        };
      }

      const now = new Date();
      const claim: TaskClaim = {
        scene: input.scene,
        spec: input.spec,
        task: input.task,
        claimed_by: input.agent_id,
        claimed_at: existing?.claimed_by === input.agent_id ? existing.claimed_at : now.toISOString(),
        expires_at: expiresAt(now, input.ttl_seconds ?? this.defaultTtlSeconds()).toISOString(),
        ...(input.touches_files && input.touches_files.length > 0 && {
          touches_files: normalizeTouches(input.touches_files),
        }),
      };
      await this.fs.writeJson(claimPath(input.scene, input.spec, input.task), claim);
      const overlaps = await this.findTouchOverlaps(claim);
      return {
        claim,
        claimed: true,
        ...(existing && isExpired(existing) && existing.claimed_by !== input.agent_id && { conflict: existing }),
        ...(overlaps.length > 0 && { overlaps }),
      };
    });
  }

  async release(input: ReleaseTaskClaimInput): Promise<TaskClaimReleaseResult> {
    const path = claimPath(input.scene, input.spec, input.task);
    if (!this.fs.exists(path)) {
      return { scene: input.scene, spec: input.spec, task: input.task, released: false };
    }
    const existing = await this.fs.readJson<TaskClaim>(path);
    if (existing.claimed_by !== input.agent_id) {
      return { scene: input.scene, spec: input.spec, task: input.task, released: false };
    }
    await this.fs.rm(path);
    return { scene: input.scene, spec: input.spec, task: input.task, released: true };
  }

  async listActive(): Promise<TaskClaim[]> {
    return (await this.listAll()).filter((claim) => !isExpired(claim));
  }

  async listAll(): Promise<TaskClaim[]> {
    const files = await this.fs.list(`${CLAIMS_DIR_REL}/*.json`);
    const claims: TaskClaim[] = [];
    for (const file of files) {
      try {
        const claim = await this.fs.readJson<TaskClaim>(file);
        if (isTaskClaim(claim)) claims.push(claim);
      } catch {
        // 损坏的 claim 是可重建运行态；doctor 后续负责报告/清理。
      }
    }
    return claims.sort((a, b) => claimKey(a).localeCompare(claimKey(b)));
  }

  async refreshForAgent(agentId: string): Promise<TaskClaim[]> {
    if (!this.fs.exists(CLAIMS_DIR_REL)) return [];
    const refreshed: TaskClaim[] = [];
    const now = new Date();
    const nextExpiresAt = expiresAt(now, this.defaultTtlSeconds()).toISOString();
    for (const claim of await this.listAll()) {
      if (claim.claimed_by !== agentId || isExpired(claim, now.getTime())) continue;
      const updated: TaskClaim = {
        ...claim,
        expires_at: nextExpiresAt,
      };
      await this.fs.writeJson(claimPath(claim.scene, claim.spec, claim.task), updated);
      refreshed.push(updated);
    }
    return refreshed;
  }

  private async readClaim(scene: string, spec: string, task: string): Promise<TaskClaim | null> {
    const path = claimPath(scene, spec, task);
    if (!this.fs.exists(path)) return null;
    const claim = await this.fs.readJson<TaskClaim>(path);
    return isTaskClaim(claim) ? claim : null;
  }

  private validateClaimInput(input: ClaimTaskInput): void {
    for (const [field, value] of Object.entries({
      scene: input.scene,
      spec: input.spec,
      task: input.task,
      agent_id: input.agent_id,
    })) {
      if (!value.trim()) {
        throw new LrnevError(ErrorCode.INVALID_INPUT, `${field} 不能为空`, { field });
      }
    }
    const ttl = input.ttl_seconds ?? this.defaultTtlSeconds();
    if (!Number.isInteger(ttl) || ttl <= 0 || ttl > loadConfig(this.fs.root).claim.max_ttl_seconds) {
      throw new LrnevError(ErrorCode.INVALID_INPUT, `ttl_seconds 不合法：${ttl}`, { field: 'ttl_seconds' });
    }
  }

  private defaultTtlSeconds(): number {
    return loadConfig(this.fs.root).claim.default_ttl_seconds;
  }

  private async findTouchOverlaps(claim: TaskClaim): Promise<TaskClaimOverlap[]> {
    if (!claim.touches_files || claim.touches_files.length === 0) return [];
    const touched = new Set(claim.touches_files);
    const overlaps: TaskClaimOverlap[] = [];
    for (const other of await this.listAll()) {
      if (claimKey(other) === claimKey(claim) || isExpired(other)) continue;
      const shared = (other.touches_files ?? []).filter((file) => touched.has(file));
      if (shared.length === 0) continue;
      overlaps.push({
        scene: other.scene,
        spec: other.spec,
        task: other.task,
        claimed_by: other.claimed_by,
        touches_files: shared,
      });
    }
    return overlaps;
  }
}

function claimPath(scene: string, spec: string, task: string): string {
  return `${CLAIMS_DIR_REL}/${safePart(scene)}__${safePart(spec)}__${safePart(task)}.json`;
}

function claimLockPath(scene: string, spec: string, task: string): string {
  return `.lrnev/locks/claim-${safePart(scene)}__${safePart(spec)}__${safePart(task)}.lockdir`;
}

function claimKey(claim: Pick<TaskClaim, 'scene' | 'spec' | 'task'>): string {
  return `${claim.scene}/${claim.spec}/${claim.task}`;
}

function expiresAt(now: Date, ttlSeconds: number): Date {
  return new Date(now.getTime() + ttlSeconds * 1000);
}

function isExpired(claim: TaskClaim, nowMs = Date.now()): boolean {
  return new Date(claim.expires_at).getTime() <= nowMs;
}

function isTaskClaim(value: unknown): value is TaskClaim {
  if (!isPlainObject(value)) return false;
  return (
    typeof value.scene === 'string'
    && typeof value.spec === 'string'
    && typeof value.task === 'string'
    && typeof value.claimed_by === 'string'
    && typeof value.claimed_at === 'string'
    && typeof value.expires_at === 'string'
    && (
      value.touches_files === undefined
      || (Array.isArray(value.touches_files) && value.touches_files.every((item) => typeof item === 'string'))
    )
  );
}

function normalizeTouches(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function safePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '_');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
