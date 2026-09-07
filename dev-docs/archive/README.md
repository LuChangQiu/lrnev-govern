# dev-docs/archive/ — 封存物

**定位**：已终结或被取代的报告、冻结基线、历史对照材料与归档代码。**按历史原样保存，内部引用路径不保证可点**；不做路径改写（移动/改名 tracked 活文件时也**不**同步本目录——见 `../README.md` 引用规范第 4 条）。

## 内容分族

| 族 | 内容 |
|---|---|
| 早期对照与迁移报告 | `b0-observation-report.md`、`b1-migration-report.md`、`baseline-report.md`、`04-00-五阶段综合对比报告.md` |
| 语义权威案例（01-00 早期） | `semantic-authority-cases.md`、`semantic-violations-report.md` |
| 任务实施笔记（旧批次） | `T-002-completion-report.md`、`T-002-implementation-notes.md` |
| 三客户端集成/E2E 报告（2026-06 及更早） | `E2E-REPORT-*-2026-06-1x.md`、`E2E-AUDIT-2026-06-16.md`、`*INTEGRATION-TEST*.md` |
| 审计清单与简报 | `FINDINGS-CHECKLIST.md`、`execution-constraints-inventory.md` |
| 复审通过背书（2026-09 收尾归档） | `decisions/`（08-28~09-03 共 36 份，见下节） |

## 维护规则

1. 封存物只增不改（内容不改、不修内部引用）。
2. 新封存内容直接 `git mv` 入本目录，在 commit message 注明。
3. 引用本目录内容时用 `dev-docs/archive/<path>` 完整路径；断链风险由引用方承担，归档方不保证。

> 2026-09 收尾清理（发布前审计）：零引用且结论已消化的一次性脚本与旧 E2E 简报（`E2E-FEATURE-WALKTHROUGH`、`E2E-REPORT-{CODEX,OPENCODE}-2026-06-16`、`E2E-REVERIFY-CODEX`、`m1-evaluation-materials`、`REVIEW-BRIEF`、`scripts/` 全部 5 个归档脚本）已 `git rm`（git 历史可追溯）。

## decisions/ 子目录 — 逐任务复审通过背书（历史）

`decisions/` = 原 `dev-docs/decisions/` 补批镜像中**纯逐任务"复审通过"过程背书**（2026-08-28 ~ 2026-09-03，共 36 份；含 `-012-复审通过`、`-731全量` 等后缀变体）的归档。这类文件是逐任务复审结果背书，不属审定决策档案，随 2026-09 收尾整体归档至此；顶层 `dev-docs/decisions/` 只保留裁决 / 汇总 / 规格类审定档案。归档原则与本目录一致：**按历史原样保存（内容不改），内部引用路径不保证可点**；活文件引用时用 `dev-docs/archive/decisions/<文件名>` 完整路径。
