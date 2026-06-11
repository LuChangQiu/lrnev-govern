---
scene: '01-findings-remediation'
created: '2026-06-11'
---

# Findings Remediation - 架构

> 本文档描述本 Scene 内所有 Spec 共享的架构约束。
> 单个 Spec 的具体设计在各自的 design.md 中。

## L0 摘要

7 个修复 Spec 共享一条总纲——确定性事实硬校验、需判断语义交 AI——且三处引用硬校验集中落在 `TaskManager.create` 同一处。

## L1 概览

### 关键模块

本 Scene 的改动集中在 core 层少数几处，跨 Spec 共用，避免分散：

- `src/core/TaskManager.ts`（`create`）：S2 的 depends_on 存在性、S6 的 F-xx/D-xx 格式与存在性，三类“坏的结构引用一律硬拒、不落盘”集中在此一处校验，口径必须一致。
- `src/core/GateRunner.ts`（`checkCompletion`）：S2 的 requirements/design FILL 硬拦（不碰 tasks.md）。
- `src/core/Summarizer.ts`（`saveSummary`）：S2 的目标存在性硬校验。
- `src/cli/` ↔ `src/mcp/` 经 core 共享层：S1 的 CLI/MCP 对等（spec_get 引导下沉、--depends-on、--supersedes）。
- `src/core/GoalAssessor.ts` / `TaskManager`（followup）：S4 的启发式与提示语打磨。
- `src/core/AgentRegistry.ts` + `Doctor.ts` / `ADRManager.ts`：S5 的显式 GC 与 supersedes 读时计算。

### 数据流

不改变 lrnev 既有数据流（客户端 → Manager → storage 读写 `.lrnev/` Markdown → 结构化结果 + ai_followup）。本 Scene 只在既有节点上增加“校验/提示”：硬校验在写入路径（create / saveSummary / completion gate）拒绝坏数据；软提醒在 followup 增量，不改 passed、不阻断。

### 技术决策

跨 Spec 共享的核心判据（贯穿全部 7 个 Spec，单个 design 不再重复论证）：

- **确定性事实 → 硬**：本地数据零模型可判、误伤≈0、会让 gate/引用/摘要自相矛盾的（FILL 残留、目标不存在、坏锚点/坏依赖），在写入路径硬拒。
- **需判断语义 → 交 AI**：需求好坏、设计优劣、代码质量、是否真解决——不判断，最多软提醒。
- **有合理执行例外 → 软**：依赖抢跑、容器父任务先关——只 warning，不 block。
- 详细取舍见 `dev-docs/FINDINGS-CHECKLIST.md`；关键决策（如 validates 去自由字符串化、completion 硬拦 FILL）可按需沉淀 ADR。

## L2 详情

### 模块详细设计

各 Spec 的具体改法见对应 design.md（实现阶段填）。本 Scene 的关键架构约束是“集中而非分散”：

- 三处引用硬校验（depends_on / F-xx / D-xx）必须共用同一套“格式判定 + 存在性查找 + 统一错误码”，不可各写一份，否则口径会漂。
- 硬校验复用调用点已读取的文件内容（create 时的 existing 任务、requirements/design 正文），不新增多余 IO。

### 接口契约

- 错误返回沿用既有结构（`ok:false` + errors[code/message/hint]）；坏引用/坏锚点用明确错误码（如 `TASK_NOT_FOUND` / `ANCHOR_NOT_FOUND` / 格式废弃），并指明缺失项。
- 软提醒一律走 `ai_followup.instructions` / `warnings`，不进 `passed`。
- CLI 与 MCP 对同一能力返回语义一致（形态可不同）。

### 非功能性要求

- 性能：所有校验复用已读内容，不新增遍历；GC 仅显式触发。
- 兼容性：行为变更须有测试覆盖，`npm test` 全绿（当前 570 测试）；validates 去自由字符串化为有意收紧，已核实无真实用户数据依赖。
- 安全性：不引入 LLM/网络/新强依赖；保持零模型、文件即真相。
