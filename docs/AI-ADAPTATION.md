# AI 通用适配指南

本文档说明 lrnev 如何通过 MCP 协议的通用文本字段适配不同 AI 客户端，并给出多模型实测框架。核心原则是：lrnev 只提供确定性的文件事实、工具说明、错误提示和下一步建议；语义判断由接入的 AI 完成。

## 接入方式

### 前置条件

- Node.js 20 或更高版本。
- 项目里已经能运行 `lrnev-mcp`；源码开发时可先在 `product/lrnev-govern/` 执行 `npm install`、`npm run build`。
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
      "args": ["E:/project/.lrnev/lrnev-cli/product/lrnev-govern/bin/lrnev-mcp.mjs"]
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
      "args": ["E:/project/.lrnev/lrnev-cli/product/lrnev-govern/bin/lrnev-mcp.mjs"]
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
node E:/project/.lrnev/lrnev-cli/product/lrnev-govern/bin/lrnev-mcp.mjs
```

如果客户端支持给 server 传工作目录，设为你的项目根。若客户端不能传工作目录，AI 调工具时应优先使用 `--workspace` 对应的项目路径，或在对话里明确项目根目录。

### CLI 兜底

不接 MCP 也可以用 CLI 验证同一套 core 行为：

```bash
lrnev guide
lrnev guide workflow
lrnev status
lrnev spec create user-login --priority P0
```

CLI 与 MCP 共用 core 逻辑；差异只在入口层。

## 如何对 AI 开口

### 常驻提示词模板（防长对话遗忘）

把下面这段贴进客户端的常驻提示槽，避免多轮压缩后 AI 忘记用 lrnev：

- Claude Code：项目根 `CLAUDE.md`
- Cursor：`.cursor/rules` 或 Settings → Rules
- Codex：自定义 instructions

```text
本项目用 lrnev 治理。规则：
1. 不确定当前状态时，先调 project_status，不要凭记忆直接改代码。
2. 新建可交付特性走 spec_create；踩坑→error_record，小决策→adr_create，约定→memory_save。
3. 新建多特性需求时，先按拆分标尺判断单/多 Spec（可用 assess_goal 辅助），别把多个特性塞进一个 Spec。
4. 改代码前确认对应 task 已 task_update(in_progress)，完成后 task_update(completed)。
5. 不清楚怎么用就调 lrnev_guide。
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
项目根是 E:/project/.lrnev/lrnev-cli。这个项目用 lrnev 管理，请优先调用 lrnev_guide 了解流程，再调用 project_status 接手当前状态。
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
5. 基于 design 拆出 `task_create`。
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
| Claude 级强模型 | 强 | 待填 | 待测 | 待测 | 待测 | 待测 |
| GPT-4o-mini 级模型 | 中 | 待填 | 待测 | 待测 | 待测 | 待测 |
| 本地 Qwen 7B 级模型 | 小 | 待填 | 待测 | 待测 | 待测 | 待测 |
