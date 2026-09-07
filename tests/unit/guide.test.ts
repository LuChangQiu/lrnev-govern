/**
 * lrnev_guide 工具与 CLI guide 子命令测试。
 *
 * 含 L7 profile 自适应（外部复核缺陷 #11）：core 注册面无 agent_*、hook_* 工具，
 * core 手册 tools 节裁掉"并发/自动化"两行指引；full（默认，含 CLI）原样保留。
 */

import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { buildCli } from '../../src/cli/index.js';
import { buildGuide } from '../../src/mcp/guidance.js';
import { createMcpServer, type McpServerOptions } from '../../src/mcp/server.js';

/** L7 core 裁剪面（= full − 9，见 mcp-profile.test.ts）：agent_* 自动面 4 + lrnev_hook_* 配置面 5。
 * 以工具名子串断言手册指引，避免锁死整行文案。 */
const FULL_ONLY_TOOL_TOKENS = [
  'agent_register',
  'agent_heartbeat',
  'agent_unregister',
  'agent_list',
  'lrnev_hook_list',
  'lrnev_hook_trigger',
  'lrnev_hook_tail_log',
  'lrnev_hook_enable',
  'lrnev_hook_disable',
];

/** SDK result.content 在类型层为 unknown；运行时是 { type: 'text'; text: string } 内容块数组。
 * 局部类型投影，读取语义与原先的 ?.[0]?.type === 'text' ? [0].text : '' 完全一致（纯类型层）。 */
type MCPTextBlock = { type?: string; text?: string };
function contentText(content: unknown): string {
  const first = (content as MCPTextBlock[] | undefined)?.[0];
  return first?.type === 'text' ? (first.text ?? '') : '';
}

describe('lrnev guide', () => {
  it('buildGuide 无参返回完整手册', () => {
    const guide = buildGuide();

    expect(guide.ok).toBe(true);
    expect(guide.data.topic).toBe('all');
    expect(guide.data.content).toContain('## 工作流 (workflow)');
    expect(guide.data.content).toContain('## 工具速查 (tools)');
    expect(guide.data.content).toContain('## 错误自救 (errors)');
    expect(guide.data.content).toContain('## 核心概念 (concepts)');
    expect(guide.data.content).toContain('EARS');
    expect(guide.data.content).toContain('WHEN 用户输错密码 THEN 系统返回 401 且不暴露用户是否存在');
    expect(guide.data.content).toContain('| 决策 | 选项 | 倾向 | 是否产 ADR |');
    expect(guide.data.content).toContain('为什么这样做');
    expect(guide.data.content).toContain('VV 是正式重写版号，不是修订号');
    expect(guide.data.content).toContain('直接编辑只用于需求细化/文档维护');
    expect(guide.data.content).toContain('version=1/2/...');
    expect(guide.data.content).toContain('可分别认领/并行');
    expect(guide.data.content).toContain('各自独立验收');
    expect(guide.data.content).toContain('别为拆而拆');
    expect(guide.data.content).toContain('task_create_many');
    expect(guide.data.content).toContain('governance_map');
    expect(guide.data.content).toContain('lrnev_report');
    expect(guide.data.content).toContain('spec_update');
    expect(guide.data.content).toContain('assess_goal');
    expect(guide.ai_followup.instructions[0]).toContain('完整手册');
  });

  it('buildGuide topic 只返回对应小节', () => {
    const guide = buildGuide('errors');

    expect(guide.data.topic).toBe('errors');
    expect(guide.data.content).toContain('## 错误自救 (errors)');
    expect(guide.data.content).toContain('AMBIGUOUS_REF');
    expect(guide.data.content).not.toContain('## 工作流 (workflow)');
    expect(guide.data.content).not.toContain('## 工具速查 (tools)');
    expect(guide.ai_followup.instructions[0]).toContain('错误自救');
  });

  it('buildGuide tools 默认 full：并发/自动化（agent_*/hook_*）指引原样保留', () => {
    const guide = buildGuide('tools');

    expect(guide.data.content).toContain(
      '并发：agent_register/agent_heartbeat/agent_unregister 管客户端会话；task_claim/task_release 记录谁声明正在做哪个 Task。',
    );
    expect(guide.data.content).toContain('自动化：lrnev_hook_list/trigger/tail_log/enable/disable 管本地 hooks。');
  });

  it('buildGuide tools + profile=core：整行裁掉 agent_*/hook_* 指引，公共行与 doctor 行保留', () => {
    const guide = buildGuide('tools', 'core');
    const content = guide.data.content;

    expect(guide.data.topic).toBe('tools');
    expect(content).toContain('## 工具速查 (tools)');
    for (const token of FULL_ONLY_TOOL_TOKENS) {
      expect(content).not.toContain(token);
    }
    expect(content).not.toContain('并发：');
    expect(content).not.toContain('自动化：');
    // core 仍在场的工具指引不受影响：新建/接手/轻产物公共行 + doctor 诊断行（doctor 在 core 仍注册）
    expect(content).toContain('新建：lrnev_init、scene_create');
    expect(content).toContain('接手：project_status');
    expect(content).toContain('轻产物：adr_create');
    expect(content).toContain('诊断：lrnev_doctor 查工作区结构');
  });

  it('buildGuide(undefined, core) 完整手册不含 agent_*/hook_* 指引；概念机制行不受影响', () => {
    const guide = buildGuide(undefined, 'core');
    const content = guide.data.content;

    expect(content).toContain('## 工作流 (workflow)');
    expect(content).toContain('## 工具速查 (tools)');
    expect(content).toContain('## 错误自救 (errors)');
    expect(content).toContain('## 核心概念 (concepts)');
    for (const token of FULL_ONLY_TOOL_TOKENS) {
      expect(content).not.toContain(token);
    }
    // 多 Agent 行讲存活判定机制、不指引工具 → 保留（core 下连接层仍自动注册/注销会话）
    expect(content).toContain('多 Agent：存活随进程自动判定');
  });

  it('MCP lrnev_guide 无参和 topic 调用都可用（默认 full：含 agent_*/hook_* 指引）', async () => {
    const { server, client } = await connectInMemory();
    try {
      const full = await client.callTool({ name: 'lrnev_guide', arguments: {} });
      const fullText = contentText(full.content);
      // M2: 返回格式化文本
      expect(fullText).toContain('工作流 (workflow)');
      expect(fullText).toContain('错误自救 (errors)');
      // 默认 full：tools 节的并发/自动化（agent_*/hook_*）指引在场
      expect(fullText).toContain('agent_register');
      expect(fullText).toContain('lrnev_hook_list');

      const errors = await client.callTool({ name: 'lrnev_guide', arguments: { topic: 'errors' } });
      const errorsText = contentText(errors.content);
      expect(errorsText).toContain('AMBIGUOUS_REF');
      expect(errorsText).not.toContain('工具速查 (tools)');
    } finally {
      await client.close();
      await server.close();
    }
  });

  it('MCP profile=core：lrnev_guide 手册不含 agent_*/hook_* 指引（tools 节与完整手册）', async () => {
    const { server, client } = await connectInMemory({ profile: 'core' });
    try {
      const all = await client.callTool({ name: 'lrnev_guide', arguments: {} });
      const allText = contentText(all.content);
      expect(allText).toContain('工作流 (workflow)');
      expect(allText).toContain('工具速查 (tools)');
      for (const token of FULL_ONLY_TOOL_TOKENS) {
        expect(allText).not.toContain(token);
      }

      const tools = await client.callTool({ name: 'lrnev_guide', arguments: { topic: 'tools' } });
      const toolsText = contentText(tools.content);
      for (const token of FULL_ONLY_TOOL_TOKENS) {
        expect(toolsText).not.toContain(token);
      }
      expect(toolsText).toContain('诊断：lrnev_doctor 查工作区结构');
    } finally {
      await client.close();
      await server.close();
    }
  });

  it('CLI guide [topic] 输出对应手册内容（CLI 无 profile 概念 → 恒为 full）', async () => {
    const full = await runCli(['guide']);
    expect(full.data.topic).toBe('all');
    expect(full.data.content).toContain('## 工作流 (workflow)');
    expect(full.data.content).toContain('## 核心概念 (concepts)');
    // CLI 不走 MCP profile：并发/自动化（agent_*/hook_*）指引保持 full 在场
    expect(full.data.content).toContain('agent_register');
    expect(full.data.content).toContain('lrnev_hook_list');

    const errors = await runCli(['guide', 'errors']);
    expect(errors.data.topic).toBe('errors');
    expect(errors.data.content).toContain('AMBIGUOUS_REF');
    expect(errors.data.content).not.toContain('## 工作流 (workflow)');
  });
});

function readPayload(result: Awaited<ReturnType<Client['callTool']>>): unknown {
  const text = contentText(result.content);
  return JSON.parse(text);
}

async function runCli(args: string[]): Promise<any> {
  let out = '';
  const program = buildCli({ writeOut: (text) => { out += text; } });
  await program.parseAsync(['node', 'lrnev', '--json', ...args]);
  return JSON.parse(out);
}

async function connectInMemory(options?: McpServerOptions): Promise<{
  server: ReturnType<typeof createMcpServer>;
  client: Client;
}> {
  const server = createMcpServer(options);
  const client = new Client({ name: 'lrnev-guide-test', version: '0.0.1' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return { server, client };
}
