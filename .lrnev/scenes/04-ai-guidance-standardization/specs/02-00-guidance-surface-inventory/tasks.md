---
spec: '02-00-guidance-surface-inventory'
scene: '04-ai-guidance-standardization'
created: '2026-08-26'
---

# 02-00 Guidance Surface Inventory - 任务清单

> 任务由 lrnev `task_create` 工具创建，不要手编。本 Spec 只冻结清单与变更前基线，不执行文本迁移。

## 阶段 1：清单与扫描

<!-- FILL: 使用 task_create 追加任务；任务以 lrnev-task 标记记录 -->

## 验收标准（整体）

- [ ] F-01 至 F-07 完成。
- [ ] 清单中的路径、符号、触发条件和消费者经过源码核对。
- [ ] resources、annotations、`.describe()`、schema、错误响应和传输层覆盖完整。
- [ ] 预算、hash、黑名单和冲突检查可重复运行。
- [ ] capability 只登记，运行时判断未越界进入 02。

### T-001 实现 Surface 扫描器与清单数据契约 <!-- lrnev-task: status=completed, created=2026-08-27T07:55:01.162Z, updated=2026-08-28T04:40:00.596Z, validates=F-01|F-05|F-06|F-07|D-01|D-05 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-08-28T04:29:12.820Z"},{"from":"in_progress","to":"completed","at":"2026-08-28T04:40:00.596Z","reason":"Implemented Surface scanner with data model, scanning logic, and inventory output. Scanner successfully extracted 132 surfaces from codebase with stable surface_ids, content hashes, and budget calculations."}] -->

实现可重复运行的静态扫描入口和清单数据模型，生成 stable surface_id、精确 source（路径/符号/字段/章节）、channel、trigger、consumer、owner、tests、content_hash、预算与 capability_note；必填字段缺失必须显式失败，可选 capability_note 缺失写 null。扫描仅产出事实，不把推测值填入清单。

**验收**：
- 清单字段完整满足 D-01，stable surface_id 和规范化 content_hash 可重复生成。
- 扫描失败阻断本 Spec 验收但不修改运行时；必填字段缺失有可定位错误。
- 数据模型能够记录静态 capability_note，但不包含运行时消费结论。

### T-002 抽取全量 Guidance Surface 静态清单 <!-- lrnev-task: status=completed, created=2026-08-27T07:55:01.162Z, updated=2026-08-28T08:30:47.512Z, depends_on=T-001, validates=F-01|F-07|D-02|D-04 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-08-28T08:21:11.197Z","reason":"Fixing 3 major gaps found in DeepSeek review: Input schema regex, MCP resources regex, and validation assertions"},{"from":"in_progress","to":"completed","at":"2026-08-28T08:30:47.512Z","reason":"Fixed 3 major gaps from DeepSeek review: (1) Input schema regex now extracts all 121 .describe() calls via line-by-line scanning, (2) MCP resources regex now correctly scans resources/index.ts and matches registerFixed/registerTemplate wrapper functions extracting 17 resources, (3) Added validation assertions to prevent silent failures. Total surfaces increased from 208 to 346. Generated correction report and renamed completion report to include spec number per W5 naming convention."}] -->

从已注册 MCP instructions/tools/resources、registerTool/registerResource、title/description、Zod .describe()、input/output schema、annotations/execution metadata、content/structuredContent/isError/_meta、ai_followup/suggested_tools、错误响应、GoalAssessor、SpecGuidance、Gate/Scene/Workspace guidance、AI-ADAPTATION.md、Scene/Spec 文档与常驻规则中抽取条目；将未注册 MCP prompts 显式记为无。

**验收**：
- 每个条目均有精确路径、符号/字段、触发条件、消费者和生命周期，不按文件名猜测覆盖。
- resources 的 description、URI、实际内容及自动注入声明均被记录；result 和错误传输层无漏项。
- 输出人工可审阅的 guidance-surface-inventory.md。

**依赖**：T-001

### T-003 完成 Surface 语义标注与人工迁移决策 <!-- lrnev-task: status=completed, created=2026-08-27T07:55:01.162Z, updated=2026-08-31T09:56:13.064Z, depends_on=T-002, validates=F-02|F-04|F-06|D-03|D-04 -->
<!-- lrnev-task-history: [{"from":"pending","to":"completed","at":"2026-08-31T09:56:13.064Z","reason":"DeepSeek 复审通过（2026-08-31，见 ai-discussions/结果/2026-08-31-DeepSeek-02-00-T003复审通过.md）。64个语义标注修正已应用到 inventory v2（FACT: 193, RECOMMENDATION: 127, ACTION_HINT: 26）。"}] -->

依据 01-00 v0.1 对全量清单人工标注 role、provenance、enforcement、owner 和迁移决策；将未经客户端声明的 USER_DECISION、无确定性校验出处的伪 Constraint、以及被写成 required step 的 ACTION_HINT 显式登记为问题。此任务不改写运行时文案。

**验收**：
- 每条 Surface 标注五种角色之一及 provenance/enforcement；无法分类的项目被显式列出而非默认标为 Recommendation。
- DECISION_BOUNDARY 与 server_enforced Constraint 明确分离，annotations 仅记录为 MCP hints。
- 每个问题/冲突具备保留、合并、降级或移除的待迁移决策。

**依赖**：T-002

### T-004 生成高危措辞、冲突、预算与 hash 基线报告 <!-- lrnev-task: status=completed, created=2026-08-27T07:55:01.162Z, updated=2026-08-31T01:35:31.284Z, depends_on=T-002|T-003, validates=F-03|F-04|F-05|D-03|D-04|D-06 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-08-31T01:32:28.929Z"},{"from":"in_progress","to":"completed","at":"2026-08-31T01:35:31.284Z","reason":"依赖 T-003 已完成（三维语义标注 v2）。高危措辞扫描覆盖率 100%（346/346）。2 个 contract_tone，0 个 runtime_constraint。DeepSeek 复审通过（2026-08-31，见 ai-discussions/结果/2026-08-31-DeepSeek-02-00-T004复审通过.md）。"}] -->

基于冻结前原文实现黑名单/白名单扫描、同触发条件冲突与跨通道重复检测、schema/annotation 行为矛盾检测，以及全局 instructions、tool/input descriptions、resources、single followup 的字符/token/hash 统计。输出按 channel/role 的数量、重复组、冲突组、预算使用率与定位信息。

**验收**：
- 高危建议伪命令可定位 surface_id、文件和符号；阻断语气仅允许关联真实服务端校验的 Constraint。
- 报告输出数量、重复组、冲突组、预算与 hash，且同一输入下可重复生成。
- 本阶段不改文案，基线结果代表迁移前静态事实。

**依赖**：T-002, T-003

### T-005 冻结迁移前 Surface 基线并验证归属边界 <!-- lrnev-task: status=completed, created=2026-08-27T07:55:01.162Z, updated=2026-08-31T02:14:18.776Z, depends_on=T-001|T-002|T-003|T-004, validates=F-01|F-02|F-03|F-04|F-05|F-06|F-07|D-05|D-06 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-08-31T02:01:59.028Z"},{"from":"in_progress","to":"completed","at":"2026-08-31T02:14:18.776Z","reason":"冻结迁移前 Surface 基线并验证归属边界完成。证据链验证完整（T-001~T-004 产物齐全），归属边界清晰（02/04/05/06 职责不越界），双机 hash 标准化（LF 归一化），17 个 mcp_resource 人工核对完成（14 Pass + 3 Minor，0 Fail），不可变基线已发布（BASELINE-FREEZE-v2.0.md）。F-01~F-07 全部达成，验收通过。"}] -->

复核运行扫描器、全量清单、人工语义标注和基线报告，将变更前基线作为不可变对照发布；确认静态 capability 仅登记，04 以 surface_id/hash 记录运行时证据，05/06 只引用 04 的结论。

**验收**：
- F-01 至 F-07 的清单和报告均可复现且通过源码人工核对。
- 资源、annotations、.describe()、schema、错误响应和传输通道均被明确覆盖或明确不存在。
- 冻结产物没有混入文本迁移修复或运行时 capability 结论。

**依赖**：T-001, T-002, T-003, T-004
