<div align="center">

# lrnev

> 让 AI 会话有记忆、有依据、不打架。

🎯 确定性项目治理引擎：给 AI 协作开发加上 Scene → Spec → Task + Gate 的流程与档案。Markdown 文件即真相，零模型依赖；MCP 服务 + CLI 双形态。

[![npm version](https://img.shields.io/npm/v/lrnev)](https://www.npmjs.com/package/lrnev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/LuChangQiu/lrnev-govern/blob/main/LICENSE)
[![MCP server](https://img.shields.io/badge/MCP-server-blue)](https://github.com/LuChangQiu/lrnev-govern#readme)
[![Node.js ≥ 20](https://img.shields.io/badge/Node-%E2%89%A520-green)](https://nodejs.org)

[看效果](#效果示例) · [安装接入](#安装与接入) · [它解决什么](#它解决什么30-秒) · [5 分钟上手](#5-分钟最小闭环) · [命令速查](#命令与工具速查) · [文档地图](#文档地图)

名词家族：npm 包 **`lrnev`** · 命令 `lrnev`（CLI）与 `lrnev-mcp`（MCP 服务）· 源码仓库 `lrnev-govern` · 要求 Node.js ≥ 20（当前版本见 [npm](https://www.npmjs.com/package/lrnev)）

</div>

---

## 效果示例

### ① 真实体检输出

`lrnev report` 给项目自己做治理体检：链路完整度、`validates` 覆盖率、欠债清单与可执行的下一步。下面是 **lrnev-govern 仓库自身工作区**的实测输出（2026-09-10 在仓库根跑 `lrnev report`；为节省篇幅省略了分 Scene 明细行与 `位置:` 行）：

```text
lrnev 治理体检 · 全部 scene    2026-09-10

━━ ① 链路完整度 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Scene 5   Spec 21   Task 124

━━ ② validates 覆盖率 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  锚点 202   已验证 183   覆盖率 90.6%

  孤儿锚点·真欠债 (2，已收口 spec 却没人验证):
      · 01-findings-remediation/08-00-guidance-semantic-boundary  D-02、D-03
        → 给锚点 D-02、D-03 补一个 task 的 validates，或确认该需求/设计是否仍需要。
      · 04-ai-guidance-standardization/04-00-agent-e2e-observability  D-01、D-02、D-03、D-04、D-05
        → 给锚点 D-01、D-02、D-03、D-04、D-05 补一个 task 的 validates，或确认该需求/设计是否仍需要。

  孤儿锚点·在途 (12，正常，待拆 task)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  发现治理欠债：2 处已收口 spec 仍有孤儿锚点。
```

数字会随仓库演进变化；`report` 是给人看的欠债快照、不是 CI gate——有债也 exit 0。

### ② 一次接手是怎么走的

这条链路是 lrnev 引导 AI 的既定行为（依据：`.lrnev/steering/CORE_PRINCIPLES.md` §1 / §3 / §8，以及各工具的 description 与 `ai_followup`），不是示例对话：

1. **`project_status` 接手**：拿 scenes / specs / active_tasks / recent_adrs / open_errors 快照；有 `in_progress` / `blocked` 的 Task 就先从它续做。
2. **回看验收口径**：`spec_get` 或 `context://spec/{scene}/{spec}` 读回该 Spec 的 requirements / design。
3. **推进**：`task_update(status=in_progress)`——声明了 `validates` 的任务会连同 `anchor_context` 把锚点原文（验收口径）回填到响应里，不用自己翻文件；没声明 `validates`（或声明的锚点段落不可解析）的退回 Spec 级 `summary_context`。
4. **收口**：任务全部跑完后 `spec_gate_check(gate=completion)`，按返回的 `checks` 修到通过，再 `spec_update(status=completed)`。
5. **别漏 followup**：写入类工具的 `ai_followup.instructions` 是 AI 的下一步待办（常见一条是"生成 L0/L1 摘要并调 `summarize_save`"）——不执行 = 工作未完成。

---

## 它解决什么（30 秒）

AI 协作开发常见四个问题：**AI 健忘**（新会话不记得项目上下文）、**没有依据**（代码追溯不到需求与验收）、**多窗口打架**（多个 AI 会话改同一处）、**质量看运气**（需求没说清就动手）。lrnev 给这些场景补上"档案 + 流程"：

| 痛点 | lrnev 的做法 |
|------|--------------|
| AI 健忘 | 需求、设计、任务、决策与踩坑落成项目内 `.lrnev/` 的普通 Markdown——人可读、AI 可写、可 git 版本管理，换个会话也查得到 |
| 没有依据 | Task 的 `validates` 挂到 `F-xx` / `D-xx` 锚点，做到哪、验收什么都有据可查 |
| 多窗口打架 | Agent 注册与 Task claim 声明"谁在做哪件"，重叠时给提示；真正的代码冲突交给 git 与测试 |
| 质量看运气 | 三档 Gate 结构契约门禁 + `lrnev report` 欠债快照，让"做完没收口"看得见 |

概念最小卡：`Scene`（业务域）→ `Spec`（可独立交付的特性：requirements / design / tasks）→ `Task`（`T-xxx`，`validates` 挂锚点）；`Gate` 三档只查结构契约、不判质量；小事走轻产物（`error_record` / `adr_create` / `memory_save`）。

**适合**：一人多 AI 窗口接力同一项目、代码需要需求追踪与验收闭环、给 MCP 工具加治理骨架、长期迭代的项目。
**不适合**：一次性小脚本、纯问答、玩具 demo——直接让 AI 做即可，不必套流程。

🔌 **不绑定客户端**：Claude Code / Cursor / Codex 及任意支持 MCP 的客户端都能接入；不接 MCP 时 CLI 走同一套逻辑。

---

## 安装与接入

```bash
npm install -g lrnev        # 要求 Node.js ≥ 20
cd your-project
lrnev init                  # 生成 .lrnev/（Markdown 档案，可 git add .lrnev/ 版本管理；不传 --project-name 则默认用当前文件夹名）
```

装一个包，CLI 与 MCP 服务入口都有了。

> 交互式终端里 `lrnev init` 会额外问一句"是否在项目根生成 AGENTS.md"（指针式入口，给 AI 会话指向 `.lrnev/steering/` 行为指引；**默认不生成**）。`--with-agents-md` 跳过询问、强制生成——脚本/CI 用这个 flag。已存在 AGENTS.md 时不覆盖。

### 接入 AI 客户端（MCP）

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

> **防长对话遗忘**：MCP 的工具说明只在连接初始化时注入一次，长会话压缩后 AI 可能忘记 lrnev。把**常驻提示词**模板贴进客户端的常驻提示槽（Claude Code `CLAUDE.md` / Cursor rules / Codex instructions 等）即可——单 lrnev 版与 lrnev + 代码图谱组合版的全文见 [docs/AI-ADAPTATION.md](https://github.com/LuChangQiu/lrnev-govern/blob/main/docs/AI-ADAPTATION.md) 的"常驻提示词模板"节，该文档是唯一权威源，README 不复制全文。

---

## 5 分钟最小闭环

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

**你会看到什么**：

- `ready` gate 会拦下 requirements 里没替换的 `<!-- FILL: ... -->`，点名具体行号（如「仍有未填哨兵：L28, L31, L37」）并给出修法 hint；验收清单里没勾选的 `- [ ]` 也会被指出。`completion` gate 同样硬拦 requirements / design 残留的 FILL——"任务做完"得同时"内容填完"。
- `spec create` 的 `ai_followup` 提醒：三文档的章节标题是模板契约，**不要翻译或改名**（ready gate 按中文标题精确匹配）。
- gate 通过后按提示回填状态；写入类工具的 `ai_followup.instructions` 是给你的下一步待办，不执行 = 工作未完成。

> 完整 11 步带讲解与 requirements/design 最小填法见 [examples/sample-project/README.md](https://github.com/LuChangQiu/lrnev-govern/blob/main/examples/sample-project/README.md)；gate / 哨兵 / 状态机语义见 [docs/GOVERNANCE-FLOW.md](https://github.com/LuChangQiu/lrnev-govern/blob/main/docs/GOVERNANCE-FLOW.md)；内置手册随时可看：`lrnev guide`。

---

## 核心概念

| 概念 | 落成什么 | 工具 / 门禁 |
|------|----------|-------------|
| 🗂️ **Scene** | 业务域目录 `scenes/01-user-management/`（`00-default` 是不指定 scene 时的兜底） | `scene_create` |
| 📋 **Spec** | `requirements.md`（L0/L1/L2 分层 + `#### F-xx` 需求与验收）、`design.md`（`#### D-xx`）、`tasks.md`（`T-xxx`） | `spec_create` / `spec_update` / `spec_gate_check` |
| ✅ **Task** | `tasks.md` 里一条 `T-xxx`（`validates` 挂 F-xx / D-xx 锚点） | `task_create` / `task_create_many` / `task_update` |
| 🚦 **Gate** | 三档结构契约门禁：`creation`（骨架与命名契约）/ `ready`（requirements 结构完整、无 FILL）/ `completion`（任务全 completed + requirements/design 无 FILL）。只查"该有的都有、占位已清"，不判质量 | `spec_gate_check` |
| 📝 **轻产物** | ADR（`decisions/adr/`）、Errorbook（`errorbook/`）、Memory（`memory/`）——小事不走 Spec | `adr_create` / `error_record` / `memory_save` |

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
├── decisions/adr/                  # 关键决策（ADR，0001- 起；状态 proposed / accepted / deprecated / superseded）
├── errorbook/                      # 踩坑记录（指纹去重）
├── memory/                         # 项目记忆（约定/偏好/模式等）
├── config/hooks.json               # Hooks 配置
└── agents/ · runtime/ · locks/ · state/   # 运行态（进程生命周期相关，可忽略并出库不跟踪）
# steering/ · config/ 由 lrnev init 生成，属运行副本：出库不跟踪（steering/ 真源在 templates/steering/）
```

档案 ↔ 工具：`decisions/adr/` ↔ `adr_create` / `adr_list` / `adr_get`；`errorbook/` ↔ `error_record` / `error_search` / `error_promote`（踩坑可提升为手册）；`memory/` ↔ `memory_save` / `memory_search`；`scenes/*/specs/` ↔ spec / task / gate 系列；全部档案可被 `context_search` 全文检索——接手或新建前先查既有决策与已记录的错误，避免与历史冲突或重复踩坑。**AI 生成的总结不会静默成为项目事实**：决策、教训、约定经上述**显式动作**沉淀，AI 提议、用户决定、文件为证。

- **ID / 锚点 / 状态机**：Scene `{NN}-{kebab-name}`（如 `01-user-management`）、Spec `{NN}-{VV}-{kebab-name}`（VV 是重写版号，非修订号，如 `01-00-user-login`）、Task `T-001` 起在 Spec 内递增、锚点 `#### F-xx`（requirements）/ `#### D-xx`（design）。**序号可复用、锚点必须真实**：目录序号按 max+1 分配，删除高位会被复用，引用一律用完整 ID；`validates` 只接受真实存在的锚点（引用不存在的编号会被拒绝）。状态机：Spec `draft → ready → in-progress → completed → archived`（archived 是终态、只由用户决定；`completed` 可合法回退 `in-progress` 做维护增量），Task `pending → in_progress → completed | blocked | failed`（completed 是终态，返工请新建 task；blocked / failed 可回退 pending 重试）。完整语义见 [docs/GOVERNANCE-FLOW.md](https://github.com/LuChangQiu/lrnev-govern/blob/main/docs/GOVERNANCE-FLOW.md) 的「ID 与序号」「状态机」「Gate 语义」节。
- **写作与摘要约定（L0 / L1 / L2）**：一句话摘要 / 概览 / 详情的分层写作，AI 先读摘要判断、确认后再下钻；sidecar 摘要按文档键控（`.requirements.abstract.md` / `.requirements.overview.md`），lrnev 零模型——摘要由客户端 AI 生成（`summarize_save`），lrnev 只负责存取与检索。`status` 不阻塞 gate，`spec_gate_check` 随时可跑。
- **轻产物分流**：踩坑 → `error_record`；小决策 / 选型 → `adr_create`；约定 / 要点 → `memory_save`；只有需要追踪、拆任务、验收闭环的可交付特性才开 Spec。
- **扩展点 Hooks**：事件（Task 完成、gate 通过等）发生后自动执行项目脚本，配置在 `.lrnev/config/hooks.json`，写法见 [docs/HOOKS.md](https://github.com/LuChangQiu/lrnev-govern/blob/main/docs/HOOKS.md)。
- **消费机器可读数据的接入方**：写脚本 / 严格客户端解析 `structuredContent` 的字段表、截断元数据、`decision_context` 入参与 2.x→3.0 迁移注意，见 [docs/MCP-CONTRACT.md](https://github.com/LuChangQiu/lrnev-govern/blob/main/docs/MCP-CONTRACT.md)。

---

## 边界与诚实说明

- **不调 LLM / 不联网 / 不查源码**：只做**有标准答案**的事——文件读写、ID 分配、状态机、结构校验，全程零模型、零 embedding、不产生模型费用。源码语义（哪个函数调哪个、改这里影响谁）它不管，查代码用 grep / read。
- **只引导不强制**：需要判断的事（需求质量、任务拆分、该不该开 Spec）它只给建议与下一步（`ai_followup`），决定权始终在人与 AI。AI 若绕过约定，它不会阻止——靠约定与可见性，而不是硬拦。
- **不判质量**：Gate 只查"该有的都有、占位已清"，需求写得好不好、实现是否真的解决问题，它不知道。
- **本地信任模型**：MCP 当前只提供 stdio transport（客户端把它当子进程拉起，见 [docs/ARCHITECTURE.md](https://github.com/LuChangQiu/lrnev-govern/blob/main/docs/ARCHITECTURE.md)），没有认证与多租户概念——**工作区就是信任边界**，别把它交给不可信的调用方。
- **单机文件真相**：多窗口协作靠 Agent 注册 / Task claim 与文件锁做**软占用**与重叠提示，不锁源码；真正的代码冲突交给 git 与测试。

---

## 命令与工具速查

CLI 顶层命令按组（完整命令与选项以 `lrnev --help` / `lrnev <cmd> --help` 为权威）：

| 组 | 命令 |
|----|------|
| 起步与全景 | `init` · `guide` · `status` · `map` · `report` · `doctor` · `search` |
| 治理对象 | `scene` · `spec` · `task` · `gate` · `goal` |
| 轻产物与记忆 | `adr` · `error` · `memory` · `summary` · `session` |
| 运行面 | `hook` · `agent` |

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

MCP 工具名与 CLI 子命令一一对应（`lrnev_guide` ↔ `lrnev guide`，`task_create_many` ↔ `lrnev task create-many`）。42 个工具不在此逐列：分组总览、`core` / `full` 差异与常驻提示词模板见 [docs/AI-ADAPTATION.md](https://github.com/LuChangQiu/lrnev-govern/blob/main/docs/AI-ADAPTATION.md)；严格消费方以客户端 `tools/list` 返回的 schema 为准，字段与迁移注意见 [docs/MCP-CONTRACT.md](https://github.com/LuChangQiu/lrnev-govern/blob/main/docs/MCP-CONTRACT.md)。

---

## 文档地图

| 想解决什么问题 | 去哪读 |
|----------------|--------|
| 机器可读响应契约的权威源：双通道、信封字段表、`outputSchema`、截断元数据、`decision_context` 入参、2.x→3.0 升级注意 | [docs/MCP-CONTRACT.md](https://github.com/LuChangQiu/lrnev-govern/blob/main/docs/MCP-CONTRACT.md) |
| 11 步 CLI 上手走查（含 requirements/design 最小填法） | [examples/sample-project/README.md](https://github.com/LuChangQiu/lrnev-govern/blob/main/examples/sample-project/README.md) |
| 接入方手册：跨客户端接入配置、常驻提示词模板全文、工具总览与 `--profile core/full` 分层、实测矩阵（响应契约语义以 [docs/MCP-CONTRACT.md](https://github.com/LuChangQiu/lrnev-govern/blob/main/docs/MCP-CONTRACT.md) 为准） | [docs/AI-ADAPTATION.md](https://github.com/LuChangQiu/lrnev-govern/blob/main/docs/AI-ADAPTATION.md) |
| 治理运行语义权威：gate / 哨兵 / 状态机 / 锚点 / 序号 / report 口径 | [docs/GOVERNANCE-FLOW.md](https://github.com/LuChangQiu/lrnev-govern/blob/main/docs/GOVERNANCE-FLOW.md) |
| 配置键与默认值（完整键示例：[docs/examples/lrnev.json](https://github.com/LuChangQiu/lrnev-govern/blob/main/docs/examples/lrnev.json)） | [docs/CONFIG.md](https://github.com/LuChangQiu/lrnev-govern/blob/main/docs/CONFIG.md) |
| Hooks 事件与配置写法（完整示例：[docs/examples/hooks.json](https://github.com/LuChangQiu/lrnev-govern/blob/main/docs/examples/hooks.json)） | [docs/HOOKS.md](https://github.com/LuChangQiu/lrnev-govern/blob/main/docs/HOOKS.md) |
| 多 Agent 注册 / 心跳 / claim 接管 | [docs/MULTI-AGENT.md](https://github.com/LuChangQiu/lrnev-govern/blob/main/docs/MULTI-AGENT.md) |
| 源码结构与设计原则 | [docs/ARCHITECTURE.md](https://github.com/LuChangQiu/lrnev-govern/blob/main/docs/ARCHITECTURE.md) |
| 演进历史与版本升级注意 | [CHANGELOG.md](https://github.com/LuChangQiu/lrnev-govern/blob/main/CHANGELOG.md) |
| 如何参与贡献 | [CONTRIBUTING.md](https://github.com/LuChangQiu/lrnev-govern/blob/main/CONTRIBUTING.md) |

仓库里还有一些非用户文档，引用前先认清定位：

- `dev-docs/`：研发内部档案（[dev-docs](https://github.com/LuChangQiu/lrnev-govern/tree/main/dev-docs)：设计讨论、实施观测、复审记录与归档），非用户文档。06-00 曾以正式文档发布的 `client-integration-guide` / `mcp-response-conformance` 两稿（内容与 3.0.0 实现不符）经终审裁决退回 dev-docs 档案定位、不作为 3.0.0 用户文档收录——接入方无需另读，语义以 [docs/MCP-CONTRACT.md](https://github.com/LuChangQiu/lrnev-govern/blob/main/docs/MCP-CONTRACT.md) 与 [AI-ADAPTATION](https://github.com/LuChangQiu/lrnev-govern/blob/main/docs/AI-ADAPTATION.md) 为准。
- `tests/e2e/t027-baseline/`：T-027 三客户端真实观测资产（双 SHA 对照 harness、决策场景与证据库），见 [目录 README](https://github.com/LuChangQiu/lrnev-govern/blob/main/tests/e2e/t027-baseline/README.md)。

---

## 开发与反馈

```bash
npm install && npm run build     # tsc 编译到 dist/
npm run typecheck                # 类型检查（发布门禁：0 错误）
npm test                         # 全量测试（2026-09-09 基准 1071 条 = unit 950 + integration/e2e 121，以 npm test 实跑为准）
npm run dev:mcp                  # tsx watch 热重载跑 MCP（入口 src/mcp/dev-entry.ts）
npm run dev:inspect              # MCP Inspector 图形调试（同 dev-entry）
node bin/lrnev.mjs init          # 本地跑已构建 CLI（需先 npm run build；等价全局 lrnev）
```

本地开发细节与提交规范见 [CONTRIBUTING.md](https://github.com/LuChangQiu/lrnev-govern/blob/main/CONTRIBUTING.md)。

问题反馈：请提 [Issue](https://github.com/LuChangQiu/lrnev-govern/issues)——bug 必修；暂不改的也会说明理由，不冷处理。

许可证：[MIT](https://github.com/LuChangQiu/lrnev-govern/blob/main/LICENSE)
