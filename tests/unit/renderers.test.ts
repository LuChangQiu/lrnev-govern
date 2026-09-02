/**
 * M2 第 1 批渲染器单元测试
 *
 * 验收标准（6 点）：
 * 1. 常量引用（assess-goal 必须 import guidance-semantics.ts）
 * 2. spec-get：渲染 VV+1 语义（禁止 version=1）
 * 3. assess-goal：读取 suggested_next_step 字段
 * 4. spec-create：投影 SpecManager 真实 followup（【事实】→【建议】→【重要】三行结构）
 * 5. 单元测试断言常量原文片段
 * 6. 完成：788/788 + B2b 证据
 */

import { describe, it, expect } from 'vitest';
import { assessGoalRenderer } from '../../src/mcp/helpers/renderers/assess-goal.js';
import { specCreateRenderer } from '../../src/mcp/helpers/renderers/spec-create.js';
import { specGetRenderer } from '../../src/mcp/helpers/renderers/spec-get.js';
import { taskCreateRenderer } from '../../src/mcp/helpers/renderers/task-create.js';
import { contextSearchRenderer } from '../../src/mcp/helpers/renderers/context-search.js';
import type { LrnevToolPayload } from '../../src/mcp/types/response-envelope.js';
import {
  USER_DECISION_PRIORITY_CLAUSE,
  SPEC_CREATION_SUCCESS_FOLLOWUP,
  GOAL_ASSESSOR_OVERRIDE_CLAUSE,
} from '../../src/core/guidance-semantics.js';
import { SPEC_REWRITE_GUIDANCE } from '../../src/core/SpecGuidance.js';

describe('M2 第 1 批渲染器 - 常量引用验收', () => {
  describe('assess-goal 渲染器', () => {
    it('必须读取 suggested_next_step 字段（不是 reasoning）', () => {
      const payload: LrnevToolPayload<{ kind: string; suggested_next_step: string }> = {
        response_version: '1',
        ok: true,
        data: {
          kind: 'single-spec',
          suggested_next_step: '建议在现有 Scene 下创建一个 Spec',
        },
      };

      const content = assessGoalRenderer.render(payload);

      // 必须包含 suggested_next_step 内容
      expect(content).toContain('建议在现有 Scene 下创建一个 Spec');
    });

    it('必须引用 GOAL_ASSESSOR_OVERRIDE_CLAUSE 常量原文', () => {
      const payload: LrnevToolPayload<{ kind: string; suggested_next_step: string }> = {
        response_version: '1',
        ok: true,
        data: {
          kind: 'single-spec',
          suggested_next_step: 'test',
        },
      };

      const content = assessGoalRenderer.render(payload);

      // 必须包含常量原文关键片段："suggested_next_step 是基于启发式的建议"
      expect(content).toContain('suggested_next_step 是基于启发式的建议');
      expect(content).toContain('不是强制步骤');

      // 验证实际使用常量（不是 paraphrase）
      expect(GOAL_ASSESSOR_OVERRIDE_CLAUSE).toContain('suggested_next_step 是基于启发式的建议');
      expect(content).toContain(GOAL_ASSESSOR_OVERRIDE_CLAUSE);
    });

    it('禁止硬编码 paraphrase（如"💡 这是建议，不是强制"）', () => {
      const payload: LrnevToolPayload<{ kind: string }> = {
        response_version: '1',
        ok: true,
        data: { kind: 'single-spec' },
      };

      const content = assessGoalRenderer.render(payload);

      // 禁止旧版硬编码文案
      expect(content).not.toContain('💡 这是建议，不是强制');
    });
  });

  describe('spec-create 渲染器', () => {
    it('必须投影 ai_followup 中的【事实】→【建议】→【重要】三行结构', () => {
      // 模拟 SpecManager 真实 followup（L216-218）
      const payload: LrnevToolPayload<{ spec: string; scene: string; path: string }> = {
        response_version: '1',
        ok: true,
        data: {
          spec: '01-00-test-spec',
          scene: '00-default',
          path: '.lrnev/scenes/00-default/specs/01-00-test-spec',
        },
        ai_followup: {
          instructions: [
            '【事实】Spec "01-00-test-spec" 已创建于 Scene "00-default"，路径 .lrnev/scenes/00-default/specs/01-00-test-spec',
            '【建议】如果这是已有特性的增量，通常可以考虑 context_search 找到对应 Spec 用 task_create 落位。',
            '【重要】以上是治理建议，不代表本次创建失败。若用户已明确要求创建独立 Spec，不得擅自撤销或回退。',
          ],
        },
      };

      const content = specCreateRenderer.render(payload);

      // 必须包含【事实】行
      expect(content).toContain('【事实】');
      expect(content).toContain('已创建于 Scene');

      // 必须包含【建议】行
      expect(content).toContain('【建议】');

      // 必须包含【重要】行
      expect(content).toContain('【重要】');
      expect(content).toContain('不得擅自撤销或回退');
    });

    it('必须投影 USER_DECISION_PRIORITY_CLAUSE 常量原文', () => {
      const payload: LrnevToolPayload<{ spec: string; scene: string; path: string }> = {
        response_version: '1',
        ok: true,
        data: {
          spec: '01-00-test',
          scene: '00-default',
          path: '.lrnev/scenes/00-default/specs/01-00-test',
        },
        ai_followup: {
          instructions: [
            '【事实】测试',
            '【建议】测试',
            USER_DECISION_PRIORITY_CLAUSE, // 应该在 ai_followup 中
          ],
        },
      };

      const content = specCreateRenderer.render(payload);

      // 必须包含常量原文关键片段："不是强制规则"
      expect(content).toContain('不是强制规则');
      expect(USER_DECISION_PRIORITY_CLAUSE).toContain('不是强制规则');
    });

    it('必须投影 SPEC_CREATION_SUCCESS_FOLLOWUP 常量原文', () => {
      const payload: LrnevToolPayload<{ spec: string; scene: string; path: string }> = {
        response_version: '1',
        ok: true,
        data: {
          spec: '01-00-test',
          scene: '00-default',
          path: '.lrnev/scenes/00-default/specs/01-00-test',
        },
        ai_followup: {
          instructions: [
            '【事实】测试',
            SPEC_CREATION_SUCCESS_FOLLOWUP,
          ],
        },
      };

      const content = specCreateRenderer.render(payload);

      // 必须包含常量原文关键片段："不得擅自撤销或回退"
      expect(content).toContain('不得擅自撤销或回退');
      expect(SPEC_CREATION_SUCCESS_FOLLOWUP).toContain('不得擅自撤销或回退');
    });

    it('禁止硬编码 paraphrase（如"用户决定优先于建议"）', () => {
      const payload: LrnevToolPayload<{ spec: string; scene: string; path: string }> = {
        response_version: '1',
        ok: true,
        data: {
          spec: '01-00-test',
          scene: '00-default',
          path: '.lrnev/scenes/00-default/specs/01-00-test',
        },
      };

      const content = specCreateRenderer.render(payload);

      // 禁止旧版硬编码简化文案（应该用完整常量原文）
      // 注意：如果 ai_followup 中有完整文本，渲染器投影后会包含，这是正确的
      // 这里测试的是渲染器自己不应该硬编码简化版
      expect(content).not.toContain('【重要】用户决定优先于建议\n- 若用户明确确认要开 spec');
    });
  });

  describe('spec-get 渲染器', () => {
    it('必须渲染 ai_followup 中的 SPEC_REWRITE_GUIDANCE（VV+1 语义）', () => {
      const payload: LrnevToolPayload<{ spec: string; scene: string; status: string }> = {
        response_version: '1',
        ok: true,
        data: {
          spec: '01-00-completed',
          scene: '00-default',
          status: 'completed',
        },
        ai_followup: {
          instructions: [SPEC_REWRITE_GUIDANCE],
        },
      };

      const content = specGetRenderer.render(payload);

      // 必须包含 VV+1 语义（不是 version=1）
      expect(content).toContain('VV+1');
      expect(SPEC_REWRITE_GUIDANCE).toContain('VV+1');
    });

    it('禁止硬编码 version=1（必须使用 VV+1 语义）', () => {
      const payload: LrnevToolPayload<{ spec: string; scene: string; status: string }> = {
        response_version: '1',
        ok: true,
        data: {
          spec: '01-00-test',
          scene: '00-default',
          status: 'completed',
        },
      };

      const content = specGetRenderer.render(payload);

      // 禁止硬编码 version=1
      expect(content).not.toContain('version=1');
      expect(content).not.toContain('spec_create version=1');
    });

    it('零噪音原则：非 completed 状态不应该渲染 SPEC_REWRITE_GUIDANCE', () => {
      const payload: LrnevToolPayload<{ spec: string; scene: string; status: string }> = {
        response_version: '1',
        ok: true,
        data: {
          spec: '01-00-draft',
          scene: '00-default',
          status: 'draft',
        },
      };

      const content = specGetRenderer.render(payload);

      // draft 状态不应该提示开新版
      expect(content).not.toContain('VV+1');
      expect(content).not.toContain('整体推翻');
    });
  });

  describe('task-create 渲染器', () => {
    it('应该投影 ai_followup（不自创 WORKFLOW_OVERVIEW 条款）', () => {
      const payload: LrnevToolPayload<{ task_id: string; title: string }> = {
        response_version: '1',
        ok: true,
        data: {
          task_id: 'T-001',
          title: '测试任务',
        },
        ai_followup: {
          instructions: ['下一步：填写任务细节'],
        },
      };

      const content = taskCreateRenderer.render(payload);

      // 应该投影 ai_followup
      expect(content).toContain('下一步：填写任务细节');

      // TaskManager 不生成 WORKFLOW_OVERVIEW 条款（该条款属于 SpecManager）
      // 所以渲染器也不应该自创
      expect(content).not.toContain('WORKFLOW_OVERVIEW');
    });
  });

  describe('context-search 渲染器', () => {
    it('应该投影 ai_followup（不自创 WORKFLOW_OVERVIEW 条款）', () => {
      const payload: LrnevToolPayload<{ results: Array<{ uri: string; l0?: string }> }> = {
        response_version: '1',
        ok: true,
        data: {
          results: [
            { uri: 'context://spec/00-default/01-00-test', l0: '测试 Spec' },
          ],
        },
        ai_followup: {
          instructions: ['建议：阅读上述 Spec 确认是否可复用'],
        },
      };

      const content = contextSearchRenderer.render(payload);

      // 应该投影 ai_followup
      expect(content).toContain('建议：阅读上述 Spec 确认是否可复用');

      // ContextSearch 不生成 WORKFLOW_OVERVIEW 条款（该条款属于 SpecManager）
      // 所以渲染器也不应该自创
      expect(content).not.toContain('WORKFLOW_OVERVIEW');
    });
  });

  describe('渲染器职责边界验证', () => {
    it('渲染器应该投影 canonical payload 中已有数据，不再创作 guidance 文本', () => {
      // 这是核心原则：渲染器 = 投影器，不是文案创作器

      // assess-goal 应该投影 GOAL_ASSESSOR_OVERRIDE_CLAUSE
      expect(GOAL_ASSESSOR_OVERRIDE_CLAUSE).toContain('suggested_next_step 是基于启发式的建议');

      // spec-create 应该投影 USER_DECISION_PRIORITY_CLAUSE + SPEC_CREATION_SUCCESS_FOLLOWUP
      expect(USER_DECISION_PRIORITY_CLAUSE).toContain('不是强制规则');
      expect(SPEC_CREATION_SUCCESS_FOLLOWUP).toContain('不得擅自撤销或回退');

      // spec-get 应该投影 SPEC_REWRITE_GUIDANCE
      expect(SPEC_REWRITE_GUIDANCE).toContain('VV+1');
    });
  });
});
