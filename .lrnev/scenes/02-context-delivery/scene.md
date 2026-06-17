---
id: '02-context-delivery'
number: 2
name: 'context-delivery'
status: draft
created: '2026-06-15'
intent: '把治理数据在正确时刻送进AI上下文;解决维护态缺口(小增量落位)与需求审核(新开spec停一步)两大问题'
---

# Context Delivery

## L0 摘要

把 lrnev 已积累的结构化治理数据，在正确时刻送进 AI 上下文：先补三处「送达缺口」（维护态小增量落位、新需求审核门、任务启动锚点回填），再按阶段升级「定位」（治理地图 / 锚点抽段 / BM25）与「回报」（lrnev report）。与 scene 01「写入时挡坏引用」互补，本 scene 管「使用时递好内容」。

## L1 概览

**背景**：lrnev 攒了一堆结构化治理数据，但在几个关键时刻没有有效送达 AI——这是产品最大的依从性问题在微观处的复现。scene 01 解决了「写入正确性」（S6 硬校验挡坏锚点引用），本 scene 解决「使用时送达」与「定位/回报」。

**边界**：本 scene 含三阶段、前一阶段是后一阶段的硬前置——阶段一送达缺口（spec 01-00）、阶段二定位升级（spec 02-00，硬依赖 01-00 沉淀的 `extractAnchorSections`）、阶段三回报（spec 03-00，第一个「分红」）。入口执法（git pre-commit / doctor 审计）、AGENTS.md 代码生成、向量检索、agent 编排均不在内（见 roadmap 待评估 / 永远不做）。

**关键概念**：分流（AI 动手前的四路判断）、锚点（F-xx/D-xx）、`anchor_context`（启动时回填的结构化字段）、`ai_followup`（只引导不强制协议）、治理地图、零模型。

## L2 详情

### 业务背景

lrnev 的结构化治理数据在三个时刻没送达 AI：① 维护态——项目越成熟越是小增量为主，但没有轻量落位通道，AI 真机表现为乱开新 spec 或绕开 lrnev（这是留存的最大威胁）；② 需求审核——新 spec 的 requirements 过了结构 gate 就直接建 task，没有让用户审「做什么」的人工门；③ 任务启动——task 推进时 AI 只收到「先读 F-01」一句指令、手里没内容，每多一步操作多一层流失。本 scene 把这三处补上，再顺势升级 AI 对治理数据的定位（地图/抽段/排序）与回报（report）。

### 边界与范围

**包含**：
- 阶段一（spec 01-00，进行中）：维护态小增量落位 + 需求审核门 + 任务启动锚点回填 + 分流边界（F-01~F-04）。
- 阶段二（spec 02-00，排队，硬依赖 01-00）：定位升级——治理地图 + context_search 锚点级抽段 + BM25 打分。
- 阶段三（spec 03-00，计划）：`lrnev report`——读自有 `.lrnev` 数据生成 validates 覆盖率 / 需求→任务→完成链路 / release notes 草稿，第一个「分红」。

**不包含**：
- 入口执法（git pre-commit / doctor 未治理变更审计）——硬依赖 01-00 维护通道先行，等真实信号，见 roadmap 待评估。
- AGENTS.md 代码生成、`lrnev integrate` 薄垫片、国际化 alias 表、SQLite FTS5、doctor flag 合并——见 roadmap 待评估。
- 永远不做：agent 编排 / 子任务调度、语义检索 / 向量 / embedding、持久化 JSON 索引缓存、追新客户端每个特性。

### 关键术语

| 术语 | 定义 |
|------|------|
| 锚点（F-xx / D-xx） | requirements 的 `#### F-xx` 标题、design 的 `#### D-xx` 标题；task 用 `validates` 引用，lrnev 只校验「在不在」，不判断质量 |
| 分流 | AI 动手前从便宜到贵判断：写不出独立验收→直接做（不开 spec/task）；给已有特性加增量→`context_search` 落位已有 spec（task_create）；独立新特性→开 spec，优先归已有业务域 scene，仅经用户确认/上下文明确是会承载多 spec 的新业务域才 `scene_create`，零散无稳定域的小特性才落 `00-default`（兜底）；scene/00 是结构决策、难回退，拿不准就问用户 |
| `anchor_context` | `task_update(in_progress)` / `task_claim` 返回的顶层结构化字段，回填 `validates` 对应的 requirements/design 段落 |
| `ai_followup` | lrnev 的「只引导不强制」协议：在响应里附待办指令 + 工具建议，不依赖 MCP sampling |
| 治理地图 | scene→spec（状态/L0）→锚点标题 的压缩全景（repo-map 思路），AI 看图用 URI 直接跳转 |

### 相关 Scene

- **01-findings-remediation（v2.0.0）**：打通确定性硬校验地基，含 S6 锚点体系（F-xx/D-xx 规范 + 存在性校验 + `extractAnchorPool`）——本 scene 的锚点基础设施前置。两者互补：S6 在写入时挡坏引用，本 scene 在使用时递好内容，是同一条筋的两面。

## 维护说明

- 本文档由用户主导编写，AI 协助填空
- 修改后 AI 应同步更新 `.abstract.md` / `.overview.md`
