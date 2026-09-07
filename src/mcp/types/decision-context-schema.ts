/**
 * 05-00 lrnev Guidance Profile - decision_context 输入 Schema 与负向校验（T-002）
 *
 * Spec: 05-00-lrnev-guidance-profile（F-04 / D-03）
 * Task: T-002（裁决 Q2 错误表面 A：结构化信封校验；Q6 命名 DecisionContextInput）
 *
 * 本模块是 decision_context 客户端输入的**结构层 + 条件规则**校验（纯函数，无副作用）：
 * - 结构层：source literal 'client_asserted'、strength 枚举、summary 非空 string、
 *   direction 枚举（可选）、target_ref 可选 string；
 *   （reported_user_quote 已按 T-006 裁决 I6 2026-09-07 移除——380 录制件 0 命中 +
 *   服务端零使用 + 客户端转述不可验证，schema/类型/测试同步删除）；
 * - 条件规则（superRefine）：explicit/preferred 必须提供 direction；
 *   unspecified 必须省略 direction——缺失与 unspecified 因此可区分，
 *   也避免把 AI Recommendation 包装成用户方向（requirements F-04）；
 * - 错误显式化：不静默填充任意值；每个 issue 带字段路径（decision_context.xxx）与可读消息。
 *
 * 边界（本任务只做 schema/校验，不接工具、不持久化）：
 * - 不导出任何写路径；被校验对象（无论合法/非法）都只在内存中，绝不落盘；
 * - 本 schema 只校验"已传入的 decision_context 值"；decision_context 整体缺失
 *   （未声明）由 T-003 工具接入层处理，本层不会把缺失改写为 strength=unspecified；
 * - 工具接线（assess_goal/scene_create/spec_create/task_create）与
 *   LrnevError(INVALID_INPUT) 抛出属 T-003，本模块只提供结构化校验结果供其映射。
 */

import * as z from 'zod/v4';
import {
  DECISION_CONTEXT_SOURCE_VALUES,
  DECISION_CONTEXT_STRENGTH_VALUES,
  DECISION_CONTEXT_DIRECTION_VALUES,
  type DecisionContextInput,
  type DecisionContextStrength,
} from '../../types/decision-context.js';

/**
 * 工具参数命名空间前缀：decision_context 在工具参数中位于
 * `args.decision_context`，错误字段路径统一以 `decision_context.` 开头。
 */
const FIELD_PREFIX = 'decision_context';

/**
 * direction 缺失时（explicit/preferred）的可读提示。
 */
function missingDirectionMessage(strength: DecisionContextStrength): string {
  return (
    `strength=${strength} 时必须提供 direction（${FIELD_PREFIX}.direction）` +
    '：显式/倾向的用户决定需要声明方向，避免把 AI Recommendation 包装成用户方向'
  );
}

/**
 * direction 误传时（unspecified）的可读提示。
 */
const FORBIDDEN_DIRECTION_MESSAGE =
  `strength=unspecified 时必须省略 direction（${FIELD_PREFIX}.direction）` +
  '：未指明的上下文不代表任何用户方向，显式 unspecified 只占位不声明方向';

/**
 * DecisionContextInput 结构层 + 条件规则 schema（zod/v4）。
 *
 * 用 `z.ZodType<DecisionContextInput>` 注解让 schema 输出类型与
 * src/types/decision-context.ts 的接口编译期对齐（单一类型来源）。
 *
 * 结构层字段说明：
 * - source:        仅 'client_asserted'（单值枚举）。服务端不得伪造来源；
 * - strength:      'explicit' | 'preferred' | 'unspecified'；
 * - summary:       必填 string，空串/纯空白拒绝；
 * - direction:     可选枚举；条件必填/禁止规则见下方 superRefine；
 * - target_ref:    可选 string；一旦传入就要求非空（须为完整稳定引用；
 *                  引用格式/解析对齐属 T-003，本层不预加格式约束）；
 *                  曾有的 reported_user_quote 可选字段已移除（T-006 裁决 I6，
 *                  2026-09-07：0 命中 + 服务端零使用 + 转述不可验证）。
 */
export const DecisionContextInputSchema: z.ZodType<DecisionContextInput> = z
  .object({
    source: z.enum(DECISION_CONTEXT_SOURCE_VALUES, {
      message: `source 必须是 'client_asserted'（${FIELD_PREFIX} 只接受客户端声明来源，不接受服务端伪造）`,
    }),
    strength: z.enum(DECISION_CONTEXT_STRENGTH_VALUES, {
      message: `strength 必须是 explicit | preferred | unspecified 之一（${FIELD_PREFIX}.strength）`,
    }),
    summary: z
      .string({ message: `summary 必须是字符串（${FIELD_PREFIX}.summary）` })
      .refine((value) => value.trim().length > 0, {
        message: `summary 不能为空或纯空白（${FIELD_PREFIX}.summary）`,
      }),
    direction: z
      .enum(DECISION_CONTEXT_DIRECTION_VALUES, {
        message: `direction 必须是 new_scene | new_spec | reuse_spec | no_spec | other 之一（${FIELD_PREFIX}.direction）`,
      })
      .optional(),
    target_ref: z
      .string({ message: `target_ref 必须是字符串（${FIELD_PREFIX}.target_ref）` })
      .refine((value) => value.trim().length > 0, {
        message:
          `target_ref 不能为空字符串（${FIELD_PREFIX}.target_ref）：声明引用需用完整稳定引用` +
          '（例如 scene=01-user-management, spec=01-00-user-login）；未声明引用时省略该字段',
      })
      .optional(),
  })
  .superRefine((value, ctx) => {
    const { strength, direction } = value;
    if ((strength === 'explicit' || strength === 'preferred') && direction === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['direction'],
        message: missingDirectionMessage(strength),
      });
    }
    if (strength === 'unspecified' && direction !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['direction'],
        message: FORBIDDEN_DIRECTION_MESSAGE,
      });
    }
  });

/**
 * 单条校验失败（错误表面 A 的最小结构化信封）。
 *
 * T-003 可据此抛出 LrnevError(INVALID_INPUT, message, { field }) 或
 * 写入 canonical errors 数组（field 与 message 一一对应）。
 */
export interface DecisionContextValidationIssue {
  /** 工具参数命名空间内的字段路径，如 `decision_context.direction`。 */
  field: string;
  /** 人类可读的校验消息（中文，含字段上下文）。 */
  message: string;
}

/**
 * parseDecisionContextInput 的结构化结果（safeParse 包装，不抛异常）。
 */
export type DecisionContextParseResult =
  | { ok: true; data: DecisionContextInput }
  | { ok: false; errors: DecisionContextValidationIssue[] };

/**
 * 校验一个（可能来自 MCP 工具参数的）decision_context 值。
 *
 * - 合法：返回 { ok: true, data }，data 为完全通过结构层 + 条件规则的输入对象；
 * - 非法：返回 { ok: false, errors }，errors 按 issue 展开，每个含
 *   `decision_context.` 前缀的字段路径与可读消息；不做任何值改写/静默填充；
 * - 纯函数：不触碰文件系统、不持久化、无跨调用状态。
 *
 * 注意：本函数只处理"已传入"的 decision_context 值；整体缺失（undefined）表示
 * "未声明"，语义上不等同 strength=unspecified，其处理属于 T-003 工具接入层
 * （本函数对 undefined 返回显式错误，绝不把缺失改写成 unspecified 声明）。
 */
export function parseDecisionContextInput(raw: unknown): DecisionContextParseResult {
  const parsed = DecisionContextInputSchema.safeParse(raw);
  if (parsed.success) {
    return { ok: true, data: parsed.data };
  }
  const errors: DecisionContextValidationIssue[] = parsed.error.issues.map((issue) => ({
    field:
      issue.path.length === 0
        ? FIELD_PREFIX
        : `${FIELD_PREFIX}.${issue.path.map((segment) => String(segment)).join('.')}`,
    message: issue.message,
  }));
  return { ok: false, errors };
}
