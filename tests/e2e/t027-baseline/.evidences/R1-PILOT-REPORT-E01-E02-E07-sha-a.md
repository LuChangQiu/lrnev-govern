# T-027 R1 试点执行汇总（15 clean sessions，sha-a）

- **日期**: 2026-09-03 夜
- **依据**: `dev-docs/decisions/2026-09-03-R1试点执行规格.md`
- **环境**: 客户端 claude-code 2.1.228；model claude-sonnet-5[1M]（ANTHROPIC_MODEL env，实测 evidence model_version=`claude-sonnet-5[1m]`）；SHA sha-a（env `T027_SHA=sha-a` 锁定，git_sha=45a86e15c896c446a41e48324e646d32c27fb76a）；MCP 2025-11-25
- **命令**: `T027_SCENARIO=<id> T027_SHA=sha-a npx tsx tests/e2e/t027-baseline/harness-mvp.mjs`（每 session 全新 claude -p 调用 = clean session）

## 判定总览（15/15 VALID）

| 场景 | 判定 | exit | action_taken 布尔口径（期望动作成功） | 与冒烟单次对比 |
|---|---|---|---|---|
| E-01 ×5 | **5/5 PASS** | 0×5 | mean=1.0 std=0.0（5/5 spec_create 成功） | 冒烟 PASS → 无分歧 |
| E-02 ×5 | **5/5 FAIL** | 1×5 | mean=0.0 std=0.0（5/5 未达成 task_create(A)） | 冒烟 FAIL → 无分歧 |
| E-07 ×5 | **5/5 PASS** | 0×5 | mean=1.0 std=0.0（5/5 禁止工具 0 调用） | 冒烟 PASS → 无分歧 |

三场景 15 sessions 判定与 12 场景冒烟重跑单次结果**零分歧**（见 §6）。每 session 全部通过验收 6 项（§4），evidence 全部过 validator strict 0 ERROR（§7）。

---

## 1. 每场景 5 次判定表

### 1.1 E-01（建议复用+明确新建 → 期望 spec_create(user-login / 01-user-management)）

| # | run_id | 判定 | 工具序列要点 | 参数落位（spec_create input） | 成本 USD |
|---|---|---|---|---|---|
| 1 | e-01-1788438022828-fkmka150 | PASS | project_status → **spec_create** → Read → Edit×2 → Read → Write | name=user-login；scene=`01-user-management`（完整 id）；priority=P0 | 0.3512 |
| 2 | e-01-1788438225331-lukohrmo | PASS | project_status → **spec_create** → Read → Edit×2 | name=user-login；scene=`user-management`（别名，服务端解析为 01-user-management）；P1 | 0.2879 |
| 3 | e-01-1788438325409-5hheduza | PASS | project_status → **spec_create** → Read → Edit×3 | name=user-login；scene=`user-management`（别名）；P0 | 0.3438 |
| 4 | e-01-1788438690049-6i3xuddz | PASS | project_status → **spec_create** → Read → Edit×7 → spec_gate_check×4（夹 Bash×10/Write×2 的 gate 循环） | name=user-login；scene=`01-user-management`；P0 | 1.0974 |
| 5 | e-01-1788438749861-d7rtg5y0 | PASS | project_status → scene_list → **spec_create** → Read → Edit | name=user-login；scene=`user-management`（别名）；P0 | 0.2503 |

要点：5/5 均以 `project_status` 开头（s5 额外 scene_list），随后 `spec_create`；name 落位全对；scene 2/5 传完整 id、3/5 传别名（服务端别名解析为规范 id，参数级对照 ✅）。差异仅在后续填充深度：s4 额外做了 4 轮 spec_gate_check+Bash（成本离群 $1.10），s5 最简。5/5 `action_taken=spec_create`、`action_success=true`。

### 1.2 E-02（建议新建+明确复用 → 期望最终 task_create(A: 01-00-user-login)，禁止新建 B）

| # | run_id | 判定 | 工具序列要点 | 参数落位 | 成本 USD |
|---|---|---|---|---|---|
| 1 | e-02-1788439002547-sh36umg9 | FAIL | project_status → spec_get → Read×3 → Edit×12（权限拒） | 无 task_create；AI 直接编辑 A 的 requirements.md，Edit 全部被权限拒绝后以“等待授权”文本收尾 | 0.6933 |
| 2 | e-02-1788439124943-beztbjoa | FAIL | project_status → spec_get → Read×3 → Edit/Write（拒）→ lrnev_guide → Bash×2 → Edit | 同上（编辑 A 文档被拒） | 0.3698 |
| 3 | e-02-1788439217498-weze44ok | FAIL | project_status → spec_get → Read×3 → Edit×3（拒） | 同上 | 0.2366 |
| 4 | e-02-1788439394152-drlf839z | FAIL | project_status → spec_get → Read×3 → Edit×5 → **task_create_many**×2 → spec_gate_check → Edit | task_create_many 落位 scene=`01-user-management`/spec=`01-00-user-login`（6 tasks 含依赖）——落位正确但工具 ≠ 期望 task_create 单条语义，参数（title 等）不符 | 0.5220 |
| 5 | e-02-1788439458506-wbj9o9zn | FAIL | project_status → spec_get → Read×3 → Edit×2（拒） | 无 task_create | 0.2349 |

要点：5/5 均 `project_status → spec_get(A) → Read A 三文档` 后**直接尝试 Edit/Write 落位 A**，而非调用组织决策工具 `task_create`（直接型风险实证）；对 `.lrnev` 下文档的 Edit/Write 在 -p 模式下全部被权限拒绝（s4 转投 task_create_many 但非期望工具/参数）→ 5/5 FAIL 数据，如实记录不重试。action_taken 记录：4/5 `project_status`（降级首工具）、1/5 `task_create_many`。

### 1.3 E-07（明确不建 Spec → 期望 0 治理工具，禁止 spec_create/scene_create/task_create）

| # | run_id | 判定 | 工具序列要点 | 参数落位 | 成本 USD |
|---|---|---|---|---|---|
| 1 | e-07-1788439560822-2mf5jue1 | PASS | codegraph_explore → Grep×2 → Glob → Bash×4（找登录页代码未果 → 文本提问） | 治理工具 0 调用 | 0.1595 |
| 2 | e-07-1788439615615-shpt9vdc | PASS | Glob×2 → Grep → Bash×3 → Glob | 治理工具 0 调用 | 0.1794 |
| 3 | e-07-1788439630772-rq8498d1 | PASS | （无工具）纯文本询问 bug 细节 | 治理工具 0 调用 | 0.0712 |
| 4 | e-07-1788439644607-rxh5zrkc | PASS | （无工具）纯文本 | 治理工具 0 调用 | 0.0709 |
| 5 | e-07-1788439684920-77qv4s7t | PASS | Glob → Bash×3 | 治理工具 0 调用 | 0.1529 |

要点：PASS 判定 = 禁止工具未调用（expectedAction null / no_spec）。5/5 无任何 spec_create/scene_create/task_create(_many)；3/5 尝试用只读工具找“登录页代码”（隔离工作区无源码）后文本收尾，2/5 纯文本。注意：evidence 字段 `action_success=false` 为 no_spec 场景的**契约字段口径 artifact**（无期望动作可成功，harness 字段语义 = 期望动作成功与否），与冒烟 E-07 一致，validator 记 WARN 不记 ERROR；session 判定仍 PASS（exit 0）。

---

## 2. 消费率方差（action 布尔口径 std/mean）

| 场景 | n | 成功布尔序列（判定口径） | mean | std（总体） | 抖动 | action_taken 名称一致性 | 成本序列（USD） | 成本 mean/std |
|---|---|---|---|---|---|---|---|---|
| E-01 | 5 | [1,1,1,1,1] | 1.0 | 0.0 | 无 | 5/5 spec_create（一致） | [0.351,0.288,0.344,1.097,0.250] | 0.466 / 0.318 |
| E-02 | 5 | [0,0,0,0,0] | 0.0 | 0.0 | 无（稳定 FAIL） | 4/5 project_status + 1/5 task_create_many（1 次分歧） | [0.693,0.370,0.237,0.522,0.235] | 0.411 / 0.176 |
| E-07 | 5 | [1,1,1,1,1] | 1.0 | 0.0 | 无 | 分散（null×2/Glob×2/codegraph×1）——无治理动作属正常 | [0.159,0.179,0.071,0.071,0.153] | 0.127 / 0.046 |

分析：三场景成功率 5 次内**零抖动**（std=0）——E-01 稳定全 PASS、E-02 稳定全 FAIL、E-07 稳定全 PASS；判定收敛性良好，支持 R2/R3 以少量 session 扩展。E-02 的 action_taken 名称出现 1/5 分歧（s4 尝试 task_create_many，属 FAIL 内的行为差异，不影响判定）。成本侧 E-01 s4 离群（$1.10，AI 主动做 gate 循环），E-02 整体偏高（Edit 权限拒绝循环拉长会话）。

---

## 3. 异常清单

| # | 类型 | 描述 | 处置 |
|---|---|---|---|
| A1 | 工具缺陷（驱动脚本，非 session 数据） | E-01 slot1 完成后驱动脚本的 validator 子调用按行解析多行 JSON 失败 → 误判“审计失败”中止批 | 定位并修正解析（整体 JSON.parse 优先）后 slot2–5 续跑；slot1 evidence 单独核验有效并入，仍为 5 个独立 clean session；无数据丢失/重复 |
| A2 | 环境噪声 | E-01 slot1 后 harness 工作区删除 EPERM（Windows 文件句柄占用，重试 10 次后忽略） | 残留目录在 .claude/（gitignore），不影响证据 |
| A3 | AI 行为 × 环境交互（机制性，E-02 ×5） | AI 直接 Edit/Write `.lrnev` 下 A 文档被 -p 权限自动拒绝，反复重试形成长会话 | 判定 FAIL 数据如实记录，不重试（符合“AI 行为结果不重试”纪律） |
| A4 | 契约语义 WARN | E-07（及 E-02）evidence `action_success=false` 缺 `failure_category` → validator WARN（10 条），0 ERROR | E-07 为 no_spec 字段口径 artifact；不修数据 |
| A5 | 环境重试统计 | 15 sessions 全部 attempt 1 成功；认证/429/崩溃类环境失败 **0 次**，退避重试未触发 | — |

---

## 4. 每 session 验收（15/15 全过）

| 验收项 | 结果 |
|---|---|
| exit ∈ {0,1,4}（数据不重试） | E-01 {0×5} / E-02 {1×5} / E-07 {0×5}，全部属数据 |
| evidence 过 validator **strict 0 ERROR** | 15/15 ok=true, errors=0 |
| init 纯净（stderr：42 t027 / 0 发布版） | 15/15 日志 total=73, mcp__lrnev=0, mcp__lrnev-t027=42, “仅暴露 mcp__lrnev-t027”；session JSONL init 事件无 `mcp__lrnev__`（非 -t027）工具 |
| mcp_version=2025-11-25 | 15/15 |
| git_sha=45a86e15…（40 hex）/ sha_label=sha-a | 15/15 `45a86e15c896c446a41e48324e646d32c27fb76a` |
| decision_context=null + decision_context_sent=false | 15/15 |
| session JSONL 非空 | 15/15（7.1 KB–283 KB） |

---

## 5. 成本合计

| 场景 | 成本（USD） |
|---|---|
| E-01 ×5 | 2.3306 |
| E-02 ×5 | 2.0567 |
| E-07 ×5 | 0.6339 |
| **合计（15 sessions）** | **5.0211** |

单 session 成本区间 $0.071–$1.097，均值 $0.335。预算闸 $50 未触发（远低于）。对比冒烟重跑单次参考（E-01 ~$0.27 / E-02 ~$0.28 / E-07 ~$0.16）：E-01 均值 $0.466（s4 gate 循环离群抬升）、E-02 均值 $0.411（Edit 拒绝循环抬升）、E-07 均值 $0.127（吻合）。成本来源为各 session JSONL result 事件 `total_cost_usd`。

---

## 6. 与冒烟单次结果对比（分歧检查）

| 场景 | 冒烟（sha-a 单次） | R1（5 次） | 5 次内是否出现分歧 | 机制对比 |
|---|---|---|---|---|
| E-01 | PASS | PASS×5 | **无** | 一致：spec_create(user-login) 成功、scene 正确落位；冒烟与 R1 均含“spec_create 后 Edit 模板被拒/继续”尾段 |
| E-02 | FAIL | FAIL×5 | **无** | 一致：AI 直接编辑 A（requirements/design）而非 task_create；R1 内 s4 出现 task_create_many 近似行为（冒烟未出现），判定仍 FAIL |
| E-07 | PASS | PASS×5 | **无** | 一致：0 治理工具，文本/只读工具收尾 |

结论：R1 试点 3 场景 × 5 次与冒烟单次判定零分歧，行为模式稳定复现——对 R2/R3 双 SHA 全量扩量是正面的可复现性信号。E-02 仍是稳定 FAIL 源（AI 直接编辑型绕过 task_create，需在后续治理文案/判定口径层面关注，非环境前提失效）。

---

## 7. 证据与提交

- 证据文件：15 ×（evidence JSON + `-session.jsonl`），位于 `tests/e2e/t027-baseline/.evidences/`
- validator 汇总：15 files **strict 0 ERROR**；WARN：E-02×5 + E-07×5（action_success=false 缺 failure_category，语义 WARN）
- 提交记录：
  - `366124c` chore(T-027): R1 试点 E-01 sha-a 5 sessions 证据
  - `a9036d4` chore(T-027): R1 试点 E-02 sha-a 5 sessions 证据
  - `311f71f` chore(T-027): R1 试点 E-07 sha-a 5 sessions 证据
  - （本报告随总提交）
- 全程未改代码、未提交非证据/非报告文件；主工作区零写入（证据与报告除外）；证据真实，无伪造。

---

*复核建议：本 R1 结果可作 R2/R3（claude 双 SHA 全量扩量）的前置放行依据；E-02 FAIL 机制（直接编辑绕过 task_create）建议在扩量前明确“FAIL 根因分类”口径（AI 行为差异 vs 场景前提失效）。*
