/**
 * 03-00-mcp-response-conformance T-002 (M1) + T-004/T-005 (M2)
 *
 * MCP 工具返回适配器：将业务层 AiFollowupResponse 转换为
 * MCP 工具返回格式（content + structuredContent + isError）。
 *
 * M2 阶段（T-004/T-005）：
 * - content 使用 ModelVisibleContract 渲染器（按工具注册，未注册回退 M1）
 * - structuredContent 返回完整 LrnevToolPayload（canonical payload）
 * - isError 基于 shouldSetIsError 规则
 * - D-04 硬性要求：canonical 单源、逃逸层级、体积同步、错误路径 MVC
 */

import type { AiFollowupResponse, ErrorInfo } from '../../types/response.js';
import type { LrnevToolPayload, LrnevErrorInfo } from '../types/response-envelope.js';
import { shouldSetIsError, wrapInternalError } from '../types/response-envelope.js';
import { isLrnevError, ErrorCode } from '../../shared/errors.js';
import { renderModelVisibleContent } from './model-visible-contract.js';
import { errorRenderer } from './renderers/error.js';

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
 * M2 实现（T-004/T-005）：
 * - content: ModelVisibleContract 渲染器（按工具注册，未注册回退 M1）
 * - structuredContent: LrnevToolPayload 格式（canonical payload）
 * - isError: 基于 shouldSetIsError(payload)
 * - D-04: canonical 单源、逃逸层级、体积同步、错误路径 MVC
 *
 * @param promise 业务层返回的 Promise<AiFollowupResponse<T>>
 * @param toolName 工具名称（必填，用于查找 MVC renderer；未注册则回退 legacy JSON）
 * @param legacyRawFormat 已弃用（M2 不再支持，保留参数兼容性）
 * @returns MCP 工具返回对象
 */
export async function toMcpToolResult<T>(
  promise: Promise<AiFollowupResponse<T>>,
  toolName: string,
  legacyRawFormat = false,
): Promise<McpToolResult> {
  try {
    const response = await promise;

    // 步骤 1: 构建 canonical payload (structuredContent)
    const payload: LrnevToolPayload<T> = {
      response_version: '1',
      ok: response.ok,
      data: response.data,
      errors: response.errors?.map(toLrnevErrorInfo),
      ai_followup: response.ai_followup,
      anchor_context: response.anchor_context,
      summary_context: response.summary_context,
    };

    // 步骤 2: 从 canonical payload 渲染 content (D-04 单源)
    const contentText = renderModelVisibleContent(toolName, payload);

    // 步骤 3: 双通道返回
    return {
      content: [{ type: 'text', text: contentText }],
      structuredContent: payload,
      isError: shouldSetIsError(payload),
    };
  } catch (err) {
    // D-04 错误路径：schema 失败返回工具错误，不回退旧文本
    return handleToolError(err);
  }
}

/**
 * 将普通数据包装为 AiFollowupResponse 再转换为 MCP 工具返回。
 *
 * 用于那些返回普通数据类型（非 AiFollowupResponse）的管理器方法。
 *
 * @param promise 返回普通数据的 Promise
 * @param toolName 工具名称（必填，用于查找 MVC renderer；未注册则回退 legacy JSON）
 * @param legacyRawFormat 已弃用（M2 不再支持，保留参数兼容性）
 * @returns MCP 工具返回对象
 */
export async function toMcpToolResultFromData<T>(
  promise: Promise<T>,
  toolName: string,
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

    // M2: 使用 ModelVisibleContract 渲染器
    const contentText = renderModelVisibleContent(toolName, payload);

    return {
      content: [{ type: 'text', text: contentText }],
      structuredContent: payload,
      isError: false,
    };
  } catch (err) {
    return handleToolError(err);
  }
}

/**
 * 统一的错误处理函数（D-04 错误路径 MVC）。
 *
 * D-04 L139-140 硬性要求：
 * - schema 失败不得回退旧文本声称成功
 * - isError=true 时 content 仍满足 ModelVisibleContract
 * - 完整渲染 code/message/hint/details
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

      // M2: 使用 error renderer（D-04 错误路径 MVC）
      const contentText = errorRenderer.render(errorPayload);

      return {
        content: [{ type: 'text', text: contentText }],
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

    // M2: 使用 error renderer（D-04 错误路径 MVC）
    const contentText = errorRenderer.render(errorPayload);

    return {
      content: [{ type: 'text', text: contentText }],
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

  // M2: 使用 error renderer（D-04 错误路径 MVC）
  const contentText = errorRenderer.render(errorPayload);

  return {
    content: [{ type: 'text', text: contentText }],
    structuredContent: errorPayload,
    isError: true,
  };
}
