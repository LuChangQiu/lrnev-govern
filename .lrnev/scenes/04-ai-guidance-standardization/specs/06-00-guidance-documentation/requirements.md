---
spec: '06-00-guidance-documentation'
scene: '04-ai-guidance-standardization'
status: draft
priority: P1
created: '2026-08-27'
---

# 06-00 Guidance Documentation - 需求

## L0 摘要

无条件发布 lrnev 的基础语义、MCP Response Conformance 和客户端迁移文档；将 Profile 专属能力与通用 MCP 能力明确分开，使客户端知道该读什么、该传什么、哪些能力必须适配、哪些只是建议。

## L1 概览

### 目标

Scene 04 已把文本语义、MCP transport 和 lrnev Guidance Profile 拆成不同生命周期。文档不能继续放在有门禁的 Profile Spec 中，否则 Profile 尚未完成时，基础语义和结构化响应的使用者没有权威说明。

本 Spec 面向三类读者：lrnev 服务端实现者、MCP 客户端/adapter 实现者和使用治理工具的 AI/开发者。文档必须准确表达“content 是通用非结构化结果通道，structuredContent 是机器可读增强”“Profile 不是 MCP 官方标准”“decision_context 是 client_asserted 声明，不是服务端事实”。

### 范围

**包含**：
- 发布 `01-00` 的 Semantic Authority Model `v0.1` 和 `02-00` 的 Guidance Surface 清单。
- 发布 MCP Response Conformance：output schema、structuredContent、content 文本呈现、isError、annotations 和协议版本兼容。
- 发布客户端集成指南：保留用户原话、何时传 decision_context、如何消费 content/structuredContent、如何处理真正 Constraint。
- 发布从“content 中完整 JSON”到“structuredContent 完整数据 + 逐工具 ModelVisibleContract 文本视图”的破坏性应用层迁移说明。
- 发布 E2E 证据索引、capability 矩阵和 Profile `v1` 的条件性附录。

**不包含**：
- 不把 lrnev Guidance Profile 描述为 MCP 官方标准。
- 不复制 04 的原始运行日志；文档只引用 run id/evidence path 和结论。
- 不用文档文本取代服务端 Constraint 校验。
- 不在本 Spec 创建新的协议字段或变更工具签名。

## L2 详情

### 详细需求

#### F-01 文档信息架构

- 验收：`dev-docs/ai-guidance-standardization` 下至少有 Semantic Authority Model、Guidance Surface Inventory、MCP Response Conformance、Client Integration Guide、E2E Evidence Index；Profile 文档作为独立可选附录，不阻塞前五项发布。

#### F-02 MCP 与 lrnev Profile 边界

- 验收：每份面向客户端的文档明确 MCP 标准传输能力和 lrnev 应用层 Profile 的区别；明确 tool annotations 仅为 hints，不能作为授权或安全依据。

#### F-03 客户端集成契约

- 验收：指南规定客户端保留原始用户请求、v1 仅在 `assess_goal`/`scene_create`/`spec_create`/`task_create` 按 `client_asserted` 传入 `decision_context`，`spec_update` 等工具不传；缺失不推断、explicit/preferred 必须提供 direction、unspecified 必须省略 direction、target_ref 使用完整稳定引用、枚举级不阻断对齐，以及 content/structuredContent 的消费优先级和错误处理。

#### F-04 破坏性迁移与 response_version 说明

- 验收：说明旧“content 完整 JSON”应用层约定已废弃，新的完整机器数据位于 structuredContent，content 是逐工具 ModelVisibleContract 语义视图；列出独立 response_version、版本、升级步骤、受影响客户端、B2a/B2b 验证方法和回滚路径。

#### F-05 E2E 与 capability 证据引用

- 验收：capability 矩阵只引用 04 的 run id、client/version/model、stage 和结论；区分静态声明、运行时观察和 Profile 适配结论；不复制或伪造原始证据。

#### F-06 文档验证与发布清单

- 验收：术语、链接、surface_id、schema 版本、错误码引用和示例工具调用可自动检查；发布清单要求 01/02/03 产物完成，05 Profile 文档按实际版本条件追加。

### 非功能性需求

- 准确性：文档中的“必须/阻断”只能引用真实服务端执行约束。
- 可用性：未适配 Profile 的通用 MCP 客户端也能按基础文档正确消费结果。
- 可维护性：每个文档明确 owner、版本、来源 Spec 和更新触发条件。

### 验收标准

- [ ] F-01 至 F-06 完成。
- [ ] 基础文档不依赖 05 的实施状态即可发布。
- [ ] response_version、MCP protocol version、Profile version 的边界独立且无冲突。
- [ ] content、structuredContent、Profile、decision_context 的边界没有互相矛盾。
- [ ] 迁移、回滚和 capability 结论均可回溯到源码或 E2E 证据。
