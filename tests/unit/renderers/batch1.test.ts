/**
 * M2 渲染器单元测试 - Batch 1
 *
 * 第 1 批验收标准（6 点）：
 * 1. 常量引用（assess-goal 必须 import guidance-semantics.ts）
 * 2. spec-get：渲染 VV+1 语义（禁止 version=1）
 * 3. assess-goal：读取 suggested_next_step 字段
 * 4. spec-create：投影 SpecManager 真实 followup（【事实】→【建议】→【重要】三行结构）
 * 5. 单元测试断言常量原文片段
 * 6. 完成：788/788 + B2b 证据
 */

import { describe, it, expect } from 'vitest';
import { assessGoalRenderer } from '../../../src/mcp/helpers/renderers/assess-goal.js';
import { specCreateRenderer } from '../../../src/mcp/helpers/renderers/spec-create.js';
import { specGetRenderer } from '../../../src/mcp/helpers/renderers/spec-get.js';
import { taskCreateRenderer } from '../../../src/mcp/helpers/renderers/task-create.js';
import { contextSearchRenderer } from '../../../src/mcp/helpers/renderers/context-search.js';
import { taskCreateManyRenderer } from '../../../src/mcp/helpers/renderers/task-create-many.js';
import { taskUpdateRenderer } from '../../../src/mcp/helpers/renderers/task-update.js';
import { taskClaimRenderer } from '../../../src/mcp/helpers/renderers/task-claim.js';
import type { LrnevToolPayload } from '../../../src/mcp/types/response-envelope.js';
import type { CreateManyTasksResult } from '../../../src/types/task.js';
import {
  USER_DECISION_PRIORITY_CLAUSE,
  SPEC_CREATION_SUCCESS_FOLLOWUP,
  GOAL_ASSESSOR_OVERRIDE_CLAUSE,
} from '../../../src/core/guidance-semantics.js';
import { SPEC_REWRITE_GUIDANCE, SPEC_INCREMENT_GUIDANCE } from '../../../src/core/SpecGuidance.js';

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

    it('E-02 G1: 必须投影 ai_followup 中的 SPEC_INCREMENT_GUIDANCE（增量登记边界引导）', () => {
      const payload: LrnevToolPayload<{ spec: string; scene: string; status: string }> = {
        response_version: '1',
        ok: true,
        data: {
          spec: '01-00-user-login',
          scene: '00-default',
          status: 'in-progress',
        },
        ai_followup: {
          instructions: [SPEC_INCREMENT_GUIDANCE],
        },
      };

      const content = specGetRenderer.render(payload);

      // 引导行必须是【建议】角色并覆盖"开发请求→task_create、直接编辑不替代登记"两侧边界（B4 措辞修订）
      expect(content).toContain('【建议】');
      expect(content).toContain('task_create 在对应 Spec 登记开发任务');
      expect(SPEC_INCREMENT_GUIDANCE).toContain('不能替代开发任务的登记');
      // 非 completed 场景不混入开新版措辞
      expect(content).not.toContain('整体推翻');
      expect(content).not.toContain('VV+1');
    });
  });

  describe('task-create 渲染器', () => {
    it('应该投影 ai_followup（不自创 WORKFLOW_OVERVIEW 条款）', () => {
      // T-027：data 使用 Task 的真实 schema 键 id（Task 数据对象没有 task_id 键）
      const payload: LrnevToolPayload<{ id: string; title: string }> = {
        response_version: '1',
        ok: true,
        data: {
          id: 'T-001',
          title: '测试任务',
        },
        ai_followup: {
          instructions: ['下一步：填写任务细节'],
        },
      };

      const content = taskCreateRenderer.render(payload as Parameters<typeof taskCreateRenderer.render>[0]);

      // 身份字段来自 data.id
      expect(content).toContain('✅ Task T-001 已创建：测试任务');
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

    it('F-04.2: query_meta 截断时应追加省略提示行（预算截断省略 K 条）', () => {
      const payload: LrnevToolPayload<{
        results: Array<{ uri: string }>;
        query_meta: {
          returned_count: number;
          total_count: number;
          truncated: boolean;
          omitted: { kind: 'exact'; count: number };
        };
      }> = {
        response_version: '1',
        ok: true,
        data: {
          results: [{ uri: 'context://spec/00-default/01-00-test' }],
          query_meta: {
            returned_count: 1,
            total_count: 3,
            truncated: true,
            omitted: { kind: 'exact', count: 2 },
          },
        },
      };

      const content = contextSearchRenderer.render(payload);

      expect(content).toContain('🔍 找到 1 个匹配结果');
      expect(content).toContain('⚠️ 命中 3 条，仅返回 1 条（预算截断省略 2 条）');
    });

    it('F-04.2: query_meta 未截断（返回=命中总数）时不追加省略行', () => {
      const payload: LrnevToolPayload<{
        results: Array<{ uri: string }>;
        query_meta: {
          returned_count: number;
          total_count: number;
          truncated: boolean;
          omitted: { kind: 'none' };
        };
      }> = {
        response_version: '1',
        ok: true,
        data: {
          results: [{ uri: 'context://spec/00-default/01-00-test' }],
          query_meta: {
            returned_count: 1,
            total_count: 1,
            truncated: false,
            omitted: { kind: 'none' },
          },
        },
      };

      const content = contextSearchRenderer.render(payload);

      expect(content).toContain('🔍 找到 1 个匹配结果');
      expect(content).not.toContain('省略');
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

  describe('task_create_many 渲染器', () => {
    // ADR-0001：task_create_many 为纯原子 all-or-nothing。
    // 成功 data 仅 { created, count }，无逐条失败条目；
    // 任一条失败整批不写，错误经信封 errors（ok=false）错误通道返回。
    it('必须渲染 created 列表与 count（task_id/title）', () => {
      const payload: LrnevToolPayload<CreateManyTasksResult> = {
        response_version: '1',
        ok: true,
        data: {
          created: [
            { id: 'T-001', title: '实现登录' },
            { id: 'T-002', title: '实现注册' },
          ],
          count: 2,
        },
      };

      const content = taskCreateManyRenderer.render(payload);

      expect(content).toContain('已创建 2 个 Task');
      expect(content).toContain('T-001');
      expect(content).toContain('实现登录');
      expect(content).toContain('T-002');
      expect(content).toContain('实现注册');

      // 原子语义：成功 data 不含逐条失败条目，渲染器无 errors 分支
      expect(content).not.toContain('创建失败');
      expect(content).not.toContain('索引');
    });

    it('原子语义：整批失败走信封错误通道（ok=false），无逐条失败渲染', () => {
      const payload: LrnevToolPayload<CreateManyTasksResult> = {
        response_version: '1',
        ok: false,
      };

      const content = taskCreateManyRenderer.render(payload);

      expect(content).toBe('批量创建失败');
      expect(content).not.toContain('索引');
    });

    it('必须投影 ai_followup.instructions', () => {
      const payload: LrnevToolPayload<CreateManyTasksResult> = {
        response_version: '1',
        ok: true,
        data: {
          created: [{ id: 'T-001', title: '测试' }],
          count: 1,
        },
        ai_followup: {
          instructions: ['建议下一步：task_update 置 in_progress'],
        },
      };

      const content = taskCreateManyRenderer.render(payload);

      expect(content).toContain('建议下一步：task_update 置 in_progress');
    });

    it('F-04.2: data.query_meta 存在时追加一致性核对行（全量成功无省略）', () => {
      const payload: LrnevToolPayload<CreateManyTasksResult> = {
        response_version: '1',
        ok: true,
        data: {
          created: [
            { id: 'T-001', title: '实现登录' },
            { id: 'T-002', title: '实现注册' },
          ],
          count: 2,
          query_meta: {
            returned_count: 2,
            total_count: 2,
            truncated: false,
            omitted: { kind: 'none' },
          },
        },
      };

      const content = taskCreateManyRenderer.render(payload);

      expect(content).toContain('创建 2/2 全量成功，无省略');
    });

    it('禁止硬编码 paraphrase', () => {
      const payload: LrnevToolPayload<CreateManyTasksResult> = {
        response_version: '1',
        ok: true,
        data: { created: [], count: 0 },
      };

      const content = taskCreateManyRenderer.render(payload);

      // 不应该有渲染器自创的 guidance 文本
      expect(content).not.toContain('💡');
      expect(content).not.toContain('记得先');
    });
  });

  describe('task_update 渲染器', () => {
    it('必须渲染 task_id 和新 status', () => {
      const payload: LrnevToolPayload<{ id: string; title: string; status: string }> = {
        response_version: '1',
        ok: true,
        data: {
          id: 'T-001',
          title: '实现登录',
          status: 'completed',
        },
      };

      const content = taskUpdateRenderer.render(payload as Parameters<typeof taskUpdateRenderer.render>[0]);

      expect(content).toContain('T-001');
      expect(content).toContain('completed');
      expect(content).toContain('实现登录');
    });

    it('必须投影 ai_followup', () => {
      const payload: LrnevToolPayload<{ id: string; title: string; status: string }> = {
        response_version: '1',
        ok: true,
        data: { id: 'T-001', title: '测试', status: 'in_progress' },
        ai_followup: {
          instructions: ['完成后调 task_update 改为 completed'],
        },
      };

      const content = taskUpdateRenderer.render(payload as Parameters<typeof taskUpdateRenderer.render>[0]);

      expect(content).toContain('完成后调 task_update 改为 completed');
    });

    it('F-03/T-027：带 anchor_context 的 payload → 文本含锚点正文与 text_status 三态标注', () => {
      // 投影闭环验证：anchor_context 此前只在 structuredContent，文本-only 客户端看不到；
      // 修复后 content 文本须含锚点正文（服务端已截断）与 F-04.1 三态状态标注。
      const payload = {
        response_version: '1',
        ok: true,
        data: { id: 'T-001', title: '实现登录', status: 'in_progress' },
        anchor_context: [
          {
            anchor: 'F-01',
            source: 'requirements',
            text: '- 用户用用户名+密码登录，密码错误时返回明确错误并提示找回密码。\n- 验收：登录失败 5 次锁定账号。',
            meta: { text_status: 'complete', returned_length: 50 },
          },
          {
            anchor: 'F-02',
            source: 'requirements',
            text: '- 登录成功后建立会话并返回会话标识；（此段正文超预算被服务端截断的样例）',
            meta: { text_status: 'truncated_by_budget', original_length: 900, returned_length: 60 },
          },
          {
            anchor: 'D-01',
            source: 'design',
            text: '',
            meta: { text_status: 'incomplete_source', original_length: 0, returned_length: 0 },
          },
        ],
      } as Parameters<typeof taskUpdateRenderer.render>[0];

      const content = taskUpdateRenderer.render(payload);

      // 完整态：正文 + 状态标注
      expect(content).toContain('锚点上下文 F-01（requirements.md）：');
      expect(content).toContain('密码错误时返回明确错误');
      expect(content).toContain('状态：text_status=complete（正文完整返回）');
      // 预算截断态：处置指引
      expect(content).toContain('锚点上下文 F-02（requirements.md）：');
      expect(content).toContain('状态：text_status=truncated_by_budget（预算截断，建议缩小范围或查原文）');
      // 源残缺态：正文为空给占位提示 + 补写指引（design 源标 design.md）
      expect(content).toContain('锚点上下文 D-01（design.md）：');
      expect(content).toContain('（本锚点无正文回填）');
      expect(content).toContain('状态：text_status=incomplete_source');
      expect(content).toContain('补写 requirements/design');
    });

    it('F-03/T-027：带 summary_context 的 payload → 文本含 L0/L1 与状态标注', () => {
      const payload = {
        response_version: '1',
        ok: true,
        data: { id: 'T-001', title: '测试', status: 'in_progress' },
        summary_context: {
          source: 'sidecar',
          l0: '登录与会话管理：校验用户名密码、签发会话、登出失效。',
          l1: '概览：登录流程与会话生命周期。',
          meta: { text_status: 'complete', returned_length: 44 },
        },
      } as Parameters<typeof taskUpdateRenderer.render>[0];

      const content = taskUpdateRenderer.render(payload);

      expect(content).toContain('Spec 摘要上下文（sidecar 摘要）：');
      expect(content).toContain('L0: 登录与会话管理');
      expect(content).toContain('L1: 概览：登录流程与会话生命周期。');
      expect(content).toContain('状态：text_status=complete（正文完整返回）');
    });
  });

  describe('task_claim 渲染器', () => {
    it('必须渲染 claim 身份和状态字段', () => {
      const payload: LrnevToolPayload<{
        claim: {
          task: string;
          claimed_by: string;
          expires_at: string;
          touches_files?: string[];
        };
        claimed: boolean;
      }> = {
        response_version: '1',
        ok: true,
        data: {
          claim: {
            task: 'T-001',
            claimed_by: 'agent-a',
            expires_at: '2026-09-02T10:00:00Z',
            touches_files: ['src/auth.ts'],
          },
          claimed: true,
        },
      };

      const content = taskClaimRenderer.render(payload as Parameters<typeof taskClaimRenderer.render>[0]);

      expect(content).toContain('T-001');
      expect(content).toContain('agent-a');
      expect(content).toContain('2026-09-02T10:00:00Z');
      expect(content).toContain('src/auth.ts');
    });

    it('必须渲染 overlaps 提示（如有）', () => {
      const payload: LrnevToolPayload<{
        claim: { task: string; claimed_by: string; expires_at: string };
        claimed: boolean;
        overlaps: Array<{ task: string; claimed_by: string; touches_files: string[] }>;
      }> = {
        response_version: '1',
        ok: true,
        data: {
          claim: { task: 'T-001', claimed_by: 'agent-a', expires_at: '2026-09-02T10:00:00Z' },
          claimed: true,
          overlaps: [
            {
              task: 'T-002',
              claimed_by: 'agent-b',
              touches_files: ['src/auth.ts'],
            },
          ],
        },
      };

      const content = taskClaimRenderer.render(payload as Parameters<typeof taskClaimRenderer.render>[0]);

      expect(content).toContain('重叠');
      expect(content).toContain('T-002');
      expect(content).toContain('agent-b');
    });

    it('F-03/T-027：带 anchor_context/summary_context → 与 task_update 同口径投影', () => {
      // claim 与 task_update 共用 buildAnchorContext（堵 claim 旁路），文本通道投影须同源同格式。
      const payload = {
        response_version: '1',
        ok: true,
        data: {
          claim: { task: 'T-001', claimed_by: 'agent-a', expires_at: '2026-09-02T10:00:00Z' },
          claimed: true,
        },
        anchor_context: [
          {
            anchor: 'F-01',
            source: 'requirements',
            text: '- 验收：登录失败 5 次锁定账号。',
            meta: { text_status: 'complete', returned_length: 19 },
          },
        ],
        summary_context: {
          source: 'inline',
          l0: '登录与会话管理。',
          meta: { text_status: 'truncated_by_budget', original_length: 500, returned_length: 30 },
        },
      } as Parameters<typeof taskClaimRenderer.render>[0];

      const content = taskClaimRenderer.render(payload);

      // 原 claim 字段不受影响
      expect(content).toContain('已登记 claim');
      expect(content).toContain('agent-a');
      // anchor 投影与状态标注
      expect(content).toContain('锚点上下文 F-01（requirements.md）：');
      expect(content).toContain('登录失败 5 次锁定账号');
      expect(content).toContain('状态：text_status=complete（正文完整返回）');
      // summary 投影（inline 来源标注 + 预算截断标注）
      expect(content).toContain('Spec 摘要上下文（requirements 内联摘要）：');
      expect(content).toContain('L0: 登录与会话管理。');
      expect(content).toContain('状态：text_status=truncated_by_budget（预算截断，建议缩小范围或查原文）');
    });
  });
});
