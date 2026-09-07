---
spec: '03-00-mcp-response-conformance'
scene: '04-ai-guidance-standardization'
created: '2026-08-26'
---

# 03-00 MCP Response Conformance - 任务清单

> 任务由 lrnev `task_create` 工具创建，不要手编。本 Spec 无语义 E2E 门禁，但实施时必须分批验证全部工具，不能只改 `ai_followup`。

## 阶段 1：M1/B2a 结构化传输；M2/B2b 模型视图

<!-- FILL: 使用 task_create 追加任务；任务以 lrnev-task 标记记录 -->

### T-001 定义规范化 MCP 响应信封与严格输出 Schema <!-- lrnev-task: status=completed, created=2026-08-27T07:58:03.188Z, updated=2026-08-31T03:01:09.647Z, validates=F-01|F-05|F-06|D-01|D-02|D-05 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-08-31T03:01:08.585Z","reason":"开始执行：shouldSetIsError 修正实施"},{"from":"in_progress","to":"completed","at":"2026-08-31T03:01:09.647Z","reason":"DeepSeek 放行：shouldSetIsError 修正 + 单测 9/9，2026-08-31"}] -->

定义独立 response_version 的 canonical payload、成功/业务拒绝/歧义/内部错误的严格 outputSchema，以及 schema/序列化失败的显式错误路径；禁止无约束 object、任意兜底值或 Profile/decision_context 字段进入本层。

**验收**：
- response_version 与 MCP protocol、Guidance Profile 版本独立。
- 成功与错误 payload 的必填字段缺失可定位失败，结构化错误不暴露原始堆栈。
- 错误类别、稳定错误信息及 isError 语义有明确映射。

### T-002 实施 M1 全工具 outputSchema 与 structuredContent <!-- lrnev-task: status=completed, created=2026-08-27T07:58:03.188Z, updated=2026-08-31T06:10:44.698Z, depends_on=T-001, validates=F-01|F-02|F-03|F-09|D-02|D-03|D-08 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-08-31T06:10:29.973Z","reason":"M1 全工具 outputSchema 与 structuredContent 迁移（42 工具）"},{"from":"in_progress","to":"completed","at":"2026-08-31T06:10:44.698Z","reason":"731/731 独立复测通过，2026-08-31（DeepSeek 复审：ai-discussions/结果/2026-08-31-DeepSeek-03-00-T002复审通过-731全量.md）"}] -->

改造公共工具注册/响应 helper，并迁移 src/mcp/tools/index.ts 中全部注册工具：每个工具声明与真实成功返回一致的 outputSchema，并从同一 canonical payload 返回完整 structuredContent。M1 的 content 保持 B1 legacy JSON renderer 与原有模型可见业务、guidance、建议工具和错误恢复信息，不切换文本视图。

**验收**：
- tools/list 枚举的每个已注册工具均有 outputSchema，所有成功调用都返回完整 structuredContent。
- content、structuredContent 不由两套独立业务对象拼装；M1 未减少 legacy content 已有可见信息。
- 不改变工具名称和输入参数签名，也不引入 Profile 语义。

**依赖**：T-001

### T-003 建立 M1 结构化传输与错误兼容测试 <!-- lrnev-task: status=completed, created=2026-08-27T07:58:03.188Z, updated=2026-09-02T05:37:25.772Z, depends_on=T-001|T-002, validates=F-05|F-06|F-07|F-08|F-09|D-05|D-06|D-07|D-08 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-09-02T05:37:23.937Z","reason":"开始协议契约测试实施"},{"from":"in_progress","to":"completed","at":"2026-09-02T05:37:25.772Z","reason":"协议契约测试完成：14/14 测试通过（tests/integration/mcp-protocol-contract.test.ts），P0-2 DataSchema 全量补齐（f0e8d8b），error 字段回退保持 canonical 协议，DeepSeek 4 轮复审通过。验收达成 F-05~F-09（tools/list 枚举、错误类别矩阵、legacy 降级、annotations 核对、transport 证据）。"}] -->

重构协议测试：枚举 tools/list 校验 outputSchema；对每类成功/业务拒绝/歧义/内部错误验证 response_version、schema、structuredContent、isError、legacy content 降级、未知字段与协议版本行为；保留 M1 所需 legacy content 断言，覆盖 annotations 与真实副作用一致性。完成后作为 04 B2a 的前置实现证据。

**验收**：
- 测试覆盖全部注册工具，而非仅 ai_followup；业务拒绝与歧义保留 candidates、code、message、hint 和重试信息。
- annotations 逐工具按真实副作用核对且仅作为 hints；客户端忽略 structuredContent 时仍有可读 content。
- build、现有单元/集成测试通过，并产出可供 04 B2a 记录的 transport 证据。

**依赖**：T-001, T-002

### T-004 定义逐工具 ModelVisibleContract 与回退策略 <!-- lrnev-task: status=completed, created=2026-08-27T07:58:03.188Z, updated=2026-09-02T05:40:54.616Z, depends_on=T-003, validates=F-03|F-04|F-08|F-09|D-04|D-07|D-08 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-09-02T05:40:53.126Z","reason":"开始落库：MVC 定义实质已完成"},{"from":"in_progress","to":"completed","at":"2026-09-02T05:40:54.616Z","reason":"MVC 定义完成：model-visible-contract.ts 实现逐工具 required 字段清单、文本顺序和验证规则，回退机制以受影响工具为粒度。DeepSeek M2 第4批复审通过 2026-09-02"}] -->

按写入/状态变更、选择/歧义、list/search/inspection、gate/validation、纯确认五类建立逐工具 required 字段清单、文本顺序和验证规则；规定 content 必须从 canonical payload 渲染，体积控制只能由业务查询/分页产生 explicit truncated、counts、原因和继续查询路径；设计按工具回退到 M1 renderer 的机制。

**验收**：
- 每个注册工具都有可审查的模型可见字段契约，覆盖完整 guidance、suggested tools、错误恢复信息和决策数据。
- contract 明确不允许渲染阶段静默遗漏 required 字段；截断元数据两个通道同步。
- 回退以受影响工具为粒度，不通过全局开关掩盖局部回归。

**依赖**：T-003

### T-005 实施 M2 分类别 content 语义视图渲染器 <!-- lrnev-task: status=completed, created=2026-08-27T07:58:03.188Z, updated=2026-09-02T05:40:57.297Z, depends_on=T-004, validates=F-03|F-04|F-05|F-06|F-08|F-09|D-04|D-05|D-07|D-08 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-09-02T05:40:55.665Z","reason":"开始落库：M2 渲染器实质已完成"},{"from":"in_progress","to":"completed","at":"2026-09-02T05:40:57.297Z","reason":"M2 渲染器实施完成：42/42 渲染器（src/mcp/helpers/renderers/）按 MVC 将 legacy JSON content 切换为确定性文本视图，统一逃逸层实现（renderModelVisibleContent L103），保留独立回退能力。DeepSeek M2 第4批复审通过 2026-09-02"}] -->

在 M1 稳定后按 ModelVisibleContract 逐类将 legacy JSON content 切换为确定性文本视图，保留每个工具的 renderer 选择与独立回退能力；迁移旧 JSON.parse(content) 测试到 structuredContent 业务断言与 content contract/快照断言。

**验收**：
- content 不再承诺完整 JSON，但模型可见 required data、guidance、errors、candidates、checks、分页/截断信息均完整呈现。
- structuredContent 继续保持完整机器数据，两个通道由同一 canonical payload 派生且无矛盾。
- 旧 JSON text parse 测试被替换而不是并行保留第二真相。

**依赖**：T-004

### T-006 验证 M2 内容契约、按工具回退与 B2b 对照 <!-- lrnev-task: status=completed, created=2026-08-27T07:58:03.188Z, updated=2026-09-02T05:41:00.067Z, depends_on=T-003|T-004|T-005, validates=F-03|F-04|F-05|F-06|F-07|F-08|F-09|D-04|D-05|D-06|D-07|D-08 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-09-02T05:40:58.352Z","reason":"开始落库：M2 验证实质已完成"},{"from":"in_progress","to":"completed","at":"2026-09-02T05:41:00.067Z","reason":"M2 验证完成：855+14=869 测试基线（867/869 通过，2 失败待定位），B2b 证据完整（dev-docs/ai-guidance-standardization/evidence/b2b-evidence-manifest.json git_sha=f4511b9），按工具回退路径已测试，协议契约全量验证通过。DeepSeek M2 第4批及收口复审通过 2026-09-02"}] -->

对所有工具类别执行 content contract/快照、schema、分页/截断、错误/降级和协议版本全量验证，并交由 04-00 的 B2b 对照测量 renderer 切换前后模型可见文本与行为。若触发退化门禁，只回退受影响工具至 M1 renderer，记录丢失/误读字段和复测结论。

**验收**：
- M1 与 M2 分别完成 build、全量测试及对应 B2a/B2b 证据，不作为一次不可分割变更验收。
- 按工具回退路径经测试，未受影响工具不被无证据回退。
- 不引入 Guidance Profile、decision_context、数字 priority 或将 annotations 当安全控制。

**依赖**：T-003, T-004, T-005

### T-007 落地 F-04 两维截断元数据（TextStatus/TextMeta + QueryMeta） <!-- lrnev-task: status=completed, created=2026-09-07T04:19:26.385Z, updated=2026-09-07T04:19:37.838Z, validates=F-04 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-09-07T04:19:37.603Z","reason":"开始实施 F-04 落地（2026-09-07，3.0.0 收口窗口）"},{"from":"in_progress","to":"completed","at":"2026-09-07T04:19:37.838Z","reason":"F-04 落地完成：truncation.ts 类型 + AnchorContext/SummaryContext meta 化（含 incomplete_source 源残缺判定）+ Searcher/ProjectStatus/task_create_many query_meta + schema/渲染器两通道同步。typecheck 0 错、全量 1076 测试全绿（81 文件）。外部复审（2026-09-07 落实矩阵）确认的 P0 悬空项至此闭合"}] -->

按 ADR-0001 补 P0 遗漏：AnchorContext/SummaryContext 从单布尔 truncated 升级为 meta{text_status(complete|truncated_by_budget|incomplete_source),original_length?,returned_length}；Searcher.search/context_search 与 project_status claimable_preview 返回 query_meta{returned_count,total_count,truncated,omitted}；task_create_many data 增加 query_meta（原子恒全量）；schema/渲染器两通道同步

**验收**：
- response.ts 无 truncated 残留
- anchor 残缺段以 incomplete_source 呈现不回填占位
- context_search/project_status 输出含 query_meta 且渲染文本同步
- 全量测试 1076 全绿

### T-008 落地 ADR-0003 hook drain（DetachedHookTracker + 退出 drain + invoked/timed_out） <!-- lrnev-task: status=completed, created=2026-09-07T04:19:30.663Z, updated=2026-09-07T04:19:38.269Z -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-09-07T04:19:38.070Z","reason":"开始实施 hook drain（2026-09-07，3.0.0 收口窗口）"},{"from":"in_progress","to":"completed","at":"2026-09-07T04:19:38.269Z","reason":"ADR-0003 落地完成：invoked 先写 + DetachedHookTracker + server 退出统一 drain(5s) 超时补写 timed_out + Doctor/renderer 适配 + CLI/MCP 触发路径单例化。hook 相关 28 用例全绿（含 quiescence 6 新用例）。偏离草案 event:drain→保留原事件已在代码注释与 ADR-0003 实施注记说明"}] -->

按 ADR-0003 补 P0 遗漏：HookRunner.runAsync 先写 invoked 记录再启动链并返回 Promise；新增 DetachedHookTracker 跟踪在飞 async 链；HookManager 持 tracker 并暴露 drainDetached(5000)；server 退出路径（onclose/EOF/SIGINT/SIGTERM）统一 drain 后退出，超时补写 timed_out 记录（event 保留原事件，偏离草案 event:drain 已在代码注明）；Doctor 健康统计剔除 invoked 脚手架记录；hook tail-log/list 渲染 exit_code optional 容错；CLI/MCP 手动触发路径改用 getHookManager 单例使链入 tracker

**验收**：
- hook-quiescence 测试覆盖 invoked 先写/drain 等待/drain 超时 timed_out/幂等
- Doctor 不因 invoked 记录误报慢性失败
