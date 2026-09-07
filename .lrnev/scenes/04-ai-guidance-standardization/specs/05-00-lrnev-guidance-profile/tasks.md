---
spec: '05-00-lrnev-guidance-profile'
scene: '04-ai-guidance-standardization'
created: '2026-08-26'
---

# 05-00 lrnev Guidance Profile - 任务清单

> 任务由 lrnev `task_create` 工具创建，不要手编。Profile `v1` 已获架构决策批准；04 决定每个可选字段是否保留或回退。

## 阶段 1：最小 Profile 与 decision_context

<!-- FILL: 使用 task_create 追加任务；任务以 lrnev-task 标记记录 -->

## 验收标准（整体）

- [ ] F-01 至 F-08 完成。
- [ ] 每个新增字段有 04 的保留/回退依据。
- [ ] Profile 不冒充 MCP 标准，服务端不生成 USER_DECISION。
- [ ] direction/target_ref 枚举级对齐、缺失/unspecified 规则和不阻断边界有协议与 E2E 覆盖。
- [ ] Profile 感知/不感知客户端兼容和回退路径明确。
- [ ] 若字段无改善或客户端忽略，已停止增加字段并记录结论。

### T-001 定义 Profile v1 语义对象与传输边界 <!-- lrnev-task: status=completed, created=2026-08-27T08:03:09.537Z, updated=2026-09-03T11:46:08.989Z, validates=F-01|F-02|F-03|F-06|F-07|D-01|D-02|D-04|D-06 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-09-03T11:46:08.727Z"},{"from":"in_progress","to":"completed","at":"2026-09-03T11:46:08.989Z","reason":"T-001 实施完成，DeepSeek 复审通过（提交 9d104f9/fe6ebe6/9a1dd60/51fdc52/b6d7029）"}] -->

跨 Spec 前置：03 的 M1 标准响应信封、全工具 outputSchema/structuredContent 和传输验证已完成。在该信封之上定义 lrnev.guidance/v1 的最小语义对象及唯一构建源：每条 guidance 至少 role、text、profile_version；source_ref 或 enforcement 只在 role 无法消歧且有 04 证据时加入。保持 MCP transport、01 文本语义和 Profile 应用语义分层。

**验收**：
- Profile 名称和版本独立于 MCP protocol/response_version，且不宣称为 MCP 标准。
- unknown role 降级为普通文本；Profile 与文本冲突触发诊断并阻止发布。
- 不引入数字 priority 或将 provenance×role×enforcement 变为通用必填 schema。

### T-002 实现 decision_context 输入 Schema 与负向校验 <!-- lrnev-task: status=completed, created=2026-08-27T08:03:09.537Z, updated=2026-09-03T11:46:09.484Z, depends_on=T-001, validates=F-04|D-03 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-09-03T11:46:09.260Z"},{"from":"in_progress","to":"completed","at":"2026-09-03T11:46:09.484Z","reason":"T-002 实施完成，DeepSeek 复审通过（提交 9d104f9/fe6ebe6/9a1dd60/51fdc52/b6d7029）"}] -->

跨 Spec 前置：03 的 M1 标准响应信封、全工具 outputSchema/structuredContent 和传输验证已完成。为 client_asserted DecisionContext 实现严格输入 Schema：strength、summary、可选 direction/target_ref/reported_user_quote；确保缺失与 unspecified 区分，explicit/preferred 强制 direction，unspecified 禁止 direction，target_ref 使用完整稳定引用。验证不得接受服务端伪造 source 或将上下文持久化为 Project Truth/memory。

**验收**：
- 仅接受 source=client_asserted；枚举和条件必填/禁止规则可由测试精确验证。
- 缺失 context 不被自动改写为 unspecified；reported_user_quote 不被当作可验证用户事实。
- 非法输入显式报错，不使用任意值静默填充。

**依赖**：T-001

### T-003 接入四个 v1 工具并渲染非阻断决策边界 <!-- lrnev-task: status=completed, created=2026-08-27T08:03:09.537Z, updated=2026-09-03T11:46:09.919Z, depends_on=T-002, validates=F-04|F-05|F-06|D-03|D-04 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-09-03T11:46:09.698Z"},{"from":"in_progress","to":"completed","at":"2026-09-03T11:46:09.919Z","reason":"T-003 实施完成，DeepSeek 复审通过（提交 9d104f9/fe6ebe6/9a1dd60/51fdc52/b6d7029）"}] -->

仅向 assess_goal、scene_create、spec_create、task_create 接入可选 decision_context；assess_goal 在写入前组织 FACT/RECOMMENDATION/DECISION_BOUNDARY/真实 Constraint，三个写入工具在当前调用后基于 direction 与工具类别、可选 target_ref 做枚举级比对。spec_update/读取工具不得接收该字段。

**验收**：
- direction 对齐仅覆盖 new_scene→scene_create、new_spec→spec_create、reuse_spec→task_create、no_spec→不应调用落位工具；other 不作自动比较。
- 不一致仅返回 DECISION_BOUNDARY 提示，不解析 summary、不阻断、不重写请求、不自动回滚。
- 服务端不输出 USER_DECISION、不声称读取用户原话；真实 Constraint 仍由既有校验先行执行。

**依赖**：T-002

### T-004 实现 Profile 与文本的兼容降级及一致性诊断 <!-- lrnev-task: status=completed, created=2026-08-27T08:03:09.537Z, updated=2026-09-03T11:46:10.406Z, depends_on=T-001|T-003, validates=F-03|F-06|F-07|D-04|D-05|D-06 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-09-03T11:46:10.147Z"},{"from":"in_progress","to":"completed","at":"2026-09-03T11:46:10.406Z","reason":"T-004 实施完成，DeepSeek 复审通过（提交 9d104f9/fe6ebe6/9a1dd60/51fdc52/b6d7029）"}] -->

从同一语义对象派生 Profile 数据和 01 文本降级；确保 Profile 解析/客户端不支持不会影响 03 的业务 data 或 content，且结构化 Recommendation 永远不具备阻断权。对 Profile/文本冲突、未知 role、capability 缺失提供诊断和明确回退路径。

**验收**：
- Profile 感知客户端可消费结构化语义，通用 MCP 客户端仍可仅靠文本正确使用结果。
- 客户端忽略 Profile 被识别为 capability 问题，不以增加字段作为默认修复。
- client_boundary 与 server_enforced 明确分离，Profile 不创造硬约束。

**依赖**：T-001, T-003

### T-005 覆盖 Profile 与 decision_context 协议边界测试 <!-- lrnev-task: status=completed, created=2026-08-27T08:03:09.537Z, updated=2026-09-03T11:46:10.898Z, depends_on=T-002|T-003|T-004, validates=F-01|F-03|F-04|F-05|F-06|F-07|D-03|D-04|D-06|D-07 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-09-03T11:46:10.657Z"},{"from":"in_progress","to":"completed","at":"2026-09-03T11:46:10.898Z","reason":"T-005 实施完成，DeepSeek 复审通过（提交 9d104f9/fe6ebe6/9a1dd60/51fdc52/b6d7029）"}] -->

建立单元/集成测试：最小 guidance、unknown role 降级、文本/Profile 一致性、四个适用工具、非适用 spec_update、缺失/unspecified、explicit/preferred direction、new_scene/reuse_spec/no_spec/other、target_ref 对齐、误传与不阻断边界；测试服务端不生成或持久化 USER_DECISION。

**验收**：
- 测试覆盖正向和反向协议分支，特别是 E-06 改意图、E-07 no_spec、E-08 不传 context。
- 断言不一致只产生边界提示，执行仍由真实服务端 Constraint 决定。
- 每个新增字段都能映射到 04 的失败模式或适配收益假设。

**依赖**：T-002, T-003, T-004

### T-006 依据 B3 证据发布 Profile 适配结论并回退无效字段 <!-- lrnev-task: status=completed, created=2026-08-27T08:03:09.537Z, updated=2026-09-07T01:41:04.506Z, depends_on=T-005, validates=F-01|F-02|F-07|F-08|D-01|D-05|D-07|D-08 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-09-07T01:41:04.217Z"},{"from":"in_progress","to":"completed","at":"2026-09-07T01:41:04.506Z","reason":"T-006 依据 B3/B4 证据完成 Profile 字段裁决（2026-09-07 DeepSeek-T006字段裁决.md）：O1-O3/I1-I5/I7 保留、O4 source_ref/O5 enforcement/O6 guidance 运行时挂载/I6 reported_user_quote 回退（实施 7a1b49c 全量 1055 绿）；M1 decision_context_sent 真扫描口径修正；05-00 spec 文本同步注记"}] -->

依赖 04 B3 对照，按 client/version/model/run_id 评估 Profile 各可选字段的可测改善、消费能力、token/兼容成本；保留有效字段，调整或删除/回退无效字段，并发布故障排查与适配结论。该任务不复制 04 原始运行日志。

**验收**：
- 每个可选字段都有保留、调整或回退结论及对应 04 evidence 引用。
- 客户端不支持时有明确禁用/文本降级路径，不继续扩张 schema。
- 适配结论只引用 04 的运行时证据，基础文档/通用 Conformance 仍归 06。

**依赖**：T-005
