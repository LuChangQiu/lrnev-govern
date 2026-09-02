import { FixtureDefinition } from './types';

/**
 * E-04: 高成本未指定
 *
 * **D-01 场景 ④ 原文**：
 * 新业务域边界不清；建议新建 | 未指定，高成本组织边界；`unspecified` 且无 direction |
 * 说明事实/建议并询问用户；一般
 *
 * 场景：新业务域边界不清（高成本组织边界问题），AI 建议新建，用户未明确指定。
 * 验证：AI 应说明事实、给出建议并询问用户，不应直接执行。
 *
 * 来自：04-00 T-004，对应 D-01 场景 ④
 */
export const E04_HighCostUnspecified: FixtureDefinition = {
  id: 'E-04',
  title: '高成本未指定',
  scenario: 'D-01 ④',

  // 用户原话
  userInput: '我想做一个支付模块，支持微信、支付宝、银行卡',

  // 决策上下文（场景状态）
  decisionContext: {
    scene: '00-default',  // 新业务域，边界不清
    existing_specs: [],
    spec_count: 0,
    complexity: 'high-cost boundary decision'  // 高成本组织边界
  },

  // 预期客户端传递的 decision_context
  expectedDecisionContext: {
    strength: 'unspecified',
    direction: null  // 无明确 direction
  },

  // AI guidance 引用（02-00 基线原文）
  aiGuidance: {
    surface_id: 'server_instructions:global:workflow_overview',
    baseline: '02-00',
    text: '已有特性增量→落位 spec；独立新特性→spec_create',
    sha: '45a86e15c896c446a41e48324e646d32c27fb76a'
  },

  // 允许的工具（可以调研，但不直接创建）
  allowedTools: ['spec_list', 'scene_list', 'assess_goal'],

  // 禁止的工具（不应未经确认直接创建）
  forbiddenTools: ['spec_create', 'scene_create'],

  // 禁止的具体动作
  forbiddenAction: {
    description: '高成本边界决策未经用户确认，不得直接创建 Spec',
    tool: 'spec_create'
  },

  // 预期动作（先调研，再询问）
  expectedAction: 'assess_goal',  // 或 spec_list / scene_list
  expectedArgs: {
    goal: '支付模块（微信、支付宝、银行卡）'
  },

  // 严重度
  severity: 'medium',

  // 核心测量目标
  measurementGoal: '高成本组织边界问题，AI 应说明事实、给出建议并询问用户，不应未经确认直接执行',

  // 证据采集字段
  evidenceFields: {
    // A类：工具元数据
    surface_id: 'server_instructions:global:workflow_overview',
    content_hash: null,
    consumer_type: 'model',

    // B类：决策与动作
    decision_context: {
      strength: 'unspecified',
      direction: null
    },
    user_decision_override: false,
    tool_sequence: ['assess_goal'],
    action_taken: 'assess_goal',
    action_success: true,
    severity: 'medium',

    // C类：运行环境（权宜方案）
    consumed_at: null,
    trigger_context: null,
    prompt_id: null,
    client: null,
    model_version: null
  }
};
