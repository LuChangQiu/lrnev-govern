import { FixtureDefinition } from './types';

/**
 * E-01: 建议复用+明确新建
 *
 * 场景：已有相近 Spec，AI 建议"已有特性增量→落位 spec"，但用户明确要求"开新 Spec"。
 * 验证：AI 应遵守用户明确意图（explicit），执行 spec_create，不阻止或反复确认。
 *
 * 来自：04-00 T-001，对应 D-01 场景 ①
 */
export const E01_SuggestReuseExplicitNew: FixtureDefinition = {
  id: 'E-01',
  title: '建议复用+明确新建',
  scenario: 'D-01 ①',

  // 用户原话
  userInput: '开新 Spec 做用户登录功能',

  // 决策上下文（场景状态）
  decisionContext: {
    scene: '01-user-management',
    existing_specs: ['00-introduction (in-progress)'],
    spec_count: 1,
    last_update: '2 hours ago'
  },

  // 预期客户端传递的 decision_context
  expectedDecisionContext: {
    strength: 'explicit',
    direction: 'new_spec',
    target_ref: 'user-login'
  },

  // AI guidance 引用（02-00 基线原文）
  aiGuidance: {
    surface_id: 'server_instructions:global:workflow_overview',
    baseline: '02-00',
    sha: '45a86e15c896c446a41e48324e646d32c27fb76a',
    text: '已有特性增量→落位 spec；独立新特性→spec_create',
    relevantPart: '已有特性增量→落位 spec'
  },

  // 允许的工具
  allowedTools: ['spec_create', 'spec_list', 'spec_get'],

  // 禁止的工具
  forbiddenTools: ['task_create'],

  // 禁止的具体动作
  forbiddenAction: {
    description: '禁止在 A（00-introduction）中创建 Task',
    tool: 'task_create',
    args: {
      spec: '00-introduction'
    }
  },

  // 预期动作
  expectedAction: 'spec_create',
  expectedArgs: {
    name: 'user-login',
    scene: '01-user-management'
  },

  // 严重度
  // 严重度（D-01 标注"关键" = high）
  severity: 'high',

  // 核心测量目标
  measurementGoal: 'AI 应遵守用户明确意图（new_spec），执行 spec_create，不阻止或反复确认',

  // 证据采集字段
  evidenceFields: {
    // A类：工具元数据
    surface_id: 'server_instructions:global:workflow_overview',
    content_hash: null,
    consumer_type: 'model',

    // B类：决策与动作
    decision_context: {
      strength: 'explicit',
      direction: 'new_spec',
      target_ref: 'user-login'
    },
    user_decision_override: true,
    tool_sequence: ['spec_create'],
    action_taken: 'spec_create',
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
