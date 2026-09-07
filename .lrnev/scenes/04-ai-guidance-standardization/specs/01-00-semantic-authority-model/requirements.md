---
spec: 01-00-semantic-authority-model
scene: 04-ai-guidance-standardization
status: completed
priority: P0
created: '2026-08-26'
updated: '2026-09-07'
---

# 01-00 Semantic Authority Model - 需求

## L0 摘要

发布 lrnev Guidance Semantic Authority Model `v0.1`：用五种文本角色和“来源、角色、执行强度”三维分析框架区分项目事实、治理建议、决策边界、真实执行约束和可选下一步。

## L1 概览

### 目标

解决当前 guidance 把事实、建议、客户端行为边界、后续动作和硬约束平铺在同一自然语言通道的问题。规范必须让实现者和客户端 AI 分别回答：

1. 项目当前是什么状态？
2. 从治理角度建议走哪个方向？
3. 客户端 AI 在面对用户明确决定时有什么权限边界？
4. 哪些动作只是建议，哪些动作会被服务端确定性拒绝？

本 Spec 使用可验收的最小发布边界，不追求一次性形式化所有 guidance。完成“五种文本角色、三维分析框架、真实 Constraint 清单、五类案例、规范产物与版本”后即冻结 `v0.1`，后续通过版本演进补充，不阻塞高危文案迁移。

### 用户故事

- 当已有 Spec 可以承载但用户明确要求新建 Spec 时，我希望建议仍可解释利弊，但不能被当作禁止新建的规则。
- 当用户没有指定组织方式时，我希望 AI 可以基于事实提出建议并询问用户，而不是把默认建议伪装成用户决定。
- 当用户选择违反状态机、必填字段、引用完整性或安全边界的动作时，我希望 lrnev 由服务端真实校验拒绝，而不是只返回一条看似强硬的提示。

### 范围

**包含**：
- 定义 FACT、RECOMMENDATION、DECISION_BOUNDARY、EXECUTION_CONSTRAINT、ACTION_HINT 五种文本角色。
- 定义 provenance、role、enforcement 三个分析维度；它们是评审框架，不自动变成协议必填字段。
- 定义 USER_DECISION / decision context 的来源边界：它属于用户与客户端对话，不是 lrnev 服务端可自行生成的消息事实。
- 逐项盘点当前源码中真实存在的执行约束，并明确不存在的约束不能用于示例或 E2E oracle。
- 用明确、偏好、未指定、改变决定、违反约束五类案例验证语义闭合。
- 形成有版本、有稳定锚点、可被后续 Spec 引用的规范文档。

**不包含**：
- 不在本 Spec 中新增 `user_intent`、`messages` 或数字 `priority` 字段。
- 不由 GoalAssessor、lrnev 或任何启发式结果伪造 USER_DECISION。
- 不实现新的 Agent、Decision Record 目录或跨会话决策数据库。
- 不把三维分析框架直接实现成“每条消息必须填写三个字段”的通用 schema。
- 不改变现有工具执行逻辑；Surface 盘点由 `02-00` 负责，文案迁移按本规范另行执行。

## L2 详情

### 详细需求

#### F-01 五种文本角色

- 验收：每种角色都有定义、允许使用的语气、责任主体、正例和反例；规范明确 Recommendation 不阻断、Decision Boundary 不伪装成服务端约束、Execution Constraint 必须对应确定性代码校验。

#### F-02 三维分析框架

- 验收：规范定义 provenance（来源）、role（角色）、enforcement（执行强度）三维；文本阶段只在必要位置显式表达，不增加通用字段，不使用单一数字 priority 比较不同语义。

#### F-03 USER_DECISION 来源边界

- 验收：只有用户原话或用户确认可以成为当前 decision context；GoalAssessor 的 `kind`、score、suggested_next_step、工具调用结果都不能生成 USER_DECISION；服务端不得输出“用户已经决定”这类未经客户端声明的消息。

#### F-04 真实 Constraint 清单

- 验收：每条 Execution Constraint 都记录校验位置、触发条件、错误码/失败结果和可行替代路径；至少覆盖 Spec 状态转换、Task 父/依赖引用、F-xx/D-xx 锚点、必填输入；明确“archived Spec 当前不能新增 Task”不是已实现约束。

#### F-05 五类案例闭环

- 验收：至少覆盖 explicit、preferred、unspecified、用户改变决定、候选动作违反真实 Constraint 五类案例，并写出客户端行为、服务端行为和可观察结果。

#### F-06 v0.1 产物与冻结条件

- 验收：规范产物固定为 `dev-docs/ai-guidance-standardization/notes/semantic-authority-model.md`，包含版本、适用范围、稳定章节锚点、兼容原则和未决问题；五项最小边界完成后冻结 `v0.1`，运行时常量和文案引用规范而不成为新的架构真相源。

### 非功能性需求

- 可解释性：每个建议必须能回溯到事实或明确的治理理由。
- 兼容性：规范可以映射到当前扁平 `AiFollowup.instructions`，不要求旧客户端升级。
- 安全性：用户决定不绕过服务端已实现的状态、安全、完整性和必填字段约束。
- 可演进性：`v0.1` 通过版本化文档演进，不因未覆盖所有未来场景阻塞当前修复。

### 验收标准

- [ ] 五种文本角色与三维分析框架完成评审。
- [ ] 服务端不得生成 USER_DECISION 的边界明确。
- [ ] 真实 Constraint 清单经过源码逐项核验。
- [ ] 五类案例有客户端、服务端和可观察结果。
- [ ] `dev-docs/ai-guidance-standardization/notes/semantic-authority-model.md` 达到 `v0.1` 冻结条件。
- [ ] 未引入通用三维字段、数字 priority 或未经证据支持的协议扩展。
