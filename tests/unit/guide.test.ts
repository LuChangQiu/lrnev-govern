/**
 * lrnev_guide 工具与 CLI guide 子命令测试。
 */

import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { buildCli } from '../../src/cli/index.js';
import { buildGuide } from '../../src/mcp/guidance.js';
import { createMcpServer } from '../../src/mcp/server.js';

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
    expect(guide.data.content).toContain('直接编辑原文件，git 记录历史');
    expect(guide.data.content).toContain('version=1/2/...');
    expect(guide.data.content).toContain('可分别认领/并行');
    expect(guide.data.content).toContain('各自独立验收');
    expect(guide.data.content).toContain('别为拆而拆');
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

  it('MCP lrnev_guide 无参和 topic 调用都可用', async () => {
    const { server, client } = await connectInMemory();
    try {
      const full = await client.callTool({ name: 'lrnev_guide', arguments: {} });
      const fullPayload = readPayload(full) as ReturnType<typeof buildGuide>;
      expect(fullPayload.data.topic).toBe('all');
      expect(fullPayload.data.content).toContain('## 工作流 (workflow)');
      expect(fullPayload.data.content).toContain('## 错误自救 (errors)');

      const errors = await client.callTool({ name: 'lrnev_guide', arguments: { topic: 'errors' } });
      const errorsPayload = readPayload(errors) as ReturnType<typeof buildGuide>;
      expect(errorsPayload.data.topic).toBe('errors');
      expect(errorsPayload.data.content).toContain('AMBIGUOUS_REF');
      expect(errorsPayload.data.content).not.toContain('## 工具速查 (tools)');
    } finally {
      await client.close();
      await server.close();
    }
  });

  it('CLI guide [topic] 输出对应手册内容', async () => {
    const full = await runCli(['guide']);
    expect(full.data.topic).toBe('all');
    expect(full.data.content).toContain('## 工作流 (workflow)');
    expect(full.data.content).toContain('## 核心概念 (concepts)');

    const errors = await runCli(['guide', 'errors']);
    expect(errors.data.topic).toBe('errors');
    expect(errors.data.content).toContain('AMBIGUOUS_REF');
    expect(errors.data.content).not.toContain('## 工作流 (workflow)');
  });
});

function readPayload(result: Awaited<ReturnType<Client['callTool']>>): unknown {
  const text = result.content[0]?.type === 'text' ? result.content[0].text : '';
  return JSON.parse(text);
}

async function runCli(args: string[]): Promise<any> {
  let out = '';
  const program = buildCli({ writeOut: (text) => { out += text; } });
  await program.parseAsync(['node', 'lrnev', '--json', ...args]);
  return JSON.parse(out);
}

async function connectInMemory(): Promise<{
  server: ReturnType<typeof createMcpServer>;
  client: Client;
}> {
  const server = createMcpServer();
  const client = new Client({ name: 'lrnev-guide-test', version: '0.0.1' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return { server, client };
}
