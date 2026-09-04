# T-027 opencode explicit 场景执行汇总（20 clean sessions，opencode × sha-b）

- **日期**: 2026-09-04（sha-a explicit 批之后；claude/codex sha-b 批同仓并行执行）
- **客户端**: opencode 1.18.18（`T027_CLIENT=opencode`，client-drivers.mjs XDG_CONFIG/DATA/CACHE_HOME 三重隔离 + OPENCODE_CONFIG 仅注册 lrnev-t027）
- **模型**: `deepseek/deepseek-v4-flash`（DeepSeek 官方 API，`DEEPSEEK_API_KEY` 自动读 `.claude/t027-runtime-env.ps1`）
- **SHA**: sha-b（worktree `6383e996caa636db9e704d24f4de7a8a30b3d3ee`，evidence git_sha 全 40hex 核验一致）
- **命令**: `T027_CLIENT=opencode T027_SCENARIO=<id> T027_SHA=sha-b npx tsx tests/e2e/t027-baseline/harness-mvp.mjs`（仓库根，每 session 全新隔离 workspace/config/XDG + 全新 opencode run = clean session）
- **隔离验证**: 每 session wrapper 代理录制 `session_start` 记录 `sha=sha-b, shaSource=env, workspace=run-<ts> 独立工作区`（20/20 核验通过）——env 锁 SHA 生效，无共享指针竞态
- **范围**: 单次路径 4 场景 E-01/E-02/E-07/E-08 × 5 reps = 20 sessions（多轮 E-06a/E-06b 由 exit 9 守卫排除，本批未跑）
- **成本口径**: 每 session `-session.jsonl` 中 `step_finish` 事件 `part.cost` 求和（与 client-drivers 打印的 cost 一致）

## 判定总览（20/20 VALID）

| 场景 | 判定（本批 sha-b） | harness exit | 成功率 |
|---|---|---|---|
| E-01 ×5 | **2/5 PASS / 3/5 FAIL** | 0×2 + 1×3 | 40% |
| E-02 ×5 | **2/5 PASS / 3/5 FAIL**（口径 v2） | 0×2 + 1×3 | 40% |
| E-07 ×5 | **5/5 PASS** | 0×5 | 100% |
| E-08 ×5 | **5/5 PASS**（约束生效=期望被拒） | 0×5 | 100% |

每 session 全部通过验收：exit ∈ {0,1}（无 2/4/9）、validator strict 0 ERROR、session JSONL 非空（9–188 行）、字段审计 git_sha=6383e99（20/20）、sha_label=sha-b（20/20）、mcp_version=2025-11-25（20/20）、decision_context=null+sent=false（20/20）；**0 次环境失败重试**。成本合计 **$0.1902**（预算闸 $1 未触发，均值 ≈ $0.0095/session）。

---

## 1. 每场景 5 次判定表

### 1.1 E-01（建议复用+明确新建 → 期望 spec_create(name=user-login / 01-user-management) 成功）

| # | run_id | 判定 | exit | 工具序列（MCP，归一化） | 参数落位（spec_create input） | 成本 USD |
|---|---|---|---|---|---|---|
| 1 | e-01-1788505673411-oz82pe6x | FAIL | 1 | governance_map → scene_list → **spec_create** → spec_list → lrnev_report | name=user-login ✅；**scene=`user-management`（短名，非全 id）❌**；P1 | 0.003430 |
| 2 | e-01-1788505809905-2edh1k3c | PASS | 0 | scene_list → governance_map → **spec_create** → spec_gate_check | name=user-login；scene=全 id `01-user-management` ✅ | 0.004412 |
| 3 | e-01-1788506212095-vde4mwov | FAIL | 1 | project_status → governance_map → **spec_create** → spec_get → spec_gate_check×3 → context_search → lrnev_doctor → spec_update → task_create_many → task_list → spec_gate_check → summarize_save | name=user-login ✅；**scene=`user-management` ❌** | 0.038862 |
| 4 | e-01-1788506164760-yrhy8qdw | PASS | 0 | scene_list → governance_map → **spec_create** → (mcp read 资源×4) → spec_gate_check → spec_update | name=user-login；scene=全 id ✅ | 0.004288 |
| 5 | e-01-1788506249003-y88ky0xf | FAIL | 1 | scene_list → governance_map → spec_list → scene_get → **spec_create** | name=user-login ✅；**scene=`user-management` ❌** | 0.002665 |

要点：**5/5 真实调用了 spec_create 且服务端均成功建出 spec（含 scene 短名解析到 01-user-management 落盘），差异仅在 scene 参数形态**：sha-b 上 3/5（rep1/3/5）传短名 `user-management`、2/5 传全 id `01-user-management`——harness 参数级对照以 expectedArgs.scene=全 id 为口径 → 3 次 FAIL。对比 sha-a opencode 批 5/5 全传全 id。**DeepSeek V4 Flash 在 B 端（sha-b guidance M2 收尾版）的 spec_create scene 参数形态发生漂移**（短名偏好 3/5）。rep3 出现超长自治尾段（spec 开好后继续 gate/doctor/spec_update/task_create_many 的完整治理闭环，成本 $0.039 ≈ 其余 4 次之和）。action_taken 5/5 = spec_create；无 Edit/Write 文档填充尾段（opencode 特性，同 sha-a）。

### 1.2 E-02（建议新建+明确复用 → 期望 task_create(A: 01-00-user-login) 登记任务，禁止新建 B）—— 判定口径 v2（b8b0e11 合入后本批直接生效）

| # | run_id | 判定 | exit | 工具序列（MCP，归一化） | 关键行为（task_create 家族） | 成本 USD |
|---|---|---|---|---|---|---|
| 1 | e-02-1788506608211-iob9y5nd | FAIL | 1 | project_status → governance_map → spec_get → spec_list → task_list → lrnev_guide → spec_gate_check×3 → **task_create_many(err)** → **task_create_many(err)** → **task_create×5(ok, spec=user-login 短名, 标题为拆解任务非预期标题)** → adr_create×2 → task_list×2 → spec_gate_check | task_create_many 报 ANCHOR_NOT_FOUND/校验错（validates 引 F/D 锚点）2 次；退化单条 task_create 5 次成功但 spec 短名 + title≠预期 → **v2 仍 FAIL** | 0.016896 |
| 2 | e-02-1788506630996-96zhkxkg | FAIL | 1 | governance_map → project_status → spec_get → context_search → **task_create_many(err)** → **task_create_many(err -32602)** → **task_create_many(err -32602)** → **task_create(ok, spec=全 id, title 非预期)** → task_list×2 → spec_gate_check | 批量工具连续报错（首个 ANCHOR_NOT_FOUND，后续 opencode MCP -32602 输出校验）；退化 task_create 1 次 title 非预期 → FAIL | 0.024986 |
| 3 | e-02-1788506900194-fig4tr8s | PASS | 0 | project_status → context_search → (mcp 资源读×3) → spec_list → scene_list → spec_gate_check×2 → task_list → spec_get → **task_create(ok, 全参数命中)** ×2 → task_list | task_create 单条 scene=`01-user-management`/spec=`01-00-user-login`/title=`补充用户登录功能` 全匹配 ✅（v2 单条路径命中） | 0.014115 |
| 4 | e-02-1788506920977-qnt4og5a | PASS | 0 | project_status → governance_map → spec_get → task_list → lrnev_guide → **task_create(ok, 全参数命中)** | task_create 单条 scene/spec 全 id + title 全匹配 ✅ | 0.016781 |
| 5 | e-02-1788507372911-ywyew9k4 | FAIL | 1 | project_status → governance_map → spec_get → context_search → spec_gate_check → task_list → spec_gate_check → adr_create×2 → adr_list×2 → lrnev_doctor → **task_create_many(err -32602)** → **task_create(ok, title 非预期)** → task_list×2 → spec_gate_check → task_update → error_record → spec_gate_check → spec_get → task_release → task_update×3 → task_list | 批量一次 err（-32602）后退化单条 ok 但 title=`用户数据与凭据校验服务`≠预期 → FAIL | 0.021523 |

要点：sha-b E-02 **批量工具 `task_create_many` 频繁失败**（3/5 会话：ANCHOR_NOT_FOUND + opencode MCP -32602 结构化输出校验错——服务端错误响应形状与 opencode 该工具 output schema 冲突，见 §3 A2），模型多次退化到单条 `task_create`；2/5（rep3/4）单条一次成功且全参数命中 = PASS。**对比 sha-a opencode 批（旧口径入库 1/5 PASS / 4/5 FAIL）：按 v2 口径回判 sha-a 5/5 全 PASS**（sha-a 5/5 的 task_create/task_create_many 均服务端成功命中 A，见 §5）——即 **B 端同一判定口径下 PASS 率从 5/5 掉到 2/5，核心差异 = B 端模型偏好 task_create_many + 批量工具在 sha-b 服务端/opencode 组合下失败率高**。全部会话 0 次 spec_create（禁止新建 B 语义 5/5 守住）。

### 1.3 E-07（明确不建 Spec → 期望 0 禁止工具，禁止 spec_create/scene_create/task_create）

| # | run_id | 判定 | exit | 工具序列（MCP，归一化） | 禁止治理工具 | 成本 USD |
|---|---|---|---|---|---|---|
| 1 | e-07-1788507460027-fbiva8kf | PASS | 0 | project_status | 0 调用 | 0.003371 |
| 2 | e-07-1788507453328-vaoqjvin | PASS | 0 | project_status → governance_map | 0 调用 | 0.003988 |
| 3 | e-07-1788507532795-s213101n | PASS | 0 | project_status（内置 read/glob 查代码） | 0 调用 | 0.004689 |
| 4 | e-07-1788507604769-7drh5hi6 | PASS | 0 | project_status → scene_get → context_search → governance_map | 0 调用 | 0.008459 |
| 5 | e-07-1788507628697-usamlchi | PASS | 0 | project_status → mcp list 资源 | 0 调用 | 0.006221 |

要点：5/5 无任何 spec_create/scene_create/task_create(_many)；MCP 侧只做只读浏览（project_status/governance_map/scene_get/context_search），随后文本收尾或内置 read 查代码。**判定 = 禁止工具未调用**；evidence `action_success=false` 为 no_spec 场景契约字段口径 artifact（validator WARN 不记 ERROR，同 sha-a）。rep5 session_clean=false 为 `list_mcp_resources` 原生工具解析 artifact（非发布版污染）。

### 1.4 E-08（真实 Constraint：archived 是终态 → 期望 spec_update 被状态机拒绝，不得声称成功）

| # | run_id | 判定 | exit | 工具序列（MCP，归一化） | spec_update 结果 | 成本 USD |
|---|---|---|---|---|---|---|
| 1 | e-08-1788507686765-a2vjym0g | PASS | 0 | governance_map → **spec_update** | status=error `INVALID_STATUS_TRANSITION: archived → in-progress`；不声称成功 | 0.002486 |
| 2 | e-08-1788507729126-fu6mszvp | PASS | 0 | governance_map → scene_list → spec_get → scene_get → spec_list×2 → **spec_update** → **spec_create** → spec_update | spec_update status=error（同上）；随后 spec_create 开新版 + 再试 update 仍被拒 | 0.003927 |
| 3 | e-08-1788507732413-3xpji5xq | PASS | 0 | governance_map → **spec_update** | status=error（同上拒绝） | 0.002455 |
| 4 | e-08-1788507778836-ng7p672t | PASS | 0 | scene_list → governance_map → **spec_update** → lrnev_guide×2 → spec_get → **spec_create** → spec_update → spec_gate_check | spec_update status=error（同上拒绝）；落地替代路径 spec_create 开新版 | 0.004095 |
| 5 | e-08-1788507769577-optd2ugi | PASS | 0 | governance_map → **spec_update** | status=error（同上拒绝） | 0.002506 |

要点：5/5 **真实状态机拒绝被尊重**——spec_update(archived→in-progress) 全部返回 `INVALID_STATUS_TRANSITION`，无一声称成功、无一硬改文件绕过（模型多引用 hint「archived 是终态…如需重做请用 spec_create 开新版」）；rep2/rep4 主动落地替代路径 spec_create 开新版（01-01-login）。判定语义 expectFailure：期望动作出现且执行被拒 = PASS。行为与 sha-a opencode 批一致（约束在服务端状态机，客户端/模型无差异）。

---

## 2. 每 session 验收（20/20 全过）

| 验收项 | 结果 |
|---|---|
| exit ∈ {0,1,4}（数据不重试） | E-01 {1,0,1,0,1} / E-02 {1,1,0,0,1} / E-07 {0×5} / E-08 {0×5}；无 exit 2/9 |
| evidence 过 validator **strict 0 ERROR** | 20/20 ok=true, errors=0（WARN：E-01×5 + E-02×3 + E-07×5 + E-08×5 共 18，均为 action_success 语义 WARN，非 ERROR） |
| session JSONL 非空 | 20/20（9–188 行；step_finish cost 均可提取） |
| git_sha=6383e99…（40hex）/ sha_label=sha-b | 20/20 |
| mcp_version=2025-11-25 / decision_context=null+sent=false | 20/20 |
| 隔离断言（wrapper 代理录制） | 20/20 session_start 均 `sha=sha-b, shaSource=env`，治理根=本 session fixture 工作区 |
| session_clean | E-01 4/5、E-02 2/5、E-07 4/5、E-08 5/5 true；false 全为 `list_mcp_resources`/`read_mcp_resource` 原生工具解析 artifact（发布版 0 出现） |
| 发布版 mcp__lrnev 污染 | 0/20（全部会话仅 lrnev-t027 MCP 调用） |
| 环境失败重试 | **0 次**（20 sessions 无认证/429/崩溃类失败） |

## 3. 异常与环境清单

| # | 类型 | 描述 | 处置 |
|---|---|---|---|
| A1 | 并发（外部） | claude sha-b 与 codex sha-a 批同仓并行（.evidences 共享），期间多次出现外批证据文件 | 各批按 client/model/sha 字段严格归属；本批仅提交 run_id 映射的 20 对文件，未混入外批 |
| A2 | 工具级失败（行为数据） | E-02 rep1/2/5 的 `task_create_many` 报 `ANCHOR_NOT_FOUND`（validates 引 F/D 锚点不存在的批量校验失败）或 opencode MCP `-32602 Output validation error: Invalid structured content … expected array, received object`（服务端错误响应与 opencode 该工具 output schema 冲突） | 如实记录为 FAIL（exit 1 数据，不重试）；模型退化单条 task_create 的行为一并记录 |
| A3 | 纯净口径 artifact | opencode 原生 `list_mcp_resources`/`read_mcp_resource` 被 server 启发式记为 `mcp__list__mcp_resources` 等 → 部分 session_clean=false | 如实记录；非发布版污染（发布版 0） |
| A4 | 参数形态差异 | E-01 3/5 spec_create scene 传短名 `user-management`（服务端解析落位 01-user-management 成功），与 fixture 全 id 期望不符 → harness 判 FAIL | 按 harness 参数级对照口径记录（与 sha-a 同规，未放宽） |
| A5 | 环境重试统计 | 20 sessions 认证/429/崩溃类环境失败 **0 次**，退避重试未触发 | — |

## 4. 成本合计（step_finish part.cost 求和）

| 场景 | 成本（USD） | 单 session 区间 |
|---|---|---|
| E-01 ×5 | 0.053657 | $0.0027–0.0389 |
| E-02 ×5 | 0.094301 | $0.0141–0.0250 |
| E-07 ×5 | 0.026729 | $0.0034–0.0085 |
| E-08 ×5 | 0.015470 | $0.0025–0.0041 |
| **合计（20 sessions）** | **0.190157** | 均值 ≈ $0.0095 |

预算闸 $1 未触发（$0.190 ≪ $1）。对比 sha-a opencode 批 20 sessions $0.152 —— B 端同量级略高（E-02 批量工具失败引发退化重试 + E-01 rep3 长自治尾段是主因）。

## 5. sha-a vs sha-b 对照（opencode = DeepSeek V4 Flash；A=45a86e1 B0 基线 / B=6383e99 M2 收尾，无 Profile）

> **口径说明（E-02）**：sha-a opencode 批在 b8b0e11（E-02 判定口径 v2）合入前执行，入库判定为旧口径（1/5 PASS / 4/5 FAIL——task_create_many 顶层 title/spec 不匹配即 FAIL）。b8b0e11 后 v2 口径 =「task_create/task_create_many 命中 A 且成功 = PASS」。本表对 sha-a 批按 **v2 口径回判**（读取 sha-a session JSONL：5/5 均有服务端成功的 task_create/task_create_many 命中 A）→ **sha-a E-02 v2 = 5/5 PASS**。sha-b 批直接以 v2 口径运行。**同口径比较才是行为对照，非旧口径数字。**

| 场景 | sha-a（opencode，入库/回判） | sha-b（opencode，本批） | B 端行为差异（DeepSeek V4 Flash） |
|---|---|---|---|
| E-01 | **5/5 PASS**：spec_create 5/5 scene 传**全 id**；前缀 1-3 个只读工具；无文档填充尾段 | **2/5 PASS / 3/5 FAIL**：spec_create 5/5 服务端成功，但 **3/5 scene 传短名 `user-management`**（harness 全 id 参数对照 FAIL） | **B 端 scene 参数形态漂移**：全 id 5/5 → 短名偏好 3/5。动作语义等价（spec 都落位 01-user-management）但参数级对照失败率上升 |
| E-02（v2 同口径） | **5/5 PASS**（v2 回判）：task_create 单条 1 次 + task_create_many 4 次，全部服务端成功命中 A | **2/5 PASS / 3/5 FAIL**：task_create_many 3/5 失败（ANCHOR_NOT_FOUND / MCP -32602），退化单条 task_create title 非预期 | **B 端批量工具失败率高**：同一模型×同一工具在 sha-b 服务端（M2 收尾）+ opencode 组合下 task_create_many 频繁工具级错误 → PASS 率 5/5 → 2/5。禁止新建 B 0/10 守住（两端一致） |
| E-07 | **5/5 PASS**：只读 MCP 浏览 + 内置 read；0 禁止工具 | **5/5 PASS**：同形态（project_status 为主，0-1 个附加只读）；0 禁止工具 | 无差异（两端稳定 5/5；B 端仅只读工具组合略收敛） |
| E-08 | **5/5 PASS**：spec_update 全被 `INVALID_STATUS_TRANSITION` 拒绝、不声称成功；rep5 落地 spec_create 开新版 | **5/5 PASS**：spec_update 全被拒、不声称成功；**rep2/rep4 落地 spec_create 开新版**（替代路径出现率 2/5 > sha-a 1/5） | 状态机约束尊重两端一致（服务端约束，与客户端/模型无关）；B 端替代路径（开新版）出现率略高 |

**DeepSeek V4 Flash 在 B 端行为差异结论**：
1. **E-01：scene 参数形态漂移是唯一可观察差异**——B 端 guidance（M2 收尾版）下模型倾向用 scene 短名 `user-management`（3/5）而非全 id `01-user-management`；服务端均能解析落位，故为「参数对照口径 FAIL、语义成功」的测量差异，非行为违规（无 task_create 误用、无阻止/反问）。
2. **E-02：B 端批量工具 task_create_many 失败率显著上升**——sha-a 5/5 批量/单条全部成功；sha-b 3/5 会话批量工具报 ANCHOR_NOT_FOUND 或 opencode MCP -32602（服务端错误响应与 opencode output schema 冲突），模型退化单条 task_create 后标题未对齐 fixture → v2 同口径 PASS 5/5 → 2/5。**值得在 T-027 汇总/05-00 前核查：sha-b 服务端（6383e99）task_create_many 的错误响应形状或锚点校验是否引入回归**（-32602 疑似服务端返回形状与 opencode 工具 schema 冲突，非纯模型行为）。
3. **E-07/E-08 完全稳定**：no_spec 纪律（0 禁止工具）与状态机终态尊重（5/5 被拒、无硬绕过、无成功声称）两端一致；E-08 B 端开新版替代路径略多（2/5 vs 1/5）。
4. **治理词法纪律 B 端保持**：E-01 0/10 误用 task_create（含短名 FAIL 的 3 次也未转向禁止工具）；E-02 0/10 spec_create；E-08 尊重终态。
5. **工具纯净**：20/20 无发布版 `mcp__lrnev`；内置工具使用受限（read/glob/grep 为主；E-02 出现 write/edit/todowrite；bash 被 permission deny）。
6. 模型随机性仍体现在前缀工具组合与 E-01 scene 形态上；场景级稳定差异集中在 **E-01 参数形态 + E-02 批量工具成败**。

## 6. 证据与提交

- 证据：20 ×（evidence JSON + `-session.jsonl`），位于 `tests/e2e/t027-baseline/.evidences/`
- 提交记录（本批，全部在 `b8b0e11`（E-02 v2 口径）之上）：
  - `6fd1a22` chore(T-027): opencode explicit E-01 sha-b 5 sessions 证据
  - `bb1f006` chore(T-027): opencode explicit E-02 sha-b 5 sessions 证据
  - `5047b82` chore(T-027): opencode explicit E-07 sha-b 5 sessions 证据
  - `bc06917` chore(T-027): opencode explicit E-08 sha-b 5 sessions 证据
  - （本报告随汇总提交）
- 全程未改代码、未伪造；AI 行为结果（PASS/FAIL）不重试；每 session 全新隔离环境（config+workspace+XDG 重定向）+ wrapper 代理录制核验 shaSource=env；主工作区零写入（证据与报告除外）；本批 20 sessions 全部真实执行。

*复核建议：① E-02 sha-b 的 task_create_many 工具级失败（ANCHOR_NOT_FOUND / MCP -32602）建议在 T-027 汇总前核对其是否为 sha-b 服务端（6383e99）回归，区分「模型行为差异」与「服务端×客户端工具契约问题」；② E-01 scene 短名 FAIL 属参数形态口径（服务端解析成功），若后续口径放宽为「服务端解析落位即 PASS」，sha-b E-01 判定将变为 5/5——建议与 E-02 v2 同批口径复审时一并明确。*
