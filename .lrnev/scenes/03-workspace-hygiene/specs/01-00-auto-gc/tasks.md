---
spec: '01-00-auto-gc'
scene: '03-workspace-hygiene'
created: '2026-07-06'
---

# 01-00 Auto Gc - 任务清单

> 任务由 lrnev `task_create` 工具创建，不要手编。
> 状态机：pending → in_progress → completed / failed；blocked 可回 in_progress；failed 可回 pending 重试。

## 阶段 1

<!-- FILL: 使用 task_create 追加任务；任务会以 `### T-XXX 标题 <!-- lrnev-task: ... -->` 形式追加到这里 -->

## 验收标准（整体）

- <!-- FILL: 按本 Spec 调整整体验收清单 -->
- [ ] 所有任务完成
- [ ] 单元测试通过
- [ ] 集成测试通过

### T-001 config：agent.auto_gc / gc_retention_days + 实现处防御回退 <!-- lrnev-task: status=completed, created=2026-07-06T08:33:21.424Z, updated=2026-07-06T08:38:21.736Z, validates=F-04|D-04 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-07-06T08:37:27.928Z"},{"from":"in_progress","to":"completed","at":"2026-07-06T08:38:21.736Z"}] -->

**验收**：
- 默认 auto_gc=true、gc_retention_days=7
- 非正数/NaN 静默按 7 处理
- doctor --gc-agents 不读新配置

### T-002 core：register 锁内 GC 清扫（registry+claims+status 回写，禁用 unregisterAndReleaseClaims） <!-- lrnev-task: status=completed, created=2026-07-06T08:33:22.537Z, updated=2026-07-06T08:49:49.915Z, depends_on=T-001, validates=F-01|F-02|F-03|F-06|D-01|D-02|D-03 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-07-06T08:38:23.616Z"},{"from":"in_progress","to":"completed","at":"2026-07-06T08:49:49.915Z"}] -->

**验收**：
- 本机 pid 判死立即清、跨主机超保留期清、dead 持未过期 claim 保留
- claim 删除按 claimLockPath 取锁重读判据
- 幸存条目 status 回写计算真值
- GC 异常不影响注册主流程
- 与注册写合并为单次 saveRegistry

**依赖**：T-001

### T-003 返回契约：AgentRegisterResult 新类型 + gc 字段 MCP/CLI 对等透传 <!-- lrnev-task: status=completed, created=2026-07-06T08:33:23.658Z, updated=2026-07-06T08:50:18.582Z, depends_on=T-002, validates=F-05|D-05 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-07-06T08:50:16.943Z"},{"from":"in_progress","to":"completed","at":"2026-07-06T08:50:18.582Z"}] -->

**验收**：
- 落盘仍写纯 AgentInfo（gc 不进 registry.json）
- 有清理才出现 gc 字段且计数准确
- followup instructions 无 GC 文案
- CLI --json 同构

**依赖**：T-002

### T-004 测试全套与回归全绿 <!-- lrnev-task: status=completed, created=2026-07-06T08:33:25.247Z, updated=2026-07-06T08:50:22.814Z, depends_on=T-003, validates=F-01|F-02|F-03|F-04|F-05|F-06 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-07-06T08:50:20.600Z"},{"from":"in_progress","to":"completed","at":"2026-07-06T08:50:22.814Z"}] -->

**验收**：
- 伪造 xpaas 式残留的集成用例：register 一次后终态断言
- auto_gc=false 行为与 v2.2 一致
- doctor --gc-agents 与 e2e stdio 生命周期既有测试不动
- 全量套件全绿

**依赖**：T-003

### T-005 文档同步：MULTI-AGENT / README 工作区树 / GOVERNANCE-FLOW + CHANGELOG 条目 <!-- lrnev-task: status=completed, created=2026-07-06T08:33:26.669Z, updated=2026-07-06T09:35:48.524Z, depends_on=T-004 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-07-06T08:49:56.006Z"},{"from":"in_progress","to":"completed","at":"2026-07-06T09:35:48.524Z"}] -->

docs/MULTI-AGENT.md 补自动 GC 行为、status 语义、两个配置项与 doctor --gc-agents 分工；README .lrnev 目录树注释同步（agents/registry.json、runtime/claims）；docs/GOVERNANCE-FLOW.md 如提 claim/agent 语义则同步；CHANGELOG 新版本 Added 条目含升级指南（默认开、如何关闭）；README 测试计数刷新

**验收**：
- 所有提及 registry/claim/agent 存活的用户文档与新行为一致
- CHANGELOG 条目完整含关闭方法

**依赖**：T-004
