/**
 * MCP server 基础单元测试。
 *
 * 这里不启动 stdio transport，只验证 server 构建和工具注册路径可执行。
 * 真正的协议级列工具 / 调工具在 e2e 阶段补。
 */

import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { dir as tmpDir } from 'tmp-promise';

import { FileStorage } from '../../src/storage/FileStorage.js';
import { DEFAULT_SCENE_ID } from '../../src/core/SceneManager.js';
import { WorkspaceManager } from '../../src/core/WorkspaceManager.js';
import { createMcpServer } from '../../src/mcp/server.js';

/** SDK result.content / resource.contents 在类型层为 unknown / 内容块联合，
 * 运行时是 { type: 'text'; text: string } 内容块数组。这里做局部类型投影，
 * 读取语义与原先的 ?.[0]?.type === 'text' ? [0].text : '' 完全一致（纯类型层，无运行时转换）。 */
type MCPTextBlock = { type?: string; text?: string };
function contentText(content: unknown): string {
  const first = (content as MCPTextBlock[] | undefined)?.[0];
  return first?.type === 'text' ? (first.text ?? '') : '';
}

describe('MCP server', () => {
  it('应能创建 MCP server 并注册工具', () => {
    const server = createMcpServer();
    expect(server).toBeDefined();
    expect(server.isConnected()).toBe(false);
  });

  it('协议级 listTools 应能列出阶段 2 工具', async () => {
    const { server, client } = await connectInMemory();

    const tools = await client.listTools();
    const names = tools.tools.map((tool) => tool.name);

    expect(names).toEqual(
      expect.arrayContaining([
        'lrnev_init',
        'project_status',
        'scene_create',
        'scene_list',
        'scene_get',
        'spec_create',
        'spec_list',
        'spec_get',
        'spec_update',
        'task_create',
        'task_update',
        'task_list',
        'task_claim',
        'task_release',
        'spec_gate_check',
        'adr_create',
        'adr_list',
        'adr_get',
        'assess_goal',
        'summarize_save',
        'context_search',
        'error_record',
        'error_search',
        'error_promote',
        'memory_save',
        'memory_search',
        'memory_forget',
        'session_commit',
        'agent_register',
        'agent_heartbeat',
        'agent_list',
        'agent_unregister',
        'lrnev_doctor',
        'lrnev_hook_list',
        'lrnev_hook_trigger',
        'lrnev_hook_tail_log',
        'lrnev_hook_enable',
        'lrnev_hook_disable',
      ]),
    );

    await client.close();
    await server.close();
  });

  it('F-04: lrnev_init scan schema 描述应说明占位语义', async () => {
    const { server, client } = await connectInMemory();

    const tools = await client.listTools();
    const init = tools.tools.find((tool) => tool.name === 'lrnev_init');

    expect(JSON.stringify(init?.inputSchema)).toContain('占位');

    await client.close();
    await server.close();
  });

  it('协议级 listResources/readResource 应能读取 context://project', async () => {
    const workspace = await tmpDir({ unsafeCleanup: true });
    const original = process.env.LRNEV_WORKSPACE;
    process.env.LRNEV_WORKSPACE = workspace.path;
    try {
      await new WorkspaceManager().init({ root: workspace.path, project_name: 'demo' });
      await new FileStorage(workspace.path).write('.lrnev/.abstract.md', 'legacy summary\n');
      const { server, client } = await connectInMemory();

      const resources = await client.listResources();
      expect(resources.resources.map((r) => r.uri)).toContain('context://project');

      const project = await client.readResource({ uri: 'context://project?level=L0' });
      const text = (project.contents[0] as MCPTextBlock | undefined)?.text;
      expect(text).toContain('已回退到 L2 原文');
      expect(text).toContain('# demo');
      expect(text).not.toContain('legacy summary');

      await client.close();
      await server.close();
    } finally {
      if (original === undefined) delete process.env.LRNEV_WORKSPACE;
      else process.env.LRNEV_WORKSPACE = original;
      await workspace.cleanup();
    }
  });

  it('协议级 spec_gate_check 应返回失败检查和 ai_followup', async () => {
    const workspace = await tmpDir({ unsafeCleanup: true });
    const original = process.env.LRNEV_WORKSPACE;
    process.env.LRNEV_WORKSPACE = workspace.path;
    try {
      const { server, client } = await connectInMemory();
      await client.callTool({ name: 'lrnev_init', arguments: { root: workspace.path, project_name: 'demo' } });
      await client.callTool({ name: 'scene_create', arguments: { name: 'user-management' } });
      await client.callTool({ name: 'spec_create', arguments: { scene: 'user-management', name: 'user-login' } });

      const result = await client.callTool({
        name: 'spec_gate_check',
        arguments: { scene: 'user-management', spec: 'user-login', gate: 'ready' },
      });
      const text = contentText(result.content);

      // M2: spec_gate_check 使用渲染器，返回格式化文本而非 JSON
      // 验证 gate 失败和提示信息
      expect(text).toContain('ready gate');
      expect(text).toContain('未通过');

      await client.close();
      await server.close();
    } finally {
      if (original === undefined) delete process.env.LRNEV_WORKSPACE;
      else process.env.LRNEV_WORKSPACE = original;
      await workspace.cleanup();
    }
  });

  it('12-F02 + E-02 G1: spec_get 对已完成 Spec 提示开新版；对存在但未完成的 Spec 挂增量登记边界引导', async () => {
    const workspace = await tmpDir({ unsafeCleanup: true });
    const original = process.env.LRNEV_WORKSPACE;
    process.env.LRNEV_WORKSPACE = workspace.path;
    try {
      const { server, client } = await connectInMemory();
      await client.callTool({ name: 'lrnev_init', arguments: { root: workspace.path, project_name: 'demo' } });
      await client.callTool({ name: 'scene_create', arguments: { name: 'sg' } });
      await client.callTool({ name: 'spec_create', arguments: { scene: 'sg', name: 'feat-x' } });

      const parse = (r: Awaited<ReturnType<typeof client.callTool>>) => {
        return r.structuredContent as { data?: unknown; ai_followup?: { instructions: string[] }; status?: string };
      };

      // draft（存在但未完成）→ 不提示开新版；但给"增量登记 vs 正文编辑"边界引导（E-02 G1）
      const draftGet = parse(await client.callTool({ name: 'spec_get', arguments: { scene: 'sg', spec: 'feat-x' } }));
      const draftText = JSON.stringify(draftGet);
      expect(draftText).not.toContain('整体推翻重做');
      expect(draftGet.ai_followup?.instructions.join('\n')).toContain('task_create 在对应 Spec 登记开发任务');
      expect(draftGet.ai_followup?.instructions.join('\n')).toContain('不能替代开发任务的登记');

      // in-progress（E-02 根因场景：已有 in-progress spec 下继续开发）→ 同样挂边界引导，不提示开新版
      await client.callTool({ name: 'spec_update', arguments: { scene: 'sg', spec: 'feat-x', status: 'ready' } });
      await client.callTool({ name: 'spec_update', arguments: { scene: 'sg', spec: 'feat-x', status: 'in-progress' } });
      const progressGet = parse(await client.callTool({ name: 'spec_get', arguments: { scene: 'sg', spec: 'feat-x' } }));
      const progressText = JSON.stringify(progressGet);
      expect(progressText).not.toContain('整体推翻重做');
      expect(progressGet.ai_followup?.instructions.join('\n')).toContain('task_create 在对应 Spec 登记开发任务');

      // completed（已实现）→ spec_get 提示考虑开新版（VV+1 语义，与增量引导互斥）
      await client.callTool({ name: 'spec_update', arguments: { scene: 'sg', spec: 'feat-x', status: 'completed' } });
      const doneGet = parse(await client.callTool({ name: 'spec_get', arguments: { scene: 'sg', spec: 'feat-x' } }));
      expect(doneGet.ai_followup?.instructions.join('\n')).toContain('整体推翻重做');
      expect(doneGet.ai_followup?.instructions.join('\n')).not.toContain('task_create 在对应 Spec 登记开发任务');

      await client.close();
      await server.close();
    } finally {
      if (original === undefined) delete process.env.LRNEV_WORKSPACE;
      else process.env.LRNEV_WORKSPACE = original;
      await workspace.cleanup();
    }
  });

  it('protocol spec_create should work without an explicit scene', async () => {
    const workspace = await tmpDir({ unsafeCleanup: true });
    const original = process.env.LRNEV_WORKSPACE;
    process.env.LRNEV_WORKSPACE = workspace.path;
    try {
      const { server, client } = await connectInMemory();
      await client.callTool({ name: 'lrnev_init', arguments: { root: workspace.path, project_name: 'demo' } });

      const created = await client.callTool({
        name: 'spec_create',
        arguments: { name: 'quick-feature' },
      });
      const payload = created.structuredContent as { data: { scene: string; spec: string } };

      expect(payload.data.scene).toBe(DEFAULT_SCENE_ID);
      expect(payload.data.spec).toBe('01-00-quick-feature');

      await client.close();
      await server.close();
    } finally {
      if (original === undefined) delete process.env.LRNEV_WORKSPACE;
      else process.env.LRNEV_WORKSPACE = original;
      await workspace.cleanup();
    }
  });

  it('协议级 project_status 应返回接手快照和 ai_followup', async () => {
    const workspace = await tmpDir({ unsafeCleanup: true });
    const original = process.env.LRNEV_WORKSPACE;
    process.env.LRNEV_WORKSPACE = workspace.path;
    try {
      const { server, client } = await connectInMemory();
      await client.callTool({ name: 'lrnev_init', arguments: { root: workspace.path, project_name: 'demo' } });
      await client.callTool({ name: 'scene_create', arguments: { name: 'user-management' } });
      await client.callTool({ name: 'spec_create', arguments: { scene: 'user-management', name: 'user-login' } });
      await client.callTool({
        name: 'task_create',
        arguments: { scene: 'user-management', spec: 'user-login', title: 'Implement login' },
      });
      await client.callTool({
        name: 'task_update',
        arguments: { scene: 'user-management', spec: 'user-login', task_id: 'T-001', status: 'in_progress' },
      });

      const result = await client.callTool({ name: 'project_status', arguments: {} });
      const payload = result.structuredContent as {
        data: { scenes: unknown[]; specs: unknown[]; active_tasks: Array<{ id: string; status: string }> };
        ai_followup?: { instructions: string[]; suggested_tools?: Array<{ name: string }> };
      };

      expect(payload.data.scenes).toHaveLength(1);
      expect(payload.data.specs).toHaveLength(1);
      expect(payload.data.active_tasks).toEqual([
        expect.objectContaining({ id: 'T-001', status: 'in_progress' }),
      ]);
      expect(payload.ai_followup?.instructions.join('\n')).toContain('project_status');
      expect(payload.ai_followup?.instructions.join('\n')).toContain('active_agents');
      expect(payload.ai_followup?.instructions.join('\n')).toContain('free_tasks_count');
      expect(payload.ai_followup?.suggested_tools?.map((tool) => tool.name)).toEqual(
        expect.arrayContaining(['spec_get', 'scene_get']),
      );

      await client.close();
      await server.close();
    } finally {
      if (original === undefined) delete process.env.LRNEV_WORKSPACE;
      else process.env.LRNEV_WORKSPACE = original;
      await workspace.cleanup();
    }
  });

  it('F-06: 协议级 task_list 应说明平铺数组与 children 去重语义', async () => {
    const workspace = await tmpDir({ unsafeCleanup: true });
    const original = process.env.LRNEV_WORKSPACE;
    process.env.LRNEV_WORKSPACE = workspace.path;
    try {
      const { server, client } = await connectInMemory();
      await client.callTool({ name: 'lrnev_init', arguments: { root: workspace.path, project_name: 'demo' } });
      await client.callTool({ name: 'scene_create', arguments: { name: 'user-management' } });
      await client.callTool({ name: 'spec_create', arguments: { scene: 'user-management', name: 'user-login' } });
      await client.callTool({
        name: 'task_create',
        arguments: { scene: 'user-management', spec: 'user-login', title: 'Parent' },
      });
      await client.callTool({
        name: 'task_create',
        arguments: { scene: 'user-management', spec: 'user-login', title: 'Child', parent: 'T-001' },
      });

      const result = await client.callTool({
        name: 'task_list',
        arguments: { scene: 'user-management', spec: 'user-login' },
      });
      const payload = result.structuredContent as {
        ok: boolean;
        data: Array<{ id: string; parent?: string; children?: unknown[] }>;
        ai_followup?: { instructions: string[] };
      };

      expect(payload.ok).toBe(true);
      expect(payload.data).toHaveLength(2);
      expect(payload.data[0]?.children).toHaveLength(1);
      expect(payload.ai_followup?.instructions.join('\n')).toContain('全量平铺');
      expect(payload.ai_followup?.instructions.join('\n')).toContain('parent === undefined');
      expect(payload.ai_followup?.instructions.join('\n')).toContain('不要把 children 内的项再算一次');

      await client.close();
      await server.close();
    } finally {
      if (original === undefined) delete process.env.LRNEV_WORKSPACE;
      else process.env.LRNEV_WORKSPACE = original;
      await workspace.cleanup();
    }
  });

  it('F-13: 协议级 task_list view=readable 应返回人读投影视图', async () => {
    const workspace = await tmpDir({ unsafeCleanup: true });
    const original = process.env.LRNEV_WORKSPACE;
    process.env.LRNEV_WORKSPACE = workspace.path;
    try {
      const { server, client } = await connectInMemory();
      await client.callTool({ name: 'lrnev_init', arguments: { root: workspace.path, project_name: 'demo' } });
      await client.callTool({ name: 'scene_create', arguments: { name: 'user-management' } });
      await client.callTool({ name: 'spec_create', arguments: { scene: 'user-management', name: 'user-login' } });
      await client.callTool({
        name: 'task_create',
        arguments: {
          scene: 'user-management',
          spec: 'user-login',
          title: 'Readable task',
          acceptance: ['自然语言验收'],
          validates: ['F-01'],
        },
      });
      await client.callTool({
        name: 'task_update',
        arguments: { scene: 'user-management', spec: 'user-login', task_id: 'T-001', status: 'in_progress' },
      });

      const result = await client.callTool({
        name: 'task_list',
        arguments: { scene: 'user-management', spec: 'user-login', view: 'readable' },
      });
      const text = contentText(result.content);

      // M2: task_list 使用渲染器，返回格式化文本而非 JSON
      // 验证关键内容出现在渲染结果中（status 显示为 emoji：→ = in_progress）
      expect(text).toContain('T-001');
      expect(text).toContain('→'); // in_progress emoji

      await client.close();
      await server.close();
    } finally {
      if (original === undefined) delete process.env.LRNEV_WORKSPACE;
      else process.env.LRNEV_WORKSPACE = original;
      await workspace.cleanup();
    }
  });

  it('F-08: 协议级 task_claim/task_release 应返回软占用结果和重叠提示', async () => {
    const workspace = await tmpDir({ unsafeCleanup: true });
    const original = process.env.LRNEV_WORKSPACE;
    process.env.LRNEV_WORKSPACE = workspace.path;
    try {
      const { server, client } = await connectInMemory();
      await client.callTool({ name: 'lrnev_init', arguments: { root: workspace.path, project_name: 'demo' } });
      await client.callTool({ name: 'scene_create', arguments: { name: 'user-management' } });
      await client.callTool({ name: 'spec_create', arguments: { scene: 'user-management', name: 'user-login' } });
      await client.callTool({
        name: 'task_create',
        arguments: { scene: 'user-management', spec: 'user-login', title: 'First task' },
      });
      await client.callTool({
        name: 'task_create',
        arguments: { scene: 'user-management', spec: 'user-login', title: 'Second task' },
      });
      await client.callTool({
        name: 'task_claim',
        arguments: {
          scene: 'user-management',
          spec: 'user-login',
          task: 'T-001',
          agent_id: 'agent-a',
          touches_files: ['src/auth.ts'],
        },
      });

      const second = await client.callTool({
        name: 'task_claim',
        arguments: {
          scene: 'user-management',
          spec: 'user-login',
          task: 'T-002',
          agent_id: 'agent-b',
          touches_files: ['src/auth.ts'],
        },
      });
      const secondPayload = second.structuredContent as {
        data: { claimed: boolean; overlaps?: unknown[] };
        ai_followup?: { instructions: string[] };
      };

      expect(secondPayload.data.claimed).toBe(true);
      expect(secondPayload.data.overlaps).toHaveLength(1);
      expect(secondPayload.ai_followup?.instructions.join('\n')).toContain('touches_files 重叠警告');

      const released = await client.callTool({
        name: 'task_release',
        arguments: { scene: 'user-management', spec: 'user-login', task: 'T-002', agent_id: 'agent-b' },
      });
      const releasedPayload = released.structuredContent as { data: { released: boolean } };
      expect(releasedPayload.data.released).toBe(true);

      await client.close();
      await server.close();
    } finally {
      if (original === undefined) delete process.env.LRNEV_WORKSPACE;
      else process.env.LRNEV_WORKSPACE = original;
      await workspace.cleanup();
    }
  });

  it('协议级 spec_gate_check passed 分支应提示正确状态回填', async () => {
    const workspace = await tmpDir({ unsafeCleanup: true });
    const original = process.env.LRNEV_WORKSPACE;
    process.env.LRNEV_WORKSPACE = workspace.path;
    try {
      const { server, client } = await connectInMemory();
      await client.callTool({ name: 'lrnev_init', arguments: { root: workspace.path, project_name: 'demo' } });
      await client.callTool({ name: 'scene_create', arguments: { name: 'user-management' } });
      const createdSpec = await client.callTool({
        name: 'spec_create',
        arguments: { scene: 'user-management', name: 'user-login' },
      });
      const createdSpecPayload = createdSpec.structuredContent as { data: { scene: string; spec: string } };
      await writeReadyRequirements(workspace.path, createdSpecPayload.data.scene, createdSpecPayload.data.spec);

      const ready = await client.callTool({
        name: 'spec_gate_check',
        arguments: { scene: 'user-management', spec: 'user-login', gate: 'ready' },
      });
      const readyPayload = ready.structuredContent as {
        data: { passed: boolean };
        ai_followup?: { instructions: string[]; suggested_tools?: Array<{ name: string }> };
      };

      expect(readyPayload.data.passed).toBe(true);
      expect(readyPayload.ai_followup?.instructions.join('\n')).toContain('请暂停');
      expect(readyPayload.ai_followup?.instructions.join('\n')).toContain('展示给用户确认');
      expect(readyPayload.ai_followup?.instructions.join('\n')).toContain('状态回填为 ready');
      expect(readyPayload.ai_followup?.instructions.join('\n')).not.toContain('in-progress');
      expect(readyPayload.ai_followup?.instructions.join('\n')).toContain('adr_create');
      expect(readyPayload.ai_followup?.instructions.join('\n')).toContain('design.md 说明影响面');
      expect(readyPayload.ai_followup?.instructions.join('\n')).toContain('design.md 的 FILL 哨兵填完');
      expect(readyPayload.ai_followup?.instructions.join('\n')).toContain('architecture.md');
      expect(readyPayload.ai_followup?.instructions.join('\n')).toContain('沉淀“为什么”');
      expect(readyPayload.ai_followup?.instructions.join('\n')).toContain('要不要拆成子任务');
      expect(readyPayload.ai_followup?.instructions.join('\n')).toContain('可分别认领/可并行');
      expect(readyPayload.ai_followup?.instructions.join('\n')).toContain('各自独立验收');
      expect(readyPayload.ai_followup?.instructions.join('\n')).toContain('别为拆而拆');
      expect(new FileStorage(workspace.path).exists('.lrnev/scenes/01-user-management/ontology.json')).toBe(false);
      expect(readyPayload.ai_followup?.suggested_tools?.map((tool) => tool.name)).toContain('adr_create');

      await client.callTool({
        name: 'task_create',
        arguments: { scene: 'user-management', spec: 'user-login', title: 'Implement login' },
      });
      await client.callTool({
        name: 'task_update',
        arguments: { scene: 'user-management', spec: 'user-login', task_id: 'T-001', status: 'in_progress' },
      });
      await client.callTool({
        name: 'task_update',
        arguments: { scene: 'user-management', spec: 'user-login', task_id: 'T-001', status: 'completed' },
      });

      const completion = await client.callTool({
        name: 'spec_gate_check',
        arguments: { scene: 'user-management', spec: 'user-login', gate: 'completion' },
      });
      const completionPayload = completion.structuredContent as {
        data: { passed: boolean };
        ai_followup?: { instructions: string[]; suggested_tools?: Array<{ name: string }> };
      };

      expect(completionPayload.data.passed).toBe(true);
      expect(completionPayload.ai_followup?.instructions.join('\n')).toContain('状态回填为 completed');
      expect(completionPayload.ai_followup?.instructions.join('\n')).toContain('逐条确认验收标准是否真达成');
      expect(completionPayload.ai_followup?.instructions.join('\n')).toContain('L0 摘要');
      expect(new FileStorage(workspace.path).exists('.lrnev/scenes/01-user-management/specs/01-00-user-login/problem-contract.json')).toBe(false);
      expect(completionPayload.ai_followup?.suggested_tools?.map((tool) => tool.name)).toContain('summarize_save');

      await client.close();
      await server.close();
    } finally {
      if (original === undefined) delete process.env.LRNEV_WORKSPACE;
      else process.env.LRNEV_WORKSPACE = original;
      await workspace.cleanup();
    }
  });

  it('协议级歧义 Spec 引用应返回候选列表和澄清 ai_followup', async () => {
    const workspace = await tmpDir({ unsafeCleanup: true });
    const original = process.env.LRNEV_WORKSPACE;
    process.env.LRNEV_WORKSPACE = workspace.path;
    try {
      const { server, client } = await connectInMemory();
      await client.callTool({ name: 'lrnev_init', arguments: { root: workspace.path, project_name: 'demo' } });
      await client.callTool({ name: 'scene_create', arguments: { name: 'user-management' } });
      await client.callTool({
        name: 'spec_create',
        arguments: { scene: 'user-management', name: 'feat' },
      });
      await client.callTool({
        name: 'spec_create',
        arguments: { scene: 'user-management', name: 'feat', version: 1 },
      });

      const got = await client.callTool({
        name: 'spec_get',
        arguments: { scene: 'user-management', spec: 'feat' },
      });
      const getPayload = got.structuredContent as {
        ok: boolean;
        errors: Array<{ code: string; candidates?: string[] }>;
        ai_followup?: { instructions: string[] };
      };

      expect(getPayload.ok).toBe(false);
      expect(getPayload.errors[0]?.code).toBe('AMBIGUOUS_REF');
      expect(getPayload.errors[0]?.candidates).toEqual(['01-00-feat', '01-01-feat']);
      expect(getPayload.ai_followup?.instructions.join('\n')).toContain('Spec 引用不唯一');
      expect(getPayload.ai_followup?.instructions.join('\n')).toContain('01-00-feat');

      const gate = await client.callTool({
        name: 'spec_gate_check',
        arguments: { scene: 'user-management', spec: 'feat', gate: 'ready' },
      });
      const gatePayload = gate.structuredContent as {
        ok: boolean;
        errors: Array<{ code: string; candidates?: string[] }>;
        ai_followup?: { instructions: string[] };
      };

      expect(gatePayload.ok).toBe(false);
      expect(gatePayload.errors[0]?.code).toBe('AMBIGUOUS_REF');
      expect(gatePayload.errors[0]?.candidates).toEqual(['01-00-feat', '01-01-feat']);
      expect(gatePayload.ai_followup?.instructions.join('\n')).toContain('确认后使用完整 Spec id');

      await client.close();
      await server.close();
    } finally {
      if (original === undefined) delete process.env.LRNEV_WORKSPACE;
      else process.env.LRNEV_WORKSPACE = original;
      await workspace.cleanup();
    }
  });

  it('协议级 scene_list 含 broken 时应提示运行 doctor', async () => {
    const workspace = await tmpDir({ unsafeCleanup: true });
    const original = process.env.LRNEV_WORKSPACE;
    process.env.LRNEV_WORKSPACE = workspace.path;
    try {
      const { server, client } = await connectInMemory();
      await client.callTool({ name: 'lrnev_init', arguments: { root: workspace.path, project_name: 'demo' } });
      const fs = new FileStorage(workspace.path);
      await fs.write('.lrnev/scenes/01-broken/scene.md', [
        '---',
        'id: [broken',
        '---',
        '',
        '# Broken',
      ].join('\n'));

      const result = await client.callTool({ name: 'scene_list', arguments: {} });
      const payload = result.structuredContent as {
        ok: boolean;
        data: Array<{ id: string; broken?: { error: string; path: string } }>;
        ai_followup?: { instructions: string[]; suggested_tools?: Array<{ name: string }> };
      };

      const broken = payload.data.find((item) => item.id === '01-broken');
      expect(payload.ok).toBe(true);
      expect(broken?.broken?.path).toContain('01-broken');
      expect(payload.ai_followup?.instructions.join('\n')).toContain('损坏 Scene');
      expect(payload.ai_followup?.instructions.join('\n')).toContain('lrnev_doctor');
      expect(payload.ai_followup?.suggested_tools?.map((tool) => tool.name)).toContain('lrnev_doctor');

      await client.close();
      await server.close();
    } finally {
      if (original === undefined) delete process.env.LRNEV_WORKSPACE;
      else process.env.LRNEV_WORKSPACE = original;
      await workspace.cleanup();
    }
  });

  it('协议级 spec_list 含 broken 时应提示运行 doctor', async () => {
    const workspace = await tmpDir({ unsafeCleanup: true });
    const original = process.env.LRNEV_WORKSPACE;
    process.env.LRNEV_WORKSPACE = workspace.path;
    try {
      const { server, client } = await connectInMemory();
      await client.callTool({ name: 'lrnev_init', arguments: { root: workspace.path, project_name: 'demo' } });
      await client.callTool({ name: 'scene_create', arguments: { name: 'user-management' } });
      const fs = new FileStorage(workspace.path);
      await fs.mkdir('.lrnev/scenes/01-user-management/specs/01-00-broken');
      await fs.write('.lrnev/scenes/01-user-management/specs/01-00-broken/tasks.md', '# Tasks\n');

      const result = await client.callTool({ name: 'spec_list', arguments: { scene: 'user-management' } });
      const payload = result.structuredContent as {
        ok: boolean;
        data: Array<{ spec: string; broken?: { error: string; path: string }; documents: { requirements: boolean } }>;
        ai_followup?: { instructions: string[]; suggested_tools?: Array<{ name: string }> };
      };

      expect(payload.ok).toBe(true);
      expect(payload.data[0]?.spec).toBe('01-00-broken');
      expect(payload.data[0]?.documents.requirements).toBe(false);
      expect(payload.data[0]?.broken?.error).toContain('requirements.md 缺失');
      expect(payload.ai_followup?.instructions.join('\n')).toContain('损坏 Spec');
      expect(payload.ai_followup?.instructions.join('\n')).toContain('lrnev_doctor');
      expect(payload.ai_followup?.suggested_tools?.map((tool) => tool.name)).toContain('lrnev_doctor');

      await client.close();
      await server.close();
    } finally {
      if (original === undefined) delete process.env.LRNEV_WORKSPACE;
      else process.env.LRNEV_WORKSPACE = original;
      await workspace.cleanup();
    }
  });

  it('协议级 adr_create/adr_list 应能创建并读取全局 ADR', async () => {
    const workspace = await tmpDir({ unsafeCleanup: true });
    const original = process.env.LRNEV_WORKSPACE;
    process.env.LRNEV_WORKSPACE = workspace.path;
    try {
      const { server, client } = await connectInMemory();
      await client.callTool({ name: 'lrnev_init', arguments: { root: workspace.path, project_name: 'demo' } });

      const created = await client.callTool({
        name: 'adr_create',
        arguments: {
          title: 'Use file storage',
          scope: 'global',
          context: 'M1 需要 AI 可直接读取。',
          decision: '使用文件系统作为事实来源。',
        },
      });
      const payload = created.structuredContent as { data: { number: string }; ai_followup?: { instructions: string[] } };
      expect(payload.data.number).toBe('0001');
      expect(payload.ai_followup?.instructions.join('\n')).toContain('ADR 0001');

      const listed = await client.callTool({ name: 'adr_list', arguments: { scope: 'global' } });
      const listPayload = (listed.structuredContent as { data?: Array<{ title: string }> } | undefined)?.data ?? [];
      expect(listPayload[0]?.title).toBe('Use file storage');

      const resource = await client.readResource({ uri: 'context://adr/1' });
      expect((resource.contents[0] as MCPTextBlock | undefined)?.text).toContain('# 0001. Use file storage');

      await client.close();
      await server.close();
    } finally {
      if (original === undefined) delete process.env.LRNEV_WORKSPACE;
      else process.env.LRNEV_WORKSPACE = original;
      await workspace.cleanup();
    }
  });

  it('协议级 assess_goal 应返回复杂度评估', async () => {
    const { server, client } = await connectInMemory();
    const result = await client.callTool({
      name: 'assess_goal',
      arguments: { goal: '调研 MCP 存储架构方案并验证性能约束' },
    });
    const payload = result.structuredContent as { data: { kind: string } };
    expect(payload.data.kind).toBe('research-program');
    await client.close();
    await server.close();
  });

  it('协议级 summarize_save 后应能按 L0 读取摘要', async () => {
    const workspace = await tmpDir({ unsafeCleanup: true });
    const original = process.env.LRNEV_WORKSPACE;
    process.env.LRNEV_WORKSPACE = workspace.path;
    try {
      const { server, client } = await connectInMemory();
      await client.callTool({ name: 'lrnev_init', arguments: { root: workspace.path, project_name: 'demo' } });
      await client.callTool({ name: 'scene_create', arguments: { name: 'user-management' } });

      await client.callTool({
        name: 'summarize_save',
        arguments: {
          uri: 'context://scene/01-user-management',
          l0: '用户管理 Scene',
          l1: '用户管理能力的概览。',
        },
      });

      const resource = await client.readResource({ uri: 'context://scene/01-user-management?level=L0' });
      expect((resource.contents[0] as MCPTextBlock | undefined)?.text).toBe('用户管理 Scene\n');
      expect(new FileStorage(workspace.path).exists('.lrnev/scenes/01-user-management/.scene.abstract.md')).toBe(true);
      expect(new FileStorage(workspace.path).exists('.lrnev/scenes/01-user-management/.abstract.md')).toBe(false);

      await client.close();
      await server.close();
    } finally {
      if (original === undefined) delete process.env.LRNEV_WORKSPACE;
      else process.env.LRNEV_WORKSPACE = original;
      await workspace.cleanup();
    }
  });

  it('协议级 context_search 应返回匹配 URI', async () => {
    const workspace = await tmpDir({ unsafeCleanup: true });
    const original = process.env.LRNEV_WORKSPACE;
    process.env.LRNEV_WORKSPACE = workspace.path;
    try {
      const { server, client } = await connectInMemory();
      await client.callTool({ name: 'lrnev_init', arguments: { root: workspace.path, project_name: 'demo' } });
      await client.callTool({ name: 'scene_create', arguments: { name: 'user-management' } });
      await client.callTool({
        name: 'summarize_save',
        arguments: {
          uri: 'context://scene/01-user-management',
          l0: '用户权限与登录',
        },
      });

      const searched = await client.callTool({
        name: 'context_search',
        arguments: { query: '权限' },
      });
      const payload = searched.structuredContent as { data: { results: Array<{ uri: string }> } };
      expect(payload.data.results[0]?.uri).toBe('context://scene/01-user-management');

      await client.close();
      await server.close();
    } finally {
      if (original === undefined) delete process.env.LRNEV_WORKSPACE;
      else process.env.LRNEV_WORKSPACE = original;
      await workspace.cleanup();
    }
  });

  it('协议级 error_record/search/promote 应能闭环工作', async () => {
    const workspace = await tmpDir({ unsafeCleanup: true });
    const original = process.env.LRNEV_WORKSPACE;
    process.env.LRNEV_WORKSPACE = workspace.path;
    try {
      const { server, client } = await connectInMemory();
      await client.callTool({ name: 'lrnev_init', arguments: { root: workspace.path, project_name: 'demo' } });

      const recorded = await client.callTool({
        name: 'error_record',
        arguments: {
          symptom: '登录失败',
          root_cause: 'token 过期',
          fix_action: '刷新 token',
          scope: 'global',
        },
      });
      const recordPayload = recorded.structuredContent as { data: { id: string; status: string } };
      expect(recordPayload.data.status).toBe('incident');

      const searched = await client.callTool({
        name: 'error_search',
        arguments: { query: 'token', scope: 'global' },
      });
      const searchPayload = (searched.structuredContent as { data?: Array<{ id: string }> } | undefined)?.data ?? [];
      expect(searchPayload[0]?.id).toBe(recordPayload.data.id);

      const promoted = await client.callTool({
        name: 'error_promote',
        arguments: {
          id: recordPayload.data.id,
          scope: 'global',
          verification: '集成测试通过',
        },
      });
      const promotePayload = promoted.structuredContent as { data: { status: string } };
      expect(promotePayload.data.status).toBe('promoted');

      await client.close();
      await server.close();
    } finally {
      if (original === undefined) delete process.env.LRNEV_WORKSPACE;
      else process.env.LRNEV_WORKSPACE = original;
      await workspace.cleanup();
    }
  });

  it('协议级 memory_save/search/forget 应能闭环工作', async () => {
    const workspace = await tmpDir({ unsafeCleanup: true });
    const original = process.env.LRNEV_WORKSPACE;
    process.env.LRNEV_WORKSPACE = workspace.path;
    try {
      const { server, client } = await connectInMemory();
      await client.callTool({ name: 'lrnev_init', arguments: { root: workspace.path, project_name: 'demo' } });

      const saved = await client.callTool({
        name: 'memory_save',
        arguments: {
          category: 'facts',
          content: '项目源码在 product/lrnev-govern。',
          source: 'workspace',
          scope: 'global',
        },
      });
      const savePayload = saved.structuredContent as { data: { id: string } };

      const searched = await client.callTool({
        name: 'memory_search',
        arguments: { query: 'lrnev-govern', category: 'facts', scope: 'global' },
      });
      const searchPayload = (searched.structuredContent as { data?: Array<{ id: string }> } | undefined)?.data ?? [];
      expect(searchPayload[0]?.id).toBe(savePayload.data.id);

      const forgotten = await client.callTool({
        name: 'memory_forget',
        arguments: { id: savePayload.data.id, category: 'facts', scope: 'global' },
      });
      const forgetPayload = forgotten.structuredContent as { data: { deleted: boolean } };
      expect(forgetPayload.data.deleted).toBe(true);

      await client.close();
      await server.close();
    } finally {
      if (original === undefined) delete process.env.LRNEV_WORKSPACE;
      else process.env.LRNEV_WORKSPACE = original;
      await workspace.cleanup();
    }
  });

  it('协议级 session_commit 应能批量保存并跳过重复', async () => {
    const workspace = await tmpDir({ unsafeCleanup: true });
    const original = process.env.LRNEV_WORKSPACE;
    process.env.LRNEV_WORKSPACE = workspace.path;
    try {
      const { server, client } = await connectInMemory();
      await client.callTool({ name: 'lrnev_init', arguments: { root: workspace.path, project_name: 'demo' } });

      const result = await client.callTool({
        name: 'session_commit',
        arguments: {
          summary: '确认注释偏好。',
          scope: 'global',
          candidates: [
            { category: 'preferences', content: '注释使用中文。', source: 'msg-1' },
            { category: 'preferences', content: '注释使用中文。', source: 'msg-2' },
          ],
        },
      });
      const payload = result.structuredContent as { data: { saved: unknown[]; skipped: unknown[] } };
      expect(payload.data.saved).toHaveLength(1);
      expect(payload.data.skipped).toHaveLength(1);

      await client.close();
      await server.close();
    } finally {
      if (original === undefined) delete process.env.LRNEV_WORKSPACE;
      else process.env.LRNEV_WORKSPACE = original;
      await workspace.cleanup();
    }
  });

  it('协议级 agent_register/heartbeat/list/unregister 应能闭环工作', async () => {
    const workspace = await tmpDir({ unsafeCleanup: true });
    const original = process.env.LRNEV_WORKSPACE;
    process.env.LRNEV_WORKSPACE = workspace.path;
    try {
      const { server, client } = await connectInMemory();
      await client.callTool({ name: 'lrnev_init', arguments: { root: workspace.path, project_name: 'demo' } });

      const registered = await client.callTool({
        name: 'agent_register',
        arguments: { agent_id: 'mcp-agent', client: 'codex' },
      });
      const registerPayload = registered.structuredContent as { data: { agent_id: string } };
      expect(registerPayload.data.agent_id).toBe('mcp-agent');

      const heartbeat = await client.callTool({
        name: 'agent_heartbeat',
        arguments: { agent_id: 'mcp-agent' },
      });
      const heartbeatPayload = heartbeat.structuredContent as { data: { status: string } };
      expect(heartbeatPayload.data.status).toBe('active');

      const listed = await client.callTool({ name: 'agent_list', arguments: {} });
      const listPayload = listed.structuredContent as { data: { agents: Array<{ agent_id: string }> } };
      expect(listPayload.data.agents.map((item) => item.agent_id)).toContain('mcp-agent');

      const unregistered = await client.callTool({
        name: 'agent_unregister',
        arguments: { agent_id: 'mcp-agent' },
      });
      const unregisterPayload = unregistered.structuredContent as { data: { agent_id: string } };
      expect(unregisterPayload.data.agent_id).toBe('mcp-agent');

      await client.close();
      await server.close();
    } finally {
      if (original === undefined) delete process.env.LRNEV_WORKSPACE;
      else process.env.LRNEV_WORKSPACE = original;
      await workspace.cleanup();
    }
  });

  it('协议级 lrnev_doctor 应返回结构化报告', async () => {
    const workspace = await tmpDir({ unsafeCleanup: true });
    const original = process.env.LRNEV_WORKSPACE;
    process.env.LRNEV_WORKSPACE = workspace.path;
    try {
      const { server, client } = await connectInMemory();
      await client.callTool({ name: 'lrnev_init', arguments: { root: workspace.path, project_name: 'demo' } });

      const result = await client.callTool({ name: 'lrnev_doctor', arguments: { verbose: true } });
      // M2: lrnev_doctor 使用渲染器，返回格式化文本
      const text = contentText(result.content);
      expect(text).toContain('# lrnev 工作区诊断');
      expect(text).toContain('检查时间');

      await new FileStorage(workspace.path).write('.lrnev/scenes/00-default/specs/legacy/tasks.md', [
        '# Legacy Tasks',
        '',
        '## 阶段 1',
        '',
        '- TODO',
        '',
      ].join('\n'));
      const migrated = await client.callTool({ name: 'lrnev_doctor', arguments: { migrate_todos: true } });
      // M2: migrate_todos 仍返回 structuredContent（非渲染工具）
      const migratedPayload = (migrated.structuredContent as { data: { ok: boolean; replacements: number; changed_files: number } }).data;
      expect(migratedPayload.ok).toBe(true);
      expect(migratedPayload.replacements).toBeGreaterThan(0);
      expect(migratedPayload.changed_files).toBeGreaterThan(0);

      const fs = new FileStorage(workspace.path);
      await fs.write('.lrnev/.overview.md', 'legacy overview\n');
      await fs.write('.lrnev/.PROJECT.overview.md', 'new overview\n');
      const migratedSummaries = await client.callTool({ name: 'lrnev_doctor', arguments: { migrate_summaries: true } });
      const migratedSummariesPayload = (migratedSummaries.structuredContent as { data: { ok: boolean; removed_count: number } }).data;
      expect(migratedSummariesPayload.ok).toBe(true);
      expect(migratedSummariesPayload.removed_count).toBe(1);
      expect(fs.exists('.lrnev/.overview.md')).toBe(false);
      expect(fs.exists('.lrnev/.PROJECT.overview.md')).toBe(true);

      await client.close();
      await server.close();
    } finally {
      if (original === undefined) delete process.env.LRNEV_WORKSPACE;
      else process.env.LRNEV_WORKSPACE = original;
      await workspace.cleanup();
    }
  });

  it('协议级 lrnev_hook_list 应返回当前 hook 配置', async () => {
    const { server, client } = await connectInMemory();
    const result = await client.callTool({ name: 'lrnev_hook_list', arguments: {} });
    const text = contentText(result.content);

    // M2: lrnev_hook_list 使用渲染器，返回格式化文本而非 JSON
    // 验证基本内容（空 hook 列表场景）
    expect(text).toContain('Hook');
    await client.close();
    await server.close();
  });

  it('协议级 hook trigger/enable/disable 应能闭环工作', async () => {
    const workspace = await tmpDir({ unsafeCleanup: true });
    const original = process.env.LRNEV_WORKSPACE;
    process.env.LRNEV_WORKSPACE = workspace.path;
    try {
      const { server, client } = await connectInMemory();
      await client.callTool({ name: 'lrnev_init', arguments: { root: workspace.path, project_name: 'demo' } });
      const fs = new FileStorage(workspace.path);
      await fs.writeJson('.lrnev/config/hooks.json', [{
        name: 'mcp-hook',
        event: 'task.create',
        command: ['node', '-e', 'console.log(process.env.LRNEV_EVENT)'],
        mode: 'sync',
      }]);

      const disabled = await client.callTool({ name: 'lrnev_hook_disable', arguments: { name: 'mcp-hook' } });
      const disabledPayload = disabled.structuredContent as { data: { enabled: boolean } };
      expect(disabledPayload.data.enabled).toBe(false);

      await client.callTool({ name: 'lrnev_hook_enable', arguments: { name: 'mcp-hook' } });
      const triggered = await client.callTool({
        name: 'lrnev_hook_trigger',
        arguments: { event: 'task.create', payload: { task_id: 'T-001' } },
      });
      const triggeredPayload = triggered.structuredContent as { data: { matched: number } };
      expect(triggeredPayload.data.matched).toBe(1);
      expect((await fs.read('.lrnev/state/hook-log.jsonl'))).toContain('mcp-hook');
      const tailed = await client.callTool({ name: 'lrnev_hook_tail_log', arguments: { lines: 1 } });
      const tailedPayload = tailed.structuredContent as { data: Array<{ hook: string }> };
      expect(tailedPayload.data).toEqual([expect.objectContaining({ hook: 'mcp-hook' })]);

      await client.close();
      await server.close();
    } finally {
      if (original === undefined) delete process.env.LRNEV_WORKSPACE;
      else process.env.LRNEV_WORKSPACE = original;
      await workspace.cleanup();
    }
  });
});

async function writeReadyRequirements(root: string, sceneId: string, specId: string): Promise<void> {
  const fs = new FileStorage(root);
  await fs.write(`.lrnev/scenes/${sceneId}/specs/${specId}/requirements.md`, [
    '---',
    `spec: '${specId}'`,
    `scene: '${sceneId}'`,
    'status: draft',
    'priority: P1',
    "created: '2026-05-28'",
    '---',
    '',
    '# User Login - 需求',
    '',
    '## L0 摘要',
    '',
    'Login requirements are complete enough for implementation.',
    '',
    '## L1 概览',
    '',
    '### 目标',
    '',
    'Users can sign in.',
    '',
    '### 范围',
    '',
    '- Password login.',
    '',
    '## L2 详情',
    '',
    '### 详细需求',
    '',
    '#### F-01 Login',
    '',
    '- Validate credentials.',
    '',
    '### 验收标准',
    '',
    '- [x] Login works for valid credentials.',
    '',
  ].join('\n'));

  // I-4 起 completion gate 也硬拦 design.md 的 FILL；补一份无 FILL 的 design。
  await fs.write(`.lrnev/scenes/${sceneId}/specs/${specId}/design.md`, [
    '---',
    `spec: '${specId}'`,
    `scene: '${sceneId}'`,
    "created: '2026-05-28'",
    '---',
    '',
    '# User Login - 设计',
    '',
    '## L0 摘要',
    '',
    'Login design complete, no fill.',
    '',
    '## L2 详情',
    '',
    '### 模块详细设计',
    '',
    '#### D-01 Login flow',
    '',
    'Validate credentials and issue session.',
  ].join('\n'));
}

  it('F-09: 已有 Spec A 后仍可创建 Spec B（执行层非阻断）', async () => {
    const workspace = await tmpDir({ unsafeCleanup: true });
    const original = process.env.LRNEV_WORKSPACE;
    process.env.LRNEV_WORKSPACE = workspace.path;
    try {
      const { server, client } = await connectInMemory();
      await client.callTool({ name: 'lrnev_init', arguments: { root: workspace.path, project_name: 'demo' } });
      await client.callTool({ name: 'scene_create', arguments: { name: 'test-scene' } });

      // 创建 Spec A
      const resultA = await client.callTool({
        name: 'spec_create',
        arguments: { scene: 'test-scene', name: 'feature-a' },
      });
      const payloadA = resultA.structuredContent as {
        ok: boolean;
        data: { spec: string };
      };
      expect(payloadA.ok).toBe(true);
      expect(payloadA.data.spec).toContain('feature-a');

      // 创建 Spec B（应成功，不被强制复用）
      const resultB = await client.callTool({
        name: 'spec_create',
        arguments: { scene: 'test-scene', name: 'feature-b' },
      });
      const payloadB = resultB.structuredContent as {
        ok: boolean;
        data: { spec: string };
        ai_followup?: { instructions: string[] };
      };

      // 验证：B 成功创建
      expect(payloadB.ok).toBe(true);
      expect(payloadB.data.spec).toContain('feature-b');

      // 验证：followup 不含强制措辞
      const followupText = payloadB.ai_followup?.instructions.join(' ') ?? '';
      expect(followupText).not.toContain('不应该新建');
      expect(followupText).not.toContain('必须复用');

      // 验证：followup 包含【重要】（不得擅自撤销）
      expect(followupText).toContain('【重要】');
      expect(followupText).toContain('不得擅自撤销');

      // 反向测试：验证两个 Spec 都被正确创建（执行层不阻断）
      const specListResult = await client.callTool({
        name: 'spec_list',
        arguments: { scene: 'test-scene' },
      });
      const specListText = contentText(specListResult.content);

      // 验证：两个 spec 都存在（简化检查，不依赖具体返回格式）
      expect(specListText).toContain(payloadA.data.spec);
      expect(specListText).toContain(payloadB.data.spec);

      await client.close();
      await server.close();
    } finally {
      if (original === undefined) delete process.env.LRNEV_WORKSPACE;
      else process.env.LRNEV_WORKSPACE = original;
      await workspace.cleanup();
    }
  });

async function connectInMemory(): Promise<{
  server: ReturnType<typeof createMcpServer>;
  client: Client;
}> {
  const server = createMcpServer();
  const client = new Client({ name: 'lrnev-test-client', version: '0.0.1' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return { server, client };
}
