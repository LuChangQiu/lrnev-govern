---
spec: '01-00-semantic-authority-model'
scene: '04-ai-guidance-standardization'
created: '2026-08-26'
---

# 01-00 Semantic Authority Model - 设计

## L0 摘要

用五种文本角色表达 guidance，用 provenance、role、enforcement 三维框架审查来源与执行强度；USER_DECISION 留在客户端对话层，服务端只提供事实、建议、决策边界、真实约束和可选下一步。

## L1 概览

#### D-01 五种文本角色

| 文本角色 | 推荐前缀 | 含义 | 执行效果 |
|---|---|---|---|
| FACT | `【事实】` | lrnev 可从工作区或确定性状态验证的信息 | 只提供背景，不选择方向、不阻断 |
| RECOMMENDATION | `【建议】` | 基于事实和治理经验给出的可解释建议 | 可接受、拒绝或替换，不阻断 |
| DECISION_BOUNDARY | `【决策边界】` | 客户端 AI 不得未经确认替用户改变明确目标 | 客户端行为边界，不伪装成服务端校验 |
| EXECUTION_CONSTRAINT | `【执行约束】` | 服务端已经实现的状态、安全、结构或完整性校验 | 校验失败时确定性拒绝，并给错误原因 |
| ACTION_HINT | `【下一步】` | 当前结果之后可考虑的工具或操作 | 可选，不等于 required step |

`【重要】` 可以作为旧文案兼容前缀，但新规范不把它机械映射为 Constraint。迁移时应根据真实含义拆成 `【决策边界】`、`【执行约束】` 或 `【下一步】`。

#### D-02 三维分析框架

| 维度 | 典型值 | 用途 |
|---|---|---|
| provenance | workspace / lrnev / client_asserted / user_quote | 判断信息从哪里来、能否由服务端验证 |
| role | fact / recommendation / decision_boundary / execution_constraint / action_hint | 判断文本承担什么责任 |
| enforcement | none / client_boundary / server_enforced | 判断它只是信息、客户端行为边界，还是服务端真实阻断 |

三维模型只用于设计审查和案例分析。文本阶段通过前缀、依据和错误码按需表达，不要求每条消息序列化三个字段。尤其 `client_asserted` 和 `user_quote` 都是客户端声明，lrnev 不能验证它们等同于用户原始意图。

#### D-03 核心流程

```text
用户原始对话
  -> 客户端 AI 识别 decision context
  -> lrnev 提供 FACT / RECOMMENDATION / ACTION_HINT
  -> 客户端遵守 DECISION_BOUNDARY，必要时与用户确认
  -> ACTION CANDIDATE
  -> lrnev 执行真实 EXECUTION_CONSTRAINT
  -> 执行成功或返回确定性错误
```

`GoalAssessor` 只提供复杂度启发式。它可以给出 `single-spec` 或 `multi-spec` 建议，但不得把评估结果写成用户已经决定的方向。

#### D-04 真实 Constraint 清单

`v0.1` 以源码中已经执行的校验为准：

| 约束 | 当前校验位置 | 可观察结果 |
|---|---|---|
| Spec 非法状态转换 | `src/types/spec.ts`、`SpecManager.updateStatus` | `INVALID_STATUS_TRANSITION`，不写入 |
| Task parent 不存在 | `TaskManager.create` | `TASK_NOT_FOUND`，不写入 |
| Task depends_on 指向不存在项 | `TaskManager.create` | `TASK_NOT_FOUND`，不写入 |
| validates 格式错误或锚点不存在 | `TaskManager.assertValidatesAnchors` | 输入错误，Task 不写入 |
| 工具/manager 必填输入缺失 | Zod input schema 与 manager 校验 | 工具调用失败，不用任意值兜底 |

下列内容不能标成当前 Execution Constraint：

- “archived Spec 不能新增 Task”：当前 `TaskManager.create` 没有这项状态阻断。
- “ready gate 未通过后不能继续调用其他工具”：gate 当前返回验证结果，不是全局流程锁。
- “已有 Spec 可以承载就不能新建”：它只是 Recommendation。

若产品决定新增这些阻断，必须另立需求并先实现确定性校验，再加入清单。

## L2 详情

#### D-05 五类案例

#### Explicit：建议复用，用户明确新建

```text
FACT: 存在 Spec A
RECOMMENDATION: 可以考虑在 Spec A 中创建增量 Task
DECISION CONTEXT: 客户端从用户原话识别到“创建独立 Spec B”
ACTION: 候选为 spec_create(B)
RESULT: 通过服务端校验则创建；不因 Recommendation 自动改成 task_create(A)
```

#### Preferred：用户倾向新建

客户端可以说明复用利弊；偏好不是服务端事实。用户确认新建后执行 `spec_create`，用户接受建议后可以改为复用。

#### Unspecified：用户未指定组织方式

低风险、可逆场景允许 AI 基于建议自行判断并解释；重要领域边界或高成本选择应询问。不得把 AI 的选择写成“用户已经决定”。

#### 用户改变主意

用户先要求新建，听到建议后明确改为复用。当前决定以最后一次用户确认的方向为准；此前的决定不作为永久锁定。

#### 真实约束冲突

用户要求把 archived Spec 状态改回 `in-progress` 时，服务端按状态机拒绝并返回合法替代路径。拒绝来自真实代码校验，不来自 Recommendation，也不能被 decision context 绕过。

#### D-06 规范产物与引用

- 规范产物：`dev-docs/ai-guidance-standardization/notes/semantic-authority-model.md`。
- `v0.1` 稳定锚点：文本角色、三维分析、真实约束、决策来源、案例、兼容边界。
- 运行时常量、静态 Markdown 和测试可以引用/校验规范，但不能各自成为互相冲突的权威来源。
- `05-00-lrnev-guidance-profile` 已获建设决策；其最小 Profile `v1` 按本规范实施，新增可选字段是否保留或回退由 `04-00` 的 B3 证据决定。客户端传入的 decision context 只能标为 `client_asserted`，服务端不得输出未经声明的 USER_DECISION。

#### D-07 测试策略

- 用固定 fixture 验证五种角色和五类案例。
- 静态审查禁止 `USER_DECISION > CONSTRAINT`、建议即必须、决策边界伪装成执行约束。
- 对真实 Constraint 清单逐项核对源码位置和错误结果；源码行为改变时清单必须同步。
