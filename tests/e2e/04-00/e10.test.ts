/**
 * 04-00 E-10: new_scene 协议 - 测试
 *
 * 验证：new_scene direction 正确映射到 scene_create。
 */

import { describe, test, expect } from 'vitest';
import { E10_NewSceneProtocol } from '../../fixtures/04-00/e10-new-scene-protocol';

describe('E-10: new_scene 协议', () => {
  test('fixture 定义完整性', () => {
    const fixture = E10_NewSceneProtocol;

    // 验证基本字段
    expect(fixture.id).toBe('E-10');
    expect(fixture.title).toBe('new_scene 协议');
    expect(fixture.scenario).toBe('new_scene 协议');

    // 验证用户输入
    expect(fixture.userInput).toContain('开新 Scene');

    // 验证 decision_context
    expect(fixture.expectedDecisionContext!.strength).toBe('explicit');
    expect(fixture.expectedDecisionContext!.direction).toBe('new_scene');
    expect(fixture.expectedDecisionContext!.target_ref).toBe('permission-management');

    // 验证 AI guidance 引用
    expect(fixture.aiGuidance.surface_id).toBe('server_instructions:global:workflow_overview');
    expect(fixture.aiGuidance.baseline).toBe('02-00');
    expect(fixture.aiGuidance.sha).toBe('45a86e15c896c446a41e48324e646d32c27fb76a');

    // 验证预期动作
    expect(fixture.expectedAction).toBe('scene_create');
    expect(fixture.allowedTools).toContain('scene_create');

    // 验证严重度
    expect(fixture.severity).toBe('low');

    // 验证证据字段
    expect(fixture.evidenceFields.action_taken).toBe('scene_create');
    expect(fixture.evidenceFields.tool_sequence).toContain('scene_create');
  });

  test('场景上下文符合预期', () => {
    const fixture = E10_NewSceneProtocol;

    // 验证决策上下文
    expect(fixture.decisionContext.scene).toBe('global');
    expect(fixture.decisionContext.user_intent).toContain('create new scene');
  });

  // B0 冒烟：验证证据采集链路
  test('B0 冒烟：证据采集器可填充字段', async () => {
    const { runFixture } = await import('./evidence-collector.js');
    const evidence = await runFixture(E10_NewSceneProtocol);

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
    expect(evidence.decision_context?.strength).toBe('explicit');
    expect(evidence.decision_context?.direction).toBe('new_scene');
    expect(evidence.tool_sequence).toContain('scene_create');
    expect(evidence.action_taken).toBe('scene_create');
    expect(evidence.action_success).toBe(true);

    // 验证语义标记
    expect(evidence.severity).toBe('low');
    expect(evidence.session_clean).toBe(true);

    // C类字段应为 null
    expect(evidence.consumed_at).toBeNull();
    expect(evidence.trigger_context).toBeNull();
    expect(evidence.prompt_id).toBeNull();
  });
});
