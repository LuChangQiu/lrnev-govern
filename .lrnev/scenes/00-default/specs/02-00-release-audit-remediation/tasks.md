---
spec: '02-00-release-audit-remediation'
scene: '00-default'
created: '2026-07-06'
---

# 02-00 Release Audit Remediation - 任务清单

> 任务由 lrnev `task_create` 工具创建，不要手编。
> 状态机：pending → in_progress → completed / failed；blocked 可回 in_progress；failed 可回 pending 重试。

## 阶段 1

<!-- FILL: 使用 task_create 追加任务；任务会以 `### T-XXX 标题 <!-- lrnev-task: ... -->` 形式追加到这里 -->

### T-001 guidance 文本同步 v2.1~v2.3（guide/WORKFLOW_OVERVIEW/TOOL_DESCRIPTIONS） <!-- lrnev-task: status=completed, created=2026-07-06T10:25:29.124Z, updated=2026-07-06T11:08:46.627Z, validates=F-01|D-01 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-07-06T10:26:59.121Z"},{"from":"in_progress","to":"completed","at":"2026-07-06T11:08:46.627Z"}] -->

**验收**：
- guide 全文可检索到 task_create_many/governance_map/lrnev_report/spec_update
- tool-descriptions 审计测试保持通过

### T-002 followup 增强：spec_create 标题警示 / ready-passed 填 design 提示 / assess_goal override <!-- lrnev-task: status=completed, created=2026-07-06T10:25:29.124Z, updated=2026-07-06T11:08:47.335Z, validates=F-02|D-02 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-07-06T11:08:46.979Z"},{"from":"in_progress","to":"completed","at":"2026-07-06T11:08:47.335Z"}] -->

**验收**：
- spec_create followup 含标题契约警示
- ready 通过 followup 含无条件填 design.md 提示

### T-003 was_new 判据改 PROJECT.md 存在性 + 单元测试 <!-- lrnev-task: status=completed, created=2026-07-06T10:25:29.124Z, updated=2026-07-06T11:08:48.011Z, validates=F-03|D-03 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-07-06T11:08:47.669Z"},{"from":"in_progress","to":"completed","at":"2026-07-06T11:08:48.011Z"}] -->

**验收**：
- 预存 .lrnev/agents/ 时 init 返回 was_new:true
- PROJECT.md 已存在时 was_new:false 且不覆盖

### T-004 claimable_next 附 depends_on + 截断 followup 说明 + 测试 <!-- lrnev-task: status=completed, created=2026-07-06T10:25:29.124Z, updated=2026-07-06T11:08:48.724Z, validates=F-04|D-04 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-07-06T11:08:48.385Z"},{"from":"in_progress","to":"completed","at":"2026-07-06T11:08:48.724Z"}] -->

**验收**：
- 带依赖的可领任务条目含 depends_on
- 超出预览上限时 followup 有截断说明

### T-005 report headline 改治理债口径 + 同步既有断言 <!-- lrnev-task: status=completed, created=2026-07-06T10:25:29.124Z, updated=2026-07-06T11:08:49.449Z, validates=F-02|D-05 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-07-06T11:08:49.063Z"},{"from":"in_progress","to":"completed","at":"2026-07-06T11:08:49.449Z"}] -->

**验收**：
- 无债 headline 以治理债口径表述
- v2.2 headline 相关测试更新后全绿

### T-006 用户文档修复与补全（CHANGELOG 链接/ARCHITECTURE 树/AI-ADAPTATION/CONFIG.md/零覆盖工具等） <!-- lrnev-task: status=completed, created=2026-07-06T10:25:29.124Z, updated=2026-07-06T11:17:05.706Z, validates=F-05 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-07-06T11:08:49.775Z"},{"from":"in_progress","to":"completed","at":"2026-07-06T11:17:05.706Z"}] -->

**验收**：
- 6 个零覆盖工具在用户文档各至少一处
- docs/CONFIG.md 覆盖全部配置组
- ARCHITECTURE 目录树与 src 一致

### T-007 dev-docs 归档刷新 + v2.3 e2e 报告收录 + research 测试残留清理 <!-- lrnev-task: status=completed, created=2026-07-06T10:25:29.124Z, updated=2026-07-06T11:22:14.140Z, validates=F-06 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-07-06T11:17:06.311Z"},{"from":"in_progress","to":"completed","at":"2026-07-06T11:22:14.140Z"}] -->

**验收**：
- 快照移入 archive/
- 三份活文档数字与 v2.3 一致
- research 三项目无 .lrnev/报告/opencode.json 残留

### T-008 全量回归 + CHANGELOG 2.3.0 条目收口 <!-- lrnev-task: status=completed, created=2026-07-06T10:25:29.124Z, updated=2026-07-06T11:26:20.469Z, depends_on=T-001|T-002|T-003|T-004|T-005|T-006|T-007, validates=F-05 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-07-06T11:22:14.649Z"},{"from":"in_progress","to":"completed","at":"2026-07-06T11:26:20.469Z"}] -->

**验收**：
- npm test 全绿
- npm run build 通过
- CHANGELOG 2.3.0 含本轮整改说明

**依赖**：T-001, T-002, T-003, T-004, T-005, T-006, T-007

