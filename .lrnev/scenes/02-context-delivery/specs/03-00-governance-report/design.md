---
spec: '03-00-governance-report'
scene: '02-context-delivery'
created: '2026-06-15'
---

# 03-00 Governance Report - 设计

## L0 摘要

新增 `GovernanceReport` core 类（仿 `GovernanceMap`/`ProjectStatus`：自己扫 `.lrnev`、复用 `TaskManager` 纯函数、零模型），计算链路完整度与 validates 覆盖率两段数据 + release notes 视图；CLI 新增 `report` 命令并引入首个 text 渲染器（默认 text、`--md`/`--json`/`--out` 控形态），MCP 新增对等 `lrnev_report` 工具返回结构化数据。

## L1 概览

### 架构思路

- **复用而不新建扫描器**：scene 遍历走 `SceneManager.list()`（含空 00-default 过滤口径），spec frontmatter + task 解析复用 `ProjectStatus` 已有套路（`parseFrontmatter` 读 status、`parseTasksFromMarkdown`+`attachTaskChildren` 读 task）。report 不引入第二套遍历逻辑。
- **计算与渲染分离**：core 只产出确定性数据对象（`GovernanceReportResult`），text/markdown 渲染在 CLI 层；`--json` 直接吐 core 数据。这样 MCP `lrnev_report` 与 CLI `--json` 天然同源、口径一致（F-04 验收）。
- **零副作用默认**：core 不写任何文件；落盘只在 CLI 显式 `--out <path>` 时发生，且路径由用户给定，绝不默认写 `.lrnev`。
- **快照而非监控**：一次遍历得出某刻结果，不订阅、不轮询、不调 LLM。

### 主要模块

- `src/core/GovernanceReport.ts`（新）：核心计算，产出 `GovernanceReportResult`。
- `src/types/governance-report.ts`（新）：结果类型定义。
- `src/cli/index.ts`（改）：加 `buildReportCommand`，加 text/markdown 渲染器与 `--out` 落盘；`GovernanceReport` 进 `createManagers` 工厂。
- `src/mcp/tools/index.ts`（改）：注册 `lrnev_report` 工具（返回 `--json` 等价结构）；`GovernanceReport` 进 MCP managers 工厂 + `TOOL_DESCRIPTIONS`。
- 复用：`TaskManager.parseTasksFromMarkdown` / `attachTaskChildren`、`SceneManager.list`、`parseFrontmatter`、`tryParseSpecParts`；锚点用 FILL-aware 提取（见 D-02）。

### 关键决策

<!-- 可选写法，不是哨兵：本 spec 有两处值得记 ADR 的取舍。 -->

| 决策 | 选项 | 倾向 | 是否产 ADR |
|------|------|------|-----------|
| report 数据来源 | A 复用 ProjectStatus 输出 / B 自扫 .lrnev 复用纯函数 | B（ProjectStatus 输出已为接手裁剪，缺 spec 全量 task_counts 之外的链路语义；自扫但复用 `parseTasksFromMarkdown` 等纯函数，既不重复 IO 逻辑又拿到全量） | 建议 ADR |
| 文本落盘 | A 默认写 .lrnev/reports / B 仅 --out 显式落盘 | B（派生物不污染治理真相目录，与"文件即真相"一致） | 建议 ADR |

### CLI/MCP 对等说明

S1 对等：CLI `report --json` 与 MCP `lrnev_report` 返回同一 `GovernanceReportResult`。差异仅在 CLI 多了 text/markdown 渲染与 `--out` 落盘这类"终端呈现"能力——MCP 侧消费方是 AI，只需结构化数据，不需要人读渲染，这与现有 `map`/`status` 的 CLI/MCP 差异同构，不算对等缺口。

## L2 详情

### 模块详细设计

<!-- 设计锚点：D-xx 与 requirements 的 F-xx 对称，供 task validates 引用。 -->

#### D-01 GovernanceReport 计算核心（对应 F-01 / F-02）

`class GovernanceReport { constructor(fs: FileStorage, scenes: SceneManager) }`，方法 `async build(input?: { releaseNotes?: boolean }): Promise<AiFollowupResponse<GovernanceReportResult>>`。

计算流程（一次遍历，纯确定性）：
1. `scenes = SceneManager.list()`，沿用 `GovernanceMap` 的空 00-default 过滤口径（`id===DEFAULT_SCENE_ID && spec_count===0 && !broken` 才排除）。
2. 对每个 scene：`fs.list('.lrnev/scenes/<id>/specs/*/requirements.md')`，逐 spec：
   - `parseFrontmatter` 读 `status`（缺省 'draft'）。
   - 读 tasks.md → `attachTaskChildren(parseTasksFromMarkdown(...))`，得全量 task（含状态）。
   - 锚点：读 requirements 的 `#### F-xx` + design 的 `#### D-xx`，**FILL-aware**（排除 `<!-- FILL:` 占位，见 D-02）。
   - 收集每个 task 的 `validates`（已是 `F-xx|D-xx` 数组）汇成 `validatedSet`。
3. **链路完整度（F-01）**：
   - 汇总 scene/spec/task 计数，每 scene 给 spec 数 + task 数。
   - "做完没收口"判定：`tasks.length>0 && 全部 status==='completed' && specStatus!=='completed' && specStatus!=='archived'` → 记入 `unclosed`，带 `done/total`、当前 status。
   - "在途"：specStatus ∈ {draft,in-progress} 且存在非 completed task（或零 task）→ 记入 `in_flight`。
4. **覆盖率（F-02）**：锚点总数、被 validatedSet 覆盖数、孤儿 = 锚点 − 覆盖；孤儿按所属 spec 状态分 `in_flight_orphans`（spec 未 completed，正常）与 `debt_orphans`（spec 已 completed 却有孤儿，真欠债）。
5. **一句话总结（F-04）**：`unclosed.length>0 || failedTaskCount>0` → 欠债概述；否则"整体健康"。确定性，无模型。
6. release notes 视图按 `input.releaseNotes` 触发（D-03），与体检共享上述遍历产物，不二次扫描。

失败/边界：无 `.lrnev` 或零 scene → 返回空 result + 友好 followup，不抛。`tasks.md` 不存在按零 task 处理（同 ProjectStatus）。

#### D-02 FILL-aware 锚点提取（对应 F-02）

`extractAnchorPool`（TaskManager 导出）**不排除 FILL 占位**，直接用会把未填写的 `#### F-01 <!-- FILL: 功能标题 -->` 计入锚点、虚增分母。GovernanceMap 已有私有 `anchorHeadings` 做了 FILL 过滤但只返回标题字符串、不返回 ID 集合。

方案：在 GovernanceReport 内用 FILL-aware 正则提取锚点 **ID 集合**（`^#### (F-\d+)\b` 且整行不含 `<!-- FILL:`）。与 `extractAnchorPool` 同正则家族，差异只在多一条 FILL 过滤；不改动 `extractAnchorPool` 本身（它服务 task 校验，校验语义不应受占位影响——校验是"引用的锚点在不在"，占位锚点本就不该被 validates 引用）。

#### D-03 release notes 视图（对应 F-03）

`report --release-notes`（或 `lrnev_report({ release_notes: true })`）走同一 `build({releaseNotes:true})`：在结果里附 `release_notes` 段——按 scene/spec 分组，仅含 `status==='completed'` 的 spec 及其 `status==='completed'` 的 task 标题。不依赖 git，纯文件态。空时给"暂无已完成项"友好提示而非报错。渲染为 markdown 列表（人复制即用）。

#### D-04 CLI report 命令 + 输出形态（对应 F-04）

新增 `buildReportCommand`：
- options：`--release-notes`、`--md`、`--json`、`--out <path>`。`--md`/`--json` 互斥（同时给报 INVALID_INPUT）。
- **绕过通用 `run()`**：现有 `run()` 强制 `format()`=JSON，无法出 text。report 用专用 action：调 `GovernanceReport.build()` 拿 result → 按形态选渲染（默认 `renderReportText`、`--md` `renderReportMarkdown`、`--json` `JSON.stringify`）→ 有 `--out` 则 `writeFile(path, rendered)` 且不再打 stdout（或同时回显，取保守：写文件 + stdout 提示"已写入 X"），无 `--out` 打 stdout。
- 全局 `--json` 与命令级 `--json` 二选一即可触发 json 形态（兼容现有 `--json` 习惯）。
- text 渲染器是 CLI 首个非 JSON 输出：纯字符串拼接（分隔线 + 缩进），无第三方依赖（NFR 零新依赖）。

#### D-05 MCP lrnev_report 工具（对应 F-04 对等）

`registerReportTools`：注册 `lrnev_report`，`inputSchema: { release_notes: z.boolean().optional() }`，`annotations.readOnlyHint=true`。body：`toToolResult(getManagers().governanceReport.build({ releaseNotes }))`。`TOOL_DESCRIPTIONS.lrnev_report` 描述"零模型治理体检 + release notes 草稿，返回结构化数据，等价 CLI report --json"。返回结构与 CLI `--json` 完全相同（同源 `build`）。

### 数据模型

```ts
// src/types/governance-report.ts
interface GovernanceReportSpec {
  scene: string; spec: string; name: string;
  status: SpecStatus;
  task_total: number;
  task_completed: number;
  anchors: number;        // FILL 过滤后
  anchors_covered: number;
  orphan_anchors: string[]; // 该 spec 内未被 validates 的 F-/D-
}
interface GovernanceReportChain {
  scene_count: number; spec_count: number; task_count: number;
  scenes: { scene: string; name: string; spec_count: number; task_count: number; empty: boolean }[];
  unclosed: { scene: string; spec: string; done: number; total: number; status: SpecStatus }[];
  in_flight: { scene: string; spec: string; status: SpecStatus }[];
}
interface GovernanceReportCoverage {
  anchor_total: number; anchor_covered: number; coverage_ratio: number; // 0..1
  in_flight_orphans: { scene: string; spec: string; anchors: string[] }[];
  debt_orphans: { scene: string; spec: string; anchors: string[] }[];
}
interface GovernanceReportReleaseNotes {
  scenes: { scene: string; name: string;
    specs: { spec: string; name: string; tasks: string[] }[] }[];
}
interface GovernanceReportResult {
  generated_at: string;
  headline: string;                 // 一句话总结（确定性）
  chain: GovernanceReportChain;
  coverage: GovernanceReportCoverage;
  release_notes?: GovernanceReportReleaseNotes; // 仅 releaseNotes=true 时
}
```

### 接口契约

- CLI：`lrnev report [--release-notes] [--md|--json] [--out <path>]`。
- MCP：`lrnev_report({ release_notes?: boolean })` → `GovernanceReportResult`。
- core：`GovernanceReport.build({ releaseNotes? }) → AiFollowupResponse<GovernanceReportResult>`。
- 不改动任何现有公共签名；仅新增。

### 错误处理

- `--md` 与 `--json` 同时给 → `LrnevError(INVALID_INPUT)`。
- `--out` 路径写入失败（目录不存在/无权限）→ 透传 fs 错误，包成结构化 error 输出，不静默吞。
- 无 `.lrnev`/空工作区 → 返回空但合法的 result（计数全 0、headline="整体健康（暂无 spec）"），不抛。
- core 计算内的单 spec 解析异常（坏 frontmatter 等）→ 跳过该 spec 并在 followup 里提示，不让整份报告崩（与 ProjectStatus 容错口径一致）。

### 测试策略

- 单元（core）：用临时工作区构造"做完没收口"spec（task 全 completed + status=draft）→ 断言进 `unclosed`；构造孤儿锚点（F-01 无 validates）按 spec 状态分 `in_flight_orphans`/`debt_orphans`；FILL 占位锚点不计入分母；空工作区返回健康 headline；release_notes 仅含 completed。
- 单元（渲染）：text/markdown 渲染快照；`--md` 与 `--json` 互斥报错。
- e2e（CLI）：真实临时工作区跑 `report` 默认 text、`--json` 可 JSON.parse、`--md --out X` 落盘且无 --out 不产文件、`--release-notes` 出分组清单。
- e2e（对等）：MCP `lrnev_report` 与 CLI `--json` 数据深相等（沿用现有 cli-mcp 对等测试套路）。
- 全量 `npm test` 绿；零新运行时依赖。
