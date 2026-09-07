/**
 * 03-00 F-04 截断语义类型（ADR-0001「截断语义类型选择」accepted 2026-08-28）。
 *
 * 设计动机：单一 `truncated: boolean` 混淆了两种语义——
 * 1. 预算截断（budget truncation）：因体积预算省略了本可获得的内容 → 换查询参数或缩小范围
 * 2. 源残缺（incomplete source）：上游源本身不完整（如段落仍是 FILL 哨兵） → 去补写源文件
 *
 * 类型与字段命名对齐 deepseek-harness output-retention 的语义，
 * 由三方（ClaudeCode / Codex / DeepSeek）统一确认后固化在此。
 */

/** 文本级截断三态。 */
export type TextStatus = 'complete' | 'truncated_by_budget' | 'incomplete_source';

/** 单段文本的截断元数据。original_length 在 text_status !== 'complete' 时提供。 */
export interface TextMeta {
  text_status: TextStatus;
  /** 截断/残缺前原始长度（text_status 为 complete 时不提供）。 */
  original_length?: number;
  /** 实际随响应返回的文本长度（= text.length）。 */
  returned_length: number;
}

/** 查询省略三态：保留 deepseek-harness RetainedItems 语义可追溯性。 */
export type Omitted =
  | { kind: 'none' }
  | { kind: 'exact'; count: number }
  | { kind: 'unknown' };

/**
 * 查询级截断元数据（QueryMeta 四件套）。
 *
 * 关键约束（ADR-0001）：
 * - total_count 不可为 null：lrnev 查询模式是「先全量收集候选，再 slice(0, N) 截断」，
 *   候选总数在截断点总是可得，`null` 分支是死类型。
 * - truncated 对齐 03-00 F-04 原文措辞：「若因预算省略，返回 truncated: true」。
 */
export interface QueryMeta {
  /** 实际返回的项数。 */
  returned_count: number;
  /** 截断前候选总数（总是可得，无 null）。 */
  total_count: number;
  /** 是否因预算截断。 */
  truncated: boolean;
  /** 省略的项（none / exact+count / unknown）。 */
  omitted: Omitted;
}

/** 由「先全量、后截断」的两个计数构造 QueryMeta（omitted 自动取 exact）。 */
export function queryMetaOf(returnedCount: number, totalCount: number): QueryMeta {
  const truncated = returnedCount < totalCount;
  return {
    returned_count: returnedCount,
    total_count: totalCount,
    truncated,
    omitted: truncated ? { kind: 'exact', count: totalCount - returnedCount } : { kind: 'none' },
  };
}

/**
 * 由 clamp 结果构造 TextMeta（complete / truncated_by_budget 两态）。
 * incomplete_source 不在此 helper 内：调用方在检测到源残缺时自行构造。
 */
export function textMetaForClamped(
  clamped: { text: string; truncated: boolean },
  originalLength: number,
): TextMeta {
  return clamped.truncated
    ? { text_status: 'truncated_by_budget', original_length: originalLength, returned_length: clamped.text.length }
    : { text_status: 'complete', returned_length: clamped.text.length };
}
