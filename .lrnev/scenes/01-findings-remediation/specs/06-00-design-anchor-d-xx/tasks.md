---
spec: '06-00-design-anchor-d-xx'
scene: '01-findings-remediation'
created: '2026-06-11'
---

# 06-00 Design Anchor D Xx - 任务清单

> 任务由 lrnev `task_create` 工具创建，不要手编。
> 状态机：pending → in_progress → completed / failed；blocked 可回 in_progress；failed 可回 pending 重试。

## 阶段 1

<!-- FILL: 使用 task_create 追加任务；任务会以 `### T-XXX 标题 <!-- lrnev-task: ... -->` 形式追加到这里 -->

## 验收标准（整体）

- <!-- FILL: 按本 Spec 调整整体验收清单 -->
- [ ] 所有任务完成
- [ ] 单元测试通过
- [ ] 集成测试通过

### T-001 确立 D-xx 锚点规范+更新 design 模板与文档 <!-- lrnev-task: status=completed, created=2026-06-11T10:49:33.782Z, updated=2026-06-12T04:08:59.865Z, validates=F-01|D-01 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-06-12T03:56:29.661Z"},{"from":"in_progress","to":"completed","at":"2026-06-12T04:08:59.865Z"}] -->

**验收**：
- design.md.tmpl 加 #### D-xx 示范
- GOVERNANCE-FLOW 补锚点体系说明

### T-002 validates 格式校验:只认F-xx/D-xx,design#和自由串硬拒 <!-- lrnev-task: status=completed, created=2026-06-11T10:49:34.253Z, updated=2026-06-12T05:37:32.711Z, validates=F-02|D-02 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-06-12T04:09:00.388Z"},{"from":"in_progress","to":"completed","at":"2026-06-12T05:37:32.711Z"}] -->

**验收**：
- design#3.2→INVALID_INPUT(废弃)
- 自由串→INVALID_INPUT
- F-xx/D-xx→进入存在性校验

### T-003 F-xx/D-xx 存在性硬校验(复用S2 assertReferenceExists) <!-- lrnev-task: status=completed, created=2026-06-11T10:49:34.718Z, updated=2026-06-12T05:37:33.858Z, validates=F-03|D-03 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-06-12T05:37:33.044Z"},{"from":"in_progress","to":"completed","at":"2026-06-12T05:37:33.858Z"}] -->

**验收**：
- F-99不在requirements→ANCHOR_NOT_FOUND
- D-99不在design→ANCHOR_NOT_FOUND
- 都存在→通过

### T-004 清理仓库内 design#3.2 例子为 D-xx + doctor 检测存量坏锚点 <!-- lrnev-task: status=completed, created=2026-06-11T10:49:35.213Z, updated=2026-06-12T05:37:34.636Z, validates=F-04|D-04 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-06-12T05:37:34.176Z"},{"from":"in_progress","to":"completed","at":"2026-06-12T05:37:34.636Z"}] -->

**验收**：
- 全仓无design#3.2推荐示例
- doctor列出坏锚点不自动迁移

### T-005 S6 产 ADR(validates去自由字符串化)+全量测试 <!-- lrnev-task: status=completed, created=2026-06-11T10:49:35.725Z, updated=2026-06-12T05:40:23.509Z, validates=D-02 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-06-12T05:37:34.920Z"},{"from":"in_progress","to":"completed","at":"2026-06-12T05:40:23.509Z"}] -->

**验收**：
- adr_create沉淀为什么收紧
- 改现有design#3.2测试为D-02且design有#### D-02
- npm test全绿

### T-006 复核修复:update路径validates软提醒+spec口径修订(create硬拒/存量提示) <!-- lrnev-task: status=completed, created=2026-06-12T09:32:07.637Z, updated=2026-06-12T09:46:33.719Z, validates=F-02|D-02 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-06-12T09:32:31.396Z"},{"from":"in_progress","to":"completed","at":"2026-06-12T09:46:33.719Z"}] -->

**验收**：
- update时现有task含坏锚点→followup警告不阻断
- requirements口径修订
