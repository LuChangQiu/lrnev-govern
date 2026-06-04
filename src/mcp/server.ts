/**
 * MCP 服务入口。
 *
 * 使用标准 stdio transport，供 Claude Code / Cursor / Codex 等任意 MCP 客户端拉起。
 * stdout 是 MCP 协议通道，日志必须写 stderr，避免污染 JSON-RPC。
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { VERSION, PACKAGE_NAME } from '../shared/version.js';
import { registerResources } from './resources/index.js';
import { registerTools } from './tools/index.js';
import { WORKFLOW_OVERVIEW } from './guidance.js';

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
      instructions: WORKFLOW_OVERVIEW,
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
