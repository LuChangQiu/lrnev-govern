---
spec: '02-00-deterministic-hard-checks'
scene: '01-findings-remediation'
created: '2026-06-11'
---

# 02-00 Deterministic Hard Checks - 设计

## L0 摘要

在三个写入/校验点（completion gate、summarize_save、task_create）增加确定性硬校验，全部复用既有工具函数与错误码，最大化复用、最小化新增 IO。

## L1 概览

### 架构思路

- 只在“写入或判定通过”的路径上加校验，拒绝坏数据/空壳；不碰只读路径、不改 lrnev “只引导不强制”内核。
- 校验对象都是确定性结构事实（FILL 哨兵、目标文件是否存在、依赖 task ID 是否存在），零模型、误伤≈0。
- 复用现成函数：`findFillSentinels`（精确哨兵正则）、`parseTasksFromMarkdown`、现有 ErrorCode，不重造轮子。

### 主要模块

- `src/core/GateRunner.ts` → `checkCompletion`（F-01 FILL 硬拦）
- `src/core/Summarizer.ts` → `saveSummary` / `getSummaryPath`（F-02 孤儿文件硬拦）
- `src/core/TaskManager.ts` → `create`（F-03 depends_on 存在性硬拒）

### 关键决策

| 决策 | 选项 | 倾向 | 是否产 ADR |
|------|------|------|-----------|
| completion 查 design FILL 的 IO | (a)新增一次 design.md 读取 (b)不查 design | **(a)** 新增一次读 | 否（实现细节） |
| I-6 目标不存在的错误码 | (a)复用 `SPEC_NOT_FOUND`/`SCENE_NOT_FOUND` (b)新增 `TARGET_NOT_FOUND` | **(a)复用** | 否 |
| I-7 depends_on 不存在错误码 | 复用 `TASK_NOT_FOUND`（与 parent 一致） | 复用 | 否 |
| FILL 检测方式 | (a)`findFillSentinels` 精确正则 (b)字符串 includes('FILL') | **(a)** | 否 |

> 重要修正：requirements 的 FILL 检查可复用 `creation.content`（completion 已经过 `checkCreation` 读过 requirements，零新增 IO）；但 **design.md 的 FILL 检查需要新读一次 design.md**——completion gate 当前不读 design。requirements 文档里“不新增多余 IO”仅对 requirements 部分成立，design 部分诚实地多一次读。
>
> 陷阱备忘：FILL 检测必须用 `findFillSentinels`（匹配 `<!--\s*FILL(?::.*?)?\s*-->`），不能简单 grep "FILL"——正文里正常讨论“FILL 哨兵”这个词会被误判（本 Scene 文档即如此）。

## L2 详情

### 模块详细设计

> 本段用 `#### D-xx` 标注设计锚点（吃狗粮：供本 Spec 的 task 用 `--validates F-xx D-xx` 引用需求+设计）。

#### D-01 completion gate 硬拦 requirements/design FILL（`GateRunner.checkCompletion`）
- 在现有 `tasks_*` 检查之外追加两个 hard_fail check：
  - `requirements_no_fill`：对 `creation.content`（已读的 requirements）跑 `findFillSentinels`，非空则 fail，message 列出哨兵行号、hint 提示去填。
  - `design_no_fill`：新读 `design.md`（路径 `.lrnev/scenes/{scene}/specs/{spec}/design.md`），跑 `findFillSentinels`，非空则 fail。design.md 不存在时按现有约定处理（spec 骨架本应有 design.md；缺失走 FILE_NOT_FOUND 或与 creation 一致的容错）。
- **不碰 tasks.md**：tasks 模板自带 FILL（L14/L18），只查 tasks 的结构（已有 `all_tasks_completed`）。

#### D-02 summarize_save 拒绝孤儿目标（`Summarizer.saveSummary` / `getSummaryPath`）
- 在 `getSummaryPath` 把 URI 映射到 `relPath` 后、写文件前，校验目标文档真实存在：`this.fs.exists(concretePath)` 为 false 时抛 `SPEC_NOT_FOUND`（或目标是 scene 时 `SCENE_NOT_FOUND`），并**不创建任何目录/文件**。
- 现有 `resolveConcretePath` 已对 ADR 编号做解析；存在性校验放在它之后，确保校验的是最终落点文档。

#### D-03 task_create 拒绝坏 depends_on（`TaskManager.create`）
- 紧邻现有 parent 存在性校验（`TaskManager.ts:142` 附近），对 `input.depends_on` 每个 id 校验其在 `existing`（已 `parseTasksFromMarkdown` 解析）中存在；任一缺失则抛 `TASK_NOT_FOUND`，message 指明缺失 id，且因在 `withTasksFileLock` 内提前抛出、不写文件。
- 与 parent 校验共用同一段“引用存在性”逻辑（抽小工具函数，S6 的 F-xx/D-xx 锚点校验也复用）。

### 数据模型

不新增持久化数据结构。仅新增 gate check 项（`GateResult.checks[]` 增加 `requirements_no_fill` / `design_no_fill`）。

### 接口契约

- completion gate 返回结构不变，只多两个 check 项；passed 计算沿用 `checks.every(c => c.passed || !c.hard_fail)`。
- summarize_save 失败返回 `ok:false` + errors[code/message/hint]；成功路径不变。
- task_create 失败返回 `TASK_NOT_FOUND`（同 parent 风格）；成功路径不变。

### 错误处理

- 所有新增校验失败都返回明确 code + 指明缺失项的 message + 可操作 hint。
- design.md 读取失败（缺失/损坏）：与现有 tasks_readable 容错一致，给明确 check 失败而非静默。

### 测试策略

- 单元（`gate-runner.test.ts`）：requirements 有 FILL → completion fail；design 有 FILL → fail；两者都无 + 任务全 completed → pass（且 tasks.md 的模板 FILL 不影响）。
- 单元（`summarizer.test.ts`）：不存在的 spec URI → 报错且磁盘无新文件（断言目录未创建）；真实 URI → 正常写入。
- 单元（`task-manager.test.ts`）：depends_on 含不存在 id → TASK_NOT_FOUND 且 task 未创建；有效 depends_on → 正常。
- 回归：`npm test` 全绿；注意现有用 design#3.2 的测试归 S6 处理，不在本 Spec 改动。
