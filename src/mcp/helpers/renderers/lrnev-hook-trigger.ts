import type { ModelVisibleRenderer } from '../model-visible-contract.js';
import type { LrnevToolPayload } from '../../types/response-envelope.js';
import type { TriggerHookResult } from '../../../types/hooks.js';

/**
 * lrnev_hook_trigger 渲染器
 *
 * MVC required 字段（D-04 写入类）:
 * - event（身份字段；用户文本，由 MVC 出口统一转义）
 * - matched（匹配 hook 数）
 * - warnings（如有）
 * - ai_followup.instructions（如有）
 */
export const lrnevHookTriggerRenderer: ModelVisibleRenderer<TriggerHookResult> = {
  render(payload: LrnevToolPayload<TriggerHookResult>): string {
    if (!payload.ok || !payload.data) {
      return '触发失败';
    }

    const { event, matched, warnings } = payload.data;
    const lines: string[] = [];

    lines.push(`✅ 事件 "${event}" 已触发`);
    lines.push(`   匹配 hook: ${matched} 个`);

    if (warnings && warnings.length > 0) {
      lines.push('');
      lines.push('⚠️ Warnings:');
      for (const warning of warnings) {
        lines.push(`   ${warning}`);
      }
    }
    lines.push('');

    // 投影 ai_followup
    if (payload.ai_followup?.instructions) {
      for (const instruction of payload.ai_followup.instructions) {
        lines.push(instruction);
      }
    }

    return lines.join('\n');
  },
};
