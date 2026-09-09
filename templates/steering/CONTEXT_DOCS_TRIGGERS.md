# 上下文文档维护时机触发清单

> 本文档由 lrnev 在工作区初始化时自动写入 `.lrnev/steering/CONTEXT_DOCS_TRIGGERS.md`。
> AI 在准备更新 PROJECT / ARCHITECTURE / scene 文档时，通过 `context://steering/context-docs`
> 加载本文档，按"何时该动、动了做什么"执行。

---

## 适用范围

本文档管 5 份**无专用更新工具**的上下文文档：

| 文档 | 位置 |
|------|------|
| PROJECT.md | `.lrnev/PROJECT.md`（`context://project`） |
| 全局 ARCHITECTURE.md | `.lrnev/ARCHITECTURE.md`（`context://project/architecture`） |
| scene.md | `.lrnev/scenes/{id}/scene.md`（`context://scene/{id}`） |
| scene architecture.md | `.lrnev/scenes/{id}/architecture.md`（`context://scene/{id}/architecture`） |
| scene roadmap.md | `.lrnev/scenes/{id}/roadmap.md`（`context://scene/{id}/roadmap`） |

这些文档**直接编辑是正常路径**（遵守 `steering/core` §2：无专用更新工具；结构化状态才走工具）。
每份文档末尾自带"维护说明"，本文档把它们操作化：什么时机动、动了做什么。

通用规则：
- 文档如有 L0/L1 摘要，**大改后重新调 `summarize_save`** 同步——不手写 sidecar、不生成旧式 `.abstract.md`。
- **不确定该不该改 → 问用户**：既不要擅自大改，也不要因犹豫而默默不更新。

---

## 逐文档触发清单

### 1. PROJECT.md：init 补全一次 + 定位/目标/阶段/治理约定变化

**触发点**：
- init 后首次补全一次（init 只写 FILL 骨架，不自动探测）
- 项目定位、目标、范围或当前阶段变化
- 团队治理约定变化（新增/修改规范类约定）

**AI 行为**：
- 用户确认后直接编辑对应小节
- 大改后调 `summarize_save` 同步 L0/L1

**联动**：治理约定若已沉淀为 global ADR（如"指针式 AGENTS.md"），正文只记现状与约束，不重复决策推导（ADR 触发见 `context://steering/adr`）。

### 2. 全局 ARCHITECTURE.md：跨 Scene 架构约束 / 技术栈 / 共享机制变化

**触发点**：
- 影响多个 Scene 的架构约束出现或变更
- 技术栈增删/替换（框架、语言、存储、部署方式等）
- 跨 Scene 共享机制、数据流变化

**AI 行为**：
- 与用户确认后编辑；正文记"现在是什么"，不写决策推导
- 重大选型先问是否沉淀 **global ADR**（见 `context://steering/adr`）：ADR 记"为什么"，本文件记现状
- 大改后调 `summarize_save` 同步 L0/L1

### 3. scene.md：Scene 边界 / intent / 关键术语变化

**触发点**：
- Scene 边界变化（Spec 归属新域、Scene 合并/拆分）
- Scene intent（目的）改写
- 关键术语新增/变更

**AI 行为**：
- scene.md 由用户主导编写、AI 协助填空：确认后再改
- 修改后调 `summarize_save` 同步 `.scene.abstract.md` / `.scene.overview.md`

**联动**：边界变化通常同时影响同目录 architecture.md / roadmap.md，一并检查（见下）。

### 4. scene architecture.md：新的跨 Spec 共享约束出现

**触发点**：
- 本 Scene 出现新的**跨 Spec 共享约束**（第二个 Spec 复用公共机制、新接入方复用共享组件等）
- 单一 Spec 的内部设计 → 写该 Spec 的 design.md，**不写这里**

**AI 行为**：
- 实现前由主导者/AI 确认后补写
- 重大技术选型沉淀为 ADR（scene 或 global，见 `context://steering/adr`），本文档只记共享约束本身
- 大改后调 `summarize_save` 同步 L0/L1

### 5. scene roadmap.md：Spec 新建 / 收口 / 计划变化时同步（最易失真）

**触发点（与 spec 状态跃迁联动）**：
- 新 Spec 立项 → 加入"计划中/待评估"
- Spec ready 后拆任务实施 → 移入"进行中"
- Spec 收口（completion gate 通过 + `spec_update` completed）→ 移入"已完成"，更新"当前阶段"
- 方向被用户否决/改变 → 同步移除或改写

**AI 行为**：
- 直接编辑正文（未生成过摘要则跳过 `summarize_save`）
- **每次 spec 状态跃迁后检查**本路线图是否需同步——通常与 `spec_update` 同动作点进行，最容易被漏，养成"状态跃迁即同步"的习惯

---

## 过时信号：主动指出，不默默放任

文档与代码/实际不一致时（模块已不存在、约束已失效、Spec 状态与文档矛盾、L0/L1 与正文脱节）：

**AI 行为**：**主动指出文档过时并提议更新**，用户确认后编辑并调 `summarize_save`。
- ❌ 不要装作没看见、默默不写
- ❌ 也不要未经确认擅自大改

---

## 不要做的事

- ❌ 没有触发点不主动改（这些文档是"现状快照"，不是每次会话都要动的日志）
- ❌ 用编辑上下文文档**绕过状态机**：Spec / Task 状态变化必须走 `spec_update` / `task_update`
- ❌ 手写 sidecar / 旧式 `.abstract.md`（摘要一律经 `summarize_save`）
