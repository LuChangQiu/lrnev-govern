# lrnev-govern 新人 Onboarding 指南

> 面向刚加入项目、要读代码做开发的新人。本指南基于项目知识图谱撰写，帮你快速建立"代码在哪、为什么这么分层、改哪里最容易踩坑"的整体认知。技术术语（MCP/Scene/Spec/Task/Gate/hook/CLI/structuredContent）保留英文。

---

## 1. 项目概览

| 项 | 值 |
| --- | --- |
| 名称 | **lrnev**（npm 包名 `lrnev`，本仓库为 `lrnev-govern`） |
| 语言 | TypeScript（编译目标 ES2022，`src/**` 编译到 `dist`） |
| 框架 | MCP SDK、Commander、Zod、Vitest |
| 版本 | 3.0.0（见 `CHANGELOG.md`，1.0.0 → 3.0.0 演进） |
| 运行要求 | Node ≥ 20 |

**一句话定位**：lrnev 是面向 AI 协作开发的**确定性项目治理引擎**——提供 Scene→Spec→Task 三级结构与 creation/ready/completion Gate 门禁，档案全部是 `.lrnev/` 下的普通 Markdown，**零模型（LLM）依赖**，理解与判断的工作经 `ai_followup` 回传给 AI。

**双入口形态**：同一个 npm 包同时提供两个 bin——

- CLI：`bin/lrnev.mjs`（`lrnev <子命令>`）
- MCP server：`bin/lrnev-mcp.mjs`（stdio 启动）

两者**共享同一套 `src/core` 业务逻辑**，MCP/CLI 只是薄包装。3.0.0 引入的关键契约级变化包括：MCP 双通道响应（structuredContent canonical 信封 + 逐工具文本渲染器）、五角色引导语义、`--profile core|full` 工具面分层、F-04 截断元数据、hook drain、`decision_context`。改动前先读 `CHANGELOG.md` 了解破坏性变更与迁移点。

---

## 2. 架构分层

源码按 `bin` 入口 + `src` 下 `core / storage / mcp / cli / types / schemas / shared` 组织。核心心智模型一句话：**core 是唯一业务逻辑层，storage 是 Markdown 存储底座，mcp/cli 只做薄包装，types/shared 是全仓共享契约**。图谱共 231 个文件级节点，以下每层只列最有代表性的文件。

### 2.1 文档与治理说明（documentation）

仓库说明与治理语义的权威出处，新人应优先读：

- `README.md` — 主 README：定位、5 分钟上手、核心概念、3.0.0 MCP 双通道响应契约、工具/CLI 速查与文档地图。
- `docs/ARCHITECTURE.md` — **理解代码库结构的索引文档**：core/storage/mcp/cli 分层原则与完整目录树。
- `docs/GOVERNANCE-FLOW.md` — Gate 语义、填空哨兵、ID 语义、Spec/Task 状态机、validates 锚点的**权威说明**。
- `docs/HOOKS.md` — hooks 配置、事件、日志与 drain 语义。
- `docs/MULTI-AGENT.md` — 多 Agent 协作的三层核心模型（tasks.md / registry.json / claims）。
- `docs/AI-ADAPTATION.md` — 42 个工具如何适配不同 AI 客户端、core/full 工具面分层、适配验收框架。
- `docs/CONFIG.md` — `.lrnev/config/lrnev.json` 配置覆盖合并规则与各配置组。
- `CHANGELOG.md` / `CONTRIBUTING.md` — 演进历史与贡献规范。

### 2.2 项目配置与工具链（project-config）

- `package.json` — 双 bin 声明（`lrnev` / `lrnev-mcp`）、scripts、依赖（MCP SDK、Commander、glob、gray-matter、zod）。
- `tsconfig.json` — strict + noUncheckedIndexedAccess 等严格选项（**全仓强制**）。
- `tsconfig.test.json` — 测试与 src 同 strict 类型门禁（noEmit 纯检查）。
- `vitest.config.ts` — 测试运行配置。
- `scripts/` — 一次性扫描/校验脚本（`scan-guidance-surfaces.ts`、`validate-evidence-manifest.mjs` 等，多为研究期工具，改动前先确认是否仍在使用）。

### 2.3 CLI 与 MCP 接入层（interfaces）

对外接入面，只做装配与协议转换，**不写业务逻辑**：

- `bin/lrnev.mjs` / `bin/lrnev-mcp.mjs` — 进程入口；MCP 的 stdout 是协议通道，**错误必须走 stderr**。
- `src/cli/index.ts` — CLI 命令层全景（guide/init/scene/spec/task/adr/goal/…几十个子命令），fan-out 极高，读它可快速看到整个治理命令面。
- `src/mcp/server.ts` — MCP 服务入口：装配 McpServer、注册 resources/tools、管理"连接即注册 agent / 断开即注销并释放 claim"的会话生命周期、`--profile core|full` 工具面裁剪、退出统一 drain。
- `src/mcp/tools/index.ts` — **工具注册中心（约 42 个 `lrnev_*` 工具）**，统一经 `getManagers` 注入 core 管理器、经 tool-result-adapter 双通道返回。
- `src/mcp/helpers/model-visible-contract.ts` — 每个工具结果渲染为"模型可见正文"的注册中心（MVC 契约）。
- `src/mcp/helpers/renderers/*` — 43 个逐工具文本渲染器（每个工具一个文件，如 `spec-get.ts` 是理解渲染器模式的最佳代表）。
- `src/mcp/helpers/tool-result-adapter.ts` — 业务结果 → MCP content + structuredContent + isError 的适配器。
- `src/mcp/types/response-envelope.ts` / `output-schemas.ts` — canonical 信封定义与严格输出 Schema 库。
- `src/mcp/resources/` — `context://` URI 资源注册与读取（L0/L1/L2 分层）。
- `src/mcp/guidance.ts` / `src/mcp/helpers/guidance-profile.ts` — 引导正文组装与角色化引导视图。

### 2.4 核心治理领域（core-governance）

**全仓唯一业务逻辑层**，CLI 与 MCP 两个入口都调它。`src/core/index.ts` 是统一出口（fan-in 很高，值得先看）。

- **三级档案**：`SceneManager.ts`、`SpecManager.ts`、`TaskManager.ts`（本仓最大模块，还承载 claim/release 并行上下文与 AI followup 引导）。
- **Gate 门禁**：`GateRunner.ts`（creation/ready/completion 三档纯结构校验）+ `GateGuidance.ts`（通过/失败后的模型指引）。
- **Hooks**：`HookManager.ts`（全生命周期）、`HookRunner.ts`（执行单个命令）、`DetachedHookTracker.ts`（drain 未等待的 async hook）、`HookLog.ts`（JSONL 日志与轮转）。
- **轻产物**：`ADRManager.ts`（架构决策）、`ErrorbookManager.ts`（踩坑记录，指纹去重）、`MemoryManager.ts`（五类记忆）。
- **多 Agent 运行态**：`AgentRegistry.ts`（存活判定 + 机会式 GC）、`ClaimStore.ts`（Task claim 租约）。
- **接手与体检**：`ProjectStatus.ts`（project_status 快照）、`GovernanceMap.ts`（全景地图）、`GovernanceReport.ts`（治理体检）、`Doctor.ts`（健康诊断）。
- **其它**：`Searcher.ts`（BM25 搜索）、`SessionCommit.ts`、`AutoAnalyzer.ts`（仓库技术栈分析）、`WorkspaceManager.ts`、`Summarizer.ts`（L0/L1 摘要）、`guidance-semantics.ts`（**给模型的引导语义常量，CLI/MCP 共用**）、`decision-context.ts`（决策边界构造）。

### 2.5 存储与 Markdown 基础设施（storage）

"文件即真相"的底座，保证一切档案可 git、无数据库：

- `WorkspaceLocator.ts` — 按 `env.LRNEV_WORKSPACE` > 向上找 `.lrnev/PROJECT.md` > cwd 三档定位工作区。
- `FileStorage.ts` — 文件系统抽象（全仓 fan-in 最高）：原子写（tmp+rename）、越界防护、独占目录锁。
- `FrontmatterCodec.ts` — YAML frontmatter 编解码（手工构造 YAML 行避免 diff 抖动）。
- `MarkdownParser.ts` — 按 `##` 章节切分（供 L0/L1/L2 分层加载），识别代码区间用于行号定位。
- `URIRouter.ts` — `context://` URI 与工作区相对路径双向路由。

### 2.6 共享类型与工具（shared-contracts）

- `src/shared/config.ts` — `DEFAULT_CONFIG` 是全部阈值/限制的唯一默认来源（**配置唯一权威**）。
- `src/shared/errors.ts` — 约 18 种错误码 `ErrorCode` + `LrnevError`（core/storage 抛错、MCP/CLI 转响应）。
- `src/shared/paths.ts` — `.lrnev/` 全部标准子路径的唯一定义。
- `src/types/` — 领域类型契约全集，`index.ts` barrel 统一出口（`import type { Scene, Spec, Task } from '../types/index.js'`）；重点：`response.ts`（ai_followup 协议）、`truncation.ts`（F-04 三态/四件套）、`task.ts`/`spec.ts`（状态机转换表）、`hooks.ts`、`gate.ts`。
- `src/schemas/evidence-contract.schema.json` — guidance 消费证据的 JSON Schema（draft-07，严格收紧）。

### 2.7 模板与示例项目（templates-examples）

- `templates/` — 治理文档模板（`adr/`、`project/`、`scene/`、`spec/`、`steering/`），是理解 `.lrnev` 文件结构的"活字典"。
- `templates/steering/` — 写入工作区的 AI 行为契约（`CORE_PRINCIPLES.md`、`ADR_TRIGGERS.md`、`MEMORY_TRIGGERS.md`、`SCOPE_RULES.md`）。
- `examples/sample-project/README.md` — 端到端上手教程（初始化→spec→gate→task→report 最小闭环）。

### 2.8 测试与回归验证（tests）

- `tests/unit/` — 各 Manager/存储/渲染器单元测试；`tests/unit/renderers/batch1~4B.test.ts` 批量覆盖 43 个渲染器。
- `tests/integration/` — 协议与跨入口契约测试：`cli-mcp-interoperability.test.ts`（双入口数据互通）、`mcp-protocol-contract.test.ts`、`guidance-*.test.ts`、`decision-context-tools.test.ts`。
- 代表文件：`task-manager.test.ts`（批内最大）、`spec-manager.test.ts`、`mcp-server.test.ts`、`tool-descriptions.test.ts`（工具自描述审计）。

---

## 3. 关键概念

以下概念从 `src/types`、`src/core`、`src/mcp` 与 `templates/steering` 提炼，是读懂代码与上手治理的钥匙。

### 3.1 文件即真相、URI 是别名（零模型）

所有数据真相存于 `.lrnev/` 下的 Markdown/JSON 文件，`context://` URI 只是稳定访问别名。改动应调对应 MCP 工具或 CLI 子命令，**不要绕过工具手编文件**（除非用户明确要求）。lrnev 自身零 LLM 依赖：不做判断、不写正文，把"下一步该做什么"经 `ai_followup` 回传。设计原则浓缩为"确定性归 lrnev、判断性归 AI"。

### 3.2 Scene → Spec → Task 三级生命周期

- **Scene**：业务域边界容器（`.lrnev/scenes/{NN-name}/`），含 scene.md/architecture.md/roadmap.md。
- **Spec**：独立可交付特性包（requirements.md / design.md / tasks.md 三文档），用 `#### F-xx`（功能）与 `#### D-xx`（设计）锚点组织需求。
- **Task**：最小工作单位（`### T-XXX`），用 `validates` 引用 F-/D- 锚点做**存在性硬校验**，支持 parent/children 层级与 `task_create_many` 两阶段原子批量创建。
- **状态机**：Spec 五态 `draft → ready → in-progress → completed → archived`（archived 只由用户定）；Task 五态 `pending → in_progress → completed / blocked / failed`。非法转换被拒绝，须用 `spec_update` / `task_update` 走状态机（见 `src/types/spec.ts` / `task.ts` 的 `VALID_*_TRANSITIONS`）。

### 3.3 Gate 三档门禁：只查结构、不判质量

`GateRunner` 对 creation / ready / completion 三类 gate 做**纯结构校验**：必填字段、章节标题与中文模板一致、FILL 哨兵残留、未勾选项。Gate 不读 spec.status 也不评 prose 质量，通过后由 `ai_followup` 引导人工审核与状态回填。**Gate 失败先修不绕过**（steering 核心原则之一）。

### 3.4 MCP 双通道响应契约（canonical 信封）

每次工具调用返回两条通道：

- `structuredContent` — canonical 信封 `LrnevToolPayload`：`response_version / ok / data / errors / ai_followup / anchor_context / summary_context`，只给机器解析。
- `content` — 按工具渲染的模型可见文本，供 AI/人直接读。

信封定义在 `src/mcp/types/response-envelope.ts` 与 `src/mcp/types/output-schemas.ts`（严格 Schema 库，禁止无约束 `Record` 冒充）；错误路径 `ok=false` → `isError=true`。

### 3.5 ModelVisibleContract 渲染器与 __error__ 逃逸

`src/mcp/helpers/model-visible-contract.ts` 注册每个工具的渲染器（43 个，`renderers/*` 一个工具一个文件），把同一份 canonical 结果渲染成"模型可见正文"；未注册时回退默认。错误路径统一走 `__error__` 渲染出口（D-04 逃逸契约），保证 `isError=true` 的响应仍满足 MVC。**渲染器只投影 canonical payload，不创作 guidance 文本**——这是改渲染器时最该守住的边界。

### 3.6 ai_followup：写入工具的回传待办

`AiFollowupResponse` = 业务数据 + 待办指令/工具建议 + 错误/警告（见 `src/types/response.ts`）。每个写入工具响应里的 `ai_followup.instructions` 是给 AI 的后续待办（通常含生成 L0/L1 摘要并调 `summarize_save`），**不执行等于工作未完成**。

### 3.7 显式截断元数据（F-04）

返回内容因体积预算或源残缺而"给一部分"时显式标注而非静默省略：段落级 `text_status` 三态（`complete / truncated_by_budget / incomplete_source`）+ 长度，查询级 `QueryMeta` 四件套（`returned_count / total_count / truncated / omitted`）。类型定义在 `src/types/truncation.ts`（ADR-0001，ClaudeCode/Codex/DeepSeek 三方统一确认）。

### 3.8 引导语义与工具面分层（core/full）

- **只引导、不强制**：`src/core/guidance-semantics.ts` 集中定义给模型的治理引导语义常量（角色前缀、enforcement 值、用户决策优先子句），CLI 与 MCP 共用；05-00 Guidance Profile 用 `role` 化文本行给不同 Agent 呈现对应引导段，只经 `ai_followup.instructions/content` 通道，不持久化、不挂 payload。
- **工具面分层**：`lrnev-mcp` 注册期按 `--profile` 裁剪工具面——默认 full 42 个，core 33 个裁掉 9 个"AI 不该主动选"的工具（`agent_*` 自动面 4 个 + `lrnev_hook_*` 配置面 5 个）；只接受 `core|full`，非法取值启动即报错。
- **decision_context**：写入类工具可选接收客户端决策上下文（source/strength/direction/target_ref，见 `src/mcp/types/decision-context-schema.ts`），合法则追加事实/决策边界行不阻断，非法则 canonical `INVALID_INPUT` 错误信封且无落盘副作用。

### 3.9 Agent 会话生命周期与机会式 GC

stdio MCP 连接**初始化时自动注册 agent、断开时自动注销并释放其 claims**，客户端无需手动心跳。存活以进程生命周期为主信号：同主机用 `process.kill(pid,0)` 探活；跨主机回退 last_heartbeat 90 秒阈值。register 时做**机会式 GC** 清扫死 agent 与过期 claim，只读路径零写副作用。类型在 `src/types/agent.ts`，实现在 `src/core/AgentRegistry.ts`。

### 3.10 Task Claim 软占用

`.lrnev/runtime/claims/` 记录"谁正在做哪个 Task"（含 claimed_by/expires_at/touches_files）。活跃 agent 已 claim 时再次 claim 返回**软 conflict 不硬阻止**；TTL 过期或属主 dead 即被接手。删除 claims 目录只丢"谁在做"的现场提示、不影响 tasks.md 真相。实现见 `src/core/ClaimStore.ts`。

### 3.11 Hooks 事件系统与 drain

`.lrnev/config/hooks.json` 配置 name/event/command 等；事件覆盖 spec.create、task.update.*（后缀 `*` 前缀匹配）、spec.gate_passed.*、adr.create、error.record 等生命周期。mode async（默认，立刻返回）与 sync（阻塞主流程），`on_failure` abort/warn/silent。每次执行写 `hook-log.jsonl`（status 五态），超 10MB 自动 gzip 轮转；进程退出 **drain 最多等 async hook 5 秒**、超时补写 timed_out，日志不静默丢失。实现在 `src/core/HookManager.ts` / `HookRunner.ts` / `DetachedHookTracker.ts`。

### 3.12 scope 与轻产物分工（ADR / Errorbook / Memory）

- **scope**：写入默认 `global`；仅当内容只在某 Scene 内成立/引用 Scene 特有术语/用户明示时才写 `scene:{id}`。不确定加 `tentative` 标记，可用 promote/demote 在 global 与 scene 间升降。
- **ADR**：A/B 选型、拒绝方案、推翻旧决定（supersedes）、引入新依赖、设全局约束——这五类决策点才记 ADR（见 `templates/steering/ADR_TRIGGERS.md`）。
- **Errorbook**：Bug/踩坑按指纹去重（`src/core/ErrorbookManager.ts`）。
- **Memory**：五类记忆 preferences/decisions/patterns/errors/facts（`src/types/memory.ts`），对话告一段落或超 50 轮时经 `session_commit` 落盘。

---

## 4. 引导导览（10 步）

按图谱推荐的阅读顺序走一遍，即可从"整体认知"推进到"代码可运行的故事"。

**第 1 步 · 项目概览：确定性治理引擎**
读 `README.md` 与 `CHANGELOG.md`。先建立 Scene→Spec→Task + Gate 的整体认知，再看 v3.0.0 的 MCP 双通道响应等契约级变化，为读代码铺垫。

**第 2 步 · npm 打包与双入口**
`package.json` 声明 `lrnev` 与 `lrnev-mcp` 两个 bin；`bin/lrnev.mjs` 加载 dist 的 `runCli`；`bin/lrnev-mcp.mjs` 以 stdio 启动 `startMcpServer`（stdout 是 MCP 协议通道，错误必须走 stderr）。记住"薄入口 + 共享核心"。

**第 3 步 · CLI 命令层全景**
`src/cli/index.ts` 是全仓 fan-out 最高的文件之一，把几十个子命令组装成统一 CLI。它不做业务，只把参数翻译成对 core 管理器的调用——浏览它即可看到整个治理命令面。

**第 4 步 · MCP 服务装配与工具注册中心**
`src/mcp/server.ts` 是 MCP 侧入口（会话生命周期、resources/tools 注册）；`src/mcp/tools/index.ts` 按类别注册约 42 个 `lrnev_*` 工具，统一经 `getManagers` 注入 core 管理器——这是 AI 客户端实际触碰的第一层。

**第 5 步 · 核心治理层：三级档案**
`src/core` 是全仓唯一业务逻辑层，`src/core/index.ts` 是其统一出口。`SceneManager.ts`/`SpecManager.ts`/`TaskManager.ts` 对应三级档案管理（编号分配、状态机、锚点校验）；`TaskManager.ts` 是本仓最大模块，还承载 claim/release 并行上下文。

**第 6 步 · Gate 门禁与自动化钩子**
`src/core/GateRunner.ts` 对 creation/ready/completion 三档 gate 做纯结构校验（必填字段、FILL 哨兵、未勾选项），并聚合 hook 警告生成结果；`src/core/HookManager.ts` 提供本地自动化扩展点（如 task.update 事件），让收口门禁能把外部校验纳入。

**第 7 步 · Markdown 即真相：存储底座**
`src/storage/WorkspaceLocator.ts`（三档定位工作区）、`src/storage/FileStorage.ts`（全仓 fan-in 最高 57 的文件系统抽象：原子写、越界防护、目录锁）、`src/storage/FrontmatterCodec.ts`（frontmatter 读写）。三者共同保证"文件即真相、可 git、无数据库"。

**第 8 步 · v3 双通道响应：信封与渲染器**
`src/mcp/types/response-envelope.ts` 定义 canonical 信封；`src/types/response.ts` 定义 ai_followup 协议；`src/mcp/helpers/model-visible-contract.ts` 注册每个工具的渲染器把同一份结果渲染成模型可见正文；`src/mcp/helpers/renderers/spec-get.ts` 是理解渲染器模式的最佳代表。

**第 9 步 · 引导语义与工具面分层**
`src/core/guidance-semantics.ts` 集中定义引导语义常量（CLI/MCP 共用）；`src/mcp/helpers/guidance-profile.ts` 为不同 Agent 构建可见引导视图并支撑 `--profile core|full` 工具面分层；`src/mcp/guidance.ts` 把常量片段拼装成 `lrnev-guide` 正文。整条链路回答"只引导、不强制"如何落到模型可见层。

**第 10 步 · 权威文档与端到端示例**
`docs/ARCHITECTURE.md`（分层原则）、`docs/GOVERNANCE-FLOW.md`（Gate/填空哨兵/ID 语义权威说明）、`docs/AI-ADAPTATION.md`（多客户端适配）、`examples/sample-project/README.md`（把"初始化→spec→gate→task→report"最小闭环从头跑一遍）。读完，前 9 步的代码就成了可运行的完整故事。

---

## 5. 文件地图

与第 2 节互补的速查索引——按"先读什么、改什么看哪里"组织，聚焦核心文件。

### 5.1 入口与装配

| 文件 | 作用 | 新人注意 |
| --- | --- | --- |
| `bin/lrnev.mjs` / `bin/lrnev-mcp.mjs` | 进程入口 | MCP stdout 是协议通道，日志/错误一律走 stderr |
| `src/cli/index.ts` | CLI 子命令装配 | 只翻译参数，别在这里加业务 |
| `src/mcp/server.ts` | MCP server 装配 + 会话生命周期 | 断开自动注销 agent 并释放 claim |
| `src/mcp/tools/index.ts` | 42 个工具注册中心 | 新增工具要在此注册并经 adapter 双通道返回 |
| `src/mcp/guidance.ts` | `lrnev-guide` 正文组装 | 只投影常量片段，不创作新文本 |

### 5.2 响应契约与渲染（3.0.0 核心，最容易被新人改坏）

| 文件 | 作用 |
| --- | --- |
| `src/mcp/types/response-envelope.ts` | canonical 信封 `LrnevToolPayload` + isError 映射 |
| `src/mcp/types/output-schemas.ts` | 严格输出 Schema 库 + 信封工厂 |
| `src/mcp/helpers/tool-result-adapter.ts` | 业务结果 → content + structuredContent + isError 适配 |
| `src/mcp/helpers/model-visible-contract.ts` | 渲染器注册中心（MVC 契约） |
| `src/mcp/helpers/renderers/<tool>.ts` | 每个工具一个文本渲染器（43 个） |
| `src/mcp/types/decision-context-schema.ts` | decision_context 输入校验（纯校验无副作用） |
| `src/types/response.ts` / `src/types/truncation.ts` | ai_followup 协议 / F-04 截断元数据 |

### 5.3 治理领域（src/core）

| 文件 | 作用 |
| --- | --- |
| `src/core/index.ts` | core 统一出口 barrel |
| `SceneManager.ts` / `SpecManager.ts` / `TaskManager.ts` | 三级档案管理（TaskManager 最大） |
| `GateRunner.ts` / `GateGuidance.ts` | 门禁执行 / 结果后模型指引 |
| `ADRManager.ts` / `ErrorbookManager.ts` / `MemoryManager.ts` | ADR / Errorbook / Memory 轻产物 |
| `AgentRegistry.ts` / `ClaimStore.ts` | agent 存活与 GC / claim 租约 |
| `HookManager.ts` / `HookRunner.ts` / `HookLog.ts` / `DetachedHookTracker.ts` | hook 生命周期、执行、日志、drain |
| `ProjectStatus.ts` / `GovernanceMap.ts` / `GovernanceReport.ts` / `Doctor.ts` | 接手快照 / 全景地图 / 体检 / 诊断 |
| `guidance-semantics.ts` / `decision-context.ts` | 引导语义常量 / 决策边界构造 |
| `Searcher.ts` / `SessionCommit.ts` / `AutoAnalyzer.ts` / `Summarizer.ts` | 搜索 / 会话提交 / 自动分析 / 摘要 |

### 5.4 存储与共享（src/storage、src/shared、src/types）

| 文件 | 作用 |
| --- | --- |
| `src/storage/WorkspaceLocator.ts` | 工作区定位与幂等骨架 |
| `src/storage/FileStorage.ts` | 原子写/越界防护/目录锁（核心依赖） |
| `src/storage/FrontmatterCodec.ts` / `MarkdownParser.ts` / `URIRouter.ts` | frontmatter / 章节解析 / URI 路由 |
| `src/shared/config.ts` | `DEFAULT_CONFIG`（配置唯一权威） |
| `src/shared/errors.ts` / `paths.ts` | 错误码 / `.lrnev/` 路径常量 |
| `src/types/index.ts` + 各领域类型 | 全仓类型契约（改结构先改这里） |

### 5.5 测试（tests）

- 单元：`tests/unit/`（每个 Manager 一个文件）；渲染器批量：`tests/unit/renderers/batch1~4B.test.ts`。
- 集成：`tests/integration/cli-mcp-interoperability.test.ts`（双入口数据互通——验证"改 core 两条入口都生效"）、`mcp-protocol-contract.test.ts`（协议契约）。
- **改契约必跑**：`data-output-contract.test.ts`（Manager 输出喂给 DataSchema）、`tool-descriptions.test.ts`（工具自描述审计）、`renderers/*`（文本渲染）。

---

## 6. 复杂度热点（新人易踩坑区）

从图谱 complex 热点中挑出最值得小心的文件。共性是：**要么是全仓枢纽（fan-in/fan-out 高）、要么夹着严格的协议/语义契约**，改动影响面远超文件本身。

| 文件 | 为什么复杂 | 新人易踩的坑 |
| --- | --- | --- |
| `src/core/TaskManager.ts` | 本仓最大模块：Markdown 任务块解析与重写、状态机、锚点校验、claim 并行上下文、AI followup 拼接 | 手改 `tasks.md` 文本结构易破坏解析；新增返回字段要先过 `output-schemas` 的 DataSchema |
| `src/mcp/tools/index.ts` | 约 42 个工具注册中心：getManagers 装配、双通道返回、decision_context 校验、full/core 工具面 | 加工具漏了注册/漏配 profile 分层/漏了渲染器，工具会"静默不可见" |
| `src/mcp/helpers/tool-result-adapter.ts` | 业务结果 → 双通道 + isError 的唯一适配口；错误统一走 `__error__` 逃逸出口（D-04） | 在业务层手拼 content 绕过 MVC，或错误路径不走 `__error__` 造成逃逸契约破坏 |
| `src/mcp/types/output-schemas.ts` | 严格 Schema 库：信封公共件 + 全部工具业务 schema 工厂 | 业务 data 与 schema 漂移会被 `data-output-contract.test.ts` 拦下；用无约束 `Record` 冒充过不了 review |
| `src/core/decision-context.ts` | 构造事实/建议/决策边界多通道上下文，比较声明与调用的 direction/targetRef 并渲染不一致边界行 | decision_context 只经文本通道、**不持久化**；误把它写进 `.lrnev` 即违反集成测试哨兵 |
| `src/mcp/helpers/guidance-profile.ts` | 解析/归并角色、为不同 Agent 构建可见引导视图、诊断 enforcement 覆盖 | "只引导不强制"边界：payload/outputSchema 不得再挂 guidance 文本 |
| `src/core/HookManager.ts`（+ `HookRunner.ts`） | hook 事件匹配、sync/async 驱动、detached 跟踪、超时记录、drain | async hook 在进程退出前可能丢失——必须经 DetachedHookTracker 登记；改命令执行方式要兼顾跨平台 |
| `src/core/AgentRegistry.ts` / `ClaimStore.ts` | 存活判定（本机 pid 探活 vs 跨主机心跳）、机会式 GC、TTL/可回收判定、registry 落盘加锁 | GC 判死过激会误删活跃 agent；只读路径不能产生写副作用 |
| `src/core/GateRunner.ts` | creation/ready/completion 三类结构校验 + 章节 sentinel + hook 警告聚合 | Gate 只查结构不判质量、不读 spec.status——别在这里加"质量判断" |
| `src/storage/FileStorage.ts` | 全仓 fan-in 最高（57）：原子写、越界防护、独占锁、frontmatter 块 | 绕过它直接写 `.lrnev/` 会丢原子性与锁保护；路径越界防护是所有写操作的安全底线 |
| `src/storage/MarkdownParser.ts` | 章节切分 + 代码区间识别 + L0/L1/L2 分层 | 标题层级/围栏识别错位会直接影响锚点定位与分层读取 |
| `src/storage/URIRouter.ts` | 八类 `context://` URI 双向路由（ADR 编号转四位前缀等） | URI 是"别名不是真相"——新增资源类型要同步 filePath↔URI 两个方向 |
| `src/shared/config.ts` | `DEFAULT_CONFIG` 是全部阈值的唯一默认来源；子集深合并 | 新增可配置项必须落 DEFAULT_CONFIG 并同步 `docs/CONFIG.md`；协议契约不可配置 |
| `src/cli/index.ts` | 几十个子命令的 fan-out 中枢 | 命令只做参数翻译，业务仍归 core；输出通道 text/markdown/json 要一致 |
| `src/types/evidence-contract.ts` | 36 properties 证据契约（只增不改删 v1）+ DecisionContext 观测形状 | 破坏性删字段会与 `evidence-contract.schema.json` 及历史资产脱节 |

**补充提醒**（虽不在 complex 名单但契约密集，改前必读）：`src/mcp/types/response-envelope.ts`、`src/mcp/helpers/model-visible-contract.ts`、`src/mcp/server.ts` 分别把守信封、渲染注册与会话生命周期，它们"看着简单"但一动就牵动 42+ 工具与全部集成测试。

---

图谱由 /understand 生成（commit 8b8c2d6），代码变化后可重新运行更新。
