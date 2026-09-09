---
number: '0003'
title: init 可选生成项目根 AGENTS.md（翻案 2026-06 不做代码生成决策）
status: proposed
scope: global
created: '2026-09-09'
date: '2026-09-09'
---

# 0003. init 可选生成项目根 AGENTS.md（翻案 2026-06 不做代码生成决策）

## 状态

proposed

## 背景

2026-06-15 记录决策：不做 lrnev 代码生成 AGENTS.md（侵入用户项目根文件+标准未定）。2026-09 实证环境变化：1) steering 送达缺口——三个独立 agent 样本未读 .lrnev/steering 即工作，送达修复（连接注入+常驻模板）已做但 AGENTS.md 是客户端原生加载层（DSH/codex/opencode 原生读取，codegraph 标记块管理先例）；2) 手抄漂移实证——同一套规则在 XQWL 项目版/~/.claude/~/.codex 三处已漂移；3) 用户拍板：init 询问用户是否生成。草案与模板见 .claude/adr-draft-init-agents-md.md

## 决策

1) init 末尾交互询问生成根 AGENTS.md（默认不生成 opt-in），提供 --with-agents-md flag 供自动化；已 init 项目重跑 init 再询问 + doctor 软提示。2) 生成内容=指针式：声明+修改边界（AI 不得自改）+ .lrnev/steering 四份具体文件清单（各一句话用途与何时读）+ 只读/要改判断 + 验证纪律（写完≠完成）+ 速查——不复制 steering 全文（防漂移，steering 唯一真源）。3) 工具栈无关，不做组合询问（差异属客户端侧，AI-ADAPTATION 模板 A/B 覆盖）。4) 已存在 AGENTS.md 则跳过不覆盖；lrnev 仅在用户明确同意时写此一个项目根文件，其余仍只写 .lrnev/。5) 骨架参考 XQWL 项目手工版（声明/修改边界/只读要改/验证），项目特定内容不入模板。

## 备选方案

- A 默认生成（拒：侵入无同意）
- B 只文档建议用户自加（2026-06 原案，拒：送达仍依赖用户手动）
- C 生成全量规则副本（拒：第四份手抄漂移源）

## 后果

正向：steering 送达第三通道（客户端原生加载层）；消灭手抄漂移（指针式）；opt-in 不越用户决定优先边界。风险：AGENTS.md 只覆盖原生读它的客户端族（Claude Code 路径本机未验证——实施前真机探针回填）；生成物与用户自定义指令并存（预期，不做同步）。明确不做：默认生成/自动探测工具栈/生成 steering 全量副本/管理 CLAUDE.md 等其它客户端文件。

## 参考

- 待补充
