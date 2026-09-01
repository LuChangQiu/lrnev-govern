/**
 * 03-00-mcp-response-conformance T-002
 *
 * MCP 工具返回适配器：将业务层 AiFollowupResponse 转换为
 * MCP 工具返回格式（content + structuredContent + isError）。
 *
 * M1 阶段：
 * - content 保持 B1 legacy JSON renderer（JSON.stringify）
 * - structuredContent 返回完整 LrnevToolPayload
 * - isError 基于 shouldSetIsError 规则
 */

import type { AiFollowupResponse, ErrorInfo } from '../../types/response.js';
import type { LrnevToolPayload, LrnevErrorInfo } from '../types/response-envelope.js';
import { shouldSetIsError, wrapInternalError } from '../types/response-envelope.js';
import { isLrnevError, ErrorCode } from '../../shared/errors.js';

/**
 * MCP 工具返回类型
 */
export interface McpToolResult {
  [key: string]: unknown; // 添加索引签名以兼容 MCP SDK
  content: Array<{ type: 'text'; text: string }>;
  structuredContent?: LrnevToolPayload<unknown>;
  isError?: boolean;
}

/**
 * 将 ErrorInfo 转换为 LrnevErrorInfo
 */
function toLrnevErrorInfo(error: ErrorInfo): LrnevErrorInfo {
  return {
    code: error.code as ErrorCode,
    message: error.message,
    field: error.field,
    hint: error.hint,
    candidates: error.candidates,
  };
}

/**
 * 将 AiFollowupResponse 转换为 MCP 工具返回格式。
 *
 * M1 实现：
 * - content: JSON.stringify(完整响应, null, 2) —— 与 B0 legacy renderer 等价
 * - structuredContent: LrnevToolPayload 格式
 * - isError: 基于 shouldSetIsError(payload)
 *
 * @param promise 业务层返回的 Promise<AiFollowupResponse<T>>
 * @param legacyRawFormat 是否使用 B0 legacy 格式（content 直接返回 data，不包装 envelope）；
 *   B0 时期部分只读工具（list/search/doctor 等）直接对 data 做 JSON.stringify，
 *   为保持 content 逐字段等价，这些工具需要传 true。
 * @returns MCP 工具返回对象
 */
export async function toMcpToolResult<T>(
  promise: Promise<AiFollowupResponse<T>>,
  legacyRawFormat = false,
): Promise<McpToolResult> {
  try {
    const response = await promise;

    // 转换为 LrnevToolPayload
    const payload: LrnevToolPayload<T> = {
      response_version: '1',
      ok: response.ok,
      data: response.data,
      errors: response.errors?.map(toLrnevErrorInfo),
      ai_followup: response.ai_followup,
      anchor_context: response.anchor_context,
      summary_context: response.summary_context,
    };

    // B0 兼容：对于 list/search/doctor 等只读工具，content 保持 B0 格式（直接返回 data）
    // 但如果有 ai_followup 或 errors，仍然使用完整 envelope（因为需要传递 followup）
    let legacyContent: string;
    if (legacyRawFormat && response.data !== undefined && !response.ai_followup && !response.errors) {
      legacyContent = JSON.stringify(response.data, null, 2);
    } else {
      legacyContent = JSON.stringify(payload, null, 2);
    }

    return {
      content: [{ type: 'text', text: legacyContent }],
      structuredContent: payload,
      isError: shouldSetIsError(payload),
    };
  } catch (err) {
    return handleToolError(err);
  }
}

/**
 * 将普通数据包装为 AiFollowupResponse 再转换为 MCP 工具返回。
 *
 * 用于那些返回普通数据类型（非 AiFollowupResponse）的管理器方法。
 *
 * @param promise 返回普通数据的 Promise
 * @param legacyRawFormat 是否使用 B0 legacy 格式（content 直接返回 data，不包装 envelope）
 * @returns MCP 工具返回对象
 */
export async function toMcpToolResultFromData<T>(
  promise: Promise<T>,
  legacyRawFormat = false,
): Promise<McpToolResult> {
  try {
    const data = await promise;

    // 转换为 LrnevToolPayload
    const payload: LrnevToolPayload<T> = {
      response_version: '1',
      ok: true,
      data,
    };

    // B0 兼容：对于 list/search/doctor 等只读工具，content 保持 B0 格式（直接返回 data）
    let legacyContent: string;
    if (legacyRawFormat && data !== undefined) {
      legacyContent = JSON.stringify(data, null, 2);
    } else {
      legacyContent = JSON.stringify(payload, null, 2);
    }

    return {
      content: [{ type: 'text', text: legacyContent }],
      structuredContent: payload,
      isError: false,
    };
  } catch (err) {
    return handleToolError(err);
  }
}

/**
 * 统一的错误处理函数
 */
function handleToolError(err: unknown): McpToolResult {
  // 处理业务层抛出的 LrnevError
  if (isLrnevError(err)) {
    // 歧义引用特殊处理（保留候选项和重试指引）
    if (err.code === ErrorCode.AMBIGUOUS_REF) {
      const candidates = err.candidates ?? [];
      const errorInfo = err.toErrorInfo();
      const errorPayload: LrnevToolPayload<undefined> = {
        response_version: '1',
        ok: false,
        errors: [toLrnevErrorInfo(errorInfo)],
        ai_followup: {
          instructions: [
            'Spec 引用不唯一；请从 candidates 中选择一个完整 Spec id，并用该完整 id 重新调用刚才的工具。',
            candidates.length > 0
              ? `候选项：${candidates.join('、')}`
              : '错误信息中没有候选项；请先调用 spec_list 查看完整 Spec id。',
            '确认后使用完整 Spec id 重新调用当前工具；不要继续使用短前缀或纯名称重试。',
          ],
        },
      };

      // Legacy content: 保持与 B0 相同的结构
      const legacyPayload = {
        ok: false,
        errors: [errorInfo],
        ai_followup: errorPayload.ai_followup,
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(legacyPayload, null, 2) }],
        structuredContent: errorPayload,
        isError: true,
      };
    }

    // 其他 LrnevError
    const errorInfo = err.toErrorInfo();
    const errorPayload: LrnevToolPayload<undefined> = {
      response_version: '1',
      ok: false,
      errors: [toLrnevErrorInfo(errorInfo)],
    };

    const legacyPayload = {
      ok: false,
      errors: [errorInfo],
    };

    return {
      content: [{ type: 'text', text: JSON.stringify(legacyPayload, null, 2) }],
      structuredContent: errorPayload,
      isError: true,
    };
  }

  // 未预期的内部错误
  const internalError = wrapInternalError(err, 'toMcpToolResult');
  const errorPayload: LrnevToolPayload<undefined> = {
    response_version: '1',
    ok: false,
    errors: [internalError],
  };

  const legacyPayload = {
    ok: false,
    errors: [internalError],
  };

  return {
    content: [{ type: 'text', text: JSON.stringify(legacyPayload, null, 2) }],
    structuredContent: errorPayload,
    isError: true,
  };
}
