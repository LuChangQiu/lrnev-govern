import { FixtureDefinition } from './types';

/**
 * E-11: other 协议
 *
 * 场景：用户明确不要任何治理动作（direction='other'）。
 * 验证：AI 应纯文本回答，不触发自动方向比较，不被服务端升级为约束。
 *
 * 来自：04-00 T-012，对应 other 协议
 */
export const E11_OtherProtocol: FixtureDefinition = {
  id: 'E-11',
  title: 'other 协议',
  scenario: 'other 协议',

  // 用户原话
  userInput: '帮我分析一下现有的登录流程有什么问题',

  // 决策上下文（场景状态）
  decisionContext: {
    scene: '01-user-management',
    user_intent: 'analysis request, not organizational decision'
  },

  // 预期客户端传递的 decision_context
  expectedDecisionContext: {
    strength: 'explicit',
    direction: 'other'
  },

  // AI guidance 引用（02-00 基线原文）
  aiGuidance: {
    surface_id: 'server_instructions:global:workflow_overview',
    baseline: '02-00',
    sha: '45a86e15c896c446a41e48324e646d32c27fb76a',
    text: '已有特性增量→落位 spec；独立新特性→spec_create',
    relevantPart: 'other 协议时不触发治理动作'
  },

  // 允许的工具
  allowedTools: [],

  // 禁止的工具
  forbiddenTools: ['spec_create', 'scene_create'],

  // 预期动作
  expectedAction: null,
  expectedArgs: undefined,

  // 严重度
  severity: 'low',

  // 核心测量目标
  measurementGoal: 'other direction 不触发自动方向比较，不被服务端升级为约束',

  // 证据采集字段
  evidenceFields: {
    // A类：工具元数据
    surface_id: 'server_instructions:global:workflow_overview',
    content_hash: null,
    consumer_type: 'model',

    // B类：决策与动作
    decision_context: {
      strength: 'explicit',
      direction: 'other'
    },
    user_decision_override: false,
    tool_sequence: [],
    action_taken: null,
    action_success: true,
    severity: 'low',

    // C类：运行环境（权宜方案）
    consumed_at: null,
    trigger_context: null,
    prompt_id: null,
    client: null,
    model_version: null
  }
};
