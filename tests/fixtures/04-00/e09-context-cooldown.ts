import { FixtureDefinition } from './types';

/**
 * E-09: 上下文冷却
 *
 * **D-01 场景 ⑩ 原文**（design.md L28）：
 * 旧 Spec 长期未更新、非 `in-progress`、无 active claim |
 * "修改登录逻辑"；`unspecified` |
 * 先读取 L0/摘要或原文再建议；不得只按时间开新；一般
 *
 * 场景：已完成 Spec 长时间未更新（冷却信号），用户要求"继续做"。
 * 验证：AI 应检测冷却信号，读 L0 summary 确认上下文再决策。
 *
 * 来自：04-00 T-010，对应 D-01 场景 ⑩
 */
export const E09_ContextCooldown: FixtureDefinition = {
  id: 'E-09',
  title: '上下文冷却',
  scenario: 'D-01 ⑩',

  // 用户原话
  userInput: '继续做登录功能',

  // 决策上下文（场景状态）
  decisionContext: {
    scene: '01-user-management',
    existing_specs: ['00-login (completed, 2 months ago)'],
    spec_count: 1,
    staleness_signals: ['long time since update', 'status=completed']
  },

  // 预期客户端传递的 decision_context
  expectedDecisionContext: {
    strength: 'unspecified',
    direction: null,
    staleness_signals: ['long time since update', 'status=completed']
  },

  // AI guidance 引用（02-00 基线原文）
  aiGuidance: {
    surface_id: 'server_instructions:global:workflow_overview',
    baseline: '02-00',
    sha: '45a86e15c896c446a41e48324e646d32c27fb76a',
    text: '已有特性增量→落位 spec；独立新特性→spec_create',
    relevantPart: '冷却信号（长时间未更新）需先确认上下文'
  },

  // 允许的工具
  allowedTools: ['spec_get', 'spec_list', 'context_search'],

  // 禁止的工具
  forbiddenTools: [],

  // 预期动作
  expectedAction: 'spec_get',
  // expectedArgs.spec 用全 id（01-00-login）：真实 AI 实测经 project_status/spec_list 看到的是服务端
  // 权威全 id（scene 前缀 01-），传全 id 是正确行为（对照 e06a/e06b fixture expectedArgs.spec='01-00-user-login' 先例；
  // 冒烟 sha-a 曾因期望短 id '00-login' 与 AI 全 id 不一致而误判 FAIL）。
  // decisionContext.existing_specs 的 '00-login (completed...)' 是工作区描述文本，保持短 id 不变。
  expectedArgs: {
    spec: '01-00-login',
    scene: '01-user-management'
  },

  // 严重度
  severity: 'medium',

  // 核心测量目标
  measurementGoal: '检测冷却信号，先读 L0 summary 再决策',

  // 证据采集字段
  evidenceFields: {
    // A类：工具元数据
    surface_id: 'server_instructions:global:workflow_overview',
    content_hash: null,
    consumer_type: 'model',

    // B类：决策与动作
    decision_context: {
      strength: 'unspecified',
      direction: null,
      staleness_signals: ['long time since update', 'status=completed']
    },
    user_decision_override: false,
    tool_sequence: ['spec_get'],
    action_taken: 'spec_get',
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
