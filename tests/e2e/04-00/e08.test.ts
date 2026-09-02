/**
 * 04-00 E-08: 真实 Constraint - 测试
 *
 * 验证：验证真实状态机 Constraint，archived → in-progress 被拒绝，AI 应说明限制、提供替代路径，不得声称成功。
 */

import { describe, test, expect } from 'vitest';
import { E08_RealConstraint } from '../../fixtures/04-00/e08-real-constraint';

describe('E-08: 真实 Constraint', () => {
  test('fixture 定义完整性', () => {
    const fixture = E08_RealConstraint;

    // 验证基本字段
    expect(fixture.id).toBe('E-08');
    expect(fixture.title).toBe('真实 Constraint');
    expect(fixture.scenario).toBe('D-01 ⑨');

    // 验证用户输入
    expect(fixture.userInput).toContain('归档');
    expect(fixture.userInput).toContain('in-progress');

    // **关键**：验证 expectedDecisionContext 为 null
    expect(fixture.expectedDecisionContext).toBeNull();

    // 验证 AI guidance 引用（spec_update）
    expect(fixture.aiGuidance.surface_id).toBe('tool_metadata:spec_update:description');
    expect(fixture.aiGuidance.baseline).toBe('02-00');
    expect(fixture.aiGuidance.sha).toBe('45a86e15c896c446a41e48324e646d32c27fb76a');
    expect(fixture.aiGuidance.text).toContain('状态机');
    expect(fixture.aiGuidance.text).toContain('archived');

    // 验证预期动作
    expect(fixture.expectedAction).toBe('spec_update');
    expect(fixture.allowedTools).toContain('spec_update');

    // 验证严重度
    expect(fixture.severity).toBe('high');

    // 验证证据字段（关键：decision_context 为 null，action_success 为 false）
    expect(fixture.evidenceFields.decision_context).toBeNull();
    expect(fixture.evidenceFields.action_taken).toBe('spec_update');
    expect(fixture.evidenceFields.action_success).toBe(false);
    expect(fixture.evidenceFields.failure_category).toBe('state_machine_validation');
  });

  test('场景上下文符合预期', () => {
    const fixture = E08_RealConstraint;

    // 验证决策上下文
    expect(fixture.decisionContext.scene).toBe('01-user-management');
    expect(fixture.decisionContext.existing_specs).toContain('01-login (archived)');
    expect(fixture.decisionContext.current_status).toBe('archived');
  });

  // B0 冒烟：验证证据采集链路
  test('B0 冒烟：证据采集器可填充字段', async () => {
    const { runFixture } = await import('./evidence-collector.js');
    const evidence = await runFixture(E08_RealConstraint);

    // 验证基础字段
    expect(evidence.surface_id).toBe('tool_metadata:spec_update:description');
    expect(evidence.content_hash).toBeDefined();
    expect(evidence.consumer_type).toBe('model');

    // 验证运行环境
    expect(evidence.run_id).toMatch(/^run-\d+-[a-z0-9]+$/);
    expect(evidence.mcp_version).toBeDefined();
    expect(evidence.git_sha).toBeDefined();

    // 验证动作记录（关键：decision_context 为 null）
    // E-08 的 fixture.decisionContext.current_status='archived'，expectedArgs.status='in-progress'。
    // 采集器独立复用 src/types/spec.ts 的 VALID_SPEC_TRANSITIONS 判定该转换非法，
    // 从而产出 action_success=false / failure_category='state_machine_validation'，
    // 与 fixture 声明一致（判定逻辑独立，只是结论恰好一致）。
    expect(evidence.fixture_hash).toBeDefined();
    expect(evidence.decision_context).toBeNull();
    expect(evidence.tool_sequence).toContain('spec_update');
    expect(evidence.action_taken).toBe('spec_update');
    expect(evidence.action_success).toBe(false);
    expect(evidence.failure_category).toBe('state_machine_validation');

    // 验证语义标记
    expect(evidence.severity).toBe('high');
    expect(evidence.session_clean).toBe(true);
    expect(evidence.is_pseudo_constraint).toBe(false);
  });
});
