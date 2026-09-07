---
scene: '04-ai-guidance-standardization'
created: '2026-08-26'
---

# Ai Guidance Standardization - 路线图

> 本 Scene 的中长期规划。Spec 是路线图的具体实施。

## 当前阶段

端到端结构化设计收敛阶段。Scene 已拆为 6 个 Spec：语义规范、Surface 基线、MCP Conformance、Agent E2E、Guidance Profile 和独立文档发布。结构化是确定目标，E2E 用于字段保留/回退和客户端适配验证。

## 已完成

- 完成 `GoalAssessor`、guidance、SpecGuidance、`ai_followup` 和 Spec/Task 调用链审查。
- 确认 `spec_create` 不会因已有 Spec 而在执行层强制拒绝新建。
- 确认当前工具结果只用 content text，尚无 outputSchema/structuredContent。
- 确认 archived Spec 禁止新增 Task 不是现有约束，E2E 改用真实状态机拒绝。
- 决定实施端到端结构化并保留 content 文本通道，但废弃“content 必须包含完整 JSON”的旧应用层约定。

## 下一项

- `01-00-semantic-authority-model`：发布五种角色、三维分析、真实 Constraint 和五类案例的 `v0.1`。

## 已规划

- `02-00-guidance-surface-inventory`：完整 Surface 清单、hash 和 B0 静态基线。
- `03-00-mcp-response-conformance`：全工具 response_version/outputSchema/structuredContent/ModelVisibleContract/isError/annotations。
- `04-00-agent-e2e-observability`：E-01 至 E-09、B0/B1/B2a/B2b/B3 对照和字段回退证据。
- `05-00-lrnev-guidance-profile`：Profile `v1`、decision_context 和客户端适配。
- `06-00-guidance-documentation`：基础规范、集成、迁移、证据索引和 Profile 附录。

## 执行顺序与门禁

1. 完成 `01-00`，冻结 Semantic Authority Model `v0.1`。
2. 完成 `02-00`，冻结 Guidance Surface 清单和变更前静态基线。
3. 用 `04-00` 建 fixture 并跑 B0 当前行为基线。
4. 以 `01-findings-remediation/specs/08-00-guidance-semantic-boundary` 作为已批准的高危文案迁移载体，按 `01 v0.1` 重新核对术语后执行并跑 B1；其中旧 `【重要】` 前缀必须按 `01-00` D-01 的真实含义拆为 `【决策边界】`、`【执行约束】` 或 `【下一步】`，不能机械保留或统一改成 Constraint。
5. 实施 `03-00` 的 outputSchema/structuredContent，保持 B1 模型可见信息，跑 B2a 传输/capability 对照。
6. 实施逐工具 ModelVisibleContract，跑 B2b 内容视图对照；内容变化与 transport 增强分别归因。
7. 实施 `05-00` 最小 Profile `v1` 和 decision_context，跑 B3；按字段证据保留、调整或回退。
8. `06-00` 分阶段发布基础文档，B3 后补 Profile/capability 最终结论。

## 待评估

- decision_context 应覆盖哪些组织决策工具，是否需要按工具收窄字段。
- 哪些 Profile 可选字段能被主力客户端稳定消费并带来可测改善。
- 每个工具的 ModelVisibleContract、查询边界和 token 预算。
- 跨会话稳定决定是否继续使用既有 memory/ADR，而不是自动持久化临时 context。
