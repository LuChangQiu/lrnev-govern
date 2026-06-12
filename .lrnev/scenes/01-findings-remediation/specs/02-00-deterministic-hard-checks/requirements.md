---
spec: 02-00-deterministic-hard-checks
scene: 01-findings-remediation
status: completed
priority: P0
created: '2026-06-11'
updated: '2026-06-12'
---

# 02-00 Deterministic Hard Checks - 需求

> 权威依据：`dev-docs/FINDINGS-CHECKLIST.md`（最终决定表 I-4/I-6/I-7）+ `dev-docs/CLAUDE-INTEGRATION-TEST-2026-06-11.md`（D2/D6/D3 复现）。实现前回查这两份，勿凭记忆。

## L0 摘要

为 lrnev 的确定性事实补硬校验：completion gate 拦 requirements/design 残留 FILL、summarize_save 拒绝给不存在目标建孤儿摘要、task 依赖不存在的 task ID 时拒绝创建。

## L1 概览

### 目标

把三处“确定性事实却被静默放过”的缺口补成硬校验/硬拒绝。判据：仅校验本地数据零模型可判、误伤≈0 的结构事实（FILL 是否残留、引用目标是否存在），**不判断**需求好坏、设计优劣、是否真实现——后者仍交 AI（保持 lrnev “只引导不强制”定位）。

### 用户故事

- 作为依赖 lrnev 治理闭环的用户，我希望“标了 completed / 存了摘要 / 建了带依赖的任务”时，工具能挡住明显的空白占位与悬空引用，以便治理数据不自相矛盾、不被空壳骗过。

### 范围

**包含**：
- I-4：completion gate 对 `requirements.md` / `design.md` 残留 `<!-- FILL -->` 哨兵 hard_fail。
- I-6：`summarize_save` 写摘要前校验目标 scene/spec/文档真实存在，不存在则报错且不建目录。
- I-7（存在性部分）：`task_create` 的 `depends_on` 指向不存在的 task ID 时硬拒绝。

**不包含**：
- **不碰 `tasks.md` 的 FILL**：其模板自带 FILL（L14/L18），task_create 只追加任务、不替换占位，全文硬查会误伤正常路径。
- 不判断“是否真实现需求”“设计写得好不好”——那是语义，仍走软提醒（属 S3）。
- depends_on 的“依赖未完成则提醒”属软提醒（S3，I-7 的 warning 部分）。
- D-xx / validates 锚点存在性校验属 S6 / S3，不在本 Spec。

## L2 详情

### 详细需求

#### F-01 completion gate 硬拦 requirements/design 的 FILL
- 描述：`GateRunner.checkCompletion` 在原有“任务结构”检查之外，新增对 `requirements.md` 与 `design.md` 残留 `<!-- FILL: ... -->` 哨兵的 hard_fail 检查（复用现有 `findFillSentinels`）。tasks.md 不纳入。
- 验收：
  - WHEN 某 spec 所有 task 已 completed 但 requirements.md 仍有 FILL THEN completion gate `passed=false`，check 名指明 requirements 的 FILL 行，hint 提示去填。
  - WHEN requirements 无 FILL 但 design.md 仍有 FILL THEN completion gate `passed=false` 指向 design 的 FILL。
  - WHEN requirements 与 design 均无 FILL 且任务全 completed THEN completion gate `passed=true`（tasks.md 自带的模板 FILL 不影响通过）。

#### F-02 summarize_save 拒绝为不存在目标建孤儿摘要
- 描述：`Summarizer.saveSummary` 在写 `.abstract.md` / `.overview.md` 前，校验该 URI 映射的目标文档（scene/spec 的 requirements/design/tasks 等）真实存在；不存在则抛 `TARGET_NOT_FOUND`（或既有合适错误码），且不创建任何目录/文件。
- 验收：
  - WHEN 给一个不存在的 spec 的 URI 调 summarize_save THEN 返回错误、不在磁盘建任何 `.../99-99-ghost/...` 目录或摘要文件。
  - WHEN 给真实存在的目标 URI 调 summarize_save THEN 正常写入摘要（保持现有成功行为不回归）。

#### F-03 task_create 拒绝指向不存在 task 的 depends_on
- 描述：`TaskManager.create` 仿照现有 `parent` 存在性校验，对 `depends_on` 列表中每个 id 校验其在同 spec 的现有 task 中存在；任一不存在则抛 `TASK_NOT_FOUND` 并指明缺失 id，且不写入。
- 验收：
  - WHEN task_create 的 depends_on 含一个不存在的 id（如 T-099）THEN 返回 `TASK_NOT_FOUND` 指明 T-099，且 task 未被创建。
  - WHEN depends_on 全部指向已存在的 task THEN 正常创建（保持 MCP 现有行为不回归）。

### 非功能性需求

- 性能：FILL 检查复用 completion gate 已读取的文件内容，不新增多余 IO；depends_on 校验复用已解析的 existing 任务列表。
- 兼容性：不改变 lrnev “只引导不强制”核心——这三处都是确定性结构事实，不是语义判断；既有正确用法（无 FILL、真实目标、有效依赖）行为不回归。

### 边界与依赖

- 依赖既有 `findFillSentinels`（GateRunner）、`uriToFilePath`（URIRouter）、`parseTasksFromMarkdown`（TaskManager）。
- 关联 S3（I-5/I-7 软提醒）：本 Spec 只做“存在性硬拒”，“依赖未完成提醒”在 S3。

### 验收标准

<!-- 最初失败信号 / 期望结果 -->
最初失败信号：D2 中 requirements/design 全 FILL 也能 completion pass；D6 中给幽灵 spec 存摘要凭空建文件；D3 中 depends_on 指向不存在 task 不报错。期望结果：三处确定性缺口被硬挡，正确用法不回归。
- [ ] completion gate 对 requirements/design 残留 FILL 判 fail；tasks.md FILL 不影响。
- [ ] summarize_save 对不存在目标报错且不建孤儿文件；真实目标正常写入。
- [ ] task_create 对不存在的 depends_on id 硬拒绝；有效依赖正常创建。
- [ ] 新增/修改均有测试覆盖；`npm test` 全绿无回归。
