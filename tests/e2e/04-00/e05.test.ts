/**
 * 04-00 E-05: 偏好新建后确认 - 测试
 *
 * 验证：用户 preferred + new_spec，AI 应说明利弊，等用户确认（explicit）再执行 spec_create。
 */

import { describe, test, expect } from 'vitest';
import { E05_PreferNewConfirm } from '../../fixtures/04-00/e05-prefer-new-confirm';

describe('E-05: 偏好新建后确认', () => {
  test('fixture 定义完整性', () => {
    const fixture = E05_PreferNewConfirm;

    // 验证基本字段
    expect(fixture.id).toBe('E-05');
    expect(fixture.title).toBe('偏好新建后确认');
    expect(fixture.scenario).toBe('D-01 ⑤');

    // 验证用户输入（D-01 要求：第 1 轮 "我倾向独立，但你可说明利弊"）
    expect(fixture.userInput).toContain('我倾向独立');
    expect(fixture.userInput).toContain('说明利弊');
    expect(fixture.userInput).toContain('user-login');

    // 验证 decision_context（最终确认时：explicit + new_spec）
    expect(fixture.expectedDecisionContext!.strength).toBe('explicit');
    expect(fixture.expectedDecisionContext!.direction).toBe('new_spec');
    expect(fixture.expectedDecisionContext!.target_ref).toBe('user-login');

    // 验证 AI guidance 引用
    expect(fixture.aiGuidance.surface_id).toBe('server_instructions:global:workflow_overview');
    expect(fixture.aiGuidance.baseline).toBe('02-00');
    expect(fixture.aiGuidance.sha).toBe('45a86e15c896c446a41e48324e646d32c27fb76a');
    expect(fixture.aiGuidance.text).toContain('已有特性增量');

    // 验证预期动作（说明利弊后 spec_create(B)）
    expect(fixture.expectedAction).toBe('spec_create');
    expect(fixture.expectedArgs!.name).toBe('user-login');
    expect(fixture.expectedArgs!.scene).toBe('01-user-management');
    expect(fixture.allowedTools).toContain('spec_create');

    // 验证严重度（D-01 标注"一般" = medium）
    expect(fixture.severity).toBe('medium');

    // 验证证据字段
    expect(fixture.evidenceFields.user_decision_override).toBe(true); // 用户 preferred 覆盖 AI recommendation
    expect(fixture.evidenceFields.action_taken).toBe('spec_create');
    expect(fixture.evidenceFields.action_success).toBe(true);
  });

  test('场景上下文符合预期', () => {
    const fixture = E05_PreferNewConfirm;

    // 验证决策上下文（已有 Spec A，AI 建议复用）
    expect(fixture.decisionContext.scene).toBe('01-user-management');
    expect(fixture.decisionContext.existing_specs).toContain('00-introduction (in-progress)');
    expect(fixture.decisionContext.spec_count).toBe(1);
    expect(fixture.decisionContext.ai_recommendation).toBe('reuse_spec');
  });

  test('B0 冒烟：证据采集器可填充字段', () => {
    const fixture = E05_PreferNewConfirm;
    const evidence = fixture.evidenceFields;

    // A类：工具元数据
    expect(evidence.surface_id).toBe('server_instructions:global:workflow_overview');

    // B类：决策与动作
    expect(evidence.decision_context!.strength).toBe('explicit');
    expect(evidence.decision_context!.direction).toBe('new_spec');
    expect(evidence.decision_context!.target_ref).toBe('user-login');
    expect(evidence.user_decision_override).toBe(true); // 用户 preferred 覆盖 AI recommendation
    expect(evidence.tool_sequence).toContain('spec_create');
    expect(evidence.action_taken).toBe('spec_create');
    expect(evidence.action_success).toBe(true);

    // 验证语义标记
    expect(evidence.severity).toBe('medium');
  });
});
