---
title: 'lrnev-govern'
created: '2026-06-11'
---

# lrnev-govern

## L0 摘要

AI 协作开发的项目治理引擎——MCP 服务 + CLI 双形态，文件即真相，零模型依赖（npm 包名 `lrnev`，当前 1.3.1）。

## L1 概览

### 项目目标

给“AI 帮你写代码”加一套档案和流程，解决 AI 健忘、代码无需求追溯、多窗口打架、质量看运气四类痛点。把项目的需求/设计/任务/决策/踩坑落成 `.lrnev/` 下的普通 Markdown（可读、可 git）。核心宗旨：**只引导，不强制**——确定性的事（读写文件、分配 ID、状态机、结构契约校验）lrnev 自己干且全程不调 LLM；需要判断的事（拆几个 spec、质量好不好）只通过 `ai_followup` 提醒 AI，最终由 AI 和用户定。

### 核心用户

- 一个人开多 AI 窗口接力开发、希望代码有需求追踪与验收的开发者
- 做 MCP 工具、想给用户提供治理骨架的作者
- 长期迭代、需要可追溯的真实项目；不适合一次性小脚本/纯问答

### 当前阶段

- v1.3.1 已发布；不绑定客户端（Claude Code / Cursor / Codex / 任意 MCP 客户端，或直接用 CLI）
- 进行中：`fix/findings-checklist` 分支，落实 2026-06-11 全面真机测试发现的清单（见 `dev-docs/FINDINGS-CHECKLIST.md`），用 lrnev 自身治理（Scene `01-findings-remediation`，7 个 spec）

## L2 详情

### 背景

源于 SCE（流程治理）+ OpenViking（上下文分层 L0/L1/L2）的思路融合，但拒绝引入向量模型或第二个语义模型——编码 AI 本身就是理解器，lrnev 只提供可检索、可追踪、可版本化的文件事实。与 codegraph 互补：lrnev 管“AI 怎么写代码”的流程治理，codegraph 管源码语义理解。

### 范围

**包含**：
- 确定性治理：Scene/Spec/Task 三层、Gate 结构契约校验、状态机、ID 分配、文件锁
- 轻产物：ADR、Errorbook、Memory、Summary、context 检索
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
- 向后兼容：既有 `.lrnev/` 数据持续可读；行为变更须有测试覆盖（当前 570 测试）
- CLI 与 MCP 能力对等：同一能力两条路都能走（`dev-docs/FINDINGS-CHECKLIST.md` 的 S1 正在补齐尚存的不对等）
