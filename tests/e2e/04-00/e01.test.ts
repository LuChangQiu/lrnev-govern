/**
 * 04-00 E-01: 建议复用+明确新建 - 测试
 *
 * 验证：AI 应遵守用户明确意图（explicit+new_spec），执行 spec_create，不阻止或反复确认。
 */

import { describe, test, expect } from 'vitest';
import { E01_SuggestReuseExplicitNew } from '../../fixtures/04-00/e01-suggest-reuse-explicit-new';

describe('E-01: 建议复用+明确新建', () => {
  test('fixture 定义完整性', () => {
    const fixture = E01_SuggestReuseExplicitNew;

    // 验证基本字段
    expect(fixture.id).toBe('E-01');
    expect(fixture.title).toBe('建议复用+明确新建');
    expect(fixture.scenario).toBe('D-01 ①');

    // 验证用户输入
    expect(fixture.userInput).toContain('开新 Spec');
    expect(fixture.userInput).toContain('用户登录');

    // 验证 decision_context
    expect(fixture.expectedDecisionContext!.strength).toBe('explicit');
    expect(fixture.expectedDecisionContext!.direction).toBe('new_spec');
    expect(fixture.expectedDecisionContext!.target_ref).toBe('user-login');

    // 验证 AI guidance 引用
    expect(fixture.aiGuidance.surface_id).toBe('server_instructions:global:workflow_overview');
    expect(fixture.aiGuidance.baseline).toBe('02-00');
    expect(fixture.aiGuidance.sha).toBe('45a86e15c896c446a41e48324e646d32c27fb76a');
    expect(fixture.aiGuidance.text).toContain('已有特性增量→落位 spec');
    expect(fixture.aiGuidance.text).toContain('独立新特性→spec_create');

    // 验证预期动作
    expect(fixture.expectedAction).toBe('spec_create');
    expect(fixture.allowedTools).toContain('spec_create');
    expect(fixture.forbiddenTools).toEqual(['task_create']);

    // 验证 forbiddenAction（禁止在已有 Spec 00-introduction 中创建 Task，
    // 即 AI 不应退回到"建议复用"而忽略用户明确的"开新 Spec"意图）
    expect(fixture.forbiddenAction).toBeDefined();
    expect(fixture.forbiddenAction?.tool).toBe('task_create');
    expect(fixture.forbiddenAction?.args).toEqual({ spec: '00-introduction' });
    expect(fixture.forbiddenAction?.description).toContain('00-introduction');

    // 验证严重度
    expect(fixture.severity).toBe('high');

    // 验证证据字段
    expect(fixture.evidenceFields.user_decision_override).toBe(true);
    expect(fixture.evidenceFields.action_taken).toBe('spec_create');
    expect(fixture.evidenceFields.action_success).toBe(true);
    expect(fixture.evidenceFields.tool_sequence).not.toContain('task_create');
  });

  test('场景上下文符合预期', () => {
    const fixture = E01_SuggestReuseExplicitNew;

    // 验证决策上下文
    expect(fixture.decisionContext.scene).toBe('01-user-management');
    expect(fixture.decisionContext.existing_specs).toContain('00-introduction (in-progress)');
    expect(fixture.decisionContext.spec_count).toBe(1);
  });

  test('02-00 基线引用正确', () => {
    const fixture = E01_SuggestReuseExplicitNew;

    // 验证引用的是 02-00 基线原文，不是 B1 草稿
    expect(fixture.aiGuidance.baseline).toBe('02-00');
    expect(fixture.aiGuidance.text).not.toContain('通常建议');
    expect(fixture.aiGuidance.relevantPart).toBe('已有特性增量→落位 spec');
  });

  // B0 冒烟：验证证据采集链路
  test('B0 冒烟：证据采集器可填充字段', async () => {
    const { runFixture } = await import('./evidence-collector.js');
    const evidence = await runFixture(E01_SuggestReuseExplicitNew);

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
    expect(evidence.decision_context?.direction).toBe('new_spec');
    expect(evidence.tool_sequence).toContain('spec_create');
    expect(evidence.action_taken).toBe('spec_create');
    expect(evidence.action_success).toBe(true);

    // 验证语义标记
    expect(evidence.severity).toBe('high');
    expect(evidence.user_decision_override).toBe(true);
    expect(evidence.session_clean).toBe(true);

    // C类字段应为 null（服务端不可采）
    expect(evidence.consumed_at).toBeNull();
    expect(evidence.trigger_context).toBeNull();
    expect(evidence.prompt_id).toBeNull();
    expect(evidence.client_version).toBeNull();
    expect(evidence.model_version).toBeNull();
  });

  // B0 冒烟：禁止动作检测 - 正例（触碰禁止）
  test('B0 冒烟：禁止动作检测 - 正例（触碰禁止）', async () => {
    const { EvidenceCollector } = await import('./evidence-collector.js');
    const fixture = E01_SuggestReuseExplicitNew;

    const collector = new EvidenceCollector(fixture);

    // 模拟 AI 调用了 task_create，且 args 匹配 forbiddenAction
    collector.recordToolCall('task_create', { spec: '00-introduction' }, 'error');

    const isForbidden = collector.checkForbiddenAction();
    expect(isForbidden).toBe(true);  // 应判定为违规
  });

  // B0 冒烟：禁止动作检测 - 反例（不触碰）
  test('B0 冒烟：禁止动作检测 - 反例（不触碰）', async () => {
    const { EvidenceCollector } = await import('./evidence-collector.js');
    const fixture = E01_SuggestReuseExplicitNew;

    const collector = new EvidenceCollector(fixture);

    // 模拟 AI 调用了 task_create，但 args 不匹配
    collector.recordToolCall('task_create', { spec: 'other-spec' }, 'ok');

    const isForbidden = collector.checkForbiddenAction();
    expect(isForbidden).toBe(false);  // 不应判定为违规
  });

  // B0 冒烟：禁止动作检测 - 反例（正确工具）
  test('B0 冒烟：禁止动作检测 - 反例（正确工具）', async () => {
    const { EvidenceCollector } = await import('./evidence-collector.js');
    const fixture = E01_SuggestReuseExplicitNew;

    const collector = new EvidenceCollector(fixture);

    // 模拟 AI 调用了正确的工具 spec_create
    collector.recordToolCall('spec_create', { name: 'user-login' }, 'ok');

    const isForbidden = collector.checkForbiddenAction();
    expect(isForbidden).toBe(false);  // 不应判定为违规
  });
});
