---
spec: '03-00-governance-report'
scene: '02-context-delivery'
created: '2026-06-15'
---

# 03-00 Governance Report - 任务清单

> 任务由 lrnev `task_create` 工具创建，不要手编。
> 状态机：pending → in_progress → completed / failed；blocked 可回 in_progress；failed 可回 pending 重试。

## 阶段 1

### T-001 GovernanceReport 计算核心 + 类型 + --scene（链路/覆盖率骨架） <!-- lrnev-task: status=completed, created=2026-06-17T11:00:00.000Z, updated=2026-06-17T12:05:00.000Z, validates=F-01|F-04|D-01|D-02 -->

新增 `src/types/governance-report.ts`（D-01 数据模型，含 unclosed/failed/blocked/broken_validates/paths/next_action）与 `src/core/GovernanceReport.ts`：一次遍历复用 `SceneManager.list/resolveId`（空 00-default 过滤 + `--scene` 缩遍历）、`parseFrontmatter`、`parseTasksFromMarkdown`+`attachTaskChildren`、FILL-aware 锚点 ID 提取（D-02）；算 chain/coverage 骨架与确定性 headline；core 无写副作用。

**验收**：
- `<!-- FILL:` 占位锚点不计入 anchor_total。
- 孤儿按 spec 状态分 in_flight_orphans / debt_orphans。
- `--scene` 只遍历该 scene；不给则全量。
- 无 .lrnev / 空工作区返回合法空 result + 健康 headline，不抛。

### T-002 收口判定镜像 completion gate + failed/blocked 明细 + 定位 <!-- lrnev-task: status=completed, created=2026-06-17T11:00:01.000Z, updated=2026-06-17T13:55:00.000Z, validates=F-01|D-03 -->

unclosed 判定用全平铺 every-completed，与 `GateRunner` 的 all_tasks_completed 同口径（含子任务、不特殊处理 parent/children）；收集 failed/blocked task 明细；每 spec/task 项带 paths（context:// URI + requirements_path + tasks_path，用 fs.abs()）。

**验收**：
- spec task 全 completed 但 status≠completed（非 archived）→ 进 unclosed，且与对该 spec 跑 completion gate 的 all_tasks_completed 结果一致。
- 含未完成子任务的 spec 不被判 unclosed。
- failed / blocked task 逐条列出（scene/spec/id/title）。

**依赖**：T-001

### T-003 坏 validates 不计 covered + archived 口径 <!-- lrnev-task: status=completed, created=2026-06-17T11:00:02.000Z, updated=2026-06-17T14:05:00.000Z, validates=F-02|D-02 -->

坏 validates（指向不存在/废弃锚点，口径同 TaskManager 存在性校验）不计入 covered、收进 broken_validates、warnings 指向 doctor；archived spec 不计入欠债统计（JSON 可计数、text 弱化）。

**验收**：
- task validates 含不存在锚点 → 不计 covered、进 broken_validates、warnings 指向 doctor。
- archived spec 不出现在欠债统计（text 默认不刷屏）。

**依赖**：T-001

### T-004 每条欠债的可执行下一步 hint <!-- lrnev-task: status=completed, created=2026-06-17T11:00:03.000Z, updated=2026-06-17T14:12:00.000Z, validates=F-05|D-04 -->

为 unclosed / debt_orphans / failed / broken_validates 各生成确定性 next_action（completion gate→spec_update / 补 validates / error_record 重试 / 指向 doctor），纯映射不执行。

**验收**：
- unclosed 项带 completion gate → spec_update 的下一步。
- failed 项带 error_record / 重试下一步。

**依赖**：T-002, T-003

### T-005 CLI report 命令 + text/markdown 渲染 + 输出形态（无退出码） <!-- lrnev-task: status=completed, created=2026-06-17T11:00:04.000Z, updated=2026-06-17T14:32:00.000Z, validates=F-04|D-06 -->

`buildReportCommand`：绕过强制 JSON 的 `run()`，专用 action 按形态渲染（默认 text、`--md`、`--json`）；`--scene`/`--out`/`--release-notes` 选项；`--md`/`--json` 互斥报错；`--out` 才落盘、无 --out 不写文件、绝不写 .lrnev；不提供退出码/`--fail-on`（exit 0 即使有债）。新增纯字符串 text/markdown 渲染器（把 hint+定位排版进每条债，零新依赖）。`GovernanceReport` 进 createManagers。

**验收**：
- 默认出 text；`--json` 可 JSON.parse；`--scene` 只含该 scene。
- `--md --out X.md` 落盘，随后无 --out 的 report 不产文件。
- `--md` 与 `--json` 同给 → INVALID_INPUT；有债时仍 exit 0。

**依赖**：T-001

### T-006 MCP lrnev_report 工具（CLI/MCP 对等） <!-- lrnev-task: status=pending, created=2026-06-17T11:00:05.000Z, validates=F-04|D-07 -->

`registerReportTools` 注册 `lrnev_report({scene?, release_notes?})`，readOnlyHint；`GovernanceReport` 进 MCP managers；加 `TOOL_DESCRIPTIONS.lrnev_report`。返回与 CLI `--json` 同源。

**验收**：
- `lrnev_report({scene})` 与 CLI `report --scene <id> --json` 数据深相等。
- release_notes 参数行为与 CLI `--release-notes` 一致。

**依赖**：T-001

### T-007 release notes 视图（低优先，工期紧可后置） <!-- lrnev-task: status=pending, created=2026-06-17T11:00:06.000Z, validates=F-03|D-05 -->

`build({releaseNotes:true})` 复用 T-001 遍历产物附 release_notes 段：按 scene/spec 分组、仅 completed spec 的 completed task 标题、不依赖 git、空时友好提示。仅加聚合+渲染分支，不二次扫描。优先级低于 T-001~T-006。

**验收**：
- 有 completed spec/task → release_notes 含分组清单。
- 无已完成项 → 友好提示而非报错。

**依赖**：T-001

### T-008 测试 + 文档同步 + 全量回归 <!-- lrnev-task: status=pending, created=2026-06-17T11:00:07.000Z, validates=F-01|F-02|F-03|F-04|F-05 -->

补单元（core 各分支：unclosed 镜像 gate / failed-blocked / 孤儿分类 / 坏 validates 不计 covered / FILL 过滤 / archived / --scene / next_action / 空工作区 / release_notes）+ 渲染快照 + 互斥报错 + 无退出码；e2e（CLI 四形态+scene、MCP/CLI 对等深相等）。同步 README（命令清单 + report 段 + report vs doctor 边界）、docs/ARCHITECTURE（GovernanceReport 模块）、docs/GOVERNANCE-FLOW（report 位置）、MCP 工具清单；`npm test` 全绿，零新依赖。

**验收**：
- 新增测试覆盖上述全部分支，含"report 与 completion gate 口径一致"用例。
- 全量测试通过；无新依赖；dev-docs 之外相关文档已更新。

**依赖**：T-001, T-002, T-003, T-004, T-005, T-006, T-007

## 验收标准（整体）

- [ ] `lrnev report` 列出做完没收口（与 gate 口径一致）/failed/blocked/孤儿/坏 validates，与手工统计一致
- [ ] 每条欠债带可执行下一步 + context:// 定位
- [ ] `--scene`/`--md`/`--json`/`--out` 符合 F-04，默认不写文件，无 CI 退出码
- [ ] MCP `lrnev_report`（含 scene/release_notes）与 CLI `--json` 数据口径一致
- [ ] release notes（低优先）产出分组清单
- [ ] 所有任务完成
- [ ] 单元测试通过
- [ ] 集成测试通过
