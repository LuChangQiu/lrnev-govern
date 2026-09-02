import type { ModelVisibleRenderer } from '../model-visible-contract.js';
import type { LrnevToolPayload } from '../../types/response-envelope.js';

/**
 * spec_list 渲染器
 *
 * 08-00 验证点：MVC required 字段 + ai_followup 投影
 * 渲染器职责：投影 canonical payload 中已有数据，不再创作 guidance 文本
 */
export const specListRenderer: ModelVisibleRenderer = {
  render(payload: LrnevToolPayload<Array<{ spec: string; status: string; broken?: unknown }>>): string {
    if (!payload.ok || !payload.data) {
      return '列表获取失败';
    }

    const lines: string[] = [];
    lines.push(`📄 Spec 列表（${payload.data.length} 个）`);
    lines.push('');

    for (const spec of payload.data) {
      const status = spec.broken ? ' ⚠️ 损坏' : ` [${spec.status}]`;
      lines.push(`- ${spec.spec}${status}`);
    }
    lines.push('');

    // ai_followup 渲染（投影 canonical payload 中已有数据）
    if (payload.ai_followup?.instructions) {
      for (const instruction of payload.ai_followup.instructions) {
        lines.push(instruction);
      }
    }

    return lines.join('\n');
  },
};
