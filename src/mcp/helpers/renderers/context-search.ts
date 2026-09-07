import type { ModelVisibleRenderer } from '../model-visible-contract.js';
import type { LrnevToolPayload } from '../../types/response-envelope.js';
import type { QueryMeta } from '../../../types/truncation.js';

/**
 * context_search 渲染器
 *
 * 08-00 验证点：MVC required 字段 + ai_followup 投影
 * 注意：ContextSearch 不生成 WORKFLOW_OVERVIEW 条款（该条款属于 SpecManager），
 * 此渲染器只投影 canonical payload 中的搜索结果和 ai_followup（如有）
 *
 * F-04.2：data.query_meta.truncated 时追加省略提示行——文本通道同步告知
 * 客户端「全量命中数 > 返回数」（预算截断）。未截断时不加任何行（正文已完整，
 * 头行「找到 N 个」即全部命中，无需额外噪声）。
 */
export const contextSearchRenderer: ModelVisibleRenderer = {
  render(payload: LrnevToolPayload<{ results: Array<{ uri: string; anchor?: string; l0?: string }>; query_meta?: QueryMeta }>): string {
    if (!payload.ok || !payload.data) {
      return '搜索失败';
    }

    const lines: string[] = [];
    const count = payload.data.results.length;
    lines.push(`🔍 找到 ${count} 个匹配结果`);

    // F-04.2 预算截断提示（省略数 exact 可得；unknown 分支防未来形态直接命中文本层）。
    const meta = payload.data.query_meta;
    if (meta?.truncated) {
      const omittedText = meta.omitted.kind === 'exact'
        ? `预算截断省略 ${meta.omitted.count} 条`
        : '预算截断省略（数量未知）';
      lines.push(`  ⚠️ 命中 ${meta.total_count} 条，仅返回 ${meta.returned_count} 条（${omittedText}）`);
    }
    lines.push('');

    for (const result of payload.data.results) {
      const anchor = result.anchor ? ` [${result.anchor}]` : '';
      lines.push(`- ${result.uri}${anchor}`);
      if (result.l0) {
        lines.push(`  ${result.l0}`);
      }
    }
    lines.push('');

    // ai_followup 渲染（投影 canonical payload 中已有数据）
    if (payload.ai_followup?.instructions) {
      for (const instruction of payload.ai_followup.instructions) {
        lines.push(instruction);
      }
    }

    return lines.join('\n');
  },
};
