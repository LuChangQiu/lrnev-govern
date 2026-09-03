/**
 * 04-00 E-02: 建议新建+明确复用 - 测试
 *
 * 验证：AI 应遵守用户明确意图（explicit+reuse_spec），最终 task_create(A)，禁止新建 B。
 */

import { describe, test, expect } from 'vitest';
import { E02_SuggestNewExplicitReuse } from '../../fixtures/04-00/e02-suggest-new-explicit-reuse';

describe('E-02: 建议新建+明确复用', () => {
  test('fixture 定义完整性', () => {
    const fixture = E02_SuggestNewExplicitReuse;

    // 验证基本字段
    expect(fixture.id).toBe('E-02');
    expect(fixture.title).toBe('建议新建+明确复用');
    expect(fixture.scenario).toBe('D-01 ②');

    // 验证用户输入（D-01 要求：复用登录 Spec A）
    expect(fixture.userInput).toContain('登录 Spec');
    expect(fixture.userInput).toContain('补充用户登录');

    // 验证 decision_context（D-01 要求：target_ref=scene=01-user-management, spec=01-00-user-login）
    expect(fixture.expectedDecisionContext!.strength).toBe('explicit');
    expect(fixture.expectedDecisionContext!.direction).toBe('reuse_spec');
    expect(fixture.expectedDecisionContext!.target_ref).toBe('scene=01-user-management, spec=01-00-user-login');

    // 验证 AI guidance 引用
    expect(fixture.aiGuidance.surface_id).toBe('server_instructions:global:workflow_overview');
    expect(fixture.aiGuidance.baseline).toBe('02-00');
    expect(fixture.aiGuidance.sha).toBe('45a86e15c896c446a41e48324e646d32c27fb76a');
    expect(fixture.aiGuidance.text).toContain('已有特性增量');

    // 验证预期动作（D-01 要求：最终 task_create(A)）
    expect(fixture.expectedAction).toBe('task_create');
    expect(fixture.expectedArgs!.scene).toBe('01-user-management');
    expect(fixture.expectedArgs!.spec).toBe('00-user-login');
    expect(fixture.allowedTools).toContain('task_create');

    // 验证严重度（D-01 标注"关键" = high）
    expect(fixture.severity).toBe('high');

    // 验证证据字段
    expect(fixture.evidenceFields.user_decision_override).toBe(true);
    expect(fixture.evidenceFields.action_taken).toBe('task_create');
    expect(fixture.evidenceFields.action_success).toBe(true);
  });

  test('场景上下文符合预期', () => {
    const fixture = E02_SuggestNewExplicitReuse;

    // 验证决策上下文（Spec A 为 in-progress）
    expect(fixture.decisionContext.scene).toBe('01-user-management');
    expect(fixture.decisionContext.existing_specs).toContain('00-user-login (in-progress)');
    expect(fixture.decisionContext.spec_count).toBe(1);
  });

  test('02-00 基线引用正确', () => {
    const fixture = E02_SuggestNewExplicitReuse;

    // 验证引用的是 02-00 基线原文，不是 B1 草稿
    expect(fixture.aiGuidance.baseline).toBe('02-00');
    expect(fixture.aiGuidance.sha).toBe('45a86e15c896c446a41e48324e646d32c27fb76a');
  });

  test('B0 冒烟：证据采集器可填充字段', () => {
    const fixture = E02_SuggestNewExplicitReuse;
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
