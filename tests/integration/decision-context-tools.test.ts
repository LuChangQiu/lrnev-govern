/**
 * 05-00 lrnev Guidance Profile - T-003 四工具接线协议级测试
 *
 * Spec: 05-00-lrnev-guidance-profile（F-04/F-05/F-06、D-03/D-04）
 * Task: T-003（裁决 Q1 文本通道 / Q2 错误表面 A / Q3 spec_update strip / Q4 单次对齐）
 *
 * 覆盖（对真实 MCP server + 临时工作区）：
 * - tools/list 广告层：assess_goal/scene_create/spec_create/task_create 声明
 *   decision_context；spec_update 不声明（误传被 SDK strip、不报错、无效）；
 * - assess_goal：合法 context 追加【事实】行；纯读取无副作用（.lrnev 零新增）；
 * - 三个写入工具：合法 context 调用成功且执行真实写入；方向/工具类别或
 *   target_ref 不一致时只在 ai_followup.instructions（与 content 投影）追加
 *   【决策边界】行——不阻断（isError=false）、不回滚；
 * - 非法 decision_context（explicit 无 direction）→ canonical errors 信封
 *   （ok=false、errors[0].code=INVALID_INPUT、field=decision_context.direction）、
 *   且无任何落盘副作用；
 * - spec_update 误传 decision_context：被剥离、不报错、不落盘；
 * - 哨兵：所有调用后 .lrnev 内无 decision_context 痕迹（不持久化）；
 * - 服务端响应不含 USER_DECISION 文本。
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { dir as tmpDir, type DirectoryResult } from 'tmp-promise';

import { createMcpServer } from '../../src/mcp/server.js';

/** 调用工具并返回原始结果（含 structuredContent / content / isError）。 */
async function callTool(client: Client, name: string, args: Record<string, unknown>): Promise<any> {
  return client.callTool({ name, arguments: args });
}

/** 取 canonical payload。 */
function payloadOf(result: any): any {
  return result?.structuredContent;
}

/** 收集 .lrnev 下全部相对路径（递归），用于“无副作用/无新增”哨兵。 */
async function lrnevEntries(root: string): Promise<string[]> {
  const lrnevDir = path.join(root, '.lrnev');
  const entries: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    let children: string[] = [];
    try {
      children = await fs.readdir(dir);
    } catch {
      return; // 目录可能暂时不存在
    }
    for (const child of children) {
      const full = path.join(dir, child);
      const stat = await fs.stat(full);
      if (stat.isDirectory()) {
        if (child === 'steering') continue; // 引导文档非持久化声明
        await walk(full);
      } else {
        entries.push(path.relative(lrnevDir, full).replace(/\\/g, '/'));
      }
    }
  };
  await walk(lrnevDir);
  return entries.sort();
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
        if (child === 'steering') continue; // 引导文档非持久化声明
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

const MARKER = 'PERSIST_SENTINEL_T003_9F3';

describe('T-003: 四工具 decision_context 接线与渲染非阻断决策边界', () => {
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

  describe('广告层：四个 v1 工具声明 decision_context，spec_update 不声明', () => {
    it('tools/list：四工具 inputSchema 含 decision_context', async () => {
      const tools = await client.listTools();
      const schemaText = (name: string): string => {
        const tool = tools.tools.find((t) => t.name === name);
        expect(tool, `缺少工具 ${name}`).toBeDefined();
        return JSON.stringify(tool!.inputSchema);
      };
      for (const toolName of ['assess_goal', 'scene_create', 'spec_create', 'task_create']) {
        expect(schemaText(toolName)).toContain('decision_context');
      }
    });

    it('tools/list：spec_update 等非 v1 工具 inputSchema 不含 decision_context', async () => {
      const tools = await client.listTools();
      for (const toolName of ['spec_update', 'spec_get', 'scene_get']) {
        const tool = tools.tools.find((t) => t.name === toolName);
        expect(tool).toBeDefined();
        expect(JSON.stringify(tool!.inputSchema)).not.toContain('decision_context');
      }
    });
  });

  describe('assess_goal：写入前组织建议文本，纯读取无副作用', () => {
    it('合法 context → ok；ai_followup 追加【事实】行；.lrnev 零新增', async () => {
      const before = await lrnevEntries(workspace.path);
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
      expect(result.isError).toBeFalsy();
      const instructions: string[] = payload.ai_followup?.instructions ?? [];
      const text = instructions.join('\n');
      expect(text).toContain('【事实】');
      expect(text).toContain('direction=new_spec');
      expect(text).toContain('【建议】');
      expect(text).not.toContain('USER_DECISION');
      payloads.push(payload);

      // 哨兵：assess 是纯读取，调用前后 .lrnev 文件集合一致（无副作用）
      const after = await lrnevEntries(workspace.path);
      expect(after).toEqual(before);
    });

    it('非法 context（explicit 无 direction）→ canonical errors 信封，无写入', async () => {
      const result = await callTool(client, 'assess_goal', {
        goal: '新增登录功能',
        decision_context: { source: 'client_asserted', strength: 'explicit', summary: MARKER },
      });
      const payload = payloadOf(result);
      expect(result.isError).toBe(true);
      expect(payload.ok).toBe(false);
      expect(payload.errors).toBeDefined();
      expect(payload.errors[0].code).toBe('INVALID_INPUT');
      expect(payload.errors[0].field).toBe('decision_context.direction');
      expect(payload.errors[0].message).toContain('direction');
      payloads.push(payload);
    });
  });

  describe('scene_create：direction 对齐 + target_ref 单次核对（不阻断、不落盘）', () => {
    it('new_scene 对齐但 target_ref 不一致 → 只追加【决策边界】行，Scene 仍创建', async () => {
      const result = await callTool(client, 'scene_create', {
        name: 'billing',
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
      expect(result.isError).toBeFalsy(); // 不阻断
      expect(payload.data.id).toContain('06-billing');

      const instructions: string[] = payload.ai_followup?.instructions ?? [];
      const boundaryLines = instructions.filter((line) => line.startsWith('【决策边界】'));
      expect(boundaryLines.length).toBe(1);
      expect(boundaryLines[0]).toContain('07-payroll');
      expect(boundaryLines[0]).toContain('billing');
      expect(boundaryLines[0]).not.toContain(MARKER);

      // MVC renderer 投影：content 文本也包含【决策边界】行
      const contentText = result.content[0]?.text ?? '';
      expect(contentText).toContain('【决策边界】');

      // 真实写入已发生（不自动回滚）
      const sceneMd = path.join(workspace.path, '.lrnev', 'scenes', payload.data.id as string, 'scene.md');
      await expect(fs.access(sceneMd)).resolves.toBeUndefined();
      payloads.push(payload);
    });

    it('非法 context（explicit 无 direction）→ 结构化错误且 Scene 未创建', async () => {
      const before = (await fs.readdir(path.join(workspace.path, '.lrnev', 'scenes'))).sort();
      const result = await callTool(client, 'scene_create', {
        name: 'never-created',
        number: 9,
        decision_context: { source: 'client_asserted', strength: 'explicit', summary: MARKER },
      });
      const payload = payloadOf(result);
      expect(result.isError).toBe(true);
      expect(payload.ok).toBe(false);
      expect(payload.errors[0].code).toBe('INVALID_INPUT');
      expect(payload.errors[0].field).toBe('decision_context.direction');
      payloads.push(payload);

      const after = (await fs.readdir(path.join(workspace.path, '.lrnev', 'scenes'))).sort();
      expect(after).toEqual(before);
    });
  });

  describe('spec_create：direction 与工具类别不一致 → 边界提示，不阻断创建', () => {
    it('reuse_spec 却调用 spec_create → 【决策边界】行 + Spec 仍创建', async () => {
      const result = await callTool(client, 'spec_create', {
        scene: sceneId,
        name: 'auth-flow',
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
      expect(result.isError).toBeFalsy();
      expect(payload.data.spec).toBeDefined();

      const instructions: string[] = payload.ai_followup?.instructions ?? [];
      const boundaryLines = instructions.filter((line) => line.startsWith('【决策边界】'));
      expect(boundaryLines.length).toBe(1);
      expect(boundaryLines[0]).toContain('reuse_spec');
      expect(boundaryLines[0]).toContain('spec_create');
      expect((result.content[0]?.text ?? '')).toContain('【决策边界】');
      payloads.push(payload);
    });
  });

  describe('task_create：reuse_spec 对齐 + target_ref 单次核对', () => {
    it('reuse_spec → task_create 且 target_ref 一致 → 不追加任何【决策边界】行', async () => {
      const result = await callTool(client, 'task_create', {
        scene: sceneId,
        spec: specId,
        title: '实现登录',
        decision_context: {
          source: 'client_asserted',
          strength: 'explicit',
          summary: MARKER,
          direction: 'reuse_spec',
          target_ref: `scene=${sceneId}, spec=${specId}`,
        },
      });
      const payload = payloadOf(result);
      expect(payload.ok).toBe(true);
      expect(result.isError).toBeFalsy();
      expect(payload.data.id).toMatch(/^T-\d+/);
      const instructions: string[] = payload.ai_followup?.instructions ?? [];
      expect(instructions.some((line) => line.startsWith('【决策边界】'))).toBe(false);
      payloads.push(payload);
    });

    it('reuse_spec 对齐但 target_ref.spec 与调用参数不一致 → 边界提示，Task 仍创建', async () => {
      const result = await callTool(client, 'task_create', {
        scene: sceneId,
        spec: specId,
        title: '实现找回密码',
        decision_context: {
          source: 'client_asserted',
          strength: 'explicit',
          summary: MARKER,
          direction: 'reuse_spec',
          target_ref: `scene=${sceneId}, spec=02-00-password-reset`,
        },
      });
      const payload = payloadOf(result);
      expect(payload.ok).toBe(true);
      expect(result.isError).toBeFalsy();
      expect(payload.data.id).toMatch(/^T-\d+/);
      const instructions: string[] = payload.ai_followup?.instructions ?? [];
      const boundaryLines = instructions.filter((line) => line.startsWith('【决策边界】'));
      expect(boundaryLines.length).toBe(1);
      expect(boundaryLines[0]).toContain('02-00-password-reset');
      expect(boundaryLines[0]).toContain(specId);
      expect((result.content[0]?.text ?? '')).toContain('【决策边界】');
      payloads.push(payload);
    });
  });

  describe('spec_update：误传 decision_context 被剥离、不报错、无副作用', () => {
    it('合法形态 context 误传 → spec_update 照常成功，context 未持久化', async () => {
      const result = await callTool(client, 'spec_update', {
        scene: sceneId,
        spec: specId,
        status: 'ready',
        reason: '协议测试',
        decision_context: {
          source: 'client_asserted',
          strength: 'explicit',
          summary: MARKER,
          direction: 'new_spec',
        },
      });
      const payload = payloadOf(result);
      expect(payload.ok).toBe(true);
      expect(result.isError).toBeFalsy();
      expect(payload.data.status).toBe('ready');
      payloads.push(payload);
    });

    it('非法形态 context 误传（explicit 无 direction）→ 同样被剥离不报错', async () => {
      const result = await callTool(client, 'spec_update', {
        scene: sceneId,
        spec: specId,
        status: 'in-progress',
        decision_context: { source: 'client_asserted', strength: 'explicit', summary: MARKER },
      });
      const payload = payloadOf(result);
      expect(payload.ok).toBe(true);
      expect(result.isError).toBeFalsy();
      expect(payload.data.status).toBe('in-progress');
      payloads.push(payload);
    });
  });

  describe('SDK 类型级拦截：枚举非法值在 handler 前被 SDK 拒绝', () => {
    it('strength=banana → isError（SDK 校验路径），无写入', async () => {
      const result = await callTool(client, 'assess_goal', {
        goal: '目标',
        decision_context: { source: 'client_asserted', strength: 'banana', summary: 'x', direction: 'new_spec' },
      });
      expect(result.isError).toBe(true);
    });
  });

  describe('哨兵：decision_context 绝不落盘 + 服务端不输出 USER_DECISION', () => {
    it('.lrnev 全部文件不含 decision_context / client_asserted / 声明摘要标记', async () => {
      const markerHits = await scanLrnevForMarker(workspace.path, MARKER);
      expect(markerHits).toEqual([]);
      const keywordHits = await scanLrnevForMarker(workspace.path, 'decision_context');
      expect(keywordHits).toEqual([]);
      const clientAssertedHits = await scanLrnevForMarker(workspace.path, 'client_asserted');
      expect(clientAssertedHits).toEqual([]);
    });

    it('所有带 context 的响应（含错误）不包含 USER_DECISION 文本', () => {
      expect(payloads.length).toBeGreaterThan(0);
      for (const payload of payloads) {
        expect(JSON.stringify(payload)).not.toContain('USER_DECISION');
      }
    });
  });
});
