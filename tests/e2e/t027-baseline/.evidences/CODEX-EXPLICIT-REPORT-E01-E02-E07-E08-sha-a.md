# T-027 codex explicit 场景执行汇总（20 clean sessions，codex × sha-a）

- **日期**: 2026-09-04（与 claude/opencode explicit 批同仓并行执行）
- **客户端**: codex（`T027_CLIENT=codex`，client-drivers.mjs CODEX_HOME 隔离：复制 ~/.codex/auth.json + cc-switch-model-catalog.json，config.toml 仅注册 lrnev-t027 wrapper）
- **模型**: gpt-5.5（`T027_CODEX_MODEL` 默认；base_url https://xuseny.online，wire_api=responses，429 退避内置）
- **版本**: codex 0.150.0（CLIENT_VERSIONS 常量；evidence client_version=0.150.0）
- **SHA**: sha-a（worktree `45a86e15c896c446a41e48324e646d32c27fb76a`，evidence git_sha 40hex 全核验一致；session 级锁 T027_SHA=sha-a）
- **命令**: `T027_CLIENT=codex T027_SCENARIO=<id> T027_SHA=sha-a npx tsx tests/e2e/t027-baseline/harness-mvp.mjs`（仓库根；每 session 全新隔离 CODEX_HOME + 临时 workspace/config + 全新 codex exec = clean session）
- **范围**: 单次路径 4 场景 E-01/E-02/E-07/E-08 × 5 reps = 20 sessions（多轮 E-06a/E-06b 由 harness exit 9 守卫排除——codex 一期不支持多轮语义）
- **成本口径**: 从 `-session.jsonl` 的 `turn.completed.usage`（codex 事件无 USD 计价字段）按 t027-batch-runner COST_RATES 启发式估算：非缓存 input $3/M、cached input $0.3/M、output+reasoning $15/M，标注为 **estimated**；被 driver 超时 kill 的会话（无终态 turn.completed）usage 缺失 → 成本记为 0 并明示低估

## 判定总览（20/20 VALID，validator strict 0 ERROR）

| 场景 | 判定 | harness exit | 成功率 |
|---|---|---|---|
| E-01 ×5 | **0/5 PASS（5/5 FAIL）** | 1×5 | 0% |
| E-02 ×5 | **0/5 PASS（5/5 FAIL）** | 1×5 | 0% |
| E-07 ×5 | **5/5 PASS** | 0×5 | 100% |
| E-08 ×5 | **2/5 PASS / 3/5 FAIL** | 0×2 + 1×3 | 40% |

每 session 全部通过验收 3 项：exit ∈ {0,1,4}（数据不重试）、validator **strict 0 ERROR**（20/20）、session JSONL 非空（20/20）。

---

## 1. 每场景 5 次判定表

### 1.1 E-01（建议复用+明确新建 → 期望 spec_create(name=user-login / 01-user-management) 成功）

| # | run_id | 判定 | exit | 工具序列（MCP，归一化） | 行为要点 | est 成本 USD |
|---|---|---|---|---|---|---|
| 1 | e-01-1788490516930-uxxj72yj | FAIL | 1 | assess_goal → scene_list → project_status → spec_get → spec_list | **0 spec_create**；终态文本声称"已存在 03-00-user-login（Scene 00-default），无需重复创建"（幻构状态） | ~0.094 |
| 2 | e-01-1788490603148-24x3rnm0 | FAIL | 1 | project_status → `mcp__codex__list_mcp_resources` → spec_get → spec_gate_check → scene_get | **0 spec_create**；声称"已确认已有用户登录 Spec 无需重复创建" | ~0.130 |
| 3 | e-01-1788490640022-3rgx2y88 | FAIL | 1 | scene_list → project_status → spec_get | **0 spec_create**；声称"已创建 03-00-user-login… 该 Spec 已存在" | ~0.067 |
| 4 | e-01-1788490742143-wdlh82t1 | FAIL | 1 | agent_register → assess_goal → scene_list → project_status → spec_get | **0 spec_create**；声称"Spec 已存在无需重复创建" | ~0.061 |
| 5 | e-01-1788490816473-ln2jrlsc | FAIL | 1 | project_status → spec_get → scene_get | **0 spec_create**；声称"已开新 Spec 03-00-user-login @ 00-default"（无 spec_create 的"创建成功"声称） | ~0.045 |

要点：**codex E-01 5/5 未调用 spec_create（期望动作 0/5），全部 FAIL**；且 5/5 在终态文本中**虚构/声称** `03-00-user-login @ 00-default` 已存在或已创建——与真实工作区（01-user-management / 00-introduction in-progress）不符的跨 session 一致幻构。对照 claude R1：claude 5/5 走 `project_status → spec_create`（scene 经服务端解析落 01-user-management）PASS。**E-01 是 codex 最尖锐的跨客户端差异场景**。

### 1.2 E-02（建议新建+明确复用 → 期望最终 task_create(A: 01-00-user-login)，禁止新建 B）

| # | run_id | 判定 | exit | 工具序列要点 | 行为要点 | est 成本 USD |
|---|---|---|---|---|---|---|
| 1 | e-02-1788491498917-jgepiiyy | FAIL | 1 | agent_register → project_status → spec_get → task_list → context_search → 幻构 read_mcp_resource 循环（lrnev_t027__/mcp__mcp__lrnev_t027__/`mcp__lrnev__` 名） | 无 task_create；**600s driver 超时被 kill**（终态无 agent_message） | ~0（超时，usage 缺失） |
| 2 | e-02-1788491575558-5dpxpeil | FAIL | 1 | agent_register → scene_list → project_status → governance_map → lrnev_doctor → codex__list_mcp_resources → read_mcp_resource×N | 无 task_create；终态**反问澄清需求**（登录方式/会话方案…） | ~0.193 |
| 3 | e-02-1788492118089-jnqokpi1 | FAIL | 1 | project_status → scene_list → … → **task_create_many** → read_mcp_resource 循环 | task_create_many 目标 scene=`00-default`/spec=`03-00-user-login`（幻构；无 spec_create 前置）→ 服务端 **ok:true 建出 T-001..T-004**（该幻构 spec 被自动落盘）——期望 A=`01-00-user-login` 未命中且无顶层 title 参数 → 参数级 FAIL | ~0.480 |
| 4 | e-02-1788492727085-gj1smipw | FAIL | 1 | project_status → governance_map → spec_get → task_list → context_search → 幻构 read/list_mcp_resources → task_claim → spec_gate_check | 无 task_create；**600s 超时被 kill** | ~0（超时） |
| 5 | e-02-1788493339091-1rbv6i65 | FAIL | 1 | project_status → spec_list ×… → 幻构 `mcp__lrnev__list_mcp_resources` → read_mcp_resource 循环 | 无 task_create；**600s 超时被 kill** | ~0（超时） |

要点：**codex E-02 5/5 FAIL**（claude R1 同为 5/5 FAIL——跨客户端一致，但机制不同：claude 是"直接 Edit/Write A 文档被 -p 权限拒"；codex 是**迷失于幻构 scene/spec 状态 + MCP resource 自省循环**，3/5 撞 600s driver 超时，未收敛到 task_create(A)）。**"E-02 是否也绕过 task_create"**：codex 未出现 claude 式"直写文档绕过"路径（codex 认为文件系统只读，见 E-07）；其行为是**没摸到 task_create 语义就绕圈/超时**，1/5 用 task_create_many 但打在幻构 spec 上。无 spec_create 越禁（5/5 遵守禁止新建 B）。

### 1.3 E-07（明确不建 Spec → 期望 0 治理工具，禁止 spec_create/scene_create/task_create）

| # | run_id | 判定 | exit | 工具序列（MCP，归一化） | 禁止治理工具 | est 成本 USD |
|---|---|---|---|---|---|---|
| 1 | e-07-1788493669403-k6j2yu3j | PASS | 0 | codex__list_mcp_resources → lrnev-t027 read_mcp_resource×N → context_search → project_status → … | 0 调用 | ~0.214 |
| 2 | e-07-1788493782726-6v3bb10w | PASS | 0 | codex__list_mcp_resources → read_mcp_resource×2 | 0 调用 | ~0.097 |
| 3 | e-07-1788493941858-4yk3ptuo | PASS | 0 | codex__list_mcp_resources → read_mcp_resource×N → context_search → … | 0 调用 | ~0.179 |
| 4 | e-07-1788494197174-1amc5a8q | PASS | 0 | codex__list_mcp_resources → read_mcp_resource×N → project_status → spec_get → context_search → … | 0 调用 | ~0.200 |
| 5 | e-07-1788494284235-yvf7dmzo | PASS | 0 | codex__list_mcp_resources → read_mcp_resource×N → context_search → error_search → project_status → governance_map | 0 调用 | ~0.149 |

要点：5/5 无任何 spec_create/scene_create/task_create(_many) → **PASS（与 claude R1 5/5 PASS 一致）**。行为共性：codex 认为"当前工作区只读 / 命令执行被策略拦截"（`--sandbox workspace-write` 下仍持此认知），且找不到登录页源码（隔离工作区无前端代码）→ 2/5 反问 bug 细节、3/5 文本收尾。evidence `action_success=false` 为 no_spec 契约字段口径 artifact（同 claude E-07，validator 记 WARN 不记 ERROR）。

### 1.4 E-08（真实 Constraint：archived 是终态 → 期望 spec_update 被状态机拒绝，不得声称成功）

| # | run_id | 判定 | exit | 工具序列（MCP，归一化） | spec_update 结果 | est 成本 USD |
|---|---|---|---|---|---|---|
| 1 | e-08-1788494416643-qe2dejsx | PASS | 0 | project_status → scene_list → context_search → spec_list×4 → **spec_update** → governance_map → lrnev_report | args scene=`00-default`/spec=`01-login`/status=in-progress → 服务端 `SPEC_NOT_FOUND`（00-default 内无 01-login）→ 拒绝 → expectFailure=PASS | ~0.145 |
| 2 | e-08-1788494623855-3v7oply3 | PASS | 0 | scene_list → governance_map → codex/list/read_mcp_resource 长循环 → **spec_update** → read_mcp_resource 循环 | 同上 `SPEC_NOT_FOUND` 拒绝 → PASS | ~0.520 |
| 3 | e-08-1788494790571-gu2ladh8 | FAIL | 1 | project_status → codex__list_mcp_resources → scene_list → spec_list×4 → spec_get → context_search | **未调用 spec_update**；文本称"找不到 01-login，现有 00-default/03-00-user-login 是 draft 非 archived" | ~0.321 |
| 4 | e-08-1788494878780-k7sklve3 | FAIL | 1 | project_status → spec_list×N → scene_list → … → context_search → lrnev_doctor → read_mcp_resource 循环 | **未调用 spec_update**；文本同上（幻构 03-00-user-login） | ~0.152 |
| 5 | e-08-1788494965771-s4ehl29g | FAIL | 1 | project_status → spec_list → scene_list → context_search → `mcp__lrnev__list_mcp_resources`(幻构) → … → spec_get | **未调用 spec_update**；文本同上 | ~0.156 |

要点：**codex E-08 = 2/5 PASS / 3/5 FAIL**。PASS 的 2 次 spec_update 虽被拒（expectFailure 语义 PASS），但拒绝原因是 **scene=00-default 幻构 → SPEC_NOT_FOUND**，**并非目标 archived→in-progress 状态机拒绝**（codex 从未正确定位 01-user-management/01-00-login）。FAIL 的 3 次**从不尝试 spec_update**，仅文本断言"工作区没有 archived 的 01-login"并向用户反问。对照 claude E-08（同仓并行批 a9539dd）：claude **5/5 调用 spec_update 且正确定位 spec**，服务端全部返回 `INVALID_STATUS_TRANSITION: archived → in-progress`（真状态机拒绝）→ 5/5 PASS。**codex 在 E-08 未能展示"archived 终态约束被正确触发"——场景意图未达成的 5/5。**

---

## 2. 每 session 验收（20/20 全过）

| 验收项 | 结果 |
|---|---|
| exit ∈ {0,1,4}（数据不重试） | E-01 {1×5} / E-02 {1×5} / E-07 {0×5} / E-08 {0,0,1,1,1}；无 exit 2/9 |
| evidence 过 validator **strict 0 ERROR** | 20/20 ok=true, errors=0（WARN 20 条：每条 1 条 semantic WARN = action_success=false 缺 failure_category，含 E-07 no_spec 口径 artifact，非 ERROR） |
| session JSONL 非空 | 20/20（10.5 KB–173 KB） |
| git_sha=45a86e15…（40hex）/ sha_label=sha-a | 20/20 |
| mcp_version=2025-11-25 / decision_context=null+sent=false | 20/20 |
| session_clean（driver 自报口径） | E-01 4/5、E-07 0/5、E-08 1/5、E-02 0/5（详情见 §3 纯净观测） |
| 发布版 mcp__lrnev 真实工具暴露 | 0（隔离 config 仅注册 lrnev-t027；session 中出现的 `mcp__lrnev__*` 均为 codex 幻构的调用尝试，服务端无此 server） |

## 3. 工具纯净观测（client-drivers 观测口径）

- **纯净口径**（driver 自报，写入 evidence session_clean/purityNote）：CODEX_HOME 隔离 config.toml 仅注册 lrnev-t027 + exec 事件流 `mcp_tool_call` 的 server 全集；出现非 lrnev-t027 server 即 session_clean=false。codex 客户端不枚举全部工具（tools 列表=会话观测到的归一化名）。
- **非 lrnev-t027 server 观测**：
  - `codex`（codex 内置 MCP server）——`list_mcp_resources` / `list_mcp_resource_templates`：E-07 5/5、E-08 4/5、E-02 3/5、E-01 1/5 出现；属 codex 原生自省工具，非发布版 lrnev 污染。
  - **幻构 server/tool 名**（codex 对 MCP resources 协议的过度/错误使用，服务端调用必失败）：`mcp__lrnev_t027__read_mcp_resource`（下划线变体）、`mcp__mcp__lrnev_t027__read_mcp_resource`、`mcp__lrnev__read_mcp_resource` / `mcp__lrnev__list_mcp_resources`（发布版前缀名幻构）——E-02 5/5、E-08 2/5 出现；是 session_clean=false 的主要来源，也是**跨 session 一致的 codex 行为缺陷**（对 MCP resources API 的臆测）。
- 发布版 `mcp__lrnev`（非 -t027）真实工具暴露：**0/20**——隔离 config 结构上无发布版 server；幻构调用尝试不代表真实污染，如实标注。

## 4. 异常与环境清单

| # | 类型 | 描述 | 处置 |
|---|---|---|---|
| A1 | 上游网关不稳（共享代理 xuseny.online） | 部分 session stderr/事件流出现 `503 Service Unavailable` / `Reconnecting… stream disconnected`（codex 内置重连 5 次多数自愈）；曾有一次全 turn 失败空会话 | 以"是否完成真实 turn"（turn.completed usage>0 / mcp_tool_call / agent_message）为数据闸；自愈重连会话按数据保留，全失败会话删除证据并按环境失败退避重试（≤2 次） |
| A2 | driver 超时截断（测量窗口） | E-02 rep1/rep4/rep5 撞 600s `T027_CLIENT_TIMEOUT_MS` 被 kill（无终态 usage/agent_message）；E-07/E-08 批已调 900s（batch-runner 对齐），无超时 | 按数据 FAIL 记录（行为未在窗口内收敛 = 真实信号：codex 在 E-02 陷入 resource 自省循环），如实标注超时；成本仅计 JSONL 内已录 usage（超时会话低估） |
| A3 | 并发隔离（外部） | claude/codex/opencode explicit 批**同仓并行**（.evidences 共享，期间观察到 claude/opencode 的 E-01/E-02/E-07 证据文件与活进程） | 各批按 client_version=0.150.0+model=gpt-5.5+sha_label=sha-a+git_sha 标记严格归属；本批仅提交自身 20 对文件；SHA 指针 session 级锁定 sha-a（会话前/后核验一致） |
| A4 | 编排暖机开销 | 本批早期 runner 缺陷（PS5.1 编码/信号误判/证据检测竞态）导致约 6-8 个 codex E-01 会话被删除重跑（证据未入库，成本另计 ~$0.3） | 已修复 runner（pwsh7 + UTF-8 读取 + realTurn 闸）；不计入 20 sessions 判定 |
| A5 | 环境重试统计 | 20 个入库 sessions 全部 attempt 1 成功；环境失败退避重试 0 次（暖机期另见 A4/A1） | — |

## 5. 成本合计（usage→USD 估算，estimated；codex 事件无 USD 计价）

| 场景 | est 成本（USD，JSONL usage 记录） | 单 session 区间 |
|---|---|---|
| E-01 ×5 | ~0.398 | $0.045–0.130 |
| E-02 ×5 | ~0.673（**下限**：rep1/4/5 超时 usage 缺失记 0，实际更高） | $0（超时）–0.480 |
| E-07 ×5 | ~0.840 | $0.097–0.214 |
| E-08 ×5 | ~1.293 | $0.145–0.520 |
| **合计（20 sessions，记录口径）** | **~$3.20**（+超时会话未录用量 + 暖机开销 ~$0.3，真实支出 ≥ ~$3.5） | 均值 ~$0.16/session |

- **预算闸 $3**：按 JSONL usage 估算口径 20 sessions 累计 ~$3.20 **已触及/略超 $3 闸** → 依纪律**停止并报告**（本 cell 4 场景×5 全部执行完毕，无剩余放量；E-02 超时会话与暖机开销使真实支出高于记录值）。注意该口径含假定单价（input $3/M 等），真实网关计价未知；claude R1 同场景实测 $0.07–$1.10/session（result 事件带真实 costUSD）——codex 估算区间 $0.05–$0.52 在同一量级。opencode 批为 $0.0024–0.029/session（DeepSeek 官方 API step_finish cost，便宜约 1-2 个数量级）。

## 6. 跨客户端对比要点（sha-a explicit；claude R1 + 同仓并行批 + opencode 汇总报告）

| 场景 | claude-code | codex（本批，gpt-5.5） | opencode（DeepSeek V4 Flash） |
|---|---|---|---|
| E-01 | **5/5 PASS**：project_status → spec_create（scene 落位 01-user-management）→ Edit 填充尾段 | **0/5 PASS**：5/5 **不调用 spec_create**，终态**幻构声称** 03-00-user-login@00-default 已存在/已创建 | **5/5 PASS**：前缀探索 → spec_create（scene 全 id 5/5）→ spec_gate_check |
| E-02 | **0/5 PASS**：直写 A 文档被 -p 权限拒 → 停摆（无 task_create） | **0/5 PASS**：幻构 scene/spec + MCP resource 自省循环；3/5 撞 600s 超时；1/5 task_create_many 打在幻构 spec；**无 claude 式直写绕过** | **1/5 PASS / 4/5 FAIL**：4/5 task_create_many（参数形态不符）+ 4/5 内置 write/edit 直写 A **成功**（无权限墙） |
| E-07 | **5/5 PASS**：Bash/Glob 找代码或纯文本；0 治理工具 | **5/5 PASS**：0 治理工具；codex 认知"文件系统只读"，只读 MCP 自省 + 文本/反问收尾 | **5/5 PASS**：只读 MCP 浏览 + 文本收尾；0 治理工具 |
| E-08 | **5/5 PASS**（claude explicit 批 a9539dd）：5/5 正确定位 spec 并调用 spec_update → 真状态机 `INVALID_STATUS_TRANSITION` 拒绝 | **2/5 PASS / 3/5 FAIL**：2/5 spec_update 被拒但为**幻构 scene 的 SPEC_NOT_FOUND**（非状态机）；3/5 从不尝试；**5/5 未触达 archived 终态约束语义** | **5/5 PASS**：5/5 spec_update → `INVALID_STATUS_TRANSITION` 拒绝、无成功声称；rep5 落地 spec_create 开新版替代 |

**codex（gpt-5.5）行为差异结论**：
1. **跨 session 一致的幻构锚点 `00-default/03-00-user-login`**：E-01/E-02/E-08 多个 session 无视真实工作区（01-user-management / 00-introduction / 00-login）而虚构"03-00-user-login @ 00-default"已存在/已创建/draft——E-01 直接导致 5/5 不执行 spec_create 却声称创建成功（ghost completion claim），是 codex 与 claude/opencode 最大的行为差异。
2. **MCP resources 协议臆测/自省循环**：codex 大量尝试 `read_mcp_resource`/`list_mcp_resources`（含幻构 server 名 mcp__lrnev__/mcp__lrnev_t027__/mcp__mcp__ 与内置 codex server），E-02 陷入该循环直至 driver 超时；对"用 spec_get/spec_list 读状态"的既有工具集利用不足。
3. **E-07 与 E-02 的"绕过"对照**：codex 自认为文件系统只读、命令被拦 → 无 claude 式/opencode 式"直写 .lrnev 文档绕过治理工具"行为；其 FAIL 根因是"不调用期望工具 + 幻构声称"，而非"绕过"。E-02 三客户端成功率 0%/0%/20%，机制三分。
4. **约束尊重（E-08）**：状态机约束在服务端强制执行，与客户端无关；但 codex 因定位错 spec（幻构 scene）未能把 archived 终态约束"触发到明处"（2/5 拒绝是 not-found，3/5 未尝试）——客户端能否把用户意图映射到正确治理对象，是 E-08 差异的真正来源（claude/opencode 5/5 正确定位）。

## 7. 证据与提交

- 证据文件：20 ×（evidence JSON + `-session.jsonl`）位于 `tests/e2e/t027-baseline/.evidences/`；validator strict 20/20 0 ERROR
- 提交记录：
  - `b2f10ec` chore(T-027): codex explicit E-01 sha-a 5 sessions 证据
  - `97059fb` chore(T-027): codex explicit E-02 sha-a 5 sessions 证据
  - `35fef66` chore(T-027): codex explicit E-07 sha-a 5 sessions 证据
  - `ee603be` chore(T-027): codex explicit E-08 sha-a 5 sessions 证据
  - （本报告随 docs 提交）
- 纪律：未改任何代码；未伪造；AI 行为结果不重试（exit∈{0,1,4} 全部入库）；E-07 判定=禁止工具未调用；工具纯净以 driver 诚实口径记录（含 codex 内置/幻构 MCP 调用的如实标注）；runner/编排辅助脚本放 .claude/（gitignore）不入库。
