---
id: '00-default'
number: 0
name: 'default'
status: draft
created: '2026-06-11'
intent: 'Default landing scene for specs without an explicit scene.'
---

# Default

## L0 摘要

00-default 是无明确业务域归属的 spec 的兜底落位 scene：承载 task_create_many（批量建任务）与 v2.3.0 发布前审计整改（三客户端真机 E2E + 文档审核收敛）两个 spec，均已 completed 收官（随 v2.3.0 发布，45a86e1）。

## L1 概览

**状态注记（2026-09-07）**：本 scene 的 01-00 / 02-00 已全部 completed，详情见 `specs/` 下各 requirements/design/tasks；模板全量描述留待后续按需补充（研究性内容不阻塞发布）。

## L2 详情

### 业务背景

lrnev 允许 spec 挂任意 scene；没有稳定业务域归属的零散特性落 00-default 兜底，避免为一次性工作开新业务域 scene。

### 边界与范围

**包含**：
- 01-00 task_create_many：spec 拆解阶段一次原子创建多个 task（批内 key 依赖、压缩返回）。
- 02-00 release-audit-remediation：v2.3.0 发布前审计整改收口（E2E 报告 + 引导同步 + 文档修复）。

**不包含**：
- 有稳定业务域归属的 spec（按 02 分流边界归 01-04 各 scene，不落兜底）。

### 关键术语

| 术语 | 定义 |
|------|------|
| 兜底落位 | 零散无稳定业务域的小特性落 00-default（02-00 spec 分流边界），结构性归 scene 决策前先问用户 |

### 相关 Scene

- **02-context-delivery**：分流边界——零散无稳定域的小特性才落 00-default 兜底。

## 维护说明

- 本文档由用户主导编写，AI 协助填空
- 修改后 AI 应同步更新 `.abstract.md` / `.overview.md`
