---
title: 'AI Guidance Standardization Review Brief'
scene: '04-ai-guidance-standardization'
created: '2026-08-26'
---

# AI Guidance Standardization Review Brief

这份简报供 DeepSeek Web、Claude、Codex 或本地 Agent 复核 Scene `04-ai-guidance-standardization`。审查时以仓库源码和本 Scene 文档为依据，不要只根据文件名推断行为。

## 目标

判断 lrnev 是否能在“只引导、不强制”的前提下成为可复用的 MCP Governance 基础设施，重点解决：

```text
Recommendation -> 客户端 AI -> 被误读为 Rule
```

典型冲突：已有 Spec 可以承载，但用户明确说“我要新建一个独立 Spec”。正确行为是允许 AI 解释复用的治理代价，但不能未经确认替用户改成 `task_create`。

## 必须坚持的边界

- 五种角色：FACT、RECOMMENDATION、DECISION_BOUNDARY、EXECUTION_CONSTRAINT、ACTION_HINT。
- `decision_context` 只能是 client_asserted；direction/target_ref 只做枚举级非阻断对齐；服务端不得生成 USER_DECISION。
- EXECUTION_CONSTRAINT 必须对应真实代码校验；Recommendation 和 Decision Boundary 不阻断。
- 不用数字 `priority` 排序不同角色，不把三维模型变成通用必填 schema。
- MCP Conformance 与 lrnev Guidance Profile 必须分层，Profile 不是 MCP 官方标准。
- 不因为一次模型误读就增加 Agent、硬规则、Decision 数据库或复杂 Workflow。

## 审查对象

1. `01-00-semantic-authority-model`：语义定义、来源和双轴冲突模型是否闭合。
2. `02-00-guidance-surface-inventory`：是否真正覆盖所有 guidance 入口，是否能发现重复、冲突和无类型硬措辞。
3. `03-00-mcp-response-conformance`：response_version、outputSchema、structuredContent、逐工具 ModelVisibleContract、isError 和 annotations 是否覆盖全部工具并符合 SDK。
4. `04-00-agent-e2e-observability`：E-01~09、B0/B1/B2a/B2b/B3、decision_context 和字段回退是否可归因。
5. `05-00-lrnev-guidance-profile`：Profile v1 是否最小、是否避免服务端伪造决定、客户端是否实际消费。
6. `06-00-guidance-documentation`：基础文档是否可独立发布，破坏性迁移和 Profile 边界是否准确。

## 输出格式

请按严重程度列出：

1. 阻断问题：会导致用户目标被替换、Constraint 被绕过或旧客户端不可用的问题。
2. 重要缺口：会导致无法验收、无法回放或入口漏盘点的问题。
3. 可选改进：不影响当前门禁、可留到后续 Spec 的建议。

每条问题必须给出：文件、章节、具体矛盾、风险和最小修正建议。没有问题时明确写“未发现阻断问题”，并列出仍需真实 E2E 验证的假设。

## 当前执行顺序

按 Scene 04 roadmap 执行：01 规范 -> 02 基线 -> 04/B0 -> 文本迁移/B1 -> 03/B2a -> ModelVisibleContract/B2b -> 05/B3 -> 06 最终发布。端到端结构化已获批准，E2E 决定 Profile 可选字段保留或回退。
