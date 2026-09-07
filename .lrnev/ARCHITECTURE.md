---
title: 'lrnev-govern Architecture'
created: '2026-06-11'
updated: '2026-09-07'
---

# lrnev-govern 架构

## L0 摘要

分层确定性架构：CLI / MCP 双形态薄入口 → core 确定性业务 Manager → storage 文件层读写 `.lrnev/` 下 Markdown；3.0.0 起 MCP 出口带契约层——structuredContent canonical 信封 + 逐工具 MVC 文本渲染，42 工具全量 outputSchema。全程零 LLM、零模型，当前 1055 测试。

## L1 概览

### 技术栈

- TypeScript（ESM，Node >= 20）
- 运行依赖：`@modelcontextprotocol/sdk`（MCP）、`commander`（CLI）、`glob`、`gray-matter`（frontmatter）、`zod`（schema 校验）
- 开发/测试：`vitest`（1055 测试，unit/integration/e2e）、`tsx`、`tsc`；tests 另有独立类型门禁 `typecheck:test`（tsconfig.test.json）
- 双入口（import dist）：`bin/lrnev.mjs`（CLI）、`bin/lrnev-mcp.mjs`（MCP stdio 服务）；开发入口 `src/mcp/dev-entry.ts`（`dev:mcp`）

### 模块分层

- `src/cli/`：CLI 入口（单文件），commander 解析 → 委托 core Manager → 输出结构化 JSON
- `src/mcp/`：MCP 服务层——server / dev-entry / guidance / tools / resources，外加 types/（契约 schema）与 helpers/（信封适配、MVC 渲染、guidance 纯函数）
- `src/core/`：确定性业务——各能力一个 Manager + 引导语义模块（SpecGuidance / GateGuidance / guidance-semantics / decision-context）
- `src/storage/`：文件 IO 抽象（FileStorage 含目录锁、FrontmatterCodec、MarkdownParser、URIRouter、WorkspaceLocator）
- `src/schemas/`：JSON Schema 资产（evidence-contract——T-027 证据契约）
- `src/types/` / `src/shared/`：领域类型 / 配置、错误码、路径、文本、版本

### 数据流

客户端调用（CLI 子命令 或 MCP 工具调用）→ 入口层 → core Manager（确定性规则）→ storage 读写 `.lrnev/` 下 Markdown（frontmatter 承载元信息、HTML 注释承载 Task 状态机）→ 返回结构化结果 + `ai_followup` 提示。MCP 出口再经 helpers 契约层组装（详见 L2「v3.0.0 架构要点」）。CLI 与 MCP 共用同一套 core，因此“同一份 `.lrnev` 数据两条路都能读写”。

## L2 详情

### 目录结构（仓库层）

- bin/ — 双入口：`lrnev.mjs`（→ dist/cli）、`lrnev-mcp.mjs`（→ dist/mcp，stdio 拉起）
- src/ — 源码（cli / mcp / core / storage / schemas / types / shared，见下节）
- templates/ — 五组模板：scene/、spec/、project/、adr/（.tmpl，含 FILL 哨兵）+ steering/（CORE_PRINCIPLES / MEMORY_TRIGGERS / SCOPE_RULES / ADR_TRIGGERS 引导手册源文件）
- tests/ — unit / integration / e2e + fixtures/；e2e 含 04-00 场景套件（E-01…E-11，自 tests/fixtures/04-00 载入场景契约）与顶层进程级测试（mcp-stdio-lifecycle 真 stdio、report-cli、governance-hardening-fixes）
- tests/e2e/t027-baseline/ — T-027 观测资产：harness 驱动器（harness-mvp）、客户端驱动器与配置契约（claude-code / codex / opencode）、HARNESS-DESIGN + `.evidences/` 契约物——蒸馏 .json/.md 报告入库，原始录制 `*-session.jsonl` 与 `.smoke-results/` 不入库（#9f 分级）
- docs/ — 用户文档：AI-ADAPTATION / ARCHITECTURE / CONFIG / GOVERNANCE-FLOW / HOOKS / MULTI-AGENT + client-integration-guide.md / mcp-response-conformance.md（2026-09-07 自 dev-docs 迁入）+ examples/（lrnev.json / hooks.json 配置样例）
- dev-docs/ — 研发档案：顶层活文档（PRODUCT-STRATEGY / NEXT-STEPS / INTEGRATION-TEST / PUBLISH + E2E-REPORT-{CLAUDE,CODEX,OPENCODE}-V23）+ archive/（历史快照 25 件，含 FINDINGS-CHECKLIST）+ ai-guidance-standardization/（scene 04 研究档案 24 件）
- examples/sample-project/ — CLI 上手教程
- .lrnev/ — 本仓库自身治理档案：本文件与 PROJECT.md、scenes 00-04 数据入库；runtime / state / locks 等运行态目录忽略

### src 模块结构（3.0.0）

- `src/cli/`：index.ts——commander 入口，委托 core（薄包装）
- `src/mcp/`
  - server.ts — `createMcpServer` / `startMcpServer`，含 `--profile` 解析（`parseMcpProfileArg`，支持 `--profile core` 与 `--profile=core`）；连接层 initialize 自动调 agent_register（agent 生命周期）
  - dev-entry.ts — 开发入口（`dev:mcp`）
  - guidance.ts — `WORKFLOW_OVERVIEW` / `TOOL_DESCRIPTIONS` / `buildGuide` 手册
  - tools/index.ts — 18 组注册函数、42 工具；`profile: 'core'` = 33（裁剪 agent_* 与 hook_* 共 9 工具）
  - resources/ — context:// 资源注册与 handlers
  - types/ — response-envelope / output-schemas（信封 + 逐工具 schema）/ decision-context-schema / guidance-profile
  - helpers/ — tool-result-adapter（canonical 信封组装 + 错误转义出口）、model-visible-contract（MVC 渲染注册表 + 唯一转义）、guidance-profile（纯函数库）、renderers/（43 个逐工具渲染器）
- `src/core/`：确定性业务 Manager——Scene / Spec / Task / Gate / ADR / Errorbook / Memory / Summarizer / Searcher / AgentRegistry / ClaimStore / Doctor / HookManager / ProjectStatus / GovernanceMap / GovernanceReport / GoalAssessor / AutoAnalyzer / WorkspaceManager / SessionCommit 等；引导语义模块：SpecGuidance（spec_get 引导）、GateGuidance（gate followup）、guidance-semantics（语义角色类型）、decision-context（客户端声明核对）
- `src/storage/`：FileStorage（目录锁）/ FrontmatterCodec / MarkdownParser / URIRouter / WorkspaceLocator
- `src/schemas/`：evidence-contract.schema.json——T-027 证据契约（与 src/types/evidence-contract.ts 同源）
- `src/shared/`：config / errors / paths / text / version
- `src/types/`：领域类型（scene/spec/task/gate/adr/memory/agent/claim/…）+ decision-context / evidence-contract

### v3.0.0 架构要点

**响应双通道（T-027 真实客户端观测收敛）**：

- structuredContent = canonical 信封：`response_version: '1'` + `ok` / `data` / `errors` / `ai_followup` / `anchor_context` / `summary_context`（response-envelope 类型与 output-schemas schema 同源）；
- content 文本 = MVC 渲染器逐工具渲染（helpers/renderers/ × 43），统一经 `escapeFrameworkMarkers` 唯一转义出口——错误路径同样转义（errors 的 message/hint 不例外），防止文本通道注入框架标记；文本与结构化双通道同源；
- tools/list 全量 outputSchema：42 工具逐一声明，并带 readOnlyHint / idempotentHint / destructiveHint 注解。

**Guidance Profile 语义**：

- 引导文本行带五角色前缀【事实】【建议】【决策边界】【执行约束】【下一步】；核心 guidance-semantics.ts 定义语义输入类型；
- helpers/guidance-profile.ts 纯函数库：`classifyInstructions`（01 文本降级行 → 语义输入）、`buildGuidanceView`（唯一构建源，文本行与结构化 1:1 同源）、`diagnoseGuidance`（冲突显式诊断）；types/guidance-profile.ts 承载契约类型；
- 回退记录：结构化 guidance 的运行时挂载与响应顶层 guidance 字段已回退（T-006 裁决 2026-09-07），传输面收敛为前缀文本行 + 纯函数库；类型与契约测试面保留。

**decision_context（v1 客户端声明通道）**：

- scene_create / spec_create / task_create / assess_goal 四工具的**可选**入参（source 仅 `client_asserted`；strength/direction 条件规则在 handler 内完整校验，失败走 canonical errors 信封）；
- 写前剥离——客户端声明绝不落盘；写后仅做枚举级单次核对（direction / 工具类别 / target_ref），不一致只追加【决策边界】文本行进 ai_followup.instructions——不解析 summary、不阻断、不重写、不输出 USER_DECISION；
- `reported_user_quote` 已按 T-006（I6）从输入契约移除。

**--profile core | full（注册期裁剪）**：

- full = 42（默认，向后兼容）；core = 33：只裁 9 个“AI 不该主动选”的工具——agent_* 自动面（register/heartbeat/unregister/list，连接层 initialize 自动调用）与 lrnev_hook_* 配置面（list/trigger/tail_log/enable/disable，人配置期使用）；task / adr / error / memory / session_commit / doctor / report / guide 全留 core。

### 关键设计约束

- **确定性归代码、判断归 AI**：core 只做规则可判定的事；需判断处通过 `ai_followup` 提示，不替 AI 决策、不调 LLM。
- **CLI/MCP 对等**：两入口必须共用 core Manager，避免能力漂移（历史上出现过 spec_get 引导、task --depends-on、adr --supersedes 仅 MCP 有的不对等，见 FINDINGS-CHECKLIST S1，已随档案入 dev-docs/archive/）。
- **文件即真相 + 并发安全**：Scene/Spec 序号靠目录扫描而非状态文件；写 tasks.md / 分配序号 / 写 claim 用 `FileStorage.withDirectoryLock` 文件级互斥。
- **Gate 只查结构契约**：不判断 prose 质量；ready/completion gate 章节标题须与中文模板完全一致（契约），FILL 哨兵 / 孤儿 / 坏引用等确定性硬校验自 2.0 起为常态。
- **多 Agent 存活按进程生命周期惰性判定**：同主机 pid 探活为主、跨主机 last_heartbeat 兜底；无后台线程、无定时心跳要求。
- **引导有效性取决于送达时刻与动作绑定**：动作点引导（工具描述 / 决策时刻）优先于过程点建议（真机观测 2026-09，scene 04）。
- **行为变更须有测试**：既有 `.lrnev/` 数据持续可读，变更须覆盖——当前 1055 测试 + `typecheck:test` 门禁。

### 外部依赖

- MCP 协议（`@modelcontextprotocol/sdk`）：stdio transport，客户端拉起本进程
- 无数据库、无网络服务、无 LLM/Embedding/向量库；运行时仅 Node 内置 + 少量轻依赖（commander/glob/gray-matter/zod/MCP SDK）
- 可选互补：codegraph（源码知识图谱）——lrnev 管“AI 怎么写代码”的流程治理，codegraph 管源码语义理解，互不调用、分层互补
