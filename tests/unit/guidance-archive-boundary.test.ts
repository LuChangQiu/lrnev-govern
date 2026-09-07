/**
 * G5 归档边界语义测试（2026-09-04，T-027 E-06a/b 观测驱动的引导修复）
 *
 * 背景：E-06a/b 实测 claude 两 SHA 同现"改主意 = 自动归档刚建 B"（6/10 + 5/10）——
 * AI 把归档当作负责任的撤销，但 archived 是状态机终态、影响跨会话可审计性，
 * design 语义是"不自动回滚、归档由用户明确决定"。G5 把该语义在两个动作点显式化：
 *   1. WORKFLOW_OVERVIEW 全局句（每会话 server instructions 可见——实测最高频
 *      消费的 guidance 面：证据 surface_id 几乎全为 workflow_overview）；
 *   2. spec_update 工具描述（准备归档动作前可见）。
 * spec_create 成功响应【不】植入无条件【决策边界】行——DECISION_BOUNDARY 是
 * direction 不一致提示的专用语义（05-00 裁决 Q4），恒有行会破坏 Profile 协议
 * （spec_create 无 context 时 guidance=[FACT, RECOMMENDATION]），并让模型对
 * 边界标记脱敏。语义锚 SPEC_CREATION_SUCCESS_FOLLOWUP 同步扩展作为文档锚。
 */

import { describe, expect, it } from 'vitest';
import { WORKFLOW_OVERVIEW, TOOL_DESCRIPTIONS } from '../../src/mcp/guidance.js';
import { SPEC_CREATION_SUCCESS_FOLLOWUP } from '../../src/core/guidance-semantics.js';

describe('G5 归档边界语义（E-06a/b 自动归档观测修复）', () => {
  it('WORKFLOW_OVERVIEW 全局句：AI 不替用户自动归档，用户改主意不构成归档依据', () => {
    expect(WORKFLOW_OVERVIEW).toContain('归档边界');
    expect(WORKFLOW_OVERVIEW).toContain('archived 是状态机终态');
    expect(WORKFLOW_OVERVIEW).toContain('不构成自动归档依据');
    expect(WORKFLOW_OVERVIEW).toContain('由用户明确决定');
  });

  it('spec_create followup 语义锚：改主意不自动归档/删除，归档需用户明确要求', () => {
    expect(SPEC_CREATION_SUCCESS_FOLLOWUP).toContain('不得擅自撤销或回退'); // 既有语义不回归
    expect(SPEC_CREATION_SUCCESS_FOLLOWUP).toContain('改变主意');
    expect(SPEC_CREATION_SUCCESS_FOLLOWUP).toContain('不要自动归档或删除本 Spec');
    expect(SPEC_CREATION_SUCCESS_FOLLOWUP).toContain('终态');
    expect(SPEC_CREATION_SUCCESS_FOLLOWUP).toContain('只在用户明确要求归档时才用 spec_update 执行');
  });

  it('spec_update 工具描述：archived 终态 + 不替用户做归档决定', () => {
    expect(TOOL_DESCRIPTIONS.spec_update).toContain('【决策边界】');
    expect(TOOL_DESCRIPTIONS.spec_update).toContain('archived 是终态');
    expect(TOOL_DESCRIPTIONS.spec_update).toContain('不构成自动归档依据');
    expect(TOOL_DESCRIPTIONS.spec_update).toContain('仅在用户明确要求归档时执行');
  });

  it('spec_create 成功响应不带无条件【决策边界】行（DECISION_BOUNDARY 是 direction 不一致专用语义，05-00 裁决 Q4）', async () => {
    // G5 归档边界不进 spec_create 的无条件 instructions——否则文本通道恒带
    // DECISION_BOUNDARY 行，破坏 T-004/T-005 协议锁定（spec_create 无 context 时
    // role 行集合恒为 [FACT, RECOMMENDATION]；T-006 O6 2026-09-07 后 Profile 结构化
    // 挂载已回退，角色语义由文本行承载）。归档边界由 WORKFLOW_OVERVIEW 全局句 +
    // spec_update 工具描述承担（两者在动作前可见；WORKFLOW_OVERVIEW 是实测最高频
    // 消费的 guidance 面）。
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js');
    const { createMcpServer } = await import('../../src/mcp/server.js');
    const { dir: tmpDir } = await import('tmp-promise');

    const workspace = await tmpDir({ unsafeCleanup: true });
    const original = process.env.LRNEV_WORKSPACE;
    process.env.LRNEV_WORKSPACE = workspace.path;
    const server = createMcpServer();
    const client = new Client({ name: 'g5-test', version: '0.0.1' });
    try {
      const [ct, st] = InMemoryTransport.createLinkedPair();
      await Promise.all([server.connect(st), client.connect(ct)]);
      await client.callTool({ name: 'lrnev_init', arguments: { root: workspace.path } });
      const result = await client.callTool({
        name: 'spec_create',
        arguments: { name: 'login', scene: '00-default' },
      });
      const payload = result.structuredContent as { ai_followup?: { instructions?: string[] }; guidance?: unknown[] };
      const instructions = payload.ai_followup?.instructions ?? [];
      const boundary = instructions.filter((l) => l.startsWith('【决策边界】'));
      expect(boundary.length).toBe(0); // 无 context 不一致 → 无 DECISION_BOUNDARY
      // 归档语义在全局面与 spec_update 描述（本文件其他用例已锁），spec_create 响应不重复植入
    } finally {
      await client.close();
      await server.close();
      if (original === undefined) delete process.env.LRNEV_WORKSPACE;
      else process.env.LRNEV_WORKSPACE = original;
      await workspace.cleanup();
    }
  });

  it('档位前缀：核心/自动/配置 工具描述带档位标记且不破坏何时用', () => {
    expect(TOOL_DESCRIPTIONS.project_status.startsWith('[核心] ')).toBe(true);
    expect(TOOL_DESCRIPTIONS.spec_update.startsWith('[核心] ')).toBe(true);
    expect(TOOL_DESCRIPTIONS.task_create.startsWith('[核心] ')).toBe(true);
    expect(TOOL_DESCRIPTIONS.agent_register.startsWith('[自动] ')).toBe(true);
    expect(TOOL_DESCRIPTIONS.agent_heartbeat.startsWith('[自动] ')).toBe(true);
    expect(TOOL_DESCRIPTIONS.lrnev_hook_list.startsWith('[配置] ')).toBe(true);
    expect(TOOL_DESCRIPTIONS.lrnev_hook_disable.startsWith('[配置] ')).toBe(true);
    // 前缀不破坏"何时用"结构
    for (const d of Object.values(TOOL_DESCRIPTIONS)) {
      expect(d).toContain('何时用');
    }
    // 未分档工具无前缀（普通按需）
    expect(TOOL_DESCRIPTIONS.adr_create.startsWith('[')).toBe(false);
    expect(TOOL_DESCRIPTIONS.memory_save.startsWith('[')).toBe(false);
  });
});
