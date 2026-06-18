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
import { FileStorage } from '../../src/storage/FileStorage.js';

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

  it('F-03: task update 的 summary_context 在 CLI 与 MCP 对等', async () => {
    workspace = await tmpDir({ unsafeCleanup: true });
    const { server, client, restoreEnv } = await connect(workspace.path);
    try {
      await runCli(workspace.path, ['init', '--project-name', 'demo']);
      await runCli(workspace.path, ['scene', 'create', 'user-management']);
      await runCli(workspace.path, ['spec', 'create', '--scene', 'user-management', 'user-login']);
      // 写 sidecar 摘要：task 无 validates 时回填 summary_context 的来源
      const fs = new FileStorage(workspace.path);
      await fs.write('.lrnev/scenes/01-user-management/specs/01-00-user-login/.requirements.abstract.md', '打通登录与会话管理。\n');
      await runCli(workspace.path, ['task', 'create', '任务A', '--scene', 'user-management', '--spec', 'user-login']);
      await runCli(workspace.path, ['task', 'create', '任务B', '--scene', 'user-management', '--spec', 'user-login']);

      const cliUpd = await runCli(workspace.path, ['task', 'update', 'T-001', '--scene', 'user-management', '--spec', 'user-login', '--status', 'in_progress']);
      const mcpRaw = await client.callTool({
        name: 'task_update',
        arguments: { scene: 'user-management', spec: 'user-login', task_id: 'T-002', status: 'in_progress' },
      });
      const mcpUpd = JSON.parse(mcpRaw.content[0]?.type === 'text' ? mcpRaw.content[0].text : '{}');

      expect(cliUpd.summary_context?.source).toBe('sidecar');
      expect(cliUpd.summary_context?.l0).toBe('打通登录与会话管理。');
      expect(cliUpd.summary_context).toEqual(mcpUpd.summary_context);
    } finally {
      await client.close();
      await server.close();
      restoreEnv();
    }
  });

  it('F-01/F-02: governance_map 与 context_search anchor 在 CLI 与 MCP 对等', async () => {
    workspace = await tmpDir({ unsafeCleanup: true });
    const { server, client, restoreEnv } = await connect(workspace.path);
    try {
      await runCli(workspace.path, ['init', '--project-name', 'demo']);
      await runCli(workspace.path, ['scene', 'create', 'user-management']);
      await runCli(workspace.path, ['spec', 'create', '--scene', 'user-management', 'login']);
      const fs = new FileStorage(workspace.path);
      await fs.write(
        '.lrnev/scenes/01-user-management/specs/01-00-login/requirements.md',
        '# 登录\n\n## L2 详情\n\n#### F-01 记住我功能\n勾选独角兽关键词后保持会话。\n',
      );

      // governance_map：CLI map 与 MCP governance_map 内容对等（不比 generated_at）
      const cliMap = await runCli(workspace.path, ['map']);
      const mcpMapRaw = await client.callTool({ name: 'governance_map', arguments: {} });
      const mcpMap = JSON.parse(mcpMapRaw.content[0]?.type === 'text' ? mcpMapRaw.content[0].text : '{}');
      expect(cliMap.data.scenes).toEqual(mcpMap.data.scenes);

      // context_search 锚点：CLI search 与 MCP context_search 命中同一 anchor
      const cliSearch = await runCli(workspace.path, ['search', '独角兽']);
      const mcpSearchRaw = await client.callTool({ name: 'context_search', arguments: { query: '独角兽' } });
      const mcpSearch = JSON.parse(mcpSearchRaw.content[0]?.type === 'text' ? mcpSearchRaw.content[0].text : '{}');
      const cliAnchor = cliSearch.data.results.find((r: { path: string }) => r.path.includes('01-00-login'));
      const mcpAnchor = mcpSearch.data.results.find((r: { path: string }) => r.path.includes('01-00-login'));
      expect(cliAnchor?.anchor).toBe('F-01');
      expect(mcpAnchor?.anchor).toBe('F-01');
    } finally {
      await client.close();
      await server.close();
      restoreEnv();
    }
  });

  it('lrnev_report：CLI report --json 与 MCP lrnev_report 数据口径一致', async () => {
    workspace = await tmpDir({ unsafeCleanup: true });
    const { server, client, restoreEnv } = await connect(workspace.path);
    try {
      await runCli(workspace.path, ['init', '--project-name', 'demo']);
      await runCli(workspace.path, ['spec', 'create', 'login']);
      // 造一个"做完没收口"的 spec（task 全完、status=draft）
      const fs = new FileStorage(workspace.path);
      const dir = '.lrnev/scenes/00-default/specs/01-00-login';
      await fs.write(`${dir}/requirements.md`, [
        '---', "spec: '01-00-login'", "scene: '00-default'", 'status: draft', "created: '2026-06-01'", '---',
        '', '# 需求', '', '## L2 详情', '', '#### F-01 登录', '校验。', '',
      ].join('\n'));
      await fs.write(`${dir}/tasks.md`, [
        '---', "spec: '01-00-login'", "scene: '00-default'", '---', '', '# 任务', '', '## 阶段 1', '',
        '### T-001 做登录 <!-- lrnev-task: status=completed, created=2026-06-01T00:00:00.000Z, validates=F-01 -->',
        '',
      ].join('\n'));

      const cli = await runCli(workspace.path, ['report']);
      const mcpRaw = await client.callTool({ name: 'lrnev_report', arguments: {} });
      const mcp = JSON.parse(mcpRaw.content[0]?.type === 'text' ? mcpRaw.content[0].text : '{}');

      // 不比 generated_at；链路与覆盖率数据应深相等
      expect(cli.data.chain).toEqual(mcp.data.chain);
      expect(cli.data.coverage).toEqual(mcp.data.coverage);
      expect(cli.data.headline).toBe(mcp.data.headline);
      expect(cli.data.chain.unclosed[0]?.spec).toBe('01-00-login');

      // scene 参数对等
      const cliScene = await runCli(workspace.path, ['report', '--scene', '00-default']);
      const mcpSceneRaw = await client.callTool({ name: 'lrnev_report', arguments: { scene: '00-default' } });
      const mcpScene = JSON.parse(mcpSceneRaw.content[0]?.type === 'text' ? mcpSceneRaw.content[0].text : '{}');
      expect(cliScene.data.scope).toBe('00-default');
      expect(cliScene.data.chain).toEqual(mcpScene.data.chain);
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
