# lrnev dev-docs — 研发档案

**定位**：研发内部档案（设计讨论、实施观测、复审记录、对照证据与归档）。GitHub 保留、**不进 npm 包**；用户文档在 `docs/`（`README.md` 文档地图）。

> 本文件是 dev-docs 的导航入口（2026-09 文件治理整理后建立）。dev-docs 内**路径即引用键**：`.lrnev/` spec 文档、`scripts/` 证据工具与本文档树相互引用，改名/移动必须先同步全部引用（见文末「引用规范」）。

## 目录地图

```
dev-docs/
├── PUBLISH.md ……………… 发布流程（docs.test 硬校验此路径，勿移动）
├── NEXT-STEPS.md ………… 发布后待办路线
├── PRODUCT-STRATEGY.md … 产品策略
├── INTEGRATION-TEST.md … 集成测试总览
├── E2E-REPORT-{CLAUDE,CODEX,OPENCODE}-V23-2026-07-06.md … 三客户端 v23 盲测报告
│                            （docs/AI-ADAPTATION.md 盲测口径引用，视为活证据）
├── ai-guidance-standardization/ … Scene 04「引导标准化」战役档案（见下）
├── decisions/ ……………… 审定决策档案（DeepSeek 终稿入库镜像，只增不改）
└── archive/ ………………… 封存物（含 scripts/ 归档代码；历史内容，引用不保证）
```

### ai-guidance-standardization/ — Scene 04 战役档案

| 前缀/族 | 内容 | 例子 |
|---|---|---|
| `04-00-` | 04-00 spec 观测报告 | `04-00-最终观测报告.md` |
| `06-00-` | 06-00 spec 收口交付物 | `06-00-client-integration-guide.md`、`06-00-mcp-response-conformance.md`、**`06-00-e2e-evidence-index.md`（唯一证据索引，先读它）** |
| `T-0xx-` | Task 实施笔记 | `T-005-evidence-chain.md`、`T-029-ownership-boundary-report.md` |
| `b0~b2b-` | B 系列对照证据 manifest / 报告 | `b0-evidence-manifest.json`、`b2b-evidence-manifest.json` |
| freeze / inventory | 冻结基线与引导面清单 | `BASELINE-FREEZE-v2.0.md`、`v0.1-freeze.md`、`guidance-surface-inventory-v{2,3}-*.json/md` |
| 语义权威 | 01-00 spec 语义模型 | `semantic-authority-model.md` |

- 本目录**维持平铺**是刻意决定：B 系列证据横切多个 spec（03-00 验收与 04-00 观测共用同一 manifest），文件前缀即分类；物理再分子目录会破坏 `06-00-e2e-evidence-index.md` 的证据引用契约（其中示例路径被 .lrnev spec 与报告引用为格式范本）。
- B3/B4 真机对照判定与 3.0.0 发布战役的审定依据见 `decisions/`；真机录制件在 `tests/e2e/t027-baseline/.evidences/`（不入本目录）。

### decisions/ — 审定决策档案

DeepSeek 审查方终稿（裁决/汇总/规格，2026-09-04~09-07 起）的入库镜像，GitHub 可核验引用依据。维护规则（镜像、对名、只增不改）见 `decisions/README.md`。

### archive/ — 封存物

已终结/被取代的报告、冻结基线、旧工具与归档脚本。归档内容按历史原样保存，**内部引用路径不保证可点**；归档脚本集中在 `archive/scripts/`。

## 引用规范（新增/修改 dev-docs 文件时）

1. **路径 = 引用键**：`.lrnev/` spec、`scripts/` 工具、`06-00-e2e-evidence-index.md` 把 `dev-docs/...` 路径当证据位置引用。移动/改名任何 tracked 文件前，先全仓 grep 引用并同步替换；`dev-docs/PUBLISH.md` 被 `tests/unit/docs.test.ts` 硬编码校验。
2. **审定依据指向 decisions/**：tracked 文档引用裁决/汇总时用 `dev-docs/decisions/<文件名>`，不指 `ai-discussions/`（后者 gitignore，GitHub 断链）。
3. **证据路径写进正文时用相对仓库根的完整路径**（与 06-00 证据引用契约样例一致，如 `dev-docs/ai-guidance-standardization/b2b-evidence-manifest.json`）。
4. 对照快照 `.claude/t027-worktrees/sha-*/` 是历史基线，**永不因改名而改动**。
