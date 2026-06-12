/**
 * GoalAssessor 单元测试。
 *
 * 覆盖三类目标：单 Spec、多 Spec 项目、研究型项目。
 */

import { describe, it, expect } from 'vitest';

import { GoalAssessor } from '../../src/core/GoalAssessor.js';

describe('GoalAssessor', () => {
  const assessor = new GoalAssessor();

  it('简单明确目标应评估为 single-spec', () => {
    const res = assessor.assess('给用户登录增加验证码');
    expect(res.data.kind).toBe('single-spec');
    expect(res.ai_followup?.instructions.join('\n')).toContain('single-spec');
  });

  it('跨模块目标应评估为 multi-spec-program', () => {
    const res = assessor.assess('重构认证系统，同时调整权限、登录、用户资料多个工作流');
    expect(res.data.kind).toBe('multi-spec-program');
    expect(res.data.reasons.join('\n')).toContain('跨模块');
  });

  it('调研和选型目标应评估为 research-program', () => {
    const res = assessor.assess('调研向量检索和 SQLite 索引方案，验证存储架构和性能约束');
    expect(res.data.kind).toBe('research-program');
    expect(res.data.reasons.join('\n')).toContain('调研');
  });

  it('高风险技术词不应把集中目标强判为 multi-spec-program', () => {
    const res = assessor.assess('重构用户认证系统并解决权限和安全问题');
    expect(res.data.kind).not.toBe('multi-spec-program');
    expect(res.data.confidence).toBe('medium');
    expect(res.data.reasons.join('\n')).toContain('高风险');
  });

  it('短目标信号不足时 confidence 应为 low 并提示 AI 判断', () => {
    const res = assessor.assess('优化按钮');
    expect(res.data.kind).toBe('single-spec');
    expect(res.data.confidence).toBe('low');
    expect(res.ai_followup?.instructions.join('\n')).toContain('启发式信号不足');
  });

  it('调研词和实现描述同时出现时不应一票判为 research-program', () => {
    const res = assessor.assess('调研登录方案并实现验证码');
    expect(res.data.kind).not.toBe('research-program');
  });

  it('不应新增 landing 分流字段，分流交给 ai_followup', () => {
    const res = assessor.assess('修安全漏洞');
    expect(res.data).not.toHaveProperty('landing');
    expect(res.ai_followup?.instructions.join('\n')).toContain('三档分流');
    expect(res.ai_followup?.instructions.join('\n')).toContain('error_record');
    expect(res.ai_followup?.instructions.join('\n')).toContain('adr_create');
    expect(res.ai_followup?.instructions.join('\n')).toContain('memory_save');
    expect(res.ai_followup?.instructions.join('\n')).toContain('spec_create');
  });

  it('11-F04: 顿号枚举 ≥3 个并列项应触发枚举信号并提升复杂度', () => {
    const single = assessor.assess('实现文档导入');
    const enumerated = assessor.assess('列表检索、导入导出、权限审计、异步转换、前端交互');
    expect(enumerated.data.reasons.join('\n')).toContain('并列项');
    expect(enumerated.data.score).toBeGreaterThan(single.data.score);
  });

  it('S4(I-11): 明显多特性枚举目标的 kind 应升为 multi-spec-program（与 reasons 一致）', () => {
    const res = assessor.assess('做一个完整代码图谱系统:解析、可视化、搜索、增量更新、导出报告');
    expect(res.data.kind).toBe('multi-spec-program');
    expect(res.data.reasons.join('\n')).toContain('并列项');
  });

  it('空目标应拒绝', () => {
    expect(() => assessor.assess('  ')).toThrow();
  });
});
