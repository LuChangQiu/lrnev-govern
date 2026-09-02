import type { ModelVisibleRenderer } from '../model-visible-contract.js';
import type { LrnevToolPayload } from '../../types/response-envelope.js';
import type { HookConfig } from '../../../types/hooks.js';

/**
 * lrnev_hook_enable 渲染器
 *
 * MVC required 字段（D-04 写入类）:
 * - name（身份字段）
 * - enabled（状态字段）
 * - ai_followup.instructions（如有）
 */
export const lrnevHookEnableRenderer: ModelVisibleRenderer<HookConfig> = {
  render(payload: LrnevToolPayload<HookConfig>): string {
    if (!payload.ok || !payload.data) {
      return '启用失败';
    }

    const { name, enabled } = payload.data;
    const lines: string[] = [];

    lines.push(`✅ Hook "${name}" 已${enabled ? '启用' : '禁用'}`);
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
