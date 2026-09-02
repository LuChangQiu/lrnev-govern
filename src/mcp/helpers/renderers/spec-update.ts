import type { ModelVisibleRenderer } from '../model-visible-contract.js';
import type { LrnevToolPayload } from '../../types/response-envelope.js';

/**
 * spec_update 渲染器
 *
 * 08-00 验证点：WORKFLOW_OVERVIEW 条款 + MVC required 字段
 */
export const specUpdateRenderer: ModelVisibleRenderer = {
  render(payload: LrnevToolPayload<{ scene: string; spec: string; status: string }>): string {
    if (!payload.ok || !payload.data) {
      return '更新失败';
    }

    const lines: string[] = [];
    lines.push(`✅ Spec 状态已更新：${payload.data.scene}/${payload.data.spec} → ${payload.data.status}`);
    lines.push('');

    // ai_followup 渲染
    if (payload.ai_followup?.instructions) {
      for (const instruction of payload.ai_followup.instructions) {
        lines.push(instruction);
      }
    }

    return lines.join('\n');
  },
};
