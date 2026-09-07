import type { ModelVisibleRenderer } from '../model-visible-contract.js';
import type { LrnevToolPayload } from '../../types/response-envelope.js';
import type { Task } from '../../../types/task.js';

/**
 * task_update 渲染器
 *
 * MVC required 字段（D-04 写入类）:
 * - task_id
 * - status（新状态）
 * - title（用户文本，由 MVC 出口统一转义）
 * - ai_followup.instructions（如有）
 *
 * T-027 修复（渲染器投影闭环）：task_update(in_progress)/task_claim 的 anchor_context /
 * summary_context 此前只存在于 structuredContent，文本-only 客户端（opencode 实测）看不到，
 * 而 ai_followup 指引文案又指向它——悬空提示。此处把 envelope 顶层的 anchor_context /
 * summary_context 一并投影进 content 文本（F-03 任务启动上下文文本通道闭环）：
 * - anchor_context 为数组：每锚点一块「锚点上下文 {anchor}（{source}）」+ 正文（服务端已按
 *   ANCHOR_CONTEXT_TOTAL_CAP=1200 / 单段 ≤400 截断，直接投影不再另截断）+ 状态行；
 * - summary_context 为单个对象：投影 source/l0/l1 + 状态行；
 * - 状态行按 F-04.1（ADR-0001）三态标注 text_status（complete / truncated_by_budget /
 *   incomplete_source），给文本客户端同等语义信号。
 */
export const taskUpdateRenderer: ModelVisibleRenderer<Task> = {
  render(payload: LrnevToolPayload<Task>): string {
    if (!payload.ok || !payload.data) {
      return '更新失败';
    }

    const { id, title, status } = payload.data;
    const lines: string[] = [];

    lines.push(`✅ Task ${id} 状态已更新为: ${status}`);
    lines.push(`   标题: ${title}`);
    lines.push('');

    // F-03/T-027：投影 anchor_context / summary_context（正文 + F-04.1 状态标注）
    projectTaskContexts(lines, payload);

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

/**
 * 把 envelope 顶层的 anchor_context（数组）与 summary_context（对象）投影为文本行。
 *
 * 格式约定（task_update / task_claim 共用，保证两工具文本口径一致）：
 * - 每块「标题行 + 正文行（2 空格缩进；正文为空时给占位提示）+ 状态行」；
 * - 状态行按 F-04.1 text_status 三态给出处置语义：
 *   complete             → 正文完整返回；
 *   truncated_by_budget  → 预算截断（服务端已裁），建议缩小范围或查原文；
 *   incomplete_source    → 源残缺，建议去补写 requirements/design；
 * - 体积：正文由服务端截断后送达（ANCHOR_CONTEXT_TOTAL_CAP），此处只投影不截断；
 * - 逃逸：与其它用户文本一致，不在渲染器内转义（MVC 出口统一 escapeFrameworkMarkers）。
 */
export function projectTaskContexts(lines: string[], payload: LrnevToolPayload<unknown>): void {
  // anchor_context：每锚点一块（anchor 正文 = requirements F-xx / design D-xx 段落）
  for (const ctx of payload.anchor_context ?? []) {
    const sourceLabel = ctx.source === 'design' ? 'design.md' : 'requirements.md';
    lines.push(`锚点上下文 ${ctx.anchor}（${sourceLabel}）：`);
    const body = ctx.text ?? '';
    if (body.length > 0) {
      for (const line of body.split('\n')) {
        lines.push(`  ${line}`);
      }
    } else {
      lines.push('  （本锚点无正文回填）');
    }
    lines.push(`  状态：${textStatusLine(ctx.meta?.text_status)}`);
    lines.push('');
  }

  // summary_context：F-03 降级档（spec 级 L0/L1 摘要），单块
  const summary = payload.summary_context;
  if (summary) {
    const sourceLabel = summary.source === 'sidecar' ? 'sidecar 摘要' : 'requirements 内联摘要';
    lines.push(`Spec 摘要上下文（${sourceLabel}）：`);
    if (summary.l0 !== undefined && summary.l0.length > 0) {
      lines.push(`  L0: ${summary.l0}`);
    }
    if (summary.l1 !== undefined && summary.l1.length > 0) {
      lines.push(`  L1: ${summary.l1}`);
    }
    if ((summary.l0 === undefined || summary.l0.length === 0)
      && (summary.l1 === undefined || summary.l1.length === 0)) {
      lines.push('  （本摘要无正文可回填）');
    }
    lines.push(`  状态：${textStatusLine(summary.meta?.text_status)}`);
    lines.push('');
  }
}

/** F-04.1（ADR-0001）三态状态行的处置语义文案。meta 缺失时按未知态防御处理。 */
function textStatusLine(status: 'complete' | 'truncated_by_budget' | 'incomplete_source' | undefined): string {
  switch (status) {
    case 'truncated_by_budget':
      return 'text_status=truncated_by_budget（预算截断，建议缩小范围或查原文）';
    case 'incomplete_source':
      return 'text_status=incomplete_source（该锚点正文未填写——源残缺，建议去补写 requirements/design）';
    case 'complete':
      return 'text_status=complete（正文完整返回）';
    default:
      return 'text_status 未知';
  }
}
