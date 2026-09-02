import type { ModelVisibleRenderer } from '../model-visible-contract.js';
import type { LrnevToolPayload } from '../../types/response-envelope.js';
import type { TaskClaimResult } from '../../../types/claim.js';

/**
 * task_claim 渲染器
 *
 * MVC required 字段（D-04 写入类）:
 * - task/scene/spec（身份字段）
 * - claimed_by/expires_at（状态字段）
 * - claimed（是否成功）
 * - conflict（如有冲突）
 * - overlaps（如有重叠提示）
 * - ai_followup.instructions（如有）
 */
export const taskClaimRenderer: ModelVisibleRenderer<TaskClaimResult> = {
  render(payload: LrnevToolPayload<TaskClaimResult>): string {
    if (!payload.ok || !payload.data) {
      return 'Claim 失败';
    }

    const { claim, claimed, conflict, overlaps } = payload.data;
    const lines: string[] = [];

    if (claimed) {
      lines.push(`✅ Task ${claim.task} 已登记 claim`);
      lines.push(`   Agent: ${claim.claimed_by}`);
      lines.push(`   过期时间: ${claim.expires_at}`);
      if (claim.touches_files && claim.touches_files.length > 0) {
        lines.push(`   预计修改文件: ${claim.touches_files.join(', ')}`);
      }
      lines.push('');
    }

    if (conflict) {
      lines.push(`⚠️ 已被 ${conflict.claimed_by} 持有，过期时间: ${conflict.expires_at}`);
      lines.push('');
    }

    if (overlaps && overlaps.length > 0) {
      lines.push('⚠️ 检测到文件重叠（不阻塞，仅提示）：');
      for (const overlap of overlaps) {
        lines.push(`   ${overlap.task} (${overlap.claimed_by}): ${overlap.touches_files.join(', ')}`);
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
