# T-027 opencode explicit 场景执行汇总（20 clean sessions，opencode × sha-a）

- **日期**: 2026-09-04（与 claude/codex explicit 批同仓并行执行）
- **客户端**: opencode 1.18.18（`T027_CLIENT=opencode`，client-drivers.mjs XDG_CONFIG/DATA/CACHE_HOME 三重隔离 + OPENCODE_CONFIG 仅注册 lrnev-t027）
- **模型**: `deepseek/deepseek-v4-flash`（DeepSeek 官方 API，`DEEPSEEK_API_KEY` 自动读 `.claude/t027-runtime-env.ps1`）
- **SHA**: sha-a（worktree `45a86e15c896c446a41e48324e646d32c27fb76a`，evidence git_sha 全 40hex 核验一致）
- **命令**: `T027_CLIENT=opencode T027_SCENARIO=<id> T027_SHA=sha-a npx tsx tests/e2e/t027-baseline/harness-mvp.mjs`（仓库根，每 session 全新隔离 workspace/config + 全新 opencode run = clean session）
- **范围**: 单次路径 4 场景 E-01/E-02/E-07/E-08 × 5 reps = 20 sessions（多轮 E-06a/E-06b 由 exit 9 守卫排除，本批未跑）
- **成本口径**: 每 session `-session.jsonl` 中 `step_finish` 事件 `part.cost` 求和（与 client-drivers 打印的 cost 一致）

## 判定总览（20/20 VALID）

| 场景 | 判定 | harness exit | 成功率 |
|---|---|---|---|
| E-01 ×5 | **5/5 PASS** | 0×5 | 100% |
| E-02 ×5 | **1/5 PASS / 4/5 FAIL** | 0×1 + 1×4 | 20% |
| E-07 ×5 | **5/5 PASS** | 0×5 | 100% |
| E-08 ×5 | **5/5 PASS**（约束生效=期望被拒） | 0×5 | 100% |

每 session 全部通过验收 3 项（exit∈{0,1,4}、validator strict 0 ERROR、session JSONL 非空）；成本合计 $0.152（预算闸 $1 未触发，~$0.0076/session）。

---

## 1. 每场景 5 次判定表

### 1.1 E-01（建议复用+明确新建 → 期望 spec_create(name=user-login / 01-user-management) 成功）

| # | run_id | 判定 | exit | 工具序列（MCP，归一化） | 参数落位（spec_create input） | 成本 USD |
|---|---|---|---|---|---|---|
| 1 | e-01-1788488594889-2v4bhv16 | PASS | 0 | scene_list → governance_map → spec_list → **spec_create** → spec_gate_check(creation) | name=user-login；scene=`01-user-management`（全 id）；P1 | 0.003648 |
| 2 | e-01-1788488648750-mjbq4ajw | PASS | 0 | project_status → scene_list → **spec_create** → spec_gate_check(creation) | name=user-login；scene=全 id；P1 | 0.002840 |
| 3 | e-01-1788488725254-v3vvelfa | PASS | 0 | governance_map → scene_list → project_status → **spec_create** → spec_gate_check(ready) | name=user-login；scene=全 id；P0 | 0.005313 |
| 4 | e-01-1788488750189-xa05m0ir | PASS | 0 | governance_map → scene_list → **spec_create** | name=user-login；scene=全 id；（无 priority） | 0.002597 |
| 5 | e-01-1788488809475-qmwx67gi | PASS | 0 | project_status → governance_map → scene_list → **spec_create** → spec_gate_check(ready) → spec_update(status=ready) | name=user-login；scene=全 id；P1 | 0.003769 |

要点：5/5 spec_create 成功且 scene 参数 **5/5 传完整 id** `01-user-management`（claude R1 为 3/5 别名、2/5 全 id）。前缀探索工具在 governance_map/project_status/scene_list/spec_list 间随机（1-3 个）；4/5 在 create 后补 spec_gate_check（creation/ready），1/5 继续 spec_update→ready（draft→ready 合法转换，服务端接受）。无 Edit/Write 填充模板循环（claude 路径的典型尾段在 opencode 未出现——opencode 不填充 spec 文档正文）。session_clean=True ×5（仅 lrnev-t027 MCP；内置 read/glob/grep 不计入纯净）。

### 1.2 E-02（建议新建+明确复用 → 期望最终 task_create(A: 01-00-user-login)，禁止新建 B）

| # | run_id | 判定 | exit | 工具序列（MCP，归一化） | 参数落位 | 成本 USD |
|---|---|---|---|---|---|---|
| 1 | e-02-1788488997665-mbgjajvw | **PASS** | 0 | project_status → governance_map → spec_get → task_list → lrnev_guide → spec_gate_check → **task_create** | scene=`01-user-management`/spec=`01-00-user-login`/title=`补充用户登录功能` 全匹配 ✅ | 0.010931 |
| 2 | e-02-1788489228404-a0eth2nr | FAIL | 1 | project_status → governance_map → spec_get → spec_gate_check → task_list → lrnev_doctor → spec_gate_check → **task_create_many** | task_create_many：scene ✅ 但 spec 顶层=`user-login`（服务端解析 undefined）❌、title 顶层缺失 ❌ | 0.016021 |
| 3 | e-02-1788489417599-8zd727bs | FAIL | 1 | project_status → spec_get → governance_map → memory_search → context_search → lrnev_guide → spec_gate_check → project_status → spec_gate_check → **task_create_many** → task_list → spec_gate_check → spec_update | task_create_many：scene/spec ✅（数组内 spec=`01-00-user-login`），title 顶层缺失 ❌ | 0.014760 |
| 4 | e-02-1788489659821-qsbwse3t | FAIL | 1 | governance_map → project_status → spec_get → task_list → context_search → spec_gate_check → adr_create → **task_create_many** | task_create_many：scene/spec ✅，title 顶层缺失 ❌ | 0.013885 |
| 5 | e-02-1788489923366-y4f6a9oi | FAIL | 1 | governance_map → project_status → spec_get → task_list → context_search → lrnev_guide → governance_map → spec_gate_check → spec_list → spec_gate_check → **task_create_many** → summarize_save | task_create_many：scene/spec ✅，title 顶层缺失 ❌ | 0.011955 |

要点：**opencode 4/5 走 task_create_many（批量工具）而非 task_create 单条**——harness 以子串匹配到 `task_create` 为期望动作出现，但 top-level expectedArgs（spec/title）在 task_create_many 输入形态下不匹配 → FAIL（与 claude R1 s4 task_create_many 判 FAIL 同根因）。**不绕过治理**：5/5 都以治理 task 工具收尾，但 4/5 会话在途中用内置 write/edit **直接写 A 的三文档**（requirements.md/design.md/tasks.md，permission allow 下写成功——rep2/rep4 实证），呈现"直接型 + 批量工具"混合；1/5（rep1）完整走 task_create 单条语义 PASS。action_taken 分歧：1/5 task_create、4/5 task_create_many。

### 1.3 E-07（明确不建 Spec → 期望 0 治理工具，禁止 spec_create/scene_create/task_create）

| # | run_id | 判定 | exit | 工具序列（MCP，归一化） | 禁止治理工具 | 成本 USD |
|---|---|---|---|---|---|---|
| 1 | e-07-1788490573167-ncthaxf4 | PASS | 0 | governance_map → project_status → scene_get → context_search → memory_search → spec_list → task_list（+原生 list_mcp_resources×2） | 0 调用 | 0.029107 |
| 2 | e-07-1788490622774-79ekfd58 | PASS | 0 | project_status | 0 调用 | 0.005724 |
| 3 | e-07-1788490668886-04uqgdyw | PASS | 0 | （原生 list_mcp_resources）→ project_status | 0 调用 | 0.003405 |
| 4 | e-07-1788490739489-99gedwe9 | PASS | 0 | （原生 list_mcp_resources）→ governance_map | 0 调用 | 0.008697 |
| 5 | e-07-1788490836385-jghq73cy | PASS | 0 | project_status | 0 调用 | 0.006653 |

要点：5/5 无任何 spec_create/scene_create/task_create(_many)；MCP 侧只做只读浏览（project_status/governance_map 等），随后文本收尾。**判定 = 禁止工具未调用**；evidence `action_success=false` 为 no_spec 场景契约字段口径 artifact（无期望动作可成功，与 claude E-07 同款，validator 记 WARN 不记 ERROR）。⚠️ rep1 触发客户端 600s 超时被 kill（`T027_CLIENT_TIMEOUT_MS` 上限，driver 记录于 stderr）；kill 前未调用任何禁止治理工具 → harness 判定 PASS（exit 0 数据），如实记录。rep1/3/4 `session_clean=false` 为 **opencode 原生工具 `list_mcp_resources`/`list_mcp_resource_templates` 被 driver 解析为 `mcp__list__mcp_resources`**（server 启发式取首个 `_` 前 token）的纯净口径 artifact——实为客户端自省工具，非发布版 `mcp__lrnev` 污染（发布版 0 出现）。rep2/5 clean=True。

### 1.4 E-08（真实 Constraint：archived 是终态 → 期望 spec_update 被状态机拒绝，不得声称成功）

| # | run_id | 判定 | exit | 工具序列（MCP，归一化） | spec_update 结果 | 成本 USD |
|---|---|---|---|---|---|---|
| 1 | e-08-1788490926630-4gqt00n7 | PASS | 0 | governance_map → **spec_update**(01-00-login→in-progress) | status=**error** `INVALID_STATUS_TRANSITION: archived → in-progress`；模型文本复述"archived 是终态"并提供 spec_create 开新版替代 | 0.002486 |
| 2 | e-08-1788490951949-dkjvbv0v | PASS | 0 | scene_list → governance_map → **spec_update** | status=**error**（同上拒绝） | 0.002532 |
| 3 | e-08-1788490977075-ricuh3uq | PASS | 0 | governance_map → **spec_update** | status=**error**（同上拒绝） | 0.002494 |
| 4 | e-08-1788491000030-x26lb90n | PASS | 0 | governance_map → **spec_update** | status=**error**（同上拒绝） | 0.002434 |
| 5 | e-08-1788491031587-muc116a8 | PASS | 0 | scene_list → spec_get → spec_list → **spec_update**（error）→ **spec_create**(name=login, version=1 → 01-01-login draft) | spec_update status=**error**；随后真实执行替代路径 spec_create 开新版（01-01-login 落盘） | 0.002892 |

要点：5/5 **真实状态机拒绝被尊重**——spec_update(archived→in-progress) 全部返回 `INVALID_STATUS_TRANSITION`，无一声称成功、无一硬改文件绕过状态机（rep1 文本甚至明说"直接手动改文件绕过状态机不推荐"）；rep5 主动落地替代路径（开新版 01-01-login）。判定语义 expectFailure：期望动作出现且执行被拒 = PASS。

---

## 2. 每 session 验收（20/20 全过）

| 验收项 | 结果 |
|---|---|
| exit ∈ {0,1,4}（数据不重试） | E-01 {0×5} / E-02 {0,1,1,1,1} / E-07 {0×5} / E-08 {0×5}；无 exit 2/9，**0 次环境失败重试**（唯一超时见 §3 A2） |
| evidence 过 validator **strict 0 ERROR** | 20/20 ok=true, errors=0（WARN 合计 21：E-01×2 + E-02×6 + E-07×7 + E-08×6，均为 user_decision_override/action_success 语义 WARN，非 ERROR） |
| session JSONL 非空 | 20/20（5.0 KB–254 KB；step_finish cost 均可提取） |
| git_sha=45a86e15…（40hex）/ sha_label=sha-a | 20/20 |
| mcp_version=2025-11-25 / decision_context=null+sent=false | 20/20 |
| session_clean | E-01 5/5、E-02 5/5、E-08 5/5 true；E-07 2/5 true + 3/5 false（`list_mcp_resources` 原生工具解析 artifact，见 §1.3） |
| 发布版 mcp__lrnev 污染 | 0/20（全部会话仅 lrnev-t027 MCP 调用） |

## 3. 异常与环境清单

| # | 类型 | 描述 | 处置 |
|---|---|---|---|
| A1 | 并发隔离（外部） | claude/codex explicit 批同仓并行（.evidences 共享），E-01 期间出现 claude/codex 侧证据文件 | 各批按 client 版本字段/run_id 严格归属；本批仅提交日志映射的 20 对文件，未混入外批 |
| A2 | 环境边界 | E-07 rep1 客户端调用达 600s 超时上限被 driver kill（退出前无禁止工具调用 → harness 判定 PASS exit 0） | 按数据记录不重试（exit∈{0,1,4} 纪律）；成本 $0.029 已含截断前全部 step_finish |
| A3 | 纯净口径 artifact | opencode 原生 `list_mcp_resources`/`list_mcp_resource_templates` 被 driver server 启发式记为 `mcp__list__mcp_resources` → E-07 rep1/3/4 session_clean=false | 如实记录；非发布版污染（发布版 0） |
| A4 | 环境重试统计 | 20 sessions 认证/429/崩溃类环境失败 **0 次**，退避重试未触发 | — |

## 4. 成本合计（step_finish part.cost 求和）

| 场景 | 成本（USD） | 单 session 区间 |
|---|---|---|
| E-01 ×5 | 0.018167 | $0.0026–0.0053 |
| E-02 ×5 | 0.067552 | $0.0109–0.0160 |
| E-07 ×5 | 0.053585 | $0.0034–0.0291 |
| E-08 ×5 | 0.012838 | $0.0024–0.0029 |
| **合计（20 sessions）** | **0.152142** | 均值 ≈ $0.0076 |

预算闸 $1 未触发（$0.152 ≪ $1）。对比：claude 同场景单 session 成本 $0.15–0.63（opencode 便宜约 2 个数量级）；codex E-01 批同量级成本待 codex 侧统计。

## 5. 跨客户端对比要点（sha-a explicit；claude/codex 数据取同仓并行批已提交证据）

| 场景 | claude-code（explicit 批） | codex（explicit 批） | opencode（本批，DeepSeek V4 Flash） |
|---|---|---|---|
| E-01 | **5/5 PASS**：project_status → spec_create → Read/Edit 填充尾段；cost $0.25–0.63 | **0/5 PASS**：仅探索（assess_goal/scene_list/project_status/spec_get），**从未调用 spec_create**，另有上游 stream 断连错误；cost 侧待 codex 统计 | **5/5 PASS**：governance_map/scene_list 前缀 → spec_create（scene 全 id 5/5）→ spec_gate_check；无文档填充尾段；cost $0.0026–0.0053 |
| E-02 | **0/5 PASS**：project_status → spec_get → Read×3 → **直接 Edit/Write A 文档（被 -p 权限拒）**，无 task_create；cost ~$0.25–0.29 | 批未完成（提交时无 E-02 证据） | **1/5 PASS / 4/5 FAIL**：5/5 均以治理 task 工具收尾（1× task_create 全参数命中；4× task_create_many 批量工具、top-level title/spec 不匹配）；途中 4/5 内置 write/edit **直接改写 A 三文档且写成功**（无 claude 式权限墙）→ "直接型绕过"在 opencode 形态 = 成功直写 + 批量工具兜底 |
| E-07 | **5/5 PASS**：纯 Bash/Glob 找登录代码或纯文本；0 治理工具；cost $0.15–0.23 | 仅冒烟单次 PASS（0 工具） | **5/5 PASS**：只读 MCP 浏览 + 内置 glob/read 后文本收尾；0 治理工具；cost $0.0034–0.0291 |
| E-08 | 6 条旧冒烟证据全为 spec_update 尝试 + 状态机拒绝（success=false）= PASS（新 explicit 批未提交） | 批未完成 | **5/5 PASS**：spec_update 全被 `INVALID_STATUS_TRANSITION` 拒绝、不声称成功；rep5 落地替代路径 spec_create 开新版 |

**DeepSeek V4 Flash 行为差异结论**：
1. **E-02 不再"只绕过"**：claude 是"直接编辑 A（被权限拦）→ 停摆"；DeepSeek V4 Flash 在 opencode 里**先直写 A 文档（成功）+ 仍走治理批量工具 task_create_many（参数形态不符）**——绕过方式从"替代 task_create"变为"批量工具近似 + 文档直写"，单条 task_create 语义仅在 1/5 命中。
2. **E-08 状态机拒绝被完全尊重**：5/5 返回 `archived → in-progress` 非法转换错误且无硬绕过、无成功声称；与 claude 冒烟行为一致（约束是服务端状态机，与客户端/模型无关）。
3. **治理词法纪律更强**：E-01 5/5 未触发 forbidden task_create；E-07 5/5 未触发任何禁止治理工具；E-08 尊重终态。
4. **工具纯净**：20/20 无发布版 `mcp__lrnev`；内置工具使用受限（read/glob/grep 为主；E-02 直写场景出现 write/edit/todowrite；E-07 rep1 出现原生 list_mcp_resources 自省调用）。opencode 的 bash 被 permission deny（config `bash: deny`），会话内无 Bash。
5. 模型行为随机性体现在前缀工具组合与工具选择上，但场景级判定在 E-01/E-07/E-08 稳定；E-02 是唯一有判定分歧的场景（1 PASS / 4 FAIL），分歧源是 task_create 单条 vs task_create_many 批量工具选择。

## 6. 证据与提交

- 证据：20 ×（evidence JSON + `-session.jsonl`），位于 `tests/e2e/t027-baseline/.evidences/`
- 提交记录（本批）：
  - `eaf77b0` chore(T-027): opencode explicit E-01 sha-a 5 sessions 证据
  - `46dec65` chore(T-027): opencode explicit E-02 sha-a 5 sessions 证据
  - `f001ad3` chore(T-027): opencode explicit E-07 sha-a 5 sessions 证据
  - `44e1f83` chore(T-027): opencode explicit E-08 sha-a 5 sessions 证据
  - （本报告随汇总提交）
- 全程未改代码、未伪造；AI 行为结果（PASS/FAIL）不重试；每 session 全新隔离环境（config+workspace+XDG 重定向）；主工作区零写入（证据与报告除外）；本批 20 sessions 全部真实执行。

*复核建议：E-02 的 FAIL 根因已从 claude 的"直接编辑（权限拒）"迁移为 opencode 的"批量工具 task_create_many 与单条 task_create 判定口径不匹配 + 文档直写成功"——判定口径层面 task_create_many 是否应算 task_create 的合法批量形态，建议在 T-027 汇总前明确（当前按 fixture.expectedArgs 单条语义判 FAIL）。*
