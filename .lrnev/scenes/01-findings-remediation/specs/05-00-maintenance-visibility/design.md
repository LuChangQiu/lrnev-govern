---
spec: '05-00-maintenance-visibility'
scene: '01-findings-remediation'
created: '2026-06-11'
---

# 05-00 Maintenance Visibility - 设计

## L0 摘要

新增显式 dead-agent GC 维护命令（只清 dead 且无活跃 claim，绝不在只读路径自动删），并让 ADR list/get 读时反向计算 superseded_by（不回写旧 ADR 文件）。

## L1 概览

### 架构思路

- GC 是显式维护动作：只读路径（agent_list/register）零写副作用；清理走专门命令，可审计、可控。
- superseded_by 是读时派生视图：基于全部 ADR 的 supersedes 反向映射，不动历史文件，保可追溯。

### 主要模块

- `src/core/Doctor.ts`（仿 `migrateTodosToSentinels` 加 `gcAgents`）+ `src/core/AgentRegistry.ts`（复用 loadRegistry/computeAgentStatus/unregisterAndReleaseClaims）+ `ClaimStore`（活跃 claim 判定）。
- `src/core/ADRManager.ts`：`list`(85) / `get`(98) 返回时计算 superseded_by。
- CLI/MCP：暴露 `doctor --gc-agents`（或 `agent gc`）入口。

### 关键决策

| 决策 | 选项 | 倾向 | 是否产 ADR |
|------|------|------|-----------|
| GC 触发 | (a)显式命令 (b)list/register 自动 | **(a)显式** | 否 |
| register 同 id 旧记录 | 保持现状（register 本就覆盖同 id），不额外处理 | 现状 | 否 |
| superseded_by | 读时计算，不回写旧 ADR 文件 | 读时算 | 否 |
| GC 命令落点 | `doctor --gc-agents`（仿 migrate 入口） | doctor 子命令 | 否 |

> 复用结论：AgentRegistry 已有 loadRegistry / computeAgentStatus / unregisterAndReleaseClaims；ADR frontmatter 已存 supersedes（`ADRManager.ts:121`）。两处都不需要新增持久化字段。

## L2 详情

### 模块详细设计

> 本段用 `#### D-xx` 标注设计锚点（供 task --validates 引用）。

#### D-01 显式 GC dead agent
- Doctor 增 `gcAgents()`：loadRegistry → 对每个 agent 算 `computeAgentStatus`；仅当 dead **且** 该 agent 名下无活跃（未过期、未被判可接手）claim（查 ClaimStore）时，从 registry 删除；返回被清理 agent 列表。
- CLI `doctor --gc-agents`（与现有 `--migrate-todos` 同风格的互斥/独立 flag）；MCP 暴露对等参数/工具。
- **不改** agent_list / agent_register 行为（只读无副作用；register 保持覆盖同 id 的固有写语义）。

#### D-02 ADR 读时计算 superseded_by
- `ADRManager.list`：读全部 ADR 后，构建“被取代映射”——遍历每条的 `supersedes`，反向得出每条的 `superseded_by`（取代它的更新 ADR 编号列表），作为返回字段附加；不写文件。
- `ADRManager.get`：单条 get 时同样在已读列表/同 scope 上计算该条的 superseded_by 返回。

### 数据模型

- 无新增持久化字段。`superseded_by` 为返回态派生字段。GC 仅删除 registry 条目（registry.json 既有结构）。

### 接口契约

- `doctor --gc-agents` / `agent gc`：返回被清理 agent 清单。
- adr_list / adr_get 返回项新增 `superseded_by`（无被取代则不带或空）。
- agent_list / agent_register 契约不变。

### 错误处理

- GC：registry 损坏走既有降级（loadRegistry 已处理 issues）。
- superseded_by 计算失败静默降级，不阻断 list/get。

### 测试策略

- 单元（doctor.test.ts）：3 个 dead 无 claim agent → gc 后被删；dead 但持未过期 claim → 保留；active → 不动；agent_list/register 无新副作用（断言不删）。
- 单元（adr-manager.test.ts）：0005 supersedes 0004 → get 0004 含 superseded_by:["0005"] 且 0004 文件未改；list 中被取代项带标注。
- 全量 `npm test` 绿。
