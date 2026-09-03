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
 *
 * 05-00-lrnev-guidance-profile T-004（裁决 Q3/Q4/Q6）：
 * - 本文件是 Profile 的单点挂载：组装 payload 后、返回前，对 allowlist 四工具
 *   （assess_goal/scene_create/spec_create/task_create）在存在 role 化 instructions
 *   （ROLE_PREFIX 前缀行）时，经 classifyInstructions → buildGuidanceView → diagnoseGuidance
 *   产出结构化 guidance 附加到 payload.guidance（与 ai_followup 并列，不包装、不 bump
 *   response_version）。
 * - 派生失败 / 冲突仅省略 guidance + console.error 诊断；绝不翻 ok、不影响
 *   data/content/errors（裁决 Q3：assertGuidancePublishable 是测试/CI 门禁，不在运行时写后抛错）。
 */

import type { AiFollowupResponse, ErrorInfo } from '../../types/response.js';
import type { LrnevToolPayload, LrnevErrorInfo } from '../types/response-envelope.js';
import { shouldSetIsError, wrapInternalError } from '../types/response-envelope.js';
import { isLrnevError, ErrorCode } from '../../shared/errors.js';
import { renderModelVisibleContent } from './model-visible-contract.js';
import { errorRenderer } from './renderers/error.js';
import { classifyInstructions, buildGuidanceView, diagnoseGuidance } from './guidance-profile.js';

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

// ============================================================
// 05-00 T-004: Guidance Profile 单点挂载
// ============================================================

/**
 * 携带 structured guidance 的 v1 工具 allowlist（05-00 requirements 范围，
 * 裁决 Q4：spec_update 等状态/读取工具不携带）。
 *
 * 仅这四个工具的响应会尝试派生 guidance；其余工具即使 ai_followup 含
 * ROLE_PREFIX 行也绝不附加（避免 4 个 handler 各自重复挂载）。
 */
const GUIDANCE_CARRIER_TOOLS: ReadonlySet<string> = new Set([
  'assess_goal',
  'scene_create',
  'spec_create',
  'task_create',
]);

/**
 * 单点挂载：在组装 canonical payload 后、返回前，若工具在 allowlist 且文本通道
 * 存在 ROLE_PREFIX 前缀行，则派生结构化 guidance 并附加到 payload.guidance。
 *
 * 数据驱动（裁决 Q4）：仅五角色前缀行 → classifyInstructions → buildGuidanceView 派生；
 * 文本通道（ai_followup.instructions / content）不被改写 —— 派生只新增同源结构化视图，
 * content 文本字节不变。
 *
 * 降级（裁决 Q3/Q4/D-06）：
 * - 派生失败（抛错）或 diagnoseGuidance 发现冲突 → 只省略 guidance 字段 + console.error
 *   诊断，绝不翻 ok、不改变 data/content/errors；
 * - assertGuidancePublishable 不在运行时写后抛错，只作为测试/CI 发布门禁。
 * - 仅成功响应（payload.ok === true）挂载：错误响应由 errorRenderer 渲染、不投影
 *   instructions，guidance 与其文本通道不一致（无意义）。
 *
 * @param payload 已组装的 canonical payload（将被原地附加 guidance）
 * @param toolName 工具名（allowlist 判定）
 */
function maybeAttachGuidance(payload: LrnevToolPayload<unknown>, toolName: string): void {
  if (!GUIDANCE_CARRIER_TOOLS.has(toolName)) return;
  if (payload.ok !== true) return;

  const instructions = payload.ai_followup?.instructions;
  if (instructions === undefined || instructions.length === 0) return;

  try {
    const semanticInputs = classifyInstructions(instructions);
    if (semanticInputs.length === 0) return; // 无 role 化行 → 无 Profile 语义

    const view = buildGuidanceView(semanticInputs);

    // 冲突显式诊断（D-06）：文本与 Profile 冲突时不允许静默让某一字段胜出 →
    // 省略整组 guidance 并记录诊断，业务结果（data/content/errors）不受影响。
    const diagnoses = diagnoseGuidance(view.profileItems);
    if (diagnoses.length > 0) {
      console.error(
        `[guidance-profile] ${toolName} 文本行存在 ${diagnoses.length} 项 Profile 冲突，` +
          '本次省略 guidance 字段（业务结果不受影响）：' +
          diagnoses.map((d) => `${d.kind}: ${d.message}`).join(' | '),
      );
      return;
    }

    if (view.profileItems.length > 0) {
      payload.guidance = view.profileItems;
    }
  } catch (err) {
    console.error(
      `[guidance-profile] ${toolName} 派生 guidance 失败，省略 guidance 字段（业务结果不受影响）：`,
      err,
    );
  }
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

    // 步骤 1.5 (05-00 T-004): Guidance Profile 单点挂载（失败/冲突仅省略 guidance）
    maybeAttachGuidance(payload as LrnevToolPayload<unknown>, toolName);

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

    // 05-00 T-004: Guidance Profile 单点挂载（fromData 工具不在 allowlist，恒为 no-op）
    maybeAttachGuidance(payload as LrnevToolPayload<unknown>, toolName);

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
      const lrnevError = toLrnevErrorInfo(errorInfo);
      const errorPayload: LrnevToolPayload<undefined> = {
        response_version: '1',
        ok: false,
        errors: [lrnevError],
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
    const lrnevError = toLrnevErrorInfo(errorInfo);
    const errorPayload: LrnevToolPayload<undefined> = {
      response_version: '1',
      ok: false,
      errors: [lrnevError],
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
