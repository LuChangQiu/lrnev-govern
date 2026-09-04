import type { ModelVisibleRenderer } from '../model-visible-contract.js';
import type { LrnevToolPayload } from '../../types/response-envelope.js';
import type { Memory } from '../../../types/memory.js';

/**
 * memory_search 渲染器
 *
 * MVC required 字段（D-04 搜索/列表类）：
 * - 全部记忆条目列表
 * - 每个条目的关键字段：id, category, content, source, created
 * - content（用户文本，由 MVC 出口统一转义）
 * - ai_followup 投影（如有）
 */
export const memorySearchRenderer: ModelVisibleRenderer<Memory[]> = {
  render(payload: LrnevToolPayload<Memory[]>): string {
    if (!payload.ok || !payload.data) {
      return '搜索失败';
    }

    const lines: string[] = [];
    const count = payload.data.length;

    lines.push(`🔍 找到 ${count} 条记忆`);
    lines.push('');

    if (count === 0) {
      lines.push('无匹配结果。');
    } else {
      for (const memory of payload.data) {
        lines.push(`## ${memory.id}`);
        lines.push(`   分类: ${memory.category}`);
        lines.push(`   内容: ${memory.content}`);
        lines.push(`   来源: ${memory.source}`);
        lines.push(`   创建: ${memory.created}`);
        if (memory.tentative) {
          lines.push(`   不确定: 是`);
        }
        if (memory.reference_count && memory.reference_count > 0) {
          lines.push(`   引用次数: ${memory.reference_count}`);
        }
        lines.push('');
      }
    }

    // ai_followup 投影（如有）
    if (payload.ai_followup?.instructions) {
      for (const instruction of payload.ai_followup.instructions) {
        lines.push(instruction);
      }
    }

    return lines.join('\n');
  },
};
