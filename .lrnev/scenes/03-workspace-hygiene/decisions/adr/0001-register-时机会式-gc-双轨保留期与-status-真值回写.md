---
number: '0001'
title: register 时机会式 GC：双轨保留期与 status 真值回写
status: proposed
scope: 'scene:03-workspace-hygiene'
created: '2026-07-06'
date: '2026-07-06'
---

# 0001. register 时机会式 GC：双轨保留期与 status 真值回写

## 状态

proposed

## 背景

真实项目实测 registry.json 3 周积累 64 条死记录（全标 active）、claims/ 积累 14 个过期文件；显式 doctor --gc-agents 存在但没人主动跑——与维护态缺口同构的发现性问题。v2.0 S5/I-12 决定'只读路径绝不自动删'，需要不违反该决定的自动清理路径。

## 决策

清理搬到 register（写路径、已持注册锁）内 best-effort 执行：本机 pid 判死（确定性死亡）立即清；跨主机心跳判死（推断性死亡）超过 agent.gc_retention_days（默认 7 天）才清；均要求名下无未过期 claim。幸存条目 status 字段顺手回写 computeAgentStatus 真值（不删字段，保旧版 normalizeAgentInfo 兼容）。默认开启（agent.auto_gc=true），GC 异常不影响注册主流程。doctor --gc-agents 原样保留。

## 备选方案

- 默认 opt-in（拒：'没人会开配置'与'没人跑 gc'是同一发现性病）
- 统一 N 天保留期（拒：与死亡确定性不对齐——pid 判死不会复活，等待无意义）
- 删除 status 字段读时计算（拒：旧版 normalizeAgentInfo 会把缺字段条目整条判无效，多版本混跑退化）
- followup 提醒 AI 跑 gc（拒：提示词依赖会脱敏，I-19 已证）

## 后果

registry/claims 不再无界增长；registry.json 的 status 语义变为'截至最近一次 register 清扫的计算值'；register 多一次遍历（几十个小 JSON，无感）；响应契约新增可选 gc 字段（加法兼容）。

## 参考

- 待补充
