/**
 * 05-00-lrnev-guidance-profile T-004 集成测试 —— Profile 挂载（真实 MCP server）
 *
 * Spec: 05-00-lrnev-guidance-profile（F-03/F-06/F-07、D-04/D-05/D-06）
 * Task: T-004（裁决 Q1~Q6）
 *
 * 覆盖（对真实 MCP server + 临时工作区）：
 * - allowlist 四工具（assess_goal/scene_create/spec_create/task_create）在文本通道
 *   存在五角色前缀行时，structuredContent.guidance 被挂载；spec_update/spec_get 等
 *   非 role 工具即使有 ai_followup 也不含 guidance；
 * - guidance 与 content 文本同源一致：每条 guidance 的 ROLE_PREFIX[role]+text 与
 *   ai_followup.instructions 中的行逐字相同，且 content 投影了该行（文本通道保留）；
 * - assess_goal content 现在包含 ai_followup.instructions 文本（裁决 Q2）；
 * - guidance 派生失败/冲突不影响 data/content/ok（注入场景）；
 * - 服务端不输出 USER_DECISION；guidance/decision_context 不持久化（.lrnev 哨兵）；
 * - response_version 恒为 '1'（不 bump，裁决 Q6）；guidance 项形状与
 *   LrnevGuidanceItemSchema zod 一致。
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { dir as tmpDir, type DirectoryResult } from 'tmp-promise';

import { createMcpServer } from '../../src/mcp/server.js';
import { ROLE_PREFIX, GUIDANCE_ROLES } from '../../src/core/guidance-semantics.js';
import { LrnevGuidanceItemSchema } from '../../src/mcp/types/guidance-profile.js';
import { toMcpToolResult } from '../../src/mcp/helpers/tool-result-adapter.js';
import { renderModelVisibleContent } from '../../src/mcp/helpers/model-visible-contract.js';
import type { AiFollowupResponse } from '../../src/types/response.js';

/** 调用工具并返回原始结果（含 structuredContent / content / isError）。 */
async function callTool(client: Client, name: string, args: Record<string, unknown>): Promise<any> {
  return client.callTool({ name, arguments: args });
}

/** 取 canonical payload。 */
function payloadOf(result: any): any {
  return result?.structuredContent;
}

/** 扫描 .lrnev 下所有文件内容，返回包含 marker 的文件相对路径（证明未持久化）。 */
async function scanLrnevForMarker(root: string, marker: string): Promise<string[]> {
  const lrnevDir = path.join(root, '.lrnev');
  const hits: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    let children: string[] = [];
    try {
      children = await fs.readdir(dir);
    } catch {
      return;
    }
    for (const child of children) {
      const full = path.join(dir, child);
      const stat = await fs.stat(full);
      if (stat.isDirectory()) {
        await walk(full);
      } else if (stat.size < 2_000_000) {
        try {
          const text = await fs.readFile(full, 'utf8');
          if (text.includes(marker)) {
            hits.push(path.relative(lrnevDir, full).replace(/\\/g, '/'));
          }
        } catch {
          // 不可读文件跳过
        }
      }
    }
  };
  await walk(lrnevDir);
  return hits;
}

const MARKER = 'PERSIST_SENTINEL_T004_7C1';

describe('T-004: Guidance Profile 挂载与文本一致性（MCP server 协议级）', () => {
  let workspace: DirectoryResult;
  let originalEnv: string | undefined;
  let client: Client;
  let server: ReturnType<typeof createMcpServer>;
  let sceneId: string;
  let specId: string;
  const payloads: any[] = [];

  beforeAll(async () => {
    workspace = await tmpDir({ unsafeCleanup: true });
    originalEnv = process.env.LRNEV_WORKSPACE;
    process.env.LRNEV_WORKSPACE = workspace.path;

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    server = createMcpServer();
    client = new Client({ name: 'test-client', version: '1.0.0' }, { capabilities: {} });
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    await client.callTool({ name: 'lrnev_init', arguments: { project_name: 'test' } });
    const sceneResult = await callTool(client, 'scene_create', { name: 'user-management', number: 5 });
    sceneId = payloadOf(sceneResult).data.id as string;
    const specResult = await callTool(client, 'spec_create', { scene: sceneId, name: 'user-login' });
    specId = payloadOf(specResult).data.spec as string;
    expect(sceneId).toMatch(/^\d\d-.*/);
    expect(specId).toMatch(/^\d\d-\d\d-.*/);
  });

  afterAll(async () => {
    await client.close();
    await server.close();
    if (originalEnv === undefined) delete process.env.LRNEV_WORKSPACE;
    else process.env.LRNEV_WORKSPACE = originalEnv;
    await workspace.cleanup();
  });

  /** 断言 payload.guidance 每条与文本同源：ROLE_PREFIX[role]+text 命中 instructions 某行。 */
  function expectGuidanceSameSource(payload: any): void {
    const instructions: string[] = payload.ai_followup?.instructions ?? [];
    expect(Array.isArray(payload.guidance)).toBe(true);
    for (const item of payload.guidance) {
      // 形状：与 LrnevGuidanceItemSchema zod 一致
      expect(LrnevGuidanceItemSchema.safeParse(item).success).toBe(true);
      expect(GUIDANCE_ROLES).toContain(item.role);
      expect(item.profile_version).toBe('v1');
      expect(item).not.toHaveProperty('priority');
      const role = item.role as (typeof GUIDANCE_ROLES)[number];
      const fullLine = `${ROLE_PREFIX[role]}${item.text}`;
      // 同源：该行必须存在于文本通道
      expect(instructions).toContain(fullLine);
    }
    payloads.push(payload);
  }

  describe('allowlist 四工具：role 化行存在 → guidance 挂载且与文本同源', () => {
    it('spec_create（恒有【事实】/【建议】行，无 decision_context）→ guidance=[FACT, RECOMMENDATION]', async () => {
      const result = await callTool(client, 'spec_create', {
        scene: sceneId,
        name: 'guidance-mount-a',
      });
      const payload = payloadOf(result);
      expect(payload.ok).toBe(true);
      expect(result.isError).toBeFalsy();
      expect(payload.response_version).toBe('1');

      const roles = payload.guidance.map((g: any) => g.role);
      expect(roles).toEqual(['FACT', 'RECOMMENDATION']);

      // 文本同源：FACT/RECOMMENDATION 的 text 去掉前缀后与结构化 text 相同
      const instructions: string[] = payload.ai_followup.instructions;
      expect(instructions[0]!.startsWith('【事实】')).toBe(true);
      expect(instructions[1]!.startsWith('【建议】')).toBe(true);
      expect(payload.guidance[0].text).toBe(instructions[0]!.slice('【事实】'.length));
      expect(payload.guidance[1].text).toBe(instructions[1]!.slice('【建议】'.length));

      // content 文本通道保留了同一条 role 行（text 降级不丢失，F-07）
      const contentText = result.content[0]?.text ?? '';
      expect(contentText).toContain(instructions[0]);
      expect(contentText).toContain(instructions[1]);
      // content 是投影文本，不含结构化 guidance 字段
      expect(contentText).not.toContain('profile_version');

      // response_version 不 bump
      expect(payload.response_version).toBe('1');
      payloads.push(payload);
    });

    it('spec_create + decision_context（reuse_spec 误调 spec_create）→ guidance 追加 DECISION_BOUNDARY', async () => {
      const result = await callTool(client, 'spec_create', {
        scene: sceneId,
        name: 'guidance-mount-b',
        decision_context: {
          source: 'client_asserted',
          strength: 'explicit',
          summary: MARKER,
          direction: 'reuse_spec',
          target_ref: `scene=${sceneId}`,
        },
      });
      const payload = payloadOf(result);
      expect(payload.ok).toBe(true);
      const roles = payload.guidance.map((g: any) => g.role);
      expect(roles).toEqual(['FACT', 'RECOMMENDATION', 'DECISION_BOUNDARY']);
      // 同源一致性（含【决策边界】行在 content 中的投影）
      expectGuidanceSameSource(payload);
      const contentText = result.content[0]?.text ?? '';
      expect(contentText).toContain('【决策边界】');
      expect(contentText).toContain('reuse_spec');
      expect(contentText).not.toContain(MARKER);
    });

    it('scene_create + decision_context（new_scene 对齐但 target_ref 不一致）→ guidance=[DECISION_BOUNDARY]', async () => {
      const result = await callTool(client, 'scene_create', {
        name: 'guidance-billing',
        number: 6,
        decision_context: {
          source: 'client_asserted',
          strength: 'explicit',
          summary: MARKER,
          direction: 'new_scene',
          target_ref: 'scene=07-payroll',
        },
      });
      const payload = payloadOf(result);
      expect(payload.ok).toBe(true);
      expect(payload.data.id).toContain('guidance-billing');
      const roles = payload.guidance.map((g: any) => g.role);
      expect(roles).toEqual(['DECISION_BOUNDARY']);
      expectGuidanceSameSource(payload);
      expect(result.content[0]?.text).toContain('【决策边界】');
    });

    it('task_create + decision_context（reuse_spec 对齐但 target_ref.spec 不一致）→ guidance=[DECISION_BOUNDARY]', async () => {
      const result = await callTool(client, 'task_create', {
        scene: sceneId,
        spec: specId,
        title: '实现登录-挂载验证',
        decision_context: {
          source: 'client_asserted',
          strength: 'explicit',
          summary: MARKER,
          direction: 'reuse_spec',
          target_ref: `scene=${sceneId}, spec=99-00-other-spec`,
        },
      });
      const payload = payloadOf(result);
      expect(payload.ok).toBe(true);
      expect(payload.data.id).toMatch(/^T-\d+/);
      const roles = payload.guidance.map((g: any) => g.role);
      expect(roles).toEqual(['DECISION_BOUNDARY']);
      expectGuidanceSameSource(payload);
      expect(result.content[0]?.text).toContain('【决策边界】');
    });

    it('assess_goal + decision_context（explicit new_spec）→ guidance=[FACT, RECOMMENDATION] 且 content 投影全部 instructions（Q2）', async () => {
      const result = await callTool(client, 'assess_goal', {
        goal: '新增登录功能',
        decision_context: {
          source: 'client_asserted',
          strength: 'explicit',
          summary: MARKER,
          direction: 'new_spec',
        },
      });
      const payload = payloadOf(result);
      expect(payload.ok).toBe(true);
      const roles = payload.guidance.map((g: any) => g.role);
      expect(roles).toEqual(['FACT', 'RECOMMENDATION']);
      expectGuidanceSameSource(payload);

      // Q2：assess_goal content 现在包含 ai_followup.instructions 文本
      const instructions: string[] = payload.ai_followup.instructions;
      expect(instructions.length).toBeGreaterThan(0);
      const contentText = result.content[0]?.text ?? '';
      for (const instruction of instructions) {
        expect(contentText).toContain(instruction);
      }
      // GOAL_ASSESSOR_OVERRIDE_CLAUSE 常量仍保留
      expect(contentText).toContain('suggested_next_step 是基于启发式的建议');
      expect(contentText).toContain('【事实】');
      expect(contentText).toContain('【建议】');
    });
  });

  describe('无 role 化行 → 无 guidance（文本通道照常，客户端可仅靠文本）', () => {
    it('scene_create（无 decision_context）→ 无 guidance 属性，响应正常', async () => {
      const result = await callTool(client, 'scene_create', { name: 'plain-scene', number: 7 });
      const payload = payloadOf(result);
      expect(payload.ok).toBe(true);
      expect(result.isError).toBeFalsy();
      expect(payload).not.toHaveProperty('guidance');
      expect(payload.response_version).toBe('1');
      expect(result.content[0]?.text.length).toBeGreaterThan(0);
      payloads.push(payload);
    });

    it('task_create（无 decision_context）→ 无 guidance 属性', async () => {
      const result = await callTool(client, 'task_create', {
        scene: sceneId,
        spec: specId,
        title: '普通任务-无挂载',
      });
      const payload = payloadOf(result);
      expect(payload.ok).toBe(true);
      expect(payload).not.toHaveProperty('guidance');
      payloads.push(payload);
    });

    it('assess_goal（无 decision_context）→ 无 guidance；但 content 现在包含 instructions 文本（Q2 验证）', async () => {
      const result = await callTool(client, 'assess_goal', { goal: '新增登录功能' });
      const payload = payloadOf(result);
      expect(payload.ok).toBe(true);
      expect(payload).not.toHaveProperty('guidance');
      const instructions: string[] = payload.ai_followup.instructions;
      expect(instructions.length).toBeGreaterThan(0);
      const contentText = result.content[0]?.text ?? '';
      expect(contentText).toContain('评估结果是 ');
      expect(contentText).toContain('三档分流指引');
      payloads.push(payload);
    });
  });

  describe('非 role 工具（spec_update / spec_get 等）：schema 与运行时都不含 guidance', () => {
    it('tools/list：四工具 outputSchema 声明可选 guidance；spec_update/spec_get 不声明', async () => {
      const tools = await client.listTools();
      const schemaText = (name: string): string => {
        const tool = tools.tools.find((t) => t.name === name);
        expect(tool, `缺少工具 ${name}`).toBeDefined();
        return JSON.stringify(tool!.outputSchema);
      };
      for (const toolName of ['assess_goal', 'scene_create', 'spec_create', 'task_create']) {
        expect(schemaText(toolName)).toContain('guidance');
      }
      for (const toolName of ['spec_update', 'spec_get', 'scene_get', 'task_list']) {
        expect(schemaText(toolName)).not.toContain('guidance');
      }
    });

    it('spec_update（业务成功，含 ai_followup）→ structuredContent 无 guidance 字段', async () => {
      const result = await callTool(client, 'spec_update', {
        scene: sceneId,
        spec: specId,
        status: 'ready',
        reason: 'T-004 协议测试',
      });
      const payload = payloadOf(result);
      expect(payload.ok).toBe(true);
      expect(payload.ai_followup?.instructions).toBeDefined();
      expect(payload).not.toHaveProperty('guidance');
      payloads.push(payload);
    });

    it('spec_get（含 SpecGuidance ai_followup，若触发）→ structuredContent 无 guidance 字段', async () => {
      const result = await callTool(client, 'spec_get', { scene: sceneId, spec: specId });
      const payload = payloadOf(result);
      expect(payload.ok).toBe(true);
      expect(payload).not.toHaveProperty('guidance');
      payloads.push(payload);
    });
  });

  describe('降级注入：guidance 派生冲突不影响 data/content/ok（裁决 Q3/D-06）', () => {
    it('【执行约束】行缺 source_ref → 冲突省略 guidance；ok/data/content 不变（直接驱动 adapter 注入）', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const data = { spec: '01-00-injected', scene: '00-default', path: '.lrnev/scenes/00-default/specs/01-00-injected' };
      const instructions = [
        '【事实】Spec "01-00-injected" 已创建。',
        '【执行约束】状态机拒绝该迁移。', // EXECUTION_CONSTRAINT 无 source_ref
        '普通待办文本。',
      ];
      const response: AiFollowupResponse<typeof data> = { ok: true, data, ai_followup: { instructions } };

      const result = await toMcpToolResult(Promise.resolve(response), 'spec_create');
      const payload = result.structuredContent!;
      expect(payload.ok).toBe(true); // 绝不翻 ok
      expect(payload).not.toHaveProperty('guidance');
      expect(payload.data).toEqual(data);
      expect(payload.ai_followup!.instructions).toEqual(instructions);
      expect(result.isError).toBeFalsy();
      // content 与无 guidance 的同一 payload 渲染结果字节一致
      expect(result.content[0]!.text).toBe(
        renderModelVisibleContent('spec_create', {
          response_version: '1',
          ok: true,
          data,
          ai_followup: { instructions },
        }),
      );
      const logText = errorSpy.mock.calls.map((c) => String(c[0])).join(' ');
      expect(logText).toContain('[guidance-profile]');
      expect(logText).toContain('constraint_missing_source_ref');
      vi.restoreAllMocks();
    });
  });

  describe('哨兵：guidance / decision_context 不持久化 + 无 USER_DECISION + response_version 恒定', () => {
    it('.lrnev 全部文件不含 guidance 结构化哨兵 / decision_context / client_asserted / 声明标记', async () => {
      expect(await scanLrnevForMarker(workspace.path, 'profile_version')).toEqual([]);
      expect(await scanLrnevForMarker(workspace.path, MARKER)).toEqual([]);
      expect(await scanLrnevForMarker(workspace.path, 'decision_context')).toEqual([]);
      expect(await scanLrnevForMarker(workspace.path, 'client_asserted')).toEqual([]);
    });

    it('所有带 guidance 的响应不含 USER_DECISION；response_version 恒为 \'1\'', () => {
      expect(payloads.length).toBeGreaterThan(0);
      for (const payload of payloads) {
        expect(JSON.stringify(payload)).not.toContain('USER_DECISION');
        expect(payload.response_version).toBe('1');
      }
    });
  });
});
