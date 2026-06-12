/**
 * MCP 真实 stdio 进程生命周期 e2e。
 *
 * 与 tests/unit/server-lifecycle.test.ts（直接驱动 createAgentLifecycle，不起进程）
 * 和 tests/integration/cli-mcp-interoperability.test.ts（InMemoryTransport，进程内）不同：
 * 本测试用 StdioClientTransport **真实拉起 bin/lrnev-mcp.mjs 子进程**，每个 Client 是一个
 * 真实长连接会话。这是套件里唯一覆盖“连接自动注册 / 并发存活 / touches 重叠 /
 * 优雅断开自动注销并释放 claim”这条真 stdio 生命周期的测试。
 *
 * 依赖 dist（子进程入口 import ../dist）；dist 缺失时跳过并提示先 build。
 */

import { describe, it, expect, afterEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { dir as tmpDir, type DirectoryResult } from 'tmp-promise';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const GOVERN_ROOT = resolve(here, '../..');
const MCP_ENTRY = resolve(GOVERN_ROOT, 'bin/lrnev-mcp.mjs');
const DIST_SERVER = resolve(GOVERN_ROOT, 'dist/mcp/server.js');
const distReady = existsSync(DIST_SERVER);

// 顶层（模块加载即执行）打印醒目横幅：即使整组用例被 it.skipIf 跳过、beforeAll 不运行，
// 这条也一定会出现。避免有人把“全绿/跳过”误读成“真 stdio 生命周期已验证”。
if (!distReady) {
  const line = '!'.repeat(72);
  console.warn(
    `\n${line}\n` +
    `!!  MCP stdio 生命周期 e2e 已跳过（共 5 条用例，0 条真正执行）\n` +
    `!!  原因：未找到 dist —— ${DIST_SERVER}\n` +
    `!!  这 5 条是套件里唯一覆盖“真 stdio 子进程注册/断开/claim 释放”的测试，\n` +
    `!!  跳过 = 该链路本次未被验证，请勿据此判定通过。\n` +
    `!!  修复：先运行  npm run build  再跑测试（或直接 npm test，prepublish 会先 build）。\n` +
    `${line}\n`,
  );
}

interface Session {
  client: Client;
  close: () => Promise<void>;
}

function parseToolResult(res: unknown): any {
  const text = (res as { content?: Array<{ type: string; text?: string }> })?.content?.[0]?.text;
  try {
    return text ? JSON.parse(text) : text;
  } catch {
    return text;
  }
}

describe('MCP stdio 进程生命周期 e2e', () => {
  let workspace: DirectoryResult | null = null;
  const open: Session[] = [];

  afterEach(async () => {
    while (open.length > 0) {
      const sess = open.pop();
      try {
        await sess?.close();
      } catch {
        // 忽略：测试用例可能已主动 close。
      }
    }
    if (workspace) {
      await workspace.cleanup();
      workspace = null;
    }
  });

  async function newSession(clientName: string): Promise<Session> {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [MCP_ENTRY],
      env: { ...process.env, LRNEV_WORKSPACE: workspace!.path },
      stderr: 'pipe',
    });
    const client = new Client({ name: clientName, version: '1.0.0' }, { capabilities: {} });
    await client.connect(transport);
    // register 在 onInitialized 异步钩子里、connect 返回后才落地，给它时间。
    await new Promise((r) => setTimeout(r, 600));
    const sess: Session = { client, close: () => client.close() };
    open.push(sess);
    return sess;
  }

  async function callTool(sess: Session, name: string, args: Record<string, unknown> = {}): Promise<any> {
    return parseToolResult(await sess.client.callTool({ name, arguments: args }));
  }

  async function listAgents(sess: Session): Promise<Array<{ agent_id: string; status: string; client?: string }>> {
    const res = await callTool(sess, 'agent_list');
    return res?.data?.agents ?? [];
  }

  async function initWorkspaceWithTask(sess: Session): Promise<{ scene: string; spec: string; taskA: string; taskB: string }> {
    await callTool(sess, 'lrnev_init', { root: workspace!.path, project_name: 'mcp-e2e' });
    await callTool(sess, 'scene_create', { name: 'collab' });
    const specRes = await callTool(sess, 'spec_create', { scene: 'collab', name: 'shared-edit' });
    const spec = specRes?.data?.spec ?? specRes?.spec;
    const scene = specRes?.data?.scene ?? 'collab';
    const a = await callTool(sess, 'task_create', { scene, spec, title: '任务A' });
    const b = await callTool(sess, 'task_create', { scene, spec, title: '任务B' });
    return { scene, spec, taskA: a?.data?.id ?? a?.id, taskB: b?.data?.id ?? b?.id };
  }

  it.skipIf(!distReady)('连接初始化后自动注册当前会话 agent 并判 active', async () => {
    workspace = await tmpDir({ unsafeCleanup: true });
    const s1 = await newSession('claude-code');
    await callTool(s1, 'lrnev_init', { root: workspace.path, project_name: 'mcp-e2e' });

    const agents = await listAgents(s1);
    const active = agents.find((a) => a.status === 'active');
    expect(active).toBeDefined();
    expect(active?.client).toBe('claude-code');
  });

  it.skipIf(!distReady)('两个并发 MCP 连接都判 active', async () => {
    workspace = await tmpDir({ unsafeCleanup: true });
    const s1 = await newSession('claude-code');
    await callTool(s1, 'lrnev_init', { root: workspace.path, project_name: 'mcp-e2e' });
    await newSession('cursor');

    const agents = await listAgents(s1);
    const activeAgents = agents.filter((a) => a.status === 'active');
    expect(activeAgents.length).toBeGreaterThanOrEqual(2);
    expect(activeAgents.map((a) => a.client).sort()).toEqual(['claude-code', 'cursor']);
  });

  it.skipIf(!distReady)('两 active 会话声明同一 touches_files 时触发 overlap 提示', async () => {
    workspace = await tmpDir({ unsafeCleanup: true });
    const s1 = await newSession('claude-code');
    const { scene, spec, taskA, taskB } = await initWorkspaceWithTask(s1);
    const s2 = await newSession('cursor');

    const a1 = (await listAgents(s1)).find((a) => a.client === 'claude-code')!.agent_id;
    const a2 = (await listAgents(s2)).find((a) => a.client === 'cursor')!.agent_id;

    await callTool(s1, 'task_claim', { scene, spec, task: taskA, agent_id: a1, touches_files: ['src/incremental.ts'] });
    const claimB = await callTool(s2, 'task_claim', { scene, spec, task: taskB, agent_id: a2, touches_files: ['src/incremental.ts'] });

    expect(claimB?.data?.overlaps?.length ?? 0).toBeGreaterThan(0);
    expect(claimB.data.overlaps[0].task).toBe(taskA);
    expect(JSON.stringify(claimB?.ai_followup?.instructions ?? [])).toMatch(/重叠/);
  });

  it.skipIf(!distReady)('优雅断开连接后该会话 agent 自动注销、其 claim 自动释放', async () => {
    workspace = await tmpDir({ unsafeCleanup: true });
    const s1 = await newSession('claude-code');
    const { scene, spec, taskA } = await initWorkspaceWithTask(s1);
    const s2 = await newSession('cursor');

    const a1 = (await listAgents(s1)).find((a) => a.client === 'claude-code')!.agent_id;
    const a2 = (await listAgents(s2)).find((a) => a.client === 'cursor')!.agent_id;

    await callTool(s1, 'task_claim', { scene, spec, task: taskA, agent_id: a1, touches_files: ['src/x.ts'] });

    // 优雅关闭 S1 → 触发 server cleanup（stdin end/close）
    await s1.close();
    // 从 open 列表移除已关闭的 s1，避免 afterEach 重复 close
    const idx = open.indexOf(s1);
    if (idx >= 0) open.splice(idx, 1);
    await new Promise((r) => setTimeout(r, 600));

    // S1 的 agent 应已注销
    const agentsAfter = await listAgents(s2);
    expect(agentsAfter.some((a) => a.agent_id === a1)).toBe(false);

    // S1 的 claim 应已释放：S2 接手无 conflict
    const reclaim = await callTool(s2, 'task_claim', { scene, spec, task: taskA, agent_id: a2 });
    expect(reclaim?.data?.conflict).toBeUndefined();
  });

  it.skipIf(!distReady)('adr supersedes 仅在新 ADR 记录，不回写旧 ADR 状态（记录当前行为）', async () => {
    workspace = await tmpDir({ unsafeCleanup: true });
    const s1 = await newSession('claude-code');
    await callTool(s1, 'lrnev_init', { root: workspace.path, project_name: 'mcp-e2e' });

    const oldAdr = await callTool(s1, 'adr_create', {
      title: '旧决策', scope: 'global', context: 'c', decision: '方案X',
    });
    const oldNum = String(oldAdr?.data?.number ?? oldAdr?.number);
    await callTool(s1, 'adr_create', {
      title: '新决策', scope: 'global', context: 'c2', decision: '方案Y', supersedes: [oldNum],
    });

    const got = await callTool(s1, 'adr_get', { scope: 'global', number: oldNum });
    const old = got?.data ?? got;
    // 当前行为：旧 ADR 状态不变（supersedes 是单向记录）。
    // 若未来实现“被取代回写”，此断言会失败并提示更新——作为行为契约守门。
    expect(old.status).toBe('proposed');
  });
});
