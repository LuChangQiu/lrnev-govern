---
spec: '03-00-governance-report'
scene: '02-context-delivery'
created: '2026-06-15'
---

# 03-00 Governance Report - 任务清单

> 任务由 lrnev `task_create` 工具创建，不要手编。
> 状态机：pending → in_progress → completed / failed；blocked 可回 in_progress；failed 可回 pending 重试。

## 阶段 1

### T-001 GovernanceReport 计算核心 + 类型（链路完整度+覆盖率） <!-- lrnev-task: status=pending, created=2026-06-17T00:00:00.000Z, validates=F-01|F-02|D-01|D-02 -->

新增 `src/types/governance-report.ts`（D-01 数据模型）与 `src/core/GovernanceReport.ts`：一次遍历复用 `SceneManager.list`（空 00-default 过滤口径）、`parseFrontmatter`、`parseTasksFromMarkdown`+`attachTaskChildren`，FILL-aware 提取锚点 ID 集合（D-02），算出 chain（含 unclosed/in_flight）、coverage（in_flight_orphans/debt_orphans）、确定性 headline。core 无写副作用。

**验收**：
- task 全 completed 但 spec status≠completed → 进 chain.unclosed，带 done/total/status。
- 写了 `#### F-01` 无任何 task validates → 按 spec 状态归 in_flight_orphans / debt_orphans。
- `<!-- FILL:` 占位锚点不计入 anchor_total。
- 无 .lrnev / 空工作区返回合法空 result + 健康 headline，不抛。

### T-002 release notes 视图 <!-- lrnev-task: status=pending, created=2026-06-17T00:00:01.000Z, validates=F-03|D-03 -->

`build({releaseNotes:true})` 在结果附 release_notes 段：按 scene/spec 分组，仅含 completed spec 的 completed task 标题；不依赖 git；空时友好提示。复用 T-001 遍历产物，不二次扫描。

**验收**：
- 有 completed spec/task → release_notes 含对应分组清单。
- 无已完成项 → 空清单友好提示而非报错。

**依赖**：T-001

### T-003 CLI report 命令 + text/markdown 渲染 + 输出形态 <!-- lrnev-task: status=pending, created=2026-06-17T00:00:02.000Z, validates=F-04|D-04 -->

`buildReportCommand`：绕过强制 JSON 的通用 `run()`，专用 action 按形态渲染（默认 text、`--md` markdown、`--json`）；`--md`/`--json` 互斥；`--out <path>` 才落盘、无 --out 不写文件、绝不默认写 .lrnev。新增纯字符串 text/markdown 渲染器（零新依赖）。`GovernanceReport` 进 createManagers 工厂。

**验收**：
- `report` 默认出 text；`report --json` 可被 JSON.parse。
- `report --md --out X.md` 落盘 X.md；随后 `report`（无 --out）不产生任何文件。
- `--md` 与 `--json` 同给 → INVALID_INPUT。

**依赖**：T-001

### T-004 MCP lrnev_report 工具（CLI/MCP 对等） <!-- lrnev-task: status=pending, created=2026-06-17T00:00:03.000Z, validates=F-04|D-05 -->

`registerReportTools` 注册 `lrnev_report({ release_notes? })`，readOnlyHint；`GovernanceReport` 进 MCP managers 工厂；加 `TOOL_DESCRIPTIONS.lrnev_report`。返回结构与 CLI `--json` 同源。

**验收**：
- MCP `lrnev_report` 返回 GovernanceReportResult，与 CLI `--json` 数据口径一致。
- release_notes 参数行为与 CLI `--release-notes` 一致。

**依赖**：T-001

### T-005 测试 + 文档同步 + 全量回归 <!-- lrnev-task: status=pending, created=2026-06-17T00:00:04.000Z, validates=F-01|F-02|F-03|F-04 -->

补单元（core 计算各分支 + 渲染快照 + 互斥报错）、e2e（CLI 四形态 + MCP/CLI 对等深相等）；同步 README（命令清单 + report 段）、docs/ARCHITECTURE（GovernanceReport 模块）、docs/GOVERNANCE-FLOW（report 在流程中的位置）、MCP 工具清单；`npm test` 全绿，零新运行时依赖。

**验收**：
- 新增测试覆盖 unclosed / 孤儿分类 / FILL 过滤 / 空工作区 / 输出形态 / 对等。
- 全量测试通过；无新依赖；dev-docs 之外相关文档已更新。

**依赖**：T-001, T-002, T-003, T-004

## 验收标准（整体）

- [ ] `lrnev report` 在真实工作区列出"做完没收口"spec 与孤儿锚点，与手工统计一致
- [ ] `--md` / `--json` / `--out` 行为符合 F-04，默认不写任何文件
- [ ] `lrnev report --release-notes` 产出按 scene/spec 分组的已完成清单
- [ ] MCP `lrnev_report` 与 CLI `--json` 数据口径一致
- [ ] 所有任务完成
- [ ] 单元测试通过
- [ ] 集成测试通过
