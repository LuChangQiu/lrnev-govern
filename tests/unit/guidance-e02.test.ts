/**
 * E-02 门禁引导改进（G1-G4）语义测试。
 *
 * 覆盖（设计定稿：dev-docs/decisions/2026-09-03-E02门禁综合判定与引导设计.md）：
 * - G1：spec_get 对"存在但非 completed"的 Spec 挂 followup —— 常量 SPEC_INCREMENT_GUIDANCE
 *       语义（【建议】角色、增量=task_create 登记、改正文=直接编辑）；运行级 in-progress
 *       触发在 tests/unit/mcp-server.test.ts 覆盖。
 * - G2：task_create description 补"已有 in-progress/ready Spec 下登记增量"触发场景。
 * - G3：WORKFLOW_OVERVIEW 分流句补机制层（落位 spec 后新增开发工作用 task_create 登记）；
 *       concepts 边界句可区分"新增条款/增量=治理登记 vs 修改既有文本=直接编辑"。
 * - G4：task_create description 的示例驱动场景（用户在已有 Spec 说"继续补充登录功能"）。
 */

import { describe, expect, it } from 'vitest';
import { WORKFLOW_OVERVIEW, TOOL_DESCRIPTIONS, buildGuide } from '../../src/mcp/guidance.js';
import { SPEC_INCREMENT_GUIDANCE } from '../../src/core/SpecGuidance.js';
import { ROLE_PREFIX } from '../../src/core/guidance-semantics.js';

describe('E-02 G1-G4: 已有 Spec 下的增量登记引导', () => {
  describe('G1: spec_get 非 completed 的【建议】边界引导行', () => {
    it('引导行用 ROLE_PREFIX 前缀体系（【建议】）且边界清晰：开发请求→task_create 登记，直接编辑不替代登记（B4 措辞修订）', () => {
      expect(SPEC_INCREMENT_GUIDANCE.startsWith(ROLE_PREFIX.RECOMMENDATION)).toBe(true);
      expect(SPEC_INCREMENT_GUIDANCE).toContain('用户请求开发或扩展功能');
      expect(SPEC_INCREMENT_GUIDANCE).toContain('task_create 在对应 Spec 登记开发任务');
      expect(SPEC_INCREMENT_GUIDANCE).toContain('不能替代开发任务的登记');
    });

    it('增量引导与"开新版"引导语义分离：不混入整体推翻/VV+1/version 措辞', () => {
      expect(SPEC_INCREMENT_GUIDANCE).not.toContain('整体推翻');
      expect(SPEC_INCREMENT_GUIDANCE).not.toContain('VV+1');
      expect(SPEC_INCREMENT_GUIDANCE).not.toContain('version');
    });
  });

  describe('G2+G4: task_create description 的触发场景与示例驱动', () => {
    it('何时用包含"已有 in-progress/ready Spec 下登记增量"触发场景（E-02 缺失语义），不再只讲新建 Spec 后拆任务', () => {
      expect(TOOL_DESCRIPTIONS.task_create).toContain('在已有 in-progress/ready Spec 下登记新增执行项/开发增量时也用它');
      expect(TOOL_DESCRIPTIONS.task_create).toContain('不是只有新建 Spec 后才拆任务');
    });

    it('例子含已有 Spec 增量场景示例（G4：用户在已有 Spec 说"继续补充登录功能" → task_create）', () => {
      expect(TOOL_DESCRIPTIONS.task_create).toContain('继续补充登录功能');
      expect(TOOL_DESCRIPTIONS.task_create).toContain(
        'task_create{scene:"01-user-management",spec:"01-00-user-login",title:"补充登录功能"}',
      );
    });
  });

  describe('G3: WORKFLOW_OVERVIEW 分流句与 concepts 边界句', () => {
    it('分流句补机制层：已有特性增量落位 spec 后，新增开发工作用 task_create 登记', () => {
      expect(WORKFLOW_OVERVIEW).toContain('已有特性增量→落位 spec');
      expect(WORKFLOW_OVERVIEW).toContain('落位后新增开发工作用 task_create 登记');
    });

    it('边界句可区分"开发登记 vs 文档维护"：开发/扩展功能先 task_create 登记，直接编辑不替代登记（B4 修订消除"改正文"宽泛豁免）', () => {
      const concepts = buildGuide('concepts').data.content;
      expect(concepts).toContain('用户请求的开发/扩展功能');
      expect(concepts).toContain('不能替代开发任务登记');
      // 旧的宽泛豁免句（"修改既有文本内容可直接编辑原文件"为任何编辑背书）不再原样出现
      expect(concepts).not.toContain('修改既有文本内容可直接编辑原文件');
      // 开新版（VV+1）语义仍保留
      expect(concepts).toContain('VV 是正式重写版号，不是修订号');
    });
  });
});
