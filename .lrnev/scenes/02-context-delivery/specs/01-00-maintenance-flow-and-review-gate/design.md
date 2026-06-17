---
spec: '01-00-maintenance-flow-and-review-gate'
scene: '02-context-delivery'
created: '2026-06-15'
---

# 01-00 维护态流程 + 需求审核门 + 任务启动上下文 - 设计

> 设计依据：已核源码（`src/core/TaskManager.ts`、`src/core/GateRunner.ts`、`src/mcp/tools/index.ts`、`src/core/SpecManager.ts`、`src/types/response.ts`、`src/mcp/guidance.ts`）+ requirements F-01~F-04。

## L0 摘要

三处改动都落在已有的 followup 构造路径上，只新增一个共享锚点抽段函数与一个可选返回字段：不改 gate 判定、不改状态机、不加 API/flag。

## L1 概览

### 架构思路

- 复用既有 `ai_followup` 通道（"只引导不强制"）：F-01/F-02/F-04 是纯文案增量；F-03 是"内容随返回送达"——新增结构化字段 + 启动时抽段。
- 锚点抽段与 S6 的 `extractAnchorPool` 同族：**不复用其 IO**（校验在 create 时刻、回填在启动时刻，调用不同），复用定位逻辑，沉淀为共享工具供 02-00 复用。
- 增量优先扩展现有路径而非新建：F-01 的 completed 回退提示、F-03 的漂移告警在 `task_update` 入口已部分存在，本设计补缺口（`task_create` / `task_claim`），不重造。

### 主要模块

- `TaskManager.create`（followup instructions，`:200`）、`TaskManager.update` → `buildFollowupAfterUpdate`（`:927`）、`TaskManager.claim` → `buildClaimResponseFollowup`（`:1038`）。
- `findBadValidatesAnchors`（`:431`）+ `buildFollowupAfterUpdate` 的 `badAnchorWarning`（`:938`）：F-03 漂移告警复用点。
- `buildPassedGateFollowup`（`src/mcp/tools/index.ts:879`，`gate==='ready'` 分支 `:883`）：F-02 接入点。
- `SpecManager.create`（followup instructions，`:268`）：F-01/F-04 分流文案接入点。
- `AiFollowupResponse`（`src/types/response.ts:17`）：F-03 顶层新增字段。
- `extractAnchorPool`（`TaskManager.ts:527`）：新增 `extractAnchorSections` 的同族基准。
- `guidance.ts` 分流摘要（`:6`）+ `docs/AI-ADAPTATION.md` 常驻提示词模板片段（产品不持有 CLAUDE.md）：常驻文案。

### 关键决策

| 决策 | 取舍 | ADR? |
|------|------|------|
| `anchor_context` 放 `AiFollowupResponse` 顶层 | `ai_followup` 无 data 字段，只能放顶层；改共享契约、影响所有工具返回形状，但不背向后兼容（破坏性直接上，迁移交 doctor） | 视需要 |
| 审核门用 followup 不用 block | "绕过"是用户权利，"遗忘"靠 followup 消灭 | 否 |
| 截断起始值保守（段 400 / 总 1200 / D-xx 首行） | 放宽容易收紧难，真机用后再调 | 否 |

## L2 详情

### 模块详细设计

#### D-01 分流铺显与维护态落位（F-01 / F-04）

- `spec_create` followup（`SpecManager.create` 的 instructions）：追加四路分流指引 + "先 context_search 确认是否该落位到现有 spec"。
- `task_create` followup（`TaskManager.create:200`，现 instructions 不读 spec 状态）：**新增分支**——读所在 spec 的 status，若为 completed，追加"completed→in-progress 表示有未完成工作，可调 spec_update 回退"提示。注意 `task_update(in_progress)` 入口已有同款提示（`buildFollowupAfterUpdate` 在 specStatus=completed 时，`:961`），本设计**只补 create 入口**，不重造。
- 常驻文案：`guidance.ts` 分流摘要从二元（开 spec / 直接做）改为四路（有域 scene 开 spec / 00-default 开 spec / 落位已有 spec / 不开就一个 commit）；同步 `docs/AI-ADAPTATION.md` 的常驻提示词模板片段（产品不持有 CLAUDE.md，该片段供用户贴入自己的 CLAUDE.md）。

#### D-02 需求审核门（F-02）

- `buildPassedGateFollowup` 的 `gate==='ready'` 分支：instructions 追加强制停语——"**请暂停，把 requirements.md 展示给用户确认后再继续**——这是用户审核'做什么'的唯一机会；如用户明确说'直接做'则跳过。"
- `completion` / `creation` 分支不动。
- 落位到已有 spec 加 task 不经此路（只在 ready gate passed 触发），天然满足 F-04 边界，无需额外判断。

#### D-03 任务启动锚点回填（F-03）

- **新增 `extractAnchorSections(content, prefix)`**：返回 `#### F-xx` / `#### D-xx` 标题行到下一个同级或更高级标题之间的正文，输出 ID→段落映射。与 `extractAnchorPool` 同正则家族（`^####\s+(F|D)-\d+`），新增到 `TaskManager.ts` 导出（或 shared 模块）。
- **`AiFollowupResponse` 顶层新增可选 `anchor_context`**：`{ anchor, source: 'requirements'|'design', text, truncated: boolean }[]`。
- **`task_update(in_progress)`**：在 `update()` 组装返回处，若 `updatedTask.validates` 非空，按 F-/D- 前缀裁剪读取 requirements.md / design.md（只有 F-xx 就不读 design），抽段、截断、置 `anchor_context`。
- **`task_claim`**：在 `claim()` 同样组装 `anchor_context`（**堵旁路**——claim 不走 update）；claim 当前不算 badAnchors，补同款漂移检测。
- **截断**：单段 ≤ ~400 字，超出截断 + `truncated=true`；总 ≤ ~1200 字；**D-xx 段默认只回首行 + 标题**（非可选）。
- **降级链**：无 `validates` → spec 的 L0/L1 摘要（存在则用）→ 现有"回看 requirements 目标与验收标准"文案；不回空 `anchor_context` 误导。
- **漂移**：扩 `findBadValidatesAnchors` / `badAnchorWarning` 覆盖 update 入口；claim 补检测。锚点在文档找不到 → 点名软告警，不报错、不阻断启动。
- `ai_followup.instructions` 保留"请回看 requirements.md / design.md 原文"。

### 数据模型

- `anchor_context` 字段结构如上。`Task` / `validates` 模型不变。

### 接口契约

- `AiFollowupResponse` 加可选字段；`task_update` / `task_claim` 的 MCP 返回与 CLI JSON 同步含 `anchor_context`（S1 对等）。无新工具、无新 flag。

### 错误处理

- 所有抽段 / 降级 / 漂移路径失败一律静默降级（同 `findBadValidatesAnchors` 的 try/catch 风格），不影响状态推进。

### 测试策略

- 单元：`extractAnchorSections`（段落边界 / 缺失 / 多锚点）；`anchor_context`（F-xx 回填 / D-xx 首行 / 超长截断 / 无 validates 走降级 / 漂移告警）；两入口（update + claim）对等；审核门 followup 文案；分流文案四路。
- 集成：CLI `task update` / `task claim` 的 JSON 与对应 MCP 工具含同一 `anchor_context`。
- `npm test` 全绿、无回归。
