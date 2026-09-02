#!/usr/bin/env node
/**
 * T-027 通用 MCP 启动入口（gitignore 区）
 *
 * 动态 import server.ts 并调用 startMcpServer
 * 所有日志走 stderr（stdout 是 JSON-RPC 通道）
 */

import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const cwd = process.cwd();
const serverPath = resolve(cwd, 'src/mcp/server.ts');

console.error(`[T-027] 启动 MCP server: ${serverPath}`);

async function main() {
  try {
    const serverModule = await import(pathToFileURL(serverPath).href);

    if (typeof serverModule.startMcpServer !== 'function') {
      console.error('[T-027] 错误：server.ts 未导出 startMcpServer');
      process.exit(1);
    }

    console.error('[T-027] 调用 startMcpServer...');
    await serverModule.startMcpServer();
  } catch (err) {
    console.error('[T-027] 启动失败:', err);
    process.exit(1);
  }
}

main();
