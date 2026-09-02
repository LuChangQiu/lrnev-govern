import type { ModelVisibleRenderer } from '../model-visible-contract.js';
import type { LrnevToolPayload } from '../../types/response-envelope.js';
import type { SaveSummaryResult } from '../../../types/summary.js';

/**
 * summarize_save 渲染器
 *
 * MVC required 字段（D-04 写入类）:
 * - uri（身份字段）
 * - saved（level/path列表）
 * - skipped（如有）
 * - ai_followup.instructions（如有）
 */
export const summarizeSaveRenderer: ModelVisibleRenderer<SaveSummaryResult> = {
  render(payload: LrnevToolPayload<SaveSummaryResult>): string {
    if (!payload.ok || !payload.data) {
      return '保存失败';
    }

    const { uri, saved, skipped } = payload.data;
    const lines: string[] = [];

    lines.push(`✅ 摘要已保存：${uri}`);
    lines.push('');

    if (saved.length > 0) {
      lines.push('已保存：');
      for (const item of saved) {
        lines.push(`   ${item.level}: ${item.path}`);
      }
      lines.push('');
    }

    if (skipped.length > 0) {
      lines.push('已跳过：');
      for (const item of skipped) {
        lines.push(`   ${item.level}: ${item.reason}`);
      }
      lines.push('');
    }

    // 投影 ai_followup
    if (payload.ai_followup?.instructions) {
      for (const instruction of payload.ai_followup.instructions) {
        lines.push(instruction);
      }
    }

    return lines.join('\n');
  },
};
