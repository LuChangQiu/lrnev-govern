---
title: 'lrnev-govern'
created: '2026-06-11'
updated: '2026-09-07'
---

# lrnev-govern

## L0 摘要

AI 协作开发的项目治理引擎——MCP 服务 + CLI 双形态，文件即真相，零模型依赖（npm 包名 `lrnev`，当前 3.0.0）。

## L1 概览

### 项目目标

给"AI 帮你写代码"加一套档案和流程，解决 AI 健忘、代码无需求追溯、多窗口打架、质量看运气四类痛点。把项目的需求/设计/任务/决策/踩坑落成 `.lrnev/` 下的普通 Markdown（可读、可 git）。核心宗旨：**只引导，不强制**——确定性的事（读写文件、分配 ID、状态机、结构契约校验）lrnev 自己干且全程不调 LLM；需要判断的事（拆几个 spec、质量好不好）只通过 `ai_followup` 提醒 AI，最终由 AI 和用户定。

### 核心用户

- 一个人开多 AI 窗口接力开发、希望代码有需求追踪与验收的开发者
- 做 MCP 工具、想给用户提供治理骨架的作者
- 长期迭代、需要可追溯的真实项目；不适合一次性小脚本/纯问答

### 当前阶段

- **v3.0.0（2026-09-07）**：治理契约端到端标准化（scene `04-ai-guidance-standardization` 承载）——MCP 响应双通道（structuredContent canonical 信封 + outputSchema + 逐工具渲染文本，**text 通道破坏性变更**）、五角色 Guidance Profile 语义、`decision_context` 客户端声明通道、`--profile core|full` 工具面分层；T-027 真实客户端双 SHA（sha-a/sha-b/sha-c/sha-d）四轮对照驱动引导收敛（G1-G5）；05-00 Profile 字段裁决（guidance 运行时挂载回退、结构化传输面收敛为纯函数库）；全量 1055 测试。
- v2.3.0（2026-07-06）：scene `03-workspace-hygiene`（机会式 GC + status 真值回写）与 `task_create_many` 批量拆任务（00-default 01-00）；发布前三客户端盲测审计。
- v2.2.0（2026-06-18）：`lrnev report` 治理体检（scene `02-context-delivery` 03-00）——链路完整度 + validates 覆盖率。
- v2.0.0（2026-06-12）：scene `01-findings-remediation` 七个 spec 完成——确定性硬校验（FILL/孤儿/坏引用）、F-xx/D-xx 锚点体系、CLI/MCP 对等、软提醒、显式 gc、superseded_by、边界文档化。
- 不绑定客户端（Claude Code / Cursor / Codex / 任意 MCP 客户端，或直接用 CLI）。

## L2 详情

### 背景

源于 SCE（流程治理）+ OpenViking（上下文分层 L0/L1/L2）的思路融合，但拒绝引入向量模型或第二个语义模型——编码 AI 本身就是理解器，lrnev 只提供可检索、可追踪、可版本化的文件事实。与 codegraph 互补：lrnev 管"AI 怎么写代码"的流程治理，codegraph 管源码语义理解。

### 范围

**包含**：
- 确定性治理：Scene/Spec/Task 三层、Gate 结构契约校验、状态机、ID 分配、文件锁
- 轻产物：ADR、Errorbook、Memory、Summary、context 检索
- 治理契约（3.0.0）：MCP structuredContent 双通道、五角色引导语义（【事实】【建议】【决策边界】【执行约束】【下一步】）、decision_context 客户端声明、--profile 工具面分层
- 多 Agent 协作：注册表 + Task claim 软占用（进程生命周期判活）
- 本地 Hooks 自动化、Doctor 工作区自检

**不包含**：
- 不调用任何 LLM / Embedding，不联网、不烧 API
- 不做源码语义理解（哪个函数调哪个、改这里影响谁）——那是 codegraph 的范畴
- 不 spawn agent、不调度子任务、不裁决源码文件冲突

### 关键约束

- 文件即真相：全部状态落 `.lrnev/` Markdown + frontmatter，无数据库、无黑盒
- 零模型 / 零新运行时强依赖：只用 Node 内置能力 + 少量轻依赖（commander/glob/gray-matter/zod/MCP SDK）
- 确定性归代码、判断归 AI：工具列事实、给 `ai_followup` 提示，不维护隐藏状态或模型推理结果
- 向后兼容：既有 `.lrnev/` 数据持续可读；行为变更须有测试覆盖（当前 1055 测试）
- CLI 与 MCP 能力对等：同一能力两条路都能走（core Manager 同源，杜绝两路漂移）
- 引导有效性取决于送达时刻与动作绑定：动作点引导（工具描述/决策时刻）优先于过程点建议（真机观测，2026-09）
