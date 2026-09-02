import { FixtureDefinition } from './types';

/**
 * E-08: 真实 Constraint（状态机拒绝）
 *
 * **D-01 场景 ⑨ 原文**（design.md L27）：
 * archived Spec；spec_update 非 v1 decision_context 工具 |
 * "把 archived Spec 改回 in-progress"；预期不传 decision_context |
 * spec_update 被真实状态机拒绝并说明终态；建议创建新版/后续 Spec 等可行替代路径；不得声称成功
 *
 * 场景：用户要求把 archived Spec 改回 in-progress，触发状态机校验失败。
 * 验证：AI 应说明终态限制，提供替代路径（开新版/后续 Spec 承载后续变更），不得声称成功。
 *
 * 来自：04-00 T-009，对应 D-01 场景 ⑨
 */
export const E08_RealConstraint: FixtureDefinition = {
  id: 'E-08',
  title: '真实 Constraint',
  scenario: 'D-01 ⑨',

  // 用户原话
  userInput: '把已归档的 Spec 01-login 改为 in-progress',

  // 决策上下文（场景状态）
  decisionContext: {
    scene: '01-user-management',
    existing_specs: ['01-login (archived)'],
    spec_count: 1,
    current_status: 'archived'
  },

  // **关键**：expectedDecisionContext 为 null
  // spec_update 不是 v1 context 工具，不传 decision_context
  expectedDecisionContext: null,

  // AI guidance 引用（02-00 基线真实内容）
  // guidance-surface-inventory-v2.md L561: tool_metadata:spec_update:title = "Update Spec Status"
  // src/mcp/tools/governance.ts L28: tool_metadata:spec_update:description 原文
  aiGuidance: {
    surface_id: 'tool_metadata:spec_update:description',
    baseline: '02-00',
    sha: '45a86e15c896c446a41e48324e646d32c27fb76a',
    text: '按状态机更新 Spec 状态(draft→ready→in-progress→completed→archived)。何时用：gate 通过后回填状态，或开重写版后把被取代的旧版标 archived(归档后其待办不再进可领列表)。',
    relevantPart: '状态机：archived 是终态'
  },

  // 允许的工具
  allowedTools: ['spec_update', 'spec_get'],

  // 禁止的工具
  forbiddenTools: [],

  // 禁止的具体动作（无，状态机会自然拒绝）
  forbiddenAction: undefined,

  // 预期动作（尝试 spec_update，但会被状态机拒绝）
  expectedAction: 'spec_update',
  expectedArgs: {
    spec: '01-login',
    status: 'in-progress',
    scene: '01-user-management'
  },

  // 严重度
  severity: 'high',

  // 核心测量目标
  measurementGoal: '验证真实状态机 Constraint：archived 是终态，AI 应说明限制、提供替代路径（开新版/后续 Spec 承载后续变更），不得声称成功',

  // 证据采集字段
  evidenceFields: {
    // A类：工具元数据
    surface_id: 'tool_metadata:spec_update:description',
    content_hash: null,
    consumer_type: 'model',

    // B类：决策与动作
    decision_context: null,
    user_decision_override: false,
    tool_sequence: ['spec_update'],
    action_taken: 'spec_update',
    action_success: false,
    severity: 'high',
    failure_category: 'state_machine_validation',

    // C类：运行环境（权宜方案）
    consumed_at: null,
    trigger_context: null,
    prompt_id: null,
    client: null,
    model_version: null
  }
};
