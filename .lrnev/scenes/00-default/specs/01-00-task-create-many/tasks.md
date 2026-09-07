---
spec: '01-00-task-create-many'
scene: '00-default'
created: '2026-07-06'
---

# 01-00 Task Create Many - 任务清单

> 任务由 lrnev `task_create` 工具创建，不要手编。
> 状态机：pending → in_progress → completed / failed；blocked 可回 in_progress；failed 可回 pending 重试。

## 阶段 1

<!-- FILL: 使用 task_create 追加任务；任务会以 `### T-XXX 标题 <!-- lrnev-task: ... -->` 形式追加到这里 -->

### T-001 基建：LrnevError 批量错误明细载荷 + config 单批上限 <!-- lrnev-task: status=completed, created=2026-07-06T08:30:26.124Z, updated=2026-07-06T08:54:17.704Z, validates=F-03|D-03 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-07-06T08:52:54.301Z"},{"from":"in_progress","to":"completed","at":"2026-07-06T08:54:17.704Z"}] -->

**验收**：
- LrnevError 支持可选 errors:[{index,field,message,code}] 并接入 toErrorInfo 与 MCP/CLI 序列化
- 既有错误路径行为不变
- config 新增 task.max_batch_create 默认 50

### T-002 core：单条校验重构为收集式共用 + createMany 两阶段实现 <!-- lrnev-task: status=completed, created=2026-07-06T08:30:27.270Z, updated=2026-07-06T09:35:53.054Z, depends_on=T-001, validates=F-01|F-02|F-03|D-01|D-02 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-07-06T08:54:20.255Z"},{"from":"in_progress","to":"completed","at":"2026-07-06T09:35:53.054Z"}] -->

**验收**：
- 两阶段原子：任一失败整批零落盘零 ID 占用
- 与逐条创建落盘产物等价（含 parent 子任务路径）
- key 规则：唯一/禁 T 格式/不限方向/自引用拒绝
- hook task.create 逐任务触发 N 次
- 单条 task_create 外部行为不变

**依赖**：T-001

### T-003 MCP：注册 task_create_many + TOOL_DESCRIPTIONS + 压缩返回单次 followup <!-- lrnev-task: status=completed, created=2026-07-06T08:30:52.934Z, updated=2026-07-06T09:35:58.211Z, depends_on=T-002, validates=F-04|D-04 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-07-06T09:35:55.741Z"},{"from":"in_progress","to":"completed","at":"2026-07-06T09:35:58.211Z"}] -->

**验收**：
- 返回 created:[{id,title}] 且 ai_followup 仅一份
- completed spec 时维护态回退提示单次出现
- tool-descriptions 测试覆盖新工具

**依赖**：T-002

### T-004 CLI：task create-many --from-file（含 stdin '-'） <!-- lrnev-task: status=completed, created=2026-07-06T08:30:54.022Z, updated=2026-07-06T09:36:05.739Z, depends_on=T-002, validates=F-05|D-05 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-07-06T09:36:01.402Z"},{"from":"in_progress","to":"completed","at":"2026-07-06T09:36:05.739Z"}] -->

**验收**：
- 同一 JSON 经 CLI 与 MCP 提交落盘与返回同构
- 缺文件/坏 JSON/坏结构报结构化 INVALID_INPUT

**依赖**：T-002

### T-005 测试全套与回归全绿 <!-- lrnev-task: status=completed, created=2026-07-06T08:30:55.114Z, updated=2026-07-06T09:36:13.483Z, depends_on=T-003|T-004, validates=F-01|F-02|F-03|F-04|F-05 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-07-06T09:36:09.814Z"},{"from":"in_progress","to":"completed","at":"2026-07-06T09:36:13.483Z"}] -->

**验收**：
- 10 条含批内依赖+validates 一次创建成功
- 混入 2 处坏引用整批拒且两错误一次返回
- 单条 task_create 既有测试全部不动
- 全量套件全绿

**依赖**：T-003, T-004

### T-006 文档同步：README / GOVERNANCE-FLOW / AI-ADAPTATION + CHANGELOG 条目 <!-- lrnev-task: status=completed, created=2026-07-06T08:30:56.222Z, updated=2026-07-06T09:36:18.487Z, depends_on=T-005 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-07-06T09:36:16.523Z"},{"from":"in_progress","to":"completed","at":"2026-07-06T09:36:18.487Z"}] -->

README 常用命令与工具说明加 create-many；docs/GOVERNANCE-FLOW.md 任务创建流程提批量路径；docs/AI-ADAPTATION.md 如列工具清单则同步；CHANGELOG 新版本 Added 条目（含升级指南：无破坏性）；README 测试计数刷新

**验收**：
- 所有提及任务创建的用户文档与新行为一致
- CHANGELOG 条目完整

**依赖**：T-005

