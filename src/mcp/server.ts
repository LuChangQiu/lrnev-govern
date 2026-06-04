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
import { registerResources } from './resources/index.js';
import { registerTools } from './tools/index.js';
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

export function createMcpServer(): McpServer {
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
  registerTools(server);
  return server;
}

export async function startMcpServer(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(`${PACKAGE_NAME}@${VERSION} MCP 服务已通过 stdio 启动。\n`);
}
