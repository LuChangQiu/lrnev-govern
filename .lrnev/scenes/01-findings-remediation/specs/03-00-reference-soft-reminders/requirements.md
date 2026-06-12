---
spec: 03-00-reference-soft-reminders
scene: 01-findings-remediation
status: ready
priority: P1
created: '2026-06-11'
updated: '2026-06-12'
---

# 03-00 Reference Soft Reminders - 需求

> 权威依据：`dev-docs/FINDINGS-CHECKLIST.md`（最终决定表 I-7/I-8）+ `dev-docs/CLAUDE-INTEGRATION-TEST-2026-06-11.md`（D3/D4 复现）。实现前回查，勿凭记忆。
> 注：原 I-5（validates F-xx 软提醒）已**翻转为硬校验并移入 S6**（锚点体系规范化），本 Spec 不再含 I-5。

## L0 摘要

为有合理例外的状态问题加“软提醒”（followup warning，不阻断）：depends_on 依赖未完成、父任务 completed 但子任务未完成时，提醒 AI 但不强制。

## L1 概览

### 目标

补两处“需要提醒但不该硬拦”的缺口。与 S2/S6 的边界对称：确定性、误伤≈0、会污染数据/坏引用的 → 硬拦（S2 的 FILL/孤儿/depends_on 存在性、S6 的锚点存在性）；有合理执行例外（依赖抢跑、容器父任务先关）→ 只 warning，绝不改 passed、不阻断流程。保持 lrnev “只引导不强制”定位。

### 用户故事

- 作为推进任务的 AI/用户，我希望在依赖还没完成、或父任务先于子任务标完成时收到提醒，以便察觉潜在问题，但仍能在确有理由时继续。

### 范围

**包含**：
- I-7（依赖未完成）：task_update→in_progress 时，若 depends_on 中有未完成（非 completed）前置，followup warning 列出，不 block。
- I-8：父任务标 completed 但仍有未完成子任务时，followup warning 提示，防 task_list 快照误读。

**不包含**：
- **validates 锚点（F-xx/D-xx）校验**：已翻转为硬校验，归 **S6**（锚点体系规范化）。本 Spec 不碰 validates。
- depends_on **指向不存在 task** 的硬拒绝：归 S2（I-7 存在性）。本 Spec 只做“依赖未完成”的软提醒。
- 不新增 gate check（I-8 已确认 completion 对子 pending 本就 fail，不需要 gate；只加快照提醒）。

## L2 详情

### 详细需求

#### F-01 depends_on 依赖未完成时软提醒
- 描述：task_update 把某 task 改为 in_progress 时，检查其 depends_on 前置在同 spec 内的状态；若有非 completed 的前置，followup warning 列出“前置 T-00x 还未完成，确认是否可开始”，不 block 状态转换。
- 验收：
  - WHEN 把一个 depends_on=[T-001] 的 task 改 in_progress 且 T-001 仍 pending THEN followup 含“前置 T-001 未完成”提醒，但状态成功变 in_progress。
  - WHEN 所有前置已 completed THEN 无该提醒。

#### F-02 父任务先于子任务完成时软提醒
- 描述：task_update 把一个有子任务的父 task 标 completed 时，若仍存在未完成的子任务，在 followup warning 提示“父任务已 completed，但仍有 N 个子任务未完成”，防止仅看快照误以为整体完成。不阻断、不加 gate check。
- 验收：
  - WHEN 父任务 T-001 有子 T-002(pending)，把 T-001 标 completed THEN 操作成功且 followup 含“仍有 1 个子任务未完成”提醒。
  - WHEN 父任务的所有子任务均 completed 时标父 completed THEN 无该提醒（沿用现有“子全完→提示父可收尾”联动）。

### 非功能性需求

- 性能：depends_on/子任务状态复用已解析的同 spec 任务列表，避免多余 IO。
- 兼容性：两处均为 followup/warnings 增量，**不改 passed、不抛错、不阻断**；既有无问题路径无新增噪音。

### 边界与依赖

- 与 S2/S6 互补：确定性且会污染数据/坏引用的归 S2（FILL/孤儿/depends_on存在性）与 S6（锚点存在性）硬拦，有合理例外的归本 Spec 软提醒。
- 依赖同 spec 任务列表解析（depends_on 前置状态、父子关系）。

### 验收标准

<!-- 最初失败信号 / 期望结果 -->
最初失败信号：D3 中 depends_on 未完成无提醒；D4 中父 completed 子 pending 快照易误读。期望结果：两处给出软提醒但不阻断，正确路径无新增噪音。
- [ ] depends_on 有未完成前置时 in_progress 给提醒，不 block。
- [ ] 父任务带未完成子任务标 completed 时给提醒，不加 gate、不阻断。
- [ ] 新增测试覆盖；`npm test` 全绿无回归。
