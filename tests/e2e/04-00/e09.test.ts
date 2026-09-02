/**
 * 04-00 E-09: 上下文冷却 - 测试
 *
 * 验证：检测冷却信号，先读 L0 summary 再决策。
 */

import { describe, test, expect } from 'vitest';
import { E09_ContextCooldown } from '../../fixtures/04-00/e09-context-cooldown';

describe('E-09: 上下文冷却', () => {
  test('fixture 定义完整性', () => {
    const fixture = E09_ContextCooldown;

    // 验证基本字段
    expect(fixture.id).toBe('E-09');
    expect(fixture.title).toBe('上下文冷却');
    expect(fixture.scenario).toBe('D-01 ⑩');

    // 验证用户输入
    expect(fixture.userInput).toContain('继续做');

    // 验证 decision_context（含冷却信号）
    expect(fixture.expectedDecisionContext!.strength).toBe('unspecified');
    expect(fixture.expectedDecisionContext!.direction).toBeNull();
    expect(fixture.expectedDecisionContext!.staleness_signals).toBeDefined();
    expect(fixture.expectedDecisionContext!.staleness_signals).toContain('long time since update');

    // 验证 AI guidance 引用
    expect(fixture.aiGuidance.surface_id).toBe('server_instructions:global:workflow_overview');
    expect(fixture.aiGuidance.baseline).toBe('02-00');
    expect(fixture.aiGuidance.sha).toBe('45a86e15c896c446a41e48324e646d32c27fb76a');
    expect(fixture.aiGuidance.text).toContain('已有特性增量');
    expect(fixture.aiGuidance.relevantPart).toContain('冷却');

    // 验证预期动作
    expect(fixture.expectedAction).toBe('spec_get');
    expect(fixture.allowedTools).toContain('spec_get');
    expect(fixture.allowedTools).toContain('context_search');

    // 验证严重度
    expect(fixture.severity).toBe('medium');

    // 验证证据字段
    expect(fixture.evidenceFields.action_taken).toBe('spec_get');
    expect(fixture.evidenceFields.tool_sequence).toContain('spec_get');
  });

  test('场景上下文符合预期', () => {
    const fixture = E09_ContextCooldown;

    // 验证决策上下文（含冷却信号）
    expect(fixture.decisionContext.scene).toBe('01-user-management');
    expect(fixture.decisionContext.existing_specs).toContain('01-login (completed, 2 months ago)');
    expect(fixture.decisionContext.staleness_signals).toBeDefined();
    expect(fixture.decisionContext.staleness_signals).toContain('long time since update');
    expect(fixture.decisionContext.staleness_signals).toContain('status=completed');
  });

  // B0 冒烟：验证证据采集链路
  test('B0 冒烟：证据采集器可填充字段', async () => {
    const { runFixture } = await import('./evidence-collector.js');
    const evidence = await runFixture(E09_ContextCooldown);

    // 验证基础字段
    expect(evidence.surface_id).toBe('server_instructions:global:workflow_overview');
    expect(evidence.content_hash).toBeDefined();
    expect(evidence.consumer_type).toBe('model');

    // 验证运行环境
    expect(evidence.run_id).toMatch(/^run-\d+-[a-z0-9]+$/);
    expect(evidence.mcp_version).toBeDefined();
    expect(evidence.git_sha).toBeDefined();

    // 验证动作记录
    expect(evidence.fixture_hash).toBeDefined();
    expect(evidence.decision_context?.strength).toBe('unspecified');
    expect(evidence.decision_context?.direction).toBeNull();
    expect(evidence.decision_context?.staleness_signals).toBeDefined();
    expect(evidence.tool_sequence).toContain('spec_get');
    expect(evidence.action_taken).toBe('spec_get');
    expect(evidence.action_success).toBe(true);

    // 验证语义标记
    expect(evidence.severity).toBe('medium');
    expect(evidence.session_clean).toBe(true);

    // C类字段应为 null
    expect(evidence.consumed_at).toBeNull();
    expect(evidence.trigger_context).toBeNull();
    expect(evidence.prompt_id).toBeNull();
  });
});
