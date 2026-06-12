---
spec: 07-00-governance-boundary-docs
scene: 01-findings-remediation
status: completed
priority: P2
created: '2026-06-11'
updated: '2026-06-12'
---

# 07-00 Governance Boundary Docs - 需求

> 权威依据：`dev-docs/FINDINGS-CHECKLIST.md`（最终决定表 I-9/I-13/I-14）+ `dev-docs/CLAUDE-INTEGRATION-TEST-2026-06-11.md`（D5 序号复用 / A2 标题硬依赖 / A5 error_search 召回）。实现前回查，勿凭记忆。

## L0 摘要

把三处“by-design 取舍”显式写进文档与工具描述，避免用户误解：序号复用要用完整 ID、ready gate 标题是模板契约、error_search 是零模型按原文关键词检索。

## L1 概览

### 目标

三条均为确认的设计边界（非 bug），但当前对用户不够显式，易被误解为缺陷。本 Spec 通过文档/工具描述把边界讲清，不改代码行为（I-9/I-13/I-14 都维持现状）。注意：按用户要求“文档改动也走 spec 体现”，故仍以 Spec 形式记录与验收。

### 用户故事

- 作为使用 lrnev 的人，我希望在文档/工具描述里看清这些边界（为什么序号会复用、为什么标题不能改、为什么近义词搜不到），以便正确使用而不误判为 bug。

### 范围

**包含**：
- I-9：在文档强调“引用用完整 ID（scene/spec 完整路径），不要把序号当永久业务标识”；说明删 spec 是用户手动操作、序号会复用。doctor 可选深扫留作后续，不在本 Spec 实现。
- I-13：文档明确 ready gate 章节标题与中文模板必须完全一致是**模板契约**；国际化标题 alias 表留作后续。
- I-14：在 `error_search` 工具描述/followup 强调“零模型检索，按原文关键词/错误码/文件名搜，不要改述”。

**不包含**：
- 不改任何 gate / 检索 / 序号分配的代码行为。
- 不实现 doctor 悬空引用深扫（后续）、不实现标题 alias（后续）、不引入语义检索（产品边界）。

## L2 详情

### 详细需求

#### F-01 文档化三条治理边界
- 描述：更新相关文档（README / docs 下治理说明 / 对应工具描述）显式说明 I-9、I-13、I-14 三条边界与“为什么这样设计”。其中 I-14 的措辞同步进 `error_search` 的工具描述（guidance.ts 的 TOOL_DESCRIPTIONS）与 followup，使 AI 调用时即被提示。
- 验收：
  - WHEN 读治理文档/工具描述 THEN 能找到“引用用完整 ID、序号会复用”的明确说明（I-9）。
  - WHEN 读 ready gate 相关文档 THEN 能找到“标题须与中文模板一致是契约，国际化另做 alias”的说明（I-13）。
  - WHEN 看 `error_search` 工具描述 THEN 含“按原文关键词/错误码/文件名搜、零模型不做语义召回”的提示（I-14）。

### 非功能性需求

- 性能：无代码行为变化，无性能影响。
- 兼容性：纯文档 + 工具描述文案；不改 gate/检索/序号行为；现有测试不应因文案调整失败（若有 docs 测试断言固定文案，需同步更新）。

### 边界与依赖

- 依赖现有文档结构（README、docs/*、guidance.ts 的 TOOL_DESCRIPTIONS）。
- 若 `tests/unit/docs.test.ts` / `tool-descriptions.test.ts` 对文案有断言，需同步。

### 验收标准

<!-- 最初失败信号 / 期望结果 -->
最初失败信号：D5/A2/A5 三处边界对用户不显式，易被当 bug。期望结果：三条边界在文档/工具描述里讲清，代码行为不变，测试不回归。
- [ ] I-9：文档强调用完整 ID、序号会复用，已写明。
- [ ] I-13：文档说明标题模板契约 + 国际化 alias 留后续。
- [ ] I-14：error_search 工具描述/followup 强调按原文关键词搜、零模型。
- [ ] 相关 docs/tool-description 测试同步通过；`npm test` 全绿。
