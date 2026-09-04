import type { ModelVisibleRenderer } from '../model-visible-contract.js';
import type { LrnevToolPayload } from '../../types/response-envelope.js';
import type { Task, ReadableTask } from '../../../types/task.js';

/**
 * task_list 渲染器
 *
 * MVC required 字段（D-04 选择/歧义类）:
 * - 完整任务列表：id/title/status/validates/depends_on/parent
 * - 父子关系清晰（parent/children）
 * - claimed_by/expires_at（如有运行态 claim）
 * - ai_followup（如有）
 */
export const taskListRenderer: ModelVisibleRenderer<Task[] | ReadableTask[]> = {
  render(payload: LrnevToolPayload<Task[] | ReadableTask[]>): string {
    if (!payload.ok || !payload.data) {
      return '任务列表读取失败';
    }

    const tasks = payload.data;
    const lines: string[] = [];

    if (tasks.length === 0) {
      lines.push('暂无任务');
      lines.push('');
      if (payload.ai_followup?.instructions) {
        for (const instruction of payload.ai_followup.instructions) {
          lines.push(instruction);
        }
      }
      return lines.join('\n');
    }

    lines.push(`共 ${tasks.length} 个任务：`);
    lines.push('');

    // 区分顶层任务和子任务
    const topLevel = tasks.filter((t) => !t.parent);
    const children = tasks.filter((t) => t.parent);

    // 渲染顶层任务
    for (const task of topLevel) {
      renderTask(task, lines, 0);
      // 渲染其子任务
      const taskChildren = children.filter((t) => t.parent === task.id);
      for (const child of taskChildren) {
        renderTask(child, lines, 1);
      }
    }

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

function renderTask(task: Task | ReadableTask, lines: string[], indent: number): void {
  const prefix = '  '.repeat(indent);
  const statusBadge = formatStatus(task.status);
  lines.push(`${prefix}${task.id} [${statusBadge}] ${task.title}`);

  if (task.validates && task.validates.length > 0) {
    lines.push(`${prefix}  validates: ${task.validates.join(', ')}`);
  }

  if ('depends_on' in task && task.depends_on && task.depends_on.length > 0) {
    lines.push(`${prefix}  depends_on: ${task.depends_on.join(', ')}`);
  }

  if (task.parent) {
    lines.push(`${prefix}  parent: ${task.parent}`);
  }

  // 运行态 claim 信息（仅 Task 类型有）
  if ('claimed_by' in task && task.claimed_by) {
    lines.push(`${prefix}  claimed_by: ${task.claimed_by}`);
  }

  if ('claim_expires_at' in task && task.claim_expires_at) {
    lines.push(`${prefix}  expires_at: ${task.claim_expires_at}`);
  }
}

function formatStatus(status: string): string {
  switch (status) {
    case 'completed':
      return '✓';
    case 'in_progress':
      return '→';
    case 'blocked':
      return '⊗';
    case 'failed':
      return '✗';
    case 'pending':
    default:
      return '○';
  }
}
