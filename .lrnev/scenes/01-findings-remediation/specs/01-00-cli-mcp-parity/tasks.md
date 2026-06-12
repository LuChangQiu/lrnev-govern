---
spec: '01-00-cli-mcp-parity'
scene: '01-findings-remediation'
created: '2026-06-11'
---

# 01-00 Cli Mcp Parity - 任务清单

> 任务由 lrnev `task_create` 工具创建，不要手编。
> 状态机：pending → in_progress → completed / failed；blocked 可回 in_progress；failed 可回 pending 重试。

## 阶段 1

<!-- FILL: 使用 task_create 追加任务；任务会以 `### T-XXX 标题 <!-- lrnev-task: ... -->` 形式追加到这里 -->

## 验收标准（整体）

- <!-- FILL: 按本 Spec 调整整体验收清单 -->
- [ ] 所有任务完成
- [ ] 单元测试通过
- [ ] 集成测试通过

### T-001 spec_get 开新版引导下沉 core,CLI/MCP 共用 <!-- lrnev-task: status=pending, created=2026-06-12T00:52:52.871Z, validates=F-01|D-01 -->

**验收**：
- 已实现spec CLI spec get 含开新版引导
- 未实现spec不追加(零噪音)

### T-002 CLI task create 加 --depends-on(不删allowUnknownOption+回归) <!-- lrnev-task: status=pending, created=2026-06-12T00:52:53.437Z, validates=F-02|D-02 -->

**验收**：
- --depends-on被解析进depends_on
- dash-title标题不回归

### T-003 CLI adr create 加 --supersedes(core已支持纯透传) <!-- lrnev-task: status=pending, created=2026-06-12T00:52:54.037Z, validates=F-03|D-03 -->

**验收**：
- --supersedes写入新ADR
