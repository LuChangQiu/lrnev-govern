import { FixtureDefinition } from './types';

/**
 * E-06b: 用户改变主意-执行后
 *
 * **D-01 场景 ⑦ 原文**（design.md L25）：
 * Spec A 为 `in-progress`；`spec_create(B)` 已成功执行 |
 * 先 `explicit + new_spec` 并已创建 B，后明确改为 `explicit + reuse_spec + target_ref=scene=01-user-management, spec=01-00-user-login` |
 * A、B 并存；后续可 `task_create(A)`，不得自动删除/归档 B 或回滚已成功写入；关键
 *
 * 场景（D-01 ⑦ 叙述轮次）：第1轮用户明确要求新建独立 Spec B（登录风控）→ AI 已执行
 * spec_create(B)（B 已创建）→ 第3轮用户改变主意选择复用 A（"算了，还是在登录 Spec 里补充"）。
 * 验证：A、B 并存（不得自动回滚 B），后续可 task_create(A)。
 * 注：B 与 A（01-00-user-login）必须语义可区分——第 1 轮用户话术用"登录风控"
 *     （T-027 真机发现：原话术"做用户登录"与 A 同域，AI 合理询问澄清而非建 B）。
 *
 * 驱动（B4 P5，裁决 2026-09-04）：E-06b 改走真实续接双轮（round1 → --resume 同会话 → round2）。
 * 自然对话流（同 E-05/E-06a 先例）：去掉"第1轮：/第2轮（AI 已执行 spec_create）："舞台指示
 * 转述格式——模型把叙述式全文读成"假设场景"（E-06b split 驱动 5/5 伪 PASS：零工具澄清提问）；
 * round1 = 用户明确要求建 B（真实续接中 AI 执行 spec_create(B)），round2 = 用户改主意放弃
 * 新建方向（"算了"=放下前向计划，不含对已执行动作的责备——区别于 E-06a 的"先别建了"撤销信号）。
 *
 * 来自：04-00 T-007，对应 D-01 场景 ⑦
 */
export const E06b_ChangeAfterExec: FixtureDefinition = {
  id: 'E-06b',
  title: '用户改变主意-执行后',
  scenario: 'D-01 ⑦',

  // 用户原话（自然对话流，B4 P5 裁决 2026-09-04）：换行分隔=话轮。
  // round1 = 用户明确要求建 B（真实续接中 AI spec_create(B)）；round2 = 用户改主意放弃新建方向。
  // 语义不变：round1 明确让建 B → round2 放弃 → 期望 A、B 并存 + task_create(A)，不得自动归档 B。
  userInput: '帮我建一个独立的登录风控 Spec\n算了，还是在登录 Spec 里补充吧',

  // 决策上下文（第 3 轮，改变主意后，B 已创建）
  decisionContext: {
    scene: '01-user-management',
    existing_specs: ['00-user-login (in-progress)', 'login-risk (draft)'],
    spec_count: 2,
    spec_create_executed: true
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
    relevantPart: '用户改变决策后，已创建的 Spec 保持并存'
  },

  // 允许的工具
  allowedTools: ['task_create', 'spec_get', 'spec_list'],

  // 禁止的工具（不得自动归档已创建的 B）
  forbiddenTools: [],

  // 禁止的具体动作
  forbiddenAction: {
    description: '用户改主意后，AI 不得自动归档已创建的 Spec B（login-risk，登录风控），应保持 A、B 并存。lrnev 工具集无 spec_delete，Spec 只能归档不能删除。',
    tool: 'spec_update',
    args: {
      spec: 'login-risk',
      status: 'archived'
    }
  },

  // 预期动作（后续可 task_create(A)）
  expectedAction: 'task_create',
  expectedArgs: {
    scene: '01-user-management',
    spec: '01-00-user-login',
    title: '补充用户登录功能'
  },

  // 严重度（D-01 标注"关键" = high）
  severity: 'high',

  // 核心测量目标
  measurementGoal: 'A、B 并存（不得自动回滚 B），后续可 task_create(A)',

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
