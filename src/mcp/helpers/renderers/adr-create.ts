import type { ModelVisibleRenderer } from '../model-visible-contract.js';
import type { LrnevToolPayload } from '../../types/response-envelope.js';
import type { ADR } from '../../../types/adr.js';

/**
 * adr_create 渲染器
 *
 * MVC required 字段（D-04 写入类）:
 * - number/title（身份字段）
 * - path
 * - ai_followup.instructions（如有）
 */
export const adrCreateRenderer: ModelVisibleRenderer<ADR> = {
  render(payload: LrnevToolPayload<ADR>): string {
    if (!payload.ok || !payload.data) {
      return '创建失败';
    }

    const { number, title, path } = payload.data;
    const lines: string[] = [];

    lines.push(`✅ ADR ${number} 已创建：${title}`);
    lines.push(`   路径: ${path}`);
    lines.push('');

    // 投影 ai_followup
    if (payload.ai_followup?.instructions) {
      for (const instruction of payload.ai_followup.instructions) {
        lines.push(instruction);
      }
      lines.push('');
    }

    if (payload.ai_followup?.suggested_tools) {
      lines.push('建议工具：');
      for (const tool of payload.ai_followup.suggested_tools) {
        lines.push(`- ${tool.name}: ${tool.reason}`);
      }
    }

    return lines.join('\n');
  },
};
