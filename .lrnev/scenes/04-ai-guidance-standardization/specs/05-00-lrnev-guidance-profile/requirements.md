---
spec: 05-00-lrnev-guidance-profile
scene: 04-ai-guidance-standardization
status: completed
priority: P1
created: '2026-08-26'
updated: '2026-09-07'
---

# 05-00 lrnev Guidance Profile - 需求

> 用户已决定引入端到端结构化。本 Spec 必须实施最小 Profile；`04-00-agent-e2e-observability` 的门禁改为逐字段保留/回退门禁，而不是“是否建设 Profile”的门禁。基础语义、MCP Conformance 和通用客户端文档由 01/03/06 承载。

## L0 摘要

定义并实施 `lrnev Guidance Profile for MCP`：在 MCP 标准传输之上，结构化交付文本角色和必要来源/执行强度，并让客户端将用户的组织方式决定以带来源的 `decision_context` 请求输入传达给 lrnev；不能冒充 MCP 标准能力或把客户端声明升级为服务端事实。

## L1 概览

### 目标

MCP 的 `structuredContent` 只保证机器可读传输，不能定义 Recommendation、Decision Boundary 或 Execution Constraint 的应用语义。Profile 因此成为 lrnev 的版本化应用层契约。它不能替客户端理解用户原话，但能让客户端把已识别的 decision context 以 `client_asserted` 方式传入推荐/组织决策链路，避免服务端在创建后返回与用户已表达方向相反的泛化建议。

### 范围

**包含**：
- 定义 Profile 名称、版本、适用通道和客户端 capability 声明方式。
- 将 01 的五种文本角色映射为可选结构化 guidance，同时保持 provenance/role/enforcement 是分析框架而非默认全必填 schema。
- 为 `assess_goal`、`scene_create`、`spec_create`、`task_create` 四个 v1 组织决策工具定义可选 `decision_context` 输入契约；缺失时保持现有未声明语义。
- v1 的适用工具集合固定为 `assess_goal`、`scene_create`、`spec_create`、`task_create`；`spec_update`、`scene_get`、`spec_get` 等状态/读取工具不接收该字段，除非另行扩展契约。
- 明确 decision context 只能来自客户端声明；服务端不得自行生成 USER_DECISION，也不把声明持久化为 Project Truth。
- 区分 client_boundary 与 server_enforced，结构化 Recommendation 永不产生阻断权。
- 定义 Profile 感知客户端与通用 MCP 客户端的兼容、降级和一致性规则。
- 形成特定客户端适配与故障排查结论；运行时 capability 数据只引用 04 的证据。

**不包含**：
- 不把 Profile 描述成 MCP 官方标准。
- 不使用数字 priority 比较 Recommendation、Decision Boundary 和 Execution Constraint。
- 不要求所有 MCP 客户端适配，不因客户端忽略 Profile 就增加更多字段。
- 不新增 followup 历史迁移或 Decision Record 数据库。
- 不重复 03 的 outputSchema/structuredContent 传输改造，也不复制 04 的 capability 观测数据。

## L2 详情

### 详细需求

#### F-01 Profile 基础与逐字段门禁

- 验收：实现 Profile `v1` 的最小角色结构；每个新增可选字段必须有 04 中的失败模式或客户端适配收益作为依据。字段未带来可测改善、客户端持续忽略或造成 token/兼容成本时，应删除/回退该字段，而不是继续扩充 schema。

#### F-02 Profile 版本与能力声明

- 验收：Profile 有独立名称和版本（例如 `lrnev.guidance/v1`），客户端必须显式声明或通过已验证适配器消费；通用 MCP 客户端默认只使用 03 的标准传输和 01 的文本语义。

#### F-03 最小结构化 guidance

- 验收：结构化 guidance 至少含 `role`、`text`、`profile_version`；只在含义无法由角色推出时增加 `source_ref` 或 `enforcement`；不得把三维模型机械实现为所有消息的三个必填字段；未知 role 降级为普通文本而不是 Constraint。
- 注记（T-006 裁决 2026-09-07，O6）：`payload.guidance` 运行时挂载与 outputSchema 的 guidance 字段声明已回退——响应不再携带结构化 guidance（三客户端实测零消费 + 每次挂载 ≈24.2% 响应纯重复税）；文本通道（ai_followup.instructions / content 的 ROLE_PREFIX 五角色行）是唯一被消费通道（G5 归档边界效果走文本、不依赖数组，B4 V2 实证）。`role/text/profile_version/source_ref/enforcement` 语义保留为纯函数库 + 契约类型（classifyInstructions/buildGuidanceView/diagnoseGuidance/assertGuidancePublishable + LrnevGuidanceItem 与 zod），未来客户端表达结构化需求时可按 client 驱动恢复。

#### F-04 decision_context 输入契约

- 验收：v1 适用工具接受可选 `decision_context`，字段为 `source: 'client_asserted'`、`strength: 'explicit'|'preferred'|'unspecified'`、`summary`，可选 `direction: 'new_scene'|'new_spec'|'reuse_spec'|'no_spec'|'other'`、`target_ref`；`spec_update` 等非适用工具预期不传。缺失与 `unspecified` 必须可区分。`explicit/preferred` 必须给 direction，`unspecified` 必须省略 direction，避免把 AI Recommendation 包装成用户方向。服务端只把它作为客户端声明参与建议和决策边界渲染，不把它持久化为 Project Truth、事实或硬约束，也不凭工具调用反向生成它。
- 注记（T-006 裁决 2026-09-07，I6）：`reported_user_quote` 已回退（schema 移除）——380 录制件 0 命中 + 服务端零使用（F-04/D-03 明文不解析、不持久化）+ 客户端转述不可验证；字段删除同步 decision-context-schema/类型/测试与 D-03 文本。客户端仍可自行保留用户原话用于组织声明，只是不再作为 decision_context 输入字段传输。

#### F-05 前置建议与写入时序

- 验收：`assess_goal` 能在写入前消费 decision context 并返回事实、建议、决策边界和真实约束；v1 写入工具只对当前调用做 direction 与工具类别的粗粒度对齐（new_scene→scene_create、new_spec→spec_create、reuse_spec→task_create、no_spec→不应调用 Scene/Spec/Task 落位工具、other→不自动比较），并核对可选 target_ref。`spec_update` 不参与该对齐。发现不一致只返回 DECISION_BOUNDARY 提示，不能解析 summary、阻断用户请求、偷偷改变执行动作或自动回滚。

#### F-06 执行强度与真实 Constraint

- 验收：Recommendation 的 enforcement 永远不阻断；Decision Boundary 只约束客户端行为；Execution Constraint 必须携带稳定错误码或校验引用并由服务端先行执行，Profile 不能创造新的硬规则。

#### F-07 兼容与一致性

- 验收：Profile 数据通过 03 的结构化信封交付，并保留 01 文本降级；两者从同一语义源构建，冲突时显式诊断，不能让“更强字段”静默覆盖用户目标或服务端约束。

#### F-08 客户端适配结论

- 验收：适配指南只引用 04 的 client/version/model/capability 证据，说明哪些客户端识别 Profile、哪些只使用文本、如何禁用/回退；不复制运行日志形成第二份真相源。

### 非功能性需求

- 最小性：只实现能针对已复现失败提供可测改善的字段。
- 兼容性：Profile 缺失或被忽略时，通用 MCP + 文本语义仍可用。
- 可解释性：每个结构化字段都能回溯到 01 的角色或 04 的失败证据。
- 安全性：客户端 capability 和 decision context 不能绕过服务端约束。

### 验收标准

- [ ] Profile `v1` 最小结构已实现，字段保留/回退都有 E2E 或适配依据。
- [ ] Profile 与 MCP Conformance 分层清楚，不冒充 MCP 标准。
- [ ] 服务端不生成 USER_DECISION，decision context 只允许 client_asserted。
- [ ] direction/target_ref 只做枚举级当前调用对齐，不做文本语义解析或硬阻断。
- [ ] 没有数字 priority 或通用三维必填字段。
- [ ] Profile 感知和不感知客户端的兼容测试通过。
- [ ] 客户端适配结论和故障排查文档完成。
