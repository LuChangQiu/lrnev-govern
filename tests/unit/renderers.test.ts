/**
 * M2 渲染器单元测试
 *
 * 第 1 批验收标准（6 点）：
 * 1. 常量引用（assess-goal 必须 import guidance-semantics.ts）
 * 2. spec-get：渲染 VV+1 语义（禁止 version=1）
 * 3. assess-goal：读取 suggested_next_step 字段
 * 4. spec-create：投影 SpecManager 真实 followup（【事实】→【建议】→【重要】三行结构）
 * 5. 单元测试断言常量原文片段
 * 6. 完成：788/788 + B2b 证据
 *
 * 第 2 批验收标准（7 点）：
 * 1. 投影 canonical payload，不创作 guidance 文本
 * 2. 禁止硬编码 paraphrase
 * 3. MVC required 字段完整呈现（D-04 分类）
 * 4. 逃逸用户文本
 * 5. 注册到 initializeRenderers
 * 6. 单元测试（required 字段 + 无 paraphrase + ai_followup 投影）
 * 7. legacyRawFormat 已弃用
 */

import { describe, it, expect } from 'vitest';
import { assessGoalRenderer } from '../../src/mcp/helpers/renderers/assess-goal.js';
import { specCreateRenderer } from '../../src/mcp/helpers/renderers/spec-create.js';
import { specGetRenderer } from '../../src/mcp/helpers/renderers/spec-get.js';
import { taskCreateRenderer } from '../../src/mcp/helpers/renderers/task-create.js';
import { contextSearchRenderer } from '../../src/mcp/helpers/renderers/context-search.js';
import { taskCreateManyRenderer } from '../../src/mcp/helpers/renderers/task-create-many.js';
import { taskUpdateRenderer } from '../../src/mcp/helpers/renderers/task-update.js';
import { taskClaimRenderer } from '../../src/mcp/helpers/renderers/task-claim.js';
import { taskReleaseRenderer } from '../../src/mcp/helpers/renderers/task-release.js';
import { adrCreateRenderer } from '../../src/mcp/helpers/renderers/adr-create.js';
import { memorySaveRenderer } from '../../src/mcp/helpers/renderers/memory-save.js';
import { memoryForgetRenderer } from '../../src/mcp/helpers/renderers/memory-forget.js';
import { errorRecordRenderer } from '../../src/mcp/helpers/renderers/error-record.js';
import { errorPromoteRenderer } from '../../src/mcp/helpers/renderers/error-promote.js';
import { summarizeSaveRenderer } from '../../src/mcp/helpers/renderers/summarize-save.js';
import { sessionCommitRenderer } from '../../src/mcp/helpers/renderers/session-commit.js';
import { agentRegisterRenderer } from '../../src/mcp/helpers/renderers/agent-register.js';
import { agentHeartbeatRenderer } from '../../src/mcp/helpers/renderers/agent-heartbeat.js';
import { agentUnregisterRenderer } from '../../src/mcp/helpers/renderers/agent-unregister.js';
import { lrnevHookEnableRenderer } from '../../src/mcp/helpers/renderers/lrnev-hook-enable.js';
import { lrnevHookDisableRenderer } from '../../src/mcp/helpers/renderers/lrnev-hook-disable.js';
import { lrnevHookTriggerRenderer } from '../../src/mcp/helpers/renderers/lrnev-hook-trigger.js';
import { lrnevInitRenderer } from '../../src/mcp/helpers/renderers/lrnev-init.js';
import { specGateCheckRenderer } from '../../src/mcp/helpers/renderers/spec-gate-check.js';
import { adrGetRenderer } from '../../src/mcp/helpers/renderers/adr-get.js';
import { taskListRenderer } from '../../src/mcp/helpers/renderers/task-list.js';
import { sceneGetRenderer } from '../../src/mcp/helpers/renderers/scene-get.js';
import { errorSearchRenderer } from '../../src/mcp/helpers/renderers/error-search.js';
import { memorySearchRenderer } from '../../src/mcp/helpers/renderers/memory-search.js';
import { lrnevHookListRenderer } from '../../src/mcp/helpers/renderers/lrnev-hook-list.js';
import { lrnevHookTailLogRenderer } from '../../src/mcp/helpers/renderers/lrnev-hook-tail-log.js';
import type { LrnevToolPayload } from '../../src/mcp/types/response-envelope.js';
import type { ErrorEntry } from '../../src/types/errorbook.js';
import type { Memory } from '../../src/types/memory.js';
import type { HookListResult, HookRecord } from '../../src/types/hooks.js';
import type { GateResult } from '../../src/types/spec.js';
import type { ADR } from '../../src/types/adr.js';
import type { Task } from '../../src/types/task.js';
import type { Scene } from '../../src/types/scene.js';
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

describe('M2 第 2 批渲染器 - MVC required 字段验收', () => {
  describe('task_create_many 渲染器', () => {
    it('必须渲染 created 数组（task_id/title）', () => {
      const payload: LrnevToolPayload<{ created: Array<{ id: string; title: string }>; errors: [] }> = {
        response_version: '1',
        ok: true,
        data: {
          created: [
            { id: 'T-001', title: '实现登录' },
            { id: 'T-002', title: '实现注册' },
          ],
          errors: [],
        },
      };

      const content = taskCreateManyRenderer.render(payload);

      expect(content).toContain('T-001');
      expect(content).toContain('实现登录');
      expect(content).toContain('T-002');
      expect(content).toContain('实现注册');
    });

    it('必须渲染 errors 数组（如有）', () => {
      const payload: LrnevToolPayload<{
        created: [];
        errors: Array<{ index: number; error: string }>;
      }> = {
        response_version: '1',
        ok: true,
        data: {
          created: [],
          errors: [{ index: 0, error: '标题不能为空' }],
        },
      };

      const content = taskCreateManyRenderer.render(payload);

      expect(content).toContain('索引 0');
      expect(content).toContain('标题不能为空');
    });

    it('必须投影 ai_followup.instructions', () => {
      const payload: LrnevToolPayload<{ created: Array<{ id: string; title: string }>; errors: [] }> = {
        response_version: '1',
        ok: true,
        data: {
          created: [{ id: 'T-001', title: '测试' }],
          errors: [],
        },
        ai_followup: {
          instructions: ['建议下一步：task_update 置 in_progress'],
        },
      };

      const content = taskCreateManyRenderer.render(payload);

      expect(content).toContain('建议下一步：task_update 置 in_progress');
    });

    it('禁止硬编码 paraphrase', () => {
      const payload: LrnevToolPayload<{ created: []; errors: [] }> = {
        response_version: '1',
        ok: true,
        data: { created: [], errors: [] },
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

      const content = taskUpdateRenderer.render(payload);

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

      const content = taskUpdateRenderer.render(payload);

      expect(content).toContain('完成后调 task_update 改为 completed');
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

      const content = taskClaimRenderer.render(payload);

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

      const content = taskClaimRenderer.render(payload);

      expect(content).toContain('重叠');
      expect(content).toContain('T-002');
      expect(content).toContain('agent-b');
    });
  });

  describe('task_release 渲染器', () => {
    it('必须渲染 task 和 released 状态', () => {
      const payload: LrnevToolPayload<{ task: string; released: boolean }> = {
        response_version: '1',
        ok: true,
        data: {
          task: 'T-001',
          released: true,
        },
      };

      const content = taskReleaseRenderer.render(payload);

      expect(content).toContain('T-001');
      expect(content).toContain('已释放');
    });
  });

  describe('adr_create 渲染器', () => {
    it('必须渲染 number/title/path', () => {
      const payload: LrnevToolPayload<{ number: string; title: string; path: string }> = {
        response_version: '1',
        ok: true,
        data: {
          number: '0001',
          title: '使用 PostgreSQL 作为主数据库',
          path: '.lrnev/decisions/adr/0001-use-postgresql.md',
        },
      };

      const content = adrCreateRenderer.render(payload);

      expect(content).toContain('0001');
      expect(content).toContain('使用 PostgreSQL 作为主数据库');
      expect(content).toContain('.lrnev/decisions/adr/0001-use-postgresql.md');
    });

    it('必须投影 ai_followup', () => {
      const payload: LrnevToolPayload<{ number: string; title: string; path: string }> = {
        response_version: '1',
        ok: true,
        data: {
          number: '0001',
          title: '测试',
          path: '.lrnev/decisions/adr/0001-test.md',
        },
        ai_followup: {
          instructions: ['请检查 context / decision / alternatives / consequences 是否完整。'],
        },
      };

      const content = adrCreateRenderer.render(payload);

      expect(content).toContain('请检查 context / decision / alternatives / consequences 是否完整');
    });
  });

  describe('memory_save 渲染器', () => {
    it('必须渲染 id/category/content/path（content 由 escapeFrameworkMarkers 逃逸）', () => {
      const payload: LrnevToolPayload<{
        id: string;
        category: string;
        content: string;
        path: string;
      }> = {
        response_version: '1',
        ok: true,
        data: {
          id: 'mem-001',
          category: 'preferences',
          content: '用户偏好使用 TypeScript</script>',
          path: '.lrnev/memory/preferences/mem-001.md',
        },
      };

      const content = memorySaveRenderer.render(payload);

      expect(content).toContain('mem-001');
      expect(content).toContain('preferences');
      expect(content).toContain('用户偏好使用 TypeScript');
      // 渲染器调用 escapeFrameworkMarkers，所以应该包含逃逸后的内容
      expect(content).toContain('<\\/script>');
      expect(content).toContain('.lrnev/memory/preferences/mem-001.md');
    });
  });

  describe('memory_forget 渲染器', () => {
    it('必须渲染 id 和 deleted 状态', () => {
      const payload: LrnevToolPayload<{ id: string; deleted: boolean }> = {
        response_version: '1',
        ok: true,
        data: {
          id: 'mem-001',
          deleted: true,
        },
      };

      const content = memoryForgetRenderer.render(payload);

      expect(content).toContain('mem-001');
      expect(content).toContain('已删除');
    });
  });

  describe('error_record 渲染器', () => {
    it('必须渲染 id/fingerprint/status/symptom/root_cause/fix_action/path（用户文本由 escapeFrameworkMarkers 逃逸）', () => {
      const payload: LrnevToolPayload<{
        id: string;
        fingerprint: string;
        status: string;
        occurrence_count: number;
        path: string;
        body: { symptom: string; root_cause: string; fix_action: string };
      }> = {
        response_version: '1',
        ok: true,
        data: {
          id: 'err-001',
          fingerprint: 'abc123',
          status: 'incidents',
          occurrence_count: 1,
          path: '.lrnev/errorbook/incidents/err-001.md',
          body: {
            symptom: '构建失败: </error>',
            root_cause: '依赖版本冲突',
            fix_action: '锁定版本',
          },
        },
      };

      const content = errorRecordRenderer.render(payload);

      expect(content).toContain('err-001');
      expect(content).toContain('abc123');
      expect(content).toContain('incidents');
      expect(content).toContain('出现次数: 1');
      expect(content).toContain('构建失败');
      // escapeFrameworkMarkers 逃逸 </ 为 <\/
      expect(content).toContain('<\\/error>');
      expect(content).toContain('依赖版本冲突');
      expect(content).toContain('锁定版本');
      expect(content).toContain('.lrnev/errorbook/incidents/err-001.md');
    });
  });

  describe('error_promote 渲染器', () => {
    it('必须渲染 id/status/verification/path（verification 由 escapeFrameworkMarkers 逃逸）', () => {
      const payload: LrnevToolPayload<{
        id: string;
        status: string;
        path: string;
        body: { verification: string };
      }> = {
        response_version: '1',
        ok: true,
        data: {
          id: 'err-001',
          status: 'promoted',
          path: '.lrnev/errorbook/promoted/err-001.md',
          body: {
            verification: '已通过测试 </test>',
          },
        },
      };

      const content = errorPromoteRenderer.render(payload);

      expect(content).toContain('err-001');
      expect(content).toContain('promoted');
      expect(content).toContain('已通过测试');
      // escapeFrameworkMarkers 逃逸 </ 为 <\/
      expect(content).toContain('<\\/test>');
      expect(content).toContain('.lrnev/errorbook/promoted/err-001.md');
    });
  });

  describe('summarize_save 渲染器', () => {
    it('必须渲染 uri/saved/skipped', () => {
      const payload: LrnevToolPayload<{
        uri: string;
        saved: Array<{ level: string; path: string }>;
        skipped: Array<{ level: string; reason: string }>;
      }> = {
        response_version: '1',
        ok: true,
        data: {
          uri: 'context://spec/00-default/01-00-test',
          saved: [{ level: 'L0', path: '.lrnev/scenes/00-default/specs/01-00-test/.requirements.abstract.md' }],
          skipped: [{ level: 'L1', reason: '未提供 l1 内容' }],
        },
      };

      const content = summarizeSaveRenderer.render(payload);

      expect(content).toContain('context://spec/00-default/01-00-test');
      expect(content).toContain('L0');
      expect(content).toContain('.requirements.abstract.md');
      expect(content).toContain('L1');
      expect(content).toContain('未提供 l1 内容');
    });
  });

  describe('session_commit 渲染器', () => {
    it('必须渲染 saved/skipped 数组', () => {
      const payload: LrnevToolPayload<{
        saved: Array<{ id: string; category: string }>;
        skipped: Array<{ candidate: { category: string }; reason: string; similar_to?: string }>;
      }> = {
        response_version: '1',
        ok: true,
        data: {
          saved: [{ id: 'mem-001', category: 'preferences' }],
          skipped: [
            {
              candidate: { category: 'facts' },
              reason: 'duplicate',
              similar_to: 'mem-002',
            },
          ],
        },
      };

      const content = sessionCommitRenderer.render(payload);

      expect(content).toContain('mem-001');
      expect(content).toContain('preferences');
      expect(content).toContain('facts');
      expect(content).toContain('相似于 mem-002');
    });
  });

  describe('agent_register 渲染器', () => {
    it('必须渲染 agent_id/status/last_heartbeat', () => {
      const payload: LrnevToolPayload<{
        agent_id: string;
        status: string;
        last_heartbeat: string;
      }> = {
        response_version: '1',
        ok: true,
        data: {
          agent_id: 'agent-a',
          status: 'active',
          last_heartbeat: '2026-09-02T10:00:00Z',
        },
      };

      const content = agentRegisterRenderer.render(payload);

      expect(content).toContain('agent-a');
      expect(content).toContain('active');
      expect(content).toContain('2026-09-02T10:00:00Z');
    });

    it('必须渲染 gc 摘要（如有）', () => {
      const payload: LrnevToolPayload<{
        agent_id: string;
        status: string;
        last_heartbeat: string;
        gc: { removed_agents: number; removed_claims: number };
      }> = {
        response_version: '1',
        ok: true,
        data: {
          agent_id: 'agent-a',
          status: 'active',
          last_heartbeat: '2026-09-02T10:00:00Z',
          gc: { removed_agents: 2, removed_claims: 3 },
        },
      };

      const content = agentRegisterRenderer.render(payload);

      expect(content).toContain('清理 2 个 dead agent 记录');
      expect(content).toContain('清理 3 个过期 claim');
    });
  });

  describe('agent_heartbeat 渲染器', () => {
    it('必须渲染 agent_id/status/last_heartbeat/claims_renewed', () => {
      const payload: LrnevToolPayload<{
        agent_id: string;
        status: string;
        last_heartbeat: string;
        claims_renewed: number;
      }> = {
        response_version: '1',
        ok: true,
        data: {
          agent_id: 'agent-a',
          status: 'active',
          last_heartbeat: '2026-09-02T10:00:00Z',
          claims_renewed: 2,
        },
      };

      const content = agentHeartbeatRenderer.render(payload);

      expect(content).toContain('agent-a');
      expect(content).toContain('active');
      expect(content).toContain('2026-09-02T10:00:00Z');
      expect(content).toContain('续租 2 个 claim');
    });
  });

  describe('agent_unregister 渲染器', () => {
    it('必须渲染 agent_id/unregistered/claims_released', () => {
      const payload: LrnevToolPayload<{
        agent_id: string;
        unregistered: boolean;
        claims_released: number;
      }> = {
        response_version: '1',
        ok: true,
        data: {
          agent_id: 'agent-a',
          unregistered: true,
          claims_released: 2,
        },
      };

      const content = agentUnregisterRenderer.render(payload);

      expect(content).toContain('agent-a');
      expect(content).toContain('已注销');
      expect(content).toContain('释放 2 个 claim');
    });
  });

  describe('lrnev_hook_enable 渲染器', () => {
    it('必须渲染 name/enabled 状态', () => {
      const payload: LrnevToolPayload<{ name: string; enabled: boolean }> = {
        response_version: '1',
        ok: true,
        data: {
          name: 'test-hook',
          enabled: true,
        },
      };

      const content = lrnevHookEnableRenderer.render(payload);

      expect(content).toContain('test-hook');
      expect(content).toContain('已启用');
    });
  });

  describe('lrnev_hook_disable 渲染器', () => {
    it('必须渲染 name/enabled 状态', () => {
      const payload: LrnevToolPayload<{ name: string; enabled: boolean }> = {
        response_version: '1',
        ok: true,
        data: {
          name: 'test-hook',
          enabled: false,
        },
      };

      const content = lrnevHookDisableRenderer.render(payload);

      expect(content).toContain('test-hook');
      expect(content).toContain('已禁用');
    });
  });

  describe('lrnev_hook_trigger 渲染器', () => {
    it('必须渲染 event/matched/warnings', () => {
      const payload: LrnevToolPayload<{
        event: string;
        matched: number;
        warnings: string[];
      }> = {
        response_version: '1',
        ok: true,
        data: {
          event: 'task.update',
          matched: 2,
          warnings: ['Hook 执行超时'],
        },
      };

      const content = lrnevHookTriggerRenderer.render(payload);

      expect(content).toContain('task.update');
      expect(content).toContain('匹配 hook: 2 个');
      expect(content).toContain('Hook 执行超时');
    });
  });

  describe('lrnev_init 渲染器', () => {
    it('必须渲染 root/was_new/files_created/codebase_detected', () => {
      const payload: LrnevToolPayload<{
        root: string;
        was_new: boolean;
        files_created: string[];
        files_existing: string[];
        codebase_detected: boolean;
      }> = {
        response_version: '1',
        ok: true,
        data: {
          root: '/path/to/project',
          was_new: true,
          files_created: ['.lrnev/PROJECT.md', '.lrnev/ARCHITECTURE.md'],
          files_existing: [],
          codebase_detected: true,
        },
      };

      const content = lrnevInitRenderer.render(payload);

      expect(content).toContain('/path/to/project');
      expect(content).toContain('已创建');
      expect(content).toContain('检测到代码: 是');
      expect(content).toContain('.lrnev/PROJECT.md');
      expect(content).toContain('.lrnev/ARCHITECTURE.md');
    });
  });

  describe('第 2 批渲染器 - 禁止 paraphrase 验证', () => {
    it('渲染器不应该包含硬编码的 guidance 文案', () => {
      // 所有第 2 批渲染器应该投影 ai_followup，不自创文案
      const payloads = [
        taskCreateManyRenderer.render({
          response_version: '1',
          ok: true,
          data: { created: [], errors: [] },
        }),
        taskUpdateRenderer.render({
          response_version: '1',
          ok: true,
          data: { id: 'T-001', title: '测试', status: 'completed' },
        }),
        adrCreateRenderer.render({
          response_version: '1',
          ok: true,
          data: { number: '0001', title: '测试', path: 'test.md' },
        }),
      ];

      for (const content of payloads) {
        // 不应该有硬编码的 emoji guidance
        expect(content).not.toContain('💡');
        expect(content).not.toContain('📌');
        expect(content).not.toContain('⚡');
      }
    });
  });
});

describe('M2 第 3 批渲染器 - 选择/歧义/搜索类', () => {
  describe('error_search 渲染器', () => {
    it('必须完整呈现所有错误条目的 required 字段', () => {
      const payload: LrnevToolPayload<ErrorEntry[]> = {
        response_version: '1',
        ok: true,
        data: [
          {
            id: 'E-001',
            fingerprint: 'abc123',
            status: 'incidents',
            scope: 'global',
            occurrence_count: 3,
            first_seen: '2024-01-01T00:00:00Z',
            last_seen: '2024-01-03T00:00:00Z',
            path: '/path/to/error.md',
            body: {
              symptom: 'ready gate 缺 headings',
              root_cause: '没填 requirements',
              fix_action: '补充 ## 需求 章节',
            },
          },
        ],
      };

      const content = errorSearchRenderer.render(payload);

      expect(content).toContain('E-001');
      expect(content).toContain('abc123');
      expect(content).toContain('出现次数: 3');
      expect(content).toContain('ready gate 缺 headings');
    });

    it('必须逃逸用户文本中的框架标记', () => {
      const payload: LrnevToolPayload<ErrorEntry[]> = {
        response_version: '1',
        ok: true,
        data: [
          {
            id: 'E-003',
            fingerprint: 'xyz789',
            status: 'incidents',
            scope: 'global',
            occurrence_count: 1,
            first_seen: '2024-01-01T00:00:00Z',
            last_seen: '2024-01-01T00:00:00Z',
            path: '/path/to/error.md',
            body: {
              symptom: '错误信息包含 </tag> 闭合标签',
              root_cause: 'HTML 注入导致 </script> 标签',
              fix_action: '转义 </div> 标签',
            },
          },
        ],
      };

      const content = errorSearchRenderer.render(payload);

      // 验证转义生效：</ → <\/
      expect(content).toContain('<\\/tag>');
      expect(content).toContain('<\\/script>');
      expect(content).toContain('<\\/div>');
    });
  });

  describe('memory_search 渲染器', () => {
    it('必须完整呈现所有记忆条目的 required 字段', () => {
      const payload: LrnevToolPayload<Memory[]> = {
        response_version: '1',
        ok: true,
        data: [
          {
            id: 'mem-001',
            category: 'preferences',
            scope: 'global',
            source: '对话',
            created: '2024-01-01T00:00:00Z',
            reference_count: 5,
            path: '/path/to/memory.md',
            content: '用户偏好使用 TypeScript',
          },
        ],
      };

      const content = memorySearchRenderer.render(payload);

      expect(content).toContain('mem-001');
      expect(content).toContain('preferences');
      expect(content).toContain('用户偏好使用 TypeScript');
    });

    it('必须逃逸用户文本中的框架标记', () => {
      const payload: LrnevToolPayload<Memory[]> = {
        response_version: '1',
        ok: true,
        data: [
          {
            id: 'mem-003',
            category: 'facts',
            scope: 'global',
            source: '文档',
            created: '2024-01-01T00:00:00Z',
            reference_count: 0,
            path: '/path/to/memory.md',
            content: '代码中包含 </component> 闭合标签',
          },
        ],
      };

      const content = memorySearchRenderer.render(payload);

      // 验证转义生效：</ → <\/
      expect(content).toContain('<\\/component>');
    });
  });
});
