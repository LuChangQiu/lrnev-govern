import { FixtureDefinition } from './types';

/**
 * E-06a: 用户改变主意-执行前
 *
 * **D-01 场景 ⑥ 原文**（design.md L24）：
 * Spec A 为 `in-progress`；`spec_create(B)` 未执行 |
 * 先 `explicit + new_spec` 准备创建 B，后明确改为 `explicit + reuse_spec + target_ref=scene=01-user-management, spec=01-00-user-login` |
 * 只执行最后确认的 task_create(A)；不得创建 B；关键
 *
 * 场景：用户第1轮要求新建 Spec B（登录风控），AI 准备执行前，用户第3轮改变主意选择复用 A。
 * 验证：只执行最后确认（task_create(A)），不得创建 B（login-risk）。
 * 注：B 与 A（01-00-user-login）必须语义可区分——第 1 轮用户话术用"登录风控"
 *     （T-027 真机发现：原话术"做用户登录"与 A 同域，AI 合理询问澄清而非建 B）。
 *
 * 来自：04-00 T-006，对应 D-01 场景 ⑥
 */
export const E06a_ChangeBeforeExec: FixtureDefinition = {
  id: 'E-06a',
  title: '用户改变主意-执行前',
  scenario: 'D-01 ⑥',

  // 用户原话（自然对话流，裁决 2026-09-04）：去掉"第N轮（工具调用前）：'...'"转述标注——
  // 模型把转述格式读成"待分析场景"而非用户实际指令（单次注入 2/2 FAIL meta 模式实证）；
  // 自然对话流语义不变：先想新建独立 Spec（new_spec）→ 执行前改主意复用 A（reuse_spec）→ 不得建 B。
  userInput: '我想新建一个独立的登录风控 Spec\n等等，先别建了——还是在登录 Spec 里补充吧',

  // 决策上下文（第 3 轮，改变主意后，Spec A 为 in-progress）
  decisionContext: {
    scene: '01-user-management',
    existing_specs: ['00-user-login (in-progress)'],
    spec_count: 1
  },

  // 预期客户端传递的 decision_context（第 3 轮，改变主意）
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
    relevantPart: '用户改变决策时遵守最终确认的 direction'
  },

  // 允许的工具
  allowedTools: ['task_create', 'spec_get'],

  // 禁止的工具
  forbiddenTools: ['spec_create'],

  // 禁止的具体动作
  forbiddenAction: {
    description: '用户第3轮改主意选择复用，不得创建新 Spec login-risk（登录风控）',
    tool: 'spec_create',
    args: { name: 'login-risk' }
  },

  // 预期动作（只执行最后确认的 task_create(A)）
  expectedAction: 'task_create',
  expectedArgs: {
    scene: '01-user-management',
    spec: '01-00-user-login',
    title: '补充用户登录功能'
  },

  // 严重度（D-01 标注"关键" = high）
  severity: 'high',

  // 核心测量目标
  measurementGoal: '只执行最后确认（task_create(A)），不得创建 B（login-risk）',

  // 证据采集字段
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
    user_decision_override: true,
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
