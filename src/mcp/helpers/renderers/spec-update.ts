import type { ModelVisibleRenderer } from '../model-visible-contract.js';
import type { LrnevToolPayload } from '../../types/response-envelope.js';

/**
 * spec_update 渲染器
 *
 * 08-00 验证点：MVC required 字段 + ai_followup 投影
 * 渲染器职责：投影 canonical payload 中已有数据，不再创作 guidance 文本
 */
export const specUpdateRenderer: ModelVisibleRenderer = {
  render(payload: LrnevToolPayload<{ scene: string; spec: string; status: string }>): string {
    if (!payload.ok || !payload.data) {
      return '更新失败';
    }

    const lines: string[] = [];
    lines.push(`✅ Spec 状态已更新：${payload.data.scene}/${payload.data.spec} → ${payload.data.status}`);
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
