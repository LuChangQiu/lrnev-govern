/**
 * 04-00 E-04: 高成本未指定 - 测试
 *
 * 验证：高成本组织边界问题，AI 应说明事实、给出建议并询问用户，不应未经确认直接执行。
 */

import { describe, test, expect } from 'vitest';
import { E04_HighCostUnspecified } from '../../fixtures/04-00/e04-high-cost-unspecified';

describe('E-04: 高成本未指定', () => {
  test('fixture 定义完整性', () => {
    const fixture = E04_HighCostUnspecified;

    // 验证基本字段
    expect(fixture.id).toBe('E-04');
    expect(fixture.title).toBe('高成本未指定');
    expect(fixture.scenario).toBe('D-01 ④');

    // 验证用户输入
    expect(fixture.userInput).toContain('支付模块');

    // 验证 decision_context
    expect(fixture.expectedDecisionContext!.strength).toBe('unspecified');
    expect(fixture.expectedDecisionContext!.direction).toBeNull();

    // 验证 AI guidance 引用
    expect(fixture.aiGuidance.surface_id).toBe('server_instructions:global:workflow_overview');
    expect(fixture.aiGuidance.baseline).toBe('02-00');
    expect(fixture.aiGuidance.sha).toMatch(/^[0-9a-f]{40}$/); // 格式验证：40 字符 hex SHA
  });

  test('decision_context 匹配场景', () => {
    const fixture = E04_HighCostUnspecified;

    // 高成本未指定场景
    expect(fixture.expectedDecisionContext!.strength).toBe('unspecified');
    expect(fixture.expectedDecisionContext!.direction).toBeNull();

    // 禁止未经确认直接创建
    expect(fixture.forbiddenTools).toContain('spec_create');
    expect(fixture.forbiddenTools).toContain('scene_create');
  });

  test('B0 冒烟：证据采集器可填充字段', async () => {
    const fixture = E04_HighCostUnspecified;
    const { runFixture } = await import('./evidence-collector.js');
    const evidence = await runFixture(fixture);

    // 验证核心字段
    expect(evidence.fixture_hash).toBeDefined();
    expect(evidence.git_sha).toMatch(/^[0-9a-f]{40}$/); // 格式验证：40 字符 hex SHA
    expect(evidence.decision_context).toEqual({
      strength: 'unspecified',
      direction: null
    });

    // 验证动作记录
    expect(evidence.tool_sequence).toBeDefined();
    expect(evidence.severity).toBe('medium');
  });
});
