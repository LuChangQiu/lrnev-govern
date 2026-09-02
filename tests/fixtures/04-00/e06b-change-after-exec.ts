import { FixtureDefinition } from './types';

/**
 * E-06b: 用户改变主意-执行后
 *
 * **D-01 场景 ⑦ 原文**（design.md L25）：
 * Spec A 为 `in-progress`；`spec_create(B)` 已成功执行 |
 * 先 `explicit + new_spec` 并已创建 B，后明确改为 `explicit + reuse_spec + target_ref=scene=01-user-management, spec=01-00-user-login` |
 * A、B 并存；后续可 `task_create(A)`，不得自动删除/归档 B 或回滚已成功写入；关键
 *
 * 场景：AI 已执行 spec_create（B="user-login" 已创建），用户第3轮改变主意选择复用 A。
 * 验证：A、B 并存（不得自动回滚 B），后续可 task_create(A)。
 *
 * 来自：04-00 T-007，对应 D-01 场景 ⑦
 */
export const E06b_ChangeAfterExec: FixtureDefinition = {
  id: 'E-06b',
  title: '用户改变主意-执行后',
  scenario: 'D-01 ⑦',

  // 用户原话（多轮）
  userInput: '第1轮："开新 Spec 做用户登录"\n第2轮（AI 已执行 spec_create）："算了，还是在登录 Spec 里补充"',

  // 决策上下文（第 3 轮，改变主意后，B 已创建）
  decisionContext: {
    scene: '01-user-management',
    existing_specs: ['01-00-user-login (in-progress)', 'user-login (draft)'],
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
    description: '用户改主意后，AI 不得自动归档已创建的 Spec B（user-login），应保持 A、B 并存。lrnev 工具集无 spec_delete，Spec 只能归档不能删除。',
    tool: 'spec_update',
    args: {
      spec: 'user-login',
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
