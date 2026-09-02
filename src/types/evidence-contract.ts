/**
 * 04-00 Agent E2E Observability - 证据数据契约（B0-pre）
 *
 * 定义运行时证据的完整数据契约（24 字段）。
 * 用于采集 B0/B1/B2a/B2b/B3 各阶段的 guidance 消费证据。
 *
 * Spec: 04-00-agent-e2e-observability
 * Task: T-013
 */

/**
 * Decision Context - 决策上下文
 */
export interface DecisionContext {
  strength: 'explicit' | 'preferred' | 'unspecified';
  direction: 'new_spec' | 'reuse_spec' | 'new_scene' | 'no_spec' | 'other' | null;
  target_ref?: string;
  staleness_signals?: string[];
}

/**
 * Evidence Contract - 证据数据契约（完整 24 字段）
 */
export interface EvidenceContract {
  // ============================================================
  // 基础字段（6）
  // ============================================================

  /**
   * 被消费的 surface ID
   * 格式：channel:category:name
   * 例如：server_instructions:global:workflow_overview
   */
  surface_id: string;

  /**
   * 内容 SHA256 hash
   * 用于变更检测和版本对照
   */
  content_hash: string;

  /**
   * 消费时间戳（ISO 8601 格式）
   * 例如：2026-08-31T10:30:00.000Z
   *
   * ⚠️ C 类字段 - 服务端无法精确采集模型读取 guidance 的时刻
   * - null：表示未采集
   * - 推断值：用首次工具调用时间戳推断（弱证据）
   * - 精确值：需客户端回传（05-00 Profile）
   */
  consumed_at: string | null;

  /**
   * 触发上下文（用户输入片段）
   * 记录触发该 guidance 消费的用户输入
   *
   * ⚠️ C 类字段 - 服务端无法采集用户输入片段
   * - null：表示未采集
   * - 精确值：需客户端回传（05-00 Profile）
   */
  trigger_context: string | null;

  /**
   * 消费者类型
   * - model: LLM 模型消费
   * - client: MCP 客户端消费
   */
  consumer_type: 'model' | 'client';

  /**
   * 对话 ID / Prompt ID
   * 用于关联同一会话中的多条证据
   *
   * ⚠️ C 类字段 - 服务端无会话 ID
   * - null：表示未采集
   * - 精确值：需客户端回传（05-00 Profile）
   */
  prompt_id: string | null;

  // ============================================================
  // 运行环境（5）
  // ============================================================

  /**
   * 本次运行 ID
   * 用于区分不同的测试运行
   */
  run_id: string;

  /**
   * MCP 协议版本
   * 例如：2024-11-05
   */
  mcp_version: string;

  /**
   * Git commit hash（40 字符）
   * **B0 运行时锁定的 git SHA**
   * 用于确保可重复性和版本追溯
   */
  git_sha: string;

  /**
   * 客户端版本
   * 例如：claude-code-v1.2.3
   *
   * ⚠️ C 类字段 - 服务端无法获取客户端版本信息
   * - null：表示未采集
   * - 精确值：需客户端传递（05-00 Profile）
   */
  client_version: string | null;

  /**
   * 模型版本
   * 例如：claude-sonnet-5[1m]
   *
   * ⚠️ C 类字段 - 服务端无法获取模型版本信息
   * - null：表示未采集
   * - 精确值：需客户端传递（05-00 Profile）
   */
  model_version: string | null;

  // ============================================================
  // 动作记录（7）
  // ============================================================

  /**
   * Fixture 内容 hash（SHA256）
   * 确保测试场景可重复
   */
  fixture_hash: string;

  /**
   * 决策上下文（客户端传递的意图信号）
   * 包含 strength、direction、target_ref 等
   * null 表示未传递（如纯服务端约束场景）
   */
  decision_context: DecisionContext | null;

  /**
   * 工具调用序列
   * 记录 AI 调用的所有工具，按顺序
   * 例如：["spec_list", "spec_create"]
   */
  tool_sequence: string[];

  /**
   * 允许的工具集合
   * Fixture 中定义的允许工具
   */
  allowed_tools: string[];

  /**
   * 禁止的工具集合
   * Fixture 中定义的禁止工具
   */
  forbidden_tools: string[];

  /**
   * AI 最终采取的动作
   * 可以是工具调用、拒绝、建议等
   * null 表示纯文本回答（无工具调用）
   */
  action_taken: string | null;

  /**
   * 动作是否成功
   * true: 工具调用成功或按预期执行
   * false: 工具调用失败或被拒绝
   */
  action_success: boolean;

  // ============================================================
  // 语义标记（6）
  // ============================================================

  /**
   * 失败分类（可选）
   * 仅在 action_success=false 时填写
   * 例如：gate, validation, user_cancel, state_machine_validation
   */
  failure_category?: string;

  /**
   * 严重度
   * - high: 高成本决策、伪约束、黑名单词汇
   * - medium: 中等风险
   * - low: 低风险、明确决策
   */
  severity: 'high' | 'medium' | 'low';

  /**
   * 是否含黑名单词汇
   * true: 包含应移除的伪约束短语
   * false: 无黑名单词汇
   */
  is_blacklist_phrase: boolean;

  /**
   * 是否为伪约束
   * true: RECOMMENDATION 被误显示为 EXECUTION_CONSTRAINT
   * false: 真实约束或正常建议
   */
  is_pseudo_constraint: boolean;

  /**
   * 用户是否覆盖 AI 建议
   * true: 用户明确意图（explicit）覆盖 AI RECOMMENDATION
   * false: AI 自主判断或遵循建议
   */
  user_decision_override: boolean;

  /**
   * 是否为 clean session（盲测用）
   * true: 独立的、无历史上下文的测试会话
   * false: 可能受之前对话影响的会话
   */
  session_clean: boolean;
}

/**
 * Evidence Collection Result - 证据采集结果
 */
export interface EvidenceCollectionResult {
  /**
   * 单条证据记录
   */
  evidence: EvidenceContract;

  /**
   * 采集时间戳
   */
  collected_at: string;

  /**
   * 采集方式
   * - hook: lrnev hook 拦截
   * - log_parse: 日志解析
   * - mcp_intercept: MCP 协议拦截
   */
  collection_method: 'hook' | 'log_parse' | 'mcp_intercept';
}

/**
 * Evidence Batch - 证据批次（一次测试运行的所有证据）
 */
export interface EvidenceBatch {
  /**
   * 批次 ID（同 run_id）
   */
  batch_id: string;

  /**
   * 阶段标识
   * - B0: 02-00 冻结基线
   * - B1: 08-00 语义边界完成后
   * - B2a: 03-00 M1（等价迁移）完成后
   * - B2b: 03-00 M2（结构重构）完成后
   * - B3: 05-00 lrnev guidance profile 完成后
   */
  stage: 'B0' | 'B1' | 'B2a' | 'B2b' | 'B3';

  /**
   * Git commit hash
   */
  git_sha: string;

  /**
   * 批次开始时间
   */
  started_at: string;

  /**
   * 批次结束时间
   */
  completed_at: string;

  /**
   * 证据列表
   */
  evidences: EvidenceContract[];

  /**
   * 统计信息
   */
  statistics: {
    total_count: number;
    by_severity: Record<'high' | 'medium' | 'low', number>;
    by_consumer: Record<'model' | 'client', number>;
    success_rate: number;
    blacklist_phrase_count: number;
    pseudo_constraint_count: number;
    user_override_count: number;
  };
}
