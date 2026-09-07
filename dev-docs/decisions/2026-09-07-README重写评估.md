# README 重写评估报告（发布前）

> 任务：诊断现有 `README.md`（`v2.3.0` 文案 + 少量 3.0.0 补丁的中间态）"不清晰"的根因，给出读者定位与文档分工建议，以及新版 README 的完整大纲。
> 执行人：DeepSeek（文档子代理，只读评估，未改动 README.md / docs / 任何文件）
> 日期：2026-09-07　评估基线：HEAD = `v2.3.0-155-gb0a3852`
> 依据：README.md 全文、docs/ 六份 + examples、CHANGELOG.md、源码 grep（`src/mcp/tools/index.ts`、`server.ts`、`model-visible-contract.ts`、`response-envelope.ts`、`GateRunner.ts`、`src/cli/index.ts`）、实跑 `node bin/lrnev.mjs --help / gate --help / report --help / report --json / status`、git 历史、`ai-discussions/结果/2026-09-05-DeepSeek-发布变更清单草稿.md`（v2.3.0→next 的 153 commit 全景，其 §1/§7 记载 2026-09-07 用户已拍板 **2.3.0 → 3.0.0（major）**）。

---

## 0. 结论速览

1. README 本身写得用心、口吻清晰、绝大多数命令/数字**与当前代码核对属实**（见 §5 正面清单），但它是一份 **381 行的"单页混合文档"**：营销论证、上手指引、接入方手册、常驻提示词、开发说明全部挤在一起，**任何单一读者都需要在无关内容中翻找**——这是"不清晰"的总根因。
2. 最紧迫的过时不是修辞问题而是**契约问题**：仓库处于 3.0.0 前夜（155 个未发布 commit），`text` 通道行为已变（JSON → 按工具渲染文本）、新增 `structuredContent` 双通道、`decision_context`、guidance、`isError` 收严，README 只打了 `--profile` 一个小补丁（commit 4cce0b5），**没有一处向接入方交代这些**。
3. 复制的正文已经**漂移**：README §3 的"常驻提示词 10 条模板"与 `docs/AI-ADAPTATION.md` 同源模板不一致（AI-ADAPTATION 已增补"三条判断标尺 + 用户决定优先"，README 副本没有）——这是"README 内嵌权威内容"模式的失败实证。
4. 建议：新版 README 定位为**决策 + 上手 + 文档地图**（评估者/快速用户/接入方三入口、各约 15~35 行），细节全部指针化到 docs/；目标篇幅 ~280–330 行（现 381），其中约 90 行是"从 README 移出或删除"的内容。

---

## 1. 现状诊断清单（编号 P1–P16）

### A. 版本与事实性过时（对照当前代码）

- **P1｜版本号已过期**：README L5 写"当前版本 `2.3.0`"。仓库 HEAD 已在 v2.3.0 之后累积 155 个 commit，发布变更清单草稿记载用户 2026-09-07 拍板 **3.0.0（major）**。重写时版本行必须以发布决策为准（见 §4-1）。
- **P2｜测试数已过期**：README L361 "npm test　# 692 条测试"是 v2.3.0 时点数字；发布清单草稿记录全量 **1051/1051（2026-09-04）**，其后提交以 harness/证据为主。建议 README 不写死数字，或写"npm test（全绿）"。
- **P3｜3.0.0 新契约面完全缺席（最严重）**。对照源码（`src/mcp/types/response-envelope.ts`、`src/mcp/helpers/model-visible-contract.ts`、`src/mcp/tools/index.ts`、`src/mcp/helpers/tool-result-adapter.ts`）与发布清单草稿 §3：
  - **响应双通道**：全部 MCP 工具成功响应带 `structuredContent`（canonical：`response_version:'1'`、`ok`、`data`、`errors`、`ai_followup`、`anchor_context/summary_context`，四工具可附顶层 `guidance`）并随 tools/list 声明 `outputSchema`；**`content[0].text` 从 JSON.stringify 改为按工具渲染的模型可见文本**（含【事实】/【建议】/【决策边界】/【执行约束】/【下一步】角色前缀行、截断、修复 hint）。README 无只字。
  - **`decision_context` 可选入参**（scene_create / spec_create / task_create / assess_goal 四工具，`src/mcp/tools/index.ts` L312/375/498/692 接线）：`source:'client_asserted'`、`strength: explicit|preferred|unspecified`、`summary`，可选 `direction/target_ref`；只作为本次调用声明参与建议与决策边界渲染，**不落盘、不阻断、条件规则违反返 INVALID_INPUT**。README 无只字。
  - **业务拒绝统一 `isError=true`**（含 AMBIGUOUS_REF；`shouldSetIsError = !payload.ok`）。README 无只字。
  - 已存在但零散：README 唯一的 3.0.0 内容即 §3 的 `--profile core` 段（33/42、剔除 9 个名单），该段与代码一致（`src/mcp/server.ts` L42-47、`tools/index.ts` L188-217），但位置孤立、无"text/structuredContent"语境。
  - **后果**：3.0.0 发布后，照 README 理解"返回是小段 JSON"的接入方/脚本会踩 text 通道破坏性变更；升级注意（勿 `JSON.parse(content[0].text)`，改读 `structuredContent`）必须进 README 的接入节。
- **P4｜（核对通过项，见 §5）** CLI 命令面、gate 三名称、工具数 42/33 等经实跑/源码核对无误，不在"过时"之列。

### B. 结构问题

- **P5｜读者不分层**：README 同时服务 ① GitHub/npm 评估者（是否值得了解）、② 想 5 分钟跑通的快速用户、③ AI 客户端接入方（MCP 配置/常驻提示/工具面）、④ 深度运维（目录树/ID 约定）、⑤ 贡献者（§6）。彼此零分隔。评估者要滚过"省 token 分析 + codegraph 对比"（§1 后半，约 50 行）才看到第一个命令块。
- **P6｜定位句发散、历史标注错位**：subtitle（L3）、"一句话"（L15）、"核心宗旨"（L35）三处各说一遍；"它具体怎么帮 AI 省 token"整节（L54-65）用 **v2.1/v2.2/v2.3 括号标注功能演进**（BM25、governance_map、report……），对不了解历史的新读者是噪音（"这些还在吗？"），这些是 CHANGELOG 材料错放进了定位章。
- **P7｜核心概念无单一入口**：Scene/Spec/Task、Gate、锚点 F-xx/D-xx、validates、L0/L1/L2 散布在 §1 的引用块（L33）、§2 的 ID 约定（L142-146）、§3 常驻模板、§4 mermaid 中，新人无法一次建立心智模型。
- **P8｜重复正文已漂移（有实证）**：README L200-235 整段复制 AI-ADAPTATION 的"常驻提示词模板"；AI-ADAPTATION 该模板已增补"三条判断标尺（整体推翻/独立特性/上下文冷却）+ 用户决定优先"（AI-ADAPTATION L193-198），README 副本没有。同源双份必然漂移——重写必须单一权威源。
- **P9｜信息密度无跳读路径**：41 行全注释目录树（L88-140）+ 28 行命令块（L239-284）+ 2 张 mermaid（L296-327）平铺堆叠，没有"跳过/只看这段"指引；对纯用户，目录树和 mermaid 的边际价值低。
- **P10｜开发节与 CONTRIBUTING.md 重复**：README §6（L359-365）与 CONTRIBUTING 的"本地调试"（build/test/local CLI/dev:mcp）内容重复，README 侧应只剩 3 行 + 链接。
- **P11｜缺文档地图**：§5 只有 docs/ 六份 md 的两列表格，没有"哪份管什么、什么时候读哪份、docs/examples/ 两份 JSON 与 dev-docs/、examples/ 是什么"的总图；读者无法判断 AI-ADAPTATION 与 GOVERNANCE-FLOW 的分工（实际分工见 §2）。
- **P12｜"使用"与"接入"混杂**：CLI 用户（`lrnev spec create ...`）与 AI 客户端接入方（MCP 配置、常驻提示、--profile）共用 §3 一章，互相干扰。

### C. 术语问题

- **P13｜未定义/晚定义术语清单**（出现位置 → 首次解释位置）：MCP（L3 使用，全文假定读者懂；仅 L80 一句"任何支持 MCP"）、frontmatter（L86 使用，无解释）、L0/L1/L2（L108 目录树注释首次出现，L59 才半解释）、F-xx/D-xx 锚点（L146 解释，但 §1 引用块已提前用）、validates（L145）、claim（L134）、Gate creation/ready/completion（L30 用"gate 不通过"口语，L229 模板才点名）、BM25（L60，无解释）、EARS（L95 目录树注释"EARS 写作提示"，无解释）、adopt/00-default（L100 用，语义在 GOVERNANCE-FLOW 才完整）、hooks（L128 出现，L5 表指向 HOOKS.md，正文无一句话说 hooks 是什么）。
- **P14｜名词家族未一次说清**：npm 包 `lrnev`、命令 `lrnev` / `lrnev-mcp`、目录 `.lrnev/`、仓库 `lrnev-govern`（GitHub: LuChangQiu/lrnev-govern）——L5 只说了前三个，评估者极易把 repo 名当包名搜。

### D. 与 docs/AI-ADAPTATION.md 的分工模糊

- **P15｜职责倒挂**：AI-ADAPTATION 开头三节其实是"lrnev 是什么/如何定位"（AI-ADAPTATION L1-3 的通用文本字段适配导言、L256-263 适配设计原则），而 README 却内嵌了本应属于接入方手册的"常驻提示词全文 + 防遗忘说明"（L190-235）。合理分工应如 §2。
- **P16｜AI-ADAPTATION 自身也有 3.0.0 缺口（提示项，不在本次 scope）**：其开头仍写"通过 MCP 协议的通用文本字段适配"（未提 structuredContent 双通道）、42 工具分组表未列双通道/guidance/decision_context 语义。README 重写只能引用它并标注"接入细节以该文为准"，该文的 3.0.0 同步需另立任务（本报告不改 docs）。

### E. 核对通过项（正面清单，重写时不要改坏）

实跑/源码比对确认 README 以下内容**仍然准确**：工具总数 full=42 / core=33 及剔除名单（agent_* 4 + lrnev_hook_* 5）；`--profile core` 与 `--profile=core` 两种写法、非法值启动即报错（`src/mcp/server.ts` parseMcpProfileArg）；gate 只接受 creation/ready/completion（`GateRunner.ts` L49 hint）；`lrnev --help` 顶层 19 个命令与 README 命令块一致；`report --scene/--json/--md/--out/--release-notes`（--json 为全局选项）、`doctor --migrate-todos/--migrate-summaries`、`task create-many --from-file`、`lrnev map/status/guide` 全部实跑通过；零 LLM/Embedding 依赖属实（NFR-2）；`lrnev guide` + topic（workflow/tools/errors/concepts）与 `lrnev_guide` 描述一致；README §5 列出的 docs/ 六份与 examples/sample-project 均存在；AI-ADAPTATION 的实测矩阵版本标注与 CHANGELOG 一致。

---

## 2. 读者定位与文档分工建议（README 为谁服务）

| 读者角色 | 在 README 完成什么（≤30 秒~5 分钟） | 深度去向 |
|---|---|---|
| **评估者**（GitHub/npm 首访） | 判断"这是不是我的问题/值不值得装"：30 秒定位 + 适合/不适合 + 一句"装好只需一行" | CHANGELOG.md（演进史）；docs/GOVERNANCE-FLOW.md（哲学细节） |
| **快速上手用户**（决定试用） | 装 → init → 第一句咒语 → 第一个 spec 完整命令流 → 知道"接下来去读哪" | `examples/sample-project/README.md`（11 步走查）；`lrnev guide`（内置手册） |
| **AI 客户端接入方**（团队 lead/开发） | 拿到最短正确 MCP 配置（含 LRNEV_WORKSPACE）→ 知道 text/structuredContent 双通道语义 → 知道 --profile/decision_context 存在 → 常驻提示词从权威源复制 | docs/AI-ADAPTATION.md（接入手册）；docs/HOOKS.md、docs/CONFIG.md、docs/MULTI-AGENT.md |
| **深度运维/治理负责人** | 目录树简化图 + ID/锚点/gate 一览 → 读语义权威 | docs/GOVERNANCE-FLOW.md、docs/CONFIG.md |
| **贡献者** | 3 行开发命令 → CONTRIBUTING.md | CONTRIBUTING.md |

**分工三原则**（供重写执行）：
1. **单一权威源**：每类内容只在一个文件定稿，README 一律指针化、不复制正文（唯一豁免：最短 MCP JSON 片段属"上手灵魂操作"可保留 5 行）。
2. **README = 决策 + 上手 + 地图**；docs/ = 功能手册；CHANGELOG.md = 历史与升级注意；dev-docs/ = 研发内部（不进 README 正文，可在地图里一行说明"内部"）。
3. **版本演进标注不进 README 正文**（v2.1/v2.2/v2.3 括号一律移除，归 CHANGELOG）；README 描述的是"当前版本长什么样"。

---

## 3. 新版 README 重写大纲（章节级 + 要点 + 篇幅估计）

> 目标：全文 **~300 行**（现 381）。每节标注"读者对象"与"链接完整性"（全部目标文件存在性已核实，见 §3-末表）。括号内为预计行数。

### §0 标题 + 一行定位 + 版本行（6 行）
- `# lrnev 🧭` 保留；subtitle 收敛为一句话："给 AI 协作开发加项目治理的 MCP 服务 + CLI（Scene→Spec→Task、Gate、Markdown 文件即真相，零模型依赖）"。
- 版本行改为："npm 包 `lrnev` · 命令 `lrnev` / `lrnev-mcp` · 仓库 `lrnev-govern` · 当前版本 X.X.X"（一次说清名词家族，消 P14；版本号见 §4-1）。

### §1 lrnev 是什么（30 秒）（~25 行，对象：评估者）
- 痛点四连保留但压缩为一行四个："AI 健忘 / 无依据 / 多窗口打架 / 质量看运气"。
- 解决方式一句话 + 一张 4 格最小概念卡（正文不展开，细节引 §3 或 GOVERNANCE-FLOW）：
  - **Scene** 业务域 → **Spec** 可交付特性（requirements/design/tasks 三文件）→ **Task** T-XXX 执行单元（validates 挂 F-xx/D-xx 锚点）
  - **Gate**：creation/ready/completion 只查结构契约，不判质量
  - **轻产物分流**：error_record / adr_create / memory_save 管小事，spec 只管可交付特性
- 保留"只引导，不强制 + 零模型"（当前 L35-42 精华），压缩到 4 行。
- **删除/外移**：省 token 长账（L44-65）与 codegraph 对比段（L67-73）→ 精简为 3 行"为什么省：快照/地图/检索，细节见 docs/AI-ADAPTATION.md"（是否彻底保留问用户，§4-3）；"适合/不适合 + 不绑定客户端"保留 5 行。

### §2 快速上手（5 分钟）（~30 行，对象：快速用户）
- 安装：`npm install -g lrnev`（1 行）＋ 要求 Node ≥ 20（1 行）。
- 初始化：`lrnev init`（在项目根；1 行）。
- 对 AI 说第一句咒语："本项目用 lrnev 治理，先调 lrnev_guide 了解用法再推进"（现状 L178 保留，3 行）。
- **最小 spec 流**（6-8 条可复制命令，与 examples/sample-project 的步骤逐条对齐，防例证漂移）：
  `lrnev spec create user-login --priority P0` → 填 requirements（换 FILL 哨兵）→ `lrnev gate check --scene 00-default --spec 01-00-user-login --gate ready` → `lrnev task create "..." --validates F-01 --acceptance ...` → `lrnev task update T-001 --status in_progress/completed` → `lrnev gate check --gate completion` → `lrnev report` 收官体检。
- 结尾一行："完整 11 步带讲解走查见 examples/sample-project；手把手语义见 docs/GOVERNANCE-FLOW.md"。

### §3 核心概念（最小示例）（~30 行，对象：所有人/深度运维）
每个概念 1-2 句 + 最小区块，不再用"遇到再解释"：
- `.lrnev/` 是什么：Markdown + frontmatter，git 可管（2 行）+ **精简目录树 6-8 行**（PROJECT.md/scenes/每 spec 三件套/steering/decisions+errorbook+memory/config）（消 P9：41 行全树 → 指针引 docs/GOVERNANCE-FLOW.md 或保留在 examples 注释）。
- ID 与锚点：Scene `{NN}-{kebab}` / Spec `{NN}-{VV}-{kebab}` / Task `T-001` / `F-xx`=`#### F-xx`、`D-xx`=`#### D-xx`，validates 硬校验存在性、序号会复用须用完整 ID（5 行）。
- 状态机 1 行：Spec `draft→ready→in-progress→completed→archived`；Task `pending→in_progress→completed|blocked|failed`。
- Gate 一览 3 行：creation（骨架）→ ready（结构+无 FILL+章节标题契约）→ completion（任务全 completed + 无 FILL + design 存在）；status 不阻塞 gate。
- L0/L1/L2、frontmatter、sidecar 摘要各 1 句定义（消 P13 的头部术语）。
- 结尾指针：语义权威 = docs/GOVERNANCE-FLOW.md。

### §4 工具与 CLI 速查（~15 行，对象：所有人）
- CLI：顶层 19 命令按组列表（init/guide/status/map/report/doctor｜scene/spec/task/gate/goal/adr/error/memory/summary/session/hook/agent/search），**不逐条贴选项**："完整命令与选项以 `lrnev --help` / `lrnev <cmd> --help` 为权威"。
- MCP：工具名与 CLI 子命令一一对应（`task_create_many` ↔ `task create-many`）；默认 **42 个 full**；`--profile core`（33 个，裁 agent_* 自动面 + lrnev_hook_* 配置面）一句话 + 指向 AI-ADAPTATION 分组总览。
- 不逐列 42 工具（tools/list 与 AI-ADAPTATION 分组表是权威）——是否逐列问用户（§4-5）。

### §5 AI 客户端接入（~35 行，对象：接入方）【P3 的落点】
1. **前置**：Node ≥ 20；工作区定位优先级 `LRNEV_WORKSPACE` → 进程 cwd 向上找 `.lrnev`；**必须在配置里 `env` 钉死 LRNEV_WORKSPACE**（现状最大踩坑，AI-ADAPTATION 标"重要"，README 现缺失）。
2. **配置示例**：通用 MCP JSON（command=lrnev-mcp + env.LRNEV_WORKSPACE 绝对路径）3-5 行；Claude Code 同 JSON（L178 现状保留）；Codex `~/.codex/config.toml` `[mcp_servers.lrnev]` 参考写法（**以官方最新格式为准**，见 §4-7 确认点）；其余客户端（Cursor/OpenCode/自研）→ AI-ADAPTATION。
3. **`--profile`**：一行 + 带 args 的 JSON 示例（现状 L184-186 微调保留）。
4. **响应双通道语义（3.0.0，必须新增）**：每次工具返回同时有
   - `content[0].text`：按工具渲染的**模型可见文本**（人/AI 读，含【角色前缀】行与修复 hint）——AI 客户端直接读它即可；
   - `structuredContent`：**canonical 机器契约**（`response_version:'1'`、`ok`、`data`、`errors`、`ai_followup`、`anchor_context/summary_context`；assess_goal/scene_create/spec_create/task_create 可附顶层 `guidance`）；
   - `ok=false` 一律 `isError=true`（含歧义引用）；脚本/严格客户端请消费 structuredContent（勿 JSON.parse text——3.0.0 迁移注意①）。
5. **`decision_context`（可选，v3.0.0）**：3 行——四工具可传"本次调用意图声明"（strength explicit/preferred/unspecified 等），只影响建议与【决策边界】行，**不落盘、不阻断**；不传则行为与旧版一致。
6. **防长对话遗忘**：常驻提示词**短版 6-8 行**（README 内）＋ 一句"完整版（含三条拆分标尺）见 docs/AI-ADAPTATION.md"（消 P8 双份漂移）。
7. **hooks** 一句定义 + 配置路径 `.lrnev/config/hooks.json` → docs/HOOKS.md（消 P13 的 hooks）。

### §6 文档地图（~15 行，对象：所有人）【P11 落点】
三列表格（"读它解决什么问题｜何时读｜权威文件"）：
- 快速上手走查：examples/sample-project/README.md
- 接入方手册（跨客户端/工具分组/实测矩阵/常驻模板全文）：docs/AI-ADAPTATION.md
- 治理语义权威（gate/状态机/锚点/序号/adopt/报告口径）：docs/GOVERNANCE-FLOW.md
- 配置键权威：docs/CONFIG.md（+ 完整示例 docs/examples/lrnev.json）
- Hooks：docs/HOOKS.md（+ 完整示例 docs/examples/hooks.json）
- 多 Agent/claim：docs/MULTI-AGENT.md；源码结构：docs/ARCHITECTURE.md
- 演进历史与升级注意：CHANGELOG.md；贡献：CONTRIBUTING.md
- dev-docs/ 与 ai-discussions/：一行"研发内部档案（观测报告/发布流程/归档），非用户文档"。

### §7 开发 / 反馈 / License（~10 行，对象：贡献者）
- 3 行（build/test/dev:mcp）→ CONTRIBUTING.md（消 P10）；Issue 链接 + MIT（现状 §7/许可证合并压缩）。

### 大纲引用的目标文件（链接完整性——全部已核实存在 ✓）
| 引用 | 路径 | 存在性 |
|---|---|---|
| 文档地图全部 | `docs/ARCHITECTURE.md`、`docs/AI-ADAPTATION.md`、`docs/CONFIG.md`、`docs/GOVERNANCE-FLOW.md`、`docs/HOOKS.md`、`docs/MULTI-AGENT.md` | ✓ |
| 配置完整示例 | `docs/examples/lrnev.json`、`docs/examples/hooks.json` | ✓ |
| 上手 demo | `examples/sample-project/README.md` | ✓ |
| 历史/贡献/许可 | `CHANGELOG.md`、`CONTRIBUTING.md`、`LICENSE` | ✓ |

### 现有内容去向表（重写执行时使用）
| 现状内容 | 去向 |
|---|---|
| §1 省 token 长账（L44-65）、codegraph 对比（L67-73） | 压缩 3 行或移出（问用户 §4-3） |
| §2 全注释目录树（L88-140 约 53 行） | 精简 6-8 行；详细树移 examples/sample-project 或删除 |
| §3 常驻提示词全文（L200-235） | 短版 + 指向 AI-ADAPTATION |
| §4 mermaid 两图（L296-327） | 删除或并入 AI-ADAPTATION/示例（正文用 §3 概念卡替代） |
| §6 开发命令（L359-365） | 压缩 3 行 + CONTRIBUTING |
| 各节 v2.x 括号历史标注 | 全部移除（归 CHANGELOG） |

---

## 4. 重写时需向用户确认的点

1. **版本口径（最重要）**：按 3.0.0（含 text/structuredContent 双通道迁移注意、decision_context、guidance、isError 收严）一次写成，还是先按已发布 2.3.0 事实写、3.0.0 发布时再补？版本行写什么数字（package.json 现仍 2.3.0，未 bump）？
2. **语言**：维持全中文？npm 包对全球可见——是否加英文版/双语 README（或先中文后议）？
3. **风格与特色段去留**：保留 emoji + 闲聊式口吻与"贴身提醒的助理 / 分红"比喻吗？"省 token 账（含约 2000 tokens 固定开销估算）"与"与 codegraph 互补"整段——保留/精简/删除？（估算数字无法在代码侧验证，属营销性断言，建议弱化或删除）
4. **常驻提示词**：接受"README 短版 + 权威全文在 AI-ADAPTATION"的单源方案吗？（现双份已漂移：AI-ADAPTATION 含"三条拆分标尺 + 用户决定优先"，README 副本缺失）
5. **工具速查形态**：CLI 19 命令按组列表 + "42 工具不逐列、指向 tools/list 与 AI-ADAPTATION 分组表"可以吗？还是要求 README 逐列 42 工具名？
6. **目录树**：41 行全注释树砍到 6-8 行 + 语义文档指针，可接受吗？（这是"用户 vs 运维"取舍的典型点）
7. **客户端专属配置示例范围**：仓库内没有非 harness 的权威 Codex/Cursor/OpenCode 示例（`tests/e2e/t027-baseline/codex-config.toml` 自注"草稿，待实施"）。README 只保留"通用 MCP JSON + env（Claude Code 同形）"并把 codex/cursor 示例列为"以官方格式为准"，其余放 AI-ADAPTATION（需另立 AI-ADAPTATION 3.0.0 同步任务，含 P16）——是否接受该中间态？codex TOML 片段由谁负责核对？
8. **术语口径**：为防混淆，文档统一称"MCP 返回的 `content.text`（渲染文本）"与"`structuredContent`（结构化数据契约）"，不称"text 通道/JSON 返回"（CLI `report` 的 text 输出与此无关）——确认该措辞。
9. **文档地图要不要提 dev-docs/ 与 ai-discussions/**（两者含研发观测/过程产物，是否对公众隐藏）——涉及仓库对外形象。
10. **标题/品牌**：继续用 `lrnev 🧭`？subtitle 是否定稿为一句（现两行长句）？repo 名 `lrnev-govern` vs 包名 `lrnev` 的混淆是否要在 README 首屏加"名词家族"一行解决（本报告建议加）。

---

## 5. 附：本次核对的方法与边界

- 只读：未修改 README.md、docs/、任何源文件；未 commit。
- 核对渠道：README 全文通读；`docs/AI-ADAPTATION.md`、`docs/GOVERNANCE-FLOW.md`、`docs/CONFIG.md` 全文 + 其余 docs 标题级；CHANGELOG.md v2.x；源码 grep（双通道/decision_context/gate/profile）；实跑 `node bin/lrnev.mjs --help`、`gate --help`、`report --help`、`report --json`、`status`（本仓库工作区）。
- 未实跑全量测试（1051 数字引自发布变更清单草稿 09-04 记录；README"692"判定为过期）。
- 3.0.0 属未发布状态：README 是否写 3.0.0 内容本身依赖发布决策（§4-1）。
