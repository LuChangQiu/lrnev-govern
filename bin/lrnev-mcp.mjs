#!/usr/bin/env node
// lrnev-mcp 服务入口
// MCP 客户端（Cursor / Claude Code 等）通过 stdio 拉起本进程，
// 由 package.json 的 bin["lrnev-mcp"] 字段映射到全局命令。
//
// 注意：stdout 是 MCP 协议通道，所有错误信息必须走 stderr。

import { startMcpServer } from '../dist/mcp/server.js';

startMcpServer().catch((err) => {
  process.stderr.write(`lrnev-mcp 启动失败：${err?.message ?? err}\n`);
  process.exit(1);
});
