---
spec: 05-00-maintenance-visibility
scene: 01-findings-remediation
status: ready
priority: P2
created: '2026-06-11'
updated: '2026-06-12'
---

# 05-00 Maintenance Visibility - 需求

> 权威依据：`dev-docs/FINDINGS-CHECKLIST.md`（最终决定表 I-12/I-17）+ `dev-docs/CLAUDE-INTEGRATION-TEST-2026-06-11.md`（C1 dead agent 堆积 / E3 supersedes 单向）。实现前回查，勿凭记忆。

## L0 摘要

补两处非阻塞的维护与可见性能力：提供显式清理 dead agent 的命令（不在只读路径默认删），ADR 列表/详情读时计算 superseded_by（不回写旧文件）。

## L1 概览

### 目标

解决两处“正确使用时无碍、但长期/可见性有缺”的问题。① 硬崩溃残留的 dead agent 在 registry 单调堆积，需要显式、可审计的清理出口，但绝不在 `agent_list`（只读）等路径默认删，以免破坏惰性只读（NFR-1）与跨主机/待接手场景。② adr supersedes 只写在新 ADR，旧 ADR 状态不变，单独读旧 ADR 不知道它已被取代——用读时计算补可见性，不回写历史文件。

### 用户故事

- 作为长期使用 lrnev 的维护者，我希望有一条显式命令清掉确实死掉且无活跃 claim 的 agent 记录，以便 registry 不被异常退出残留撑大；同时我希望查 ADR 时能看出某条已被后续 ADR 取代。

### 范围

**包含**：
- I-12：新增显式 GC 能力 `doctor --gc-agents`（CLI）/ 对应 MCP 入口（或 `agent gc`），只清“已判 dead 且名下无活跃 claim”的 agent；保留刚崩溃、claim 待接手的记录。
- I-17：`adr_list` / `adr_get` 读时计算 `superseded_by`（扫描所有 ADR 的 supersedes 反向得出），不修改旧 ADR 文件内容/状态。

**不包含**：
- **不在 `agent_list` / `agent_register` 默认自动删 agent**（只读不应有写副作用；清理须显式）。
- 不回写旧 ADR 文件（保历史可追溯）。
- 优雅断开自动注销（已健全，E2 验证），不在本 Spec。

## L2 详情

### 详细需求

#### F-01 显式清理 dead agent 命令
- 描述：提供显式维护命令（CLI `doctor --gc-agents` 或 `agent gc`，并暴露对等 MCP 工具/参数），扫描 registry，仅删除满足“`computeAgentStatus`=dead 且其名下无活跃（未过期、未被判可接手）claim”的 agent；返回被清理的 agent 列表。**边界折中**：清“别人的”dead 记录只能走此显式命令；`agent_list` 等只读路径绝不删任何记录；`agent_register` 保持固有写语义——它本就覆盖同 `agent_id` 的旧记录（含旧 dead），不算新增副作用、零实现成本，故无需改动 register。
- 验收：
  - WHEN registry 有 3 个 dead 且无 claim 的 agent，跑 gc THEN 这 3 个被移除，返回清理清单。
  - WHEN 某 dead agent 仍持有未过期 claim（待接手）THEN gc **不**删它（保留接手线索）。
  - WHEN 某 agent 仍 active THEN gc 不动它。
  - WHEN `agent_list` 被调用 THEN 不删除任何记录（只读无写副作用）。
  - WHEN 同一 `agent_id` 重新 `agent_register` THEN 覆盖该 id 的旧记录为新 active（沿用现有固有行为，不留旧 dead 重复条目）；不触碰其他 agent。

#### F-02 ADR 读时计算 superseded_by
- 描述：`adr_list` / `adr_get` 返回时，基于全部 ADR 的 `supersedes` 字段反向计算每条 ADR 的 `superseded_by`（哪些更新的 ADR 取代了它），作为返回字段呈现；不修改任何 ADR 文件。
- 验收：
  - WHEN ADR 0005 supersedes [0004]，调 adr_get 0004 THEN 返回含 `superseded_by: ["0005"]`（或等价标注），但 0004 文件内容/status 未被改写。
  - WHEN adr_list THEN 已被取代的 ADR 带 superseded_by 标注，未被取代的不带。

### 非功能性需求

- 性能：gc 仅在显式调用时执行；superseded_by 计算在已读取的 ADR 列表上做反向映射，不新增额外文件遍历开销。
- 兼容性：保持惰性只读约束（list/get 无写副作用）；不破坏 ADR 历史文件；零模型。

### 边界与依赖

- I-12 依赖 `AgentRegistry`（`computeAgentStatus` / `isAgentDead`）与 `ClaimStore`（活跃 claim 判定）。
- I-17 依赖 `ADRManager` 的列表读取与 supersedes 字段。

### 验收标准

<!-- 最初失败信号 / 期望结果 -->
最初失败信号：C1 中 dead agent 无自动 GC、只能手动逐个 unregister；E3 中读旧 ADR 不知它已被取代。期望结果：有显式可控的 GC，ADR 读时能看出被取代，均不破坏只读/历史约束。
- [ ] 提供显式 gc 命令，只清 dead 且无活跃 claim 的 agent；list/register 无新副作用。
- [ ] adr_list/get 读时计算 superseded_by，不回写旧 ADR 文件。
- [ ] 新增测试覆盖；`npm test` 全绿无回归。
