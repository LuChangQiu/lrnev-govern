---
spec: '03-00-reference-soft-reminders'
scene: '01-findings-remediation'
created: '2026-06-11'
---

# 03-00 Reference Soft Reminders - 任务清单

> 任务由 lrnev `task_create` 工具创建，不要手编。
> 状态机：pending → in_progress → completed / failed；blocked 可回 in_progress；failed 可回 pending 重试。

## 阶段 1

<!-- FILL: 使用 task_create 追加任务；任务会以 `### T-XXX 标题 <!-- lrnev-task: ... -->` 形式追加到这里 -->

## 验收标准（整体）

- <!-- FILL: 按本 Spec 调整整体验收清单 -->
- [ ] 所有任务完成
- [ ] 单元测试通过
- [ ] 集成测试通过

### T-001 depends_on 依赖未完成时 in_progress 软提醒 <!-- lrnev-task: status=completed, created=2026-06-12T00:52:54.531Z, updated=2026-06-12T06:32:08.082Z, validates=F-01|D-01 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-06-12T06:22:04.610Z"},{"from":"in_progress","to":"completed","at":"2026-06-12T06:32:08.082Z"}] -->

**验收**：
- 前置pending→followup提醒且状态成功
- 前置全completed→无提醒

### T-002 父任务带未完成子任务标completed时软提醒 <!-- lrnev-task: status=completed, created=2026-06-12T00:52:55.017Z, updated=2026-06-12T06:32:09.115Z, validates=F-02|D-02 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-06-12T06:32:08.525Z"},{"from":"in_progress","to":"completed","at":"2026-06-12T06:32:09.115Z"}] -->

**验收**：
- 子pending标父completed→提醒N个未完成
- 子全完→无提醒

### T-003 S3 全量测试回归 <!-- lrnev-task: status=completed, created=2026-06-12T00:52:55.513Z, updated=2026-06-12T06:32:10.220Z, validates=D-01 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-06-12T06:32:09.389Z"},{"from":"in_progress","to":"completed","at":"2026-06-12T06:32:10.220Z"}] -->

**验收**：
- npm test全绿,两处不阻断
