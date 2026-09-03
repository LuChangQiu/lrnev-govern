/**
 * 05-00-lrnev-guidance-profile T-001
 *
 * Guidance Profile v1 结构化 guidance 的语义对象与 zod schema。
 *
 * 职责边界（05-00 D-01 / D-02）：
 * - MCP transport（03）：本文件不描述 MCP 协议，只定义 lrnev 应用层 Profile 对象。
 * - 01 文本语义：结构化 guidance 保留 01 的角色语义；未知 role 降级为普通文本。
 * - 本层（Profile v1）：role + text + profile_version 是最小集；source_ref / enforcement
 *   只在 role 无法消歧且有 04 证据时按需出现（F-01 逐字段门禁默认 off）。
 *
 * 序列化约定（05-00 裁决 Q4/Q5/Q7/Q8）：
 * - role 输出统一 UPPER_SNAKE（FACT/RECOMMENDATION/...）。
 * - source_ref 不收紧格式：仅要求出现时为非空字符串。
 * - enforcement 出现时取值限 'client_boundary' | 'server_enforced'；'none' 不序列化（省略字段）。
 * - role 缺省合法：表示纯文本降级项（未知 role / 未结构化文本），不得升级为 Constraint。
 *
 * 与 envelope 的关系：本文件不挂载到 LrnevToolPayload / outputSchema（留 T-004），
 * 只定义可被未来挂载复用的对象与 schema。
 */

import * as z from 'zod/v4';

import {
  ENFORCEMENT_VALUES,
  GUIDANCE_ROLES,
  type Enforcement,
  type GuidRole,
} from '../../core/guidance-semantics.js';

/**
 * 单条 Profile v1 guidance 对象。
 *
 * @field role 服务端角色（UPPER_SNAKE）。缺省 = 纯文本降级项（F-03：未知 role 降级为普通文本）。
 * @field text guidance 文本。
 * @field profile_version 该条所属 Profile 版本（当前 GUIDANCE_PROFILE_VERSION='v1'）。
 * @field source_ref 可选来源引用。门禁 off（开启需 04 失败证据）；出现时仅要求非空，不收紧格式。
 * @field enforcement 可选执行强度。门禁 off；'none' 不序列化（省略字段=无强度）。
 */
export interface LrnevGuidanceItem {
  role?: GuidRole;
  text: string;
  profile_version: string;
  source_ref?: string;
  enforcement?: Enforcement;
}

/**
 * LrnevGuidanceItem 的 zod schema。
 *
 * 规则：
 * - role 可选（纯文本降级项合法），值为五角色 UPPER_SNAKE 枚举。
 * - text 必填。
 * - profile_version 必填（Profile 版本独立性，见 core/guidance-semantics.ts 常量注释）。
 * - source_ref 出现时非空字符串（z.string().min(1)，不收紧格式）。
 * - enforcement 出现时取值限两值（'none' 不在 schema 中，即不可序列化）。
 */
export const LrnevGuidanceItemSchema = z.object({
  role: z.enum(GUIDANCE_ROLES).optional(),
  text: z.string().min(1),
  profile_version: z.string().min(1),
  source_ref: z.string().min(1).optional(),
  enforcement: z.enum(ENFORCEMENT_VALUES).optional(),
});

/** LrnevGuidanceItemSchema 推导类型（与 LrnevGuidanceItem 结构一致）。 */
export type ParsedLrnevGuidanceItem = z.infer<typeof LrnevGuidanceItemSchema>;
