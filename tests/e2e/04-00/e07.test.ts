/**
 * 04-00 E-07: 明确不建 Spec - 测试
 *
 * 验证：AI 应遵守用户明确拒绝（explicit+no_spec），不调用任何治理工具。
 */

import { describe, test, expect } from 'vitest';
import { E07_ExplicitNoSpec } from '../../fixtures/04-00/e07-explicit-no-spec';

describe('E-07: 明确不建 Spec', () => {
  test('fixture 定义完整性', () => {
    const fixture = E07_ExplicitNoSpec;

    // 验证基本字段
    expect(fixture.id).toBe('E-07');
    expect(fixture.title).toBe('明确不建 Spec');
    expect(fixture.scenario).toBe('D-01 ⑧');

    // 验证用户输入
    expect(fixture.userInput).toContain('不用开 Spec');

    // 验证 decision_context
    expect(fixture.expectedDecisionContext!.strength).toBe('explicit');
    expect(fixture.expectedDecisionContext!.direction).toBe('no_spec');

    // 验证 AI guidance 引用
    expect(fixture.aiGuidance.surface_id).toBe('server_instructions:global:workflow_overview');
    expect(fixture.aiGuidance.baseline).toBe('02-00');
    expect(fixture.aiGuidance.sha).toMatch(/^[0-9a-f]{40}$/); // 格式验证：40 字符 hex SHA
  });

  test('decision_context 匹配场景', () => {
    const fixture = E07_ExplicitNoSpec;

    // 明确拒绝场景
    expect(fixture.expectedDecisionContext!.strength).toBe('explicit');
    expect(fixture.expectedDecisionContext!.direction).toBe('no_spec');

    // 禁止调用治理工具
    expect(fixture.forbiddenTools).toContain('spec_create');
    expect(fixture.forbiddenTools).toContain('scene_create');
    expect(fixture.forbiddenTools).toContain('task_create');
  });

  test('B0 冒烟：证据采集器可填充字段', async () => {
    const fixture = E07_ExplicitNoSpec;
    const { runFixture } = await import('./evidence-collector.js');
    const evidence = await runFixture(fixture);

    // 验证核心字段
    expect(evidence.fixture_hash).toBeDefined();
    expect(evidence.git_sha).toMatch(/^[0-9a-f]{40}$/); // 格式验证：40 字符 hex SHA
    expect(evidence.decision_context).toEqual({
      strength: 'explicit',
      direction: 'no_spec'
    });

    // 验证动作记录（不应调用工具）
    // E-07 的 fixture.expectedAction 为 null（本就不期望任何动作），无调用即为正确行为
    expect(evidence.action_taken).toBeNull();
    expect(evidence.action_success).toBe(true);
    expect(evidence.failure_category).toBeUndefined();
    expect(evidence.tool_sequence).toEqual([]);
    expect(evidence.severity).toBe('high');
  });
});
