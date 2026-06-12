---
spec: '07-00-governance-boundary-docs'
scene: '01-findings-remediation'
created: '2026-06-11'
---

# 07-00 Governance Boundary Docs - 任务清单

> 任务由 lrnev `task_create` 工具创建，不要手编。
> 状态机：pending → in_progress → completed / failed；blocked 可回 in_progress；failed 可回 pending 重试。

## 阶段 1

<!-- FILL: 使用 task_create 追加任务；任务会以 `### T-XXX 标题 <!-- lrnev-task: ... -->` 形式追加到这里 -->

## 验收标准（整体）

- <!-- FILL: 按本 Spec 调整整体验收清单 -->
- [ ] 所有任务完成
- [ ] 单元测试通过
- [ ] 集成测试通过

### T-001 文档化三条治理边界 I-9/13/14(含error_search工具描述) <!-- lrnev-task: status=completed, created=2026-06-12T00:53:34.100Z, updated=2026-06-12T08:18:29.225Z, validates=F-01|D-01 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-06-12T08:06:35.568Z"},{"from":"in_progress","to":"completed","at":"2026-06-12T08:18:29.225Z"}] -->

**验收**：
- 文档含完整ID/标题契约/error_search原文检索说明
- docs/tool-description测试同步通过

### T-002 复核修复:error_search无结果时followup提示用原文关键词 <!-- lrnev-task: status=completed, created=2026-06-12T09:32:09.465Z, updated=2026-06-12T09:46:35.645Z, validates=F-01|D-01 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-06-12T09:46:35.093Z"},{"from":"in_progress","to":"completed","at":"2026-06-12T09:46:35.645Z"}] -->
