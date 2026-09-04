/**
 * M2 渲染器单元测试 - Batch 2
 *
 * 第 2 批验收标准（7 点）：
 * 1. 投影 canonical payload，不创作 guidance 文本
 * 2. 禁止硬编码 paraphrase
 * 3. MVC required 字段完整呈现（D-04 分类）
 * 4. 用户文本由 MVC 统一转义口（renderModelVisibleContent）转义
 * 5. 注册到 initializeRenderers
 * 6. 单元测试（required 字段 + 无 paraphrase + ai_followup 投影）
 * 7. legacyRawFormat 已弃用
 */

import { describe, it, expect } from 'vitest';
import { taskReleaseRenderer } from '../../../src/mcp/helpers/renderers/task-release.js';
import { adrCreateRenderer } from '../../../src/mcp/helpers/renderers/adr-create.js';
import { memorySaveRenderer } from '../../../src/mcp/helpers/renderers/memory-save.js';
import { memoryForgetRenderer } from '../../../src/mcp/helpers/renderers/memory-forget.js';
import { errorRecordRenderer } from '../../../src/mcp/helpers/renderers/error-record.js';
import { errorPromoteRenderer } from '../../../src/mcp/helpers/renderers/error-promote.js';
import { summarizeSaveRenderer } from '../../../src/mcp/helpers/renderers/summarize-save.js';
import { sessionCommitRenderer } from '../../../src/mcp/helpers/renderers/session-commit.js';
import { agentRegisterRenderer } from '../../../src/mcp/helpers/renderers/agent-register.js';
import { agentHeartbeatRenderer } from '../../../src/mcp/helpers/renderers/agent-heartbeat.js';
import { agentUnregisterRenderer } from '../../../src/mcp/helpers/renderers/agent-unregister.js';
import { lrnevHookEnableRenderer } from '../../../src/mcp/helpers/renderers/lrnev-hook-enable.js';
import { lrnevHookDisableRenderer } from '../../../src/mcp/helpers/renderers/lrnev-hook-disable.js';
import { lrnevHookTriggerRenderer } from '../../../src/mcp/helpers/renderers/lrnev-hook-trigger.js';
import { lrnevInitRenderer } from '../../../src/mcp/helpers/renderers/lrnev-init.js';
import { taskCreateManyRenderer } from '../../../src/mcp/helpers/renderers/task-create-many.js';
import { taskUpdateRenderer } from '../../../src/mcp/helpers/renderers/task-update.js';
import type { LrnevToolPayload } from '../../../src/mcp/types/response-envelope.js';
import { renderModelVisibleContent } from '../../../src/mcp/helpers/model-visible-contract.js';

describe('M2 第 2 批渲染器 - MVC required 字段验收', () => {
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

      const content = taskReleaseRenderer.render(payload as Parameters<typeof taskReleaseRenderer.render>[0]);

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

      const content = adrCreateRenderer.render(payload as Parameters<typeof adrCreateRenderer.render>[0]);

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

      const content = adrCreateRenderer.render(payload as Parameters<typeof adrCreateRenderer.render>[0]);

      expect(content).toContain('请检查 context / decision / alternatives / consequences 是否完整');
    });
  });

  describe('memory_save 渲染器', () => {
    it('必须渲染 id/category/content/path（content 为用户文本：渲染器返回未逃逸，由 MVC 统一转义口转义）', () => {
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

      const content = memorySaveRenderer.render(payload as Parameters<typeof memorySaveRenderer.render>[0]);

      expect(content).toContain('mem-001');
      expect(content).toContain('preferences');
      expect(content).toContain('用户偏好使用 TypeScript');
      // 新契约：渲染器返回未逃逸文本，用户文本中的 </script> 原样保留
      expect(content).toContain('</script>');
      expect(content).toContain('.lrnev/memory/preferences/mem-001.md');

      // 最终转义由 MVC 统一转义口（renderModelVisibleContent）保证：</ → <\/
      const mvcContent = renderModelVisibleContent('memory_save', payload);
      expect(mvcContent).toContain('<\\/script>');
      expect(mvcContent).not.toContain('</script>');
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
    it('必须渲染 id/fingerprint/status/symptom/root_cause/fix_action/path（用户文本：渲染器返回未逃逸，由 MVC 统一转义口转义）', () => {
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

      const content = errorRecordRenderer.render(payload as Parameters<typeof errorRecordRenderer.render>[0]);

      expect(content).toContain('err-001');
      expect(content).toContain('abc123');
      expect(content).toContain('incidents');
      expect(content).toContain('出现次数: 1');
      expect(content).toContain('构建失败');
      // 新契约：渲染器返回未逃逸文本，用户文本中的 </error> 原样保留
      expect(content).toContain('</error>');
      expect(content).toContain('依赖版本冲突');
      expect(content).toContain('锁定版本');
      expect(content).toContain('.lrnev/errorbook/incidents/err-001.md');

      // 最终转义由 MVC 统一转义口（renderModelVisibleContent）保证：</ → <\/
      const mvcContent = renderModelVisibleContent('error_record', payload);
      expect(mvcContent).toContain('<\\/error>');
      expect(mvcContent).not.toContain('</error>');
    });
  });

  describe('error_promote 渲染器', () => {
    it('必须渲染 id/status/verification/path（verification 为用户文本：渲染器返回未逃逸，由 MVC 统一转义口转义）', () => {
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

      const content = errorPromoteRenderer.render(payload as Parameters<typeof errorPromoteRenderer.render>[0]);

      expect(content).toContain('err-001');
      expect(content).toContain('promoted');
      expect(content).toContain('已通过测试');
      // 新契约：渲染器返回未逃逸文本，用户文本中的 </test> 原样保留
      expect(content).toContain('</test>');
      expect(content).toContain('.lrnev/errorbook/promoted/err-001.md');

      // 最终转义由 MVC 统一转义口（renderModelVisibleContent）保证：</ → <\/
      const mvcContent = renderModelVisibleContent('error_promote', payload);
      expect(mvcContent).toContain('<\\/test>');
      expect(mvcContent).not.toContain('</test>');
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

      const content = summarizeSaveRenderer.render(payload as Parameters<typeof summarizeSaveRenderer.render>[0]);

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

      const content = sessionCommitRenderer.render(payload as Parameters<typeof sessionCommitRenderer.render>[0]);

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

      const content = agentRegisterRenderer.render(payload as Parameters<typeof agentRegisterRenderer.render>[0]);

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

      const content = agentRegisterRenderer.render(payload as Parameters<typeof agentRegisterRenderer.render>[0]);

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

      const content = agentHeartbeatRenderer.render(payload as Parameters<typeof agentHeartbeatRenderer.render>[0]);

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

      const content = lrnevHookEnableRenderer.render(payload as Parameters<typeof lrnevHookEnableRenderer.render>[0]);

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

      const content = lrnevHookDisableRenderer.render(payload as Parameters<typeof lrnevHookDisableRenderer.render>[0]);

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

      const content = lrnevInitRenderer.render(payload as Parameters<typeof lrnevInitRenderer.render>[0]);

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
          data: { created: [], count: 0 },
        }),
        taskUpdateRenderer.render({
          response_version: '1',
          ok: true,
          data: { id: 'T-001', title: '测试', status: 'completed' },
        } as Parameters<typeof taskUpdateRenderer.render>[0]),
        adrCreateRenderer.render({
          response_version: '1',
          ok: true,
          data: { number: '0001', title: '测试', path: 'test.md' },
        } as Parameters<typeof adrCreateRenderer.render>[0]),
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
