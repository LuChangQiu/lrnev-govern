---
spec: '01-00-semantic-authority-model'
scene: '04-ai-guidance-standardization'
created: '2026-08-26'
---

# 01-00 Semantic Authority Model - 任务清单

> 任务由 lrnev `task_create` 工具创建，不要手编。达到 `v0.1` 五项冻结边界后即完成，不继续无限形式化。

## 阶段 1：规范评审

<!-- FILL: 使用 task_create 追加任务；任务以 lrnev-task 标记记录 -->

## 验收标准（整体）

- [ ] F-01 至 F-06 完成并经过架构评审。
- [ ] 规范与 Scene 04 `architecture.md`、`dev-docs` 入口一致。
- [ ] 真实 Constraint 清单与当前源码一致，不含“archived Spec 禁止新增 Task”等假约束。
- [ ] 未引入通用三维字段、数字 priority 或自动 Decision 持久化。

### T-001 编写语义权威模型 v0.1 规范 <!-- lrnev-task: status=completed, created=2026-08-27T07:53:07.252Z, updated=2026-08-27T09:44:54.432Z, validates=F-01|F-02|F-03|D-01|D-02|D-03|D-06 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-08-27T09:18:55.747Z","reason":"开始编写并冻结 v0.1 语义权威模型文档。"},{"from":"in_progress","to":"completed","at":"2026-08-27T09:44:54.432Z","reason":"语义权威模型 v0.1 文档与对应静态契约测试已完成；定向测试 4/4 通过，UTF-8 无 BOM 二轮校验通过。"}] -->

在 dev-docs/ai-guidance-standardization/semantic-authority-model.md 发布唯一权威规范，完整定义 FACT、RECOMMENDATION、DECISION_BOUNDARY、EXECUTION_CONSTRAINT、ACTION_HINT 的责任主体、允许语气、正反例和兼容边界；同时说明 provenance/role/enforcement 仅为评审框架、不得引入通用三维必填字段或数字 priority，并明确 USER_DECISION 只能来自用户/客户端声明。

**验收**：
- 文档包含五种角色、三维分析、决策来源边界、适用范围、稳定章节锚点、兼容原则和未决问题。
- 明确 Recommendation 不阻断、Decision Boundary 不是服务端约束、服务端不得由 GoalAssessor 或工具结果生成 USER_DECISION。
- 内容与 Scene 04 architecture.md 及后续 Profile/Conformance 的分层边界一致。

### T-002 核验并发布真实执行约束清单 <!-- lrnev-task: status=completed, created=2026-08-27T07:53:07.252Z, updated=2026-08-28T03:24:08.708Z, validates=F-04|D-04|D-07 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-08-27T09:51:18.388Z","reason":"开始核验并发布真实 Execution Constraint 清单。"},{"from":"in_progress","to":"completed","at":"2026-08-28T03:24:08.708Z","reason":"Execution constraints inventory completed with 48 real constraints documented from src/ code"}] -->

逐项从当前源码核验 Spec 状态机、Task parent/depends_on、validates 锚点及工具/manager 必填输入的真实确定性校验；在语义规范中记录校验位置、触发条件、稳定错误码或失败结果和可行替代路径，并显式排除当前未实现的 archived Spec 禁止新增 Task、ready gate 全局锁和已有 Spec 禁止新建等假约束。

**验收**：
- 每个 Constraint 可回溯到具体源码位置和可观察失败结果，不以提示文案替代执行证据。
- 覆盖 Spec 非法状态转换、Task 父/依赖引用、F/D validates 锚点和必填输入。
- 规范明确不把未实现规则作为 E2E oracle 或执行约束。

### T-003 建立五类语义案例与静态校验 <!-- lrnev-task: status=completed, created=2026-08-27T07:53:07.252Z, updated=2026-08-28T03:58:00.819Z, depends_on=T-001|T-002, validates=F-05|D-05|D-07 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-08-28T03:38:08.598Z","reason":"开始创建五类语义案例fixtures、assertValidatesAnchors直接测试和静态校验"},{"from":"in_progress","to":"completed","at":"2026-08-28T03:58:00.819Z","reason":"五类语义案例fixtures、assertValidatesAnchors直接测试和静态校验已完成，全部20个测试通过"}] -->

为 explicit、preferred、unspecified、用户改变决定、真实约束冲突建立固定案例 fixture/断言；补充静态检查，禁止把建议写成必须、把用户决定置于真实 Constraint 之上、或把客户端决策边界伪装成服务端强制规则。案例必须分别写明客户端行为、服务端行为和可观察结果。

**验收**：
- 五类案例覆盖需求列出的用户故事及 D-05 的动作/结果边界。
- 静态检查能定位禁止语义，且不会要求每条文本承载三维字段。
- 约束冲突案例只引用经源码核验的真实 Constraint。

**依赖**：T-001, T-002

### T-004 冻结 v0.1 并完成规范发布验收 <!-- lrnev-task: status=completed, created=2026-08-27T07:53:07.252Z, updated=2026-08-28T04:18:25.332Z, depends_on=T-001|T-002|T-003, validates=F-06|D-06|D-07 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-08-28T04:14:35.793Z"},{"from":"in_progress","to":"completed","at":"2026-08-28T04:18:25.332Z","reason":"v0.1 freeze completed: 全部 6 项需求追溯完成、47 条约束核验、5 类案例验证、20 个测试通过、无第二权威来源冲突、兼容 AiFollowup.instructions、明确排除三项未实现内容"}] -->

审查 semantic-authority-model.md 与源码核验、案例/静态检查的输出，确认 v0.1 最小五项边界完整后冻结版本；记录后续扩展只能通过版本演进且运行时常量、文案和测试不得形成相互冲突的第二权威来源。

**验收**：
- F-01 至 F-06 的交付物和证据可从规范或测试结果追溯。
- 规范对当前 AiFollowup.instructions 的映射兼容且不改变工具执行逻辑。
- 冻结结论明确没有自动决策持久化、通用三维 schema 或数字 priority。

**依赖**：T-001, T-002, T-003
