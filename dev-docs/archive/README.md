# dev-docs/archive/ — 封存物

**定位**：已终结或被取代的报告、冻结基线、历史对照材料与归档代码。**按历史原样保存，内部引用路径不保证可点**；不做路径改写（移动/改名 tracked 活文件时也**不**同步本目录——见 `../README.md` 引用规范第 4 条）。

## 内容分族

| 族 | 内容 |
|---|---|
| 早期对照与迁移报告 | `b0-observation-report.md`、`b1-migration-report.md`、`baseline-report.md`、`04-00-五阶段综合对比报告.md` |
| 语义权威案例（01-00 早期） | `semantic-authority-cases.md`、`semantic-violations-report.md` |
| 任务实施笔记（旧批次） | `T-002-completion-report.md`、`T-002-implementation-notes.md`、`m1-evaluation-materials.md` |
| 三客户端集成/E2E 报告（2026-06 及更早） | `E2E-REPORT-*-2026-06-1x.md`、`*INTEGRATION-TEST*.md`、`E2E-AUDIT-*`、`E2E-FEATURE-WALKTHROUGH.md`、`E2E-REVERIFY-CODEX.md` |
| 审计清单与简报 | `FINDINGS-CHECKLIST.md`、`REVIEW-BRIEF.md`、`execution-constraints-inventory.md` |
| 归档脚本（2026-09 治理后集中于此） | `scripts/`（`fix-b1-invertibility.mts`、`generate-inventory-markdown-v2.ts`、`semantic-analysis.ts`、`b0-pre-check.sh`、`b0-post-restore.sh`） |

## 维护规则

1. 封存物只增不改（含归档脚本：不再运行、不修引用）。
2. 新封存内容直接 `git mv` 入本目录（或 `scripts/`），在 commit message 注明。
3. 引用本目录内容时用 `dev-docs/archive/<path>` 完整路径；断链风险由引用方承担，归档方不保证。
