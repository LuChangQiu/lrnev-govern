# lrnev

> 🎯 确定性项目治理引擎：给 AI 协作开发加上 Scene → Spec → Task + Gate 的流程与档案。Markdown 文件即真相，零模型依赖；MCP 服务 + CLI 双形态。

名词家族：npm 包 **`lrnev`** · 命令 `lrnev`（CLI）与 `lrnev-mcp`（MCP 服务）· 源码仓库 `lrnev-govern` · 当前版本 **3.0.0**（要求 Node.js ≥ 20）

```bash
npm install -g lrnev
```

装一个包，CLI 与 MCP 服务入口都有了。

---

## 1. lrnev 是什么（30 秒）

AI 协作开发常见四个问题：**AI 健忘**（新会话不记得项目上下文）、**没有依据**（代码追溯不到需求与验收）、**多窗口打架**（多个 AI 会话改同一处）、**质量看运气**（需求没说清就动手）。lrnev 给这些场景补上"档案 + 流程"：

- 把需求、设计、任务、决策与踩坑，落成项目内 `.lrnev/` 目录的普通 Markdown 文件——人可读、AI 可写、可 git 版本管理。
- AI 通过 lrnev 的工具读写这些档案。lrnev 只做**有标准答案**的事（文件读写、ID 分配、状态机、结构校验），全程**不调用任何 LLM / Embedding、不联网、不产生模型费用**。
- 需要**判断**的事（需求质量、任务拆分、该不该开 Spec），lrnev 只给建议与下一步（`ai_followup`），决定权始终在人与 AI——**只引导，不强制**。

核心概念最小卡：

| 概念 | 一句话 |
|------|--------|
| 🗂️ **Scene** | 业务域（如 `01-user-management`），下面是该域的多个 Spec |
| 📋 **Spec** | 一个可独立交付的特性档案：`requirements.md`（`#### F-xx` 需求 + 验收）、`design.md`（`#### D-xx` 设计）、`tasks.md`（`T-xxx` 任务） |
| ✅ **Task** | 执行单元 `T-xxx`，`validates` 挂到 F-xx / D-xx 锚点，做到哪、验证什么都有据可查 |
| 🚦 **Gate** | `creation` / `ready` / `completion` 三档结构契约门禁：只查"该有的都有、占位已清"，不判质量 |
| 📝 **轻产物** | 小事不走 Spec：踩坑 → `error_record`，小决策/选型 → `adr_create`，约定 → `memory_save` |

最小闭环：`lrnev spec create user-login` → 填 requirements（替换 `<!-- FILL: -->` 占位）→ `lrnev gate check ... --gate ready` → `lrnev task create ... --validates F-01` → 用 `lrnev task update` 推进 → `lrnev gate check ... --gate completion` 收口。可完整照抄的命令流见本文第 2 节。

适合：一人多 AI 窗口接力同一项目、代码需要需求追踪与验收闭环、给 MCP 工具加治理骨架、长期迭代的项目。
不适合：一次性小脚本、纯问答、玩具 demo——直接让 AI 做即可，不必套流程。

🔌 **不绑定客户端**：Claude Code / Cursor / Codex 及任意支持 MCP 的客户端都能接入；不接 MCP 时 CLI 走同一套逻辑。

---

## 2. 🚀 快速上手（5 分钟）

### 2.1 安装与初始化

```bash
npm install -g lrnev        # 要求 Node.js ≥ 20
cd your-project
lrnev init                  # 生成 .lrnev/（Markdown 档案，可 git add .lrnev/ 版本管理；不传 --project-name 则默认用当前文件夹名）
```

> 交互式终端里 `lrnev init` 会额外问一句"是否在项目根生成 AGENTS.md"（指针式入口，给 AI 会话指向 `.lrnev/steering/` 行为指引；默认不生成）。`--with-agents-md` 跳过询问、强制生成——脚本/CI 用这个 flag。已存在 AGENTS.md 时不覆盖。

### 2.2 接入 AI 客户端（MCP）

在客户端的 MCP 配置里加一段：

```json
{
  "mcpServers": {
    "lrnev": {
      "command": "lrnev-mcp",
      "env": { "LRNEV_WORKSPACE": "/absolute/path/to/your-project" },
      "args": ["--profile", "core"]
    }
  }
}
```

- **`env.LRNEV_WORKSPACE`（强烈建议始终钉死）**：MCP 子进程的 cwd 常常不是项目根，不钉死时 lrnev 会向上查找 `.lrnev`，可能命中祖先目录里别的项目。CLI 侧的等价手段是全局参数 `lrnev --workspace <path>`；误命中时 server instructions 与 `lrnev_init` 都会警告。
- **`args: ["--profile", "core"]`（可选）**：缺省 `full` 注册全部 **42** 个工具（与 2.3.0 一致）；`core` 裁掉 9 个"AI 不该主动选"的工具（`agent_*` 自动面 4 个 + `lrnev_hook_*` 配置面 5 个），保留 **33** 个。差异见 [docs/AI-ADAPTATION.md](https://github.com/LuChangQiu/lrnev-govern/blob/main/docs/AI-ADAPTATION.md)。
- Claude Code / Cursor 使用同形 JSON；Codex 在 `~/.codex/config.toml` 配置（TOML 同字段，格式以 Codex 官方文档为准）：

```toml
[mcp_servers.lrnev]
command = "lrnev-mcp"
args = ["--profile", "core"]

[mcp_servers.lrnev.env]
LRNEV_WORKSPACE = "/absolute/path/to/your-project"
```

配好后新开会话，对 AI 说第一句：

> 本项目用 lrnev 治理。先调 `lrnev_guide` 了解用法，再按指引推进。

### 2.3 CLI 最小闭环

命令流与 [examples/sample-project](https://github.com/LuChangQiu/lrnev-govern/blob/main/examples/sample-project/README.md) 的 11 步走查同构（此处省去可选步骤）：

```bash
lrnev spec create user-login --priority P1          # 1. 建 Spec（不传 scene → 00-default），产出三文档
# 2. 编辑 .lrnev/scenes/00-default/specs/01-00-user-login/requirements.md，
#    把 <!-- FILL: ... --> 哨兵换成真实内容（最小填法见 sample-project 走查）
lrnev gate check --scene 00-default --spec 01-00-user-login --gate ready     # 3. ready：检查结构完整（通过后再拆任务）
lrnev spec update 01-00-user-login --scene 00-default --status ready         # 4. 状态回填
lrnev task create "实现登录 API" --scene 00-default --spec 01-00-user-login \
  --validates F-01 D-01 --acceptance "登录成功" "错误密码 401"                 # 5. 拆任务，挂需求/设计锚点
lrnev task update T-001 --scene 00-default --spec 01-00-user-login --status in_progress   # 6. 开始
lrnev task update T-001 --scene 00-default --spec 01-00-user-login --status completed     # 7. 完成
lrnev gate check --scene 00-default --spec 01-00-user-login --gate completion # 8. 收口 gate（会查 design 无 FILL）
lrnev report                                                                 # 9. 治理体检（欠债快照，不是 gate）
```

> 完整 11 步带讲解与 requirements/design 最小填法见 [examples/sample-project/README.md](https://github.com/LuChangQiu/lrnev-govern/blob/main/examples/sample-project/README.md)；gate / 哨兵 / 状态机语义见 [docs/GOVERNANCE-FLOW.md](https://github.com/LuChangQiu/lrnev-govern/blob/main/docs/GOVERNANCE-FLOW.md)；内置手册随时可看：`lrnev guide`。

---

## 3. 核心概念

### `.lrnev/` 工作区

全部是 Markdown + frontmatter（文件头的 YAML 元数据），人可读、AI 可写、可 git 版本管理，不依赖任何数据库。核心形状：

```text
.lrnev/
├── PROJECT.md · ARCHITECTURE.md    # 项目定位与团队约定 / 全局架构约束
├── steering/                       # 给 AI 的行为指引（原则、范围、ADR/memory/文档维护触发条件）
├── scenes/<NN-name>/               # 业务域；00-default 是不指定 scene 时的兜底
│   └── specs/<NN-VV-name>/
│       ├── requirements.md         # L0/L1/L2 分层 + #### F-xx 需求与验收
│       ├── design.md               # #### D-xx 设计点
│       └── tasks.md                # T-xxx 任务（标题注释承载状态机）
├── decisions/adr/                  # 关键决策（ADR，0001- 起）
├── errorbook/                      # 踩坑记录（指纹去重）
├── memory/                         # 项目记忆（约定/偏好/模式等）
├── config/hooks.json               # Hooks 配置
└── agents/ · runtime/ · locks/ · state/   # 运行态（进程生命周期相关，可忽略并出库不跟踪）
# steering/ · config/ 由 lrnev init 生成，属运行副本：出库不跟踪（steering/ 真源在 templates/steering/）
```

### 治理档案层：项目记忆由文件承载

`.lrnev/` 不只是配置，它是**项目记忆与治理档案层**——长期事实以结构化文件沉淀，而不是存在某个 AI 的上下文里：

| 档案 | 承载 | 工具 |
|---|---|---|
| `decisions/adr/` | 架构决策与选型（accepted/superseded 状态机） | `adr_create` / `adr_list` / `adr_get` |
| `errorbook/` | 踩坑、根因与已验证修法（指纹去重，可提升为手册） | `error_record` / `error_search` / `error_promote` |
| `memory/` | 跨会话的约定、偏好与模式 | `memory_save` / `memory_search` |
| `scenes/*/specs/` | 需求、设计与任务闭环（可 gate 验收） | spec / task / gate 系列 |
| `steering/` | 给 AI 的行为指引（原则、范围） | — |

**边界原则**：AI 生成的总结不会静默成为项目事实——决策、教训、约定经 `adr_create` / `error_record` / `memory_save` 等**显式动作**沉淀，AI 提议、用户决定、文件为证。全部档案可被 `context_search` 全文检索：接手或新建前先查既有决策与已记录的错误，避免与历史冲突或重复踩坑。

### ID 与锚点

| 对象 | 格式 | 例子 |
|------|------|------|
| Scene | `{NN}-{kebab-name}` | `01-user-management` |
| Spec | `{NN}-{VV}-{kebab-name}`（VV 是重写版号，非修订号） | `01-00-user-login` |
| Task | `T-001` 起，Spec 内递增 | `T-001` |
| 锚点 | `#### F-xx`（requirements）/ `#### D-xx`（design） | `F-01` / `D-01` |

**序号可复用、锚点必须真实**：目录序号按 max+1 分配，删除高位会被复用，引用一律用完整 ID；task 的 `validates` 只接受真实存在的锚点（引用不存在的编号会被拒绝）；completion gate 会硬拦 requirements/design 残留的 FILL 占位——"任务做完"得同时"内容填完"。

### 状态机与 Gate

- Spec：`draft → ready → in-progress → completed → archived`（archived 是终态、只由用户决定；completed 可合法回退 in-progress 做维护增量）。
- Task：`pending → in_progress → completed | blocked | failed`（completed 是终态，返工请新建 task；blocked/failed 可回退 pending 重试）。
- Gate 三档：`creation`（骨架与命名契约）→ `ready`（requirements 结构完整、无 FILL）→ `completion`（任务全 completed + requirements/design 无 FILL）。**Gate 只查结构契约，不判质量；status 不阻塞 gate**，`spec_gate_check` 随时可跑。

### 写作与摘要约定

- **L0 / L1 / L2**：一句话摘要 / 概览 / 详情的分层写作，AI 先读摘要判断、确认后再下钻。
- **sidecar 摘要**：按文档键控的 `.<文档名>.abstract.md`（L0）/ `.<文档名>.overview.md`（L1）。lrnev 零模型，摘要由客户端 AI 生成（`summarize_save`），lrnev 只负责存取与检索。
- **轻产物分流**：踩坑 → `error_record`；小决策/选型 → `adr_create`；约定/要点 → `memory_save`；只有需要追踪、拆任务、验收闭环的可交付特性才开 Spec。

---

## 4. MCP 响应契约（3.0.0，接入方必读）

> AI 客户端直接读文本通道即可，无需适配；本节写给"严格客户端 / 脚本"。

**双通道响应**：3.0.0 起每次工具调用同时返回

- `content[0].text`：**按工具渲染的模型可见文本**（AI / 人直接读）——含角色前缀行（【事实】/【建议】/【决策边界】/【执行约束】/【下一步】等）、截断与修复 hint；未注册回退 JSON。这是辅助阅读通道，格式随版本演进，**不保证可被机器解析**。
- `structuredContent`：**canonical 数据契约**——`response_version: '1'`、`ok`、`data`、`errors`、`ai_followup`，按场景出现 `anchor_context`（task 启动时回填的验收口径段落）/ `summary_context`（无 validates 时的 Spec 级摘要）。每工具随 `tools/list` 声明自己的 `outputSchema`。
- **截断元数据显式化（3.0.0，F-04）**：锚点/摘要上下文的截断标记是 `meta: { text_status: 'complete' | 'truncated_by_budget' | 'incomplete_source', original_length?, returned_length }`（预算截断与源残缺语义分离，残缺段落不回填占位噪声）；查询类工具带 `query_meta: { returned_count, total_count, truncated, omitted }`（`context_search` 的 `data.query_meta`、`project_status` 各 Spec 的 `claimable_meta`、`task_create_many` 的 `data.query_meta`），`total_count` 恒可得。文本通道同步投影截断提示（如「命中 N 条，仅返回 M 条」）。字段细节与消费指引见 [docs/GOVERNANCE-FLOW.md](https://github.com/LuChangQiu/lrnev-govern/blob/main/docs/GOVERNANCE-FLOW.md)。

**成功与失败判定**：`ok: true` 才是成功；`ok: false` 的业务拒绝（参数错误、状态机冲突、**歧义引用 AMBIGUOUS_REF**、内部错误）一律 `isError: true`，错误文本按 `[code] message + hint` 渲染。

**3.0.0 升级注意**：2.3.0 及以前 `content[0].text` 是 `JSON.stringify` 的 payload。曾用 `JSON.parse(content[0].text)` 消费结果的脚本/客户端，请迁移到 `structuredContent`（字段与旧 JSON 同构，另加 `response_version`）。

**`decision_context`（可选入参，v1）**：`scene_create` / `spec_create` / `task_create` / `assess_goal` 四个工具接受 `decision_context`——`source: 'client_asserted'`、`strength: explicit | preferred | unspecified`、必填 `summary`，可选 `direction`（new_scene / new_spec / reuse_spec / no_spec / other）与 `target_ref`（完整稳定引用）。它声明"本次调用是照着用户的什么组织决定来的"，服务端只把它作为本次调用的客户端声明参与建议与【决策边界】行渲染：**不落盘、不阻断**；`explicit`/`preferred` 必须提供 `direction`、`unspecified` 必须省略（条件规则违反返回 INVALID_INPUT）。不传 = 未声明，行为与旧版一致。

**常驻提示词（防长对话遗忘）**：MCP 的工具说明只在连接初始化时注入一次，长会话压缩后 AI 可能忘记 lrnev。完整模板（单 lrnev 版 / lrnev + 代码图谱组合版）见 [docs/AI-ADAPTATION.md](https://github.com/LuChangQiu/lrnev-govern/blob/main/docs/AI-ADAPTATION.md) 的"常驻提示词模板"节——贴进常驻提示槽（Claude Code `CLAUDE.md` / Cursor rules / Codex instructions 等）即可。README 不复制全文，该文档是唯一权威源。

**Hooks（本地自动化扩展点）**：事件（Task 完成、gate 通过等）发生后自动执行项目脚本，配置在 `.lrnev/config/hooks.json`，写法见 [docs/HOOKS.md](https://github.com/LuChangQiu/lrnev-govern/blob/main/docs/HOOKS.md)。

---

## 5. 工具与 CLI 速查

CLI 顶层命令按组（完整命令与选项以 `lrnev --help` / `lrnev <cmd> --help` 为权威）：

| 组 | 命令 |
|----|------|
| 起步与全景 | `init` · `guide` · `status` · `map` · `report` · `doctor` · `search` |
| 治理对象 | `scene` · `spec` · `task` · `gate` · `goal` |
| 轻产物与记忆 | `adr` · `error` · `memory` · `summary` · `session` |
| 运行面 | `hook` · `agent` |

MCP 工具名与 CLI 子命令一一对应（`lrnev_guide` ↔ `lrnev guide`，`task_create_many` ↔ `lrnev task create-many`）。42 个 MCP 工具不在本文逐列：分组总览、core/full 差异、常驻提示模板与实测矩阵见 [docs/AI-ADAPTATION.md](https://github.com/LuChangQiu/lrnev-govern/blob/main/docs/AI-ADAPTATION.md)；严格消费方以客户端 `tools/list` 返回的 schema 为准。

几个高频调用：

```bash
lrnev status                              # 接手：scenes / specs / active tasks 快照
lrnev map                                 # scene→spec(状态/L0)→锚点标题 全景，按 URI 直达
lrnev task create-many --scene 00-default --spec 01-00-user-login \
  --from-file tasks.json                  # 整单拆任务（JSON 数组；批内依赖用临时 key；失败整批不写）
lrnev report --scene 00-default --json    # 治理体检结构化输出（--md --out 可落档）
lrnev doctor --migrate-todos              # 工作区结构自检（含旧 TODO 格式迁移）
```

> `doctor` 管工作区**结构健康**（目录/锁/坏引用），`report` 管**治理进度**（收口缺口/覆盖率/欠债 + 下一步）。`report` 是给人看的快照、不是 CI gate——有债也 exit 0。

---

## 6. 文档地图

| 想解决什么问题 | 去哪读 |
|----------------|--------|
| 11 步 CLI 上手走查（含 requirements/design 最小填法） | [examples/sample-project/README.md](https://github.com/LuChangQiu/lrnev-govern/blob/main/examples/sample-project/README.md) |
| 接入方手册：跨客户端接入配置、常驻提示词模板全文、工具总览与 `--profile core/full` 分层、实测矩阵（双通道与 decision_context 语义以本文 §4 为准） | [docs/AI-ADAPTATION.md](https://github.com/LuChangQiu/lrnev-govern/blob/main/docs/AI-ADAPTATION.md) |
| 治理运行语义权威：gate / 哨兵 / 状态机 / 锚点 / 序号 / report 口径 | [docs/GOVERNANCE-FLOW.md](https://github.com/LuChangQiu/lrnev-govern/blob/main/docs/GOVERNANCE-FLOW.md) |
| 配置键与默认值（完整键示例：[docs/examples/lrnev.json](https://github.com/LuChangQiu/lrnev-govern/blob/main/docs/examples/lrnev.json)） | [docs/CONFIG.md](https://github.com/LuChangQiu/lrnev-govern/blob/main/docs/CONFIG.md) |
| Hooks 事件与配置写法（完整示例：[docs/examples/hooks.json](https://github.com/LuChangQiu/lrnev-govern/blob/main/docs/examples/hooks.json)） | [docs/HOOKS.md](https://github.com/LuChangQiu/lrnev-govern/blob/main/docs/HOOKS.md) |
| 多 Agent 注册 / 心跳 / claim 接管 | [docs/MULTI-AGENT.md](https://github.com/LuChangQiu/lrnev-govern/blob/main/docs/MULTI-AGENT.md) |
| 源码结构与设计原则 | [docs/ARCHITECTURE.md](https://github.com/LuChangQiu/lrnev-govern/blob/main/docs/ARCHITECTURE.md) |
| 演进历史与版本升级注意 | [CHANGELOG.md](https://github.com/LuChangQiu/lrnev-govern/blob/main/CHANGELOG.md) |
| 如何参与贡献 | [CONTRIBUTING.md](https://github.com/LuChangQiu/lrnev-govern/blob/main/CONTRIBUTING.md) |

仓库里还有一些非用户文档，引用前先认清定位：

- `dev-docs/`：研发内部档案（[dev-docs](https://github.com/LuChangQiu/lrnev-govern/tree/main/dev-docs)：设计讨论、实施观测、复审记录与归档），非用户文档。06-00 曾以正式文档发布的 `client-integration-guide` / `mcp-response-conformance` 两稿（内容与 3.0.0 实现不符）经终审裁决退回 dev-docs 档案定位、不作为 3.0.0 用户文档收录——接入方无需另读，语义以本文 §4 与 [AI-ADAPTATION](https://github.com/LuChangQiu/lrnev-govern/blob/main/docs/AI-ADAPTATION.md) 为准。
- `tests/e2e/t027-baseline/`：T-027 三客户端真实观测资产（双 SHA 对照 harness、决策场景与证据库），见 [目录 README](https://github.com/LuChangQiu/lrnev-govern/blob/main/tests/e2e/t027-baseline/README.md)。

---

## 7. 开发与反馈

```bash
npm install && npm run build     # tsc 编译到 dist/
npm run typecheck                # 类型检查（发布门禁：0 错误）
npm test                         # 全量测试（2026-09-10 基准 1070 条 = unit 949 + integration/e2e 121，以 npm test 实跑为准）
npm run dev:mcp                  # tsx watch 热重载跑 MCP（入口 src/mcp/dev-entry.ts）
npm run dev:inspect              # MCP Inspector 图形调试（同 dev-entry）
node bin/lrnev.mjs init          # 本地跑已构建 CLI（需先 npm run build；等价全局 lrnev）
```

本地开发细节与提交规范见 [CONTRIBUTING.md](https://github.com/LuChangQiu/lrnev-govern/blob/main/CONTRIBUTING.md)。

问题反馈：请提 [Issue](https://github.com/LuChangQiu/lrnev-govern/issues)——bug 必修；暂不改的也会说明理由，不冷处理。

许可证：[MIT](https://github.com/LuChangQiu/lrnev-govern/blob/main/LICENSE)
