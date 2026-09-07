/**
 * 05-00-lrnev-guidance-profile T-004/T-006 集成测试 —— Profile 文本通道语义 + 挂载回退（真实 MCP server）
 *
 * Spec: 05-00-lrnev-guidance-profile（F-03/F-06/F-07、D-04/D-05/D-06）
 * Task: T-004（裁决 Q1~Q6）+ T-006（O6 2026-09-07 运行时挂载回退）
 *
 * T-006 裁决语义（见 dev-docs/decisions/2026-09-07-T006字段裁决.md）：
 * - role 化文本行（ROLE_PREFIX 五角色行）保留在 ai_followup.instructions / content——
 *   唯一被实测消费的通道（G1 送达实证、G5 归档边界效果走文本，B4 V2 4/5→0/5 不依赖数组）；
 * - payload.guidance **不再挂载**：任何工具响应（含 allowlist 四工具）structuredContent
 *   均无 guidance 字段；outputSchema 也不声明 guidance（避免空字段误导与 24.2%/响应重复税）；
 * - 结构化面回退为纯函数库 + 契约类型（classifyInstructions → buildGuidanceView →
 *   diagnoseGuidance / assertGuidancePublishable + LrnevGuidanceItemSchema），本文件对
 *   响应文本行做同源复核（文本行的 role 集合 = 纯函数链产出的结构化视图）；
 * - decision_context 场景边界走文本通道（DECISION_BOUNDARY 行追加进 instructions）、
 *   不持久化、不输出 USER_DECISION、response_version 恒 '1'。
 *
 * 覆盖（对真实 MCP server + 临时工作区）：
 * - allowlist 四工具（assess_goal/scene_create/spec_create/task_create）role 化行在
 *   instructions/content 中完整保留（文本降级可用），payload 无 guidance 字段；
 * - spec_update/spec_get 等非 role 工具不携带 guidance（schema 与运行时一致）；
 * - 纯函数链同源复核：文本行 role 集合与期望 Profile 语义一致、项过 LrnevGuidanceItemSchema；
 * - tools/list：任何工具（含原 role 化四工具）outputSchema 均不含 guidance；
 * - assess_goal content 包含 ai_followup.instructions 文本（裁决 Q2）；
 * - 冲突/异常注入（【执行约束】行缺 source_ref）：diagnoseGuidance 纯函数仍显式诊断
 *   （发布守卫契约面），运行时零诊断日志、业务结果不受影响；
 * - 服务端不输出 USER_DECISION；guidance/decision_context 不持久化（.lrnev 哨兵）；
 * - response_version 恒为 '1'（不 bump，裁决 Q6）。
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { dir as tmpDir, type DirectoryResult } from 'tmp-promise';

import { createMcpServer } from '../../src/mcp/server.js';
import { GUIDANCE_ROLES } from '../../src/core/guidance-semantics.js';
import { LrnevGuidanceItemSchema } from '../../src/mcp/types/guidance-profile.js';
import {
  buildGuidanceView,
  classifyInstructions,
  diagnoseGuidance,
} from '../../src/mcp/helpers/guidance-profile.js';
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

/** 取 ai_followup.instructions（不存在返回 []）。 */
function instructionsOf(payload: any): string[] {
  return payload?.ai_followup?.instructions ?? [];
}

/** 文本通道 role 集合：role 化行经纯函数分类后的 role 顺序（挂载回退后结构化面的同源复核口径）。 */
function textRoles(payload: any): string[] {
  return classifyInstructions(instructionsOf(payload)).map((i) => String(i.role));
}

/** 由文本行派生 Profile 视图（同源复核：结构化项与文本行一一对应）。 */
function profileViewOf(payload: any) {
  return buildGuidanceView(classifyInstructions(instructionsOf(payload)));
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

describe('T-004/T-006: Profile 文本通道语义与挂载回退（MCP server 协议级）', () => {
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

  /** 复核同源（T-006 口径）：payload 无 guidance 字段；派生 Profile 视图与期望 role 集合一致且项形状合法。 */
  function expectProfileSemantics(payload: any, expectedRoles: string[]): void {
    expect(payload).not.toHaveProperty('guidance'); // O6：结构化挂载已回退
    expect(textRoles(payload)).toEqual(expectedRoles); // 文本行 role 集合 = 结构化视图的语义（同源）
    const view = profileViewOf(payload);
    for (const item of view.profileItems) {
      expect(LrnevGuidanceItemSchema.safeParse(item).success).toBe(true);
      expect(GUIDANCE_ROLES).toContain(item.role);
      expect(item.profile_version).toBe('v1');
      expect(item).not.toHaveProperty('priority');
    }
  }

  describe('allowlist 四工具：role 化文本行完整保留（文本通道），payload 无 guidance 字段（O6）', () => {
    it('spec_create（恒有【事实】/【建议】行，无 decision_context）→ instructions 含两 role 行、无 guidance 字段', async () => {
      const result = await callTool(client, 'spec_create', {
        scene: sceneId,
        name: 'guidance-mount-a',
      });
      const payload = payloadOf(result);
      expect(payload.ok).toBe(true);
      expect(result.isError).toBeFalsy();
      expect(payload.response_version).toBe('1');

      // 文本通道同源：role 化行保留在 instructions（降级文本 = 唯一被消费通道，F-07）
      const instructions = instructionsOf(payload);
      expect(instructions[0]!.startsWith('【事实】')).toBe(true);
      expect(instructions[1]!.startsWith('【建议】')).toBe(true);
      expectProfileSemantics(payload, ['FACT', 'RECOMMENDATION']);

      // content 文本通道投影同一批 role 行
      const contentText = result.content[0]?.text ?? '';
      expect(contentText).toContain(instructions[0]);
      expect(contentText).toContain(instructions[1]);
      // content 是投影文本，不含结构化字段（payload 层面也无 guidance）
      expect(contentText).not.toContain('profile_version');

      // response_version 不 bump
      expect(payload.response_version).toBe('1');
      payloads.push(payload);
    });

    it('spec_create + decision_context（reuse_spec 误调 spec_create）→ 文本追加【决策边界】行、无 guidance 字段', async () => {
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
      // 边界行走文本通道（DECISION_BOUNDARY 语义与结构化视图一致，但响应不再携带数组）
      expectProfileSemantics(payload, ['FACT', 'RECOMMENDATION', 'DECISION_BOUNDARY']);
      const contentText = result.content[0]?.text ?? '';
      expect(contentText).toContain('【决策边界】');
      expect(contentText).toContain('reuse_spec');
      expect(contentText).not.toContain(MARKER);
    });

    it('scene_create + decision_context（new_scene 对齐但 target_ref 不一致）→ 文本含【决策边界】行、无 guidance 字段', async () => {
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
      expectProfileSemantics(payload, ['DECISION_BOUNDARY']);
      expect(result.content[0]?.text).toContain('【决策边界】');
    });

    it('task_create + decision_context（reuse_spec 对齐但 target_ref.spec 不一致）→ 文本含【决策边界】行、无 guidance 字段', async () => {
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
      expectProfileSemantics(payload, ['DECISION_BOUNDARY']);
      expect(result.content[0]?.text).toContain('【决策边界】');
    });

    it('assess_goal + decision_context（explicit new_spec）→ 文本 FACT/RECOMMENDATION 行 + content 投影全部 instructions（Q2）、无 guidance 字段', async () => {
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
      expectProfileSemantics(payload, ['FACT', 'RECOMMENDATION']);

      // Q2：assess_goal content 现在包含 ai_followup.instructions 文本
      const instructions = instructionsOf(payload);
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

  describe('无 role 化行 → 文本照常、无 guidance（响应结构化面整体不再携带）', () => {
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

    it('assess_goal（无 decision_context）→ 无 guidance；content 包含 instructions 文本（Q2 验证）', async () => {
      const result = await callTool(client, 'assess_goal', { goal: '新增登录功能' });
      const payload = payloadOf(result);
      expect(payload.ok).toBe(true);
      expect(payload).not.toHaveProperty('guidance');
      const instructions = instructionsOf(payload);
      expect(instructions.length).toBeGreaterThan(0);
      const contentText = result.content[0]?.text ?? '';
      expect(contentText).toContain('评估结果是 ');
      expect(contentText).toContain('三档分流指引');
      payloads.push(payload);
    });
  });

  describe('schema 与运行时：任何工具（含原 role 化四工具）都不含 guidance（O6 schema 字段移除）', () => {
    it('tools/list：全部工具的 outputSchema 均不声明 guidance', async () => {
      const tools = await client.listTools();
      const schemaText = (name: string): string => {
        const tool = tools.tools.find((t) => t.name === name);
        expect(tool, `缺少工具 ${name}`).toBeDefined();
        return JSON.stringify(tool!.outputSchema);
      };
      // 原 role 化四工具：T-006 O6 后 schema 不再声明顶层可选 guidance（回退，避免空字段误导）
      for (const toolName of ['assess_goal', 'scene_create', 'spec_create', 'task_create']) {
        expect(schemaText(toolName)).not.toContain('guidance');
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

  describe('冲突/异常注入：诊断留在纯函数契约面，adapter 零运行时诊断（T-006）', () => {
    it('【执行约束】行缺 source_ref → diagnoseGuidance 检出冲突（发布守卫契约）；adapter 原样透传无日志', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const data = { spec: '01-00-injected', scene: '00-default', path: '.lrnev/scenes/00-default/specs/01-00-injected' };
      const instructions = [
        '【事实】Spec "01-00-injected" 已创建。',
        '【执行约束】状态机拒绝该迁移。', // EXECUTION_CONSTRAINT 无 source_ref → diagnose 冲突
        '普通待办文本。',
      ];

      // 纯函数契约面：冲突显式诊断（D-06：不得静默让字段胜出 → 阻止发布，由测试/CI 门禁把关）
      const view = buildGuidanceView(classifyInstructions(instructions));
      const diagnoses = diagnoseGuidance(view.profileItems);
      expect(diagnoses.some((d) => d.kind === 'constraint_missing_source_ref')).toBe(true);

      // adapter 面：O6 后无运行时派生/诊断路径 → 业务结果原样、零日志
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
      expect(errorSpy).not.toHaveBeenCalled();
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

    it('所有收集的响应：无 guidance 字段、无 USER_DECISION；response_version 恒为 \'1\'', () => {
      expect(payloads.length).toBeGreaterThan(0);
      for (const payload of payloads) {
        expect(payload).not.toHaveProperty('guidance');
        expect(JSON.stringify(payload)).not.toContain('USER_DECISION');
        expect(payload.response_version).toBe('1');
      }
    });
  });
});
