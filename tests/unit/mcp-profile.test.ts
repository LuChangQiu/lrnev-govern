/**
 * L7 消费方分层（2026-09-04 裁决 2，ai-discussions/结果/2026-09-04-DeepSeek-引导激励与工具分层设计裁决.md）：
 * MCP 工具注册期 profile core|full。
 *
 * - full（默认，42）= 全部工具，向后兼容（现有无参 createMcpServer 调用零变化）；
 * - core（33）= full − 9 个"AI 不该主动选"的工具：
 *   agent_* 自动面（agent_register/heartbeat/unregister/list，连接层 initialize 自动调）
 *   + lrnev_hook_* 配置面（list/trigger/tail_log/enable/disable，人配置期使用）。
 *
 * 权威清单以 guidance.TOOL_DESCRIPTIONS 键为 full 全集（tool-descriptions.test 已锁定
 * 注册工具名与它完全一致），本测试在其上做集合差断言，避免 42/33 魔法数漂移。
 */

import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { createMcpServer, parseMcpProfileArg, type McpServerOptions } from '../../src/mcp/server.js';
import { TOOL_DESCRIPTIONS } from '../../src/mcp/guidance.js';

/** 裁决 2 裁剪清单：core = full − 这 9 个（agent 自动面 4 + hook 配置面 5）。 */
const CORE_EXCLUDED_TOOLS = [
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

describe('MCP 工具分层 profile（L7）', () => {
  it('无参 createMcpServer 默认 full：42 个工具，含 9 个 core 外工具', async () => {
    const names = await listToolNames();

    const full = Object.keys(TOOL_DESCRIPTIONS).sort();
    expect(full).toHaveLength(42);
    expect(names).toEqual(full);
    // 9 个"AI 不该主动选"的工具在 full 里都在场
    for (const excluded of CORE_EXCLUDED_TOOLS) {
      expect(names).toContain(excluded);
    }
    // core 保留面代表：task/adr/error/memory/session_commit/doctor/report/guide 全在场
    expect(names).toContain('task_create');
    expect(names).toContain('session_commit');
    expect(names).toContain('lrnev_doctor');
    expect(names).toContain('lrnev_report');
    expect(names).toContain('lrnev_guide');
  });

  it("{ profile: 'full' } 与无参一致：42 个工具", async () => {
    const explicit = await listToolNames({ profile: 'full' });
    const noArg = await listToolNames();
    expect(explicit).toEqual(noArg);
    expect(explicit).toHaveLength(42);
  });

  it("{ profile: 'core' } → tools/list 33 个 = 42 − 9：9 个缺席 + 33 个精确在场", async () => {
    const names = await listToolNames({ profile: 'core' });

    const full = Object.keys(TOOL_DESCRIPTIONS).sort();
    expect(full).toHaveLength(42);

    // 精确缺席：9 个"AI 不该主动选"的工具一个都不注册
    expect(names).toHaveLength(33);
    for (const excluded of CORE_EXCLUDED_TOOLS) {
      expect(names).not.toContain(excluded);
    }

    // 精确在场：core = full − 9（集合差全等，无遗漏无多余）
    const coreExpected = full.filter((name) => !CORE_EXCLUDED_TOOLS.includes(name));
    expect(coreExpected).toHaveLength(33);
    expect(names).toEqual(coreExpected);

    // core 保留面代表（AI 可能需要 / doctor、report 是"AI 替人执行"的 User 层通道）都在
    expect(names).toContain('task_create');
    expect(names).toContain('adr_create');
    expect(names).toContain('error_record');
    expect(names).toContain('memory_save');
    expect(names).toContain('session_commit');
    expect(names).toContain('lrnev_doctor');
    expect(names).toContain('lrnev_report');
    expect(names).toContain('lrnev_guide');
  });
});

describe('parseMcpProfileArg（lrnev-mcp 入口 --profile 解析）', () => {
  it('未传 --profile 默认 full', () => {
    expect(parseMcpProfileArg(['node', 'lrnev-mcp'])).toBe('full');
    expect(parseMcpProfileArg([])).toBe('full');
  });

  it('--profile core / --profile full（空格分隔）', () => {
    expect(parseMcpProfileArg(['node', 'lrnev-mcp', '--profile', 'core'])).toBe('core');
    expect(parseMcpProfileArg(['node', 'lrnev-mcp', '--profile', 'full'])).toBe('full');
  });

  it('--profile=core / --profile=full（等号分隔）', () => {
    expect(parseMcpProfileArg(['node', 'lrnev-mcp', '--profile=core'])).toBe('core');
    expect(parseMcpProfileArg(['node', 'lrnev-mcp', '--profile=full'])).toBe('full');
  });

  it('其它参数不干扰：未知 flag 忽略、仍默认 full', () => {
    expect(parseMcpProfileArg(['node', 'lrnev-mcp', '--verbose'])).toBe('full');
    expect(parseMcpProfileArg(['node', 'lrnev-mcp', '--verbose', '--profile', 'core'])).toBe('core');
  });

  it('非法取值抛错（入口层 catch → stderr + exit 1）', () => {
    expect(() => parseMcpProfileArg(['node', 'lrnev-mcp', '--profile', 'bogus'])).toThrow(/core\|full/);
    expect(() => parseMcpProfileArg(['node', 'lrnev-mcp', '--profile=fullx'])).toThrow(/core\|full/);
  });

  it('--profile 缺少取值抛错', () => {
    expect(() => parseMcpProfileArg(['node', 'lrnev-mcp', '--profile'])).toThrow(/缺少取值/);
    expect(() => parseMcpProfileArg(['node', 'lrnev-mcp', '--profile', '--other'])).toThrow(/缺少取值/);
  });
});

async function listToolNames(options?: McpServerOptions): Promise<string[]> {
  const server = createMcpServer(options);
  const client = new Client({ name: 'lrnev-profile-test', version: '0.0.1' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const tools = await client.listTools();
    return tools.tools.map((tool) => tool.name).sort();
  } finally {
    await client.close();
    await server.close();
  }
}
