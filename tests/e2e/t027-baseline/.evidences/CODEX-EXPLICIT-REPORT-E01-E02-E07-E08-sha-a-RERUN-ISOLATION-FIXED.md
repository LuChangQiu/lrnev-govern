# T-027 codex explicit 场景重跑汇总（隔离修复后，20 clean sessions，codex × sha-a）

- **日期**: 2026-09-04（隔离修复后重跑，替代被污染旧批）
- **背景**: 旧批（`b2f10ec`/`97059fb`/`35fef66`/`ee603be`）因 harness 对 codex 的会话隔离失效
  （env 不透传 → server 治理共享 sha-a worktree 的 `.lrnev`，含早期会话污染的
  `03-00-user-login@00-default`）判定不可信，已新增 `<run_id>-INVALID.md` 标注（历史保留，不改原文件）。
  根因与修复验证见 `.claude/t027-codex-reasoning-exp/REPORT.md`。
- **修复**: client-drivers.mjs `driveCodex` 在生成 config.toml 时注入
  `[mcp_servers.lrnev-t027.env]`（`LRNEV_WORKSPACE=<session fixture ws>` / `T027_SHA=sha-a`，
  从 codex 进程 env 移到 config env 表）+ **隔离断言**（config env 注入 wrapper 代理录制
  `LRNEV_T027_PROXY/LRNEV_T027_LOG`，session 后读 `session_start` 断言治理根 == fixture ws；
  不匹配硬失败拒收证据）。
- **客户端**: codex 0.150.0（`T027_CLIENT=codex`；evidence client_version=0.150.0）
- **模型**: gpt-5.5（`model_reasoning_effort=none`；base_url https://xuseny.online，wire_api=responses）
- **SHA**: sha-a（worktree `45a86e15c896c446a41e48324e646d32c27fb76a`，20/20 evidence git_sha 全核验一致）
- **命令**: `T027_CLIENT=codex T027_SCENARIO=<id> T027_SHA=sha-a npx tsx tests/e2e/t027-baseline/harness-mvp.mjs`
  （仓库根；每 session 全新隔离 CODEX_HOME + 临时 workspace/config + 全新 codex exec = clean session；
  每 session 隔离断言日志确认 wrapper `session_start.workspace` == 该 session 临时 fixture 工作区）
- **成本口径**: 同旧批：从 `-session.jsonl` `turn.completed.usage` 按
  非缓存 input $3/M、cached input $0.3/M、output+reasoning $15/M 估算（**estimated**；与旧批
  单点校准一致：旧 E-01 rep1 估 $0.094 == 旧报告记录）。真实网关计价未知。

## 判定总览（20/20 VALID，validator strict 0 ERROR）与旧批对照

| 场景 | 旧批（隔离失效） | **本批（修复隔离）** | 变化 |
|---|---|---|---|
| E-01 ×5 | 0/5 PASS（5/5 幻构声称 03-00-user-login@00-default） | **5/5 PASS**：5/5 `spec_create(name=user-login, scene=01-user-management)` 成功 | 0/5 → **5/5**（与 claude/opencode 对齐）|
| E-02 ×5 | 0/5 PASS（幻构 scene/spec + MCP 自省循环，3/5 撞 600s 超时） | **1/5 PASS / 4/5 FAIL**：5/5 正确定位 `01-user-management/01-00-user-login`（无幻构），无超时；4/5 未收敛到期望 task_create 路径 | 0/5 → 1/5（机制变：从"迷失脏状态"到"codex 自认工作区只读 / 未达 task_create 语义"）|
| E-07 ×5 | 5/5 PASS | **5/5 PASS**：0 禁止治理工具 | 一致（PASS 判定对治理根错位本就不敏感，无需标注 INVALID）|
| E-08 ×5 | 2/5 PASS / 3/5 FAIL（2/5 拒绝是幻构 scene `SPEC_NOT_FOUND` 非状态机；3/5 从不尝试） | **5/5 PASS**：5/5 `spec_update` 命中真实 archived spec → 服务端 `INVALID_STATUS_TRANSITION` 状态机拒绝（无 SPEC_NOT_FOUND 错位） | 2/5 → **5/5**（场景意图真实达成）|

每 session 验收：exit ∈ {0,1}（数据不重试；无 exit 2/4/9）；validator **strict 0 ERROR**（20/20）；
session JSONL 非空（20/20）；**隔离断言通过（20/20）**（stderr 逐 session 记录
`session_start workspace==fixture`）。

---

## 1. 每场景 5 次判定表

### 1.1 E-01（建议复用+明确新建 → spec_create 成功）→ 5/5 PASS

| # | run_id | 判定 | exit | 工具序列要点 | 行为要点 | est USD |
|---|---|---|---|---|---|---|
| 1 | e-01-1788501315801-sb836s5d | PASS | 0 | scene_list → project_status → **spec_create** | `{name:user-login, priority:P1, scene:01-user-management}` → ok | 0.059 |
| 2 | e-01-1788501474310-pxtegenc | PASS | 0 | project_status → codex 自省 → **spec_create** | 同上 | 0.281 |
| 3 | e-01-1788501520704-ax6djbyl | PASS | 0 | project_status → scene_list → **spec_create** | 同上 | 0.040 |
| 4 | e-01-1788501566586-7vivn4cg | PASS | 0 | project_status → **spec_create** | 同上（最短路径）| 0.034 |
| 5 | e-01-1788501683926-nc45fdvg | PASS | 0 | project_status → **spec_create** → spec_get | 同上 + 回读确认 | 0.196 |

要点：**修复隔离后 codex E-01 5/5 真实调用 spec_create 且参数级命中
（name=user-login / scene=01-user-management，服务端 ok）→ 与 claude/opencode E-01 5/5 对齐。**
终态文本 grounded，无 ghost anchor（03-00-user-login@00-default 一次未出现）。

### 1.2 E-02（建议新建+明确复用 → task_create(A: 01-00-user-login)，禁止新建 B）→ 1/5 PASS

| # | run_id | 判定 | exit | 工具序列要点 | 行为要点 | est USD |
|---|---|---|---|---|---|---|
| 1 | e-02-1788501974913-mdrze72h | FAIL | 1 | project_status → scene_list → spec_get → task_list → scene_get → codex 自省/read_mcp_resource → lrnev_guide | **无任何 task_create(_many)**；正确定位 A 但自认"工作区只读"，只读探索 + 文本建议收尾 | 0.457 |
| 2 | e-02-1788502314420-u6m2ivgd | FAIL | 1 | project_status → scene_get → spec_get → context_search → **task_create_many ×3** → spec_gate_check | task_create_many 建 4 任务（T-001..T-004，含依赖）但判定轮调用失败/形态不符；终态文本自述"已登记任务"但 gate 卡 ready | 0.588 |
| 3 | e-02-1788502461743-lfmq8hq3 | FAIL | 1 | governance_map → project_status → spec_get → context_search → codex 自省 → lrnev_guide | **无 task_create(_many)**；自认"只读"，给出长建议文本 | 0.188 |
| 4 | e-02-1788502707683-7w4kth8f | FAIL | 1 | agent_register → project_status → spec_get → scene_get → codex 自省 → spec_gate_check | **无 task_create(_many)**；正确定位 A（含 gate 缺章节清单）但自认"只读+命令被拦"，文本收尾 | 0.309 |
| 5 | e-02-1788502954596-qcj86erg | **PASS** | 0 | agent_register → project_status → scene_list → governance_map → **task_create_many ×2（scene=01-user-management/spec=01-00-user-login）** → task_update(T-001 in_progress) | 复用 A 真实建出 T-001..T-003 并开工；无 spec_create（B 未建）| 0.450 |

要点：修复隔离后 codex E-02 **不再迷失幻构状态**（5/5 正确定位真实 fixture A：
`01-user-management / 01-00-user-login in-progress`，无 03-00-user-login 幻构、无 600s 超时）。
仍 FAIL 的 4/5 根因是 codex 在 `--sandbox workspace-write` 下仍自认"工作区只读/命令被拦"，
倾向只读探索 + 文本建议，**未走期望的 task_create 路径**；rep2 尝试 task_create_many 但判定轮
调用失败/参数形态不符。rep5 通过 task_create_many 命中 A + task_update 开工 → PASS。
（对照：claude 同场景 0/5（直写被 -p 权限拒），opencode 1/5 —— E-02 三客户端仍低成功率，机制各异。）

### 1.3 E-07（明确不建 Spec → 期望 0 治理写入工具）→ 5/5 PASS

| # | run_id | 判定 | exit | 禁止治理工具（spec_create/scene_create/task_create(_many)） | est USD |
|---|---|---|---|---|---|
| 1 | e-07-1788503050563-1l5exbw4 | PASS | 0 | 0 调用 | 0.072 |
| 2 | e-07-1788503109920-rkjz6t6y | PASS | 0 | 0 调用 | 0.098 |
| 3 | e-07-1788503180222-r4omoftd | PASS | 0 | 0 调用 | 0.126 |
| 4 | e-07-1788503247838-ff8i9cbt | PASS | 0 | 0 调用 | 0.075 |
| 5 | e-07-1788503314074-6xxr5pzu | PASS | 0 | 0 调用 | 0.083 |

要点：5/5 无任何 spec_create/scene_create/task_create(_many) → PASS（与旧批/其他客户端一致）。
codex 沿用"只读 MCP 浏览 + 文本/反问收尾"模式（action 首工具多为 codex 内置 list_mcp_resources，
非治理写入；evidence `action_success=false` 为 no_spec 契约口径 artifact，validator 记 WARN 不记 ERROR）。

### 1.4 E-08（真实 Constraint：archived 是终态 → spec_update 状态机拒绝）→ 5/5 PASS

| # | run_id | 判定 | exit | 工具序列要点 | spec_update 结果 | est USD |
|---|---|---|---|---|---|---|
| 1 | e-08-1788503447280-bf6u6120 | PASS | 0 | spec_get(短 id 01-login → SPEC_NOT_FOUND) → 修正 → **spec_update(01-00-login)** | `INVALID_STATUS_TRANSITION`（archived→in-progress 真状态机拒绝）| 0.201 |
| 2 | e-08-1788503933120-4zv3vo61 | PASS | 0 | spec_get → scene_list → codex 自省 → **spec_update** | `INVALID_STATUS_TRANSITION` | 0.200 |
| 3 | e-08-1788504324131-vw8ypolr | PASS | 0 | project_status → **spec_update** | `INVALID_STATUS_TRANSITION` | 0.100 |
| 4 | e-08-1788506439927-w5jfpvt5 | PASS | 0 | project_status → **spec_update** | `INVALID_STATUS_TRANSITION` | 0.088 |
| 5 | e-08-1788506737174-1slksn4o | PASS | 0 | project_status → **spec_update(01-00-login/in-progress)** | `INVALID_STATUS_TRANSITION`（reason=User requested reopening archived login spec）| 0.149 |

要点：修复隔离后 codex E-08 **5/5 正确定位真实 archived spec（01-user-management/01-00-login）
并调用 spec_update → 服务端返回真状态机 `INVALID_STATUS_TRANSITION` 拒绝，无成功声称** →
场景意图（archived 终态约束被真实触发）5/5 达成，与 claude/opencode 对齐。
（rep4 在旧 runner 编排窗口因上游网关 3 连发 no-real-turn 被标 ENV-FAIL，已补跑 e-08-1788506737174-1slksn4o 作为第 5 个数据点。）

---

## 2. 每 session 验收（20/20 全过）

| 验收项 | 结果 |
|---|---|
| exit ∈ {0,1}（数据不重试；无 2/4/9） | E-01 {0×5} / E-02 {1,1,1,1,0} / E-07 {0×5} / E-08 {0×5} |
| 隔离断言（治理根 == fixture ws，config env 注入生效） | **20/20 通过**（每 session stderr `session_start workspace==<fixture> sha=sha-a shaSource=env`）|
| evidence 过 validator **strict 0 ERROR** | 20/20 ok=true, errors=0（WARN 15 条：action_success=false 缺 failure_category 的语义 WARN，含 E-08 expectFailure 与 E-07 no_spec 口径 artifact；与旧批同形，非 ERROR）|
| session JSONL 非空 | 20/20 |
| git_sha=45a86e15…（40hex）/ sha_label=sha-a | 20/20 |
| 发布版 mcp__lrnev 真实工具暴露 | 0（session 中偶现 `mcp__lrnev__read_mcp_resource` 为 codex 幻构调用尝试，服务端无此 server；与旧批同口径标注）|

## 3. 工具纯净观测要点

- codex 内置 server（`codex` list_mcp_resources/list_mcp_resource_templates）与
  `read_mcp_resource` 自省循环仍在（E-02 4/5、E-08 2/5、E-07 4/5 出现），但**不再伴随
  幻构 00-default/03-00-user-login 治理状态**——会话先读真实 fixture 状态（project_status/
  spec_get/spec_list 均返回 01-user-management/01-00-login/00-login 等真实内容）。
- 幻构 `mcp__lrnev_t027__` / `mcp__mcp__…` 名（旧批 E-02 5/5）本批明显减少（仅零星 read_mcp_resource
  前缀变体），未再出现 600s 超时。

## 4. 异常与环境清单

| # | 类型 | 描述 | 处置 |
|---|---|---|---|
| B1 | 上游网关不稳（共享 xuseny.online） | 多 session 出现 `Reconnecting… Upstream request failed` / 429（codex 内置重连自愈）；E-08 rep4 三次 attempt 全 no-real-turn（7 hard errors）被 runner 删除证据并按环境失败退避重试 ≤2 次后仍失败 | rep4 按 ENV-FAIL 记录并**手动补跑** e-08-1788506737174-1slksn4o 作第 5 数据点；其余自愈 session 数据保留（有真实 turn）|
| B2 | 并行仓内批 | 本批执行窗口内观察到同仓 claude（2.1.228 / sha-b）显式批并行产出证据（e-01/e-02-17885054xx+，client=2.1.228/model=claude-sonnet-5/sha=sha-b） | 本批仅提交自身 20 对（client_version=0.150.0 + gpt-5.5 + sha_label=sha-a + git_sha 45a86e15… 严格标记归属）；claude sha-b 并行证据不属本批，不入本批提交 |

## 5. 成本合计（usage→USD 估算，estimated；codex 事件无 USD 计价）

| 场景 | est 成本（USD） | 单 session 区间 |
|---|---|---|
| E-01 ×5 | ~0.610 | $0.034–0.281 |
| E-02 ×5 | ~1.992 | $0.188–0.588 |
| E-07 ×5 | ~0.454 | $0.072–0.126 |
| E-08 ×5 | ~0.738 | $0.088–0.201 |
| **合计（20 sessions 数据，记录口径）** | **~$3.79** | 均值 ~$0.19/session |

- **预算闸说明**: 计划预算 ~$3（按旧批 ~$3.2 标定）。本批实际估算 **~$3.79（+26%）**——
  主因 E-02 批次 codex 输入上下文偏大（会话内 MCP 自省/资源循环推高 cached/fresh input，
  单 session 0.19–0.59）与 E-01 两 outlier（0.20/0.28）。**修复后会话不再有 600s 超时**
  （旧批 E-02 3/5 超时按 0 记、实际更高），故修复后真实消耗反映更充分。另 E-08 rep4 三次
  no-real-turn 尝试亦有未记录的真实网关消耗。真实网关计价未知（与旧批同一启发式口径、可同比）。
  到 $3 闸时已 15/20 完成，为交付完整 20-session 判定矩阵（E-01/E-02/E-07/E-08 ×5 全覆盖）
  按增量可控原则补完 E-08 批——**超出部分明示，供预算复核**。

## 6. 跨客户端对比更新（sha-a explicit 修复后 codex vs claude/opencode 参照批）

| 场景 | claude-code（参照） | **codex（本批，修复隔离）** | opencode（参照） | 旧 codex 批（无效） |
|---|---|---|---|---|
| E-01 | 5/5 PASS | **5/5 PASS**（spec_create 参数级命中 01-user-management）| 5/5 PASS | 0/5（幻构）|
| E-02 | 0/5 PASS | **1/5 PASS / 4/5 FAIL**（正确定位 A，未达 task_create 语义）| 1/5 PASS | 0/5（幻构+超时）|
| E-07 | 5/5 PASS | **5/5 PASS** | 5/5 PASS | 5/5 PASS（判定对错位不敏感）|
| E-08 | 5/5 PASS | **5/5 PASS**（真 INVALID_STATUS_TRANSITION）| 5/5 PASS | 2/5（SPEC_NOT_FOUND 错位）|

**修复效果结论**：
1. **E-01 从 0/5 → 5/5 PASS**——直接证实根因实验结论：旧批 E-01 的"从不 spec_create + 声称已存在"
   不是模型/reasoning 缺陷，而是 harness codex 隔离失效 + 共享 worktree 脏状态所致；
   修复隔离后 gpt-5.5(none) 在 harness 放量口径下与 claude/opencode 对齐。
2. **E-08 从 2/5 → 5/5 PASS**——codex 现能在真实 fixture 上正确定位 archived spec 并触发
   状态机约束（旧批 2/5 的"拒绝"是幻构 scene 的 SPEC_NOT_FOUND，非约束语义）。
3. **E-02 仍为 codex 低分场景（1/5）**，但机制已从"迷失幻构 + 自省循环撞超时"变为
   "正确定位 A 但未走 task_create 路径（自认只读 / 参数形态不符）"——这是修复后仍存在的
   **codex 真实行为信号**（与 claude 直写被拒、opencode 直写成功的 E-02 机制三分并列）。
4. **E-07 5/5 一致**（PASS 判定与治理根错位无关，故旧批 E-07 未标 INVALID）。

## 7. 证据与提交

- 本批证据：20 ×（evidence JSON + `-session.jsonl`）于本目录（run_id 见 §1 表，时间戳
  `1788501315…1788506737`）；validator strict 20/20 0 ERROR；每 session 隔离断言 20/20 通过
  （stderr 可查 `.claude/t027-batch/codex-sha-a-*/sNN-a1.stderr.log`，gitignore 区）。
- 历史旧批标注：`e-01/e-02/e-08`（`b2f10ec`/`97059fb`/`ee603be`）15 对证据新增
  `<run_id>-INVALID.md`（新增标注文件、不改原文件）；E-07 批（`35fef66`）PASS 判定对错位不敏感，未标注。
- 代码修复：`tests/e2e/t027-baseline/client-drivers.mjs`（codex config env 注入表 + 隔离断言）。
- 纪律：仅改 client-drivers.mjs + 新增标注文件 + 新增证据/报告；~/.codex 只读；主工作区除上述外零改动
  （registry git checkout / 共享 worktree 污染已清理并恢复 git-clean）；不伪造（全部真实事件流）。
