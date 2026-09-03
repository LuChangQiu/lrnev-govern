/**
 * 05-00-lrnev-guidance-profile T-001
 *
 * Guidance Profile v1 纯函数（唯一构建源 + 冲突诊断 + 发布守卫）。
 *
 * 设计原则（05-00 D-06 / F-07，T-001 裁决 Q3）：
 * - buildGuidanceView 是唯一构建源：从同一语义输入同时派生
 *   textLines（01 文本降级）与 profileItems（结构化），保证两通道同源一致。
 * - normalizeRole 大小写不敏感解析；未知 role 返回 undefined → 降级为普通文本，
 *   绝不升级为 EXECUTION_CONSTRAINT（F-03）。
 * - diagnoseGuidance 冲突显式诊断：前缀与 role 冲突、EXECUTION_CONSTRAINT 缺 source_ref、
 *   RECOMMENDATION 带 server_enforced 等（F-03/F-06）。
 * - assertGuidancePublishable 在冲突时抛错：阻止发布该版本（F-03"冲突时显式诊断并阻止发布"）。
 * - classifyInstructions（T-004 新增）：把"01 文本降级行"（ai_followup.instructions 里
 *   的 ROLE_PREFIX 前缀行）分类为 SemanticGuidanceInput，供挂载单点（tool-result-adapter）
 *   用 buildGuidanceView 派生结构化 guidance。
 *
 * 边界：本文件不 import 任何 envelope / renderer / tool / Manager（T-001 纯增量）；
 * 挂载到响应（挂载点、错误映射）留 T-004。
 */

import {
  GUIDANCE_PROFILE_VERSION,
  GUIDANCE_ROLES,
  ROLE_PREFIX,
  type Enforcement,
  type GuidRole,
} from '../../core/guidance-semantics.js';

import type { LrnevGuidanceItem } from '../types/guidance-profile.js';

// ============================================================
// normalizeRole
// ============================================================

/**
 * 将任意大小写形式的 role 字符串规范化为 UPPER_SNAKE GuidRole。
 *
 * - 大小写不敏感：'fact' / 'FACT' / 'Fact' → 'FACT'。
 * - 未知 role（含 USER_DECISION、拼写错误、空格内含非法值）返回 undefined：
 *   调用方应据此把该条降级为普通文本，绝不升级为 EXECUTION_CONSTRAINT（F-03）。
 *
 * @param raw 待解析的 role 字符串
 * @returns 规范 UPPER_SNAKE 角色；无法识别时 undefined
 */
export function normalizeRole(raw: string): GuidRole | undefined {
  const upper = raw.trim().toUpperCase();
  return GUIDANCE_ROLES.find((role) => role === upper);
}

// ============================================================
// buildGuidanceView —— 唯一构建源
// ============================================================

/**
 * 唯一构建源的语义输入（未结构化/未降级的单条 guidance）。
 *
 * @field role 已知时传 GuidRole；未知或未解析的字符串（大小写均可）由构建器内部 normalize 降级。
 * @field text 01 语义文本（约定不带前缀；构建器保证不强加重复前缀）。
 * @field source_ref / enforcement 仅结构化角色存在时才有意义，随 profileItems 带出。
 */
export interface SemanticGuidanceInput {
  role?: GuidRole | string;
  text: string;
  source_ref?: string;
  enforcement?: Enforcement;
}

/** buildGuidanceView 的输出：01 文本降级 + Profile 结构化，两者同源 1:1。 */
export interface GuidanceView {
  /** 01 文本降级行（挂载时进 ai_followup.instructions / content 文本通道）。 */
  textLines: string[];
  /** Profile 结构化项（含 profile_version；未知 role 的降级项 role 缺省）。 */
  profileItems: LrnevGuidanceItem[];
}

/**
 * 唯一构建源：从同一语义输入同时派生 textLines（01 文本降级）与 profileItems（结构化）。
 *
 * 派生规则（T-001 只定义派生关系；实际挂载到响应留 T-004）：
 * - 已知 role：textLines 行 = `ROLE_PREFIX[role] + text`（若 text 已自带同前缀则不强加，防重复）；
 *   profileItems 项 = { role, text, profile_version, source_ref?, enforcement? }。
 * - 未知 role / role 缺省：降级为普通文本——textLines 行 = text 原样（不加前缀、不升级）；
 *   profileItems 项 role 缺省（纯文本降级项，schema 允许），source_ref / enforcement 不附。
 * - 输出两数组与输入严格 1:1 同序，保证文本通道与结构化通道永远来自同一语义对象（D-06）。
 *
 * @param input 语义输入（每条约 guidance）
 * @returns 同源视图
 */
export function buildGuidanceView(input: readonly SemanticGuidanceInput[]): GuidanceView {
  const textLines: string[] = [];
  const profileItems: LrnevGuidanceItem[] = [];

  for (const { role: rawRole, text, source_ref, enforcement } of input) {
    const role = rawRole === undefined ? undefined : normalizeRole(String(rawRole));
    const prefix = role === undefined ? undefined : ROLE_PREFIX[role];

    // 01 文本降级行：已知角色加前缀（避免与 text 内已有同前缀重复）；未知角色原样普通文本。
    textLines.push(
      prefix !== undefined && !text.startsWith(prefix) ? `${prefix}${text}` : text,
    );

    const item: LrnevGuidanceItem = {
      text,
      profile_version: GUIDANCE_PROFILE_VERSION,
    };
    if (role !== undefined) {
      item.role = role;
      if (source_ref !== undefined && source_ref.trim() !== '') {
        item.source_ref = source_ref;
      }
      if (enforcement !== undefined) {
        item.enforcement = enforcement;
      }
    }
    profileItems.push(item);
  }

  return { textLines, profileItems };
}

// ============================================================
// classifyInstructions —— 文本降级行 → 语义输入（T-004 挂载前置）
// ============================================================

/**
 * 把"01 文本降级行"列表（ai_followup.instructions）分类为 buildGuidanceView 的语义输入。
 *
 * 规则（T-004 裁决 Q4：仅五角色前缀行 → 派生；数据驱动）：
 * - 行首命中某角色的 ROLE_PREFIX（【事实】/【建议】/【决策边界】/【执行约束】/【下一步】）
 *   → 产出 { role: 该角色, text: 去掉行首前缀后的正文 }（text 不带前缀，避免 buildGuidanceView
 *   强加重复前缀）；
 * - 非五角色前缀行（普通待办文本、【重要】等非角色引导）→ 丢弃：Profile 不为其造结构化项，
 *   它们仍只存在于文本通道（裁决 Q4"仅五角色前缀行"）。
 *
 * 与 buildGuidanceView 组合后即满足 D-06"同源一致"：guidance 项与文本行来自同一组语义行，
 * 派生不改变原有 instructions（content 文本字节不变）。
 *
 * @param instructions 文本通道指令行（ai_followup.instructions 或等效源）
 * @returns 按原行序排列的语义输入（仅含角色化行）
 */
export function classifyInstructions(instructions: readonly string[]): SemanticGuidanceInput[] {
  const inputs: SemanticGuidanceInput[] = [];
  for (const line of instructions) {
    const role = roleFromLeadingPrefix(line);
    if (role === undefined) continue;
    inputs.push({ role, text: line.slice(ROLE_PREFIX[role].length) });
  }
  return inputs;
}

// ============================================================
// diagnoseGuidance —— 冲突显式诊断
// ============================================================

/** 诊断种类（每种都对应"冲突 → 阻止发布"的 F-03/F-06 规则面）。 */
export type GuidanceDiagnosisKind =
  /** text 以某个角色前缀开头，但该前缀对应的 role ≠ 声明 role（文本与 Profile 冲突）。 */
  | 'prefix_role_mismatch'
  /** EXECUTION_CONSTRAINT 未携带 source_ref（F-06：真实约束须可回指错误码/校验位置）。 */
  | 'constraint_missing_source_ref'
  /** RECOMMENDATION 携带 server_enforced（结构化 Recommendation 永不阻断）。 */
  | 'recommendation_server_enforced'
  /** DECISION_BOUNDARY 携带 server_enforced（决策边界只约束客户端行为）。 */
  | 'boundary_server_enforced'
  /** EXECUTION_CONSTRAINT 携带 client_boundary（真实约束由服务端先行执行）。 */
  | 'constraint_client_boundary'
  /** FACT / ACTION_HINT / 无 role 项携带 enforcement（隐含 none，'none' 不序列化 → 该字段不该出现）。 */
  | 'enforcement_on_non_enforcing_role';

/** 单条诊断结果。 */
export interface GuidanceDiagnosis {
  /** 冲突项在 items 中的下标（0 起），便于定位。 */
  index: number;
  kind: GuidanceDiagnosisKind;
  /** 人类可读的中文说明。 */
  message: string;
}

/** 各角色隐含的 enforcement（F-06 / 05-00 裁决 Q8）。FACT / ACTION_HINT 隐含 none。 */
const ROLE_IMPLIED_ENFORCEMENT: Partial<Record<GuidRole, Enforcement>> = {
  RECOMMENDATION: 'client_boundary',
  DECISION_BOUNDARY: 'client_boundary',
  EXECUTION_CONSTRAINT: 'server_enforced',
};

/** 由文本开头前缀反查角色（前缀两两互不为前缀，首个命中即唯一）。 */
function roleFromLeadingPrefix(text: string): GuidRole | undefined {
  for (const role of GUIDANCE_ROLES) {
    if (text.startsWith(ROLE_PREFIX[role])) {
      return role;
    }
  }
  return undefined;
}

/** 单条项的 enforcement 冲突诊断（隐含 none 角色或与隐含值矛盾的取值）。 */
function diagnoseEnforcement(item: LrnevGuidanceItem, index: number): GuidanceDiagnosis[] {
  const out: GuidanceDiagnosis[] = [];
  if (item.enforcement === undefined) {
    return out;
  }
  if (item.role === undefined) {
    // 无 role = 纯文本降级项：enforcement 无承载语义（'none' 不序列化）。
    out.push({
      index,
      kind: 'enforcement_on_non_enforcing_role',
      message: `第 ${index} 条为无 role 的降级项却携带 enforcement='${item.enforcement}'；enforcement 仅在可推出语义的角色上出现，'none' 不序列化。`,
    });
    return out;
  }
  const implied = ROLE_IMPLIED_ENFORCEMENT[item.role];
  if (implied === undefined) {
    // FACT / ACTION_HINT 隐含 none → 任何显式 enforcement 都矛盾。
    out.push({
      index,
      kind: 'enforcement_on_non_enforcing_role',
      message: `第 ${index} 条 role=${item.role} 隐含无执行强度，却携带 enforcement='${item.enforcement}'（none 不序列化，应省略字段）。`,
    });
    return out;
  }
  if (implied !== item.enforcement) {
    if (item.role === 'RECOMMENDATION' && item.enforcement === 'server_enforced') {
      out.push({
        index,
        kind: 'recommendation_server_enforced',
        message: `第 ${index} 条 RECOMMENDATION 携带 enforcement='server_enforced'；结构化 Recommendation 永不产生阻断权。`,
      });
    } else if (item.role === 'DECISION_BOUNDARY' && item.enforcement === 'server_enforced') {
      out.push({
        index,
        kind: 'boundary_server_enforced',
        message: `第 ${index} 条 DECISION_BOUNDARY 携带 enforcement='server_enforced'；决策边界只约束客户端行为，不伪装成服务端校验。`,
      });
    } else if (item.role === 'EXECUTION_CONSTRAINT' && item.enforcement === 'client_boundary') {
      out.push({
        index,
        kind: 'constraint_client_boundary',
        message: `第 ${index} 条 EXECUTION_CONSTRAINT 携带 enforcement='client_boundary'；真实约束由服务端先行执行（server_enforced）。`,
      });
    }
  }
  return out;
}

/**
 * 冲突诊断：逐条检查 items，返回全部冲突（不提前短路，供调用方一次性看到完整诊断）。
 *
 * 分支（均对应阻止发布的 F-03/F-06 语义）：
 * - prefix_role_mismatch：text 自带的前缀角色 ≠ 声明 role。
 * - constraint_missing_source_ref：EXECUTION_CONSTRAINT 未给 source_ref。
 * - recommendation_server_enforced / boundary_server_enforced / constraint_client_boundary：
 *   enforcement 与角色隐含执行强度矛盾（F-06）。
 * - enforcement_on_non_enforcing_role：FACT/ACTION_HINT/无 role 项携带 enforcement。
 *
 * 已知 role 且 enforcement 与隐含值一致（如 EXECUTION_CONSTRAINT + server_enforced）不判冲突。
 *
 * @param items Profile 结构化项（挂载发布前的视图）
 * @returns 诊断列表；空数组 = 无冲突
 */
export function diagnoseGuidance(items: readonly LrnevGuidanceItem[]): GuidanceDiagnosis[] {
  const diagnoses: GuidanceDiagnosis[] = [];

  items.forEach((item, index) => {
    // 1) 前缀与 role 冲突
    if (item.role !== undefined) {
      const leadingRole = roleFromLeadingPrefix(item.text);
      if (leadingRole !== undefined && leadingRole !== item.role) {
        diagnoses.push({
          index,
          kind: 'prefix_role_mismatch',
          message: `第 ${index} 条声明 role=${item.role}，但 text 以「${ROLE_PREFIX[leadingRole]}」开头（属于 ${leadingRole}）；文本与 Profile 冲突，不得静默由某一字段胜出。`,
        });
      }
    }

    // 2) EXECUTION_CONSTRAINT 缺 source_ref（真实约束须可回指错误码/校验位置）
    if (
      item.role === 'EXECUTION_CONSTRAINT'
      && (item.source_ref === undefined || item.source_ref.trim() === '')
    ) {
      diagnoses.push({
        index,
        kind: 'constraint_missing_source_ref',
        message: `第 ${index} 条 EXECUTION_CONSTRAINT 未携带 source_ref；真实约束须引用稳定错误码或校验位置（F-06）。`,
      });
    }

    // 3) enforcement 与 role 隐含执行强度冲突
    diagnoses.push(...diagnoseEnforcement(item, index));
  });

  return diagnoses;
}

// ============================================================
// assertGuidancePublishable —— 发布守卫
// ============================================================

/** 发布守卫专用错误：携带完整诊断，供上层（T-004 挂载）映射为错误响应。 */
export class GuidancePublishError extends Error {
  public override readonly name = 'GuidancePublishError';

  /** 触发阻止发布的全部冲突诊断。 */
  public readonly diagnoses: readonly GuidanceDiagnosis[];

  constructor(diagnoses: readonly GuidanceDiagnosis[]) {
    const summary = diagnoses
      .map((d) => `[#${d.index} ${d.kind}] ${d.message}`)
      .join('; ');
    super(`Guidance Profile 存在 ${diagnoses.length} 项冲突，阻止发布该版本：${summary}`);
    this.diagnoses = diagnoses;
  }
}

/**
 * 发布守卫（F-03 纯函数面）：冲突时抛 GuidancePublishError，阻止发布该版本。
 *
 * 无冲突时正常返回（void）。是否允许把"更强字段静默胜出"换成任意字段——本函数一律阻止，
 * 由调用方修正语义源或显式拆分文本/Profile 后再发布。
 *
 * @param items 待发布的 Profile 结构化项
 * @throws GuidancePublishError 当存在任何诊断冲突
 */
export function assertGuidancePublishable(items: readonly LrnevGuidanceItem[]): void {
  const diagnoses = diagnoseGuidance(items);
  if (diagnoses.length > 0) {
    throw new GuidancePublishError(diagnoses);
  }
}
