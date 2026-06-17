---
spec: '01-00-maintenance-flow-and-review-gate'
scene: '02-context-delivery'
created: '2026-06-15'
---

# 01-00 维护态流程 + 需求审核门 + 任务启动上下文 - 任务清单

> 任务由 lrnev `task_create` 工具创建，不要手编。
> 状态机：pending → in_progress → completed / failed；blocked 可回 in_progress；failed 可回 pending 重试。
> 注：本批任务因 MCP 当前 root 指向旧树，由 AI 按 lrnev 任务块格式手写到本树；root 切回后可用 task_list / doctor 校验。

## 验收标准（整体）

- [x] F-01~F-04 全部实现并各自单测通过
- [x] CLI `task update` / `task claim` 与对应 MCP 工具的 `anchor_context` 字段对等
- [x] 不改 gate 判定 / 状态机 / API；`npm test` 全绿无回归（610 passed）
- [x] 所有任务完成

## 任务

### T-001 抽出 extractAnchorSections 共享锚点抽段工具 + 单测 <!-- lrnev-task: status=completed, created=2026-06-15T08:00:00.000Z, updated=2026-06-16T00:52:00.000Z, validates=D-03 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-06-16T00:45:00.000Z"},{"from":"in_progress","to":"completed","at":"2026-06-16T00:52:00.000Z"}] -->

新增 `extractAnchorSections(content, prefix)`：返回 `#### F-xx` / `#### D-xx` 标题到下一同级或更高级标题之间的正文，ID→段落映射。与 `extractAnchorPool`（TaskManager.ts:527）同正则家族，导出供 task 回填（F-03）与 02-00 定位升级复用。

**验收**：
- F-xx/D-xx 段落正确切到下一同级标题边界
- 文档缺锚点 / 多锚点 / 末尾锚点 均正确
- 不复用 S6 的 IO，只复用定位逻辑

### T-002 anchor_context 字段 + task_update(in_progress) 回填 <!-- lrnev-task: status=completed, created=2026-06-15T08:01:00.000Z, updated=2026-06-16T01:00:00.000Z, validates=F-03|D-03 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-06-16T00:55:00.000Z"},{"from":"in_progress","to":"completed","at":"2026-06-16T01:00:00.000Z"}] -->

`AiFollowupResponse` 顶层新增可选 `anchor_context: {anchor,source,text,truncated}[]`；`TaskManager.update` 在 in_progress 且有 validates 时按 F-/D- 裁剪读取文档、抽段、截断（段 ~400 / 总 ~1200 / D-xx 首行）、置字段；无 validates 走降级链（L0/L1 摘要 → 现有文案）。followup 保留"回看原文"。

**验收**：
- validates=F-01 时顶层含 anchor_context，内有 F-01 的 requirements 段落，<400 字时 truncated=false
- 含 D-xx 时只回首行 + 标题；超长段 truncated=true
- 无 validates 不回空 anchor_context，走降级链

**依赖**：T-001

### T-003 task_claim 回填 anchor_context + 补漂移检测（堵旁路） <!-- lrnev-task: status=completed, created=2026-06-15T08:02:00.000Z, updated=2026-06-16T01:06:00.000Z, validates=F-03|D-03 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-06-16T01:02:00.000Z"},{"from":"in_progress","to":"completed","at":"2026-06-16T01:06:00.000Z"}] -->

`TaskManager.claim` 组装同款 `anchor_context`（claim 不走 update，不堵就漏）；claim 当前不算 badAnchors，补同款漂移软告警；漂移降级扩 `findBadValidatesAnchors` / `badAnchorWarning` 覆盖两入口，锚点找不到点名告警、不报错、不阻断。

**验收**：
- task_claim 成功且有 validates 时返回与 update 同样的 anchor_context
- 锚点在文档找不到 → followup 点名告警、不阻止 claim
- update 与 claim 两入口抽段结果一致

**依赖**：T-001

### T-004 需求审核门：ready gate passed 时 followup 强制停 <!-- lrnev-task: status=completed, created=2026-06-15T08:03:00.000Z, updated=2026-06-16T01:10:00.000Z, validates=F-02|D-02 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-06-16T01:08:00.000Z"},{"from":"in_progress","to":"completed","at":"2026-06-16T01:10:00.000Z"}] -->

`buildPassedGateFollowup`（src/mcp/tools/index.ts）的 `gate==='ready'` 分支 instructions 追加"请暂停，把 requirements.md 展示给用户确认后再继续……如用户说'直接做'则跳过"；completion / creation 分支不动。

**验收**：
- spec_gate_check(gate=ready) 返回 passed=true 时 followup 含"请暂停"与"展示 requirements.md 给用户确认"
- completion / creation 的 followup 不受影响
- 用户说"直接做"时不阻断（followup 引导）

### T-005 分流铺显：spec_create 四路 + task_create completed 回退提示 + 常驻文案 <!-- lrnev-task: status=completed, created=2026-06-15T08:04:00.000Z, updated=2026-06-16T01:18:00.000Z, validates=F-01|F-04|D-01 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-06-16T01:12:00.000Z"},{"from":"in_progress","to":"completed","at":"2026-06-16T01:18:00.000Z"}] -->

`SpecManager.create` followup 追加四路分流 + "先 context_search 落位"；`TaskManager.create` 新增分支：spec 为 completed 时追加回退提示（只补 create 入口，update 入口已有）；`guidance.ts` 分流摘要从二元改四路，并同步 `docs/AI-ADAPTATION.md` 的常驻提示词模板片段（产品不持有 CLAUDE.md，该片段供用户贴入自己的 CLAUDE.md）。

**验收**：
- spec_create followup 含四路边界判断指引（有域 scene / 00-default / 落位 / 不开）
- completed spec 上 task_create 的 followup 含状态回退提示
- lrnev_guide / 常驻文案分流为四路；落位加 task 不触发 F-02 审核门

### T-006 CLI/MCP 对等校验 + 全量回归 <!-- lrnev-task: status=completed, created=2026-06-15T08:05:00.000Z, updated=2026-06-16T01:30:00.000Z, validates=F-03 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-06-16T01:20:00.000Z"},{"from":"in_progress","to":"completed","at":"2026-06-16T01:30:00.000Z"}] -->

确认 CLI `task update` / `task claim` 的 JSON 输出与对应 MCP 工具含同一 `anchor_context`；补集成测试；`npm test` 全绿。

**验收**：
- CLI JSON 与 MCP 返回的 anchor_context 同构
- 新增测试覆盖，无回归

**依赖**：T-002, T-003
