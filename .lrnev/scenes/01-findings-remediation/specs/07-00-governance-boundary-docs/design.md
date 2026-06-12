---
spec: '07-00-governance-boundary-docs'
scene: '01-findings-remediation'
created: '2026-06-11'
---

# 07-00 Governance Boundary Docs - 设计

## L0 摘要

把三条 by-design 边界（序号复用→用完整 ID、ready gate 标题契约、error_search 零模型按原文检索）显式写进文档与工具描述，不改任何代码行为。

## L1 概览

### 架构思路

- 纯文档/文案变更：让用户理解“为什么这样设计”，避免把边界当 bug。
- I-14 的措辞同步进 `error_search` 工具描述（guidance.ts 的 TOOL_DESCRIPTIONS），让 AI 调用时即被提示。

### 主要模块

- 文档：`README.md` / `docs/GOVERNANCE-FLOW.md`（I-9、I-13 说明）。
- 工具描述：`src/mcp/guidance.ts` 的 `TOOL_DESCRIPTIONS.error_search`（I-14）。
- 测试同步：`tests/unit/docs.test.ts` / `tool-descriptions.test.ts` 若对文案有断言需同步。

### 关键决策

| 决策 | 选项 | 倾向 | 是否产 ADR |
|------|------|------|-----------|
| 三条边界 | 维持代码行为，仅文档化 | 仅文档 | 否 |
| I-14 落点 | 文档 + 工具描述 + followup | 多处一致 | 否 |

## L2 详情

### 模块详细设计

> 本段用 `#### D-xx` 标注设计锚点（供 task --validates 引用）。

#### D-01 文档化三条治理边界
- I-9（序号复用）：在治理文档强调“引用用完整 ID（scene/spec 完整路径），不要把序号当永久业务标识；删 spec 是用户手动操作、序号会复用”。doctor 深扫留后续，不在本 Spec 实现。
- I-13（标题契约）：文档明确“ready gate 章节标题须与中文模板完全一致是契约；国际化标题 alias 表留作后续”。
- I-14（error_search）：在 `TOOL_DESCRIPTIONS.error_search` 与相关文档/followup 写明“零模型检索，按原文关键词/错误码/文件名搜，不要改述”。

### 数据模型

无。

### 接口契约

- error_search 工具描述文案更新（行为不变）；其余文档更新。

### 错误处理

- 无代码行为变化。

### 测试策略

- 若 `docs.test.ts` / `tool-descriptions.test.ts` 断言固定文案，同步更新断言。
- 全量 `npm test` 绿。
