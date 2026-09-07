---
spec: '06-00-guidance-documentation'
scene: '04-ai-guidance-standardization'
created: '2026-08-27'
---

# 06-00 Guidance Documentation - 任务清单

> 任务由 lrnev `task_create` 工具创建，不要手编。基础文档无条件发布；Profile 附录仅在 05 有实际版本后追加。

## 阶段 1：基础文档与迁移指南

<!-- FILL: 使用 task_create 追加任务；任务以 lrnev-task 标记记录 -->

## 验收标准（整体）

- [ ] F-01 至 F-06 完成。
- [ ] 01/02/03/04 的权威产物均有可访问文档入口。
- [ ] response/MCP/Profile 版本边界明确。
- [ ] content、structuredContent、ModelVisibleContract、Profile 和 decision_context 的边界一致。
- [ ] Profile 未实施时基础文档仍可独立发布。
- [ ] 文档链接、版本、术语和示例验证通过。

### T-001 建立基础文档树、导航与权威来源元数据 <!-- lrnev-task: status=pending, created=2026-08-27T08:05:39.502Z, validates=F-01|F-05|F-06|D-01|D-05 -->

按 D-01 建立 README 导航及 Semantic Authority Model、Guidance Surface Inventory、MCP Response Conformance（含 ModelVisibleContract 固定章节）、Client Integration Guide、E2E Evidence Index 的文档位置和 owner/version/source Spec/update trigger 元数据。基础入口不得依赖 05 实施状态。

**验收**：
- README 仅导航，不复制规范正文；基础五类文档均有可访问入口。
- 每份文档标记其权威来源和更新触发，静态清单、运行时证据、适配结论不混为同一真相源。
- Profile 文档在未实施 v1 时不阻塞基础文档发布。

### T-002 编写 MCP Conformance 与 content 破坏性迁移指南 <!-- lrnev-task: status=pending, created=2026-08-27T08:05:39.502Z, depends_on=T-001, validates=F-02|F-04|F-06|D-01|D-03 -->

基于 03 的实现/测试产物编写 mcp-response-conformance.md，并以其中的固定章节说明 ModelVisibleContract；文档覆盖 outputSchema、structuredContent、content、isError、annotations、MCP protocol、独立 response_version、B2a/B2b、旧 JSON text parse 约定废弃、升级/回滚步骤、受影响客户端与 surface_id。不得新增独立 model-visible-contract.md，以保持与 D-01 文档树一致。

**验收**：
- 明确 structuredContent 是完整机器数据，content 是逐工具 ModelVisibleContract 文本视图，二者不应维持完整 JSON 双重真相。
- 说明 annotations 仅为 hints，不能作为授权/安全依据；版本边界相互独立。
- 每条迁移项包含引入/废弃/回滚版本、验证场景或命令和受影响 surface_id。

**依赖**：T-001

### T-003 编写客户端集成与 decision_context 契约指南 <!-- lrnev-task: status=pending, created=2026-08-27T08:05:39.502Z, depends_on=T-001, validates=F-02|F-03|F-06|D-02|D-04|D-06 -->

编写 client-integration-guide.md，说明客户端保留用户原话、content/structuredContent 消费优先级和错误处理；仅在 assess_goal、scene_create、spec_create、task_create 传 client_asserted decision_context；写明缺失/unspecified、explicit/preferred direction、完整 target_ref、枚举级非阻断对齐、spec_update 不传以及不持久化/不授予阻断权。

**验收**：
- 示例都使用 source=client_asserted，明确服务端不验证用户原话、不生成 USER_DECISION。
- 指南区分通用 MCP 客户端与 Profile 感知客户端，未适配时可使用文本降级。
- 不将 Recommendation 写成必须执行，也不主张用户决定覆盖真实 Constraint。

**依赖**：T-001

### T-004 发布 E2E 证据索引与 capability 矩阵 <!-- lrnev-task: status=pending, created=2026-08-27T08:05:39.502Z, depends_on=T-001, validates=F-01|F-05|D-01|D-05 -->

依据 04 的唯一运行时证据源发布 e2e-evidence-index.md 和 capability matrix，按 run id/evidence path 关联 client/version/model/stage/结论，区分 02 的静态声明、04 的运行时观察和 05 的适配结论；不复制脱敏原始运行日志。

**验收**：
- capability 结论可追溯到 04 的 run id/evidence path，包含 B0/B1/B2a/B2b/B3 阶段。
- 文档不伪造、改写或另存为独立事实源的运行记录。
- 能明确标示通用 transport 能力、客户端实际消费能力和 Profile 适配结论的差异。

**依赖**：T-001

### T-005 实现文档契约自动校验与发布门禁 <!-- lrnev-task: status=pending, created=2026-08-27T08:05:39.502Z, depends_on=T-002|T-003|T-004, validates=F-02|F-03|F-04|F-05|F-06|D-03|D-05|D-06 -->

实现文档树、链接、版本、schema/role 名称、错误码、surface_id 和示例工具调用的自动校验；解析 decision_context examples 并检查 source、strength/direction、target_ref、缺失与 unspecified、不阻断和不持久化声明；扫描禁止表述并校验 ModelVisibleContract 覆盖注册工具。

**验收**：
- 自动检查能定位断链、未知版本/role/错误码/surface_id、无效 context example 与遗漏的工具契约。
- 扫描阻止“Recommendation 必须执行”“用户决定覆盖 Constraint”“Profile 是 MCP 标准”等错误表述。
- 发布门禁要求 01/02/03 权威产物可用，基础文档不依赖 05。

**依赖**：T-002, T-003, T-004

### T-006 按 Profile 实施状态条件发布 v1 附录与最终文档验收 <!-- lrnev-task: status=pending, created=2026-08-27T08:05:39.502Z, depends_on=T-005, validates=F-01|F-02|F-03|F-04|F-05|F-06|D-04|D-05|D-06 -->

在 05 已实际发布 Profile v1 且 04 有 capability 证据时，追加 lrnev-guidance-profile.md 附录，注明能力前提、已验证客户端版本、content 文本降级、字段回退结论和故障排查；随后执行全部文档发布验收。若前置未满足，保留附录未发布状态但不阻塞基础文档验收。

**验收**：
- Profile 附录不会把 Profile 描述为 MCP 官方标准，所有 context 示例均声明 client_asserted 且不持久化、不阻断。
- 基础文档可在 Profile 未实施时独立发布；附录仅在实际版本和证据齐全后发布。
- 内容、structuredContent、ModelVisibleContract、Profile、decision_context、版本与回滚描述无矛盾。

**依赖**：T-005
