import type { ModelVisibleRenderer } from '../model-visible-contract.js';
import type { LrnevToolPayload } from '../../types/response-envelope.js';
import type { Task } from '../../../types/task.js';
import { escapeFrameworkMarkers } from '../model-visible-contract.js';

/**
 * task_update 渲染器
 *
 * MVC required 字段（D-04 写入类）:
 * - task_id
 * - status（新状态）
 * - title（逃逸）
 * - ai_followup.instructions（如有）
 */
export const taskUpdateRenderer: ModelVisibleRenderer<Task> = {
  render(payload: LrnevToolPayload<Task>): string {
    if (!payload.ok || !payload.data) {
      return '更新失败';
    }

    const { id, title, status } = payload.data;
    const lines: string[] = [];

    lines.push(`✅ Task ${id} 状态已更新为: ${status}`);
    lines.push(`   标题: ${escapeFrameworkMarkers(title)}`);
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
