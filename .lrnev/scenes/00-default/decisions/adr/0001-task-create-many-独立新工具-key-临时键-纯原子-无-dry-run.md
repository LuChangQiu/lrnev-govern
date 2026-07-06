---
number: '0001'
title: task_create_many 独立新工具：key 临时键、纯原子、无 dry_run
status: proposed
scope: 'scene:00-default'
created: '2026-07-06'
date: '2026-07-06'
---

# 0001. task_create_many 独立新工具：key 临时键、纯原子、无 dry_run

## 状态

proposed

## 背景

真实使用（xpaas-xmxxgl，GPT-5.5 会话）反馈：ready 后拆 10 个任务需 10 次 task_create 往返，每次返回完整 followup，机械成本高。需要批量创建，但要定形态：扩参现有工具还是新工具、批内依赖怎么表达、失败语义。

## 决策

做独立新工具 task_create_many（MCP）/ task create-many --from-file（CLI），单条 task_create 完全不动。批内依赖用元素级 key 临时键（禁 T-\d+ 格式防歧义，解析优先批内 key 再真 ID）。失败语义仅 all-or-nothing：两阶段执行（全量校验→一次写入），失败一次性返回全部错误（index/field/message）。返回压缩为 created:[{id,title}]+单次 followup。

## 备选方案

- task_create 扩参加 tasks 数组（拒：单条 XOR 数组的互斥 schema 是弱模型误用陷阱，参数校验/错误返回/文档全变复杂）
- #N 批内序号引用（拒：模型中途重排数组会引错，key 可读且抗重排）
- dry_run 参数（拒：原子失败即校验+全错误列表，独立 dry_run 无增量价值）
- mode=atomic/partial 参数（拒：部分成功产生半批状态难恢复，违背'坏引用不落盘'口径；唯一行为不做成参数）

## 后果

MCP 工具 30→31（瘦身归战略第四步统一处理）；校验逻辑需重构为单条/批量共用（保证两路口径一致）；批量与逐条落盘产物等价。

## 参考

- 待补充
