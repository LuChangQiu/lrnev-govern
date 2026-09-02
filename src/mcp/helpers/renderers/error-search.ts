import type { ModelVisibleRenderer } from '../model-visible-contract.js';
import type { LrnevToolPayload } from '../../types/response-envelope.js';
import type { ErrorEntry } from '../../../types/errorbook.js';
import { escapeFrameworkMarkers } from '../model-visible-contract.js';

/**
 * error_search 渲染器
 *
 * MVC required 字段（D-04 搜索/列表类）：
 * - 全部错误条目列表
 * - 每个条目的关键字段：id, fingerprint, status, occurrence_count, symptom, root_cause, fix_action
 * - symptom/root_cause/fix_action 必须逃逸（用户文本）
 * - ai_followup 投影
 */
export const errorSearchRenderer: ModelVisibleRenderer<ErrorEntry[]> = {
  render(payload: LrnevToolPayload<ErrorEntry[]>): string {
    if (!payload.ok || !payload.data) {
      return '搜索失败';
    }

    const lines: string[] = [];
    const count = payload.data.length;

    lines.push(`🔍 找到 ${count} 个错误条目`);
    lines.push('');

    if (count === 0) {
      lines.push('无匹配结果。');
    } else {
      for (const error of payload.data) {
        lines.push(`## ${error.id}`);
        lines.push(`   指纹: ${error.fingerprint}`);
        lines.push(`   状态: ${error.status}`);
        lines.push(`   出现次数: ${error.occurrence_count}`);
        lines.push(`   首次: ${error.first_seen}`);
        lines.push(`   最近: ${error.last_seen}`);
        lines.push(`   症状: ${escapeFrameworkMarkers(error.body.symptom)}`);
        lines.push(`   根因: ${escapeFrameworkMarkers(error.body.root_cause)}`);
        lines.push(`   修复: ${escapeFrameworkMarkers(error.body.fix_action)}`);
        if (error.body.verification) {
          lines.push(`   验证: ${escapeFrameworkMarkers(error.body.verification)}`);
        }
        if (error.tags && error.tags.length > 0) {
          lines.push(`   标签: ${error.tags.join(', ')}`);
        }
        lines.push('');
      }
    }

    // ai_followup 投影
    if (payload.ai_followup?.instructions) {
      for (const instruction of payload.ai_followup.instructions) {
        lines.push(instruction);
      }
    }

    return lines.join('\n');
  },
};
