/**
 * 03-00-mcp-response-conformance M2 (T-004)
 *
 * 错误路径 ModelVisibleContract 渲染器。
 *
 * D-04 L139-140 硬性要求：
 * - schema 失败不得回退旧文本声称成功
 * - isError=true 时 content 仍满足 ModelVisibleContract
 * - 完整渲染 code/message/hint/details
 */

import type { ModelVisibleRenderer } from '../model-visible-contract.js';
import type { LrnevToolPayload } from '../../types/response-envelope.js';

/**
 * 错误路径渲染器（D-04 错误路径 MVC）。
 *
 * 用途：
 * - handleToolError() 使用此渲染器
 * - schema 失败、内部异常时使用
 * - isError=true 的结果仍满足 ModelVisibleContract
 */
export const errorRenderer: ModelVisibleRenderer = {
  render(payload: LrnevToolPayload<unknown>): string {
    const lines: string[] = [];

    // 1. 错误标识
    lines.push('❌ 操作失败');
    lines.push('');

    // 2. 错误详情（D-04：完整 code/message/hint）
    if (payload.errors && payload.errors.length > 0) {
      lines.push('错误详情:');
      for (const err of payload.errors) {
        lines.push(`- [${err.code}] ${err.message}`);
        if (err.hint) {
          lines.push(`  💡 提示: ${err.hint}`);
        }
        // candidates 字段（AMBIGUOUS_REF 时使用）
        if (err.candidates && err.candidates.length > 0) {
          lines.push(`  📋 候选项: ${err.candidates.join('、')}`);
        }
      }
    } else {
      // 兜底：无 errors 字段时的通用错误
      lines.push('未知错误（payload.errors 为空）');
    }

    // 3. 部分数据（某些工具在错误时也可能返回部分数据）
    if (payload.data) {
      lines.push('');
      lines.push('部分数据:');
      lines.push(JSON.stringify(payload.data, null, 2));
    }

    // 4. AI Followup（错误恢复提示）
    if (payload.ai_followup) {
      lines.push('');
      lines.push('恢复建议:');
      // ai_followup.instructions 是字符串数组
      if (payload.ai_followup.instructions) {
        for (const instruction of payload.ai_followup.instructions) {
          lines.push(instruction);
        }
      }

      if (payload.ai_followup.suggested_tools?.length) {
        lines.push('');
        lines.push('建议工具:');
        for (const tool of payload.ai_followup.suggested_tools) {
          lines.push(`- ${tool}`);
        }
      }
    }

    return lines.join('\n');
  },
};
