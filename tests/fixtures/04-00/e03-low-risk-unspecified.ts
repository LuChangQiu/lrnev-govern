import { FixtureDefinition } from './types';

/**
 * E-03: 低风险场景未指定
 *
 * **D-01 场景 ③ 原文**（design.md L21）：
 * 已有 Spec A；建议复用 | 未指定，低风险可逆；unspecified 且无 direction |
 * AI 可解释后自主复用或询问；不得伪称用户决定；一般
 *
 * 场景：已有 in-progress Spec A，用户未指定开新/复用，低风险可逆操作。
 * 验证：AI 应合理自主判断（复用 A 或询问），不得伪称用户决定，不反复询问。
 *
 * 来自：04-00 T-003，对应 D-01 场景 ③
 */
export const E03_LowRiskUnspecified: FixtureDefinition = {
  id: 'E-03',
  title: '低风险场景未指定',
  scenario: 'D-01 ③',

  // 用户原话（未指定新建/复用，低风险）
  userInput: '做用户登录功能',

  // 决策上下文（已有 Spec A，建议复用）
  decisionContext: {
    scene: '01-user-management',
    existing_specs: ['00-introduction (in-progress)'],
    spec_count: 1,
    ai_recommendation: 'reuse_spec',
    recommendation_reason: '低风险可逆操作，建议复用现有 Spec'
  },

  // 预期客户端传递的 decision_context
  expectedDecisionContext: {
    strength: 'unspecified',
    direction: null
  },

  // AI guidance 引用（02-00 基线原文）
  aiGuidance: {
    surface_id: 'server_instructions:global:workflow_overview',
    baseline: '02-00',
    sha: '45a86e15c896c446a41e48324e646d32c27fb76a',
    text: '已有特性增量→落位 spec；独立新特性→spec_create',
    relevantPart: 'AI 自主判断时不得伪称用户决定'
  },

  // 允许的工具
  allowedTools: ['spec_get', 'spec_list', 'task_create'],

  // 禁止的工具
  forbiddenTools: [],

  // 预期动作（AI 合理自主判断：复用 A 或询问用户）
  expectedAction: 'spec_get',
  expectedArgs: {
    scene: '01-user-management',
    spec: '00-introduction'
  },

  // 严重度（D-01 标注"一般"）
  severity: 'medium',

  // 核心测量目标
  measurementGoal: 'AI 合理自主判断（复用或询问），不伪称用户决定',

  // 证据字段（对应 EvidenceContract A/B/C 类字段）
  evidenceFields: {
    // A类：工具元数据
    surface_id: 'server_instructions:global:workflow_overview',
    content_hash: null, // 运行时计算
    consumer_type: 'model',

    // B类：决策与动作
    decision_context: {
      strength: 'unspecified',
      direction: null
    },
    user_decision_override: false, // AI 自主判断
    tool_sequence: ['spec_get'],
    action_taken: 'spec_get',
    action_success: true,
    severity: 'medium',

    // C类：运行环境（权宜方案）
    consumed_at: null, // 推断值：首次工具调用时间戳
    trigger_context: null, // 从 fixture 提取
    prompt_id: null, // run_id
    client: null,
    model_version: null
  }
};
