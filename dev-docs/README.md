# lrnev dev-docs — 研发档案

**定位**：研发内部档案（设计讨论、实施观测、复审记录、对照证据与归档）。GitHub 保留、**不进 npm 包**；用户文档在 `docs/`（`README.md` 文档地图）。

> 本文件是 dev-docs 的导航入口（2026-09 文件治理整理后建立）。dev-docs 内**路径即引用键**：`.lrnev/` spec 文档、`scripts/` 证据工具与本文档树相互引用，改名/移动必须先同步全部引用（见文末「引用规范」）。

## 目录地图

```
dev-docs/
├── PUBLISH.md ……………… 发布流程（docs.test 硬校验此路径，勿移动）
├── INTEGRATION-TEST.md … 集成测试总览（3.0.0 实况）
├── ai-guidance-standardization/ … Scene 04「引导标准化」战役档案（见下）
├── decisions/ ……………… 审定决策档案（DeepSeek 终稿入库镜像，只增不改）
└── archive/ ………………… 封存物（含 decisions/ 背书；历史内容，引用不保证）
```

> NEXT-STEPS.md / PRODUCT-STRATEGY.md（v2 时代战略文档）已于 2026-09 移除——3.0 整体重构后内容不再准确，且顶层不再保留"战略承诺"供后续反复推演；全文见 git 历史，边界裁决见 `decisions/`（3.1 路线裁决）。

### ai-guidance-standardization/ — Scene 04 战役档案

| 子目录 | 内容 | 代表文件 |
|---|---|---|
| `deliverables/` | 04-00 最终观测报告 + 06-00 spec 收口交付物 | `deliverables/06-00-e2e-evidence-index.md`（唯一证据索引，先读它）、`deliverables/04-00-final-observation-report.md` |
| `evidence/` | B 系列对照证据 manifest / 报告、冻结基线与引导面清单 | `evidence/b2b-evidence-manifest.json`、`evidence/baseline-freeze-v2.0.md`、`evidence/guidance-surface-inventory-v2.json` |
| `notes/` | Task 实施笔记与语义权威模型 | `notes/T-005-evidence-chain.md`、`notes/T-029-ownership-boundary-report.md`、`notes/semantic-authority-model.md` |

- 2026-09 已按域**物理分组**（deliverables / evidence / notes）：路径 = 引用键，分组后全仓引用已同步替换，移动/改名必须继续全量同步引用（见「引用规范」）；B 系列证据仍横切多个 spec（03-00 验收与 04-00 观测共用同一 manifest），现集中在 `evidence/`。
- B3/B4 真机对照判定与 3.0.0 发布战役的审定依据见 `decisions/`；真机录制件在 `tests/e2e/t027-baseline/.evidences/`（不入本目录）。

### decisions/ — 审定决策档案

DeepSeek 审查方终稿（裁决/汇总/规格，2026-09-04~09-07 起）的入库镜像，GitHub 可核验引用依据。维护规则（镜像、对名、只增不改）见 `decisions/README.md`。纯逐任务"复审通过"过程背书（08-28~09-03，共 36 份）已随 2026-09 收尾归档至 `archive/decisions/`——本目录只保留决策/汇总/规格类审定档案。

### archive/ — 封存物

已终结/被取代的报告、冻结基线、复审通过背书与历史对照材料。归档内容按历史原样保存，**内部引用路径不保证可点**。

- 三份 v2.3 时代盲测报告 `E2E-REPORT-{CLAUDE,CODEX,OPENCODE}-V23-2026-07-06.md` 2026-09 收尾自顶层归档至此（docs/AI-ADAPTATION.md 盲测口径、CHANGELOG 2.3.0 段等引用已同步改指 `archive/` 路径，通配写法不变）。
- `archive/decisions/` = 纯逐任务"复审通过"过程背书（08-28~09-03 共 36 份）归档；GitHub 仍在、可核验，活文件引用用 `dev-docs/archive/decisions/<文件名>` 完整路径。

## 引用规范（新增/修改 dev-docs 文件时）

1. **路径 = 引用键**：`.lrnev/` spec、`scripts/` 工具、`dev-docs/ai-guidance-standardization/deliverables/06-00-e2e-evidence-index.md` 把 `dev-docs/...` 路径当证据位置引用。移动/改名任何 tracked 文件前，先全仓 grep 引用并同步替换；`dev-docs/PUBLISH.md` 被 `tests/unit/docs.test.ts` 硬编码校验。
2. **审定依据指向 decisions/**：tracked 文档引用裁决/汇总时用 `dev-docs/decisions/<文件名>`，不指 `ai-discussions/`（后者 gitignore，GitHub 断链）；引用已归档背书（复审通过类）时用 `dev-docs/archive/decisions/<文件名>`。
3. **证据路径写进正文时用相对仓库根的完整路径**（与 06-00 证据引用契约样例一致，如 `dev-docs/ai-guidance-standardization/evidence/b2b-evidence-manifest.json`）。
4. 对照快照 `.claude/t027-worktrees/sha-*/` 是历史基线，**永不因改名而改动**。
