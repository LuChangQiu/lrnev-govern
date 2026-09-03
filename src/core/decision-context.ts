/**
 * 05-00 lrnev Guidance Profile - decision_context 对齐纯函数（T-003）
 *
 * Spec: 05-00-lrnev-guidance-profile（F-04/F-05/F-06、D-03/D-04）
 * Task: T-003（接入四个 v1 工具并渲染非阻断决策边界；裁决 Q1/Q4）
 *
 * 本模块提供 T-003 的纯函数层（无副作用、无 I/O、无状态），供
 * src/mcp/tools/index.ts 四工具 handler 接线消费：
 * - alignDirectionWithTool：枚举级 direction × 工具类别对齐
 *   （new_scene→scene_create、new_spec→spec_create、reuse_spec→task_create、
 *    no_spec→不应调用落位工具、other→不自动比较）；
 * - parseTargetRef / sameReference：target_ref 宽容解析与宽松引用比对
 *   （解析失败返回 null，只产生非阻断提示，见裁决 Q4 单次对齐）；
 * - buildBoundaryLines：把“不一致”渲染为【决策边界】前缀文本行
 *   （裁决 Q1：先走文本通道——追加进 ai_followup.instructions，由 MVC
 *    renderer 投影；T-004 挂载结构化时再映射 Profile）；
 * - buildAssessContextLines：assess_goal 写入前用 context 组织
 *   FACT/RECOMMENDATION/DECISION_BOUNDARY 建议文本（最小实现）。
 *
 * 纪律（T-003 / 05-00 红线）：
 * - 不 import src/core/guidance-semantics.ts：并行 agent 正在演进该文件，
 *   前缀文本用本地常量镜像 01-00 ROLE_PREFIX（DECISION_BOUNDARY=【决策边界】
 *   等，guidance-semantics.ts ROLE_PREFIX 当前同值）；T-004 与 Profile 合流
 *   时再统一为单一来源。
 * - 不解析 summary 语义、不回显 reported_user_quote、不持久化、不写入
 *   Project Truth/memory；行内只引用“客户端声明”，服务端不输出 USER_DECISION，
 *   不声称读取用户原话（D-04）。
 * - 只做“当前调用”的枚举级核对；任何不一致都只产生提示行，绝不阻断请求、
 *   不重写动作、不自动回滚（F-05/D-03）。
 */

import type { DecisionContextDirection, DecisionContextInput } from '../types/decision-context.js';

/** 01-00 文本角色前缀（本地镜像 ROLE_PREFIX，见文件头纪律说明）。 */
export const FACT_PREFIX = '【事实】';
/** 01-00 文本角色前缀（本地镜像 ROLE_PREFIX）。 */
export const RECOMMENDATION_PREFIX = '【建议】';
/** 01-00 文本角色前缀（本地镜像 ROLE_PREFIX；DECISION_BOUNDARY=【决策边界】）。 */
export const DECISION_BOUNDARY_PREFIX = '【决策边界】';

/**
 * 参与 direction × 工具类别对齐的落位工具集合（v1 固定，见 F-04）。
 *
 * assess_goal 是写入前的评估工具、spec_update 等非 v1 工具不参与对齐。
 */
const PLACEMENT_TOOL_NAMES: ReadonlySet<string> = new Set(['scene_create', 'spec_create', 'task_create']);

/**
 * direction → 期望落位动作的描述（用于不一致提示行）。
 */
const DIRECTION_EXPECTED_ACTION: Readonly<Record<string, string>> = {
  new_scene: 'scene_create（新建 Scene）',
  new_spec: 'spec_create（新建 Spec）',
  reuse_spec: 'task_create（在已有 Spec 下创建 Task）',
  no_spec: '不调用 Scene/Spec/Task 落位工具',
};

/** direction × 工具类别对齐结果。 */
export type DirectionAlignment = 'aligned' | 'mismatch' | 'not_applicable';

/**
 * 该工具是否参与 direction × 工具类别对齐（F-05：仅三个 v1 写入工具参与）。
 *
 * assess_goal / spec_update / 读取工具返回 false。
 */
export function shouldCompareDirection(toolName: string): boolean {
  return PLACEMENT_TOOL_NAMES.has(toolName);
}

/**
 * 枚举级对齐：direction 与当前工具类别是否一致（D-03/F-05）。
 *
 * - new_scene→scene_create、new_spec→spec_create、reuse_spec→task_create：一致返回 aligned；
 * - no_spec：调用落位工具即 mismatch（no_spec 表示不应调用 Scene/Spec/Task 落位工具）；
 * - other：不自动比较 → not_applicable；
 * - direction 缺失（undefined）或工具不在落位集合：not_applicable。
 *
 * 纯枚举比较：不做文本语义解析；结果只用于决定是否生成非阻断提示。
 */
export function alignDirectionWithTool(
  direction: DecisionContextDirection | undefined,
  toolName: string,
): DirectionAlignment {
  if (!shouldCompareDirection(toolName)) return 'not_applicable';
  if (direction === undefined || direction === 'other') return 'not_applicable';
  if (direction === 'no_spec') return 'mismatch';
  const expectedTool = directionToPlacementTool(direction);
  if (expectedTool === undefined) return 'not_applicable';
  return expectedTool === toolName ? 'aligned' : 'mismatch';
}

/**
 * direction → 期望的落位工具（new_scene→scene_create 等）；无映射返回 undefined。
 */
export function directionToPlacementTool(
  direction: DecisionContextDirection,
): 'scene_create' | 'spec_create' | 'task_create' | undefined {
  switch (direction) {
    case 'new_scene':
      return 'scene_create';
    case 'new_spec':
      return 'spec_create';
    case 'reuse_spec':
      return 'task_create';
    case 'no_spec':
    case 'other':
      return undefined;
  }
}

/** parseTargetRef 的解析结果：仅收录能识别出的 scene/spec 引用。 */
export interface ParsedTargetRef {
  /** 解析出的 scene 引用 token（如 01-user-management）。 */
  scene?: string;
  /** 解析出的 spec 引用 token（如 01-00-user-login）。 */
  spec?: string;
}

/**
 * 宽容解析 target_ref（形如 'scene=01-user-management, spec=01-00-user-login'）。
 *
 * - 容忍逗号/顿号/分号/空白分隔与多余噪音片段；值取首个匹配；
 * - 至少解析出一个 scene= 或 spec= 键值对才算成功；
 * - 完全无法解析（无任何 scene=/spec= 键值对）返回 null——调用方只把它
 *   翻译成【决策边界】提示，不阻断请求（裁决 Q4）。
 *
 * 纯解析：值原样保留（不剥序号、不解析语义），引用比对用 sameReference。
 */
export function parseTargetRef(targetRef: string): ParsedTargetRef | null {
  if (typeof targetRef !== 'string' || targetRef.trim().length === 0) return null;

  const parsed: ParsedTargetRef = {};
  const pairPattern = /\b(scene|spec)\s*=\s*([^\s,，;；]+)/g;
  let matched = false;
  let match: RegExpExecArray | null;
  while ((match = pairPattern.exec(targetRef)) !== null) {
    const key = match[1]!.toLowerCase();
    const value = match[2]!.trim();
    if (value.length === 0) continue;
    matched = true;
    if (key === 'scene' && parsed.scene === undefined) parsed.scene = value;
    if (key === 'spec' && parsed.spec === undefined) parsed.spec = value;
  }

  return matched ? parsed : null;
}

/**
 * 宽松引用比对（target_ref token 与本次调用参数之间）。
 *
 * 相同判据（任一命中即视为一致）：
 * - 原串相等；
 * - 去掉全数字段（如 序号/版本 前缀）后的核心名称相等（大小写不敏感），
 *   如 '01-user-management' ≡ 'user-management'、'01-00-user-login' ≡ 'user-login'；
 * - 两侧都是纯数字且数值相等（如 '01' ≡ '1'）。
 *
 * 宽容度优先：比对只决定是否产生非阻断提示，宁可少报误报也不做严格文本语义解析。
 * 空值由调用方预先判断，本函数假设两侧均非空。
 */
export function sameReference(declared: string, invoked: string): boolean {
  const left = declared.trim();
  const right = invoked.trim();
  if (left.length === 0 || right.length === 0) return false;
  if (left === right) return true;

  const leftCore = coreName(left);
  const rightCore = coreName(right);
  if (leftCore.length > 0 && rightCore.length > 0 && leftCore === rightCore) return true;

  // 序号等价只在至少一侧是“纯数字/无核心名称”时生效：
  // 两个核心名称不同但前导数字相同的 token（如 01-user-management vs 01-billing）
  // 是两个不同实体，不视为一致。
  if (leftCore.length === 0 || rightCore.length === 0) {
    const leftNum = leadingNumber(left);
    const rightNum = leadingNumber(right);
    if (leftNum !== undefined && rightNum !== undefined && leftNum === rightNum) return true;
  }

  return false;
}

/** 取 token 去掉前导数字段后的核心名称（'01-00-user-login' → 'user-login'）。 */
function coreName(token: string): string {
  return token
    .split('-')
    .filter((segment) => !/^\d+$/.test(segment))
    .join('-')
    .toLowerCase();
}

/** 取 token 前导数字段的数值（'01-user-management' → 1；纯 '1' → 1；无数字段返回 undefined）。 */
function leadingNumber(token: string): number | undefined {
  const match = /^0*(\d+)/.exec(token);
  if (match === null) return undefined;
  const value = Number(match[1]);
  return Number.isSafeInteger(value) ? value : undefined;
}

/** buildBoundaryLines 的入参：本次调用与客户端声明的全部对齐信息。 */
export interface DecisionBoundaryCheckInput {
  /** 本次实际调用的工具名（v1 写入工具 scene_create / spec_create / task_create）。 */
  toolName: string;
  /** 已通过 parseDecisionContextInput 完整校验的客户端声明。 */
  context: DecisionContextInput;
  /**
   * 本次调用与 target_ref 比对的参数（按工具提供，能比才比）：
   * - scene_create：name（新建 Scene 名称）；target_ref.scene 名称部分与之比对；
   * - spec_create：scene（可选，缺省不比对）与 name（新建 Spec 名称）；
   * - task_create：scene 与 spec。
   */
  call?: {
    scene?: string;
    spec?: string;
    name?: string;
  };
}

/**
 * 生成非阻断【决策边界】文本行（不一致时才产出行；一致返回空数组）。
 *
 * 维度 1：direction × 工具类别（alignDirectionWithTool 为 mismatch 时）；
 * 维度 2：target_ref 与本次调用参数的单次核对（解析失败 / 不一致时）。
 *
 * 所有行都以【决策边界】开头并遵循：
 * - 不解析 summary、不回显 reported_user_quote、不包含 USER_DECISION；
 * - 说明“本次请求已正常执行”，把后续决定权交给客户端 AI 与用户确认，
 *   不阻断、不重写、不回滚（F-05/D-03）。
 */
export function buildBoundaryLines(input: DecisionBoundaryCheckInput): string[] {
  const { toolName, context, call } = input;
  const lines: string[] = [];

  // 维度 1：direction × 工具类别
  if (context.direction !== undefined) {
    const alignment = alignDirectionWithTool(context.direction, toolName);
    if (alignment === 'mismatch') {
      lines.push(formatDirectionBoundaryLine(toolName, context.direction));
    }
  }

  // 维度 2：target_ref 与本次调用参数的单次核对（只对落位工具）
  if (context.target_ref !== undefined && shouldCompareDirection(toolName)) {
    const parsed = parseTargetRef(context.target_ref);
    if (parsed === null) {
      lines.push(formatTargetRefUnparseableLine(toolName, context.target_ref));
    } else {
      const mismatches: Array<{ label: string; declared: string; invoked: string }> = [];
      if (toolName === 'scene_create') {
        if (parsed.scene !== undefined && call?.name !== undefined) {
          pushIfMismatch(mismatches, 'scene', parsed.scene, call.name);
        }
      } else if (toolName === 'spec_create') {
        if (parsed.scene !== undefined && call?.scene !== undefined) {
          pushIfMismatch(mismatches, 'scene', parsed.scene, call.scene);
        }
        if (parsed.spec !== undefined && call?.name !== undefined) {
          pushIfMismatch(mismatches, 'spec', parsed.spec, call.name);
        }
      } else if (toolName === 'task_create') {
        if (parsed.scene !== undefined && call?.scene !== undefined) {
          pushIfMismatch(mismatches, 'scene', parsed.scene, call.scene);
        }
        if (parsed.spec !== undefined && call?.spec !== undefined) {
          pushIfMismatch(mismatches, 'spec', parsed.spec, call.spec);
        }
      }
      for (const mismatch of mismatches) {
        lines.push(formatTargetRefMismatchLine(toolName, mismatch));
      }
    }
  }

  return lines;
}

/** 生成 direction × 工具类别不一致的【决策边界】行。 */
export function formatDirectionBoundaryLine(
  toolName: string,
  direction: DecisionContextDirection,
): string {
  const expected = DIRECTION_EXPECTED_ACTION[direction] ?? '按声明方向执行';
  return (
    `${DECISION_BOUNDARY_PREFIX}客户端声明 direction=${direction}（预期动作：${expected}），` +
    `但本次调用的是 ${toolName}。本次请求已正常执行，不阻断；若与用户真实目标不符，` +
    `请先向用户确认，不要擅自回滚、改写执行动作或替用户改变目标。`
  );
}

/** 生成 target_ref 无法解析的【决策边界】提示行（裁决 Q4：解析失败仅提示）。 */
export function formatTargetRefUnparseableLine(toolName: string, targetRef: string): string {
  return (
    `${DECISION_BOUNDARY_PREFIX}无法解析客户端声明的 target_ref "${targetRef}"` +
    `（期望完整稳定引用，如 scene=01-user-management, spec=01-00-user-login）：` +
    `本次 ${toolName} 调用无法与该引用核对。仅提示、不阻断；如需核对请使用完整稳定引用重新声明。`
  );
}

/** 生成 target_ref 与本次调用参数不一致的【决策边界】行。 */
export function formatTargetRefMismatchLine(
  toolName: string,
  mismatch: { label: string; declared: string; invoked: string },
): string {
  return (
    `${DECISION_BOUNDARY_PREFIX}客户端 target_ref 声明的 ${mismatch.label} "${mismatch.declared}"` +
    ` 与本次 ${toolName} 调用参数 ${mismatch.label} "${mismatch.invoked}" 不一致。` +
    `本次请求已正常执行，不阻断；若与用户真实目标不符，请先向用户确认，不要擅自回滚或改写。`
  );
}

/** 把可能不一致的比对对收集进 mismatches。 */
function pushIfMismatch(
  mismatches: Array<{ label: string; declared: string; invoked: string }>,
  label: string,
  declared: string,
  invoked: string,
): void {
  if (!sameReference(declared, invoked)) {
    mismatches.push({ label, declared, invoked });
  }
}

/**
 * assess_goal 写入前的 context 组织行（最小实现，裁决 Q1/Q5：评估非写入、
 * 不做 IO 校验；真实 Constraint 仍由写入工具执行时校验）。
 *
 * - 无 direction（含 strength=unspecified）不追加任何行；
 * - 有 direction：先给一条【事实】（陈述收到 client_asserted 声明，不声称验证），
 *   再按方向给一条【建议】或（no_spec 时）【决策边界】；
 * - 不解析 summary、不回显 reported_user_quote；不产生 USER_DECISION。
 */
export function buildAssessContextLines(context: DecisionContextInput): string[] {
  const direction = context.direction;
  if (direction === undefined) return [];

  const factLine =
    `${FACT_PREFIX}本次请求携带客户端声明：direction=${direction}、strength=${context.strength}` +
    '（source=client_asserted，服务端未验证该声明内容，仅作参考输入）。';

  if (direction === 'no_spec') {
    return [
      factLine,
      `${DECISION_BOUNDARY_PREFIX}客户端声明 no_spec（不调用 Scene/Spec/Task 落位工具）：` +
        '以上评估结果仅作参考，请勿未经用户确认调用 scene_create / spec_create / task_create 落位。',
    ];
  }

  if (direction === 'other') {
    return [
      factLine,
      `${FACT_PREFIX}direction=other 不在 v1 粗粒度枚举内：服务端不自动比较其与工具类别的对齐，评估照常输出参考建议。`,
    ];
  }

  const expectedTool = directionToPlacementTool(direction);
  const expectedText = expectedTool !== undefined
    ? `（如要落位应使用 ${expectedTool}）`
    : '';
  if (context.strength === 'explicit') {
    return [
      factLine,
      `${RECOMMENDATION_PREFIX}评估输出只是启发式建议：客户端已声明方向 ${direction}${expectedText}。` +
        '若评估结论与其冲突，应以用户已表达目标为准推进，不必等待评估结论；不得把评估建议包装成用户方向。',
    ];
  }
  return [
    factLine,
    `${RECOMMENDATION_PREFIX}客户端倾向方向 ${direction}（strength=preferred）${expectedText}：` +
      '若评估建议与之冲突，请先向用户确认再决定推进方式。',
  ];
}
