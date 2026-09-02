import type { ModelVisibleRenderer } from '../model-visible-contract.js';
import type { LrnevToolPayload } from '../../types/response-envelope.js';

/**
 * context_search 渲染器
 *
 * 08-00 验证点：WORKFLOW_OVERVIEW 条款 + MVC required 字段
 */
export const contextSearchRenderer: ModelVisibleRenderer = {
  render(payload: LrnevToolPayload<{ results: Array<{ uri: string; anchor?: string; l0?: string }> }>): string {
    if (!payload.ok || !payload.data) {
      return '搜索失败';
    }

    const lines: string[] = [];
    const count = payload.data.results.length;
    lines.push(`🔍 找到 ${count} 个匹配结果`);
    lines.push('');

    for (const result of payload.data.results) {
      const anchor = result.anchor ? ` [${result.anchor}]` : '';
      lines.push(`- ${result.uri}${anchor}`);
      if (result.l0) {
        lines.push(`  ${result.l0}`);
      }
    }
    lines.push('');

    // ai_followup 渲染
    if (payload.ai_followup?.instructions) {
      for (const instruction of payload.ai_followup.instructions) {
        lines.push(instruction);
      }
    }

    return lines.join('\n');
  },
};
