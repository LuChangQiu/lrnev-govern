---
title: 'lrnev-govern Architecture'
created: '2026-06-11'
---

# lrnev-govern 架构

## L0 摘要

分层确定性架构：CLI / MCP 两个薄入口共用 core 层 Manager，core 通过 storage 层读写 `.lrnev/` Markdown；全程零 LLM。

## L1 概览

### 技术栈

- TypeScript（ESM，Node >= 20）
- 运行依赖：`@modelcontextprotocol/sdk`（MCP）、`commander`（CLI）、`glob`、`gray-matter`（frontmatter）、`zod`（schema 校验）
- 开发/测试：`vitest`（570 测试，unit/integration/e2e）、`tsx`、`tsc`
- 双入口：`bin/lrnev.mjs`（CLI）、`bin/lrnev-mcp.mjs`（MCP stdio 服务，import dist）

### 主要模块

- `src/cli/`：CLI 入口，commander 解析参数 → 调 core Manager → 输出结构化 JSON（core 的薄包装）
- `src/mcp/`：MCP 服务（`server.ts` 生命周期 + `tools/index.ts` 工具注册 + `resources/` + `guidance.ts` 手册/工具描述）
- `src/core/`：确定性业务逻辑，各能力一个 Manager（Scene/Spec/Task/Gate/ADR/Errorbook/Memory/Summarizer/Searcher/AgentRegistry/ClaimStore/Doctor/HookManager/ProjectStatus/AutoAnalyzer/WorkspaceManager 等）
- `src/storage/`：文件 IO 抽象（FileStorage 含目录锁、FrontmatterCodec、MarkdownParser、URIRouter、WorkspaceLocator）
- `src/types/` / `src/shared/`：类型定义 / 配置、错误码、路径、版本

### 数据流

客户端（CLI 命令 或 MCP 工具调用）→ 对应 Manager → storage 层读写 `.lrnev/` 下 Markdown（frontmatter 承载元信息、HTML 注释承载 Task 状态机）→ 返回结构化结果 + `ai_followup` 提示。CLI 与 MCP 共用同一套 core，因此“同一份 `.lrnev` 数据两条路都能读写”。

## L2 详情

### 目录结构

- bin/ — CLI 与 MCP 可执行入口
- src/ — 源码（cli / mcp / core / storage / types / shared）
- tests/ — unit / integration / e2e（含 `e2e/mcp-stdio-lifecycle.test.ts` 真 stdio 进程生命周期）
- templates/ — Scene/Spec/project 的 Markdown 模板（含 FILL 哨兵）
- docs/ — 用户文档（ARCHITECTURE / GOVERNANCE-FLOW / HOOKS / MULTI-AGENT / AI-ADAPTATION）
- dev-docs/ — 开发文档（测试报告、FINDINGS-CHECKLIST 等）
- examples/ — CLI 上手 demo

### 关键设计约束

- **确定性归代码、判断归 AI**：core 只做规则可判定的事；需判断处通过 `ai_followup` 提示，不替 AI 决策、不调 LLM。
- **CLI/MCP 对等**：两入口必须共用 core，避免能力漂移（历史上出现过 spec_get 引导、task --depends-on、adr --supersedes 仅 MCP 有的不对等，见 FINDINGS-CHECKLIST S1）。
- **文件即真相 + 并发安全**：Scene/Spec 序号靠目录扫描而非状态文件；写 tasks.md / 分配序号 / 写 claim 用 `FileStorage.withDirectoryLock` 文件级互斥。
- **Gate 只查结构契约**：不判断 prose 质量；ready gate 章节标题须与中文模板完全一致（契约）。
- **多 Agent 存活按进程生命周期惰性判定**：同主机 pid 探活为主、跨主机 last_heartbeat 兜底；无后台线程、无定时心跳要求。

### 外部依赖

- MCP 协议（`@modelcontextprotocol/sdk`）：stdio transport，客户端拉起本进程
- 无数据库、无网络服务、无 LLM/Embedding/向量库
- 可选互补：codegraph（源码知识图谱，负责语义理解，与 lrnev 的流程治理分层互补）
