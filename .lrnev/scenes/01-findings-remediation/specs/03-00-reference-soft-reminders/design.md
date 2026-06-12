---
spec: '03-00-reference-soft-reminders'
scene: '01-findings-remediation'
created: '2026-06-11'
---

# 03-00 Reference Soft Reminders - 设计

## L0 摘要

在 `TaskManager.buildFollowupAfterUpdate` 的 in_progress / completed 分支增量追加两类软提醒（depends_on 未完成、父任务带未完成子任务），全部走 ai_followup，不改 passed、不抛错、不阻断。

## L1 概览

### 架构思路

- 纯 followup 增量：复用 task_update 已解析的同 spec 任务列表，按状态算出提醒文案，push 进 instructions/warnings。
- 与 S2/S6 边界对称：本 Spec 只“提醒”，确定性坏数据的“硬拒”归 S2/S6。绝不 block 状态转换、不加 gate check。

### 主要模块

- `src/core/TaskManager.ts`：`update`（拿到同 spec 全量任务）+ `buildFollowupAfterUpdate`（in_progress / completed 分支）。

### 关键决策

| 决策 | 选项 | 倾向 | 是否产 ADR |
|------|------|------|-----------|
| I-7 依赖未完成 | warning 不 block（有合理抢跑场景） | warning | 否 |
| I-8 父子 | followup 提醒，不加 gate check（completion 对子 pending 本就 fail，冗余） | followup | 否 |
| 提醒计算数据源 | 复用 update 已解析的同 spec 任务列表 | 复用，零新增 IO | 否 |

## L2 详情

### 模块详细设计

> 本段用 `#### D-xx` 标注设计锚点（供 task --validates 引用）。

#### D-01 depends_on 依赖未完成软提醒
- `update` 把目标 task 改 in_progress 时，从已解析的同 spec 任务列表查其 `depends_on` 各前置的 status；存在非 completed 前置则在 `buildFollowupAfterUpdate` 的 in_progress 分支追加一条 warning：“前置 T-00x 还未完成，确认是否可开始”，列出具体未完成 id。不 block 状态转换。
- 与 S2 的 depends_on **存在性硬校验**分工：S2 在 create 时拒不存在 id；本处在 in_progress 时提醒“存在但未完成”，两者不冲突。

#### D-02 父任务先于子任务完成软提醒
- `update` 把一个有子任务的父 task 改 completed 时，查其子任务（parent === 该 id）状态；若存在非 completed 子任务，在 completed 分支追加 warning：“父任务已 completed，但仍有 N 个子任务未完成”。沿用现有“子全完→提示父可收尾”联动（findCompletedParentReadyForClose）作对称补充。

### 数据模型

无新增结构。followup instructions/warnings 增量。

### 接口契约

- task_update 返回结构不变，仅 ai_followup.instructions 可能多一条提醒；passed/状态结果不受影响。

### 错误处理

- 不抛错、不阻断；提醒缺失数据时静默降级（读不到任务列表不影响状态转换）。

### 测试策略

- 单元（task-manager.test.ts）：depends_on=[T-001] 且 T-001 pending → in_progress 后 followup 含未完成提醒、状态成功；前置全 completed → 无提醒。
- 父 T-001 有子 T-002(pending) → 标 T-001 completed 成功且 followup 含“仍有 1 个子任务未完成”；子全 completed → 无该提醒。
- 全量 `npm test` 绿。
