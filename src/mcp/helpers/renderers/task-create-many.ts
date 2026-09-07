import type { ModelVisibleRenderer } from '../model-visible-contract.js';
import type { LrnevToolPayload } from '../../types/response-envelope.js';
import type { CreateManyTasksResult } from '../../../types/task.js';

/**
 * task_create_many 渲染器
 *
 * MVC required 字段（D-04 写入类）:
 * - 批量创建成功的 task_id/title 列表与总条数 count
 * - ai_followup.instructions（如有）
 *
 * 原子语义（ADR-0001）：task_create_many 为纯原子 all-or-nothing。
 * 成功时 data 仅 { created, count }，无逐条失败条目；
 * 任一条失败整批不写，错误经信封 errors（ok=false）错误通道返回，
 * 故渲染器不存在"失败条目"渲染分支。
 */
export const taskCreateManyRenderer: ModelVisibleRenderer<CreateManyTasksResult> = {
  render(payload: LrnevToolPayload<CreateManyTasksResult>): string {
    if (!payload.ok || !payload.data) {
      return '批量创建失败';
    }

    const { created, count } = payload.data;
    const lines: string[] = [];

    if (created.length > 0) {
      lines.push(`✅ 已创建 ${count} 个 Task：`);
      for (const task of created) {
        lines.push(`   ${task.id}: ${task.title}`);
      }
      // F-04.2 一致性核对行：data.query_meta 出现时把「请求批=返回数」写进文本通道
      // （原子 all-or-nothing 恒全量创建，truncated 恒 false；此处只处理 none 分支）。
      const queryMeta = payload.data.query_meta;
      if (queryMeta && queryMeta.omitted.kind === 'none') {
        lines.push(`   创建 ${queryMeta.returned_count}/${queryMeta.total_count} 全量成功，无省略`);
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
