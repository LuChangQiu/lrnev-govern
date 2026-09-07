---
spec: '04-00-agent-e2e-observability'
scene: '04-ai-guidance-standardization'
status: draft
priority: P0
created: '2026-08-26'
---

# 04-00 Agent E2E Observability - 需求

## L0 摘要

用真实客户端 AI 验证端到端结构化是否改善用户意图、治理建议和执行约束的区分：固定 fixture 对比基线、文本语义迁移、structuredContent 引入、ModelVisibleContract 切换和 Guidance Profile `v1`，以最终工具动作而不是字段存在作为判定依据。

## L1 概览

### 目标

单元测试只能证明服务端接受/拒绝某个调用。真正风险发生在用户原话、客户端意图识别、`decision_context` 传递、MCP 结果交付、模型判断和最终工具调用之间。由于 Scene 已决定实施结构化，E2E 不再决定“是否建设”，而是决定每个 Profile 字段是否保留、调整或回退。

### 范围

**包含**：
- explicit / preferred / unspecified 意图矩阵、`decision_context` 传值和 Recommendation 冲突场景。
- 基线、文本语义迁移、structuredContent 引入、content ModelVisibleContract 切换、Profile `v1` 的分阶段对照，避免同时改动导致无法归因。
- 工具调用序列、最终动作、用户确认轮次、Constraint 拒绝、Profile/transport capability 和字段回退行为的观测。
- Claude Code、Codex 等实际客户端的可重复盲测记录；可扩展到其他客户端。
- 误读案例编号、脱敏、回放、严重度分级和字段级保留/回退门禁。

**不包含**：
- 不把某一次模型输出当成协议事实。
- 不在常规单元测试中强依赖外部模型、网络或私有凭据。
- 不用 E2E 结果绕过确定性 Constraint 或修改用户目标。
- 不把客户端传入的 decision_context 当作服务端验证事实。
- 不把客户端没有消费 structuredContent/Profile 误诊为服务端约束或 Recommendation 语义错误。

## L2 详情

### 详细需求

#### F-01 冲突测试矩阵

- 验收：覆盖 E-01 至 E-09（E-06 含 E-06a/E-06b 两个时序子场景）：建议复用+明确新建、建议新建+明确复用、低风险未指定、高成本未指定、偏好新建后确认、用户改变主意、明确不建 Spec、真实 Constraint、上下文冷却；每个场景定义 fixture、用户原话、预期 decision_context（含 strength/direction/target_ref）、允许工具集合、允许工具序列、禁止最终动作和判定严重度；`new_scene` 与 `other` 另有协议 fixture 覆盖。

#### F-02 证据链记录

- 验收：每次运行记录 scenario id、run id、server version/git SHA、MCP protocol version、client/version、model、clean-session 标识、fixture hash、server instructions hash、tool list/description hash、resource/Profile version、原始用户输入、decision_context 传值、MCP 工具调用顺序、最终动作、用户确认、约束结果和失败分类；敏感内容可脱敏但不能只保留最终结论。

#### F-03 盲测与重复

- 验收：测试执行者在看到期望答案前运行；每个主力客户端的 explicit 场景至少运行 5 个独立 clean session；同一 client/model/fixture 的重复不复用对话上下文；preferred 和 unspecified 也记录多轮，但按 F-04 的不同严重度判定。

#### F-04 严重度与字段保留/回退门禁

- 验收：
  - explicit 用户目标被 Recommendation 覆盖，或 client 将 explicit 错传为非 explicit：关键失败；同一主力客户端同场景 >=2/5，或两个主力客户端各 >=1/5 时，必须修复 Profile/客户端适配后重测。
  - preferred/unspecified/缺失被客户端误传为 explicit，或 direction/target_ref 与用户原话不一致：关键意图传递失败；必须记录原始用户输入和实际 decision_context，修复客户端识别/适配后重测，服务端不得把错误声明升级成事实或约束。
  - 真实 Constraint 未阻断：服务端执行缺陷；不等待统计，直接创建修复任务。
  - preferred：记录 AI 是否说明利弊并尊重最终确认；单独观察，不以一次偏差扩大 schema。
  - unspecified：低风险可逆选择允许 AI 自主判断；高成本边界应询问；只有伪造用户决定、越过约束或违反场景风险策略才算失败。
  - E-07 中客户端调用了 v1 适用集合内的 `assess_goal`、`scene_create`、`spec_create`、`task_create`，却未传 explicit `no_spec` context，或误传其他 strength/direction：C 类关键失败；若客户端遵照用户决定直接改代码且未调用这些工具，不算 lrnev 失败。
  - client 未交付/消费 structuredContent 或 Profile：capability 失败；修适配或回退该字段，不新增更多字段叠加提示。
  - B2b ModelVisibleContract 若在同一 client/model/fixture 上引入 B2a 不存在且可立即复现的关键失败，或关键失败数相对 B2a 增加 >=2/5，则按受影响工具回退到 B2a legacy JSON renderer；逐项复核 required 字段、顺序、格式和 token 后重测，不默默接受退化。
  - Profile 可选字段没有降低关键失败、改善可追溯或被客户端稳定消费时，删除/回退该字段。

#### F-05 回放与回归

- 验收：失败案例可脱敏回放；每个核心场景至少保留 B0（迁移前）、B1（文本语义迁移后）、B2a（增加 outputSchema/structuredContent，但保持 B1 的模型可见 content 信息）、B2b（切换逐工具 ModelVisibleContract）、B3（Profile `v1` 后）可比较记录；一次对照只能改变一个阶段的变量，比较模型可见文本、工具调用、decision_context 和最终动作变化。

#### F-06 capability 归属与发布证据

- 验收：04 是 client/model/version 运行时 capability 的唯一证据源；02 的静态备注和 05/06 的适配结论均引用 run id/evidence path，不复制或改写原始观察；发布前重跑受影响客户端的核心场景。

### 非功能性需求

- 可重复：固定工作区 fixture、初始 Spec 状态和 prompt 模板。
- 安全：日志不得保存密钥、凭据或不必要的项目隐私。
- 成本：常规 CI 使用 fixture/mock；真实模型盲测按发布前或重大 guidance 变更触发。
- 可归因性：阶段对照期间冻结未测试通道和客户端版本，避免把多个变更归因给 Profile 字段。

### 验收标准

- [ ] E-01 至 E-09（含 E-06a/E-06b）都有 fixture、decision_context、期望与严重度；`new_scene` 和 `other` 有独立协议 fixture。
- [ ] B0/B1/B2a/B2b/B3 对照记录可复现并已脱敏归档。
- [ ] 失败分类能区分 Recommendation、选择性遵守、意图传递、传输 capability 和服务端执行缺陷。
- [ ] Profile 每个可选字段都有保留/调整/回退结论。
