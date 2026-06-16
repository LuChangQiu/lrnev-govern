/**
 * CLI 与 MCP 数据互通测试。
 *
 * 同一份 .lrnev 数据：MCP 写入 CLI 读取，CLI 写入 MCP 读取。
 */

import { describe, it, expect, afterEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { dir as tmpDir, type DirectoryResult } from 'tmp-promise';

import { createMcpServer } from '../../src/mcp/server.js';
import { buildCli } from '../../src/cli/index.js';

describe('CLI / MCP interoperability', () => {
  let workspace: DirectoryResult | null = null;

  afterEach(async () => {
    if (workspace) {
      await workspace.cleanup();
      workspace = null;
    }
  });

  it('MCP 创建的数据应能被 CLI 读取', async () => {
    workspace = await tmpDir({ unsafeCleanup: true });
    const { server, client, restoreEnv } = await connect(workspace.path);
    try {
      await client.callTool({ name: 'lrnev_init', arguments: { root: workspace.path, project_name: 'demo' } });
      await client.callTool({ name: 'scene_create', arguments: { name: 'user-management' } });

      const scenes = await runCli(workspace.path, ['scene', 'list']);
      expect(scenes.find((scene: { id: string }) => scene.id === '01-user-management')).toBeDefined();
    } finally {
      await client.close();
      await server.close();
      restoreEnv();
    }
  });

  it('CLI 创建的数据应能被 MCP 读取', async () => {
    workspace = await tmpDir({ unsafeCleanup: true });
    const { server, client, restoreEnv } = await connect(workspace.path);
    try {
      await runCli(workspace.path, ['init', '--project-name', 'demo']);
      await runCli(workspace.path, ['scene', 'create', 'user-management']);
      await runCli(workspace.path, ['spec', 'create', '--scene', 'user-management', 'user-login']);

      const listed = await client.callTool({
        name: 'spec_list',
        arguments: { scene: 'user-management' },
      });
      const text = listed.content[0]?.type === 'text' ? listed.content[0].text : '';
      const specs = JSON.parse(text) as Array<{ spec: string }>;
      expect(specs[0]?.spec).toBe('01-00-user-login');
    } finally {
      await client.close();
      await server.close();
      restoreEnv();
    }
  });

  it('F-03: task update(in_progress) 的 anchor_context 在 CLI 与 MCP 对等', async () => {
    workspace = await tmpDir({ unsafeCleanup: true });
    const { server, client, restoreEnv } = await connect(workspace.path);
    try {
      await runCli(workspace.path, ['init', '--project-name', 'demo']);
      await runCli(workspace.path, ['scene', 'create', 'user-management']);
      await runCli(workspace.path, ['spec', 'create', '--scene', 'user-management', 'user-login']);
      await runCli(workspace.path, ['task', 'create', '任务A', '--scene', 'user-management', '--spec', 'user-login', '--validates', 'F-01']);
      await runCli(workspace.path, ['task', 'create', '任务B', '--scene', 'user-management', '--spec', 'user-login', '--validates', 'F-01']);

      const cliUpd = await runCli(workspace.path, ['task', 'update', 'T-001', '--scene', 'user-management', '--spec', 'user-login', '--status', 'in_progress']);
      const mcpRes = await client.callTool({
        name: 'task_update',
        arguments: { scene: 'user-management', spec: 'user-login', task_id: 'T-002', status: 'in_progress' },
      });
      const mcpText = mcpRes.content[0]?.type === 'text' ? mcpRes.content[0].text : '';
      const mcpUpd = JSON.parse(mcpText) as { anchor_context?: Array<{ anchor: string; source: string }> };

      expect(cliUpd.anchor_context?.[0]?.anchor).toBe('F-01');
      expect(mcpUpd.anchor_context?.[0]?.anchor).toBe('F-01');
      expect(cliUpd.anchor_context?.[0]?.source).toBe('requirements');
      expect(cliUpd.anchor_context?.[0]?.source).toBe(mcpUpd.anchor_context?.[0]?.source);
    } finally {
      await client.close();
      await server.close();
      restoreEnv();
    }
  });

  it('F-03: task claim 的 anchor_context 在 CLI 与 MCP 对等', async () => {
    workspace = await tmpDir({ unsafeCleanup: true });
    const { server, client, restoreEnv } = await connect(workspace.path);
    try {
      await runCli(workspace.path, ['init', '--project-name', 'demo']);
      await runCli(workspace.path, ['scene', 'create', 'user-management']);
      await runCli(workspace.path, ['spec', 'create', '--scene', 'user-management', 'user-login']);
      await runCli(workspace.path, ['task', 'create', '任务A', '--scene', 'user-management', '--spec', 'user-login', '--validates', 'F-01']);
      await runCli(workspace.path, ['task', 'create', '任务B', '--scene', 'user-management', '--spec', 'user-login', '--validates', 'F-01']);

      const cliClaim = await runCli(workspace.path, ['task', 'claim', 'T-001', '--scene', 'user-management', '--spec', 'user-login', '--agent-id', 'agent-cli']);
      const mcpClaimRaw = await client.callTool({
        name: 'task_claim',
        arguments: { scene: 'user-management', spec: 'user-login', task: 'T-002', agent_id: 'agent-mcp' },
      });
      const mcpClaim = JSON.parse(mcpClaimRaw.content[0]?.type === 'text' ? mcpClaimRaw.content[0].text : '{}');

      expect(cliClaim.anchor_context?.[0]?.anchor).toBe('F-01');
      expect(mcpClaim.anchor_context?.[0]?.anchor).toBe('F-01');
      expect(cliClaim.anchor_context?.[0]?.source).toBe('requirements');
      expect(cliClaim.anchor_context?.[0]?.source).toBe(mcpClaim.anchor_context?.[0]?.source);
    } finally {
      await client.close();
      await server.close();
      restoreEnv();
    }
  });
});

async function connect(workspacePath: string): Promise<{
  server: ReturnType<typeof createMcpServer>;
  client: Client;
  restoreEnv: () => void;
}> {
  const original = process.env.LRNEV_WORKSPACE;
  process.env.LRNEV_WORKSPACE = workspacePath;
  const server = createMcpServer();
  const client = new Client({ name: 'lrnev-interoperability-test', version: '0.0.1' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return {
    server,
    client,
    restoreEnv: () => {
      if (original === undefined) delete process.env.LRNEV_WORKSPACE;
      else process.env.LRNEV_WORKSPACE = original;
    },
  };
}

async function runCli(workspacePath: string, args: string[]): Promise<any> {
  let out = '';
  const program = buildCli({ writeOut: (text) => { out += text; } });
  await program.parseAsync(['node', 'lrnev', '--workspace', workspacePath, '--json', ...args]);
  return JSON.parse(out.trim().split(/\n(?=\{|\[)/).at(-1)!);
}
