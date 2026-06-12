---
number: '0001'
title: 'validates 去自由字符串化:只认 F-xx/D-xx 锚点并硬校验存在性'
status: proposed
scope: 'scene:01-findings-remediation'
created: '2026-06-12'
date: '2026-06-12'
---

# 0001. validates 去自由字符串化:只认 F-xx/D-xx 锚点并硬校验存在性

## 状态

proposed

## 背景

validates 原为自由字符串:F-99/design#9.9 等指向空气的锚点照单全收(测试 D1 实证),无法支撑覆盖率/追溯/completion 自查。design#3.2 写法无稳定真相来源(design 无章节号),经核实全仓仅例子/测试用过、无用户数据依赖。

## 决策

validates 只接受 ^F-\d+$ (requirements 的 #### F-xx) 与 ^D-\d+$ (design 的 #### D-xx);格式与存在性都在 task_create 硬校验,坏引用不落盘(与 depends_on 同口径);design# 废弃报错引导改 D-xx;存量不自动迁移(无确定映射),doctor 列出供手改。

## 备选方案

- 保留自由字符串当备注:混结构锚+自由文本,追溯不稳,弃
- design#3.2 当 legacy 兼容:它非用户契约而是未定型草稿例子,直接清除
- 自动迁移 design#→D-xx:工具猜不了映射,弃

## 后果

validates 语义有意收紧;lrnev 仍只判'编号在不在',不判设计好坏

## 参考

- 待补充
