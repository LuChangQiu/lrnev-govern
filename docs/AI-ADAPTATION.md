# AI 通用适配指南

本文档说明 lrnev 如何通过 MCP 协议的通用文本字段适配不同 AI 客户端，并给出多模型实测框架。核心原则是：lrnev 只提供确定性的文件事实、工具说明、错误提示和下一步建议；语义判断由接入的 AI 完成。

## 接入方式

### 前置条件

- Node.js 20 或更高版本。
- 项目里已经能运行 `lrnev-mcp`；源码开发时 clone 仓库后 `npm install && npm run build` 即可。
- AI 客户端需要支持 MCP stdio server。

### Claude Code

全局安装或 `npm link` 后，可以在 Claude Code 的 MCP 配置里加入：

```json
{
  "mcpServers": {
    "lrnev": {
      "command": "lrnev-mcp"
    }
  }
}
```

源码开发时，也可以直接指向本仓库的入口：

```json
{
  "mcpServers": {
    "lrnev": {
      "command": "node",
      "args": ["/path/to/lrnev-govern/bin/lrnev-mcp.mjs"]
    }
  }
}
```

接通后先让 AI 调 `lrnev_guide` 或 `project_status`，确认工具列表和工作区路径正确。

### Cursor

Cursor 的 MCP 配置同样使用 stdio server。配置形态与上面的 JSON 一致，推荐优先用本地源码入口，便于调试当前工作区：

```json
{
  "mcpServers": {
    "lrnev": {
      "command": "node",
      "args": ["/path/to/lrnev-govern/bin/lrnev-mcp.mjs"]
    }
  }
}
```

如果已经全局安装 `lrnev`，也可以把 `command` 换成 `lrnev-mcp`。配置后重启 Cursor 或刷新 MCP server，再让 AI 调 `lrnev_guide` 检查是否可用。

### 通用 MCP 客户端

任意支持 MCP stdio 的客户端只需要能启动一个命令：

```bash
lrnev-mcp
```

源码开发时：

```bash
node /path/to/lrnev-govern/bin/lrnev-mcp.mjs
```

### 工作区定位与 LRNEV_WORKSPACE（重要）

lrnev-mcp 启动时按「`LRNEV_WORKSPACE` 环境变量 → 进程工作目录向上查找已初始化的 `.lrnev`」定位工作区。客户端启动 MCP 子进程的 cwd 常常不是你的项目根，向上查找还可能命中祖先目录里别的 `.lrnev`——所以**推荐始终在 MCP 配置里显式钉死**：

```json
{
  "mcpServers": {
    "lrnev": {
      "command": "lrnev-mcp",
      "env": { "LRNEV_WORKSPACE": "/absolute/path/to/your-project" }
    }
  }
}
```

误命中时 lrnev 不会沉默：server instructions 与 `lrnev_init` 返回都会警告"工作区根定位到 X（向上查找命中）"，并提示设 `LRNEV_WORKSPACE` 修正。CLI 侧的等价手段是全局参数 `lrnev --workspace <path>`（MCP 工具没有该参数，只认环境变量）。

### CLI 兜底

不接 MCP 也可以用 CLI 验证同一套 core 行为：

```bash
lrnev guide
lrnev guide workflow
lrnev status
lrnev report
lrnev spec create user-login --priority P0
```

CLI 与 MCP 共用 core 逻辑；差异只在入口层。

## 工具总览（42 个，按用途分组）

MCP 工具名与 CLI 子命令一一对应（如 `task_create_many` ↔ `lrnev task create-many`）。每个工具的完整自描述以 listTools 返回为准，这里给分组速览：

| 分组 | 工具 |
|------|------|
| 入口与手册 | `lrnev_guide`、`lrnev_init`、`lrnev_doctor` |
| 接手与全景 | `project_status`（快照）、`governance_map`（scene→spec→锚点全景）、`lrnev_report`（治理债体检）、`context_search`（关键词检索） |
| Scene / Spec | `scene_create/list/get`、`spec_create/list/get/update`、`spec_gate_check`、`assess_goal`（单/多 Spec 粒度辅助） |
| Task | `task_create`（单条）、`task_create_many`（批量原子，v2.3）、`task_update`、`task_list`、`task_claim/release` |
| ADR | `adr_create`、`adr_list`、`adr_get`（读单条 ADR 全文与被取代关系） |
| Errorbook | `error_record`（记坑）、`error_search`（原文关键词检索）、`error_promote`（已验证的坑提升为手册，需 verification 证据） |
| Memory | `memory_save`（存一句约定）、`memory_search`（回看约定）、`memory_forget`（删过期记忆）、`session_commit`（会话结束批量沉淀候选记忆） |
| 摘要 | `summarize_save`（客户端把 L0/L1 摘要写回 sidecar——lrnev 零模型，摘要由 AI 生成、lrnev 只存只递） |
| 多 Agent | `agent_register/heartbeat/list/unregister` |
| Hooks | `lrnev_hook_list/trigger/enable/disable/tail_log` |

## 工具面分层：`--profile core` / `full`

42 个工具服务的消费方不同：`agent_*` 自动面由连接层在会话初始化时自动调用（AI 不该主动选），
`lrnev_hook_*` 配置面由人在配置期使用。lrnev-mcp 支持注册期裁剪（默认 `full`，向后兼容）：

| profile | 工具数 | 说明 |
|---------|--------|------|
| `full`（默认） | 42 | 全部工具 |
| `core` | 33 | 裁掉 9 个"AI 不该主动选"的工具：`agent_register`/`agent_heartbeat`/`agent_unregister`/`agent_list` + `lrnev_hook_list`/`lrnev_hook_trigger`/`lrnev_hook_tail_log`/`lrnev_hook_enable`/`lrnev_hook_disable` |

`core` 保留 task/adr/error/memory/session_commit/doctor/report/guide 全部——AI 决策与执行都可能用到；
`lrnev_doctor`/`lrnev_report` 是"AI 替人执行"的 User 层可见性通道，不能砍。弱模型对长工具清单的排除能力弱，
收敛工具面受益最大；强模型/治理型工作流用默认 `full` 即可。

MCP 客户端在配置的 `args` 里追加 `--profile core`（缺省 full，不改配置零变化）：

```json
{
  "mcpServers": {
    "lrnev": {
      "command": "lrnev-mcp",
      "args": ["--profile", "core"]
    }
  }
}
```

源码开发指向本仓库入口时同样追加在 `args` 末尾：

```json
{
  "mcpServers": {
    "lrnev": {
      "command": "node",
      "args": ["/path/to/lrnev-govern/bin/lrnev-mcp.mjs", "--profile", "core"]
    }
  }
}
```

`--profile` 仅接受 `core|full`（也支持 `--profile=core` 写法），非法取值启动即写 stderr 报错并退出；
参数在启动时生效，属于注册期裁剪，不碰业务 core 与渲染器。

## 如何对 AI 开口

### 常驻提示词模板（防长对话遗忘）

MCP 的工具说明与 server instructions 只在连接初始化时注入一次。长会话经过多轮压缩后，模型可能忘记“先看 lrnev 再动手”——把模板贴进客户端的**常驻提示槽**（每轮可见、不随压缩丢失）是最有效的防遗忘手段。粘贴位置：

- Claude Code：项目根 `CLAUDE.md`
- Cursor：`.cursor/rules` 或 Settings → Rules
- Codex：项目根 `AGENTS.md`（或自定义 instructions）
- 其他客户端 / 自研 Agent：等效的常驻 instructions 文件

按项目形态二选一粘贴（只贴一份，别叠加）：

| 模板 | 适用项目 | 说明 |
|------|----------|------|
| 模板 B：单 lrnev（推荐默认） | 中小代码库 / 治理驱动项目，内置 grep/glob/read 足够导航 | 零额外依赖；对弱模型、工具面板拥挤的客户端最友好 |
| 模板 A：lrnev + 代码图谱 | 中大型 / 多包代码库，日常需要符号级定位与影响面分析 | 需要环境挂代码图谱类 MCP 工具且项目已建索引；图谱工具名按环境替换占位 |

> 两模板正文按 2026-09-07 的 src 引导措辞生成（`src/mcp/guidance.ts`、`src/core/SpecGuidance.ts`、`src/core/guidance-semantics.ts`），与工具描述 / ai_followup 同口径；若日后与工具实际描述不一致，以工具描述与 `lrnev_guide` 为准。README 不再复制本文内容，本文件是常驻提示词的唯一权威源。

#### 模板 B：单 lrnev（推荐默认）

```text
# 工具栈与工作流

本项目用 **lrnev** 治理：Scene/Spec/Task、gate 门禁与轻产物全走它；查代码用 grep/glob/read（lrnev 不查源码）。`agent_*`/`hook_*` 由连接层/配置期处理，不必主动选。

## 工具速查（[核心] 档为主）

- 接手：project_status 快照；governance_map 全景；context_search 检索治理文档
- 生命周期：spec_create 开 Spec；spec_gate_check 门禁；spec_update 回填（归档只按用户要求）；spec_get/spec_list/scene_list/task_list 查明细
- 执行：task_create 补单+登记增量；task_create_many 整单拆解；task_update 推进
- 轻产物与辅助：error_record/adr_create/memory_save；assess_goal；lrnev_report 体检、lrnev_doctor 诊断、lrnev_guide 手册

## 核心规则

1. 只读 vs 要改：纯查代码/解释 → 直接做；流程只在要改代码或推进治理时走。
2. 要改且不知进度 → project_status；全景 governance_map；文档 context_search。
3. 开不开 spec 便宜先：
   - ① 写不出 WHEN…THEN 独立验收的小改动 → 直接做；
   - ② 开发/扩展请求（加/实现/补充）→ 定位承载 Spec（context_search/spec_get）→ **task_create 登记再实施**；直接编辑 requirements/design 只许需求细化/文档维护；completed spec 登记后可回退 in-progress（合法转换）；
   - ③ 独立特性（可独立交付）才 spec_create（两“是”）：优先已有 scene；新域经用户确认才 scene_create；无稳定域落 00-default（兜底）；
   - ④ 整体推翻 → 新版 version+1 留旧版对照；archived 终态只由用户定；
   - ⑤ 上下文冷却（旧 Spec 久未动/已 completed/任务清空）→ 先 context_search 读摘要，再定复用/新版/新建；
   - ⑥ 用户决定优先：以上都是建议非强制——用户已明确要求（如"帮我新建一个 Spec"）→ 直接照做、尊重用户决定，即使已有相似 Spec 可承载也不劝返。
4. 踩坑→error_record；决策→adr_create；约定→memory_save。
5. 多特性需求 assess_goal 辅助拆分（建议可跳过）。
6. 改前 task_update(in_progress)；完成 task_update(completed)。
7. 不懂调 lrnev_guide；结构异常先 lrnev_doctor。
8. Gate：spec_gate_check(gate=creation/ready/completion)，按 hint 修后 spec_update 推进；lrnev_report 只读体检非必走。

## 快速参考

- Spec：draft→ready→in-progress→completed；completed→in-progress 合法（维护新增）；archived 终态只由用户定。Task：pending→in_progress→completed；completed 终态，返工新建 task。
- Gate：ready 查必填章节与 FILL 哨兵；completion 查任务全 completed + requirements/design 无 FILL 残留；EARS（WHEN…THEN）是推荐写法非硬规则。
- 自救：AMBIGUOUS_REF → 选完整 id 重调；ready/completion 未过 → 按 checks 的 hint 修；INVALID_STATUS_TRANSITION → 按状态机走；broken/缺文件 → lrnev_doctor。
- 收尾：阶段完成 summarize_save 更新 L0/L1 摘要；会话压缩/结束前 session_commit 沉淀候选记忆。
```

#### 模板 A：lrnev + 代码图谱组合版（可选）

适用于中大型 / 多包代码库的开发实现类会话：lrnev 管“该不该做 / 做到哪 / 怎么验收 / 留什么记录”，代码图谱工具管“在哪定义 / 谁调用 / 改动波及谁”。粘贴前把下方 CodeGraph 占位替换为你环境实际暴露的工具面——只读查询类工具，命名随环境各异；未挂同类工具时用模板 B 即可。若挂的是其他架构图谱工具（如 Understand Anything），按“与 CodeGraph 同类：只读、先查后读、结果以源码为准”并入本模板的 CodeGraph 节即可，不必单独成版。

```text
# 工具栈与工作流

双工具分工：**lrnev** 管治理——该不该做/做到哪/怎么验收/留什么记录；**CodeGraph** 管代码——在哪定义/谁调用/改动波及谁。纯查代码走 CodeGraph；要改代码或推进治理才走 lrnev 流程。

## 工具速查表

| 工具 | 职责一句话 |
|---|---|
| lrnev 接手（只读） | project_status 现状快照；governance_map scene→spec 全景；context_search 检索治理文档；spec_get 读三文档 |
| lrnev 落位推进 | spec_create 开 Spec；task_create(_many) 登记任务；task_update 推进；spec_gate_check 门禁；spec_update 状态回填 |
| lrnev 轻产物 | error_record 踩坑；adr_create 决策；memory_save 约定；assess_goal 单多 Spec 判断 |
| CodeGraph 查询工具（主力，名称以你环境为准） | 一次命中符号+来源文件+调用路径（X 在哪/谁调 X/波及谁） |

## lrnev 核心规则

1. **只读 vs 要改**：纯查代码/定位/解释/回答 → 直接做，不 project_status、不开 spec；以下流程只在要改代码或推进治理时走。
2. **要改且不确定进度** → 先 `project_status`；全景 `governance_map`；找相关文档 `context_search`。
3. **开不开 spec、开在哪，自己判断、便宜先**：
   - ① 写不出独立 WHEN…THEN 验收的小改动（改文档/注释/排版/小重构/调参…）→ 直接做；
   - ② **开发/扩展请求（加/实现/补充某能力）一律先登记再实施**：`context_search`/`spec_get` 定位承载 Spec → `task_create` 登记 → 再动手。直接编辑 requirements/design 只许需求细化/文档维护，不能替代登记；Spec 已 completed 时登记会提示：可 `spec_update` 合法回退 in-progress（维护态新增）；
   - ③ 独立可交付新特性才 `spec_create`：能写 WHEN…THEN 验收 + 可独立交付，两“是”才开。优先归已有 scene；新业务域经用户确认才 `scene_create`；无稳定域小特性才落 00-default（兜底）；scene/00 拿不准问用户；
   - ④ 整体推翻需求/设计 → 开新版（version+1，VV 是重写版号非修订号）留旧版对照；archived 是终态，归档/撤销只由用户定——AI 不自动归档，刚建的 Spec 不得自行回退；
   - ⑤ 旧 Spec 上下文冷却（久未动/已 completed/任务已清空）→ 先 `context_search` 读摘要，再决定复用（task_create 落位）、开新版还是新建；
   - ⑥ 用户决定优先：以上都是建议非强制——用户已明确要求（如"帮我新建一个 Spec"）→ 尊重用户决定直接建（以上均可被用户要求覆盖）。
4. **踩坑→`error_record`，决策→`adr_create`，约定→`memory_save`**；不沾的直接做。
5. **多特性需求**先判断单/多 Spec（`assess_goal`：single-spec / multi-spec-program / research-program，建议可跳过）。
6. **改前** task_update(in_progress)，**完成** task_update(completed)。
7. 不清楚工具/流程或 gate 报错 → `lrnev_guide`。
8. **Gate**：`spec_gate_check`(gate=creation/ready/completion)，未过按 checks 的 hint 修，达标再 spec_update 推进。
9. `lrnev_report` 是给人看的只读体检（欠债/收口/validates），想看欠债时调，非必走 gate。
10. 结构/状态异常（broken/缺文件）→ 先 `lrnev_doctor`。

## CodeGraph 使用规则（按你环境实际暴露的工具调整）

- 只读查询、不改文件；查代码用它，治理判断与动作仍走 lrnev。
- **先查后读**：先让图谱查询工具命中符号/文件再 read，别盲扫文件树。
- **图谱查询是主力**：一次覆盖多符号，返回来源+调用路径+影响面。
- 工具命名随环境各异（通常是一组只读查询工具）：粘贴前按实际名单替换占位。
- 索引是本地派生物（不进 git、可重建）：查不到/疑似过期 → 重建或 grep/read 核源码——源码是真相。

## 串联流程

1. 只读请求：CodeGraph 定位 → read → 直接答；要回看验收口径再只读 spec_get/context_search。
2. 要改请求：按规则 2/3 定落点（便宜先）——小改直接做；已有 Spec 增量 → context_search 定位 → **task_create 登记** → 实施（CodeGraph 定位代码、spec_get 对照口径）；新特性 → spec_create → 填 requirements → ready gate → 拆任务（整单 task_create_many、补单 task_create）。
3. 执行收尾：任务前后 task_update；全完成 → completion gate → spec_update 回填 completed → 回看 L0 与验收；轻产物按规则 4；不懂 lrnev_guide、异常 lrnev_doctor。
```

### 好 Prompt

```text
这个项目用 lrnev 治理。请先用 project_status 接手当前状态；如果没有相关 Spec，再用 spec_create 新建。每开始一个 task 前先回看对应 requirements/design，完成后更新 tasks.md 状态并跑测试。
```

```text
请把“新增导出配置功能”做成 lrnev spec。按 scene -> spec -> 可选 ADR -> task 的流程走；ready gate 通过前不要写代码，completion gate 通过后再回看验收标准。
```

### 坏 Prompt

```text
直接帮我把功能写了。
```

问题：没有要求 AI 先接手 `.lrnev/` 状态，弱模型容易跳过 Spec、Task 和 gate。

```text
随便建几个文档记录一下。
```

问题：没有明确用 lrnev 工具创建 Scene/Spec/Task，容易手写错元数据或绕开状态机。

### 冷启动建议

第一次接入一个模型时，把项目根和治理要求说清楚：

```text
项目根是 <你的项目根目录>。这个项目用 lrnev 管理，请优先调用 lrnev_guide 了解流程，再调用 project_status 接手当前状态。
```

模型已经熟悉 lrnev 后，可以简化为：

```text
继续当前 lrnev task；开始前回看对应 requirements/design，完成后跑测试并更新 task 状态。
```

## 适配设计原则

- 协议即适配层：把关键引导写入 server instructions、tool description、tool result 的 `ai_followup` 和错误 hint，避免依赖 Claude Code、Cursor 等私有能力。
- 按弱模型写：description 要告诉模型何时用、前置是什么、最小例子是什么；强模型会自动压缩，弱模型需要明确路径。
- 文件即真相：`.lrnev/` 下的 Scene、Spec、ADR、Errorbook、Memory 是可 git diff 的事实，不维护隐藏数据库。
- 流程是 `Scene -> Spec -> 可选 ADR -> Task`：ADR 只在有关键决策时出现，不是每个 Spec 的必经步骤。
- 确定性归 lrnev，判断归 AI：gate 只查结构契约，不判断需求质量、实现质量或是否真的解决问题；这些通过 followup 提醒 AI 自查。
- 轻量优先：踩坑写 Errorbook，小决策写 ADR，一句约定写 Memory；只有需要追踪、拆任务和验收闭环的特性才开 Spec。

## 适配验收框架

### 标准 Prompt

用于每个模型的同一条冷启动 prompt：

```text
这个项目用 lrnev 治理。请把“<待实现目标>”做成一个 spec，按 lrnev 的流程一步步来；如果不确定下一步，先查 lrnev 的工具说明或 guide。
```

`<待实现目标>` 应选择一个可独立交付的小功能，避免把模型能力测试混成复杂工程任务测试。

### 通过判定

模型在没有人工纠正工具顺序的前提下，能走通以下链路，才算一次完整通过：

1. 首次或空工作区时调用 `lrnev_init`。
2. 调用 `spec_create` 创建 Spec。
3. 填写 `requirements.md`，清除 `<!-- FILL: ... -->` 哨兵。
4. 调用 `spec_gate_check` 的 `ready` gate，并能按失败 hint 修正文档。
5. 基于 design 拆任务：完整清单用 `task_create_many` 一次原子创建，临时补单个用 `task_create`。
6. 执行任务前后使用 `task_update` 推进状态。
7. 所有任务完成后调用 `spec_gate_check` 的 `completion` gate。
8. 根据 completion followup 回看 L0 摘要与验收标准，确认问题真闭环。

### 步骤评分

每次实测按 8 个步骤记录：

- `1`：模型自主完成，无需人工纠正。
- `0.5`：模型卡住但能根据工具错误、description 或 `lrnev_guide` 自救。
- `0`：需要人工解释 lrnev 流程或纠正工具调用顺序。

强模型验收目标是 8/8。中等模型验收目标是至少 6.5/8，并记录剩余卡点。小模型不设硬通过线，但必须记录卡点归因，便于后续改 description、followup 或错误 hint。

### 实测 Checklist

| 步骤 | 观察点 | 失败归因 |
|------|--------|----------|
| 冷启动 | 是否先理解 lrnev 是项目治理工具，而不是代码生成器 | instructions 不清 / prompt 不清 |
| 初始化 | 是否在需要时调用 `lrnev_init` | 工具入口不清 |
| 建 Spec | 是否调用 `spec_create`，并知道默认 Scene | description 不清 |
| ready 前 | 是否主动填写 requirements 并清理 FILL | gate 语义不清 |
| ready 失败 | 是否按 checks 的 message/hint 修文档 | 错误 hint 不清 |
| 拆任务 | 是否在 ready 后调用 `task_create` | followup 不清 |
| 推进任务 | 是否用 `task_update` 维护状态机 | 状态机 hint 不清 |
| completion | 是否跑 completion gate 并回看验收标准 | 收尾 followup 不清 |

### 实测矩阵

真实模型实测由维护者在对应客户端环境执行，结果持续回填。未实测前不要把占位行写成通过。

| 模型 | 档位 | 客户端 | 分数 | 走通情况 | 卡点 | 后续改进项 |
|------|------|--------|------|----------|------|------------|
| Claude Opus 4.7 | 强 | Claude Code (CLI) | — | ✅ 全面通过（开发全程使用 CLI 创建/更新/gate/claim） | 无 | — |
| GPT-5 coding agent | 强 | Codex CLI 0.136.0 | 8/8 | ✅ 42 个 MCP 工具全调通，全生命周期自主走完 | 无（自主修复 ready gate 章节标题） | — |
| DeepSeek V4 Flash Free | 中 | OpenCode 1.15.13 | 8/8 | ✅ 黄金路径 + 能力域全覆盖，真实 Java 项目探测验证通过 | 首次未设 LRNEV_WORKSPACE 时向上误命中父级 .lrnev，设环境变量后通过 | 向上命中护栏（v1.0.0 已修复：init 时命中祖先 .lrnev 会提示设 LRNEV_WORKSPACE） |
| GPT-5.5 | 强 | Codex CLI 0.142.5（v2.3 盲测） | 8/8 | ✅ 只靠自带引导走通全流程；自主选用 task_create_many，原子拒绝/压缩返回验证通过 | 英文化章节标题被 ready gate 拦（事后 hint 清晰）；assess_goal 保守判 multi-spec | 均已在 v2.3 整改（spec_create 标题警示、assess_goal override 指引） |
| DeepSeek V4 Pro | 中 | OpenCode 1.17.13（v2.3 盲测） | 8/8 | ✅ 全流程通过；自主发现并选用 task_create_many | init 后引导可更明确"这是接入完成标志"；task_create 连用无批量提示 | 后者已在 v2.3 整改（task_create 描述提示批量工具） |
| Claude Sonnet 4.6 | 强 | Claude Code（v2.3 盲测） | 7.5/8 | ✅ 主干走通；anchor_context 回填被评"实现前确认验收口径非常有价值" | design.md 填写时机靠 completion gate 才发现；report headline 被误读为"全部完成" | 均已在 v2.3 整改（ready-passed 补 design 提示、headline 改治理债口径） |
| 本地 Qwen 7B 级模型 | 小 | 待填 | 待测 | 待测 | 待测 | 待测 |

> v2.3 盲测口径：干净真实项目 + 全新会话，只允许依赖工具描述 / ai_followup / lrnev_guide 行动，禁止读 lrnev 源码与文档；完整报告见 `dev-docs/E2E-REPORT-*-V23-2026-07-06.md`。
