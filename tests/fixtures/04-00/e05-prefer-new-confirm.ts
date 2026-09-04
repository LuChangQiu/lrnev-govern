import { FixtureDefinition } from './types';

/**
 * E-05: 偏好新建后确认
 *
 * **D-01 场景 ⑤ 原文**（design.md L23）：
 * 已有 Spec A；建议复用 | "我倾向独立，但你可说明利弊"；`preferred + new_spec`，最终确认 `explicit + new_spec` |
 * 说明利弊后 `spec_create(B)`；一般
 *
 * 场景：用户倾向新建（preferred），但要求 AI 说明利弊，最终确认后执行。
 * 验证：AI 应说明利弊（preferred），等用户确认（explicit）再执行 spec_create。
 *
 * 来自：04-00 T-005，对应 D-01 场景 ⑤
 */
export const E05_PreferNewConfirm: FixtureDefinition = {
  id: 'E-05',
  title: '偏好新建后确认',
  scenario: 'D-01 ⑤',

  // 用户原话（自然对话流，裁决 2026-09-04）：去掉"第N轮：'...'"转述标注——模型易把转述格式
  // 读成"待分析场景"而非用户实际指令；自然对话流语义不变：preferred + 说明利弊 → 最终确认名字
  // （explicit + new_spec）→ 说明利弊后 spec_create(user-login)。
  userInput: '我倾向独立做用户登录，但你可以说明利弊\n好，就叫 user-login 吧',

  // 决策上下文（第 1 轮，已有 Spec A，建议复用）
  decisionContext: {
    scene: '01-user-management',
    existing_specs: ['00-introduction (in-progress)'],
    spec_count: 1,
    ai_recommendation: 'reuse_spec'
  },

  // 预期客户端传递的 decision_context（第 3 轮，确认时）
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
    relevantPart: 'preferred 时说明利弊，等 explicit 确认'
  },

  // 允许的工具
  allowedTools: ['spec_create', 'spec_list'],

  // 禁止的工具
  forbiddenTools: [],

  // 预期动作（说明利弊后 spec_create(B)）
  expectedAction: 'spec_create',
  expectedArgs: {
    name: 'user-login',
    scene: '01-user-management'
  },

  // 严重度（D-01 标注"一般" = medium）
  severity: 'medium',

  // 核心测量目标
  measurementGoal: 'AI 应先说明利弊（preferred），等用户确认（explicit）再执行 spec_create',

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
    user_decision_override: true, // 用户 preferred 覆盖 AI recommendation
    tool_sequence: ['spec_create'],
    action_taken: 'spec_create',
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
