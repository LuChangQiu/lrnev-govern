/**
 * 05-00 lrnev Guidance Profile - decision_context 客户端输入契约（T-002）
 *
 * Spec: 05-00-lrnev-guidance-profile（F-04 / D-03）
 * Task: T-002（实现 decision_context 输入 Schema 与负向校验）
 *
 * 本文件只声明输入契约的类型与枚举值（唯一来源），不包含任何校验/写入逻辑。
 * 校验见 src/mcp/types/decision-context-schema.ts（zod/v4 结构层 + superRefine 条件规则）。
 *
 * ⚠️ 命名区分：src/types/evidence-contract.ts 已导出 04-00 观测形状的 `DecisionContext`
 * （无 source/summary，direction 允许 null，含 staleness_signals，是
 * 服务端采集到的运行时证据）。本文件的 `DecisionContextInput` 是 05-00 的**客户端请求输入**契约：
 * - source 固定为 'client_asserted'（仅客户端声明，服务端不得伪造 USER_DECISION 来源）；
 * - strength=unspecified 是显式声明，与"未传 decision_context"（缺失 = 未声明）必须可区分；
 * - 只作为本次调用的客户端声明参与建议与决策边界渲染，绝不持久化为 Project Truth/memory。
 *
 * 04 观测形状（DecisionContext）与本输入契约（DecisionContextInput）互不替换、互不修改。
 */

/**
 * decision_context.source 唯一合法值（v1 只接受客户端声明来源）。
 */
export const DECISION_CONTEXT_SOURCE_VALUES = ['client_asserted'] as const;

/**
 * source 字面量类型：仅 client_asserted。
 */
export type DecisionContextSource = (typeof DECISION_CONTEXT_SOURCE_VALUES)[number];

/**
 * decision_context.strength 合法值。
 *
 * - explicit:   用户明确、无歧义的决定（如"新建一个独立 Spec"）；
 * - preferred:  用户倾向（可被服务端建议说服）；
 * - unspecified:客户端无法归类用户的组织方式意图——注意：这是**显式声明**，
 *               与"未传 decision_context"（缺失）语义不同。
 */
export const DECISION_CONTEXT_STRENGTH_VALUES = ['explicit', 'preferred', 'unspecified'] as const;

/**
 * strength 字面量类型。
 */
export type DecisionContextStrength = (typeof DECISION_CONTEXT_STRENGTH_VALUES)[number];

/**
 * decision_context.direction 合法值（v1 粗粒度方向枚举，见 D-03）。
 *
 * - new_scene:  用户决定新建 Scene；
 * - new_spec:   用户决定新建 Spec；
 * - reuse_spec: 用户决定复用已有 Spec；
 * - no_spec:    用户决定不调用 Scene/Spec/Task 落位工具；
 * - other:      不在 v1 枚举内的方向，服务端不自动比较。
 */
export const DECISION_CONTEXT_DIRECTION_VALUES = [
  'new_scene',
  'new_spec',
  'reuse_spec',
  'no_spec',
  'other',
] as const;

/**
 * direction 字面量类型。
 */
export type DecisionContextDirection = (typeof DECISION_CONTEXT_DIRECTION_VALUES)[number];

/**
 * DecisionContextInput - v1 工具可选的 decision_context 客户端输入（仅 client_asserted 来源）。
 *
 * 契约要点（requirements F-04 / design D-03，裁决 Q6 命名）：
 * - source / strength / summary 必填；direction / target_ref 可选；
 * - explicit/preferred 必须提供 direction；unspecified 必须省略 direction（条件规则在
 *   decision-context-schema.ts 用 superRefine 实现）——避免把 AI Recommendation 包装成用户方向；
 * - target_ref 只在用户/客户端声明具体 Scene/Spec 时提供，必须使用完整稳定引用
 *   （如 reuse_spec + scene=01-user-management, spec=01-00-user-login）；
 *   格式解析/对齐属 T-003（解析失败只返回 DECISION_BOUNDARY 提示，不在本层收紧格式）；
 * - reported_user_quote 已按 T-006 裁决（I6，2026-09-07）移除：380 录制件 0 命中 +
 *   服务端零使用 + 客户端转述不可验证 → schema/类型/测试同步删除（见
 *   ai-discussions/结果/2026-09-07-DeepSeek-T006字段裁决.md）；
 * - 缺失（未传 decision_context）是"未声明"，绝不被本契约改写为 strength=unspecified。
 */
export interface DecisionContextInput {
  /** 来源：仅客户端声明（v1 literal）。 */
  source: DecisionContextSource;
  /** 执行强度：explicit | preferred | unspecified。 */
  strength: DecisionContextStrength;
  /** 对用户组织方式决定的简短可读概括（必填、非空）。 */
  summary: string;
  /** 粗粒度方向；explicit/preferred 必填，unspecified 必须省略。 */
  direction?: DecisionContextDirection;
  /** 用户/客户端声明的具体 Scene/Spec 完整稳定引用（可选，非空）。 */
  target_ref?: string;
}
