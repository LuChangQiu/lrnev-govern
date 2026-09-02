import type { ModelVisibleRenderer } from '../model-visible-contract.js';
import type { LrnevToolPayload } from '../../types/response-envelope.js';
import type { CreateManyTasksResult } from '../../../types/task.js';

/**
 * task_create_many 渲染器
 *
 * MVC required 字段（D-04 写入类）:
 * - 批量创建成功的 task_id/title
 * - 失败条目的 error 信息
 * - ai_followup.instructions（如有）
 */
export const taskCreateManyRenderer: ModelVisibleRenderer<CreateManyTasksResult> = {
  render(payload: LrnevToolPayload<CreateManyTasksResult>): string {
    if (!payload.ok || !payload.data) {
      return '批量创建失败';
    }

    const { created, errors } = payload.data;
    const lines: string[] = [];

    if (created.length > 0) {
      lines.push(`✅ 已创建 ${created.length} 个 Task：`);
      for (const task of created) {
        lines.push(`   ${task.id}: ${task.title}`);
      }
      lines.push('');
    }

    if (errors && errors.length > 0) {
      lines.push(`❌ ${errors.length} 个 Task 创建失败：`);
      for (const err of errors) {
        lines.push(`   索引 ${err.index}: ${err.error}`);
      }
      lines.push('');
    }

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
