import type { ModelVisibleRenderer } from '../model-visible-contract.js';
import type { LrnevToolPayload } from '../../types/response-envelope.js';
import type { Task } from '../../../types/task.js';

/**
 * task_create 渲染器
 *
 * 08-00 验证点：MVC required 字段 + ai_followup 投影
 * 注意：TaskManager 不生成 WORKFLOW_OVERVIEW 条款（该条款属于 SpecManager），
 * 此渲染器只投影 canonical payload 中的 ai_followup（如有）
 *
 * T-027 修复：身份字段读 data.id（Task 的 schema 键），不再读 data.task_id——
 * Task 数据对象没有 task_id 键（task_id 只是输入参数名），旧写法渲染出 undefined。
 */
export const taskCreateRenderer: ModelVisibleRenderer<Task> = {
  render(payload: LrnevToolPayload<Task>): string {
    if (!payload.ok || !payload.data) {
      return '创建失败';
    }

    const lines: string[] = [];
    lines.push(`✅ Task ${payload.data.id} 已创建：${payload.data.title}`);
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
