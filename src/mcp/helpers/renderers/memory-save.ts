import type { ModelVisibleRenderer } from '../model-visible-contract.js';
import type { LrnevToolPayload } from '../../types/response-envelope.js';
import type { Memory } from '../../../types/memory.js';
import { escapeFrameworkMarkers } from '../model-visible-contract.js';

/**
 * memory_save 渲染器
 *
 * MVC required 字段（D-04 写入类）:
 * - id/category（身份字段）
 * - content（逃逸）
 * - path
 * - ai_followup.instructions（如有）
 */
export const memorySaveRenderer: ModelVisibleRenderer<Memory> = {
  render(payload: LrnevToolPayload<Memory>): string {
    if (!payload.ok || !payload.data) {
      return '保存失败';
    }

    const { id, category, content, path } = payload.data;
    const lines: string[] = [];

    lines.push(`✅ 记忆已保存：${id}`);
    lines.push(`   类别: ${category}`);
    lines.push(`   内容: ${escapeFrameworkMarkers(content)}`);
    lines.push(`   路径: ${path}`);
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
