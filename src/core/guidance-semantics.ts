/**
 * 共享语义常量：Guidance 角色边界定义与 Guidance Profile 常量
 *
 * 用途：确保跨文件的 guidance 文案语义一致，明确区分 RECOMMENDATION（建议）与 EXECUTION_CONSTRAINT（规则）。
 *
 * 服务端可输出角色 = 下列五角色（见 01-00 语义权威模型 §3、05-00 D-04）：
 * - FACT: 事实陈述，不含判断
 * - RECOMMENDATION: 建议性指引，用户明确决定时可 override
 * - DECISION_BOUNDARY: 客户端 AI 不得未经确认替用户改变明确目标（客户端行为边界）
 * - EXECUTION_CONSTRAINT: 真实系统约束（状态机/数据库唯一性/Git 冲突），不可 override
 * - ACTION_HINT: 操作提示（下一步），不强制
 *
 * USER_DECISION 不是服务端可输出角色：它只能来自客户端 user_quote / client_asserted 声明
 * （01-00 F-03、05-00 requirements"服务端不生成 USER_DECISION"），故不进入服务端输出集常量。
 */

/**
 * 用户决定优先条款（核心常量）
 *
 * 语义：当用户明确决定与 lrnev Recommendation 冲突时，优先尊重用户决定。
 * 适用场景：
 * - spec_create vs 复用已有 Spec 的建议
 * - 开新版（version+1）vs 原地修改的建议
 * - 独立 Spec vs task 扩展的建议
 *
 * 不适用场景（EXECUTION_CONSTRAINT 真实约束）：
 * - 状态机非法转换（如 archived → in_progress）
 * - 数据库唯一性冲突（如重复 Scene/Spec 名称）
 * - Git 操作约束（如未 commit 不能 push）
 */
export const USER_DECISION_PRIORITY_CLAUSE = `
注意：上述建议不是强制规则。若用户已明确要求（例如"帮我新建一个 Spec"、"开一个独立的 Spec"），
即使已有相似 Spec 可以承载，也应尊重用户决定，直接调用对应工具（如 spec_create）。
`.trim();

/**
 * Spec 创建成功后的 followup 指引
 *
 * 语义：创建成功是终态，不诱导 AI 自我回退。
 *
 * 场景：spec_create 成功后，AI 可能怀疑"是不是做错了"，试图撤销。
 * 修复：明确"创建成功后不得擅自撤销"，提供后续步骤建议（context_search / 问用户）。
 *
 * 扩展（G5，2026-09-04，T-027 E-06a/b 观测）：用户后续改主意（如决定改用旧 Spec）
 * 也不构成自动归档依据——archived 是状态机终态，归档决定权在用户。
 */
export const SPEC_CREATION_SUCCESS_FOLLOWUP = `
Spec 创建成功后，不得擅自撤销或回退。
用户后续改变主意（例如决定改用旧 Spec、放弃本 Spec）时，同样不要自动归档或删除本 Spec：
归档（status=archived）是状态机终态动作，只在用户明确要求归档时才用 spec_update 执行；
改主意时可以先向用户说明取舍、询问是否归档，由用户决定。
建议下一步：调用 context_search 查找相关需求，或问用户该 Spec 的具体范围。
`.trim();

/**
 * 三条判断标尺（补充 WORKFLOW_OVERVIEW 的复用/新建判断）
 *
 * 用途：为 AI 提供明确的分流逻辑，减少误判。
 *
 * 标尺 1（整体推翻）：需求/设计整体推翻 → 建议开新版（version+1）保留旧版对照
 * 标尺 2（独立特性）：独立且可验收的新特性 → 通常建议开新 Spec
 * 标尺 3（上下文冷却）：旧 Spec 长时间未动 → 先读摘要，再决定复用、开新版还是独立 Spec
 */
export const SPEC_REUSE_DECISION_RUBRIC = {
  /**
   * 标尺 1：整体推翻 → 开新版
   *
   * 信号：用户说"重写"/"推翻"/"全改"，或新需求与已有 requirements/design 方向相反
   * 建议：开新版（version+1），保留旧版供对照，不删除旧版
   */
  FULL_REWRITE: `
若新需求整体推翻已有 requirements 或 design（而非增量补充），
通常建议开新版（version+1），保留旧版供对照。
  `.trim(),

  /**
   * 标尺 2：独立特性 → 开新 Spec
   *
   * 信号：新特性有独立验收标准、独立交付价值、与已有 Spec 无强依赖
   * 建议：开新 Spec，不强行塞入已有 Spec
   */
  INDEPENDENT_FEATURE: `
若新特性独立且可验收（有明确的 WHEN...THEN 验收标准），
通常建议开新 Spec，而非强行扩展已有 Spec 的范围。
  `.trim(),

  /**
   * 标尺 3：上下文冷却 → 先读摘要
   *
   * 信号：Spec 长时间未动（如 3 个月前创建）、已 completed、或 tasks 已清空
   * 建议：先 context_search 读摘要，确认旧 Spec 范围，再决定复用、开新版还是独立 Spec
   */
  CONTEXT_COOLING: `
若旧 Spec 出现上下文冷却信号（长时间未动、已 completed、tasks 已清空），
建议先调用 context_search 读取摘要，确认旧 Spec 实际范围，再决定复用、开新版还是创建独立 Spec。
  `.trim(),
};

/**
 * GoalAssessor 的职责边界声明
 *
 * 用途：明确 suggested_next_step 是建议而非必须步骤，用户决定可 override。
 */
export const GOAL_ASSESSOR_OVERRIDE_CLAUSE = `
注意：以上 suggested_next_step 是基于启发式的建议，不是强制步骤。
若用户已明确要求独立 Spec（如"帮我新建一个 Spec"），可直接调用 spec_create，无需等待 assess_goal 结果。
`.trim();

// ============================================================
// Guidance Profile 常量（05-00-lrnev-guidance-profile T-001）
// ============================================================
//
// Profile 是 lrnev 的应用层语义契约，独立于：
// - MCP transport protocolVersion（由 @modelcontextprotocol/sdk 协商）
// - response envelope 的 response_version（见 src/mcp/types/response-envelope.ts，当前 '1'）
//
// 它不宣称为 MCP 标准；只供显式适配 Profile 的客户端消费，通用 MCP 客户端回退 01 文本语义。
// 门禁说明（05-00 F-01/D-02，04 逐字段门禁默认 off）：source_ref / enforcement 是可选项，
// 只有在 04 出现对应失败证据或客户端适配收益后才应被启用/收紧；本文件不预加格式约束。

/**
 * Guidance Profile 名称（F-02/D-02）。
 *
 * 独立标识 lrnev 的应用层 guidance 语义，不冒充 MCP 标准。
 * 客户端通过该名称显式声明或经已验证适配器消费 Profile。
 */
export const GUIDANCE_PROFILE_ID = 'lrnev.guidance';

/**
 * Guidance Profile 版本（F-02/D-02）。
 *
 * 独立于 MCP protocolVersion 与 response envelope 的 response_version。
 * 语义变更必须升版本（如 'v2'），不能静默改 v1 语义。
 */
export const GUIDANCE_PROFILE_VERSION = 'v1';

/**
 * 服务端可输出的五种 guidance 角色（01-00 §3 / 05-00 D-04）。
 *
 * 序列化输出统一 UPPER_SNAKE（裁决 Q4）。USER_DECISION 不在其中：
 * 它不是服务端可输出角色，只能来自客户端 user_quote / client_asserted 声明。
 */
export const GUIDANCE_ROLES = [
  'FACT',
  'RECOMMENDATION',
  'DECISION_BOUNDARY',
  'EXECUTION_CONSTRAINT',
  'ACTION_HINT',
] as const;

/** 服务端可输出的 guidance 角色类型（UPPER_SNAKE）。 */
export type GuidRole = (typeof GUIDANCE_ROLES)[number];

/**
 * 角色对应的 01 文本前缀（与 01-00 现有文案前缀一致）。
 *
 * 注意：ACTION_HINT 的前缀是【下一步】（见 01-00 semantic-authority-model 冻结表），
 * 【操作提示】只描述角色含义、不是实际前缀。FACT=【事实】 RECOMMENDATION=【建议】
 * DECISION_BOUNDARY=【决策边界】 EXECUTION_CONSTRAINT=【执行约束】。
 */
export const ROLE_PREFIX: Record<GuidRole, string> = {
  FACT: '【事实】',
  RECOMMENDATION: '【建议】',
  DECISION_BOUNDARY: '【决策边界】',
  EXECUTION_CONSTRAINT: '【执行约束】',
  ACTION_HINT: '【下一步】',
};

/**
 * Profile 序列化 enforcement 值域（05-00 F-06 / 裁决 Q8）。
 *
 * 三维分析框架里的 'none' 不序列化：无执行强度 = 省略 enforcement 字段。
 * RECOMMENDATION/DECISION_BOUNDARY 隐含 client_boundary；EXECUTION_CONSTRAINT 隐含 server_enforced；
 * 出现 enforcement 字段时取值仅限二者。
 * （门禁 off：字段是否需要更多取值由 04 证据决定，见本文件门禁说明。）
 */
export const ENFORCEMENT_VALUES = ['client_boundary', 'server_enforced'] as const;

/** Profile 中可序列化的 enforcement 值。 */
export type Enforcement = (typeof ENFORCEMENT_VALUES)[number];
