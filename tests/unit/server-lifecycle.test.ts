/**
 * MCP server 会话生命周期单元测试。
 *
 * 覆盖 F-01(连接初始化即注册)与 F-02(连接断开即注销并释放 claim,幂等)。
 * 不起真实 stdio 子进程,直接驱动 createAgentLifecycle 暴露的 onInitialized / cleanup。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { dir as tmpDir, type DirectoryResult } from 'tmp-promise';
import { EventEmitter } from 'node:events';

import { createAgentLifecycle, wireStdinShutdown } from '../../src/mcp/server.js';
import { AgentRegistry } from '../../src/core/AgentRegistry.js';
import { ClaimStore } from '../../src/core/ClaimStore.js';
import { FileStorage } from '../../src/storage/FileStorage.js';
import { ensureWorkspace } from '../../src/storage/WorkspaceLocator.js';

describe('createAgentLifecycle', () => {
  let workspace: DirectoryResult;
  let fs: FileStorage;
  let registry: AgentRegistry;

  beforeEach(async () => {
    workspace = await tmpDir({ unsafeCleanup: true });
    await ensureWorkspace(workspace.path);
    fs = new FileStorage(workspace.path);
    registry = new AgentRegistry(fs);
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  it('F-01: onInitialized 应注册本会话 agent 并带上 clientInfo 名', async () => {
    const lifecycle = createAgentLifecycle(workspace.path, () => 'codex');

    await lifecycle.onInitialized();

    const agents = (await registry.list()).data.agents;
    expect(agents).toHaveLength(1);
    expect(agents[0]).toMatchObject({ client: 'codex', pid: process.pid });
    // 进程在世 → pid 探活判 active
    expect(agents[0]?.status).toBe('active');
  });

  it('F-01: 无 clientInfo 时仍注册,只是不带 client 字段', async () => {
    const lifecycle = createAgentLifecycle(workspace.path, () => undefined);

    await lifecycle.onInitialized();

    const agents = (await registry.list()).data.agents;
    expect(agents).toHaveLength(1);
    expect(agents[0]?.client).toBeUndefined();
  });

  it('F-02: cleanup 应注销 agent 并释放其 claim,且重复调用幂等', async () => {
    const lifecycle = createAgentLifecycle(workspace.path, () => 'codex');
    await lifecycle.onInitialized();
    const agentId = (await registry.list()).data.agents[0]!.agent_id;
    const claims = new ClaimStore(fs);
    await claims.claim({ scene: '00-default', spec: '01-00-login', task: 'T-001', agent_id: agentId });

    await lifecycle.cleanup();
    await lifecycle.cleanup();

    expect((await registry.list()).data.agents).toHaveLength(0);
    expect(await claims.listAll()).toHaveLength(0);
  });

  it('F-02: 未注册即 cleanup 应为 no-op', async () => {
    const lifecycle = createAgentLifecycle(workspace.path, () => undefined);
    await expect(lifecycle.cleanup()).resolves.toBeUndefined();
  });

  it('F-02: stdin 收到 end 应触发关闭(回归:onclose 不会因 stdin EOF 触发)', () => {
    const stdin = new EventEmitter();
    const onShutdown = vi.fn();
    wireStdinShutdown(stdin, onShutdown);

    stdin.emit('end');

    expect(onShutdown).toHaveBeenCalledTimes(1);
  });

  it('F-02: stdin 收到 close 也应触发关闭', () => {
    const stdin = new EventEmitter();
    const onShutdown = vi.fn();
    wireStdinShutdown(stdin, onShutdown);

    stdin.emit('close');

    expect(onShutdown).toHaveBeenCalledTimes(1);
  });
});
