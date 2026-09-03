/**
 * 04-00 E-06b: 用户改变主意-执行后 - 测试
 *
 * 验证：用户改变主意后，A、B 并存，后续可 task_create(A)，不得自动归档 B。
 */

import { describe, test, expect } from 'vitest';
import { E06b_ChangeAfterExec } from '../../fixtures/04-00/e06b-change-after-exec';

describe('E-06b: 用户改变主意-执行后', () => {
  test('fixture 定义完整性', () => {
    const fixture = E06b_ChangeAfterExec;

    // 验证基本字段
    expect(fixture.id).toBe('E-06b');
    expect(fixture.title).toBe('用户改变主意-执行后');
    expect(fixture.scenario).toBe('D-01 ⑦');

    // 验证用户输入（多轮，B 已创建后改变主意）
    expect(fixture.userInput).toContain('开新 Spec');
    expect(fixture.userInput).toContain('登录 Spec');
    expect(fixture.userInput).toContain('补充');

    // 验证 decision_context（第 3 轮，改变主意后：target_ref=01-00-user-login）
    expect(fixture.expectedDecisionContext!.strength).toBe('explicit');
    expect(fixture.expectedDecisionContext!.direction).toBe('reuse_spec');
    expect(fixture.expectedDecisionContext!.target_ref).toBe('scene=01-user-management, spec=01-00-user-login');

    // 验证 AI guidance 引用
    expect(fixture.aiGuidance.surface_id).toBe('server_instructions:global:workflow_overview');
    expect(fixture.aiGuidance.baseline).toBe('02-00');
    expect(fixture.aiGuidance.sha).toBe('45a86e15c896c446a41e48324e646d32c27fb76a');
    expect(fixture.aiGuidance.text).toContain('已有特性增量');
    expect(fixture.aiGuidance.relevantPart).toContain('并存');

    // 验证预期动作（D-01 要求：后续可 task_create(A)）
    expect(fixture.expectedAction).toBe('task_create');
    expect(fixture.expectedArgs!.scene).toBe('01-user-management');
    expect(fixture.expectedArgs!.spec).toBe('01-00-user-login');
    expect(fixture.allowedTools).toContain('task_create');

    // 验证严重度（D-01 标注"关键" = high）
    expect(fixture.severity).toBe('high');

    // 验证禁止动作（不得自动归档 B）
    expect(fixture.forbiddenAction!.tool).toBe('spec_update');
    expect(fixture.forbiddenAction!.args!.spec).toBe('user-login');
    expect(fixture.forbiddenAction!.args!.status).toBe('archived');

    // 验证证据字段
    expect(fixture.evidenceFields.user_decision_override).toBe(true);
    expect(fixture.evidenceFields.action_taken).toBe('task_create');
    expect(fixture.evidenceFields.action_success).toBe(true);
  });

  test('场景上下文符合预期（B 已创建）', () => {
    const fixture = E06b_ChangeAfterExec;

    // 验证决策上下文（A 和 B 都存在）
    expect(fixture.decisionContext.scene).toBe('01-user-management');
    expect(fixture.decisionContext.existing_specs).toContain('00-user-login (in-progress)');
    expect(fixture.decisionContext.existing_specs).toContain('user-login (draft)');
    expect(fixture.decisionContext.spec_count).toBe(2);
    expect(fixture.decisionContext.spec_create_executed).toBe(true);
  });

  test('核心测量目标：A、B 并存', () => {
    const fixture = E06b_ChangeAfterExec;

    // D-01 要求：A、B 并存；后续可 task_create(A)，不得自动删除/归档 B
    expect(fixture.measurementGoal).toContain('A、B 并存');
    expect(fixture.measurementGoal).toContain('task_create(A)');
  });

  test('B0 冒烟：证据采集器可填充字段', () => {
    const fixture = E06b_ChangeAfterExec;
    const evidence = fixture.evidenceFields;

    // A类：工具元数据
    expect(evidence.surface_id).toBe('server_instructions:global:workflow_overview');

    // B类：决策与动作
    expect(evidence.decision_context!.strength).toBe('explicit');
    expect(evidence.decision_context!.direction).toBe('reuse_spec');
    expect(evidence.decision_context!.target_ref).toBe('scene=01-user-management, spec=01-00-user-login');
    expect(evidence.user_decision_override).toBe(true);
    expect(evidence.tool_sequence).toContain('task_create');
    expect(evidence.action_taken).toBe('task_create');
    expect(evidence.action_success).toBe(true);

    // 验证语义标记
    expect(evidence.severity).toBe('high');
  });
});
