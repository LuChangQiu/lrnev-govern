---
scene: '02-context-delivery'
created: '2026-06-15'
---

# Context Delivery - 架构

> 本文档描述本 Scene 内所有 Spec 共享的架构约束。
> 单个 Spec 的具体设计在各自的 design.md 中。

## L0 摘要

零模型、零新依赖：复用 `ai_followup` 协议与 scene 01 的 S6 锚点基础设施，在「使用时刻」（任务启动 / 定位 / 回报）把已有治理数据递给 AI；所有改动 CLI 与 MCP 输出对等。

## L1 概览

### 关键模块

- **TaskManager**（`src/core/TaskManager.ts`）：followup 构造器 `buildFollowupAfterUpdate` / `buildClaimResponseFollowup`——F-03 锚点回填的两个入口；已有 `findBadValidatesAnchors` / `badAnchorWarning` 坏锚点软告警（F-03 漂移降级复用、并补到 claim 入口）。
- **GateRunner + `buildPassedGateFollowup`**（`src/core/GateRunner.ts` / `src/mcp/tools/index.ts`）：ready gate passed 的 followup——F-02 需求审核门接入点。
- **Searcher**（`src/core/Searcher.ts`）：02-00 的 BM25（`scoreText`）与锚点抽段（`makeSnippet`）改造点。
- **共享锚点工具**：`extractAnchorPool`（S6 已有，返回 ID 集合）+ `extractAnchorSections`（01-00 新增，返回 ID→段落映射），供回填 / 地图 / 抽段复用。
- **响应契约 `AiFollowupResponse`**（`src/types/response.ts`）：F-03 顶层新增 `anchor_context`。
- **guidance**（`src/mcp/guidance.ts`）+ `CLAUDE.md` / `docs/AI-ADAPTATION.md`：分流指引文案。

### 数据流

同一套锚点工具贯穿三个时刻：**写入时**（create）S6 挡坏锚点引用 → **使用时**（`task_update(in_progress)` / `task_claim`）解析 `validates` 锚点、从 requirements/design 抽段、作为 `anchor_context` 随返回送达 AI → **定位时**（map / search）聚合 frontmatter + 锚点标题成地图、命中时返回锚点段落。

### 技术决策

- **零模型 / 零新依赖**：是身份不是省钱；治理语料小而结构强，精确派打得过模糊语义。
- **不背向后兼容**：产品还年轻，破坏性改动直接上（如 `AiFollowupResponse` 加 `anchor_context` 字段、改 search 返回结构），迁移交给 `doctor --migrate-*`，不写「不破坏旧消费方」的对冲。
- **`ai_followup` 只引导不强制**：「绕过」是用户的权利，「遗忘」靠 followup 消灭；F-02 审核门是 followup 不是 block。
- **锚点工具沉淀为共享**：不复用 S6 的 IO（校验在 create 时刻、回填在启动时刻，调用不同），复用的是定位逻辑。

## L2 详情

### 模块详细设计

（按需展开）

### 接口契约

- `AiFollowupResponse` 顶层新增可选 `anchor_context: { anchor, source: 'requirements'|'design', text, truncated }[]`（F-03）。
- `context_search` 返回新增 `anchor` 字段 + 段落级 snippet（02-00 F-02）。
- 所有改动 CLI JSON 与 MCP 工具输出对等（S1 原则）。

### 非功能性要求

- 性能：全量扫描数千个小 md 仅几十毫秒，IO 非瓶颈；F-03 启动至多 2 次小文件读取（按 `validates` 实际涉及裁剪）；BM25 纯算术；地图只读 frontmatter + 标题行不读正文。
- 可用性：所有降级（无 validates / 锚点漂移 / 无摘要）一律不报错、不阻断，只软告警。
- 安全性：纯本地文件读写、纯只读能力（地图 / report）；无外部 IO、无环境侵入。
