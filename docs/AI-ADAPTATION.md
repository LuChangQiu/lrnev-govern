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

## 如何对 AI 开口

### 常驻提示词模板（防长对话遗忘）

把下面这段贴进客户端的常驻提示槽，避免多轮压缩后 AI 忘记用 lrnev：

- Claude Code：项目根 `CLAUDE.md`
- Cursor：`.cursor/rules` 或 Settings → Rules
- Codex：自定义 instructions

```text
本项目用 lrnev 治理。规则：

  1. **先分清"只读"还是"要改"**：纯查代码、定位、解释、回答问题这类不改任何文件的事，直接做——不用先
  project_status，也不用开 spec。下面的流程只在"要动手改代码或推进治理(建/改 spec、task)"时才走。

  2. **要改且不确定进度时**，先调 `project_status` 接手现状，别凭记忆直接改代码。也可调 `governance_map` 看 scene→spec
  全景压缩视图，快速定位上下文。

  3. **该不该开 spec、开在哪**，自己判断、别对着清单匹配。按从便宜到贵判断：
     - ① 写不出独立"WHEN…THEN"验收的小改动（改文档/排版/注释/小重构/调参数/答问题）→ 直接做，不开 spec/task
     - ② 给已完成特性加东西、能落到某现有 spec → 先 `context_search` 找到它，`task_create` 落位（通常无需新开 spec，scene
  沿用；completed spec 可 `spec_update` 回退到 in-progress）
     - ③ 真正独立可交付的新特性才开
  spec——(a)能写出一条有意义的"WHEN…THEN"验收吗？(b)是可独立交付的特性吗？两个都"是"才开 spec。优先归入已有匹配业务域
  scene；只有用户明确确认、或上下文非常清楚这是会承载多个 spec 的新业务域，才 `scene_create`
     - ④ 确实无稳定业务域、又是零散小型独立特性，才落 00-default（兜底，不是默认堆放处）
     - scene / 00-default 是结构决策、事后难迁：该新建 scene 还是落 00-default 拿不准时就问我，别默认。
     
     **三条判断标尺**（补充复用/新建/开新版的分流逻辑）：
     - **整体推翻**：若新需求整体推翻已有 requirements 或 design（而非增量补充），通常建议开新版（version+1），保留旧版供对照。
     - **独立特性**：若新特性独立且可验收（有明确的 WHEN...THEN 验收标准），通常建议开新 Spec，而非强行扩展已有 Spec 的范围。
     - **上下文冷却**：若旧 Spec 出现上下文冷却信号（长时间未动、已 completed、tasks 已清空），建议先调用 `context_search` 读取摘要，确认旧 Spec 实际范围，再决定复用、开新版还是创建独立 Spec。
     
     **用户决定优先**：以上建议不是强制规则。若用户已明确要求（如"帮我新建一个 Spec"、"开一个独立的 Spec"），即使已有相似 Spec 可以承载，也应尊重用户决定，直接调用对应工具（如 `spec_create`）。

  4. **踩坑→`error_record`，技术决策→`adr_create`，约定→`memory_save`**；都不沾的小事直接做。

  5. **多特性需求**先按拆分标尺判断单/多 Spec（可用 `assess_goal` 辅助，它返回 single-spec / multi-spec-program /
  research-program），别把多个特性塞进一个 Spec。

  6. **改代码前**确认对应 task 已 `task_update(in_progress)`，完成后 `task_update(completed)`；纯只读/答问题不涉及
  task。

  7. **不清楚怎么用**就调 `lrnev_guide`。

  8. **Gate 门禁**：spec 创建/就绪/完成各有对应门禁（creation / ready / completion），用 `spec_gate_check` 传 `gate`
  参数验证是否达标。

  9. 想看治理欠债、收口缺口或 validates 覆盖率，可让我调 `lrnev_report`；它是给人看的只读体检，不是必走 gate。

  10. **工作区结构异常**：遇到目录缺失、命名不规范等问题，可先调 `lrnev_doctor` 做健康诊断。
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
| GPT-5 coding agent | 强 | Codex CLI 0.136.0 | 8/8 | ✅ 41 个 MCP 工具全调通，全生命周期自主走完 | 无（自主修复 ready gate 章节标题） | — |
| DeepSeek V4 Flash Free | 中 | OpenCode 1.15.13 | 8/8 | ✅ 黄金路径 + 能力域全覆盖，真实 Java 项目探测验证通过 | 首次未设 LRNEV_WORKSPACE 时向上误命中父级 .lrnev，设环境变量后通过 | 向上命中护栏（v1.0.0 已修复：init 时命中祖先 .lrnev 会提示设 LRNEV_WORKSPACE） |
| GPT-5.5 | 强 | Codex CLI 0.142.5（v2.3 盲测） | 8/8 | ✅ 只靠自带引导走通全流程；自主选用 task_create_many，原子拒绝/压缩返回验证通过 | 英文化章节标题被 ready gate 拦（事后 hint 清晰）；assess_goal 保守判 multi-spec | 均已在 v2.3 整改（spec_create 标题警示、assess_goal override 指引） |
| DeepSeek V4 Pro | 中 | OpenCode 1.17.13（v2.3 盲测） | 8/8 | ✅ 全流程通过；自主发现并选用 task_create_many | init 后引导可更明确"这是接入完成标志"；task_create 连用无批量提示 | 后者已在 v2.3 整改（task_create 描述提示批量工具） |
| Claude Sonnet 4.6 | 强 | Claude Code（v2.3 盲测） | 7.5/8 | ✅ 主干走通；anchor_context 回填被评"实现前确认验收口径非常有价值" | design.md 填写时机靠 completion gate 才发现；report headline 被误读为"全部完成" | 均已在 v2.3 整改（ready-passed 补 design 提示、headline 改治理债口径） |
| 本地 Qwen 7B 级模型 | 小 | 待填 | 待测 | 待测 | 待测 | 待测 |

> v2.3 盲测口径：干净真实项目 + 全新会话，只允许依赖工具描述 / ai_followup / lrnev_guide 行动，禁止读 lrnev 源码与文档；完整报告见 `dev-docs/E2E-REPORT-*-V23-2026-07-06.md`。
