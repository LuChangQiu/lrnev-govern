---
spec: '02-00-deterministic-hard-checks'
scene: '01-findings-remediation'
created: '2026-06-11'
---

# 02-00 Deterministic Hard Checks - 任务清单

> 任务由 lrnev `task_create` 工具创建，不要手编。
> 状态机：pending → in_progress → completed / failed；blocked 可回 in_progress；failed 可回 pending 重试。

## 阶段 1

<!-- FILL: 使用 task_create 追加任务；任务会以 `### T-XXX 标题 <!-- lrnev-task: ... -->` 形式追加到这里 -->

## 验收标准（整体）

- <!-- FILL: 按本 Spec 调整整体验收清单 -->
- [ ] 所有任务完成
- [ ] 单元测试通过
- [ ] 集成测试通过

### T-001 completion gate 硬拦 requirements/design FILL <!-- lrnev-task: status=pending, created=2026-06-11T10:48:25.806Z, validates=F-01|D-01 -->

**验收**：
- requirements 有FILL→completion fail
- design 有FILL→fail
- 均无+任务全完→pass(tasks.md FILL不影响)

### T-002 summarize_save 拒绝为不存在目标建孤儿摘要 <!-- lrnev-task: status=pending, created=2026-06-11T10:48:26.514Z, validates=F-02|D-02 -->

**验收**：
- 不存在spec URI→报错且磁盘无新文件
- 真实URI→正常写入

### T-003 task_create 拒绝指向不存在 task 的 depends_on <!-- lrnev-task: status=pending, created=2026-06-11T10:48:27.039Z, validates=F-03|D-03 -->

**验收**：
- depends_on含不存在id→TASK_NOT_FOUND且未创建
- 有效依赖→正常

### T-004 S2 回归:抽共用引用存在性工具+全量测试 <!-- lrnev-task: status=pending, created=2026-06-11T10:48:27.544Z, validates=D-03 -->

**验收**：
- 抽assertReferenceExists供S6复用
- npm test 全绿无回归
