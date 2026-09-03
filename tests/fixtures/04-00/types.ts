/**
 * 04-00 Agent E2E Observability - Fixture 类型定义
 *
 * 定义用户意图场景 fixture 的数据契约。
 */

/**
 * Decision Context - 决策上下文（场景状态）
 */
export interface DecisionContext {
  scene: string;
  existing_specs?: string[];
  spec_count?: number;
  last_update?: string | null;
  user_intent?: string;
  current_status?: string;
  staleness_signals?: string[];
  ai_recommendation?: string;
  recommendation_reason?: string;
  complexity?: string;
  spec_create_executed?: boolean;
}

/**
 * Expected Decision Context - 预期客户端传递的决策上下文
 */
export interface ExpectedDecisionContext {
  strength: 'explicit' | 'preferred' | 'unspecified';
  direction: 'new_spec' | 'reuse_spec' | 'new_scene' | 'no_spec' | 'other' | null;
  target_ref?: string;
  staleness_signals?: string[];
}

/**
 * AI Guidance Reference - AI guidance 引用
 */
export interface AIGuidanceReference {
  surface_id: string;
  baseline: string;
  sha?: string;
  text: string;
  relevantPart?: string;
}

/**
 * Evidence Fields - 证据采集字段
 */
export interface EvidenceFields {
  // A类：工具元数据
  surface_id: string;
  content_hash: string | null;  // 运行时计算
  consumer_type: string;

  // B类：决策与动作
  decision_context: ExpectedDecisionContext | null;
  user_decision_override: boolean;
  tool_sequence: string[];
  action_taken: string | null;
  action_success: boolean;
  severity: string;
  failure_category?: string;  // 失败分类（可选）

  // C类：运行环境（权宜方案）
  consumed_at: string | null;  // 推断值
  trigger_context: string | null;
  prompt_id: string | null;
  client: string | null;
  model_version: string | null;
}

/**
 * Forbidden Action - 禁止的具体动作
 */
export interface ForbiddenAction {
  description: string;  // 禁止动作描述
  tool: string;         // 禁止工具名
  args?: Record<string, unknown>;  // 禁止参数（可选）
}

/**
 * Fixture Definition - 场景定义
 */
export interface FixtureDefinition {
  id: string;
  title: string;
  scenario: string;

  userInput: string;
  decisionContext: DecisionContext;

  /**
   * 预期客户端传递的决策上下文
   *
   * null: 非 v1 context 工具（如 spec_update），不传 decision_context
   */
  expectedDecisionContext: ExpectedDecisionContext | null;

  aiGuidance: AIGuidanceReference;

  allowedTools: string[];
  forbiddenTools: string[];
  forbiddenAction?: ForbiddenAction;  // 禁止的具体动作

  expectedAction: string | null;
  expectedArgs?: Record<string, any>;

  /**
   * 期望失败场景（E-08）：验证约束生效
   * true: action_success: false 判为 PASS（状态机拒绝是正确行为）
   */
  expectFailure?: boolean;

  severity: 'high' | 'medium' | 'low';
  measurementGoal: string;

  evidenceFields: EvidenceFields;
}
