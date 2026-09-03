/**
 * 03-00-mcp-response-conformance T-001
 *
 * 规范化 MCP 响应信封与严格输出 Schema。
 *
 * 本文件定义独立 response_version 的 canonical payload、
 * 成功/业务拒绝/歧义/内部错误的严格 outputSchema，
 * 以及 schema/序列化失败的显式错误路径。
 *
 * 职责边界（D-01）：
 * - MCP transport: outputSchema / structuredContent / content / isError / annotations
 * - lrnev application envelope (本层): ok / data / errors / ai_followup / context fields
 * - lrnev Guidance Profile (05，不在本 Spec 范围): 文本角色、来源、执行强度
 */

import type { ErrorCode } from '../../shared/errors.js';
import type { AiFollowup, AnchorContext, SummaryContext } from '../../types/response.js';
import type { LrnevGuidanceItem } from './guidance-profile.js';

/**
 * lrnev MCP 响应信封版本。
 *
 * 独立于 MCP protocol version 和 Guidance Profile version (lrnev.guidance/v1)。
 * 该版本用于标识 lrnev application envelope 自身的结构契约。
 */
export type LrnevResponseVersion = '1';

/**
 * 规范化 MCP 响应信封（D-02）。
 *
 * 这是所有 lrnev MCP 工具的 canonical payload 基础结构。
 * 实际 outputSchema 必须根据各工具业务数据定义必填/可选字段；
 * 不允许用完全无约束的 `Record<string, unknown>` 伪装成 schema。
 *
 * @template T 业务数据类型（必须有明确 schema）
 */
export interface LrnevToolPayload<T = unknown> {
  [key: string]: unknown; // 添加索引签名以兼容 MCP SDK

  /**
   * 响应信封版本，当前固定为 '1'。
   *
   * 该版本独立于：
   * - MCP protocol version
   * - lrnev.guidance Profile version
   * - 各工具的业务 data schema 版本
   */
  response_version: LrnevResponseVersion;

  /**
   * 业务操作成功标记。
   *
   * - true: 操作成功执行，data 包含业务结果
   * - false: 业务拒绝（参数错误、状态机冲突、歧义引用等），errors 必填
   *
   * 注意：ok=false 时 MCP 层 isError 应为 true。
   */
  ok: boolean;

  /**
   * 业务数据。
   *
   * - ok=true 时必填
   * - ok=false 时可选（某些工具在错误时也可能返回部分数据）
   */
  data?: T;

  /**
   * 错误列表。
   *
   * - ok=false 时必填且至少包含一个错误
   * - ok=true 时不应出现
   */
  errors?: LrnevErrorInfo[];

  /**
   * 给客户端 AI 的后续指引（可选）。
   *
   * 用于写入类工具的自然推进，详见 types/response.ts。
   */
  ai_followup?: AiFollowup;

  /**
   * lrnev Guidance Profile v1 结构化 guidance（可选，05-00 T-004 挂载）。
   *
   * 与 ai_followup 等字段并列的顶层可选附加字段，不包装对象、向后兼容：
   * - 通用 MCP 客户端忽略本字段仍可仅靠 ai_followup.instructions / content 文本
   *   正确使用结果（F-07 保留 01 文本降级），故**不 bump response_version**；
   * - 仅 role 化工具（assess_goal / scene_create / spec_create / task_create）携带，
   *   且只在文本通道存在 ROLE_PREFIX 行（五角色前缀行）时由唯一构建源
   *   buildGuidanceView 派生（见 mcp/helpers/tool-result-adapter.ts 单点挂载）；
   * - 派生失败或 Profile/文本冲突时省略本字段 + 诊断日志，绝不翻 ok、
   *   不影响 data/content/errors（D-06）。
   */
  guidance?: LrnevGuidanceItem[];

  /**
   * F-03 任务启动上下文：回填的锚点段落（可选）。
   *
   * task_update(in_progress) / task_claim 时按 task.validates 回填。
   * 无 validates 或无可解析段落时不出现（不回空数组）。
   */
  anchor_context?: AnchorContext[];

  /**
   * F-03 降级档：spec 级摘要（可选）。
   *
   * task 无 validates 时回填 L0/L1 摘要做快速定向。
   * 两者皆无时不出现。
   */
  summary_context?: SummaryContext;
}

/**
 * 规范化错误信息（D-05）。
 *
 * 与 types/response.ts 的 ErrorInfo 保持一致，
 * 但作为 canonical schema 的一部分明确定义。
 */
export interface LrnevErrorInfo {
  /**
   * 稳定错误码。
   *
   * 必须是 shared/errors.ts 中定义的 ErrorCode。
   * 不暴露原始堆栈或内部实现细节。
   */
  code: ErrorCode;

  /**
   * 人类可读错误消息。
   *
   * 应清晰描述错误原因，不包含敏感信息。
   */
  message: string;

  /**
   * 出错的字段或路径（可选）。
   *
   * 例如：'scene'、'spec'、'task_id'
   */
  field?: string;

  /**
   * 修复建议（可选）。
   *
   * 指导用户如何纠正错误或下一步操作。
   */
  hint?: string;

  /**
   * 可供用户选择的候选项（歧义引用时使用）。
   *
   * 当 code=AMBIGUOUS_REF 时，必须包含所有匹配的完整标识符。
   * 客户端应提示用户从中选择或使用更精确的参数重试。
   */
  candidates?: string[];
}

/**
 * MCP isError 映射规则（D-05）。
 *
 * 根据 D-05 语义：lrnev 的 ok=false 都表示"动作未执行"，
 * 应设置 MCP 层 isError=true，让客户端感知失败并触发重试或错误处理。
 *
 * 这避免了手工枚举维护陷阱（新增错误码会被默认忽略），
 * 并确保所有业务拒绝（参数错误、状态冲突、歧义引用）和内部错误
 * 都能被客户端正确识别。
 */
export function shouldSetIsError(payload: LrnevToolPayload<unknown>): boolean {
  return !payload.ok;
}

/**
 * 内部错误的安全包装（D-05）。
 *
 * 捕获未预期的异常，封装为稳定的 INTERNAL_ERROR，
 * 不暴露原始堆栈或实现细节。
 *
 * @param error 原始错误对象
 * @param context 错误上下文描述（用于日志，不返回给客户端）
 */
export function wrapInternalError(error: unknown, context: string): LrnevErrorInfo {
  // 记录原始错误用于调试（实际应使用结构化日志）
  console.error(`[INTERNAL_ERROR] ${context}:`, error);

  return {
    code: 'INTERNAL_ERROR',
    message: '内部错误，操作未完成。',
    hint: '保留错误输出和当前操作上下文，运行 doctor；若可复现请记录到 Errorbook。',
  };
}

/**
 * Schema 校验失败错误（D-05）。
 *
 * 当业务数据无法序列化为声明的 outputSchema 时返回。
 * 不回退为旧文本并声称成功。
 */
export function createSchemaValidationError(schemaName: string, details?: string): LrnevErrorInfo {
  return {
    code: 'INTERNAL_ERROR',
    message: `响应数据不符合 ${schemaName} schema${details ? `: ${details}` : ''}。`,
    hint: '这是实现缺陷；请记录到 Errorbook 并检查工具实现。',
  };
}
