/**
 * SessionCommit —— 会话结束时的批量记忆入库。
 *
 * 这里复用 MemoryManager.save，确保单条保存和批量保存的去重 / 校验一致。
 */

import { loadConfig } from '../shared/config.js';
import { LrnevError, ErrorCode } from '../shared/errors.js';
import { MemoryManager } from './MemoryManager.js';
import type {
  Memory,
  SessionCommitInput,
  SessionCommitResult,
  SkippedMemory,
} from '../types/memory.js';
import type { AiFollowupResponse, Scope } from '../types/response.js';

export class SessionCommit {
  constructor(private readonly memories: MemoryManager) {}

  async commit(input: SessionCommitInput): Promise<AiFollowupResponse<SessionCommitResult>> {
    if (!input.summary.trim()) {
      throw new LrnevError(ErrorCode.INVALID_INPUT, 'summary 不能为空', { field: 'summary' });
    }
    const scope: Scope = input.scope ?? 'global';
    const saved: Memory[] = [];
    const skipped: SkippedMemory[] = [];
    const maxCandidates = loadConfig(this.memories.workspaceRoot).memory.max_candidates_per_commit;
    const candidates = input.candidates.slice(0, maxCandidates);

    for (const candidate of candidates) {
      try {
        const result = await this.memories.save({
          ...candidate,
          scope,
        });
        if (result.warnings?.some((warning) => warning.includes('相似记忆'))) {
          skipped.push({
            candidate,
            reason: 'duplicate',
            similar_to: result.data.id,
          });
        } else {
          saved.push(result.data);
        }
      } catch {
        skipped.push({ candidate, reason: 'invalid' });
      }
    }

    if (input.candidates.length > candidates.length) {
      for (const candidate of input.candidates.slice(candidates.length)) {
        skipped.push({ candidate, reason: 'rejected' });
      }
    }

    return {
      ok: true,
      data: { saved, skipped },
      ai_followup: {
        instructions: [
          `session_commit 完成：保存 ${saved.length} 条，跳过 ${skipped.length} 条。`,
          '后续任务开始前，可用 memory_search 检索本次沉淀的偏好、事实和模式。',
        ],
      },
    };
  }
}
