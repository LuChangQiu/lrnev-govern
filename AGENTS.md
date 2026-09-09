# 项目提示词：Agent 工具栈与工作流（lrnev-govern）

> 本文件是 lrnev-govern 的固定提示词（AGENTS.md），在本仓库工作的 Agent 必须遵守。
> **修改边界（强制）**：本文件是固定规则，AI 不得修改；规则变更请改 `.lrnev/steering/` 真源；
> 易变项目事实（仓库结构/服务清单等）不放本文件。仅当用户明确指示时才允许改动本文件。

## 0. 本仓库用 lrnev 治理

治理数据在 `.lrnev/`（Scene/Spec/Task、gate 门禁、ADR/Errorbook/Memory）。
lrnev 是确定性治理引擎（零 LLM）：只管"该不该做 / 做到哪 / 怎么验收 / 留什么记录"；**不查源码**——查代码用 grep/read（挂了代码图谱工具则按其说明用）。

## 1. 每会话开始 / 接手时

先读 `.lrnev/steering/` 规则（具体文件）：

- `CORE_PRINCIPLES.md` — 核心行为原则（必读：ai_followup 必须执行 / 不确定先查档案再问 / 状态机不跨 / 用户决定优先 / 文档维护时机）
- `SCOPE_RULES.md` — 写 ADR / Memory / Errorbook 前读（scope 默认 global 的判定规则）
- `ADR_TRIGGERS.md` — 对话出现技术选型 / 推翻方案 / 改变决定 / 新依赖 / 全局约束时读（何时该问用户"记 ADR 吗"）
- `MEMORY_TRIGGERS.md` — 收尾 / 出现可复用经验时读（何时该沉淀项目记忆）
- `CONTEXT_DOCS_TRIGGERS.md` — 文档维护时机触发清单（准备改 PROJECT/ARCHITECTURE/scene 三件套前读）

接手全景：`project_status`（现状快照）→ `governance_map`（scene→spec 全景）；回看验收口径 `spec_get`；找相关文档 `context_search`。

## 2. 第一判断：只读 vs 要改

- **只读**（查代码 / 定位 / 解释 / 分析 / 回答问题）：直接做——不 project_status、不开 spec/task（不为形式主义走治理流程）。
- **要改**：按 `.lrnev/steering/CORE_PRINCIPLES.md` 的分流与登记纪律执行（小改动直接做；已有 Spec 的开发 / 扩展先 `task_create` 登记再实施；独立新特性才 `spec_create`）。

## 3. 速查与收尾

- 手册：`lrnev_guide`（不懂就问，禁止猜参数）；结构异常：`lrnev_doctor`；体检：`lrnev_report`（只读，非必走）。
- **验证**：代码写完 ≠ 任务完成——按项目实情验证（测试 / 构建 / 类型检查等最小充分集）通过后才 `task_update(completed)`；验证失败不得标记 completed。
- 收尾：阶段完成 `summarize_save` 更新 L0/L1；会话压缩 / 结束前 `session_commit` 沉淀候选记忆。
