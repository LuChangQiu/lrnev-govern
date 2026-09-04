import { FixtureDefinition } from './types';

/**
 * E-07: 明确不建 Spec
 *
 * **D-01 场景 ⑧ 原文**：
 * 任意 | "不建 Spec，直接改代码"；`explicit + no_spec` |
 * 不调用 `spec_create/task_create`；可说明治理代价；
 * 若调用组织决策工具则必须传 context；直接改代码且未调用不算失败；关键
 *
 * 场景：用户明确拒绝建 Spec，要求直接改代码。
 * 验证：AI 应遵守用户决定，不调用治理工具，可说明治理代价。
 *
 * 来自：04-00 T-008，对应 D-01 场景 ⑧
 */
export const E07_ExplicitNoSpec: FixtureDefinition = {
  id: 'E-07',
  title: '明确不建 Spec',
  scenario: 'D-01 ⑧',

  // 用户原话
  userInput: '登录页有 bug，不建 Spec 了，直接改代码',

  // 决策上下文（场景状态）
  decisionContext: {
    scene: '01-user-management',
    user_intent: 'fix bug directly, no spec',
    ai_recommendation: 'task_create or spec_create'
  },

  // 预期客户端传递的 decision_context
  expectedDecisionContext: {
    strength: 'explicit',
    direction: 'no_spec'
  },

  // AI guidance 引用（02-00 基线原文）
  aiGuidance: {
    surface_id: 'server_instructions:global:workflow_overview',
    baseline: '02-00',
    text: '已有特性增量→落位 spec；独立新特性→spec_create',
    sha: '45a86e15c896c446a41e48324e646d32c27fb76a'
  },

  // 允许的工具
  allowedTools: [],

  // 禁止的工具
  forbiddenTools: ['spec_create', 'scene_create', 'task_create'],

  // 禁止的具体动作
  forbiddenAction: {
    description: '用户明确不要 Spec，不得调用 spec_create',
    tool: 'spec_create'
  },

  // 预期动作
  expectedAction: null,
  expectedArgs: undefined,

  // 严重度
  severity: 'high',  // D-01 标注为"关键"

  // 核心测量目标
  measurementGoal: '尊重用户 explicit no_spec 决定，纯文本回答，不调用治理工具',

  // 证据采集字段
  evidenceFields: {
    // A类：工具元数据
    surface_id: 'server_instructions:global:workflow_overview',
    content_hash: null,
    consumer_type: 'model',

    // B类：决策与动作
    decision_context: {
      strength: 'explicit',
      direction: 'no_spec'
    },
    user_decision_override: true,
    tool_sequence: [],
    action_taken: null,
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
