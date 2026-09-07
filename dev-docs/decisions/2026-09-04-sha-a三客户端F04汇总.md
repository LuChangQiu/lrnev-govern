# T-027 sha-a explicit 三客户端批 F-04 汇总报告

- **日期**: 2026-09-04
- **作者**: DeepSeek（审查方）
- **数据**: claude 30 sessions（$8.96）+ codex 20（$3.20）+ opencode 20（$0.15）；evidence 全 validator strict 0 ERROR；commit 至 651aed0
- **状态**: sha-a 批完成；待决策：sha-b 批 / codex 幻构处理 / E-02 口径

## 三客户端判定总表（sha-a，explicit）

| 场景 | claude (sonnet-5) | codex (gpt-5.5) | opencode (v4-flash) | 一致性 |
|---|---|---|---|---|
| E-01 new_spec | 5/5 PASS | **0/5（幻构）** | 5/5 PASS | claude=opencode；codex 异常 |
| E-02 reuse_spec | 0/5（直写被拒） | 0/5（幻构） | 1/5+4/5（批量工具口径） | 全 FAIL 但机制各异 |
| E-06a 改意-前 | 1/5+4/5（归档抢跑 B） | 不支持（多轮） | 不支持 | — |
| E-06b 改意-后 | 3/5+2/5（归档 B） | 不支持 | 不支持 | — |
| E-07 no_spec | 5/5 PASS | 5/5 PASS | 5/5 PASS | **三端一致** |
| E-08 状态机 | 5/5 PASS（真拒绝） | 2/5（幻构 SPEC_NOT_FOUND） | 5/5 PASS | claude=opencode |

## 归因（跨客户端行为差异）

1. **codex 幻构（模型/gateway 层，非 lrnev 引导）**：跨 session 一致幻构 `00-default/03-00-user-login` 锚点、声称已创建（ghost completion）、E-08 幻构 scene 致 SPEC_NOT_FOUND 而非状态机拒绝。claude/opencode 同场景全 PASS 证明引导有效——codex 数据归因客户端缺陷。疑似 xuseny gateway + gpt-5.5 + reasoning=none 组合。**验证建议**（~$3）：换配置重测 E-01（开 reasoning / 换 gpt-5.6）。
2. **claude 直写绕过（引导缺口）**：R1→本批两次 5/5 稳定——G1-G4 已修（98828f2），**B3 对照验证是否转 PASS**。
3. **opencode 直写成功 + 批量工具**：内置 write/edit 可写 .lrnev（无权限墙），4/5 用 task_create_many——**判定口径问题（见裁决）**。
4. **E-06a/b 归档模式（6/10）**：AI"撤销自己刚建"直觉 vs design"已创建不自动回滚"——guidance 关注点（G1-G4 的 spec_get 引导或后续 Profile 文案）。

## 裁决 1：E-02 判定口径（task_create_many）

opencode 4/5 用 task_create_many 在目标 A（或近似）下建任务被判 FAIL（工具字面 ≠ expectedAction='task_create'）。
- **裁决**：E-02 的测量意图 = "explicit reuse 意图是否在 A 下登记了开发任务"（治理意图），非工具字面。**判定口径改为：task_create 或 task_create_many 成功在目标 A（scene=01-user-management spec=01-00-user-login）下登记任务 = PASS**；直接编辑文档（无任务登记）= FAIL；幻构/错误对象 = FAIL。
- **影响**：opencode E-02 需按新口径复核（task_create_many 落位是否正确）；harness/F-04 脚本判定规则同步更新；历史 evidence 不重判（标注口径版本），新判定以本裁决为准。
- **注**：此口径与"工具字面"的差异仅影响 E-02 类场景（允许批量形态），不改变 E-06a/b 的"不得建/不得归档"语义。

## 裁决 2：F-04 门禁判定（sha-a 数据）

| 场景 | 门禁 | 判定 |
|---|---|---|
| E-01 | claude 5/5 PASS ✅ 不触发 | codex 0/5 归因客户端幻构（非引导）——修复方向=codex 配置，非 lrnev |
| E-02 | claude 0/5 + opencode 1/5 → **触发** | 归因=引导缺口（G1-G4 已修）→ **B3 重测验证** |
| E-06a/b | claude 4/5+2/5 FAIL → **触发** | 归因=AI 归档直觉 vs design 规则——需 guidance/口径处理（见下） |
| E-07/E-08 | 三端 PASS ✅ 不触发 | E-08 状态机约束有效（claude/opencode 实测真拒绝） |

## 裁决 3：E-06a/b 归档模式处理

AI 在用户改主意后自动归档自己刚建的 B（"合并到 user-login"）——design E-06b 明令"不得自动归档"。**这不是 harness/环境问题，是 AI 行为与 design 规则的冲突**。处理：① 数据如实记录（FAIL）；② G1-G4 的 spec_get 引导或后续 Profile 增加"用户改主意≠撤销已创建 Spec（归档需用户明确指示）"语义（B3 改进候选）；③ 若 B3 后仍稳定归档——design E-06b 的"不得归档"规则需重审（AI 的"撤销自己刚做"是否应允许——产品语义决策，用户拍板）。

## 下一步（待用户确认）

1. **sha-b 批**（~$12：claude 6 + opencode 4 场景，codex 幻构未解前 sha-b 意义有限——建议 codex 验证后一起）；
2. **codex 幻构验证**（~$3：换配置重测 E-01）；
3. **B3 对照准备**：G1-G4 已合入主工作区——sha-b 批可用**主工作区 HEAD（含 G1-G4）**作为 B 端对照？——**注意**：T-027 双 SHA 的 B 端是 6383e99 冻结快照（无 G1-G4）——G1-G4 的验证属 05-00 B3 阶段（05-00 合入后真机重测 E-02）——时序上 B3 在 sha-b 批后。
4. **E-02 口径更新**（裁决 1）需 harness/F-04 脚本同步——小改动。
