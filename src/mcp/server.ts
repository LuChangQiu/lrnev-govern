/**
 * MCP 服务入口。
 *
 * 使用标准 stdio transport，供 Claude Code / Cursor / Codex 等任意 MCP 客户端拉起。
 * stdout 是 MCP 协议通道，日志必须写 stderr，避免污染 JSON-RPC。
 */

import { resolve } from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { VERSION, PACKAGE_NAME } from '../shared/version.js';
import { resolveWorkspaceRoot } from '../storage/WorkspaceLocator.js';
import { FileStorage } from '../storage/FileStorage.js';
import { AgentRegistry } from '../core/AgentRegistry.js';
import { registerResources } from './resources/index.js';
import { registerTools, type McpProfile } from './tools/index.js';
import { WORKFLOW_OVERVIEW } from './guidance.js';

function buildInstructions(): string {
  const location = resolveWorkspaceRoot();
  const instructions = [WORKFLOW_OVERVIEW];

  // 向上误命中护栏：MCP 启动时即检查，避免非 init 操作也在错误的祖先工作区上执行
  if (
    location.source === 'lookup'
    && resolve(location.root) !== resolve(process.cwd())
  ) {
    instructions.push(
      '',
      `⚠️ 工作区根定位到 ${location.root}（向上查找命中了已有的 .lrnev，而非当前目录）。`,
      `若这不是你要治理的项目根，请设环境变量 LRNEV_WORKSPACE=<目标目录> 后重启 MCP 服务，或在目标目录显式 lrnev_init。`,
    );
  }

  return instructions.join('\n');
}

/**
 * createMcpServer 选项。
 *
 * L7 消费方分层（2026-09-04 裁决 2）：profile 决定注册哪些工具。
 * 默认 'full'（42 个），保持向后兼容；'core' 只裁 9 个"AI 不该主动选"的工具：
 * agent_* 自动面与 lrnev_hook_* 配置面（共 9 个，见 tools/index.ts 的 McpProfile 注释），保留 33 个。
 */
export interface McpServerOptions {
  /** 工具注册面：'full'（默认，42）| 'core'（33，裁剪 agent_* 自动面 + lrnev_hook_* 配置面）。 */
  profile?: McpProfile;
}

export function createMcpServer(options: McpServerOptions = {}): McpServer {
  const profile = options.profile ?? 'full';
  const server = new McpServer(
    {
      name: PACKAGE_NAME,
      version: VERSION,
    },
    {
      capabilities: {
        resources: {},
        tools: {},
      },
      instructions: buildInstructions(),
    },
  );

  registerResources(server);
  registerTools(server, profile);
  return server;
}

/**
 * 解析 MCP 服务入口的 --profile 参数（MCP 客户端在配置的 args 里追加）。
 *
 * 支持 `--profile core` 与 `--profile=core` 两种写法；缺省返回 'full'。
 * 非法取值抛错（bin/lrnev-mcp.mjs 的 catch 会写 stderr 并 exit 1）。
 */
export function parseMcpProfileArg(argv: readonly string[] = process.argv): McpProfile {
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === undefined) break;
    if (token === '--profile') {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('-')) {
        throw new Error('--profile 缺少取值：仅支持 core|full（默认 full），例如 --profile core');
      }
      return assertMcpProfile(value);
    }
    if (token.startsWith('--profile=')) {
      return assertMcpProfile(token.slice('--profile='.length));
    }
  }
  return 'full';
}

function assertMcpProfile(value: string): McpProfile {
  if (value === 'core' || value === 'full') return value;
  throw new Error(`--profile 取值无效：收到 "${value}"，仅支持 core|full（默认 full）。`);
}

export async function startMcpServer(argv: readonly string[] = process.argv): Promise<void> {
  const profile = parseMcpProfileArg(argv);
  const server = createMcpServer({ profile });
  const transport = new StdioServerTransport();

  // 存活随 stdio 连接生命周期:连接初始化即注册当前会话 agent,连接断开即注销并释放其 claim。
  // 不依赖任何客户端定时心跳;硬杀(close 不触发)由 computeAgentStatus 的 pid 探活兜底。
  const lifecycle = createAgentLifecycle(
    resolveWorkspaceRoot().root,
    () => server.server.getClientVersion()?.name,
  );
  server.server.oninitialized = () => {
    void lifecycle.onInitialized().catch((err) => {
      process.stderr.write(`lrnev: 自动注册 agent 失败：${stringifyError(err)}\n`);
    });
  };

  // 断开即注销:对 stdio server 而言,客户端离开的可靠信号是 stdin 收到 EOF。
  // 注意 StdioServerTransport 只监听 stdin 'data'/'error',不会在 stdin 关闭时触发 onclose,
  // 因此必须显式监听 stdin 'end'/'close';SIGTERM 在 Windows 上不触发,故不能只依赖信号。
  const shutdown = (): void => {
    void lifecycle.cleanup()
      .catch((err) => process.stderr.write(`lrnev: 注销 agent 失败：${stringifyError(err)}\n`))
      .finally(() => process.exit(0));
  };
  server.server.onclose = shutdown;
  wireStdinShutdown(process.stdin, shutdown);
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, shutdown);
  }

  await server.connect(transport);
  process.stderr.write(`${PACKAGE_NAME}@${VERSION} MCP 服务已通过 stdio 启动。\n`);
}

/**
 * 把"连接即注册 / 断开即注销释放 claim"的会话生命周期逻辑抽出,便于单测。
 *
 * - onInitialized:在 MCP initialize 完成后调用(此时 clientInfo 可读),注册本会话 agent。
 * - cleanup:幂等;多次触发只真正清理一次(优雅退出 / 信号 / onclose 可能重复触发)。
 */
export function createAgentLifecycle(
  root: string,
  getClientName: () => string | undefined,
): { onInitialized: () => Promise<void>; cleanup: () => Promise<void> } {
  const registry = new AgentRegistry(new FileStorage(root));
  let agentId: string | undefined;

  const onInitialized = async (): Promise<void> => {
    const client = getClientName();
    const res = await registry.register(client ? { client } : {});
    agentId = res.data.agent_id;
  };

  const cleanup = once(async (): Promise<void> => {
    if (!agentId) return;
    await registry.unregisterAndReleaseClaims(agentId);
  });

  return { onInitialized, cleanup };
}

function once(fn: () => Promise<void>): () => Promise<void> {
  let pending: Promise<void> | undefined;
  return () => (pending ??= fn());
}

/**
 * 把会话关闭触发器接到 stdin 上。
 *
 * 关键:StdioServerTransport 只监听 stdin 'data'/'error',客户端关闭 stdin 时不会触发 onclose。
 * 因此必须显式监听 stdin 'end'/'close',否则断开后 agent 注销/claim 释放永远不会发生。
 */
export function wireStdinShutdown(stdin: NodeJS.EventEmitter, onShutdown: () => void): void {
  stdin.once('end', onShutdown);
  stdin.once('close', onShutdown);
}

function stringifyError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
