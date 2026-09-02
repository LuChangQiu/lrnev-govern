import { FixtureDefinition } from './types';

/**
 * E-10: new_scene 协议
 *
 * 场景：用户明确要求创建新 Scene，验证 direction='new_scene' 协议。
 * 验证：AI 应执行 scene_create，不误判为 spec_create。
 *
 * 来自：04-00 T-011，对应 new_scene 协议
 */
export const E10_NewSceneProtocol: FixtureDefinition = {
  id: 'E-10',
  title: 'new_scene 协议',
  scenario: 'new_scene 协议',

  // 用户原话
  userInput: '开新 Scene 做权限管理',

  // 决策上下文（场景状态）
  decisionContext: {
    scene: 'global',
    user_intent: 'create new scene for permission management'
  },

  // 预期客户端传递的 decision_context
  expectedDecisionContext: {
    strength: 'explicit',
    direction: 'new_scene',
    target_ref: 'permission-management'
  },

  // AI guidance 引用（02-00 基线原文）
  aiGuidance: {
    surface_id: 'server_instructions:global:workflow_overview',
    baseline: '02-00',
    sha: '45a86e15c896c446a41e48324e646d32c27fb76a',
    text: '已有特性增量→落位 spec；独立新特性→spec_create',
    relevantPart: 'new_scene 时应执行 scene_create'
  },

  // 允许的工具
  allowedTools: ['scene_create'],

  // 禁止的工具
  forbiddenTools: [],

  // 预期动作
  expectedAction: 'scene_create',
  expectedArgs: {
    name: 'permission-management'
  },

  // 严重度
  severity: 'low',

  // 核心测量目标
  measurementGoal: 'new_scene direction 正确映射到 scene_create',

  // 证据采集字段
  evidenceFields: {
    // A类：工具元数据
    surface_id: 'server_instructions:global:workflow_overview',
    content_hash: null,
    consumer_type: 'model',

    // B类：决策与动作
    decision_context: {
      strength: 'explicit',
      direction: 'new_scene',
      target_ref: 'permission-management'
    },
    user_decision_override: false,
    tool_sequence: ['scene_create'],
    action_taken: 'scene_create',
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
