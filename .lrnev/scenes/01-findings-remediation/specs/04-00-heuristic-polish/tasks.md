---
spec: '04-00-heuristic-polish'
scene: '01-findings-remediation'
created: '2026-06-11'
---

# 04-00 Heuristic Polish - 任务清单

> 任务由 lrnev `task_create` 工具创建，不要手编。
> 状态机：pending → in_progress → completed / failed；blocked 可回 in_progress；failed 可回 pending 重试。

## 阶段 1

<!-- FILL: 使用 task_create 追加任务；任务会以 `### T-XXX 标题 <!-- lrnev-task: ... -->` 形式追加到这里 -->

## 验收标准（整体）

- <!-- FILL: 按本 Spec 调整整体验收清单 -->
- [ ] 所有任务完成
- [ ] 单元测试通过
- [ ] 集成测试通过

### T-001 in_progress 并行提示改为弱信号有条件(子任务不提) <!-- lrnev-task: status=pending, created=2026-06-12T00:53:31.989Z, validates=F-01|D-01 -->

**验收**：
- 小任务/子任务不含并行提示
- 大任务含

### T-002 assess_goal kind 与 reasons 一致(强多特性升multi-spec) <!-- lrnev-task: status=pending, created=2026-06-12T00:53:32.534Z, validates=F-02|D-02 -->

**验收**：
- 枚举5项→multi-spec-program
- 单一小改动→single-spec
