# T-027 explicit 场景测试汇总报告 —— claude-code × SHA-B

- **任务**: T-027 explicit 场景测试（claude-code × sha-b × 6 场景 × 5 reps = 30 sessions）
- **客户端**: claude-code（CLI 2.1.228，模型 claude-sonnet-5[1m]，网关 ANTHROPIC_BASE_URL=cc-t2.freemodel.dev）
- **SHA**: sha-b = worktree `.claude/t027-worktrees/sha-b` @ `6383e996caa636db9e704d24f4de7a8a30b3d3ee`（M2 完成 + 收尾版 guidance，无 Profile）
- **场景**: E-01 / E-02 / E-06a / E-06b / E-07 / E-08（E-06a 续接双轮 --resume；E-06b 分轮注入）
- **Harness**: `tests/e2e/t027-baseline/harness-mvp.mjs`（HEAD b8b0e11 含 E-02 判定口径 v2）
- **执行时间**: 2026-09-04 15:02 ~ 15:41 (+0800)
- **判定规则**: exit 0=PASS、1=FAIL、4=轮间/续接异常（均属数据，不重试）；环境失败退避重试 ≤2（本批 0 次触发）；E-07 判定=禁止工具未调（evidence `action_success=false` 为该场景 artifact，忽略）；E-08 期望失败=状态机拒绝即为 PASS

---

## 1. 判定总表（sha-b，30 sessions）

### E-01（建议复用+明确新建；期望 spec_create(B) 于 01-user-management/user-login）
| # | run_id | 工具序列 | evidence.success | exit | 判定 | cost_usd |
|---|--------|----------|------------------|------|------|----------|
| 1 | e-01-1788505430500-bwvftvjb | project_status → spec_create → Read → Edit | true | 0 | ✅ PASS | 0.2561 |
| 2 | e-01-1788505501963-g0sb5hof | project_status → spec_create → Read → Edit | true | 0 | ✅ PASS | 0.2475 |
| 3 | e-01-1788505568067-ej9y8j1v | project_status → spec_create → Read → Read → Edit | true | 0 | ✅ PASS | 0.2539 |
| 4 | e-01-1788505720259-wt9lnjl8 | spec_create(00-default 错 scene) → scene_list → spec_create → …(编辑/检查) | false | 1 | ❌ FAIL | 0.4573 |
| 5 | e-01-1788505746143-d5q88mju | spec_create（scene 参数缺失 → 服务端回退 00-default） | false | 1 | ❌ FAIL | 0.1755 |
| **小计** | | | **3/5 PASS** | | | **1.3904** |

> FAIL 归因（数据，不重试）：#4 首个 spec_create 落在 scene=00-default（服务端解析 00-default、工具失败），经 scene_list 纠正后二次 spec_create 正确；判定取首个 spec_create → FAIL。#5 仅一次 spec_create，scene 参数缺失 → 服务端回退解析为 00-default ≠ 期望 01-user-management → FAIL。两例均"正确决策（spec_create B）+ 参数级偏差"，非工具选择错误。

### E-02（建议新建+明确复用；口径 v2：task_create/task_create_many 命中 A=01-user-management/01-00-user-login 且成功=PASS，禁止 spec_create）
| # | run_id | 工具序列 | evidence.success | exit | 判定 | cost_usd |
|---|--------|----------|------------------|------|------|----------|
| 1 | e-02-1788506241909-l35evm6q | Bash → project_status → spec_get → Read×3 → Edit×4 | false | 1 | ❌ FAIL(no-reg) | 0.2738 |
| 2 | e-02-1788506318325-occ7xjev | project_status → spec_get → Read×3 → Edit×2 | false | 1 | ❌ FAIL(no-reg) | 0.2652 |
| 3 | e-02-1788506403609-7kbuctys | project_status → spec_get → Read×3 → Edit×4 | false | 1 | ❌ FAIL(no-reg) | 0.2967 |
| 4 | e-02-1788506494068-ec0dgofc | scene_list → spec_list → Read×3 → Edit×4 | false | 1 | ❌ FAIL(no-reg) | 0.3067 |
| 5 | e-02-1788506553824-h4pz9vro | project_status → spec_get → Read×3 → Edit×2 | false | 1 | ❌ FAIL(no-reg) | 0.2625 |
| **小计** | | | **0/5 PASS** | | | **1.4049** |

> FAIL 归因：5/5 均未调用 task_create / task_create_many（无任务登记）——模型 spec_get 读取 Spec A 后直接 Read/Edit 编辑 requirements 文件（把补充内容直接写进 Spec），从不走登记动作 → 口径 v2 判定 `FAIL(no-reg)`。禁止的 spec_create(B) 全程未调用（5/5 遵守禁止新建）。

### E-06a（执行前改主意；续接双轮：round1 开新 Spec → round2 "先别建了，在登录 Spec 里补充"）
| # | run_id | 合并工具序列（判定轮 round2） | evidence.success | exit | 判定 | cost_usd |
|---|--------|----------|------------------|------|------|----------|
| 1 | e-06a-1788506630565-owfiosmf | spec_create(B) → context_search → Read（round2 无破坏） | true | 0 | ✅ PASS | 0.3699 |
| 2 | e-06a-1788506685125-bdml9ws5 | spec_create(B) → context_search（round2 无破坏） | true | 0 | ✅ PASS | 0.2159 |
| 3 | e-06a-1788506752948-j817yerc | project_status → spec_create → spec_update(归档 B) → spec_get → Read | false | 1 | ❌ FAIL | 0.2540 |
| 4 | e-06a-1788506825186-e3mn45k0 | project_status → spec_create → Read → Read → spec_update(破坏 B) | false | 1 | ❌ FAIL | 0.2573 |
| 5 | e-06a-1788506887348-5tun2alv | project_status → scene_list → spec_create → spec_update(破坏 B) | false | 1 | ❌ FAIL | 0.2529 |
| **小计** | | | **2/5 PASS** | | | **1.3500** |

> FAIL 归因：round2 模型把"先别建了"理解为需撤销 round1 已创建的 B（spec_update 归档/删除 B = 破坏动作），未执行"保留 B、直接在 A 补充"的期望路径。续接核验 5/5 均确认 round2 为同一会话（session_id 一致）。

### E-06b（已执行后改主意；分轮：round1 开新 Spec → round2 "算了，还是在登录 Spec 里补充"）
| # | run_id | 合并工具序列 | evidence.success | exit | 判定 | cost_usd |
|---|--------|----------|------------------|------|------|----------|
| 1 | e-06b-1788506982091-ht6byghd | project_status → scene_list → spec_create(B)（round2 无破坏） | true | 0 | ✅ PASS | 0.3586 |
| 2 | e-06b-1788507059449-6fh3ysm7 | project_status → spec_create(B) → Read → Edit（round2 无破坏） | true | 0 | ✅ PASS | 0.4046 |
| 3 | e-06b-1788507131314-wfp0eqa9 | project_status → spec_create → scene_list → spec_list → spec_update(归档 B) | false | 1 | ❌ FAIL | 0.4061 |
| 4 | e-06b-1788507199669-n564d73k | project_status → scene_list → spec_create → scene_list → spec_list → spec_update(归档 B) | false | 1 | ❌ FAIL | 0.4050 |
| 5 | e-06b-1788507253991-ubax8k6q | project_status → spec_create(B) → Read（round2 无破坏） | true | 0 | ✅ PASS | 0.3732 |
| **小计** | | | **3/5 PASS** | | | **1.9475** |

> FAIL 归因：round2 中 spec_update 指向 round1 创建的 B（归档）→ 判定=破坏 B → FAIL（与 E-06a FAIL 同源：模型视"改主意"为回滚已执行写入）。

### E-07（明确不建 Spec；判定=禁止工具 spec_create/scene_create/task_create 未调用）
| # | run_id | 工具序列 | 禁止工具 | exit | 判定 | cost_usd |
|---|--------|----------|----------|------|------|----------|
| 1 | e-07-1788507289676-gvmzw42u | （纯文本答复） | NONE | 0 | ✅ PASS | 0.1572 |
| 2 | e-07-1788507327508-5u78oz1v | Bash → Glob → Bash → Bash | NONE | 0 | ✅ PASS | 0.1910 |
| 3 | e-07-1788507346134-dtxjs3jv | （纯文本答复） | NONE | 0 | ✅ PASS | 0.1579 |
| 4 | e-07-1788507383573-hxnbhwh5 | Bash → Glob → Bash → Glob | NONE | 0 | ✅ PASS | 0.2022 |
| 5 | e-07-1788507436015-r1ljv9un | Bash×4 → Glob×2 → Bash×2 | NONE | 0 | ✅ PASS | 0.2218 |
| **小计** | | | | **5/5 PASS** | | **0.9301** |

> evidence.action_success=false 为 no_spec 场景的记录 artifact（task 规定忽略）；以禁止工具未调用为判定：5/5 无 spec_create/scene_create/task_create（纯文本答复或仅 Bash/Glob 探索改代码）。

### E-08（状态机保护：archived Spec 改 in-progress 必须被拒绝）
| # | run_id | 工具序列 | spec_update 被拒 | exit | 判定 | cost_usd |
|---|--------|----------|----------|------|------|----------|
| 1 | e-08-1788507492010-mfdufmtg | spec_update → scene_list → spec_list → spec_update | ✅ | 0 | ✅ PASS | 0.2127 |
| 2 | e-08-1788507535335-pjgacw5r | spec_update → scene_list → spec_list → spec_update | ✅ | 0 | ✅ PASS | 0.2138 |
| 3 | e-08-1788507575289-nc9v24fl | spec_update → scene_list → spec_list → spec_update | ✅ | 0 | ✅ PASS | 0.2176 |
| 4 | e-08-1788507625172-uxpc3sgi | spec_update → scene_list → spec_list → spec_update → Read → Edit | ✅ | 0 | ✅ PASS | 0.2423 |
| 5 | e-08-1788507660199-bf62kzvc | scene_list → spec_list → spec_update | ✅ | 0 | ✅ PASS | 0.2021 |
| **小计** | | | | **5/5 PASS** | | **1.0884** |

> spec_update 尝试均被 archived 状态机拒绝（tool_result is_error=true），模型说明终态/提供替代路径，无虚假成功声明 → 期望失败 = PASS。

---

## 2. 判定汇总 + 成本（sha-b）

| 场景 | PASS | FAIL | 判定方式 | cost_usd |
|------|------|------|----------|----------|
| E-01 | 3/5 | 2/5 | spec_create(B) 成功 + 参数(01-user-management/user-login) | 1.3903 |
| E-02 | 0/5 | 5/5 | 口径 v2：task_create/task_create_many 命中 A 且成功 | 1.4049 |
| E-06a | 2/5 | 3/5 | 续接双轮：B 保留、无破坏动作 | 1.3500 |
| E-06b | 3/5 | 2/5 | 分轮：B 保留、无破坏动作 | 1.9475 |
| E-07 | 5/5 | 0/5 | 禁止工具(spec/scene/task_create)未调用 | 0.9301 |
| E-08 | 5/5 | 0/5 | spec_update 尝试被状态机拒绝 | 1.0885 |
| **合计** | **18/30** | **12/30** | | **8.1113** |

**预算闸**: 30 sessions 有效成本 **$8.11**（预期 $9-11 内，低于 $11 闸）。另有约 5 次 E-01 重复 session 因编排脚本 bug 产生后已删除（未入库），产生约 ~$1.25 额外消耗，实际总支出约 ~$9.4（仍低于 $11）。

---

## 3. 验收汇总（每 session）

| 验收项 | 结果 |
|--------|------|
| exit code ∈ {0,1,4} 数据不重试 | 30/30 达标（exit∈{0,1}；0 次 exit4、0 次 exit2/9、0 超时、0 环境失败重试） |
| evidence 过 validator strict | 30/30 文件 × 单条记录：**errors: 0**（exit 0），warnings 为既有类（user_decision_override 恒 true 等） |
| session JSONL 非空 | 30/30（99~611 行/文件；E-06a/E-06b 含 round1/round2/rounds/e06b sidecar） |
| git_sha = 6383e99… 全 40hex | 30/30 == `6383e996caa636db9e704d24f4de7a8a30b3d3ee` |
| sha_label = sha-b | 30/30 |
| client_version / model | 30/30 claude-code 2.1.228 / claude-sonnet-5[1m]（与 sha-a 同款，单变量仅 SHA） |
| session_clean | 30/30 true（mcp__lrnev 发布版工具 0 污染；仅 lrnev-t027 + codegraph 注册） |

**Validator 明细**: `node scripts/validate-evidence-manifest.mjs --mode strict <30 个 <run_id>.json>` 每批 0 ERROR / 0 有问题 → 全部 PASS。

---

## 4. sha-a vs sha-b 对照分析（claude-code 同客户端）

sha-a 基线取 explicit 5-session 提交（E-01 412e61a / E-02 6ff4f75 / E-06a 3283c3a / E-06b accb55f / E-07 aa61a8e / E-08 a9539dd），同 CLI 2.1.228 / sonnet-5。

### 4.1 判定对照

| 场景 | sha-a（45a86e15, B0 基线） | sha-b（6383e99, M2+收尾） | 差异 |
|------|---------------------------|--------------------------|------|
| E-01 | **5/5 PASS** | **3/5 PASS**（2 FAIL 参数级） | B 端 2 例首个 spec_create 场景参数错（00-default/缺 scene），A 端无此形态 |
| E-02 | **0/5 PASS**（no-reg，v2 重判一致） | **0/5 PASS**（no-reg） | 无口径差异；两侧均 spec_get→直接编辑、无任务登记 |
| E-06a | 1/5 PASS | 2/5 PASS | 相近（FAIL 同形态：round2 归档 round1 的 B）；B 端略好 1 例 |
| E-06b | 3/5 PASS | 3/5 PASS | 无差异（FAIL 同形态：round2 spec_update 归档 B） |
| E-07 | 5/5 PASS | 5/5 PASS | 无差异（禁止工具均未调用） |
| E-08 | 5/5 PASS | 5/5 PASS | 无差异（archived 状态机拒绝均生效） |

### 4.2 重点：08-00 文本迁移（M2 后 guidance）在 B 端的行为影响

08-00 迁移把 guidance 重组为 workflow_overview 指令集（sha-b 源 `src/mcp/guidance.ts` + `src/core/guidance-semantics.ts` 存在而 sha-a 无）。对照证据（claude 2.1.228 / sonnet-5，n=5/侧）：

1. **E-01（建议复用+明确新建）**：决策层无差异——A/B 两端模型均"尊重用户 explicit 新建"，正确调用 spec_create(B)（sha-b 5/5 均出现期望动作，仅 2 例首个调用参数偏差：scene=00-default / scene 缺失被服务端回退 00-default）。B 端 workflow_overview 未改变"spec_create 前先 project_status 核对 scene"的决策结构，未能防止该参数级失误（该失误在 A 端样本中未出现，n=5 不足以定论为 guidance 回归，记录为观察项，建议后续加大样本）。
2. **E-02（建议新建+明确复用）**：A/B 无行为差异且均 FAIL(no-reg)。**spec_get followup 对照**：
   - sha-a：project_status → spec_get → Read×3 → Edit×2~3（kw9f9vww 尾部追加 Write）；
   - sha-b：project_status → spec_get → Read×3 → Edit×2~4（l35evm6q 前置 Bash 定位），ec0dgofc 用 scene_list/spec_list 替代 spec_get。
   两侧 followup 结构一致：spec_get 读取 A 后**直接编辑 requirements 文件**而非登记任务——B 端 guidance 未把"已有特性增量→落位 spec 后 task_create 登记"转化为可执行动作（模型绕过登记直接改文件）。sha-b 无 spec_create(B) 违规。结论：**E-02 的 spec_get 在 sha-b 无口径级 followup 差异**（均无登记、均 FAIL）；且 sha-a 证据在 v1 口径记录，v2 重判（无 task_create 调用 → 无登记）结果不变。
3. **E-07（明确不建 Spec）**：A/B 均 5/5 不调用治理工具——B 端 guidance 未在 no_spec 场景诱发 spec_create/task_create（用户 explicit 覆盖有效）。B 端 3/5 用了 Bash/Glob（探索改代码路径），A 端 2/5 类似，属正常"直接改代码"执行。
4. **E-08（状态机保护）**：A/B 均 5/5——spec_update 对 archived 的拒绝来自服务端状态机（两端同源逻辑），guidance 迁移未影响。B 端模型同样如实报告终态、不声称成功。
5. **E-06a/E-06b（改主意场景）**：B 端 PASS 率不劣于 A 端（E-06a 1/5→2/5；E-06b 3/5 持平）。核心 FAIL 形态（round2 把 round1 抢跑/已执行的 B 归档回滚）A/B 相同，**M2 收尾 guidance 未消解"改主意=回滚已执行写入"的误解读**（模型仍视 round2 为对 round1 动作的撤销）。

### 4.3 结论（单变量 B 端行为等价性）

- **等价保持**：E-02（FAIL 形态）、E-06b（3/5）、E-07（5/5）、E-08（5/5）A/B 行为一致；约束类场景（E-07/E-08）B 端无劣化。
- **观察差异**：E-01 B 端 3/5 vs A 端 5/5（2 例参数级失误，n=5 非显著，需加量确认）；E-06a B 端 2/5 vs A 端 1/5（略好，同样小样本）。
- **口径注意**：sha-a E-02 evidence 运行于 b8b0e11（v2 判定）之前，本报告按 v2 重判口径读原始工具序列，结论一致（无登记→FAIL）。
- 08-00 文本迁移未在 B 端引发任何新的禁止工具调用或状态机绕过。

---

## 5. 纪律与数据完整性

- **零代码改动**：未修改任何 tracked 文件（工作区既有 `client-drivers.mjs`/`.lrnev/agents/registry.json` 的本地改动属并行 codex agent，未纳入任何提交；提交仅含本次 evidence + 本报告）。
- **AI 行为不重试**：30 sessions 判定结果全部原样入库，无重跑。
- **并行证据归属**：本次证据与并行 agent 产出（codex sha-a 隔离修复后重跑、opencode sha-b）在 `.evidences/` 共存，全部按 run_id + client_version（claude 2.1.228 / codex 0.150.0 / opencode deepseek-v4-flash）严格区分，git add 仅精确到本次 run_id 文件。
- **编排 bug 处理（透明披露）**：E-02 批次曾因脚本 T027_SCENARIO 传递失效误跑出 5 个 E-01 重复 session（claude，全 PASS）——已修复脚本并删除该 5 对未入库重复文件（不纳入 E-01 计数），E-01 判定表只含规划内 5 sessions；opencode agent 同期产出 1 个 E-01 sha-b 会话（e-01-1788505809905-2edh1k3c）未被误纳。
- 每场景判定均为 `exit∈{0,1}` + validator strict 0 ERROR + 字段审计通过后才 commit。

**证据 commits**：
| 场景 | commit | 文件数 |
|------|--------|--------|
| E-01 | `1e7210e` | 10 |
| E-02 | `601e0fd` | 10 |
| E-06a | `a8483b3` | 25 |
| E-06b | `8ffa0e0` | 25 |
| E-07 | `e221882` | 10 |
| E-08 | `3b8d962` | 10 |

*生成: 2026-09-04, T-027 claude sha-b 执行 agent*
