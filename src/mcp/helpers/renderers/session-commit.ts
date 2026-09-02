import type { ModelVisibleRenderer } from '../model-visible-contract.js';
import type { LrnevToolPayload } from '../../types/response-envelope.js';
import type { SessionCommitResult } from '../../../types/memory.js';

/**
 * session_commit 渲染器
 *
 * MVC required 字段（D-04 写入类）:
 * - saved（保存的记忆列表）
 * - skipped（跳过的记忆列表）
 * - ai_followup.instructions（如有）
 */
export const sessionCommitRenderer: ModelVisibleRenderer<SessionCommitResult> = {
  render(payload: LrnevToolPayload<SessionCommitResult>): string {
    if (!payload.ok || !payload.data) {
      return '提交失败';
    }

    const { saved, skipped } = payload.data;
    const lines: string[] = [];

    lines.push(`✅ session_commit 完成：保存 ${saved.length} 条，跳过 ${skipped.length} 条`);
    lines.push('');

    if (saved.length > 0) {
      lines.push('已保存：');
      for (const memory of saved) {
        lines.push(`   ${memory.id} (${memory.category})`);
      }
      lines.push('');
    }

    if (skipped.length > 0) {
      lines.push('已跳过：');
      for (const item of skipped) {
        const reason = item.reason === 'duplicate'
          ? `相似于 ${item.similar_to}`
          : item.reason;
        lines.push(`   ${item.candidate.category}: ${reason}`);
      }
      lines.push('');
    }

    // 投影 ai_followup
    if (payload.ai_followup?.instructions) {
      for (const instruction of payload.ai_followup.instructions) {
        lines.push(instruction);
      }
    }

    return lines.join('\n');
  },
};
