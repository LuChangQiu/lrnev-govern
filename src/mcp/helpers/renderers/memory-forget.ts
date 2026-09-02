import type { ModelVisibleRenderer } from '../model-visible-contract.js';
import type { LrnevToolPayload } from '../../types/response-envelope.js';

/**
 * memory_forget 渲染器
 *
 * MVC required 字段（D-04 写入类）:
 * - id（身份字段）
 * - deleted（状态字段）
 * - ai_followup.instructions（如有）
 */
export const memoryForgetRenderer: ModelVisibleRenderer<{ id: string; deleted: boolean }> = {
  render(payload: LrnevToolPayload<{ id: string; deleted: boolean }>): string {
    if (!payload.ok || !payload.data) {
      return '删除失败';
    }

    const { id, deleted } = payload.data;
    const lines: string[] = [];

    if (deleted) {
      lines.push(`✅ 记忆 ${id} 已删除`);
    } else {
      lines.push(`记忆 ${id} 不存在，无需删除`);
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
