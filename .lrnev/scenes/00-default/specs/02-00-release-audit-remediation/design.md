---
spec: '02-00-release-audit-remediation'
scene: '00-default'
created: '2026-07-06'
---

# 02-00 Release Audit Remediation - 设计

## L0 摘要

纯文本层收口为主（guidance 字符串、followup 拼装、Markdown 文档），仅两处小行为变更（was_new 判据、claimable_next 加法字段），全部基于既有模块就地修改，不新增运行时结构。

## L1 概览

### 架构思路

- 引导文案是产品接口：guide/instructions/followup 的每处改动与文档同权对待，改动后由测试断言锁住关键词，防再漂移。
- 行为变更最小化：was_new 只换判据源（目录存在 → PROJECT.md 存在）；claimable_next 只加可选字段与 followup 文案，响应契约做加法。
- 文档一次成文、指向单一真相：CONFIG.md 以 `src/shared/config.ts` 的 `DEFAULT_CONFIG` 为唯一来源手工对齐，声明"以 config.ts 为准"。

### 主要模块

- `src/mcp/guidance.ts`（GUIDE 小节、WORKFLOW_OVERVIEW、TOOL_DESCRIPTIONS）
- `src/core/GateGuidance.ts`（ready-passed followup）
- `src/core/SpecManager.ts`（spec_create followup）
- `src/core/GoalAssessor.ts`（multi-spec override 指引）
- `src/core/GovernanceReport.ts`（headline 措辞）
- `src/storage/WorkspaceLocator.ts`（was_new 判据）
- `src/core/ProjectStatus.ts` + `src/types/project-status.ts`（claimable_next.depends_on、截断说明）
- `docs/`、`README.md`、`CHANGELOG.md`、`examples/`、`dev-docs/`

### 关键决策

| 决策 | 选项 | 倾向 | 是否产 ADR |
|------|------|------|-----------|
| claimable_next 依赖处理 | 过滤 / 标注 / 不动 | 标注（保软依赖哲学，加透明度） | 否（用户即席裁决，记录于本 spec） |
| was_new 判据 | .lrnev 目录 / PROJECT.md | PROJECT.md（README 既定语义） | 否（对齐既有文档，非新决策） |
| 配置成文形式 | README 内嵌 / 独立 CONFIG.md | 独立 CONFIG.md + examples/lrnev.json | 否 |

## L2 详情

### 模块详细设计

#### D-01 guidance 文本同步

`guidance.ts`：GUIDE 的 workflow 小节"ready gate 通过后"句改为提及 `task_create_many`（一次拆清单）与单条 `task_create`（临时补）；接手句补 `governance_map`/`lrnev_report`；工具速查"新建"组补 `task_create_many` 与 `spec_update`，"接手"组补 `governance_map`、`lrnev_report`、`assess_goal`。`WORKFLOW_OVERVIEW` 新建特性行加"多任务用 task_create_many 一次拆"、接手行加"可用 governance_map 看全景、lrnev_report 看治理债"。`TOOL_DESCRIPTIONS.agent_register` 补 gc 字段语义、`task_create` 补"多条请用 task_create_many"（保持各条 ≤180 字符审计约束）。

#### D-02 followup 增强

`SpecManager` 的 spec_create followup instructions 追加一条标题契约警示；`GateGuidance.buildPassedGateFollowup(ready)` 在"请暂停"之后追加无条件一条："把 design.md 的 FILL 哨兵填完（completion gate 会硬拦 design 残留），再拆任务。"；`GoalAssessor` 当 kind=multi-spec-program 时 instructions 追加 override 指引一条。

#### D-03 was_new 判据

`WorkspaceLocator.ensureWorkspace`：`wasNew = !existsSync(join(paths.root, 'PROJECT.md'))`——PROJECT.md 由 `WorkspaceManager.init` 经 `writeIfMissing` 写入，ensureWorkspace 层不写它，判据与写入解耦安全。既有"重复 init 不覆盖"行为不变。

#### D-04 claimable_next 透明化

`ProjectStatusTaskBrief` 增可选 `depends_on?: string[]`；`toProjectStatusTaskBrief` 在任务 depends_on 非空时带出。`ProjectStatus` 组装 followup 时，若任一 spec 的 `free_tasks_count > claimable_next.length`，追加一条"claimable_next 每个 spec 最多展示 N 条（config project_status.claimable_preview），全量看 free_tasks_count"。

#### D-05 headline 措辞

`GovernanceReport` headline 前缀由"整体健康："改为"治理债：无做完未收口的 spec……"，有债分支同样以"治理债"开头；同步 v2.2 锁 headline 的测试断言。report 语义（快照、非 gate、exit 0）不变。

### 数据模型

无新增持久化结构。响应契约加法：`ProjectStatusTaskBrief.depends_on?`。

### 接口契约

- MCP/CLI 工具数不变（42）；无新工具、无参数变更。
- `project_status` 返回加可选字段；旧消费方忽略即可。

### 错误处理

无新错误路径；文档与文案改动不触及错误码。

### 测试策略

- 单元：was_new 两分支（预存 agents/ 目录 → true；PROJECT.md 存在 → false）；claimable_next 带 depends_on 与截断 followup；headline 新措辞（改既有断言）；guide/instructions 关键词断言（task_create_many/governance_map/lrnev_report/spec_update）；spec_create 与 ready-passed followup 新增文案断言。
- 全量回归：npm test 全绿；tool-descriptions 审计测试（≤180 字/含"何时用"）保持通过。
