# T-027 B3 对照跑批汇总报告 —— claude-code × SHA-C（主工作区修复后快照）

- **任务**: B3 = 主工作区修复后快照（G1-G4 E-02 引导修复 + 05-00 Profile + 输出契约根治 + 归一判定）真机重测，验证改进（claude 部分）
- **客户端**: claude-code（CLI 2.1.228，模型 claude-sonnet-5[1m]，网关 cc-t2.freemodel.dev）
- **SHA**: sha-c = `.claude/t027-worktrees/sha-c` @ `918581e73007c099c7e7002a29b26556a2d21590`（detached，冻结未改动）
- **Harness**: registry HEAD `3aaf6b5`（含 16950f9+35a7bb6+a586f46 归一/输出契约修复 + wrapper sha-c 支持）
- **执行**: 2026-09-04 16:29~16:57 (+0800)
- **判定**: 当前 harness 语义（E-02 口径 v2；E-06a 续接双轮；E-06b 分轮 + B 存在性 sidecar）；exit 0=PASS / 1=FAIL / 4=ANOMALY，均属数据不重试

## 0. ⚠️ 运行期基建修正（供复审）

sha-c evidence 的 `git_sha` 字段在原始 harness 中恒取 sha-b（`harness-mvp.mjs` 仅按 `sha==='sha-a'` 二分映射），会导致 sha-c 证据错误标注 `git_sha=6383e99`。
已做**最小增量补丁**（registry `tests/e2e/t027-baseline/harness-mvp.mjs`，+9/-4，未提交）：
- `buildEvidenceV2` 的 git_sha 解析改为按 worktree 标签白名单（sha-a/sha-b/sha-c）走 `getFullGitSha(sha)`，未知标签回退 sha-b（历史行为不变）；
- `getFullGitSha` 三处兜底常量增加 sha-c → `918581e…`。
sha-a/sha-b 行为零变化（同一表达式结果）。**证据文件一律未手改**；本报告前产生的 1 个 git_sha 错误标注的探针会话（E-02，已删除未入库）。补丁后全部 sha-c 证据 `git_sha=918581e`、`sha_label=sha-c`、`content_hash` 指纹 sha-c worktree 源（与 sha-b 的 b8d90f51… 不同）。

## 1. 判定明细表

### E-02（建议新建+明确复用；口径 v2：task_create/task_create_many 命中 A=01-user-management/01-00-user-login 且成功=PASS）—— G1-G4 修复验证主目标
| # | run_id | 工具序列 | task 登记(A) | exit | 判定 | cost_usd |
|---|--------|----------|-------------|------|------|----------|
| 1 | e-02-1788510900956-h5h5rdkp | project_status → spec_get → Read×3 → Edit×6 | **无** | 1 | ❌ FAIL(no-reg) | 0.3610 |
| 2 | e-02-1788511031804-5q884vtz | project_status → spec_get → Read×3 → Edit×6 | **无** | 1 | ❌ FAIL(no-reg) | 0.3444 |
| 3 | e-02-1788511120657-palnc2ia | project_status → spec_get → Read×3 → Edit×3 → Read | **无** | 1 | ❌ FAIL(no-reg) | 0.3057 |
| 4 | e-02-1788511194268-4oaoii5f | project_status → spec_get → Read×3 → Edit×3 | **无** | 1 | ❌ FAIL(no-reg) | 0.2923 |
| 5 | e-02-1788511267038-qinp3muh | project_status → spec_get → Read×3 → Edit×2 → Write | **无** | 1 | ❌ FAIL(no-reg) | 0.2843 |
| **小计** | | | **0/5 无登记** | | **0/5 PASS** | **1.5877** |

> **归因（引导/工具/模型）**：模型读取 Spec A（spec_get）后直接 Read/Edit 修改 requirements 文件（把"补充用户登录"直接写进现有 Spec 文本），从不调用 task_create/task_create_many → 口径 v2 `FAIL(no-reg)`。无 spec_create(B) 违规（禁止新建遵守）。**结论：G1-G4 E-02 引导修复在 claude 上未改变行为——sha-a 0/5 = sha-b 0/5 = sha-c 0/5，无任务登记出现**。归因主因=模型（claude sonnet-5 把"继续补充"理解为文件直编而非治理流程登记），非工具可用性（task_create 在允许清单且工具 42 项均暴露）。05-00 Profile/输出契约/归一判定未触及该决策点。

### 0b. 判定口径修正说明（复审 9959688 "title 不 gate" 后补充，2026-09-04）

1. **进程模型（Q1 答复）**：本批为**每 session 独立 spawn**——run-shim.cmd 每次 rep 启动一个全新 `npx tsx tests/e2e/t027-baseline/harness-mvp.mjs` 进程（无常驻），单进程 = 单 session = 单 run_id。每个进程在 spawn 时刻读取当时工作区的 harness 代码。修正提交 `9959688`（16:45:27）晚于本批全部 E-02 session（16:32:58–16:40:51），故 5 个 E-02 sha-c session 按时间线运行于修正前代码。
2. **影响核验（Q2/Q3）**：以 session JSONL 的 assistant `tool_use` 事件逐条核验——本批 **5/5 E-02 session 均未调用 task_create / task_create_many（0 次 tool_use）**；判定落在 `judgeE02TaskRegistration` 的 `regCalls.length===0 → FAIL(no-reg)` 早退分支，**从未进入被修正的"单条 task_create + callArgsMatch(title)"分支**。故：修正前后判定结果完全一致（FAIL(no-reg)），**无任何 session 属"scene/spec 命中仅 title 措辞差异"情形，无需改判、无需重跑**。
3. 附带核验（含上一任务 sha-b 批）：sha-b E-02 5/5（l35evm6q/occ7xjev/7kbuctys/ec0dgofc/h4pz9vro）同样 0 次 task_create tool_use，同因不受影响；两批均无 E-02 action_success=false 因 title 措辞的样本。
4. E-06a 判定（合并判定块）不含 title（task_create 出现仅作加分记录，如 avov6w2p 的 task_create_many×2）；E-06b 判定含 B 存在性/破坏动作，均不涉及 judgeE02TaskRegistration → 不受 9959688 影响。
5. 本报告 E-02 5/5 FAIL 判定在修正前后口径下均成立。

### E-06a（执行前改主意；真实续接双轮 resume rounds）
| # | run_id | 合并工具序列 | 续接核验 | exit | 判定 | cost_usd |
|---|--------|----------|----------|------|------|----------|
| 1 | e-06a-1788511396286-kvlyh6zd | project_status → spec_create(B) → Read → **spec_update(归档 B)** → spec_get → Read×2 | ✅同会话 | 1 | ❌ FAIL | 0.3118 |
| 2 | e-06a-1788511458639-76vloe14 | project_status → spec_create(B) → **spec_update(归档 B)** → spec_get | ✅同会话 | 1 | ❌ FAIL | 0.2482 |
| 3 | e-06a-1788511535346-otlh1is5 | scene_list → spec_create(B) → Read → **spec_update(归档 B)** → spec_get → Read×2 | ✅同会话 | 1 | ❌ FAIL | 0.2877 |
| 4 | e-06a-1788511648484-8gqzojmw | project_status → spec_create(B) → Read → Edit → spec_get → **spec_update(归档 B)** → Read×2 | ✅同会话 | 1 | ❌ FAIL | 0.3568 |
| 5 | e-06a-1788511866922-avov6w2p | scene_list → spec_list → spec_create(B) → Read → Edit×3 → spec_get → task_list → **task_create_many×2** | ✅同会话 | 0 | ✅ PASS | 0.5302 |
| **小计** | | | | | **1/5 PASS** | **1.7347** |

> **关键观测点：E-06a "自动归档刚建 B" 模式仍现 4/5**——round2 把 round1 刚创建的 B（02-00-login-risk-control）`spec_update` 归档（success=true），与 sha-a/sha-b 同形态；B3（G1-G4/Profile/契约根治）**未消除该模式**。
> rep5（PASS）是差异化样本：round2 未破坏 B，反而走 `spec_get → task_list → task_create_many×2`（对既有 Spec 登记任务）——sha-b 的两个 PASS 样本均无任务登记，sha-c 该 PASS 出现了真实登记动作（观测项，n=1）。

### E-06b（已执行后改主意；分轮 + B 存在性 sidecar）—— 预算截断 1/5
| # | run_id | 工具序列 | B 存在(round2 后) | exit | 判定 | cost_usd |
|---|--------|----------|----------|------|------|----------|
| 1 | e-06b-1788511948486-3clcp016 | round1: spec_create(B=02-00-login-risk-control)；round2: 无破坏动作 | requirements.md 存在=true, status=draft | 0 | ✅ PASS | 0.3947 |
| **小计** | | | | **1/1 PASS** | | **0.3947** |

> E-06b 仅完成 1/5：累计有效成本 $3.7171 后，再跑第 2 个 E-06b（~$0.39）将突破 $4 预算闸 → 依"超预算即停并报告"停止。剩余 4 reps 未跑。1 个样本上未现"自动归档刚建 B"模式（B 保持 draft），不足以定论。

## 2. 汇总与对照（claude 2.1.228 / sonnet-5）

| 场景 | sha-a (45a86e15) | sha-b (6383e99) | sha-c (918581e) | B3 改进判定 |
|------|------------------|------------------|------------------|-------------|
| E-02 | 0/5（v2 重判一致） | 0/5 | **0/5** | ❌ 无改进（主目标未达成：仍无任务登记） |
| E-06a | 1/5 | 2/5 | **1/5** | ➖ 无改进（"自动归档刚建 B" 4/5 仍现；PASS 样本首次含 task_create_many） |
| E-06b | 3/5 | 3/5 | **1/1**（预算截断） | ⚠️ 样本不足（1/1 PASS，无破坏动作） |

**E-02 是否出现任务登记**：sha-c 5/5 **无**（task_create/task_create_many 一次未调）。旁证：同网关下 sibling opencode sha-c E-02 有 task_create 成功样本，说明工具/判定链路可用——claude 侧缺失归因于模型行为。

**E-06a/b "自动归档刚建 B" 是否仍现**：E-06a 4/5 仍现（与 sha-a/b 同源，B3 修复未消解）；E-06b 1/1 样本未现（不足）。

**归因汇总**：全部 FAIL 均判 **模型行为类**（决策路径/参数）而非引导缺失或工具故障：
- E-02：模型直编文件、绕过任务登记（模型）；
- E-06a：round2 视"先别建了"为撤销 round1 写入并归档 B（模型对多轮语义的解读）；
- 无 ANOMALY（exit 4 零次）、无引导级禁止工具违规、无状态机绕过。

## 3. 验收与成本

- validator strict（11 个 evidence .json，逐批）: **0 ERROR / exit 0**（warnings 为既有类 user_decision_override 恒 true 提示）
- git_sha=918581e（40hex）11/11；sha_label=sha-c 11/11；client 2.1.228 / sonnet-5 11/11；session JSONL 非空；E-06a/E-06b 均含 round1+round2 独立 jsonl + 合并 session（两轮完整入录）
- 成本（有效 sessions）：E-02 $1.5877 + E-06a $1.7347 + E-06b $0.3947 = **$3.7171**（≤ $4 闸）
  - 另有探针会话 1 个（harness git_sha 补丁前产出，证据已删）约 $0.29 及并行 sibling（opencode）会话成本不计入本批
  - 实际 claude 侧总支出 ≈ $4.0x（含探针），达闸即停
- 纪律：证据未 commit（留待 DeepSeek 复审）；证据文件未手改；sha-c worktree 未改动；隔离断言由 harness LRNEV_WORKSPACE=fixture 临时工作区保证（session_clean=true 11/11）；429 未触发

## 4. 证据文件路径清单（40 文件，untracked，registry `.evidences`）
- E-02×5：`tests/e2e/t027-baseline/.evidences/e-02-1788510900956-h5h5rdkp{,-session.jsonl}`、`e-02-1788511031804-5q884vtz{,-session.jsonl}`、`e-02-1788511120657-palnc2ia{,-session.jsonl}`、`e-02-1788511194268-4oaoii5f{,-session.jsonl}`、`e-02-1788511267038-qinp3muh{,-session.jsonl}`
- E-06a×5（每 run：`-session.jsonl`/`-round1.jsonl`/`-round2.jsonl`/`-rounds.jsonl` + `.json`）：`e-06a-1788511396286-kvlyh6zd`、`e-06a-1788511458639-76vloe14`、`e-06a-1788511535346-otlh1is5`、`e-06a-1788511648484-8gqzojmw`、`e-06a-1788511866922-avov6w2p`
- E-06b×1（`-session.jsonl`/`-round1.jsonl`/`-round2.jsonl`/`-e06b.jsonl` + `.json`）：`e-06b-1788511948486-3clcp016`
- 同目录另有 sibling opencode sha-c 会话（client 1.18.18，如 `e-02-…-du7xi7g2/ir2tl2dw/vnd5tjyd/nkseomer/51f4j4ho`）——非本批归属，未纳入任何统计

*生成: 2026-09-04，T-027 B3 claude sha-c 执行 agent；数据未提交，供 DeepSeek 复审*
