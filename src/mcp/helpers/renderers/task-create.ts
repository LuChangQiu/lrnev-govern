import type { ModelVisibleRenderer } from '../model-visible-contract.js';
import type { LrnevToolPayload } from '../../types/response-envelope.js';

/**
 * task_create 渲染器
 *
 * 08-00 验证点：WORKFLOW_OVERVIEW 条款 + MVC required 字段
 */
export const taskCreateRenderer: ModelVisibleRenderer = {
  render(payload: LrnevToolPayload<{ task_id: string; title: string }>): string {
    if (!payload.ok || !payload.data) {
      return '创建失败';
    }

    const lines: string[] = [];
    lines.push(`✅ Task ${payload.data.task_id} 已创建：${payload.data.title}`);
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
