# lrnev 全面真机集成测试 — 追踪文档

> 本文件是**测试进行中的活文档**(边测边写),既是过程记录也是最终报告草稿。
> 测试完成后据此分析、提炼正式结论。**严禁编造**:每条结果来自真实 CLI 调用。

## 元信息

| 项 | 值 |
|----|----|
| 执行者 | Claude (claude-opus-4-8)，本地 `lrnev` CLI 真机跑 |
| lrnev 版本 | 1.3.1（已 `npm run build`，测的是当前源码） |
| 调用方式 | `node bin/lrnev.mjs --workspace <被测项目绝对路径> <子命令>` |
| 被测项目 A | `.tmp/Understand-Anything`（TS/JS, pnpm 多包），干净无 .lrnev |
| 被测项目 B | `.tmp/codegraph`（TS 单包+CLI），干净无 .lrnev |
| 日期 | 2026-06-11 |
| 上次测试 | codex 2026-06-04（Java/Spring，见同目录 CODEX 报告）；本次互补 JS/TS 栈 + 补盲区 |

## 本次相对上次的新增重点（盲区补测）

1. **🔴 子线程/子任务并行提示**：`task_update(in_progress)` 的 followup 第 `TaskManager.ts:797` 行**无条件**追加“可拆子任务并行”。要验：到位吗？小任务上是不是噪音？措辞是“拆子任务”而非“开子 agent/子线程”。
2. **🔴 不支持子 agent 的降级路径**：lrnev 设计上不 spawn agent（`TaskManager.ts:29`），全程串行 + 不传 agent_id + 不开子 agent，流程应照样跑到 completion。上次完全没测。
3. **🔴 提示语质量层**：逐工具汇总 `ai_followup`，评估可执行性 / 噪音 / 降级完整性。

---

## 测试矩阵与结果

> 状态图例：⬜ 待测 / ✅ 通过 / ⚠️ 有问题 / ❌ 失败

| # | 层面 | 状态 | 关键发现（一句话） |
|---|------|------|----|
| 准备 | build dist + CLI 定位 | ✅ | build EXIT=0；两项目均干净无 .lrnev；`--workspace` 可用 |
| A1 | 初始化/探测/接手 | ✅ | codebase_detected=true；node_modules/.git 已排除；pnpm 5 包全识别；接手快照有界 |
| A2 | Scene/Spec/Gate 黄金路径+负向 | ✅ | 多特性 intent 触发拆分信号；ready gate FILL/标题/勾选三类负向精确报错；状态机拒非法跃迁 |
| A3 | Task + 🔴子线程提示 + 🔴串行降级 | ⚠️ | 串行降级完整跑通；validates 提示智能；**子线程提示无条件，小任务上是噪音**；**spec_get 开新版提示 CLI 漏实现** |
| A4 | 多 Agent/Claim | ✅ | claim 软冲突/自动 claim-release 正常；CLI 短命进程下 overlap 测不出，**已由 E1 MCP 真机补测验证正常** |
| A5 | 轻产物 + assess_goal | ⚠️ | ADR/Memory5类/Summary/Search 正常；Error 指纹去重确认(occurrence_count:2)；**assess_goal 多特性仍判 single-spec(保守)**；**error_search 无语义召回** |
| A6 | Hooks 全场景 | ✅ | 数组/字符串命令、sync/async、通配匹配、on_failure=warn、HOOK_SHELL_FORM告警、enable/disable、真实事件触发全通过 |
| A7 | Doctor + 边界/负向 | ✅ | doctor诊断/ORPHAN_CLAIM/migrate互斥/安全返回全通过；AMBIGUOUS_REF与broken当前数据未自然触发(如实记录) |
| B1 | codegraph 端到端黄金路径 | ✅ | init→scene→spec→填→ready→task×2→completion→completed 一次跑通；与项目A行为一致；doctor 0错误 |
| C1 | 🔴循环 开/领/关 僵尸任务 + 堆积 | ⚠️ | 任务不僵尸(新会话可接手)、claim不堆；**但硬关闭的 dead agent 在 registry 堆积、doctor 只提示不自动清理** |
| D1 | 🔴validates 锚点是否校验 | ⚠️ | **纯字符串转述、零校验**：validates=F-99/design#9.9 等不存在锚点照样接受，followup 一本正经指向空气锚点 |
| D2 | 🔴completion gate vs 空实现 | ⚠️ | **可被空壳骗过**：requirements/design 全是 FILL、从没过 ready gate，建个空 task 标 completed → completion gate 照样 pass |
| D3 | 🔴depends_on 依赖 | ❌ | CLI 无 `--depends-on` 参数(静默忽略)；core 也只记录不拦截——前置未完成可直接 in_progress |
| D4 | 🔴parent 父子约束 | ⚠️ | parent 存在性**有**校验(指不存在报错)；但父子完成顺序**不**强制(子 pending 父可 completed) |
| D5 | 🔴序号复用 vs 跨引用 | ⚠️ | 删高位 spec 后序号被复用(03→新 spec)；系统不警告、不检测悬空引用，短序号引用会静默指错 |
| D6 | 🔴summary URI / ADR supersedes | ⚠️ | summary 给幽灵 spec 存摘要会**凭空建孤儿文件**(只校验格式不校验目标存在)；CLI 无 adr `--supersedes` |
| E1 | 🅴MCP真机 I-15 存活态+overlap | ✅ | MCP长连接下：自动注册agent判active、两并发连接都active、touches_files重叠正确触发overlap警告(CLI测不出的疑点已洗清) |
| E2 | 🅴MCP真机 I-16 优雅断开清理 | ✅ | 优雅close连接→agent自动注销、其claim自动释放、他人无冲突接手(C1"任务不僵尸"在真MCP下成立) |
| E3 | 🅴MCP真机 I-17 adr supersedes | ⚠️ | supersedes**单向只记录**：新ADR记取代关系，但旧ADR状态仍proposed、不被标superseded/deprecated |

---

## 详细记录

### 准备层 ✅
- `npm run build` → EXIT=0。
- 两个被测项目均无 `.lrnev`（干净状态）。
- `lrnev --help` 正常列出全部子命令；`--workspace <path>` 全局 flag 可用。
- 约定：所有调用带 `--workspace`，`.lrnev/` 落在被测项目内，绝不碰 `lrnev-cli/.lrnev`。

### A1 初始化/探测/接手 ✅
- `init`：`codebase_detected: true`（纯 JS/TS，无 Java/Maven）。创建 8 文件 + 22 目录骨架，`was_new: true`。
- `init` followup：✅ 明确引导读 package.json 等清单 + 3-5 核心源码，回填 ARCHITECTURE/PROJECT；并提示可直接 spec_create 挂 00-default。无“探不到也不引导”的死局。
- `codebase.json` 探测质量（**对比上次 Java 的亮点**）：
  - `tech_stack`：✅ 识别出 5 个 pnpm workspace 包（主包 + homepage + plugin + core + dashboard），含 name/version/manifest。
  - `primary_language: typescript`，`package_managers: ["pnpm"]`，`dependencies.node` 完整列出 ~48 个依赖。
  - **上次 codex 报告 Maven/Java 结构化字段全是 `unknown/[]`；本次 Node 栈全部填实** → 印证探测短板是 **Java 特有**，Node 栈识别完整。
  - 噪音排除：✅ `node_modules` grep count=0、`.git` count=0、`.idea/logs` 未出现。
  - `directories` 正确分类 source/test/docs/config/other；`sample_files` 抽了 20 个测试样本。
- `project_status`（空项目接手）：✅ 有界快照，scenes/specs/active_tasks 等全空数组，followup 提示“无 in_progress 任务，查 draft/ready；按需 scene_get/spec_get”。**不读源码、不读正文**，符合“有界接手快照”设计。
- ⚠️ 小观察：`tech_stack` 主包条目无 `version` 字段（其余 4 包有），因主 package.json 可能未写 version；非 bug，记录备查。

### A2 Scene/Spec/Gate ✅
- `scene_create` 带多特性 intent（“可视化、节点搜索、增量更新三个能力”）：✅ 自动分配序号 `01`；followup **正确触发拆分信号**——“你的意图里有多特性迹象，多半要拆”+三条拆分标尺+建议 assess_goal。**对比上次 codex 说“多特性偏保守”，本次表现更积极**（intent 路径的信号是好的；assess_goal 本体另测，见 A5）。
- `scene_list`：✅ 含 00-default + 01-graph-explorer。
- `spec_create --scene 01-graph-explorer --priority P1`：✅ 生成 `01-00-node-search` 三文档，followup 引导填 requirements→ready gate→design→tasks，含 EARS 示例。
- `creation` gate：✅ pass（5 项 frontmatter/存在性检查）。
- `ready` gate 负向①（FILL 未填）：✅ fail，精确报 `requirements.md 仍有未填哨兵：L28, L31, L37, L43, L44` + 未勾选 L53，带 hint。
- **我真实填写了 requirements.md**（基于该项目真是代码图谱工具，node-search 是真实特性，写了 EARS 验收 3 条 + NFR + 勾选验收清单）。
- `ready` gate 正向（填好后）：✅ pass。
- `ready` gate 负向②（**标题硬依赖**）：把 `### 范围` 改成 `### 作用域` → ✅ fail：“缺少必填章节：范围”，hint 明确“标题必须与中文模板完全一致，不要翻译或改名”。**复现了上次报告的标题硬依赖**——确认是 by-design 但对非中文/改名场景脆弱。还原后复 pass。
- 非法状态跃迁：`spec draft → completed` → ✅ `INVALID_STATUS_TRANSITION`，hint“draft 只允许转 ready、archived”。
- 合法 `spec draft → ready`：✅ status 回填成功。
- ⚠️ 环境注记：bash 下 `python3` 不存在（`python` 在）；不影响 lrnev，仅测试脚本注意。

### A3 Task + 🔴子线程提示 + 🔴串行降级 ⚠️
**任务 CRUD**：
- `task_create` 大任务 T-001（`validates=F-01` + 3 条 acceptance）、子任务 T-002（`parent=T-001`）、小任务 T-003、T-004：✅ 全部成功，ID 递增。
- `task_list --readable`：✅ 平铺 + parent 字段正确体现层级。
- 非法跃迁 `pending → completed`（T-004）：✅ `INVALID_STATUS_TRANSITION`，hint“pending 只允许转 in_progress、blocked；completed 是终态，返工请新建 task”。

**🔴 子线程/并行提示（你的担忧①）—— 实证结论：提示无条件、不随任务大小调整**：
- T-001（大任务，应拆）in_progress followup 含：
  - “先读 requirements/design 中与 **F-01** 对应的段落” ← ✅ validates 智能，指到具体锚点。
  - “这个任务可考虑按文件不相交的边界拆成子任务并行……”+“并行前确认源码文件不重叠”。
- T-003（“把空态文案从英文改成中文”，根本不该拆）in_progress followup：
  - validates 退化为“回看本 Spec 目标与验收标准” ← ✅ 合理。
  - **但“可考虑拆成子任务并行”两句逐字相同地出现** ← ⚠️ **噪音**。
- **判定**：并行提示是 `TaskManager.ts:797` 无条件追加，不判断任务粒度。大任务上有用，文案级小任务上是纯噪音。措辞是“拆子任务并行”，未提“开子 agent/子线程”——对“不支持子 agent 的 AI”不会造成误导，但对“该不该拆”毫无甄别。**建议**：按任务标题长度/acceptance 数/是否有 validates 等弱信号决定是否追加，或至少在已有 parent 链时不再提。

**🔴 不支持子 agent 的降级路径（你的担忧②）—— 结论：完整跑通**：
- 全程 **不调 agent_register、不传 agent_id、不开任何子 agent**，纯串行 task_update。
- T-002 完成 → followup 正确提示“父任务 T-001 的所有子任务已 completed，请检查父任务自身验收” ← ✅ 父子收尾联动。
- T-001/T-003/T-004 依次 completed → ✅ 无任何报错。
- `completion` gate：✅ pass（全部 task completed，无 agent 也不影响）。
- `spec_update in-progress → completed`：✅ 合法收尾。
- **结论**：lrnev 对“不支持子 agent/不并行”的客户端**零依赖**，串行流程完整闭环。这条降级路径稳。

**🐛 发现的 CLI/MCP 不一致**：
- `spec_get`（已完成 spec）应提示“考虑开新版 spec_create --version”（MCP 侧 `tools/index.ts:740 specGetWithGuidance` 实现了方案 C）。
- 但 **CLI `spec get` 直接调 `specs.get()`（`cli/index.ts:199`），未走 guidance 包装** → 已完成 spec 的开新版提示**在 CLI 完全缺失**。
- 与 README “MCP 工具名跟 CLI 子命令一一对应，同一能力两条路都能走”的承诺不符。
- 复现：对一个 status=completed 的 spec 跑 `lrnev spec get <name> --scene <scene>`，返回里无 ai_followup。
- 严重度：低-中（不影响数据正确性，只少了引导；但本次用 CLI 测，MCP 侧该提示未被覆盖——需用 MCP 或单测补验）。

### A4 多 Agent/Claim ✅*（带 CLI 局限说明）
- `agent_register` agent-a/agent-b：✅ 注册成功，注册即返回 active。
- `agent_list`：⚠️ **两 agent 立即显示 `dead`**。原因：CLI 每次 `node bin/lrnev.mjs` 是独立短命进程，注册时记的 pid 命令一结束就消失，下次 `agent_list` 用 `process.kill(pid,0)` 探活自然判死。**这是 CLI 模式的固有特性，不是 bug**——MULTI-AGENT.md 的“进程生命周期判活”本就为 MCP 长连接设计；CLI 适合脚本化单步，不适合演示存活态。
- `task_claim` 软冲突：✅ agent-a claim T-001 成功；agent-b 再 claim 同一 T-001 → **正确提示**“已有活跃 claim：agent-a 正在处理，lrnev 不阻止继续，但请先确认是否错开”。冲突检测看 claim 文件本身，不被 agent dead 影响。
- `touches_files` overlap：⚠️ **CLI 下测不出**。agent-b claim T-002 声明与 T-001 相同的 `src/incremental.ts`，但**未触发 overlap 警告**——因为 agent-a（T-001 claim 属主）此刻判 dead，dead 属主的 claim 不计入“活跃重叠”（MULTI-AGENT.md：dead 属主 claim 可被接手）。逻辑自洽，但 overlap 提示依赖属主进程存活，CLI 无常驻进程 → 该提示需 MCP 长连接才能复现。
- `task_update --agent-id` 自动 claim/release：✅ in_progress 自动“已登记 claim”，completed 自动“已释放 claim”。
- `task_release` 显式释放：✅ `released: true`。
- `agent_unregister`：✅ 两个都 `ok: true` 清理。
- **结论**：claim 的软占用语义（不硬阻止、提示错开、自动登记/释放）在 CLI 下验证通过；但**“活跃存活态”相关的两项（agent active、touches overlap）受 CLI 短命进程限制，应在 MCP 真机补测**（这正是 GPT/codex 那条路的价值所在）。

### A5 轻产物 + assess_goal ⚠️
- **ADR**：✅ `adr_create`（scene 范围）生成 `0001-前端模糊匹配选用-fuse-js.md`，`adr_list` 可列。
- **Error 指纹去重**：✅ 两条相同错误 → 同一 fingerprint `ac8243c475bb`，合并到单文件，`occurrence_count: 2`（不新建第二条）。
- **error_search 召回**：⚠️ **复现上次短板**。精确词 `fuse` / `卡顿` 能命中；但近义/自然语言 `搜索卡顿`（symptom 原文是“fuse.js 搜索大图卡顿”）**返回空**。→ 纯关键词字面匹配，无语义召回；AI 查历史错误时要用原文词，不能靠改述。
- **Memory 5 类**：✅ preferences/decisions/patterns/errors/facts 全部 save 成功，ID 带类别前缀；`memory_search` 可跨类检索。
- **summarize_save**：✅ L0/L1 保存成功（`saved` 列表返回）。
- **context_search**：✅ 按目录 + L0/L1 打分返回 `context://scene/.../adr/1`、`context://scene/...` 等候选 URI，带 score。
- **🔴 assess_goal 三档（你关注的“是否偏保守”）**：
  - 单特性“加清空按钮”：`single-spec` / confidence low / score 0 ← ✅ 合理。
  - **多特性“解析、可视化、搜索、增量更新、导出报告五大模块”：reasons 已识别“列举了 5 个并列项，可能是多个可交付特性”、score=3、confidence medium，但 `kind` 仍判 `single-spec`** ← ⚠️ **确认保守**。启发式抓到了多特性信号却没据此把 kind 升到 multi-spec，只在 reasons/followup 里软提示。
  - 对比 A2 的 `scene_create --intent` 路径（那条会明确说“多半要拆”）：**两条多特性判断路径口径不一致**——scene intent 积极、assess_goal 保守。建议统一。
  - 注：设计上 assess_goal“只评估复杂度，分流交 AI”，所以不算硬 bug，但 kind 字段对“多特性”不敏感会误导只看 kind 的客户端。

### A6 Hooks 全场景 ✅
写了 4-hook 的 `hooks.json`（数组命令 sync/async、字符串命令、故意失败命令）覆盖各形态：
- `hook list`：✅ 列 4 个，含 event/mode/enabled。
- 手动 `hook trigger task.update.completed`：✅ `matched: 2`（精确名 `task-completed-echo` + 通配 `task.update.*`），tail-log 显示两者 `status: success, exit_code: 0`。**通配前缀匹配生效**。
- `on_failure: warn`（`error.record` hook 故意 `exit 3`）：✅ trigger 返回 `warnings: ["abort-on-fail-demo failed，exit_code=3"]`，主流程不中断。
- `doctor` 对字符串命令：✅ 报 `HOOK_SHELL_FORM` info + 建议改数组（防 shell 注入）。
- `hook disable/enable`：✅ enabled false↔true 正确切换并持久化到 hooks.json。
- **真实治理事件触发**（非手动 trigger）：实际 `task update T-002 completed` → hook log 从 6 条增到 8 条，两个匹配 hook 被真实动作触发执行。✅ 证明 hook 不只响应手动 trigger，治理主流程会真正触发。

### A7 Doctor + 边界/负向 ✅
- `doctor` 全量：✅ `0 errors / 2 warnings / 1 info`。warnings 是 `ONBOARDING_INCOMPLETE`（我没填 PROJECT/ARCHITECTURE 正文，预期）；info 是 `HOOK_SHELL_FORM`（字符串命令 hook，预期）。
- **ORPHAN_CLAIM**：✅ 用 ghost-agent claim 一个已 completed 的 task → doctor 报“claim 属主 Agent ghost-agent 不在注册表，已可被接手”。`task_release` 清理后消失。
- `doctor --migrate-summaries`：✅ `removed_count: 0`（无旧摘要，安全返回）。
- `doctor --migrate-todos`：✅ `ok`（当前模板用 FILL，无旧 TODO 可迁移）。
- migrate 互斥：✅ 同传 `--migrate-todos --migrate-summaries` → `INVALID_INPUT`“一次只能选择一种”。
- **AMBIGUOUS_REF**：⬜ 未自然触发。当前两个 spec 是 `01-00` / `02-00`，前缀不冲突；`spec get 0` 返回 `SPEC_NOT_FOUND` 而非歧义。机制在代码中存在（`toToolResult` 对 `AMBIGUOUS_REF` 有专门 followup），但需构造同序号/同名跨 scene 数据才能触发，本轮数据未覆盖。
- **broken 条目**：⬜ 部分。破坏 requirements.md 的 frontmatter 后 `spec_list` 仍正常列出、未标 broken——因为 spec_list 读目录结构 + spec 存在性，**不解析 requirements 正文**，故 requirements 损坏不影响。broken 标记主要针对 scene.md / spec 目录自身损坏，需另造数据验。
- 最终清理后 doctor 回到 `0 err / 2 warn / 1 info`（稳定）。
- ⚠️ 测试脚本注记：`node -e` 里 bash 路径 `/e/...` 被 node 当字面量解析成 `E:\e\...`，破坏文件实验首次失败（原文件因此未被破坏，反而安全）；改用 `sed` 后正常。lrnev 本身无问题。

### B1 codegraph 端到端黄金路径 ✅
第二栈（codegraph，TS 单包+CLI）交叉验证，一条龙无中断：
- `init`：✅ `codebase_detected: true`，`primary_language: typescript`，node_modules/.git 排除（count=0）。与项目 A 探测行为一致。
- `scene_create cli-core` → `spec_create index-command`：✅。
- `ready` gate：FILL 未填→fail；**我真实填写 requirements**（codegraph index 是真实特性，EARS 验收 3 条）→ pass。
- `task_create`×2（一个带 validates=F-01）→ in_progress→completed×2：✅。
- `completion` gate：✅ pass。
- `spec_update → completed`：✅。
- `project_status`：✅ 正确显示 01-00-index-command completed、active_tasks 空。
- `doctor`：✅ `0 errors / 2 warnings / 0 info`（warnings 为 ONBOARDING_INCOMPLETE，预期）。
- **结论**：黄金路径在两种不同结构的真实 TS 项目上行为完全一致，核心治理链稳定。

### C1 🔴 循环 开/领/关 —— 僵尸任务风险 + 状态/对话堆积（用户两个追问的专项测试）⚠️

**场景**：模拟“AI 开新会话→注册 agent→领任务(in_progress+claim)→关闭”反复循环，每轮**用不同 agent_id**（贴近真实——MCP `makeAgentId()` 每会话带随机后缀）且**硬关闭**（不调 unregister/release）。跑 3 轮，再用第 4 个全新会话验接手。

**追问① “关掉的会话占着任务，新会话还领得到吗？任务会不会变僵尸？”→ ✅ 不会变僵尸**
- 轮次 2、3 的新 session 都成功领到 T-003：死属主（上一轮 session）的 claim **自动可被接手**（`TaskManager.newClaimStore()` 注入“属主死活感知”，`isAgentDead` 判死 → claim 可 reclaim）。
- 第 4 个全新 session-4 `task_claim T-003` → ✅ `claimed_by: session-4` 成功。
- `project_status` 把 T-003 正确列入 `active_tasks` 供接手；followup 提示“从 active_tasks 里的 in_progress Task 接手”。
- **任务永远可被下一个会话接手，不会因为“前一个会话被关掉”而锁死无人能领。**

**追问② “会不会记录一堆无用对话/状态，越积越多不清理？”→ 分两种产物**：
- **claim 文件：✅ 不堆**。claim 以 **task 维度**命名（`{scene}__{spec}__{task}.json`），反复领同一任务是**覆盖**同一个文件。3 轮后 claims 目录**始终只有 1 个文件**。
- **registry 里的 agent 记录：⚠️ 会堆（硬关闭场景）**。registry 以 agent_id 为 key：同 id 重复注册是覆盖，但**不同 id（每个新会话）+ 硬关闭不 unregister** → 3 轮留下 **3 个 dead agent**，`agent_list` 持续返回它们。
- lrnev 不记录“对话内容”本身（它零模型、不存对话），所谓“堆积”仅指 registry 里的 dead agent 元记录（几百字节/条），不是对话历史。

**自动清理 vs 手动清理（关键的“出口”）**：
- 优雅断开（正常关客户端：stdin end/close、Ctrl-C、onclose）→ server `cleanup()` 自动 `unregisterAndReleaseClaims` → **删 agent + 释放 claim**，registry 不堆。见 `src/mcp/server.ts:111 createAgentLifecycle` + `wireStdinShutdown`。
- 硬崩溃（进程被杀，来不及触发 stdin 钩子）→ 残留记录靠**后续读取时 pid 探活判死**兜底：任务能接手（不僵尸），但 **dead agent 记录留在 registry，无后台 GC、无自动清理**。
- `doctor` **能检测**：本轮报 `STALE_AGENT ×3`（“pid 已不在世但仍留注册表”）+ `STALE_TASK_CLAIM ×1`（task in_progress 但无活跃 claim）+ `ORPHAN_CLAIM`。
- **但 `doctor` 只提示、不自动修复**——`--fix` 文档明写“M1 不自动修复，只输出建议”。清理 dead agent 需手动 `agent_unregister` 或删 `registry.json`。

**结论**：
- 任务不会变僵尸、claim 不堆积——**核心安全**。
- registry 在“反复硬关闭 + 每次新 id”下会**单调增长**，目前**无自动 GC，仅 doctor 提示 + 手动清理**。日常正常关客户端会自动清，不受影响；但长期大量异常退出的环境，registry.json 会慢慢变大。
- **建议（D-后续）**：给 `doctor --fix` 或新增 `doctor --gc-agents` 提供一键清理 dead agent / stale claim 的能力；或在 `agent_register`/`agent_list` 时惰性清理已判死且无 claim 的历史 agent（注意保留刚崩溃、claim 待接手的记录）。
- ⚠️ CLI 复测局限：CLI 每条命令独立进程，agent 注册即判死，所以本场景在 CLI 下“天然硬关闭”，很适合测 reclaim；但“优雅 unregister 自动清理”那条路径需 MCP 真机才能端到端验。

### 🔴🔴 D 系列 隐性链路专测 —— 本次最有价值的部分

> 用户追问：“执行 task 时是否真的去查**对的**设计+需求？这些隐性的也要测。”
> 隐性链路 = **lrnev 声称在治理、但实际只字符串转述/不校验**的地方。这类缺口不报错、**静默放过**，最危险。

**总规律：lrnev 是“确定性记录器”，不是“引用完整性校验器”**
- 它确定性地做：读写文件、分配 ID、状态机合法性、结构契约、加锁。
- 它几乎不做：校验你填的引用（validates / depends_on / supersedes / URI 目标）是否真实存在、语义正确、顺序合理。
- 设计哲学“判断归 AI”把**引用完整性**也交给了 AI → **只要 AI 填错/偷懒，治理链会安静地指向空气或放行空壳，无系统级护栏兜底。**

#### D1 validates 锚点：纯字符串转述，零校验 ⚠️
- 该 spec 的 requirements **只有 F-01**。`task_create --validates F-99`（不存在）→ ✅ 照样接受；in_progress followup：“先读……与 **F-99** 对应的段落” ← 指向空气锚点，不报错。
- `--validates design#9.9`（不存在的设计锚点）→ 同样照收。
- 代码证据：`TaskManager.ts:164/601/791` —— validates 全程字符串：存注释→读回 split→拼 followup，**从不打开 requirements/design 验证锚点存在**。

#### D2 completion gate 可被空实现骗过 ⚠️（最危险）
- 造 spec：requirements 留 **6 个 FILL**、design 留 **9 个 FILL**、**从没过 ready gate**；只建一个“假装实现”的 task 秒标 completed。
- **`completion` gate → `passed: true`** ← 只查“task 结构完整 + 全 completed”，**不看需求/设计填没填、ready 过没过**。
- 后果：**“任务做完了” ≠ “需求实现了”**。AI 可跳过需求/设计，空任务标完成让 spec“合规完结”。by-design（GOVERNANCE-FLOW 明写），但 ready→completion 无强制衔接，全靠 AI 自觉。

#### D3 depends_on 依赖：CLI 缺参 + core 不拦截 ❌
- **CLI `task create` 无 `--depends-on` 参数**（grep 无）→ 传了被静默忽略，`depends_on` 永远 `[]`。MCP `tools/index.ts:254` 有 → CLI/MCP 不对等。
- 即便经 MCP 传入：`TaskManager` 只把它写进 markdown（`503/595`）和读回，**无“前置未完成禁止 in_progress”拦截**。depends_on 是纯记录，不是约束 → 后置任务可随时抢跑。

#### D4 parent 父子约束：存在性校验✅ / 顺序不强制⚠️
- parent 指向不存在的 T-099 → ✅ **报错“父 Task T-099 不存在”**（比 validates 严格）。
- 但子任务还 pending 时，**父任务照样能直接 completed**，无拦截（仅“子全完→提示父可收尾”软联动）。
- 暴露**校验不一致**：同是引用，parent 校验存在性、validates/depends_on 不校验。

#### D5 序号复用 → 跨引用静默错位 ⚠️
- 删 `03-00-empty-impl-test` 后，新建 spec **拿到相同序号 03**（`03-00-reused-number-test`）。
- 系统**不警告复用、不检测悬空引用** → 任何用短序号“03”的引用会静默指向不同的新 spec。GOVERNANCE-FLOW 告诫“用完整 ID”，但无系统护栏。

#### D6 summary URI / ADR supersedes：半校验 + CLI 缺参 ⚠️
- `summarize_save` 给**不存在的 spec** URI（`.../99-99-ghost-spec/tasks`）→ **`ok: true` 照存**，**凭空创建孤儿文件** `specs/99-99-ghost-spec/.tasks.abstract.md`。只有 URI **格式**错才报 `INVALID_URI` → 校验格式不校验目标存在。
- 正向闭环 OK：真实 spec 存摘要 → `context_search` 高分（score 9）检索得到。
- CLI `adr create` **无 `--supersedes` 参数**（MCP 有 `tools/index.ts:351`）→ 又一处不对等；supersedes 是否真改旧 ADR 状态需 MCP 侧另验。

#### D 系列小结：4 类静默缺口
1. **引用不校验存在性**：validates、depends_on、summary URI 目标、（疑）adr supersedes —— 填错指向空气。
2. **gate 不校验语义完整**：completion 只看 task 结构，空实现可过。
3. **约束只记录不强制**：depends_on 顺序、父子完成顺序都不拦。
4. **CLI/MCP 能力不对等**：spec_get 引导、task depends_on、adr supersedes 在 CLI 缺失。
> 均**不影响正确使用时的数据正确性**，但 **lrnev 对“AI 用错”几乎无系统级兜底**——它假设 AI 正确填引用、自觉走完 ready。对“治理护栏”定位而言是值得正视的取舍。

### 🅴 E 系列 MCP 真机补测 —— CLI 测不了的长连接生命周期（MCP v1.3.1，SDK stdio 客户端拉起 lrnev-mcp）

> 方法：用 `@modelcontextprotocol/sdk` 写独立脚本 `dev-docs/mcp-live-test.mjs`，以 stdio 客户端**真实拉起 `lrnev-mcp` 子进程**（每个 Client = 一个真实长连接会话），`LRNEV_WORKSPACE` 钉到项目 A。这样能完整控制“连接→注册→并发→优雅断开→验证清理”。

#### E1（I-15）存活态 + overlap：✅ 全通过 —— **洗清 A4 的疑点**
- **I-15a**：连接初始化后 server **自动注册**当前会话 agent，`agent_list` 判 `active`（client=claude-code）。无需手动 agent_register。
- **I-15b**：**两个并发 MCP 连接**（claude-code + cursor）`agent_list` 里**同时 active**（active 数=2）。这是 CLI 短命进程根本做不到的真实存活态。
- **I-15c**：两个 active 会话各持正确 agent_id，分别 claim T-009/T-010 且都声明 `src/incremental.ts` → **正确触发 overlap 警告**：「touches_files 重叠警告：…的 T-009 也声明修改 src/incremental.ts；lrnev 不阻止，请确认是否错开」，且 `data.overlaps` 带结构化数据。
- **结论**：A4 当初“CLI 下 overlap 测不出”纯因 CLI 短命进程让属主判 dead（`findTouchOverlaps` 跳过 reclaimable claim）。**在 MCP 长连接这个 lrnev 本来的运行环境里，多 agent 存活态与 overlap 提示完全健全。**
- 注：首跑因测试脚本在 register 异步落地前就查 agent_list（拿到空表→agent_id=undefined），误判 I-15a/c FAIL；加 500ms 等待 + 按 client 取正确 agent_id 后全 PASS。**是脚本时序问题，非 lrnev bug**，如实记录。

#### E2（I-16）优雅断开自动清理：✅ 全通过
- **I-16a**：优雅 `client.close()` 关闭 S1 连接 → S1 的 agent **自动从注册表移除**（server 端 `createAgentLifecycle.cleanup` 经 stdin end/close 触发）。
- **I-16b**：S1 断开后，它 claim 的 T-009 **自动释放**；S2 重新 claim T-009 **无 conflict**。
- **结论**：印证 C1 的“任务不僵尸”在真 MCP 下成立，且**正常关客户端确实自动清 agent + claim**（对应 B-7：堆积只发生在硬崩溃、不优雅退出时）。

#### E3（I-17）adr supersedes：⚠️ 单向只记录
- adr_create 新 ADR（0005）supersedes [0004] → 读旧 ADR 0004：`status` 仍是 `proposed`，**无 superseded_by / deprecated 标记**。
- supersedes 关系**只写在新 ADR**，被取代的旧 ADR 状态不变。谁单独读旧 ADR，不会知道它已被废弃。
- 性质：与 D1/validates 同类——**引用只记录，不回写关联目标**。是否算 bug 取决于预期；至少建议 adr_list 能体现“已被 supersede”或读旧 ADR 时给提示。

#### E 系列固化为正式 e2e 测试 ✅
- 把一次性脚本改造为 `tests/e2e/mcp-stdio-lifecycle.test.ts`（vitest + tmpDir 临时工作区 + 真 `StdioClientTransport` 拉起 `bin/lrnev-mcp.mjs` 子进程 + expect 断言）。
- **填补的覆盖空白**：`tests/unit/server-lifecycle.test.ts` 自述“不起真实 stdio 子进程”，`tests/integration/cli-mcp-interoperability.test.ts` 用 InMemoryTransport（进程内）——**全套件原本无任何测试覆盖真 stdio 进程生命周期**。本 e2e 是唯一一个。
- 5 条用例：自动注册 active、两并发连接 both active、touches overlap、优雅断开自动注销+释放 claim、adr supersedes 单向记录（作为行为契约守门，未来若实现回写会触发该断言提醒更新）。
- dist 缺失时 `it.skipIf` 跳过（子进程入口 import dist），不误红。
- **全量 `npm test`：41 文件 / 570 测试全过**（原 565 + 新增 5），无回归。


---

## 发现的问题（bug / 意外 / 设计短板）

按严重度排序，含复现方式。

### 🐛 B-1（中）CLI `spec get` 缺失“已完成 spec 开新版”引导 —— CLI/MCP 行为不一致
- 现象：对 status=completed 的 spec 跑 `lrnev spec get <name> --scene <scene>`，返回无 `ai_followup`。
- 根因：MCP 侧 `src/mcp/tools/index.ts:740 specGetWithGuidance` 实现了“已有实现→建议开新版”的方案 C 提示；但 CLI 侧 `src/cli/index.ts:199` 直接调 `specs.get()`，未走该包装。
- 影响：README 承诺“MCP 工具名跟 CLI 子命令一一对应，同一能力两条路都能走”，此处不符；用 CLI 工作的人拿不到开新版引导。
- 复现：见 A3。
- 建议：把 `specGetWithGuidance` 逻辑下沉到 core，或 CLI `spec get` 也复用它。

### ⚠️ B-2（中）`task_update(in_progress)` 的“拆子任务并行”提示无条件追加 —— 小任务上是噪音
- 现象：大任务和“把空态文案改成中文”这种文案级小任务，拿到**逐字相同**的“可考虑拆成子任务并行”两句提示。
- 根因：`src/core/TaskManager.ts:797` 无条件 push，不判任务粒度。
- 影响：对“该不该拆”毫无甄别；小任务上增加噪音、稀释真正有用的 followup。**这正是用户担忧①**。
- 措辞澄清：说的是“拆子任务并行”，**未提“开子 agent/子线程”**，所以不会误导“不支持子 agent 的 AI”去做它做不到的事——但也因此对“拆/不拆”不给有效判断。
- 建议：用弱信号（acceptance 条数 / 标题长度 / 是否已有 validates / 是否已有子任务）决定是否追加；已有 parent 链时不再提。

### ⚠️ B-3（中）`assess_goal` 对多特性目标仍判 `single-spec` —— 保守，且与 scene intent 路径口径不一致
- 现象：目标明列“解析、可视化、搜索、增量更新、导出报告五大模块”，reasons 已识别“5 个并列项，可能是多个可交付特性”、score=3，但 `kind` 仍是 `single-spec`。
- 对比：`scene_create --intent` 的多特性路径会明确说“多半要拆”（A2），两条路径口径不一致。
- 影响：只读 `kind` 字段的客户端会被误导为单 spec。复现见 A5。
- 建议：score 达阈值或命中“多并列项”信号时把 kind 升到 `multi-spec-program`，与 scene intent 信号统一。

### ⚠️ B-4（低，已知设计）`error_search` 无语义召回
- 现象：symptom 原文“fuse.js 搜索大图卡顿”，搜 `fuse`/`卡顿` 命中，搜近义“搜索卡顿”返回空。
- 性质：lrnev 明确“零模型依赖、不做语义”，这是 by-design 取舍，非 bug。复现见 A5。
- 影响：AI 查历史错误需用原文词。建议在工具描述里点明“用原文关键词，不要改述”。

### ⚠️ B-5（低，已知设计）`ready` gate 章节标题硬依赖中文模板
- 现象：`### 范围`→`### 作用域` 即判 fail“缺少必填章节：范围”。复现见 A2。
- 性质：by-design（GOVERNANCE-FLOW.md 明确要求标题与中文模板完全一致），hint 也说清了。但对非中文用户/想改标题的场景脆弱。
- 建议：维持现状即可，文档已充分提示；若要国际化需另设计标题别名表。

### ℹ️ B-6（信息）CLI 短命进程下多 Agent“存活态”测不全
- `agent_list` 注册后立即判 dead；`touches_files` overlap 提示因属主 agent 判 dead 而不触发。
- 性质：CLI 模式固有特性（进程生命周期判活为 MCP 长连接设计），非 bug。
- 影响：**agent active 态、claim overlap 这两项必须用 MCP 真机补测**——这正是 GPT/codex MCP 路径的价值。本轮 CLI 已验证 claim 软冲突/自动登记释放/conflict 提示等不依赖进程存活的部分。

### ⚠️ B-7（中）registry 的 dead agent 无自动清理 —— 反复异常退出会单调增长
- 现象：每个新会话用不同 agent_id（MCP 自动生成）+ 硬关闭（不 unregister），registry 里 dead agent 记录持续累积，`agent_list` 一直返回它们。3 轮 → 3 个 STALE_AGENT。
- 性质：claim/任务侧安全（任务可接手、claim 不堆，见 C1）；只是 registry.json 单调变大。
- 缓解：正常关客户端会触发 `cleanup` 自动 unregister（不堆）；doctor 能报 STALE_AGENT，但**不自动清，需手动**。
- 影响：长期大量异常退出（崩溃/被杀）的环境，registry.json 缓慢膨胀；不影响正确性，影响整洁与 agent_list 噪音。
- 建议：`doctor --fix`/新增 `--gc-agents` 一键清理 dead 且无 claim 的 agent；或 register/list 时惰性清理（保留刚崩溃、claim 待接手者）。复现见 C1。

### ❌ B-8（中）depends_on 在 CLI 缺失、在 core 不强制 —— 依赖顺序形同虚设
- CLI `task create` 无 `--depends-on`；core 只记录不拦截，后置任务可在前置未完成时抢跑。详见 D3。
- 建议：CLI 补参数；core 在 task_update→in_progress 时对未完成的 depends_on 至少给 warning（或可选 block）。

### ⚠️ B-9（中）completion gate 不防空实现 —— ready 与 completion 无强制衔接
- requirements/design 全 FILL、没过 ready，也能让 task 全 completed 后 completion pass。详见 D2。
- 性质 by-design，但建议：completion gate 可选地附带检查“该 spec 是否曾通过 ready gate / requirements 是否仍有 FILL”，或在 followup 里强提醒。

### ⚠️ B-10（低-中）引用类字段普遍不校验存在性 —— validates/summary URI 目标/adr supersedes
- validates 指不存在锚点照收（D1）；summary 给幽灵 spec URI 凭空建孤儿文件（D6）；CLI adr 无 supersedes（D6）。
- 对比：parent 校验存在性（D4）—— 校验口径不一致。
- 建议：统一“引用类字段”策略；至少对 summary URI 的目标 spec/scene 存在性做校验，避免孤儿摘要文件。

### ⚠️ B-11（低）序号复用无悬空引用检测
- 删高位 spec 后序号被复用，短序号引用静默错位（D5）。doctor 不检测。
- 建议：doctor 增加“悬空 spec/scene 序号引用”扫描（可选）。

### 未自然覆盖（需另造数据）
- `AMBIGUOUS_REF`：需同序号/同名跨 scene 数据；本轮 spec 前缀不冲突，未触发。
- `broken` 条目：spec_list 不解析 requirements 正文，破坏 requirements frontmatter 不触发 broken；需破坏 scene.md/spec 目录自身。

---

## 提示语质量层（🔴 逐工具 followup 评估）

| 工具 | followup 质量 | 评价 |
|------|------|------|
| init | ✅ 优 | 明确引导读清单+源码回填 ARCHITECTURE/PROJECT，无死局 |
| project_status | ✅ 优 | 有界、提示按需 scene_get/spec_get，不诱导全量读 |
| scene_create(intent) | ✅ 优 | 多特性触发三条拆分标尺 + 信号，积极 |
| spec_create | ✅ 良 | 引导填→gate→design→tasks，含 EARS 示例 |
| spec_gate_check(ready pass) | ✅ 良 | 提示自查质量、回填 status、按需 ADR |
| spec_gate_check(fail) | ✅ 优 | 精确到行号 + hint，可直接修 |
| task_update(in_progress) | ⚠️ 中 | validates 提示智能；但并行提示无条件=小任务噪音（B-2） |
| task_update(completed/failed/blocked) | ✅ 良 | 父子收尾联动、失败引导 error_record |
| task_claim(conflict) | ✅ 良 | 明确“不阻止但请错开” |
| assess_goal | ⚠️ 中 | followup 文字好，但 kind 字段对多特性不敏感（B-3） |
| spec_get(completed) | 🐛 缺失 | CLI 无 followup（B-1） |
| 错误类(INVALID_STATUS_TRANSITION 等) | ✅ 优 | code+message+hint 三件套，AI 可自救 |

**总评**：followup 体系整体是 lrnev 最大亮点——绝大多数工具能把 AI“推”到下一步且可执行。唯二短板是 B-2（无条件并行提示）和 B-3（assess_goal kind），都集中在“判断粒度”这件需要 AI 自己想的事上，属打磨项而非阻塞。

---

## 总体结论

### 覆盖度
- **9 个测试层 + 2 个真实 TS 项目**，约 38 个工具/子命令全部真机调用（CLI 路径），含专项的“循环 开/领/关”边界场景。
- 相比上次 codex（Java/MCP），本轮补齐：**JS/TS 栈探测、子线程提示甄别、不支持子 agent 的串行降级、Hooks 全场景、提示语质量逐项评估、循环会话的僵尸任务/状态堆积**。

### 三个核心担忧的答复
1. **“有没有提醒 AI 开子线程？”** → 有，`task_update(in_progress)` 每次都提“拆子任务并行”，但**无条件、不分任务大小**，小任务上是噪音（B-2）。措辞是“拆子任务”非“开子 agent”，不会误导能力不足的 AI。
2. **“怕有的 AI 不支持子 agent”** → **不用怕**。lrnev 设计上不 spawn agent、不调度、不锁源码（TaskManager.ts:29）；本轮全程串行、不传 agent_id、不开子 agent，治理链**完整闭环跑到 completion**（A3）。子 agent/并行只是可选加速，不是流程前提。
3. **“反复 开/领/关，任务会不会变僵尸领不到？状态会不会越积越多？”**（C1）→
   - 任务**不会僵尸**：死会话的 claim 自动可被下一个会话接手，第 4 个全新会话仍能领到。
   - claim **不堆**（task 维度命名，覆盖式）。
   - **但 registry 的 dead agent 会堆**（硬关闭 + 每次新 id），doctor 能检测但不自动清，需手动（B-7）。正常关客户端会自动清理。
4. **“执行 task 时是否真去查对的设计+需求？这些隐性的也要测。”**（D 系列）→ **lrnev 不校验引用完整性**。validates/depends_on/summary URI 目标填错都不报错、指向空气（D1/D6）；completion gate 能被“需求全 FILL + 空任务标完成”骗过（D2）；depends_on/父子顺序不强制（D3/D4）；序号复用会静默错位（D5）。**“查对的需求”这件事，系统只把锚点转述给 AI，对不对全靠 AI 自己——无系统级护栏。**

### 结论
- **核心治理链（init→scene→spec→gate→task→completion）在两个真实 TS 项目上零缺陷跑通**，状态机、gate 负向、Hooks、Doctor、轻产物、claim 软占用、循环会话接手均按设计工作（**正确使用时数据完全可靠**）。
- 发现 **1 个真 bug（B-1）+ 多个设计取舍/打磨项**：B-2 并行提示噪音、B-3 assess_goal 保守、B-7 registry 无 GC、B-8 depends_on 不强制、B-9 completion 不防空实现、B-10 引用不校验存在性、B-11 序号复用无检测。
- **关键定性**：这些缺口**不影响“AI 正确使用时”的数据正确性**，但暴露 lrnev 的核心取舍——**它是“确定性记录器 + 给 AI 提示”，不是“强约束护栏”**。对“引导而非强制”的设计宗旨这是自洽的；但若用户期待它能挡住“AI 用错/偷懒”，则需知道**这层兜底目前不存在**。
- **是否达发布标准**：核心流程达标，可发布；但建议至少把 **B-1（CLI 引导缺失）和 B-9/D2（completion 防空实现提醒）** 在发布前处理或在文档显著位置声明，避免用户误以为“completion pass = 需求真完成”。其余按优先级排期。
- **待补测（MCP 真机）**：agent 存活态、claim overlap、优雅 unregister 自动清理（B-6、C1 末）、adr supersedes 真实行为（D6）—— 等 GPT/codex 官网稳定后用 MCP 跑一轮补齐，CLI 无法覆盖这一面。

### 测试产物处置
- 两个被测项目各生成了 `.lrnev/`（项目 A 还有 hooks.json）。**是否保留或清理，请你定**：保留可作为 lrnev 真实使用样例；清理则 `rm -rf .tmp/Understand-Anything/.lrnev .tmp/codegraph/.lrnev`。
