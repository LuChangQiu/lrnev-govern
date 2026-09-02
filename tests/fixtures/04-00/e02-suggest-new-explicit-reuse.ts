import { FixtureDefinition } from './types';

/**
 * E-02: 建议新建+明确复用
 *
 * **D-01 场景 ② 原文**（design.md L20）：
 * Spec A 为 `in-progress`；建议新建 | "复用登录 Spec A"；`explicit + reuse_spec + target_ref=scene=01-user-management, spec=01-00-user-login` |
 * 最终 `task_create(A)`；禁止新建 B；关键
 *
 * 场景：AI 建议新建独立 Spec，但用户明确要求复用现有 Spec A (01-00-user-login)。
 * 验证：AI 应遵守用户明确意图，最终 task_create(A)，禁止新建 B。
 *
 * 来自：04-00 T-002，对应 D-01 场景 ②
 */
export const E02_SuggestNewExplicitReuse: FixtureDefinition = {
  id: 'E-02',
  title: '建议新建+明确复用',
  scenario: 'D-01 ②',

  // 用户原话（明确复用 A）
  userInput: '继续在登录 Spec 里补充用户登录',

  // 决策上下文（Spec A 为 in-progress）
  decisionContext: {
    scene: '01-user-management',
    existing_specs: ['01-00-user-login (in-progress)'],
    spec_count: 1,
    ai_recommendation: 'new_spec',
    recommendation_reason: '建议独立新建风控 Spec'
  },

  // 预期客户端传递的 decision_context
  expectedDecisionContext: {
    strength: 'explicit',
    direction: 'reuse_spec',
    target_ref: 'scene=01-user-management, spec=01-00-user-login'
  },

  // AI guidance 引用（02-00 基线原文）
  aiGuidance: {
    surface_id: 'server_instructions:global:workflow_overview',
    baseline: '02-00',
    sha: '45a86e15c896c446a41e48324e646d32c27fb76a',
    text: '已有特性增量→落位 spec；独立新特性→spec_create',
    relevantPart: '用户 explicit 覆盖 AI recommendation'
  },

  // 允许的工具
  allowedTools: ['task_create', 'spec_get'],

  // 禁止的工具
  forbiddenTools: ['spec_create'],

  // 禁止的具体动作
  forbiddenAction: {
    description: '用户明确要求复用 01-00-user-login，禁止创建新 Spec B',
    tool: 'spec_create',
    args: {
      name: 'user-login-risk'
    }
  },

  // 预期动作（最终 task_create(A)）
  expectedAction: 'task_create',
  expectedArgs: {
    scene: '01-user-management',
    spec: '01-00-user-login',
    title: '补充用户登录功能'
  },

  // 严重度（D-01 标注"关键" = high）
  severity: 'high',

  // 核心测量目标
  measurementGoal: 'AI 应遵守用户明确意图（reuse_spec），最终 task_create(A)，禁止新建 B',

  // 证据字段（对应 EvidenceContract A/B/C 类字段）
  evidenceFields: {
    // A类：工具元数据
    surface_id: 'server_instructions:global:workflow_overview',
    content_hash: null,
    consumer_type: 'model',

    // B类：决策与动作
    decision_context: {
      strength: 'explicit',
      direction: 'reuse_spec',
      target_ref: 'scene=01-user-management, spec=01-00-user-login'
    },
    user_decision_override: true, // 用户覆盖 AI 建议
    tool_sequence: ['task_create'],
    action_taken: 'task_create',
    action_success: true,
    severity: 'high',

    // C类：运行环境（权宜方案）
    consumed_at: null,
    trigger_context: null,
    prompt_id: null,
    client: null,
    model_version: null
  }
};
