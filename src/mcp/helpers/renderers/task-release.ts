import type { ModelVisibleRenderer } from '../model-visible-contract.js';
import type { LrnevToolPayload } from '../../types/response-envelope.js';
import type { TaskClaimReleaseResult } from '../../../types/claim.js';

/**
 * task_release 渲染器
 *
 * MVC required 字段（D-04 写入类）:
 * - task/scene/spec（身份字段）
 * - released（是否成功）
 * - ai_followup.instructions（如有）
 */
export const taskReleaseRenderer: ModelVisibleRenderer<TaskClaimReleaseResult> = {
  render(payload: LrnevToolPayload<TaskClaimReleaseResult>): string {
    if (!payload.ok || !payload.data) {
      return '释放失败';
    }

    const { task, released } = payload.data;
    const lines: string[] = [];

    if (released) {
      lines.push(`✅ Task ${task} 的 claim 已释放`);
    } else {
      lines.push(`Task ${task} 无 claim 需要释放`);
    }
    lines.push('');

    // 投影 ai_followup
    if (payload.ai_followup?.instructions) {
      for (const instruction of payload.ai_followup.instructions) {
        lines.push(instruction);
      }
    }

    return lines.join('\n');
  },
};
