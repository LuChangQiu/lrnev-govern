/**
 * 04-00 E-03: 低风险场景未指定 - 测试
 *
 * 验证：已有 Spec A，用户未指定，AI 可解释后自主复用或询问，不得伪称用户决定。
 */

import { describe, test, expect } from 'vitest';
import { E03_LowRiskUnspecified } from '../../fixtures/04-00/e03-low-risk-unspecified';

describe('E-03: 低风险场景未指定', () => {
  test('fixture 定义完整性', () => {
    const fixture = E03_LowRiskUnspecified;

    // 验证基本字段
    expect(fixture.id).toBe('E-03');
    expect(fixture.title).toBe('低风险场景未指定');
    expect(fixture.scenario).toBe('D-01 ③');

    // 验证用户输入（未指定新建/复用）
    expect(fixture.userInput).toContain('做用户登录功能');

    // 验证 decision_context（D-01 要求：unspecified 且无 direction）
    expect(fixture.expectedDecisionContext!.strength).toBe('unspecified');
    expect(fixture.expectedDecisionContext!.direction).toBeNull();

    // 验证 AI guidance 引用
    expect(fixture.aiGuidance.surface_id).toBe('server_instructions:global:workflow_overview');
    expect(fixture.aiGuidance.baseline).toBe('02-00');
    expect(fixture.aiGuidance.sha).toBe('45a86e15c896c446a41e48324e646d32c27fb76a');
    expect(fixture.aiGuidance.text).toContain('已有特性增量');

    // 验证预期动作（D-01 要求：AI 可解释后自主复用或询问）
    expect(fixture.expectedAction).toBe('spec_get');
    expect(fixture.expectedArgs!.scene).toBe('01-user-management');
    expect(fixture.expectedArgs!.spec).toBe('00-introduction');
    expect(fixture.allowedTools).toContain('spec_get');

    // 验证严重度（D-01 标注"一般" = medium）
    expect(fixture.severity).toBe('medium');

    // 验证证据字段
    expect(fixture.evidenceFields.user_decision_override).toBe(false);
    expect(fixture.evidenceFields.action_taken).toBe('spec_get');
    expect(fixture.evidenceFields.action_success).toBe(true);
  });

  test('场景上下文符合预期（已有 Spec A）', () => {
    const fixture = E03_LowRiskUnspecified;

    // 验证决策上下文（D-01 要求：已有 Spec A；建议复用）
    expect(fixture.decisionContext.scene).toBe('01-user-management');
    expect(fixture.decisionContext.existing_specs).toContain('00-introduction (in-progress)');
    expect(fixture.decisionContext.spec_count).toBe(1);
    expect(fixture.decisionContext.ai_recommendation).toBe('reuse_spec');
  });

  test('核心测量目标明确', () => {
    const fixture = E03_LowRiskUnspecified;

    // D-01 要求：AI 可解释后自主复用或询问；不得伪称用户决定
    expect(fixture.measurementGoal).toContain('AI 合理自主判断');
    expect(fixture.measurementGoal).toContain('不伪称用户决定');
  });

  test('B0 冒烟：证据采集器可填充字段', () => {
    const fixture = E03_LowRiskUnspecified;
    const evidence = fixture.evidenceFields;

    // A类：工具元数据
    expect(evidence.surface_id).toBe('server_instructions:global:workflow_overview');

    // B类：决策与动作
    expect(evidence.decision_context!.strength).toBe('unspecified');
    expect(evidence.decision_context!.direction).toBeNull();
    expect(evidence.user_decision_override).toBe(false); // AI 自主判断
    expect(evidence.tool_sequence).toContain('spec_get');
    expect(evidence.action_taken).toBe('spec_get');
    expect(evidence.action_success).toBe(true);

    // 验证语义标记
    expect(evidence.severity).toBe('medium');
  });
});
