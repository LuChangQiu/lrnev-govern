---
spec: '04-00-heuristic-polish'
scene: '01-findings-remediation'
created: '2026-06-11'
---

# 04-00 Heuristic Polish - 设计

## L0 摘要

两处零模型启发式微调：in_progress 的并行提示改为按弱信号有条件追加（`TaskManager`），assess_goal 让强多特性信号直接抬升 kind（`GoalAssessor`），使 reasons 与 kind 一致。

## L1 概览

### 架构思路

- 纯内存判断，无新增 IO、不引入模型。
- 提示价值在“时机与稀缺”，而非数量：小任务/子任务不再被无条件劝拆。
- 分类自洽：reasons 已识别的强信号必须反映到 kind 上。

### 主要模块

- `src/core/TaskManager.ts`：`buildFollowupAfterUpdate` in_progress 分支（现 `TaskManager.ts:797` 无条件 push 并行提示两句）。
- `src/core/GoalAssessor.ts`：`assess` 的 kind 判定（现 `GoalAssessor.ts:49` 用固定 score 阈值）。

### 关键决策

| 决策 | 选项 | 倾向 | 是否产 ADR |
|------|------|------|-----------|
| I-10 并行提示触发条件 | 弱信号（acceptance 数/描述长度/已有 children/validates 数；子任务默认不提） | 有条件 | 否 |
| I-11 kind 抬升 | 强信号（枚举≥3 等）直接升 multi-spec-program，confidence 保持 medium | 抬升 | 否 |

## L2 详情

### 模块详细设计

> 本段用 `#### D-xx` 标注设计锚点（供 task --validates 引用）。

#### D-01 in_progress 并行提示改为有条件
- 在 in_progress 分支，把“可拆子任务并行”两句改为弱信号判定后才 push：综合 `task.acceptance.length`、`task.description` 长度、是否已有 children、`task.validates.length` 等；**task 本身是子任务（有 parent）时一律不提**。
- 抽一个 `shouldSuggestParallelSplit(task)` 谓词，集中阈值，便于测试与调参。validates 回看提示等其余 followup 行为不变。

#### D-02 assess_goal 的 kind 与 reasons 一致
- `assess` 在已识别强多特性信号（如 `enumeratedItems.length >= 3`，或同等强度的并列/平台级信号）时，把 kind 从 single-spec 抬升为 `multi-spec-program`，不再仅由总 score 是否到固定阈值决定。
- 实现上：在算出 score/reasons 后，加一条“强信号优先”规则覆盖 kind；confidence 维持现有计算（可保持 medium）。research-program 判定不变。

### 数据模型

无新增结构。仅调整 followup 文案触发条件与 kind 计算。

### 接口契约

- task_update / assess_goal 返回结构不变；in_progress followup 在小任务上少两句，assess_goal 的 kind 对多特性更准。

### 错误处理

- 纯判断逻辑，无新增错误路径。

### 测试策略

- 单元（task-manager.test.ts）：小任务（短标题/acceptance≤1/无 children/无 validates）in_progress → followup 不含并行提示；大任务 → 含；子任务（有 parent）→ 不含。
- 单元（goal-assessor.test.ts）：枚举 5 项目标 → kind=multi-spec-program 且 reasons 不矛盾；单一小改动 → 仍 single-spec。
- 全量 `npm test` 绿。
