---
title: lrnev Guidance Semantic Authority Model
version: v0.1
status: frozen
scene: 04-ai-guidance-standardization
spec: 01-00-semantic-authority-model
created: 2026-08-27
---

# lrnev Guidance Semantic Authority Model v0.1

## 1. 文档状态与适用范围

本文件是 `04-ai-guidance-standardization / 01-00-semantic-authority-model` 的唯一语义权威规范。它约束 lrnev 文档、工具响应、客户端解释和后续 AI Guidance Spec 对“事实、建议、用户选择与服务端校验”的表达方式；它**不**新增 MCP 字段、持久化状态、通用优先级，也不改变任何工具的运行时逻辑。

- **版本状态：**`v0.1`，2026-08-27 冻结；后续语义变更必须以新版本修订，不能以局部文案悄然覆盖本文件。
- **适用对象：**lrnev 服务端文案与结果、客户端 Guidance、AI 调用方、评审与测试作者。
- **非适用对象：**本文件不是一个通用 response schema；`provenance`、`role`、`enforcement` 不是所有消息都必须序列化的字段。
- **权威关系：**运行时代码决定真实可执行性；本文件必须如实描述代码。文案不能把未实现的策略宣称为服务端规则。

## 2. 规范性关键词与兼容原则

- **必须：**违反后会造成语义失真、误导客户端或虚构服务端能力。
- **应：**通常应满足；若不满足，输出方应能说明原因和替代动作。
- **可以：**可选增强，不能成为无证据的阻断理由。

历史文案中的 `【重要】` 可以作为兼容前缀保留，但它只表示需要注意；不得机械地把 `【重要】` 翻译为 `【执行约束】`。所有 `【执行约束】` 都必须能回指本文件第 6 节中的确定性服务端校验。

## 3. 五种文本角色

| 角色 | 推荐前缀 | 责任主体 | 允许语气 | 含义与执行效果 | 正例 | 反例 |
| --- | --- | --- | --- | --- | --- | --- |
| `FACT` | `【事实】` | lrnev / 工作区证据 | 陈述、引用、可复核 | 已知状态、文件内容或工具结果；本身不命令用户，也不伪装成用户选择。 | `【事实】Spec 01 当前状态为 in-progress。` | `【事实】用户已经决定采用方案 A。`（没有用户或客户端断言） |
| `RECOMMENDATION` | `【建议】` | lrnev | 建议、优先考虑、可选择 | 基于事实给出的非阻断建议；用户明确要求其他合法动作时，建议必须让位。 | `【建议】已有相近 Spec 时，可先在现有 Spec 下创建 Task。` | `【建议】因此只能使用现有 Spec，不能创建新的 Spec。` |
| `DECISION_BOUNDARY` | `【决策边界】` | 客户端 | 已确认、需要确认、以最后确认方向为准 | 描述由用户原话或客户端确认形成的方向；客户端负责确认、变更和展示，服务端不据此捏造用户决定。 | `【决策边界】用户已确认“新建 Spec B”；后续动作以该确认优先。` | `【决策边界】服务端将拒绝所有其他方向。` |
| `EXECUTION_CONSTRAINT` | `【执行约束】` | 服务端确定性代码 | 必须、拒绝、不会落盘、请修正输入 | 由现有校验或状态机强制执行；违反时产生可观测错误或无写入结果。 | `【执行约束】archived Spec 不能转换为 in-progress；状态机将返回 INVALID_STATUS_TRANSITION。` | `【执行约束】archived Spec 不能新增 Task。`（现有 `TaskManager.create` 未实现此限制） |
| `ACTION_HINT` | `【下一步】` | lrnev / 客户端 | 可执行下一步、可先确认 | 帮助调用方继续流程的可选动作；不得取代用户确认，也不得隐含强制策略。 | `【下一步】先调用 task_list 确认依赖 Task ID，再创建任务。` | `【下一步】无需确认，系统已替用户选择最优方案。` |

`RECOMMENDATION` 不会阻断；`DECISION_BOUNDARY` 不是服务端约束；`EXECUTION_CONSTRAINT` 必须对应确定性代码。一个响应可同时包含事实、建议和下一步，但不应把它们混写成一条看似强制的结论。

## 4. 三维分析框架

本框架仅用于评审、文案设计和案例核验；它不是通用消息协议，不要求在每个 MCP `content`、`structuredContent` 或文档段落中新增字段。

| 维度 | 典型值 | 说明 |
| --- | --- | --- |
| `provenance` | `workspace`、`lrnev`、`client_asserted`、`user_quote` | 信息来自工作区、服务端推导、客户端声明或用户原话。`client_asserted` 与 `user_quote` 才能承载当前用户决定。 |
| `role` | `fact`、`recommendation`、`decision_boundary`、`execution_constraint`、`action_hint` | 采用第 3 节定义的语义角色。 |
| `enforcement` | `none`、`client_boundary`、`server_enforced` | 无强制、客户端确认边界、服务端确定性强制。 |

不得使用单一数字 `priority` 比较不同语义；例如“建议比用户确认重要”或“事实比服务端校验优先”都是错误的归约。发生冲突时，先判断信息来源与角色，再检查是否存在真实服务端校验。

## 5. 决策来源边界与核心流程

### 5.1 USER_DECISION 的唯一来源

当前 decision context 只能来自用户原话（`user_quote`）或客户端确认（`client_asserted`）。服务端不得凭下列内容输出“用户已经决定”“用户确认了 X”或等价结论：

- `GoalAssessor.kind`、`GoalAssessor.score`、`GoalAssessor.suggested_next_step`；
- 任意工具调用结果、相似 Spec 检索结果或 Gate 结果；
- 模型推断、偏好猜测或历史文案。

`GoalAssessor` 是接收 `goal: string` 的启发式分析器，不是用户意图的权威来源，也不调用 LLM。它的 `suggested_next_step` 只能形成 `RECOMMENDATION` 或 `ACTION_HINT`，不能形成 `USER_DECISION`。

### 5.2 核心流程

```text
用户对话 / 客户端确认
  -> 客户端识别 user_quote 或 client_asserted
  -> lrnev 返回 FACT、RECOMMENDATION、ACTION_HINT
  -> 客户端展示并维护 DECISION_BOUNDARY
  -> 调用方提交候选动作
  -> 服务端只按真实 EXECUTION_CONSTRAINT 校验
  -> 成功结果或带错误码、field、hint 的拒绝结果
```

最后一次有效的客户端确认覆盖先前确认。若没有明确确认，客户端可在低风险且可逆的情况下选择并解释；其他情况应先请求澄清。服务端只处理已提交的工具输入和真实校验，不保存或推断用户的未声明偏好。

## 6. 真实 Execution Constraint 清单

下表是 v0.1 允许称为 `EXECUTION_CONSTRAINT` 的现有校验。每条均给出源码位置、触发条件、可观测结果和替代动作；没有列入本表的策略不得被伪装成服务端硬约束。

| 真实约束 | 源码位置 | 触发条件 | 可观测结果 | 合法替代动作 |
| --- | --- | --- | --- | --- |
| Spec 状态合法迁移 | `src/types/spec.ts` 的 `VALID_SPEC_TRANSITIONS`；`src/core/SpecManager.ts` 的 `updateStatus` | 请求的目标状态不在当前状态允许迁移集合中；例如 `archived -> in-progress` | 返回 `INVALID_STATUS_TRANSITION`，不写入状态 | 选择状态机允许的动作；`archived` 无合法目标，需通过新的治理决策处理，而非伪造回退。 |
| 父 Task 必须存在 | `src/core/TaskManager.ts` 的 `TaskManager.create` | `parent` 不存在于当前 Spec 的 Task 集合 | 返回 `TASK_NOT_FOUND`，字段为 `parent`，不落盘 | 先创建父 Task，或移除 / 修正 `parent`。 |
| 依赖 Task 必须存在 | `src/core/TaskManager.ts` 的 `TaskManager.create` | `depends_on` 包含不存在的 Task ID | 返回 `TASK_NOT_FOUND`，字段为 `depends_on`，不落盘 | 先确认 `task_list` 中的 ID，或移除 / 修正不存在的依赖。 |
| validates 必须格式正确且锚点存在 | `src/core/TaskManager.ts` 的 `TaskManager.assertValidatesAnchors` | `validates` 不是 `F-xx` / `D-xx`，或对应 requirements / design 标题不存在 | 输入校验错误（格式不合法为 `INVALID_INPUT`；锚点不存在为 `ANCHOR_NOT_FOUND`），不落盘 | 使用真实存在的 `#### F-xx` 或 `#### D-xx` 标题编号。 |
| 工具必填输入不可任意补值 | `src/mcp/tools/index.ts` 的 Zod schemas；各 Manager 的输入检查 | 缺少必填参数，例如 Task `title` 为空 | 返回参数校验错误或 `INVALID_INPUT`，不使用任意默认值 | 由调用方补齐字段；可选字段仅按接口约定使用默认值或 `null`。 |

### 6.1 明确不是服务端约束的说法

| 错误说法 | 为什么不是约束 | 正确表达 |
| --- | --- | --- |
| archived Spec 不能新增 Task | `TaskManager.create` 没有按 Spec 状态拦截新增任务的校验。 | `【事实】当前代码未禁止 archived Spec 新增 Task；是否应禁止属于后续治理决策。` |
| ready gate 会为其他工具建立全局锁 | Gate 返回的是检查结果，不是对其他工具的通用互斥锁。 | `【建议】先修复 gate 问题再继续，除非用户选择其他合法路径。` |
| 发现已有相近 Spec 后不能创建新的 Spec | 相似性只能形成建议，`spec_create` 不因相近项自动拒绝。 | `【建议】优先评估复用已有 Spec；用户明确新建且输入合法时仍可创建。` |

## 7. 五类语义案例

以下固定 fixtures 是客户端、服务端与测试的共同核验基线。每个案例都必须分别展示客户端行为、服务端行为和可观察结果。

### E-01 明确用户请求优先于推荐

- **场景：**已有相近 Spec A，服务端给出“在 A 下建 Task”的 `RECOMMENDATION`；用户明确要求“新建 Spec B”。
- **客户端行为：**记录用户原话或确认结果为 `DECISION_BOUNDARY`，调用 `spec_create(B)`；不把建议显示成禁令。
- **服务端行为：**只校验 `spec_create` 的真实输入约束；不会因存在 A 而阻止 B。
- **可观察结果：**B 在输入合法时创建成功；响应可以同时说明 A 的存在和创建 B 的事实。

### E-02 推荐但未确认

- **场景：**服务端建议复用已有 Spec，但用户没有明确选择。
- **客户端行为：**展示 `RECOMMENDATION` 与候选下一步；对不可逆或影响范围大的动作请求确认。
- **服务端行为：**不生成 `USER_DECISION`，不把推荐写成拒绝规则。
- **可观察结果：**没有“用户已选择”字段或文案；用户仍可选择任何满足真实约束的路径。

### E-03 未指定方向

- **场景：**用户仅表达目标，未说明应复用、创建还是修改哪一个对象。
- **客户端行为：**低风险、可逆时可以选择并解释；否则先提问澄清。
- **服务端行为：**可返回事实、建议、下一步和工具参数错误，但不持久化猜测出的方向。
- **可观察结果：**任何自动选择都带解释且可改；没有来自 `GoalAssessor` 的伪造 `USER_DECISION`。

### E-04 用户改变主意

- **场景：**用户先确认方案 A，随后明确改为方案 B。
- **客户端行为：**用最后一次有效确认更新 `DECISION_BOUNDARY`，明确告知 A 已被替换。
- **服务端行为：**按 B 的实际工具输入与校验执行，不以旧确认制造额外阻断。
- **可观察结果：**后续动作按 B 处理；历史 A 可以保留为对话记录，但不能继续被当作当前决定。

### E-05 真实约束冲突

- **场景：**用户要求把 `archived` Spec 改回 `in-progress`。
- **客户端行为：**解释这是服务端状态机的 `EXECUTION_CONSTRAINT`，展示错误与可选替代路径，不将其说成偏好分歧。
- **服务端行为：**`SpecManager.updateStatus` 返回 `INVALID_STATUS_TRANSITION`，不写入状态。
- **可观察结果：**响应包含错误码和修正 hint；Spec 状态保持 `archived`。

## 8. 静态语义检查

所有新增或改写 Guidance 文案至少应通过下列静态审查。该检查审查语义，不替代运行时校验。

| 检查项 | 必须满足的规则 |
| --- | --- |
| 建议非阻断 | 不得把 `RECOMMENDATION` 写为“只能”“服务端拒绝”或等价硬性结论，除非另有第 6 节中列出的真实约束。 |
| 决定来源可追溯 | “用户已决定 / 已确认”的表述必须能关联 `user_quote` 或 `client_asserted`；工具结果和 GoalAssessor 不能充当来源。 |
| 决策边界不越权 | `DECISION_BOUNDARY` 只能要求客户端确认、展示或以最后确认方向执行；不得声称服务端据此拦截。 |
| 约束可回指代码 | 每个 `EXECUTION_CONSTRAINT` 必须列出校验位置、触发条件、错误或结果以及替代动作。 |
| 三维框架不扩散 | 不得要求所有 payload 增加 `provenance` / `role` / `enforcement` 字段，也不得引入数字 `priority` 来裁决语义。 |
| 必填输入显式失败 | 缺失必填字段必须报错；禁止以任意值静默填充。 |

## 9. v0.1 冻结条件与兼容边界

`v0.1` 冻结以下五项边界，后续 Spec 不得在未升级版本的情况下改变：

1. 五种文本角色及其责任主体、语气与执行效果；
2. `provenance` / `role` / `enforcement` 仅作为分析框架，非通用协议字段；
3. `USER_DECISION` 仅来自用户原话或客户端确认；
4. `EXECUTION_CONSTRAINT` 必须来自确定性代码校验，且伪约束必须被明确否定；
5. E-01～E-05 五类语义案例的客户端行为、服务端行为与可观察结果。

兼容已有 `content` 文案时，调用方可以保留 `【重要】` 等历史前缀，但必须避免改变其实际强度。后续结构化响应、Profile 或模型可见内容只能在本边界内增加可追溯表达，不能把客户端决定下沉为服务端事实。

## 10. 未决问题与演进

下列事项不属于 v0.1 的运行时变更，也不能据此声称已实现：

- 后续 Profile 如何以 `client_asserted` 传递经过用户确认的 decision context；
- 标准响应信封和 Model Visible Contract 如何表达角色信息而不强制每条消息携带三维字段；
- 是否应将 archived Spec 新增 Task 改为真实服务端约束；如要实施，必须先修改设计、代码和测试，再更新本清单；
- 多客户端会话中如何区分不同确认来源与失效时机。

每项演进都应保留第 3 节至第 9 节的权威边界，并以需求、设计、任务和可验证代码共同更新。

## 11. 审核证据索引

| 证据类别 | 位置 |
| --- | --- |
| 状态机迁移 | `src/types/spec.ts` 的 `VALID_SPEC_TRANSITIONS` |
| Spec 状态拒绝 | `src/core/SpecManager.ts` 的 `updateStatus` 与 `INVALID_STATUS_TRANSITION` |
| Task 父级、依赖和锚点校验 | `src/core/TaskManager.ts` 的 `create`、`assertValidatesAnchors` |
| MCP 输入 schema | `src/mcp/tools/index.ts` |
| GoalAssessor 的启发式边界 | `src/core/GoalAssessor.ts` 的 `assess(goal: string)` 与 `suggested_next_step` |
| 文档静态契约测试 | `tests/unit/semantic-authority-model.test.ts` |