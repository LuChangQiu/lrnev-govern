---
scene: '04-ai-guidance-standardization'
created: '2026-08-26'
---

# Ai Guidance Standardization - 架构

> 本文档描述本 Scene 内所有 Spec 共享的架构约束。
> 单个 Spec 的具体设计在各自的 design.md 中。

## L0 摘要

本 Scene 将 lrnev 定位为端到端结构化治理基础设施：MCP 负责可靠传输，Profile 负责应用语义，客户端负责用户意图理解，服务端只对真实执行约束进行阻断。

## L1 概览

### 关键模块

- **语义规范层**：五种文本角色、三维分析框架、真实 Constraint 清单和 decision context 来源边界。
- **事实提供层**：`project_status`、`governance_map`、`context_search`、Spec/Task/Scene managers，返回可验证的工作区状态。
- **MCP 传输层**：server/tool/resource schema、独立 `response_version`、`outputSchema`、`structuredContent`、逐工具 ModelVisibleContract `content`、`isError`、annotations 和协议版本。
- **Guidance Profile 层**：`lrnev.guidance/v1`、结构化 guidance、可选 `decision_context` 和文本投影。
- **确定性约束层**：状态机、gate、必填字段、文件完整性和安全校验，只判断动作是否可执行。
- **验证与观测层**：Surface 基线、schema/ModelVisibleContract 测试、B0-B1-B2a-B2b-B3 真实 Agent E2E、工具调用序列和 capability 证据。
- **文档发布层**：基础语义、MCP Conformance、客户端集成、迁移、证据索引和 Profile 附录。

### 数据流

```text
用户原始对话
    -> 客户端 AI 理解用户意图并可传 client_asserted decision_context
    -> lrnev 读取工作区事实并生成结构化 guidance
    -> MCP 返回 structuredContent（完整机器数据）+ content（逐工具模型语义视图）
    -> AI 按 FACT / RECOMMENDATION / DECISION_BOUNDARY / ACTION_HINT 综合判断
    -> 客户端调用 spec/task/其他工具
    -> lrnev 执行真实 EXECUTION_CONSTRAINT
    -> 工作区文件成为 Project Truth
```

选择方向和执行可行性分成两条轴：Recommendation/decision context 参与“选哪个方向”，Execution Constraint 判断“这个动作能不能做”。不使用全局数字 priority 混为单一排序。

### 技术决策

1. `GoalAssessor` 继续负责复杂度启发式，不负责判断用户是否已经做出最终决定。
2. 服务端不得生成 USER_DECISION；`decision_context` 只能是 client_asserted，缺失与 unspecified 不等价。
3. Recommendation 不阻断；Decision Boundary 约束客户端行为；只有真实 Execution Constraint 描述服务端拒绝。
4. 用户已决定端到端结构化：MCP Conformance 和最小 Guidance Profile 均实施，E2E 决定可选字段保留或回退。
5. `structuredContent` 承载完整机器数据；`content` 是 MCP 通用非结构化结果通道，按逐工具 ModelVisibleContract 完整呈现模型判断所需信息，不永久复制完整 JSON。
6. Tool annotations 只是 hints，不参与授权、安全或状态校验。
7. decision context 默认不持久化；跨会话稳定决定仍需用户明确选择既有持久化渠道。

## L2 详情

### 模块详细设计

- 语义规范由 `01-00-semantic-authority-model` 定义；任何后续协议或文案变更必须引用其语义锚点。
- Guidance Surface 的实际入口和预算由 `02-00-guidance-surface-inventory` 维护；清单先于大规模迁移。
- `03-00-mcp-response-conformance` 负责全工具标准传输，不定义 lrnev guidance 角色。
- 客户端行为由 `04-00-agent-e2e-observability` 验证；单元测试不能替代真实 Agent 盲测。
- `05-00-lrnev-guidance-profile` 实施最小结构化语义和 decision_context；04 对每个可选字段给出保留/回退证据。
- `06-00-guidance-documentation` 无条件发布基础语义、传输和客户端迁移文档，Profile 专属内容按实际版本追加。

### 接口契约

- 全部工具声明 outputSchema 和独立 response_version，完整机器数据进入 structuredContent；content 从同一结果按逐工具 ModelVisibleContract 渲染。
- 组织决策相关工具可接受可选 decision_context；source 固定 client_asserted，explicit/preferred 提供 direction，unspecified 省略 direction，可选 target_ref；缺失不推断、不持久化，只做当前工具类别的枚举级非阻断对齐。
- 结构化 guidance 和文本投影由同一语义对象派生；未知 role 不得升级为 Constraint。
- 写入工具在 context 与动作一致时避免返回反向诱导；不一致时给 Decision Boundary 对齐提示，不自动阻断、重写或回滚。
- Profile 解析或客户端适配失败不能损坏业务 data 和真实 Execution Constraint。

### 非功能性要求

- 性能：全局 guidance、单次 followup 和 ModelVisibleContract 文本应有可测的字符/token 预算；体积限制只能通过 canonical 查询边界显式实现。
- 可用性：通用客户端可通过 content 阅读必要结果；结构化客户端通过 structuredContent 消费完整数据。
- 安全性：用户决定不能绕过安全、状态和完整性约束；客户端传入的意图上下文不得被当作服务端验证事实。
- 可演进性：MCP transport、Profile 和文档分别版本化，不能用一个版本号隐含三层兼容。
