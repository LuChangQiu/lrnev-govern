---
scene: '01-findings-remediation'
created: '2026-06-11'
---

# Findings Remediation - 路线图

> 本 Scene 的中长期规划。Spec 是路线图的具体实施。

## 当前阶段

需求定义完成、待实现。7 个 Spec 的 requirements 已全部填写并通过 ready gate，并对照 `dev-docs/FINDINGS-CHECKLIST.md` 与测试报告核对一致。下一步按优先级逐个进入实现（填 design → 建 task → 改源码 → completion gate）。在 `fix/findings-checklist` 分支推进。

## 已完成

- 全面真机测试（CLI D 系列隐性链路 + MCP E 系列生命周期），产出 `CLAUDE-INTEGRATION-TEST-2026-06-11.md`
- Claude/GPT 双向复评 + 用户裁决，形成 `FINDINGS-CHECKLIST.md` 最终决定（含 I-5 翻转、validates 去自由字符串化、I-18 锚点体系定稿）
- 7 个 Spec 拆分、requirements 全部填写 + ready gate 通过
- 项目级 PROJECT.md / ARCHITECTURE.md 补全（doctor 归零）
- I-15/I-16 已固化为 `tests/e2e/mcp-stdio-lifecycle.test.ts`

## 进行中

- 本 Scene 的需求/文档对齐（scene 架构与路线图本次补全）

## 计划中

按优先级实现（顺序的依据：先打地基的硬校验，再依赖它的软提醒/规范）：

1. **S2 deterministic-hard-checks（P0）**：FILL 硬拦 / 孤儿文件 / depends_on 存在性——确定性硬校验，最核心，先落地。
2. **S6 锚点体系规范化（P1）**：紧跟 S2，因 F-xx/D-xx 硬校验与 S2 的 depends_on 校验同处 `TaskManager.create`，宜一起做、口径一致。
3. **S1 cli-mcp-parity（P1）**：CLI/MCP 对齐，独立、低风险。
4. **S3 reference-soft-reminders（P1）**：依赖未完成/父子软提醒。
5. **S4 heuristic-polish（P2）**：并行提示/assess_goal 打磨。
6. **S5 maintenance-visibility（P2）**：显式 GC / supersedes 读时计算。
7. **S7 governance-boundary-docs（P2）**：边界文档化（I-9/13/14）。

## 待评估

- I-19（观察，非本批）：onboarding（PROJECT/ARCHITECTURE）空着时，现有 init followup + doctor 常驻 warning 对 AI 实际约束力不足（AI 会对常驻 warning 脱敏）。暂不做；未来若优化，方向是“`spec_create` 时机的一次性强提示”而非加 warning。维持现状（doctor 提醒足够，不污染治理数据）。
- design 锚点 `D-xx` 规范稳定后，是否将 doctor 对存量坏锚点的检测从“列出提示”升级为更强引导。
