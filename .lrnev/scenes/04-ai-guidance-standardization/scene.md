---
id: '04-ai-guidance-standardization'
number: 4
name: 'ai-guidance-standardization'
status: draft
created: '2026-08-26'
intent: '端到端标准化 lrnev 面向客户端 AI 的治理契约：统一语义角色、MCP 结构化响应、client_asserted decision_context、真实执行约束、Agent E2E 与客户端文档。'
---

# Ai Guidance Standardization

## L0 摘要

建立 lrnev 端到端结构化治理契约：客户端保留并声明用户 decision context，MCP 交付结构化项目结果，Guidance Profile 区分事实、建议、决策边界、执行约束和下一步，同时保留 AI 判断权。

## L1 概览

lrnev 当前通过 MCP server instructions、tool metadata、resources、`ai_followup`、Scene/Spec guidance 和客户端常驻规则向 AI 提供项目治理信息；工具结果则被整体序列化进 `content[].text`，没有 `outputSchema/structuredContent`。事实、建议、客户端行为边界、执行约束和下一步容易被混为同一层级，用户意图也没有结构化请求通道。

本 Scene 以“只引导，不强制”为总原则：客户端 AI 负责理解并保留用户原始对话，可通过 `client_asserted decision_context` 把组织方式决定传给 lrnev；lrnev 负责提供可验证事实、可解释建议、客户端决策边界和真正由代码执行的约束。客户端声明不是服务端事实，不持久化为 Project Truth，也不能绕过执行约束。

用户已决定实施端到端结构化。实施仍分阶段以保证可归因：先冻结语义规范和 Surface 基线，再建立 Agent 基线与文本迁移对照，随后完成 MCP Response Conformance，最后实施最小 Guidance Profile 和 `decision_context`，由 E2E 决定可选字段保留、调整或回退。

## L2 详情

### 业务背景

lrnev 已经具备事实存储、上下文检索、Spec/Task 管理和 MCP guidance，但客户端 AI 接收这些信息时仍主要依赖平铺自然语言。相同会话中，项目事实、治理建议、用户原话、动作提示和确定性约束可能同时出现，导致两类风险：AI 把 Recommendation 当成 Rule，或者在 guidance 过载时选择性吸收其中一部分。用户明确说“我要新建 Spec”却被已有 Spec 的复用建议覆盖，就是这一边界不清的直接表现。

本 Scene 的目的不是增加流程裁判，而是分开标准化三层：MCP transport 负责可靠传输，lrnev Guidance Profile 负责应用语义，客户端负责用户对话理解。所有结构化字段都必须通过真实客户端 E2E 证明可被交付、消费或提供追溯价值，不能因为“结构化看起来更完整”无限扩张。

### 边界与范围

**包含**：
- 五种文本角色和 provenance / role / enforcement 分析框架
- 全部 Guidance Surface、MCP resources/metadata/schema/result 通道的清单和基线
- 全工具 `outputSchema`、`structuredContent`、`content` 呈现、`isError` 和 annotations 的 MCP Conformance
- `lrnev.guidance/v1` 最小 Guidance Profile 和组织决策相关工具的可选 `decision_context` 输入
- E-01 至 E-09、B0/B1/B2a/B2b/B3 的真实 Agent 对照与字段级保留/回退证据
- 基础语义、客户端集成、破坏性迁移、capability 和 Profile 文档

**不包含**：
- 不把 lrnev 改造成流程裁判或多 Agent 编排引擎
- 不由 lrnev 根据启发式结果伪造用户决定
- 不使用数字 priority 比较不同语义，不把三维分析框架机械实现成全字段 schema
- 不把 `decision_context` 当作服务端事实、硬约束或自动持久化决定
- 不把 lrnev Guidance Profile 宣称为 MCP 官方标准
- 不用 Decision Record 自动记录每一次临时对话选择

### 关键术语

| 术语 | 定义 |
|------|------|
| FACT | lrnev 能从工作区或确定性状态验证的项目事实，不表达应该采取的动作。 |
| RECOMMENDATION | 基于事实和治理经验的建议，可以接受、拒绝或替换，不阻断。 |
| DECISION_BOUNDARY | 客户端 AI 不得未经确认替用户改变明确目标的行为边界，不是服务端校验。 |
| EXECUTION_CONSTRAINT | 已由服务端代码执行的状态、安全、结构或完整性校验。 |
| ACTION_HINT | 当前结果之后可选的工具或操作，不等于 required step。 |
| Decision Context | 客户端对用户当前组织方式决定的声明；必须标记 `client_asserted`，不等同服务端事实。 |
| MCP Response Conformance | MCP 标准传输契约：outputSchema、structuredContent、content、isError、annotations 和版本兼容。 |
| lrnev Guidance Profile | 构建在 MCP 之上的 lrnev 应用层语义协议，不是 MCP 官方标准。 |
| Guidance Surface | 任何会影响客户端判断或数据交付的 instructions、metadata/schema、resources、results、错误、文档和常驻规则。 |

### 文档面分工（消歧注记 2026-09-07，文件治理裁决 §A.4）

本 Scene 的 `.lrnev` 文档（本 scene.md、architecture/roadmap、specs/*/ 的 requirements/design/tasks）
是**运行与验收真值**（gate、validates、任务对照的唯一来源）；
`dev-docs/ai-guidance-standardization/` 是**研究发布面**（人类可读档案、inventory/evidence/集成文档），
内容单向由 spec 发布（spec → 发布），不反向成为真相源，两树不以任何方向互为编辑真值。

### 相关 Scene

- `01-findings-remediation`：承载当前 guidance 语义问题的既有修复 Spec。
- `02-context-delivery`：承载上下文、摘要和检索能力，为 FACT 提供来源。
- `03-workspace-hygiene`：承载工作区和运行态卫生能力，为约束和诊断提供基础。

## 维护说明

- 本文档由用户主导编写，AI 协助填空
- 修改后 AI 应同步更新 `.abstract.md` / `.overview.md`
