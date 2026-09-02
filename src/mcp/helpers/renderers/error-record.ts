import type { ModelVisibleRenderer } from '../model-visible-contract.js';
import type { LrnevToolPayload } from '../../types/response-envelope.js';
import type { ErrorEntry } from '../../../types/errorbook.js';
import { escapeFrameworkMarkers } from '../model-visible-contract.js';

/**
 * error_record 渲染器
 *
 * MVC required 字段（D-04 写入类）:
 * - id/fingerprint（身份字段）
 * - status（incidents）
 * - symptom/root_cause/fix_action（逃逸）
 * - occurrence_count
 * - path
 * - ai_followup.instructions（如有）
 */
export const errorRecordRenderer: ModelVisibleRenderer<ErrorEntry> = {
  render(payload: LrnevToolPayload<ErrorEntry>): string {
    if (!payload.ok || !payload.data) {
      return '记录失败';
    }

    const { id, fingerprint, status, occurrence_count, path, body } = payload.data;
    const lines: string[] = [];

    lines.push(`✅ 错误已记录：${id}`);
    lines.push(`   指纹: ${fingerprint}`);
    lines.push(`   状态: ${status}`);
    lines.push(`   出现次数: ${occurrence_count}`);
    lines.push(`   症状: ${escapeFrameworkMarkers(body.symptom)}`);
    lines.push(`   根因: ${escapeFrameworkMarkers(body.root_cause)}`);
    lines.push(`   修复: ${escapeFrameworkMarkers(body.fix_action)}`);
    lines.push(`   路径: ${path}`);
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
