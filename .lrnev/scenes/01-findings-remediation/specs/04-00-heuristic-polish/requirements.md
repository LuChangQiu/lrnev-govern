---
spec: 04-00-heuristic-polish
scene: 01-findings-remediation
status: ready
priority: P2
created: '2026-06-11'
updated: '2026-06-12'
---

# 04-00 Heuristic Polish - 需求

> 权威依据：`dev-docs/FINDINGS-CHECKLIST.md`（最终决定表 I-10/I-11）+ `dev-docs/CLAUDE-INTEGRATION-TEST-2026-06-11.md`（A3 子线程提示 / A5 assess_goal 保守）。实现前回查，勿凭记忆。

## L0 摘要

打磨两处启发式输出：task in_progress 的“拆子任务并行”提示改为按弱信号有条件出现（消噪音），assess_goal 让 kind 与 reasons 一致（明显多特性时升 multi-spec）。

## L1 概览

### 目标

修两处“启发式输出质量”问题，纯提示/分类层面，不改流程、不阻断。① in_progress followup 无条件追加并行提示，小任务上是噪音；② assess_goal 已在 reasons 识别出多特性信号，kind 却仍判 single-spec，自相矛盾、且与 scene_create intent 路径口径不一致。

### 用户故事

- 作为收 lrnev followup 的 AI，我希望提示与任务实际情况匹配（小任务不被劝拆、明显多特性被判为多 spec），以便提示有信噪比、可直接执行。

### 范围

**包含**：
- I-10：`TaskManager` 的 in_progress followup 里“可拆子任务并行”两句，改为按弱信号有条件追加，子任务默认不提示。
- I-11：`GoalAssessor` 让 `kind` 与 `reasons` 一致——枚举并列项 ≥3（或同强度多特性信号）时把 kind 升 `multi-spec-program`。

**不包含**：
- 不改 validates 智能提示（那部分本就正确）。
- 不引入 LLM/打分模型，保持零模型启发式。
- 不改 assess_goal 的 research-program 判定逻辑。

## L2 详情

### 详细需求

#### F-01 in_progress 并行提示改为按弱信号有条件出现
- 描述：`TaskManager.buildFollowupAfterUpdate`（in_progress 分支，现 `TaskManager.ts:797` 无条件 push 两句并行提示）改为弱信号判定后才追加：用 acceptance 数、描述长度、是否已有 children、validates 数量等综合判断；**任务本身是子任务（有 parent）时默认不提示**。
- 验收：
  - WHEN 一个“小任务”（如标题短、acceptance≤1、无 children、无 validates）转 in_progress THEN followup **不含**“拆子任务并行”两句。
  - WHEN 一个“大任务”（acceptance 多 / 描述长 / 已有子任务等弱信号命中）转 in_progress THEN followup **仍含**并行提示。
  - WHEN 一个子任务（有 parent）转 in_progress THEN followup **不含**并行提示。
  - validates 回看提示等其余 followup 行为不回归。

#### F-02 assess_goal 的 kind 与 reasons 一致
- 描述：`GoalAssessor.assess` 在已识别“多个并列项”（枚举 ≥3）等强多特性信号时，让 `kind` 升为 `multi-spec-program`，不再因总 score 未到固定阈值而仍判 single-spec。confidence 可保持 medium。
- 验收：
  - WHEN goal 是“解析、可视化、搜索、增量更新、导出报告”（枚举 5 项）THEN kind = `multi-spec-program`（不再是 single-spec），reasons 与 kind 不矛盾。
  - WHEN goal 是单一小改动（无多特性信号）THEN kind 仍 `single-spec`（不过度升级）。
  - 与 `scene_create --intent` 的多特性信号口径一致（不再一个积极一个保守）。

### 非功能性需求

- 性能：均为内存内字符串/字段判断，无新增 IO。
- 兼容性：纯 followup/分类输出调整；不改 passed、不改任务/spec 状态；不引入模型依赖。

### 边界与依赖

- I-10 依赖 task 的 acceptance/description/children/validates/parent 字段（均已有）。
- I-11 依赖现有 `enumeratedItems` 计数逻辑（`GoalAssessor.ts:33`）。

### 验收标准

<!-- 最初失败信号 / 期望结果 -->
最初失败信号：A3 中小任务“改空态文案”也被劝拆子任务（噪音）；A5 中 5 模块目标 reasons 识别了多特性但 kind 仍 single-spec。期望结果：提示按弱信号出现、kind 与 reasons 一致。
- [ ] 小任务/子任务 in_progress 不再追加并行提示；大任务仍追加。
- [ ] assess_goal 对明显多特性目标判 multi-spec-program，单一小改动仍 single-spec。
- [ ] 新增测试覆盖；`npm test` 全绿无回归。
