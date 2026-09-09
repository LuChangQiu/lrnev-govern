# MCP 接入与流程测试（真实客户端实测清单 / F-14）

> 定位：自动化测试覆盖"实现是否符合契约"，本清单覆盖**它们测不到的部分**——真实客户端的 MCP 握手与工具呈现、`content[0].text` 渲染文本的模型可读性（双通道快照）、ai_followup 是否真能驱动 AI 行动、真机体验。
>
> 3.0.0 实况：契约面已由全量 `npm test`（**1079 条 / 81 文件**，见"十三、发布门禁与自动化覆盖"）锁死；3.0.0 发布前的真机对照（T-027 B3/B4）已在 claude-code / opencode 上完成一轮，判定结论与录制件位置见"十、T-027 真机对照资产"。本清单是**发布前真机走查基线**：至少在一个真实客户端上把"三、黄金路径"与"九、体验层"过一遍，其余条目按变更面抽查——已被 T-027 判定的项不必重复盲测。
>
> 测试方式：在真实 Claude Code / opencode / Codex / Cursor 里接入本地 `lrnev-mcp`（发布前未上 npm 也可用本地路径），在一个**全新真实项目**里逐项验证。
> 标记：✅ 通过 / ⚠️ 卡在某步（注明）/ ❌ 无法走通；带〔自动〕的条目已纳入 `npm test` 覆盖，走查时抽核即可。

---

## 一、AI 客户端接入 MCP

### Claude Code
`claude_desktop_config.json` 或项目级 `.mcp.json`：
```json
{ "mcpServers": { "lrnev": { "command": "lrnev-mcp" } } }
```
发布前用本地构建：`"command": "node", "args": ["<repo>/product/lrnev-govern/bin/lrnev-mcp.mjs"]`。
重启后在对话中验证：`调 lrnev_guide 看看有哪些能力`。3.0.0 起可加 `--profile core` 体验裁剪面（弱模型/工具面板拥挤场景）。

### Cursor / Codex / 其他 MCP 客户端
只要实现 MCP 工具调用，配 `command: lrnev-mcp` 即可。T-027 真机用过的三份现成配置在 `tests/e2e/t027-baseline/`（`claude-code-config.json` / `opencode-config.md` / `codex-config.toml`，server 指向 wrapper.mjs），发布前接入可直接复制。

### 不接 MCP 直接用 CLI
```bash
npm install -g lrnev      # 发布前：cd product/lrnev-govern && npm link
lrnev init                # 不传名时默认用当前文件夹名
lrnev --help
```

---

## 二、协议接入层（契约已自动化兜底；真机看"呈现与迁入"）

- [ ] **握手**：client 连上 `lrnev-mcp` stdio，不报错、不超时。〔自动：`mcp-stdio-lifecycle` 真子进程用例；`server-lifecycle` 进程内〕
- [ ] **工具发现**：`tools/list` 默认返回 **42 个**工具；`--profile core` 起服时只返回 **33 个**（差恰为 9 个：`agent_*` 自动面 4 + `lrnev_hook_*` 配置面 5，见"四"）。〔自动：`tests/integration/mcp-protocol-contract.test.ts` 断言 42 工具全带 `outputSchema`；`tests/unit/mcp-profile.test.ts` 断言 42/33 集合差〕
- [ ] **列表负向核对**：列表里**没有** `adr_suggest`（历版已删）、没有 `lock_acquire/lock_release/lock_list`。
- [ ] **输出契约（3.0.0 破坏性变更，迁入方必核）**：同一调用返回 `structuredContent`（canonical 信封 `response_version:'1'` / `ok` / `data` / `errors` / `ai_followup`）与 `content[0].text`（逐工具 ModelVisibleContract 渲染文本，**不再是 JSON**）；曾 `JSON.parse(content[0].text)` 的接入方改读 `structuredContent` 后行为不变。〔自动：`data-output-contract`（双通道严格镜像）、`response-envelope`、`model-visible-contract`、`renderers/batch1~4`〕
- [ ] **描述渲染**：每个工具 description 可见且含"何时用"；档位标记 `[核心]/[自动]/[配置]` 与 `--profile` 分层一致。
- [ ] **isError 统一**：`ok:false` 的业务拒绝（参数错误、状态机冲突、歧义引用 AMBIGUOUS_REF、内部错误）在真实客户端里一律显示为失败，不再被误判成功。〔自动：协议错误类别矩阵〕
- [ ] **会话稳定**：长对话多次调用不掉线、不串话（自动化覆盖到真 stdio 会话长度，更长对话仍是真机项）。
- [ ] **资源（若暴露）**：`context://` 资源能 list/read。

---

## 三、完整生命周期黄金路径（端到端真机走查）

```
1. lrnev_init（不传名）   → .lrnev/ 骨架 + steering/ + PROJECT/ARCHITECTURE 静态 FILL 骨架
2. scene_create          → 三文档 + followup 给出拆分标尺（见五）
3. spec_create user-login → 不传 scene 自动挂 00-default；生成 requirements/design/tasks
4. AI 填 requirements     → 替换所有 FILL 哨兵，填 L0/L1/L2（真机项：AI 是否真填）
5. spec_gate_check ready  → 未填哨兵时 passed=false 并拦；填了 passed=true，followup 含 EARS 示范 + ADR 提示
6. task_create "实现登录" → validates=F-01 写入 meta
7. task_update in_progress → 自动 claim；followup 含"先回看 F-01"（3.0.0：锚点上下文同时进渲染文本，见六-8）
8. task_update completed   → 状态机校验通过；自动 release
9. project_status         → 只返活任务 + 计数 + claimable_next，不随历史膨胀
10. spec_gate_check completion → 全任务完成才 passed=true
11. lrnev_doctor          → 无异常或仅预期 warning
```

> 注：各步的状态机/校验/落盘行为均已自动化（unit/integration），本路径的真机价值在 **2/4/5/7 里"AI 是否真的照 followup 行动"**。走查时按 3.0.0 契约核对返回：每步的 content 渲染文本可读、可行动，且与 structuredContent 数据一致。

---

## 四、各能力域逐项（42 工具全景）

| 域 | 工具 | 看什么 |
|----|------|--------|
| 接入/引导 | `lrnev_init` `lrnev_guide` `project_status` `governance_map` `lrnev_report` | guide 四档（workflow/tools/errors/concepts）都能返回；接手快照可读（含 claimable 预览截断说明）；治理地图全景；report 治理债口径 |
| Scene | `scene_create` `scene_list` `scene_get` | 序号自增、三文档、统计正确 |
| Spec | `spec_create` `spec_list` `spec_get` `spec_update` `spec_gate_check` | 三档 gate(creation/ready/completion)语义各自正确；状态机回填；spec_get 分层引导（见六-9） |
| Task | `task_create` `task_create_many` `task_update` `task_list` `task_claim` `task_release` | 状态机、子任务 parent、claim/release；批量原子创建（key 依赖、整批拒绝、错误明细、`query_meta` 同构返回） |
| 目标评估 | `assess_goal` | single-spec / multi-spec-program / research-program 三类 |
| ADR | `adr_create` `adr_list` `adr_get` | scope(global/scene)、索引更新 |
| 错误手册 | `error_record` `error_search` `error_promote` | 指纹去重；incident→promoted 需 verification |
| 记忆 | `memory_save` `memory_search` `memory_forget` `session_commit` | source 必填、同类去重、批量沉淀 |
| 检索/摘要 | `context_search` `summarize_save` | 目录优先、L0/L1；截断时返回 `query_meta`（见六-6） |
| 多 Agent（[自动]，core 不注册） | `agent_register` `agent_heartbeat` `agent_list` `agent_unregister` | 注册/心跳/active-dead/注销；register 机会式 GC（`data.gc` 字段） |
| Hooks（[配置]，core 不注册） | `lrnev_hook_list` `lrnev_hook_trigger` `lrnev_hook_enable` `lrnev_hook_disable` `lrnev_hook_tail_log` | 配置生效、手动触发、启停；drain 语义与 `tail_log` 排查（见六-7） |
| 诊断 | `lrnev_doctor` | 结构/断链/stale claim/hook/agent 检查（core 保留，见 `core` 手册行级裁剪口径） |

> `--profile` 分层：`full`（默认）42 = `core` 33 + 9 个"AI 不该主动选"（`agent_register/heartbeat/list/unregister` + `lrnev_hook_list/trigger/enable/disable/tail_log`）。guide/instructions 手册随 profile 行级裁剪，不指引不存在工具。

**多窗口防撞**（具体步骤）：
```
1. agent-A register + task_claim T-001
2. agent-B claim 同一 T-001 → 返回 conflict 软提示，不硬阻止
3. agent-C claim 同 Spec 的 T-002 → 成功，互不干扰
4. agent-A 心跳停止 → claim 过期
5. project_status → active_agents 显示活跃 claim；claimable_next 不含活跃 claim
```
> 〔自动〕连接自动注册 / 并发存活 / touches 重叠告警 / 优雅断开自动注销并释放 claim 已由 `mcp-stdio-lifecycle`（真子进程）覆盖；真机只需做**跨客户端**（两个真实产品窗口同时挂同一工作区）复测。

**子任务并行**（具体步骤）：
```
1. task_create 父任务 → T-001
2. task_create 子任务1 --parent T-001
3. task_create 子任务2 --parent T-001
4. task_list → children 按创建顺序嵌套
5. 并发 update 两个子任务 → 不互相覆盖；全部完成时提示父任务可关闭
```

---

## 五、历版行为回归面（v2.1~v2.3 引入，3.0.0 常规回归）

- [ ] **scene_create 拆分标尺**：传含"以及/同时/多个/端到端"的 `intent` → followup 出现三条标尺(独立验收 / 共享验收标准 / 需否调研) + **multi 辅助信号** + 建议 `assess_goal`；不传 `intent` 或单一特性时引导仍在。〔自动：`guidance-*`/`scene` 系列锁文案语义；真机残留=AI 响应质量〕
- [ ] **lrnev 不自动建 Spec**——只给文字引导（真机残留：模型是否尊重该边界）。
- [ ] **task_create 子任务引导**：拆 task 节点时提示"大项可用 `parent` 拆子任务"。
- [ ] **task_claim touches_files**：多 agent 上下文提示声明 `touches_files`；单 agent 不提示。声明后两窗口改同文件 → 重叠警告（不阻止、不锁源码）。〔自动：stdio-lifecycle touches 重叠；真机残留=真实双窗口体验〕
- [ ] **需求审核门**：ready 通过后 followup 有"请暂停给用户确认"引导；`completion` gate 前无条件提示"先填 design FILL"。
- [ ] **`.lrnev/` 目录分层**：config=hooks.json、state=hook-log、runtime/claims=占用，各归其位。
- [ ] **register 机会式 GC**：多开/重连后无打扰；只有实际清理时才出现 `data.gc` 字段。
- [ ] v2.3 三客户端盲测细节（`was_new` 以 PROJECT.md 判定、claimable 透明化等）与结论见 `dev-docs/archive/E2E-REPORT-{CLAUDE,CODEX,OPENCODE}-V23-2026-07-06.md`；历版自动化增量见各版 CHANGELOG Tests 节。

---

## 六、v3.0.0 验证面（契约已锁；真机残留点标注）

1. **双通道 MVC（42 工具渲染器 + `__error__` 错误渲染器 = 43 项）**：content 渲染文本与 structuredContent 数据一致；错误路径也经 `__error__` 统一出口渲染（D-04.1 逃逸契约）。〔自动：`model-visible-contract`、`renderers/batch1~4`、`data-output-contract`、`response-envelope`〕真机残留：逐工具**渲染文本快照抽查**——在真实客户端里读起来通顺、不裸抛 JSON、不丢"何时用"。
2. **isError 统一**：`ok:false` 一律 `isError:true`；`INTERNAL_ERROR` 不回传异常原文。〔自动〕真机残留：客户端失败标注形态。
3. **错误路径统一转义**：错误 message/hint 含用户可控文本时经统一转义出口。〔自动：`tool-result-adapter-escape`、`errors`〕真机残留：含 `</` 的用户文本在真实客户端里不闭合框架标签。
4. **decision_context 负向校验**：`scene_create`/`spec_create`/`task_create`/`assess_goal` 传非法 context（如 explicit 缺 direction）→ `INVALID_INPUT` 拒绝；模型据错误自纠后成功；不传 = 未声明，行为不变。〔自动：`decision-context-schema`/`decision-context-alignment`/`decision-context-tools`〕真机残留：模型收到拒绝后能否自纠。
5. **`--profile core|full`**：42/33 集合差恰为 9；core 下对应工具不可调、其余行为不受影响；guide/instructions 与档位标记同步。〔自动：`mcp-profile`、`guidance-profile`、`guidance-profile-mounting`〕真机残留：core 起服后客户端面板与手册实际呈现。
6. **F-04 截断元数据**：`anchor_context`/`summary_context` 截断标记升级为 `meta` 三态（`text_status: complete | truncated_by_budget | incomplete_source` + 长度三件套）；`context_search`/`project_status`（claimable_preview）/`task_create_many` 返回 `query_meta`（`returned_count`/`total_count`/`truncated`/`omitted: none|exact+count|unknown`）；MVC 文本与结构化两通道同步（截断追加省略提示行）。〔自动：F-04.1/F-04.2 用例〕真机残留：超长锚点/残缺源段落场景下，真实客户端文本里能看到截断标注且提示可行动。
7. **hook drain（ADR-0003）**：async hook 触发**先写 `invoked`** 记录；进程退出（stdio 断开/SIGINT/SIGTERM）统一 drain ≤5s，超时未完成补写 `timed_out`（保留触发原事件）；HookStatus 五态 `success|failed|timeout|invoked|timed_out`；doctor 健康统计剔除 invoked 脚手架；`lrnev_hook_tail_log` 是排查唯一手段。〔自动：`hook-quiescence` 六用例 + `hook-runner`/`hook-log`〕真机残留：真实 hook 进程退出后日志终态（可选复测）。
8. **task_update(in_progress)/task_claim 渲染器投影锚点上下文**：envelope 顶层 `anchor_context`/`summary_context` 投影进 `content[0].text`（正文 + 截断状态标注）——修复"只看 content 文本的客户端读不到任务启动上下文而 ai_followup 又指引它"的悬空（F-03 content-only 闭环，opencode 真机发现并验证）。〔自动：投影闭环用例（收口窗口 +3）〕真机残留：content-only 客户端确实读得到、可行动。
9. **spec_get 分层引导 + 归档边界（G5）**：未完成 Spec 给"开发/扩展请求先 `task_create` 登记"【决策边界】引导；archived 为终态、只由用户决定——用户改主意不构成自动归档依据。〔自动：`guidance-*`、`guidance-archive-boundary`、`guidance-scenario-boundary`〕真机判定：B4 实测 E-06a 归档率 4/5→0/5（见十）。
10. **工具档位标记**：description 带 `[核心]/[自动]/[配置]`，与 `--profile` 分层一致（模型可判断"该不该主动选"）。〔自动：`tool-descriptions`〕真机残留：面板可见性。

---

## 七、边界与错误处理（自救体验）

- [ ] **ready gate 未过**：checks 含 name/message/**hint**，AI 能照 hint 修（〔自动〕gate 内容已锁；"AI 能照修"为真机残留）。
- [ ] **非法状态跃迁**(pending 直接 completed) → `INVALID_STATUS_TRANSITION` + 可读 hint。〔自动〕
- [ ] **AMBIGUOUS_REF**(scene/spec 简写有歧义) → 返回 candidates + isError，AI 选完整 id 重试。〔自动〕
- [ ] **completion gate 未过**(有未完成 task) → 提示去 task_list 找未完成项，不强行标完成。〔自动〕
- [ ] **文件缺失/broken** → doctor 能报 + 给修复路径。〔自动：`doctor` 系列〕真机残留：在真实损坏工作区上走一遍 doctor 修复路径。

---

## 八、真实环境特性（单测 mock 不了）

- [ ] **真实项目 init**：在有真实 `package.json`/`go.mod` 的项目里 init → 生成静态 FILL 骨架，验证 AI 能按引导读构建/清单文件补全 ARCHITECTURE。
- [ ] **BOM/编码**：Windows 下 init 真实文件不解析失败（历版已修，回归抽核）。
- [ ] **路径大小写**：Linux/Mac 上 import 大小写一致（跨平台能测最好）。
- [ ] **CLI vs MCP 一致**：同一能力 `lrnev xxx` 命令与 MCP 工具行为一致。〔自动：`cli-mcp-interoperability`（InMemoryTransport 进程内真注册，同一份 .lrnev 双向读写）〕真机残留：装全局包后 bin 实跑一遍。
- [ ] **旧项目零负担接入**：cd 一个无 `.lrnev/` 的存量项目 → `lrnev init` 只建最小骨架，不要求为历史代码补建 Scene/Spec，可直接 spec_create。

---

## 九、体验层（AI 视角，最能暴露问题；CI 测不到）

> 常驻提示模板自 3.0.0 起**单源化于 `docs/AI-ADAPTATION.md`**（README 只做指向，防漂移由 `tests/unit/docs.test.ts` 守护）；模板含按 `--profile` 区分的 A/B 两版贴法。

- [ ] **ai_followup 真驱动**：写工具返回后，AI 是否**真按 followup 的下一步走**(而非空转/乱来)。**这正是 T-027 E-01~E-11 场景矩阵的观测对象**——3.0.0 判定现状见"十"：claude E-02 引导送达仍直写（0/5）是**已知激励缺口**（已裁决不阻塞发布、登记后续任务），不是本次回归要重测的点；opencode E-02 已 5/5。
- [ ] **接手连贯**：新会话只调 `project_status` 能接着干。
- [ ] **长对话不忘**：贴了常驻提示模板（`docs/AI-ADAPTATION.md`）后，压缩多轮 AI 仍记得用 lrnev。
- [ ] **不确定时**：AI 卡住调 `lrnev_guide` 能否自救。

---

## 十、T-027 真机对照资产（3.0.0 发布前收口；scene 04-ai-guidance-standardization / 04-00 agent-e2e-observability）

### 10.1 快照演进（sha-a → sha-d，双 SHA 对照扩展为四快照）

| 标签 | 快照语义 | 承载阶段 |
|------|----------|----------|
| **sha-a** | v2.3.0 发布点（B0 基线，guidance 迁移前，无 Profile） | B0-s/B1 结构基线基点；双 SHA 对照的"前"端 |
| **sha-b** | 03-00 M2 收尾（渲染通道重构完成，无 Profile） | 双 SHA 对照的"后"端；早期放量真机批 |
| **sha-c** | B3 修复快照（G1~G4 引导修正 + 05-00 Profile + 输出契约根治 + 判定口径归一） | B3 真机对照（2026-09-04） |
| **sha-d** | 发布内容快照（G1 措辞修订 + G5 归档边界 + L7 `--profile` + 证据契约 2.0.2 加 sha-d 标签） | B4 发布快照复测（2026-09-07） |

> label→commit 对照以 `tests/e2e/t027-baseline/`（README.md、current-sha.txt 说明）与各录制件 manifest 的 `git_sha` 为准——**本清单不写死 commit 号**（快照集合只增不改，后续 sha-e 可沿用同一套用法）。

### 10.2 阶段语义与判定（详表见 04-00 最终观测报告）

- **B0-s / B1 / B2a-s / B2b——结构基线**（fixture 驱动 E-01~E-11，**无真实 LLM/客户端**）：`action_taken` 四阶段 12/12 一致、`action_success` 分布一致（E-08 为预期拦截）；B0→B1 content_hash 变化符合预期（text_v1 迁移），B1→B2a→B2b 保持（M1/M2 只改通道不改内容）。对应冒烟自动化：`tests/e2e/04-00/e01~e11.test.ts`（fixture 完整性、EvidenceCollector 可填充、禁止动作检测）。
- **B3（sha-c，2026-09-04）**：claude E-02/E-06a/E-06b ×5（15 sessions）+ opencode E-02 ×5；validator strict 0 ERROR。判定：opencode E-02 **4/5**（`-32602` 33 错 → 0，输出契约修复验收）；claude E-02 **0/5**（引导送达仍直写 → 激励缺口实证）；E-06a 1/5（归档仍现，G5 不在快照，预期内）；E-06b 5/5（vs sha-a/b 3/5 改善）。
- **B4（sha-d，2026-09-07）**：同批 ×5 + opencode E-02 ×5；validator strict 20/20 0 ERROR。判定：**G5 归档边界生效**（E-06a 归档率 4/5→0/5，round2 全转"征询/保留"）；opencode E-02 **5/5**（0 个 `-32602` 三连，契约修复面无回归）；E-06b 真实续接首测 **4/5**（发布面正面数据）；claude E-02 四 SHA 连续 **0/5** 终确认 → **裁决 1.4**（E-02 场景语义演进登记 04-00 后续任务，**不阻塞发布**）。

### 10.3 资产与用法

- **`tests/e2e/t027-baseline/`**：`harness-mvp.mjs`（单 session clean-session 驱动：`T027_SCENARIO`/`T027_SHA` 环境变量，独立临时工作区，exit 0=PASS/1=FAIL/2=SKIP/4=ANOMALY）、`wrapper.mjs`（MCP wrapper：读指针文件或 `T027_SHA` 切 worktree 起服，`LRNEV_T027_PROXY=1` 代理录制模式）、`mcp-entry.mjs`（垫片）、`client-drivers.mjs`（真实客户端驱动）、三客户端配置、`.evidences/`（录制件 `e-<scenario>-<ts>-<rand>.json` + `-session.jsonl` + 分析与 INVALID 附件）。
- **`scripts/t027-batch-runner.mjs`**：放量批次编排（`--all`/`--scenarios`/`--sha`/`--reps`/`--budget-usd`/`--label`/`--dry-run`；每 session 后跑 validator strict，0 ERROR 才算 VALID；失败退避重试；产物在 `.claude/t027-batch/<label>/`，gitignore 区）。例：`node scripts/t027-batch-runner.mjs --all --sha sha-a --reps 5 --budget-usd 50 --label claude-sha-a-full`；自测 `--scenarios E-07 --sha sha-a --reps 1 --budget-usd 0.5`。
- **`scripts/validate-evidence-manifest.mjs`**：字段级证据契约校验（schema 单源 `src/schemas/evidence-contract.schema.json`；`--mode strict` 默认，任何 ERROR 即 exit 1）。
- **`scripts/t027-f04-stats.mjs`**：对放量证据做 F-04 判定统计（PASS/FAIL/ANOMALY/OBSERVE、消费率、双 SHA 对照表）。判定语义规则见各脚本头部 docstring，**改动判定口径前先读**。
- **判定汇总位置**：`dev-docs/ai-guidance-standardization/deliverables/04-00-final-observation-report.md`（含 B3/B4 补充观测节）；审定镜像 `dev-docs/decisions/`（09-02~09-07 T-027 裁决/汇总/执行规格，如 B3/B4 对照汇总、sha-a 三客户端 F-04 汇总、发布前决策包）；本机 `ai-discussions/` 原始讨论（不上 GitHub）。

### 10.4 CI 边界

放量批需要真实客户端与 API 预算、依赖本机登录态——**不进 CI**；runner/f04-stats/validator 属纯离线工具，可在 CI 对**已提交证据**重跑（validator strict 0 ERROR 已是每 session 门槛）。结构基线冒烟（E-01~E-11 fixture 判定）与协议契约面已在 `npm test` 内（见"十三"）。

---

## 十一、真机验证矩阵（多客户端）

| 客户端 | 最近一轮真机 | E-02 登记行为 | 契约面（`-32602`） | 归档边界（G5） | 备注 |
|--------|--------------|---------------|--------------------|----------------|------|
| claude-code | B4（sha-d，2026-09-07） | 0/5（四 SHA 稳定；激励缺口，裁决 1.4 不阻塞） | — | E-06a 归档 4/5→0/5，生效 | E-06b 真实续接 4/5；v2.3 盲测见 archive |
| opencode | B4（sha-d） | **5/5** | 0 三连（33→0→0） | — | content-only 客户端；F-03 投影修复的发现者与验证者 |
| codex | 未参加 B3/B4（sha-a 阶段 F-04 三客户端汇总有记录） | 待排 | 待排 | 待排 | 配置在 `t027-baseline/codex-config.toml` |
| Cursor | v2.x 盲测时代（archive） | 待排 | 待排 | 待排 | 3.0.0 未排 |

> 发布前复测不必重跑整张矩阵：未被覆盖的客户端（上表"待排"）若 3.0.0 要支持，至少走一遍"三、黄金路径 + 六-1 渲染文本快照"；已判定的客户端只复测**变更面**。

---

## 十二、性能基准（参考）

| 场景 | 目标 | 实测 |
|------|------|------|
| `project_status` | < 500ms | |
| `spec_gate_check` | < 100ms | |
| `task_update` | < 200ms | |
| `context_search`(1000 文件项目) | < 1s | |

> 上表目标为历版沿用值（实测列留白，3.0.0 未复测、未纳入门禁）。发布前若关心体积回归（渲染文本/截断元数据会让响应变大），按上表抽查即可，不作为 F-14 通过条件。

---

## 十三、发布门禁与自动化覆盖

### 13.1 发布门禁（全绿才算过）

```bash
npm run typecheck        # src 全量 tsc --noEmit，0 错
npm run typecheck:test   # tests 独立类型门禁（tsconfig.test.json，#6），0 错
npm test                 # 全量 vitest：3.0.0 实测 1079 条 / 81 文件
npm run build            # tsc 构建，应零警告（发布走 prepublishOnly = clean+build+test）
lrnev doctor             # 发布前工作区结构自检（结构/断链/stale claim/hook/agent），无新增告警
```

**测试规模口径**：以 `npm test` 实跑输出为准（vitest include = `tests/**/*.test.ts`）。3.0.0 演进：09-04 为 1051 → 文档守护/转义回归/guide profile 自适应/收口引导 → 1062 → F-04 截断元数据 + hook drain 语义断言 +14 → 1076 → 渲染器投影闭环 +3 → **1079**（81 文件：unit 61 + integration 5 + e2e 15）；v2.3 审计整改后为 46 个测试文件、692 条（口径见各版 CHANGELOG Tests 节，本清单不重复记账）。

### 13.2 分层覆盖（各测什么）

| 层 | 文件数 | 覆盖 |
|----|--------|------|
| `tests/unit` | 61 | 所有 Manager 与状态机（scene/spec/task/claim/ADR/memory/errorbook/agent…）、gate、CLI、错误与转义（`errors`/`tool-result-adapter-escape`）、MCP 契约单件（`mcp-server`/`server-lifecycle`/`response-envelope`/`model-visible-contract`/`data-output-contract`/`mcp-profile`/`tool-descriptions`/`uri-router`）、43 渲染器逐工具（`renderers/batch1~4`）、hooks 全链（manager/runner/log/trigger-points/**quiescence drain**）、guidance/decision_context 语义、F-04 截断元数据与 query_meta 用例、`docs`（文档守护）、`version` |
| `tests/integration` | 5 | `mcp-protocol-contract`（tools/list 42 工具全覆盖 outputSchema + 错误类别矩阵 + legacy 降级）；`cli-mcp-interoperability`（同一份 .lrnev，MCP↔CLI 双向互通，InMemoryTransport 进程内真注册）；`decision-context-tools`（四工具接线、负向校验、不落盘）；`guidance-profile-mounting`（T-006 挂载回退，文本同源复核）；`guidance-scenario-boundary`（E-01~E-09/E-06a/b 场景级端到端协议边界，落盘 + 文本双断言） |
| `tests/e2e` | 15 | `04-00/e01~e11`（E-01~E-11 B0 冒烟：fixture 完整性 + EvidenceCollector + 禁止动作检测，无 LLM）；`mcp-stdio-lifecycle`（**唯一真子进程用例**：真 stdio 拉起 `bin/lrnev-mcp.mjs`，覆盖连接自动注册/并发存活/touches 重叠/优雅断开自动注销并释放 claim——**依赖 dist，缺失时 5 条跳过并打横幅**，先 `npm run build` 再测）；`governance-hardening-fixes`（init→spec→gate→task→completion→doctor 全链）；`report-cli`（治理报表输出形态矩阵） |

**文档守护**：`tests/unit/docs.test.ts` 守护关键文档与实现不漂移——AI-ADAPTATION 常驻模板全文关键词、README 单源化指向、MULTI-AGENT claim 模型口径、PUBLISH/CHANGELOG 与 package.json 版本键控（含 `lrnev-<version>.tgz` 与 release 链接）、CHANGELOG 含 `spec_update`/`archived` 等 3.0.0 关键词。

---

## 十四、CI 测不到的部分（发布前真机走查边界）

> ⚠️ 上面的 1079 条全绿**不等于 F-14 通过**。协议层（真实客户端握手/呈现）、ai_followup 是否真驱动 AI、真机体验，是 CI **测不到**的部分，必须在真实客户端手动走一遍。
>
> 3.0.0 契约面新增三类"自动化在进程内、真机才是最终裁判"的核对面：
> 1. **渲染文本快照**：43 个渲染器的文本在真实客户端里逐工具可读、不裸抛 JSON、提示可行动（自动化只断言格式与一致性，测不到可读性）；
> 2. **双通道人工核对**：content 文本与 structuredContent 在真实工具面板里的并列呈现（自动化同源，测不到客户端侧展示差异）；
> 3. **投影锚点与截断元数据的真机消费**：task_update/task_claim 的锚点上下文、F-04 截断标注是否真的进了模型可见面并驱动行动——F-03 content-only 悬空与 opencode 修复正是"自动化全绿但真机才暴露"的实例。
>
> **纪律**：T-027 B3/B4 已判定过的项（见"十/十一"）不要重复烧钱盲测；每次发布的真机复测重点 = **自上次真机对照以来的变更面**（渲染器、引导文案、工具面分层、输出契约…）。走查结论（✅/⚠️/❌ + 日期 + 客户端）回填到本节，重大异常开 issue 并关联 dev-docs/decisions 裁决。
