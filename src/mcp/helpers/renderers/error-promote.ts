import type { ModelVisibleRenderer } from '../model-visible-contract.js';
import type { LrnevToolPayload } from '../../types/response-envelope.js';
import type { ErrorEntry } from '../../../types/errorbook.js';

/**
 * error_promote 渲染器
 *
 * MVC required 字段（D-04 写入类）:
 * - id（身份字段）
 * - status（promoted）
 * - verification（用户文本，由 MVC 出口统一转义）
 * - path
 * - ai_followup.instructions（如有）
 */
export const errorPromoteRenderer: ModelVisibleRenderer<ErrorEntry> = {
  render(payload: LrnevToolPayload<ErrorEntry>): string {
    if (!payload.ok || !payload.data) {
      return '提升失败';
    }

    const { id, status, path, body } = payload.data;
    const lines: string[] = [];

    lines.push(`✅ 错误 ${id} 已提升为: ${status}`);
    if (body.verification) {
      lines.push(`   验证: ${body.verification}`);
    }
    lines.push(`   路径: ${path}`);
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
