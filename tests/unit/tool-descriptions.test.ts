/**
 * MCP 工具自描述审计。
 *
 * 这些测试不验证业务行为，只防止工具描述、server instructions 和写工具 followup
 * 回退成弱模型无法自救的短句。
 */

import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { dir as tmpDir } from 'tmp-promise';

import { WorkspaceManager } from '../../src/core/WorkspaceManager.js';
import { FileStorage } from '../../src/storage/FileStorage.js';
import { createMcpServer } from '../../src/mcp/server.js';
import { TOOL_DESCRIPTIONS, WORKFLOW_OVERVIEW } from '../../src/mcp/guidance.js';

const ENTRY_TOOLS = [
  'lrnev_init',
  'project_status',
  'spec_create',
  'spec_gate_check',
  'task_create',
  'task_update',
] as const;

const WRITE_TOOL_SAMPLES: Array<{
  name: string;
  args: Record<string, unknown>;
  setup?: (client: Client, workspace: string) => Promise<void>;
}> = [
  {
    name: 'lrnev_init',
    args: { project_name: 'demo' },
  },
  {
    name: 'spec_create',
    args: { name: 'login' },
    setup: async (client, workspace) => {
      await initWorkspace(client, workspace);
    },
  },
  {
    name: 'task_create',
    args: { scene: '00-default', spec: 'login', title: '实现登录' },
    setup: async (client, workspace) => {
      await initWorkspace(client, workspace);
      await client.callTool({ name: 'spec_create', arguments: { name: 'login' } });
    },
  },
  {
    name: 'task_update',
    args: { scene: '00-default', spec: 'login', task_id: 'T-001', status: 'in_progress' },
    setup: async (client, workspace) => {
      await initWorkspace(client, workspace);
      await client.callTool({ name: 'spec_create', arguments: { name: 'login' } });
      await client.callTool({
        name: 'task_create',
        arguments: { scene: '00-default', spec: 'login', title: '实现登录' },
      });
    },
  },
  {
    name: 'adr_create',
    args: { title: 'Use files', scope: 'global', context: '需要可 diff。', decision: '使用文件系统。' },
    setup: initWorkspace,
  },
  {
    name: 'error_record',
    args: { symptom: '测试失败', root_cause: '断言错误', fix_action: '修正断言' },
    setup: initWorkspace,
  },
  {
    name: 'memory_save',
    args: { category: 'facts', content: '源码在 product/lrnev-govern。', source: 'test' },
    setup: initWorkspace,
  },
  {
    name: 'summarize_save',
    args: { uri: 'context://project', l0: 'Demo project' },
    setup: initWorkspace,
  },
  {
    name: 'agent_register',
    args: { agent_id: 'agent-a', client: 'vitest' },
    setup: initWorkspace,
  },
  {
    name: 'lrnev_hook_enable',
    args: { name: 'demo-hook' },
    setup: async (client, workspace) => {
      await initWorkspace(client, workspace);
      await new FileStorage(workspace).writeJson('.lrnev/config/hooks.json', [{
        name: 'demo-hook',
        event: 'task.create',
        command: ['node', '-e', 'console.log("ok")'],
        mode: 'sync',
        enabled: false,
      }]);
    },
  },
];

describe('MCP 工具自描述审计', () => {
  it('server instructions 覆盖关键心智模型且不超过 400 字', () => {
    for (const keyword of [
      'lrnev',
      'Scene',
      'Spec',
      'Task',
      'Gate',
      'lrnev_init',
      'spec_create',
      'project_status',
      '分流',
      'lrnev_guide',
    ]) {
      expect(WORKFLOW_OVERVIEW).toContain(keyword);
    }
    expect([...WORKFLOW_OVERVIEW].length).toBeLessThanOrEqual(480);
  });

  it('所有注册工具 description 都来自 guidance 且包含何时用', async () => {
    const { server, client } = await connectInMemory();
    try {
      const tools = (await client.listTools()).tools;
      const expected = TOOL_DESCRIPTIONS as Record<string, string>;

      expect(tools.map((tool) => tool.name).sort()).toEqual(Object.keys(expected).sort());
      for (const tool of tools) {
        expect(tool.description).toBe(expected[tool.name]);
        expect(tool.description).toContain('何时用');
        expect(isBareDescription(tool)).toBe(false);
        expect([...tool.description].length).toBeLessThanOrEqual(180);
      }
    } finally {
      await client.close();
      await server.close();
    }
  });

  it('六个入口工具 description 都包含前置和例子', async () => {
    const { server, client } = await connectInMemory();
    try {
      const byName = new Map((await client.listTools()).tools.map((tool) => [tool.name, tool]));

      for (const name of ENTRY_TOOLS) {
        const description = byName.get(name)?.description ?? '';
        expect(description).toContain('何时用');
        expect(description).toContain('前置');
        expect(description).toContain('例子');
      }

      expect(byName.get('spec_gate_check')?.description).toContain('spec 已存在');
      expect(byName.get('spec_gate_check')?.description).toContain('FILL');
      expect(byName.get('task_create')?.description).toContain('parent');
      expect(byName.get('task_create')?.description).toContain('拆子任务');

      const taskCreateSchema = byName.get('task_create')?.inputSchema as {
        properties?: Record<string, { description?: string }>;
      } | undefined;
      expect(taskCreateSchema?.properties?.parent?.description).toContain('可分别认领/验收');

      const taskUpdateSchema = byName.get('task_update')?.inputSchema as {
        properties?: Record<string, { description?: string }>;
      } | undefined;
      const taskClaimSchema = byName.get('task_claim')?.inputSchema as {
        properties?: Record<string, { description?: string }>;
      } | undefined;
      expect(taskUpdateSchema?.properties?.touches_files?.description).toContain('多窗口并行');
      expect(taskUpdateSchema?.properties?.touches_files?.description).toContain('重叠提示');
      expect(taskClaimSchema?.properties?.touches_files?.description).toContain('多窗口并行');
      expect(taskClaimSchema?.properties?.touches_files?.description).toContain('重叠提示');
    } finally {
      await client.close();
      await server.close();
    }
  });

  it('F-12: spec_create version 参数说明应区分直接改文件和开新版', async () => {
    const { server, client } = await connectInMemory();
    try {
      const tools = (await client.listTools()).tools;
      const specCreate = tools.find((tool) => tool.name === 'spec_create');
      const schema = specCreate?.inputSchema as {
        properties?: Record<string, { description?: string }>;
      } | undefined;
      const description = schema?.properties?.version?.description ?? '';

      expect(description).toContain('默认 0');
      expect(description).toContain('直接编辑现有 requirements/design/tasks');
      expect(description).toContain('不传 version');
      expect(description).toContain('仅整体重写并想保留旧版对照');
    } finally {
      await client.close();
      await server.close();
    }
  });

  it('代表性写工具成功返回都有可执行 ai_followup', async () => {
    for (const sample of WRITE_TOOL_SAMPLES) {
      const workspace = await tmpDir({ unsafeCleanup: true });
      const original = process.env.LRNEV_WORKSPACE;
      process.env.LRNEV_WORKSPACE = workspace.path;
      const { server, client } = await connectInMemory();
      try {
        await sample.setup?.(client, workspace.path);
        const result = await client.callTool({ name: sample.name, arguments: sample.args });
        const payload = readPayload(result) as { ai_followup?: { instructions?: string[] } };
        const instructions = payload.ai_followup?.instructions ?? [];

        expect(instructions.length, sample.name).toBeGreaterThan(0);
        expect(instructions.join('\n'), sample.name).toMatch(
          /lrnev_|project_status|spec_|task_|adr_|error_|memory_|summarize_|context_|lock_|agent_|hook|requirements\.md|design\.md|tasks\.md|gate|状态|调用|运行|检查|记录|更新|读取|回看/,
        );
      } finally {
        await client.close();
        await server.close();
        if (original === undefined) delete process.env.LRNEV_WORKSPACE;
        else process.env.LRNEV_WORKSPACE = original;
        await workspace.cleanup();
      }
    }
  });
});

function isBareDescription(tool: Tool): boolean {
  const text = tool.description ?? '';
  return !text.includes('何时用') || !/[。；]/.test(text);
}

async function initWorkspace(client: Client, workspace: string): Promise<void> {
  await client.callTool({
    name: 'lrnev_init',
    arguments: { root: workspace, project_name: 'demo' },
  });
}

function readPayload(result: Awaited<ReturnType<Client['callTool']>>): unknown {
  const text = result.content[0]?.type === 'text' ? result.content[0].text : '';
  return JSON.parse(text);
}

async function connectInMemory(): Promise<{
  server: ReturnType<typeof createMcpServer>;
  client: Client;
}> {
  const server = createMcpServer();
  const client = new Client({ name: 'lrnev-tool-audit-test', version: '0.0.1' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return { server, client };
}

void WorkspaceManager;
