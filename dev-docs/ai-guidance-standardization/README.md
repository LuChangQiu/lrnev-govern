---
title: 'lrnev AI Guidance Standardization'
status: 'stable'
created: '2026-08-26'
updated: '2026-09-08'
scene: '04-ai-guidance-standardization'
---

# lrnev AI Guidance Standardization

> **现状（2026-09）**：Scene 04 战役已收口——01-00~05-00 全部 spec 完成（03-00 M1/M2 双通道契约、04-00 E-01~09 + B0~B2b/B3/B4 对照、05-00 Profile 随 3.0.0 发布）；06-00 交付物按 3.0.0 实现归档。2026-09-07 收口窗口补齐 P0 悬空账：ADR-0001 两维截断（TextStatus/TextMeta/QueryMeta）与 ADR-0003 hook drain 按决策落地（03-00 T-007/T-008，commit 18626e1，全量 1076 测试全绿——详见 ADR 实施状态注记）。本目录现为**战役档案**：先读 `06-00-e2e-evidence-index.md`（唯一证据索引）与 `dev-docs/decisions/README.md`（审定决策档案）；讨论区过程记录（意见轮次/会话日志）留在本机 `ai-discussions/`。下方历史内容（目标/原则/待决问题）是战役期的过程快照，不代表当前决策状态。

这份文档是 Scene `04-ai-guidance-standardization` 的跨 Agent 讨论入口。它用于让 Codex、DeepSeek Web 和本地 Agent 在同一组架构事实、边界和待决问题上继续讨论。

## 目标

让 lrnev 成为一个真正可复用的 MCP 治理基础设施：提供项目事实、可解释建议和确定性执行边界，同时保留客户端 AI 的判断权和用户的最终目标选择权。

核心原则：

```text
Recommendation != Rule
Decision Boundary != Execution Constraint
Client Assertion != Server Fact
MCP Conformance != lrnev Guidance Profile
```

## 已确认的源码事实

1. `spec_create` 不会因为已有相似 Spec 而在执行层拒绝创建。
2. `GoalAssessor` 是不调用 LLM 的复杂度启发式评估器，输入是 `goal: string`，不是完整用户对话。
3. `AiFollowup.instructions` 当前是扁平 `string[]`，注释把它描述为按顺序执行的自然语言待办指令。
4. （2026-09-07 修订：本条原为"当前所有工具结果都被 JSON 序列化进 `content[].text`，没有 outputSchema/structuredContent"，随 03-00 M1/M2 实施已过时）当前工具结果走**双通道**：`content[].text` 是按工具渲染的模型可见文本（ModelVisibleContract 渲染器，含角色前缀行与修复 hint，未注册回退 legacy JSON）；`structuredContent` 携带 canonical 信封（`response_version: '1'` / `ok` / `data` / `errors` / `ai_followup` / `anchor_context` / `summary_context`），各工具随 tools/list 声明 `outputSchema`；`ok=false`（含 AMBIGUOUS_REF）统一 `isError=true`。实现见 `src/mcp/helpers/tool-result-adapter.ts`、`src/mcp/helpers/model-visible-contract.ts`、`src/mcp/types/response-envelope.ts`。
5. Guidance 分布在 server instructions、tool descriptions/input descriptions、resources、manager followup、错误、Scene/Spec guidance、文档和客户端常驻规则多个入口。
6. `scene_create.intent` 是 Scene 的业务意图描述，不等于用户对 Spec 组织方式的最终决定。

## 语义模型 v0.1

| 角色 | 责任主体 | 含义 | 执行效果 |
|---|---|---|---|
| FACT | lrnev | 可验证项目状态 | 只提供背景 |
| RECOMMENDATION | lrnev | 可解释治理建议 | 不阻断 |
| DECISION_BOUNDARY | client + lrnev text | 不得未经确认替用户改变明确目标 | 客户端行为边界 |
| EXECUTION_CONSTRAINT | lrnev server | 已实现的确定性校验 | 服务端拒绝 |
| ACTION_HINT | lrnev | 可选下一步 | 不等于 required step |

`decision_context` 是客户端对用户当前组织决定的声明，source 固定为 client_asserted；explicit/preferred 提供 direction，unspecified 省略 direction，可选 target_ref。服务端只做枚举级非阻断对齐；它不是 USER_DECISION 服务端事实，也不自动持久化。

选择方向和执行可行性分开：

```text
user conversation -> client_asserted decision_context
FACT + RECOMMENDATION + DECISION_BOUNDARY -> ACTION CANDIDATE
ACTION CANDIDATE -> EXECUTION_CONSTRAINT -> EXECUTION / ERROR
```

## A/B/C 失败模型

- A 过度遵守：AI 把 Recommendation 当成 Rule。
- B 选择性遵守：引导过多且无类型，AI 只吸收部分文本。
- C 意图断裂：lrnev 看不到用户原始对话，无法验证用户决定来源。

端到端方案同时处理三类问题：文本角色处理 A，Surface/E2E 处理 B，decision_context 建立 C 的声明通道；任何 client assertion 都不能伪装成服务端事实。

## 当前决策

- 只在 Scene 04 内收敛端到端结构化架构；其他 Scene 的治理债不在本轮处理。
- 保留 MCP content 通道，但废弃“content 必须复制完整 JSON”的旧应用层约定；改为逐工具 ModelVisibleContract，完整呈现模型判断所需信息。
- structuredContent 承载完整机器数据并带独立 response_version；Profile 是 lrnev 应用层协议，不是 MCP 标准。
- Profile `v1` 和 decision_context 确定实施；04 对可选字段做保留/回退验证。

## Scene 04 Spec 分工

| Spec | 责任 | 当前门禁 |
|---|---|---|
| `01-00-semantic-authority-model` | 五种角色、三维框架、真实 Constraint、v0.1 | 达到最小冻结边界即完成 |
| `02-00-guidance-surface-inventory` | 全 Surface 清单、hash、冲突与静态基线 | 只登记 capability，不判断运行时消费 |
| `03-00-mcp-response-conformance` | 全工具结构化 MCP 响应与 ModelVisibleContract | 不受语义门禁 |
| `04-00-agent-e2e-observability` | E-01~09、B0/B1/B2a/B2b/B3、字段保留/回退证据 | 工具动作是 oracle，不以字段存在判定 |
| `05-00-lrnev-guidance-profile` | Profile v1、decision_context、客户端适配 | 确定实施；可选字段受证据门禁 |
| `06-00-guidance-documentation` | 基础规范、集成、迁移、证据和 Profile 附录 | 基础文档无条件发布 |

推荐执行顺序：`01` -> `02` -> `04/B0` -> 文本迁移 -> `04/B1` -> `03/B2a` -> ModelVisibleContract/B2b -> `05/B3` -> `06` 最终发布。

## 待决问题

1. decision_context 的 direction/target_ref 是否需要按不同组织决策工具进一步收窄。
2. Profile v1 除 role/text/version 外，哪些字段能被客户端稳定消费。
3. 每个工具的 ModelVisibleContract 应保留哪些数据和 guidance，怎样通过查询边界控制 token。
4. 哪些稳定决定值得跨会话保存；临时 decision_context 默认不保存。

## 讨论规则

- 先区分源码事实、架构判断和待验证假设。
- 不因一次模型误读就增加硬规则或新 Agent。
- 任何协议字段必须说明来源、可信度、兼容性和失败降级。
- 先形成可验收的 Spec，再修改跨模块源码。
