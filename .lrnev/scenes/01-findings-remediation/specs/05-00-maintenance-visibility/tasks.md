---
spec: '05-00-maintenance-visibility'
scene: '01-findings-remediation'
created: '2026-06-11'
---

# 05-00 Maintenance Visibility - 任务清单

> 任务由 lrnev `task_create` 工具创建，不要手编。
> 状态机：pending → in_progress → completed / failed；blocked 可回 in_progress；failed 可回 pending 重试。

## 阶段 1

<!-- FILL: 使用 task_create 追加任务；任务会以 `### T-XXX 标题 <!-- lrnev-task: ... -->` 形式追加到这里 -->

## 验收标准（整体）

- <!-- FILL: 按本 Spec 调整整体验收清单 -->
- [ ] 所有任务完成
- [ ] 单元测试通过
- [ ] 集成测试通过

### T-001 显式 doctor --gc-agents 清 dead 且无活跃 claim 的 agent <!-- lrnev-task: status=completed, created=2026-06-12T00:53:33.028Z, updated=2026-06-12T08:05:59.622Z, validates=F-01|D-01 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-06-12T06:55:22.044Z"},{"from":"in_progress","to":"completed","at":"2026-06-12T08:05:59.622Z"}] -->

**验收**：
- dead无claim→清;dead持claim→留;active→不动
- list/register无新副作用

### T-002 ADR list/get 读时计算 superseded_by(不回写旧ADR) <!-- lrnev-task: status=completed, created=2026-06-12T00:53:33.548Z, updated=2026-06-12T08:06:00.617Z, validates=F-02|D-02 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-06-12T08:05:59.902Z"},{"from":"in_progress","to":"completed","at":"2026-06-12T08:06:00.617Z"}] -->

**验收**：
- get旧ADR含superseded_by且文件未改
- list被取代项带标注
