---
id: '01-findings-remediation'
number: 1
name: 'findings-remediation'
status: draft
created: '2026-06-11'
intent: '落实 2026-06-11 全面测试发现的清单:CLI/MCP对齐、确定性硬校验、引用软提醒、启发式打磨、维护可见性、design锚点规范化、治理边界文档化'
---

# Findings Remediation

## L0 摘要

落实 2026-06-11 lrnev 全面真机测试发现的清单（17+1 条），按特性拆成 7 个 Spec 修复与文档化。

## L1 概览

2026-06-11 用 lrnev CLI + MCP 真机对 lrnev-govern 自身做了全面测试（含隐性链路 D 系列、MCP 生命周期 E 系列），发现 1 个真 bug + 多个设计取舍/打磨项。经 Claude/GPT 双向复评 + 用户拍板，形成最终决定清单。本 Scene 用 lrnev 自身治理这些改动（吃狗粮）。核心边界：确定性事实（FILL、引用目标存在性）该硬校验/拒写；需判断的语义（设计好坏、是否真实现）仍交 AI。

## L2 详情

### 业务背景

让 lrnev 用自己的治理流程修复自己的测试发现，既闭环验证流程可用性，也作为真实使用样例。

### 权威依据文档（实现时必须回查，勿凭记忆）

| 文档 | 作用 |
|------|------|
| `dev-docs/FINDINGS-CHECKLIST.md` | **最终决定（用户拍板）** 表是执行依据；含三方复评过程 + I-18 design 锚点决策 |
| `dev-docs/CLAUDE-INTEGRATION-TEST-2026-06-11.md` | 每条发现的复现方式、代码位置、实测证据 |

> 每个 Spec 的 requirements 都注明它对应 checklist 的哪几条 I-xx；实现前先回这两份文档核对边界与复现，不要只凭 spec 标题动手。

### 边界与范围

**包含**：
- S1 CLI/MCP 能力对齐（I-1/I-2/I-3）
- S2 确定性硬校验（I-4 FILL 硬拦 / I-6 孤儿文件 / I-7 depends_on 存在性）
- S3 引用与状态软提醒（I-5 F-xx / I-7 依赖未完成 / I-8 父子）
- S4 启发式打磨（I-10 并行提示 / I-11 assess_goal）
- S5 维护与可见性（I-12 agent GC / I-17 supersedes 读时计算）
- S6 design 锚点 D-xx 规范化（I-18 + I-5 的 D-xx 校验）
- S7 治理边界文档化（I-9 / I-13 / I-14）

**不包含**：
- 已验证健全项（I-15/I-16，已固化为 e2e）
- 不改 lrnev “只引导不强制”核心定位：需判断的语义仍交 AI

### 关键术语

| 术语 | 定义 |
|------|------|
| 确定性事实 | 本地数据零模型可判、误伤≈0（如 FILL 是否残留、引用目标是否存在）→ 该硬校验 |
| 需判断语义 | 需求好坏/设计优劣/代码质量/是否真解决问题 → 仍交 AI，软提醒 |
| F-xx / D-xx | requirements 功能锚点 / design 设计锚点（I-18 新规范，对称） |

### 相关 Scene

- 无（首个治理 Scene）

## 维护说明

- 本文档由用户主导编写，AI 协助填空
- 修改后 AI 应同步更新 `.abstract.md` / `.overview.md`
