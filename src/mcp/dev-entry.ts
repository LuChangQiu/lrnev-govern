/**
 * MCP 服务开发入口（仅本地开发用，不参与发布）。
 *
 * 为什么存在：src/mcp/server.ts 只导出工厂与启动函数（模块加载不自启，
 * 生产入口是 bin/lrnev-mcp.mjs → dist/mcp/server.js）。dev:mcp /
 * dev:inspect 用 tsx 直跑源码，需要一个模块顶部即启动的入口，否则
 * `tsx watch src/mcp/server.ts` 加载完模块后无句柄直接退出。
 *
 * 用法：
 * - npm run dev:mcp     —— tsx watch 热重载跑 MCP（编辑 src 自动重启）
 * - npm run dev:inspect —— MCP Inspector 拉起本入口
 * - 需要 core 工具面时追加：--profile core（透传给 parseMcpProfileArg）
 *
 * 注意：tsconfig include 覆盖 src/**\/*.ts，本文件会被编译进 dist/mcp/
 * （dev-entry.js），属可接受的冗余；生产入口始终是 bin/lrnev-mcp.mjs。
 * stdout 是 MCP 协议通道，日志必须走 stderr。
 */

import { startMcpServer } from './server.js';

startMcpServer().catch((err) => {
  process.stderr.write(`lrnev-mcp 启动失败：${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
