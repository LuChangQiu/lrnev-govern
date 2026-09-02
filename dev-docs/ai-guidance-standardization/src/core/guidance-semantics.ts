/**
 * 共享语义常量：Guidance 五角色边界定义
 *
 * 用途：确保跨文件的 guidance 文案语义一致，明确区分 RECOMMENDATION（建议）与 EXECUTION_CONSTRAINT（规则）。
 *
 * 语义边界（见 01-00 语义权威模型）：
 * - RECOMMENDATION: 建议性指引，用户明确决定时可 override
 * - ACTION_HINT: 操作提示，不强制
 * - FACT: 事实陈述，不含判断
 * - EXECUTION_CONSTRAINT: 真实系统约束（状态机/数据库唯一性/Git 冲突），不可 override
 * - USER_DECISION: 用户明确表达的决定（仅限 user_quote / client_asserted 来源）
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
 */
export const SPEC_CREATION_SUCCESS_FOLLOWUP = `
Spec 创建成功后，不得擅自撤销或回退。
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
