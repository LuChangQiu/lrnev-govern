---
spec: '03-00-governance-report'
scene: '02-context-delivery'
created: '2026-06-15'
---

# 03-00 Governance Report - 设计

## L0 摘要

新增 `GovernanceReport` core 类（仿 `GovernanceMap`/`ProjectStatus`：自己扫 `.lrnev`、复用 `TaskManager` 纯函数、零模型），算出链路完整度（收口缺口 + failed/blocked 明细）、validates 覆盖率（孤儿/坏 validates/archived 口径）、每条欠债的可执行下一步，以及低优先的 release notes 视图；支持 `--scene` 过滤。CLI 新增 `report` 命令并引入首个 text 渲染器（默认 text、`--md`/`--json`/`--out`），MCP 新增对等 `lrnev_report`。明确不做 CI 退出码。

## L1 概览

### 架构思路

- **复用而不新建扫描器**：scene 遍历走 `SceneManager.list()`（含空 00-default 过滤口径），spec frontmatter + task 解析复用 `ProjectStatus` 既有套路（`parseFrontmatter` 读 status、`parseTasksFromMarkdown`+`attachTaskChildren` 读 task）。
- **计算与渲染分离**：core 只产出确定性数据对象（`GovernanceReportResult`），text/markdown 渲染在 CLI 层；`--json` 直接吐 core 数据，因此 MCP `lrnev_report` 与 CLI `--json` 天然同源。
- **口径对齐 gate（仅任务完成子检查）**：收口判定只镜像 `GateRunner` 的 `all_tasks_completed`（全平铺 every-completed）；completion gate 的 FILL/design 子检查不在 report 复刻范围，report 不承诺 gate 必过、只引导去跑 gate。
- **report vs doctor 边界**：report 只"呈现治理进度 + 给下一步"，结构修复/ stale 判定/坏 validates 逐条修复留 doctor；坏 validates 在 report 里只标记+不算歪覆盖率+指向 doctor。
- **零副作用 + 非执法**：core 不写文件；落盘只在 CLI `--out`；不提供退出码/`--fail-on`（保住"分红"而非"新 gate"定位）。

### 主要模块

- `src/core/GovernanceReport.ts`（新）：核心计算，产出 `GovernanceReportResult`，构造 `(fs, scenes)`，`build({scene?, releaseNotes?})`。
- `src/types/governance-report.ts`（新）：结果类型。
- `src/cli/index.ts`（改）：`buildReportCommand` + text/markdown 渲染器 + `--out` 落盘 + `--scene`；`GovernanceReport` 进 `createManagers`。
- `src/mcp/tools/index.ts`（改）：注册 `lrnev_report({scene?, release_notes?})`；`GovernanceReport` 进 MCP managers + `TOOL_DESCRIPTIONS`。
- 复用：`SceneManager.list/resolveId`、`TaskManager.parseTasksFromMarkdown/attachTaskChildren`、`parseFrontmatter`、`tryParseSpecParts`；坏 validates 口径复用 `TaskManager` 锚点存在性校验思路。

### 关键决策

| 决策 | 选项 | 倾向 | 是否产 ADR |
|------|------|------|-----------|
| 数据来源 | A 复用 ProjectStatus 输出 / B 自扫复用纯函数 | B（ProjectStatus 输出已为接手裁剪，缺锚点/坏validates/收口语义；自扫但复用纯函数最准） | 建议 ADR |
| 文本落盘 | A 默认写 .lrnev/reports / B 仅 --out | B（派生物不污染真相目录） | 建议 ADR |
| 是否提供退出码 | A 加 --fail-on 供 CI / B 不加 | B（加退出码=把分红变 gate，破坏定位） | 写进非目标 |

## L2 详情

### 模块详细设计

#### D-01 GovernanceReport 计算核心 + --scene（对应 F-01 / F-04）

`class GovernanceReport { constructor(fs, scenes) }`，`async build(input?: { scene?: string; releaseNotes?: boolean }): Promise<AiFollowupResponse<GovernanceReportResult>>`。

一次遍历（纯确定性）：
1. scene 范围：`input.scene` → `SceneManager.resolveId` 后只遍历该 scene（**显式指定时不应用"空 00-default 排除"，用户要看就显示，哪怕空**）；否则 `SceneManager.list()` 全量时才排除空 00-default。
2. 每 spec：`parseFrontmatter` 读 status（缺省 draft）；读 tasks.md → `attachTaskChildren(parseTasksFromMarkdown(...))` 得全平铺 task；FILL-aware 提取锚点 ID（D-02）；收集各 task `validates` 汇成 validatedSet。
3. 调 D-03（链路：unclosed/failed/blocked）、D-02（覆盖率）、D-04（下一步/定位）、D-05（release notes 仅 releaseNotes=true）组装结果。
4. headline（确定性）：硬欠债 = `unclosed>0 || failed>0 || debt_orphans>0` → 欠债概述；无硬欠债但 `blocked>0` → "无硬欠债（N 个任务阻塞待处理）"；全无 → "整体健康"。headline 提到的债类型在明细段必有对应数据。

边界：无 `.lrnev`/零 scene → 合法空 result + 友好 followup，不抛；**单 spec 读取/解析异常用 per-spec try/catch 包住，跳过该 spec 并把 `scene/spec` 计入 warnings，不让一个坏 spec 崩掉整份报告**。

#### D-02 覆盖率口径：FILL-aware 锚点 + 坏 validates 不计 covered + archived（对应 F-02）

- 锚点 ID 提取：FILL-aware（`^#### (F-\d+)\b` 且整行不含 `<!-- FILL:`），与 `extractAnchorPool` 同正则家族但多一条 FILL 过滤；**不改 `extractAnchorPool`**（它服务 task 校验，校验语义不应受占位影响）。
- 覆盖率 = 被 validatedSet 覆盖的真锚点 / 真锚点总数。
- 孤儿锚点 = 真锚点 − covered；按所属 spec 状态分 `in_flight_orphans`（spec 未 completed，正常）/ `debt_orphans`（spec 已 completed 仍有孤儿，真欠债）。
- 坏 validates：task 的 validates 中指向不存在锚点/废弃格式的项（口径同 `TaskManager.findBadValidatesAnchors` 思路）。**这些不计入 covered**（避免覆盖率被坏引用算高），收进 `broken_validates`，并在 result.warnings 注明"详细修复看 doctor"。
- archived spec：不计入 unclosed / orphan 欠债统计；JSON 里可保留计数字段，text 渲染默认不展开，避免旧方案刷屏。

#### D-03 链路：收口缺口镜像 gate 口径 + failed/blocked 明细（对应 F-01）

- "做完没收口" unclosed 判定：`tasks.length>0 && tasks.every(t=>t.status==='completed') && status∉{completed,archived}`。这**只与** `GateRunner` completion 的 `all_tasks_completed = tasks.filter(t=>t.status!=='completed').length===0` 这一子检查**同口径**（都基于 `parseTasksFromMarkdown` 全平铺数组、含子任务、不对 parent/children 特殊处理），所以含未完成子任务的 spec 不被判 unclosed。但 completion gate 还会查 `requirements_no_fill`(GateRunner.ts:180)/`design_exists`(:194)/`design_no_fill`(:205)——report **不复刻这些**，因此 report 标 unclosed ≠ "gate 必过"；report 只下"任务都完成、status 未推进"的结论，是否真能通过 gate 由 gate 自己判。next_action 的措辞也据此：引导"去跑 completion gate 验收"，而非"跑了一定过"。
- failed 明细：全工作区/scene 内 status=failed 的 task（scene/spec/id/title）。
- blocked 明细：status=blocked 的 task。
- 每 spec 项带 `paths`：`context://spec/<scene>/<spec>`、requirements_path、tasks_path（用 `fs.abs()`，先例见 ProjectStatus 的 adr/error path）。

#### D-04 可执行下一步 hint + 定位（对应 F-05）

为每条欠债项生成确定性的下一步建议（纯算术映射，不调模型，不自动执行）：
- unclosed → `spec_gate_check(scene,spec,gate=completion)` 然后 `spec_update(status=completed)`。
- debt_orphans → "给锚点补 task validates 或确认需求是否还需要"。
- failed → `error_record` + `task_update` 重试。
- broken_validates → 指向 `doctor` 查全量 + 手改。
渲染时 text 把 hint 跟在每条债后；json 作为结构化字段（如 `next_action`）。这是 report 的"分红"内核——把诊断变成可照做的下一步。

#### D-05 release notes 视图（低优先，对应 F-03）

`build({releaseNotes:true})` 复用 D-01 遍历产物，附 `release_notes` 段：按 scene/spec 分组、仅含 completed spec 的 completed task 标题；不依赖 git；空时友好提示。仅多一个聚合+渲染分支，不二次扫描；工期紧可最后做，不阻塞 F-01/F-02/F-05。

#### D-06 CLI report 命令 + 输出形态（对应 F-04）

`buildReportCommand`：options `--scene <id>`、`--release-notes`、`--md`、`--json`、`--out <path>`。
- **绕过强制 JSON 的通用 `run()`**：现有 `run()`→`format()` 永远 JSON，无法出 text。report 用专用 action：`build({scene,releaseNotes})` 拿 result → 按形态渲染（默认 `renderReportText`、`--md` `renderReportMarkdown`、`--json` `JSON.stringify`）→ 有 `--out` 则 `writeFile` 否则 stdout。
- `--md`/`--json` 同给 → `LrnevError(INVALID_INPUT)`。
- text/markdown 渲染器是 CLI 首个非 JSON 输出：纯字符串拼接、零新依赖；text 把"下一步 hint"和"定位"排版进每条债。
- **不提供任何退出码/`--fail-on`**：成功执行即 exit 0，不因有债而非零退出（非目标，写死防回归）。

#### D-07 MCP lrnev_report 对等（对应 F-04）

`registerReportTools` 注册 `lrnev_report`，`inputSchema: { scene: z.string().optional(), release_notes: z.boolean().optional() }`，`readOnlyHint=true`；body `toToolResult(getManagers().governanceReport.build({scene, releaseNotes}))`。`TOOL_DESCRIPTIONS.lrnev_report` 说明"零模型治理体检+下一步+release notes 草稿，结构化数据，等价 CLI report --json"。返回与 CLI `--json` 同源。

### 数据模型

```ts
// src/types/governance-report.ts
interface ReportPaths { uri: string; requirements_path: string; tasks_path: string }
interface UnclosedSpec { scene; spec; name; done: number; total: number; status: SpecStatus; next_action: string; paths: ReportPaths }
interface TaskBrief { scene; spec; id; title; paths: ReportPaths; next_action?: string }
interface OrphanGroup { scene; spec; status: SpecStatus; anchors: string[]; paths: ReportPaths; next_action?: string } // debt 带 next_action；两类都带 paths
interface BrokenValidates { scene; spec; task: string; anchors: string[]; paths: ReportPaths; next_action: string } // 不计 covered，next_action 指向 doctor
interface GovernanceReportChain {
  scene_count; spec_count; task_count: number;
  scenes: { scene; name; spec_count; task_count; empty: boolean }[];
  unclosed: UnclosedSpec[];
  failed_tasks: TaskBrief[];
  blocked_tasks: TaskBrief[];
}
interface GovernanceReportCoverage {
  anchor_total; anchor_covered; coverage_ratio: number;
  in_flight_orphans: OrphanGroup[];
  debt_orphans: OrphanGroup[];
  broken_validates: BrokenValidates[];
  archived_excluded: number;
}
interface GovernanceReportResult {
  generated_at: string; scope: string; // 'all' 或 scene id
  headline: string;
  chain: GovernanceReportChain;
  coverage: GovernanceReportCoverage;
  release_notes?: { scenes: { scene; name; specs: { spec; name; tasks: string[] }[] }[] };
  warnings?: string[]; // 如坏 validates 指向 doctor
}
```

### 接口契约

- CLI：`lrnev report [--scene <id>] [--release-notes] [--md|--json] [--out <path>]`（无退出码语义）。
- MCP：`lrnev_report({ scene?, release_notes? })` → `GovernanceReportResult`。
- core：`GovernanceReport.build({ scene?, releaseNotes? }) → AiFollowupResponse<GovernanceReportResult>`。
- 仅新增，不改现有公共签名。

### 错误处理

- `--md` 与 `--json` 同给 → INVALID_INPUT。
- `--out` 写入失败 → 透传 fs 错误、包成结构化 error，不静默吞。
- `--scene` 指向不存在 scene → `SceneManager.resolveId` 抛 SCENE_NOT_FOUND（复用既有）。
- 无 `.lrnev`/空工作区 → 合法空 result + 健康 headline，不抛。
- 单 spec 坏 frontmatter → 跳过 + followup 提示，不让整份报告崩。

### 测试策略

- 单元（core）：构造"task 全 completed + status=draft" → 进 unclosed，且与 GateRunner.check(completion) 的 all_tasks_completed 结果一致；含未完成子任务 → 不进 unclosed（镜像 gate）；failed/blocked 明细；孤儿分 in_flight/debt；坏 validates 不计 covered 且进 broken_validates+warnings；FILL 占位不计分母；archived 不计欠债；`--scene` 只含该 scene；每条债带 next_action；空工作区健康 headline；release_notes 仅 completed。
- 单元（渲染）：text/markdown 快照（含 hint/定位排版）；`--md`/`--json` 互斥报错；无退出码（exit 0 即使有债）。
- e2e（CLI）：真实临时工作区跑默认 text、`--json` 可 parse、`--md --out X` 落盘且无 --out 不产文件、`--scene`、`--release-notes`。
- e2e（对等）：MCP `lrnev_report({scene})` 与 CLI `report --scene --json` 深相等。
- 全量 `npm test` 绿；零新运行时依赖。
