---
id: '03-workspace-hygiene'
number: 3
name: 'workspace-hygiene'
status: draft
created: '2026-07-06'
intent: '工作区运行态卫生：registry/claims 等运行态残留的自动清理与文件真相维护'
---

# Workspace Hygiene

## L0 摘要

工作区运行态卫生：把 agent registry/claims 等运行态残留的清理自动化——register 时机会式 GC（双轨保留期 + status 真值回写），与 01 的显式 GC 命令形成「自动 + 显式」双通道。

## L1 概览

**状态注记（2026-09-07）**：本 scene 的 01-00-auto-gc 已 completed 收官（随 v2.3.0 发布，45a86e1），详情见 `specs/01-00-auto-gc/` 下 requirements/design/tasks；模板全量描述留待后续按需补充（研究性内容不阻塞发布）。

## L2 详情

### 业务背景

运行态残留（dead agent、悬空 claim）会污染治理地图与 gate 判定；既有的显式 doctor --gc-agents 需要人工触发，本 scene 让清理在 register 时机自动发生并回写 status 真值。

### 边界与范围

**包含**：
- 01-00 auto-gc：agent.auto_gc / gc_retention_days 配置 + register 时机会式清理 + status 真值回写。

**不包含**：
- 主动巡检式 GC（机会式只在 register/心跳时机触发）；文件真相维护以外的其他运行态问题。

### 关键术语

| 术语 | 定义 |
|------|------|
| 时机会式 GC | 在 register 等既有时机顺带清理过期 agent，不新增独立常驻调度 |
| 双轨保留期 | active（心跳保活）与 dead 两条保留期规则（见本 scene decisions/adr/0001） |

### 相关 Scene

- **01-findings-remediation**：S5 显式 agent GC 命令是自动化的前提；ADR 沉淀该边界。

## 维护说明

- 本文档由用户主导编写，AI 协助填空
- 修改后 AI 应同步更新 `.abstract.md` / `.overview.md`
