# OpenCode + lrnev MCP 真实客户端实测报告

测试时间：2026-06-04 12:27 Asia/Shanghai  
测试人：Codex  
测试对象：`product/lrnev-govern` 本地构建的 `lrnev-mcp`  
真实客户端：OpenCode `1.15.13`  
测试项目：`E:\project\xpaas\xpaas-skill\.test-code\xpaas-boot-xmszh2`

## 结论

本轮使用真实 OpenCode 客户端完成了 lrnev MCP 接入、初始化、Scene/Spec/Task 黄金路径、ADR/Memory/Error/Agent/Hooks/Doctor 能力域测试。

总体结果：通过，带 2 个注意项。

- OpenCode 能连接本地 `lrnev-mcp`：通过。
- OpenCode 能真实调用 lrnev MCP 工具：通过。
- 目标项目 `.lrnev/` 能由 `lrnev_init` 创建：通过。
- 黄金路径 Scene -> Spec -> Gate -> Task -> Completion -> Doctor：通过。
- ready gate 未填需求时返回可读 checks/hint：通过。
- pending -> completed 非法状态跳转返回 `INVALID_STATUS_TRANSITION`：通过。
- `lrnev_hook_tail_log` 存在且可调用：通过。
- `adr_suggest`、`lock_acquire`、`lock_release`、`lock_list` 未在源码注册工具中出现：通过。
- 源码注册工具数为 38：通过。
- OpenCode CLI 不能直接显示本地 MCP server 的 `listTools` 明细，只能显示 server connected；工具明细通过源码计数和真实 tool_use 事件验证：注意项。
- 如果 MCP server 未显式指定目标 workspace，`resolveWorkspaceRoot()` 会向上命中 `E:\project\.lrnev`；已通过项目级 `opencode.json` 的 `LRNEV_WORKSPACE` 和 `lrnev_init.root` 修正：注意项。

## 测试配置

目标项目新增/使用项目级 OpenCode 配置：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "lrnev": {
      "type": "local",
      "command": [
        "node",
        "E:/project/.lrnev/lrnev-cli/product/lrnev-govern/bin/lrnev-mcp.mjs"
      ],
      "enabled": true,
      "environment": {
        "LRNEV_WORKSPACE": "E:/project/xpaas/xpaas-skill/.test-code/xpaas-boot-xmszh2"
      },
      "timeout": 60000
    }
  }
}
```

监控命令：

```powershell
opencode --pure mcp list
opencode --pure run --dir E:\project\xpaas\xpaas-skill\.test-code\xpaas-boot-xmszh2 --agent build --model opencode/deepseek-v4-flash-free --format json --dangerously-skip-permissions "<prompt>"
opencode export <session-id>
```

OpenCode MCP 连接结果：

```text
✓ lrnev connected
node E:/project/.lrnev/lrnev-cli/product/lrnev-govern/bin/lrnev-mcp.mjs
```

## 模型矩阵

| 模型 | 用途 | 结果 |
| --- | --- | --- |
| `xmcbox/claude-sonnet-4-6` | 首次真实 OpenCode run | 失败，provider 返回 402 `Payment Required`，配额耗尽 |
| `opencode/deepseek-v4-flash-free` | 初始化、黄金路径、能力域覆盖 | 通过 |

## 会话证据

| 会话 | 模型 | 用途 | 结果 |
| --- | --- | --- | --- |
| `ses_16f3f3cdaffet3wnymidgL98Db` | `xmcbox/claude-sonnet-4-6` | 首次 OpenCode run | 失败：402 配额耗尽 |
| `ses_16f39d30fffetWe9wjziTtAGC4` | `opencode/deepseek-v4-flash-free` | 免费模型首跑 | 部分失败：未显式 root，误命中 `E:\project\.lrnev` |
| `ses_16f3753ddffec4tEMvki2Qt1Zr` | `opencode/deepseek-v4-flash-free` | 显式 root 初始化与 doctor | 通过 |
| `ses_16f3468cdffeOZaPNIfGrN8wrG` | `opencode/deepseek-v4-flash-free` | 黄金路径 A | 通过 |
| `ses_16f33330cffeuu4f54ccFCoABw` | `opencode/deepseek-v4-flash-free` | 辅助能力域 B | 通过 |

可用 `opencode export <session-id>` 复核每个会话的 JSON 事件流。关键证据来自 `tool_use` 事件，不是手动 CLI 代替。

## 初始化实测

成功会话：`ses_16f3753ddffec4tEMvki2Qt1Zr`

OpenCode 实际调用：

- `lrnev_lrnev_guide`
- `lrnev_project_status`
- `lrnev_lrnev_init`
- `lrnev_project_status`
- `lrnev_lrnev_doctor`

关键返回：

```text
lrnev_init data.root = E:/project/xpaas/xpaas-skill/.test-code/xpaas-boot-xmszh2
was_new = true
files_created includes .lrnev/PROJECT.md, .lrnev/ARCHITECTURE.md, steering docs, 00-default/scene.md
doctor summary = errors: 0, warnings: 0, info: 0
```

文件系统交叉验证：

```text
E:\project\xpaas\xpaas-skill\.test-code\xpaas-boot-xmszh2\.lrnev exists
```

CLI 交叉验证：

```json
{
  "ok": true,
  "summary": {
    "errors": 0,
    "warnings": 0,
    "info": 0
  },
  "issues": []
}
```

## 黄金路径实测 A

成功会话：`ses_16f3468cdffeOZaPNIfGrN8wrG`

实际工具调用序列：

1. `lrnev_lrnev_guide(topic=tools)`
2. `lrnev_project_status`
3. `lrnev_scene_create`
4. `lrnev_scene_list`
5. `lrnev_spec_create`
6. `lrnev_spec_list`
7. `lrnev_spec_gate_check(gate=creation)`
8. `lrnev_spec_gate_check(gate=ready)`
9. `lrnev_task_create`
10. `lrnev_task_update(status=completed)`，预期非法跳转
11. `lrnev_task_update(status=in_progress, agent_id=opencode-realtest-agent, touches_files=.lrnev/scenes)`
12. `lrnev_task_update(status=completed, agent_id=opencode-realtest-agent)`
13. `lrnev_task_list(view=readable)`
14. `lrnev_spec_gate_check(gate=completion)`
15. `lrnev_lrnev_doctor`

生成对象：

| 对象 | ID |
| --- | --- |
| Scene | `01-opencode-realtest` |
| Spec | `01-00-opencode-login-flow` |
| Task | `T-001` |

关键结果：

- `creation` gate：`passed=true`
- `ready` gate：`passed=false`
- `ready` gate 失败项包含：
  - `requirements_no_fill_sentinels`
  - `requirements_acceptance_checked`
- `ready` gate 返回 hint：
  - 替换 `<!-- FILL: ... -->`
  - 勾选验收清单
- 非法状态跳转 `pending -> completed` 被拒绝：
  - error code：`INVALID_STATUS_TRANSITION`
  - hint：`pending` 只允许到 `in_progress`、`blocked`
- 正常状态流转 `pending -> in_progress -> completed` 通过。
- `completion` gate：`passed=true`
- `lrnev_doctor`：`errors=0, warnings=0, info=0`

## 辅助能力域实测 B

成功会话：`ses_16f33330cffeuu4f54ccFCoABw`

实际工具调用覆盖：

- ADR：`lrnev_adr_create`、`lrnev_adr_list`、`lrnev_adr_get`
- Memory：`lrnev_memory_save`、`lrnev_memory_search`
- Errorbook：`lrnev_error_record`、`lrnev_error_search`
- Agent：`lrnev_agent_register`、`lrnev_agent_heartbeat`、`lrnev_agent_list`、`lrnev_agent_unregister`
- Hooks：`lrnev_lrnev_hook_list`、`lrnev_lrnev_hook_tail_log`
- Doctor：`lrnev_lrnev_doctor`

关键结果：

| 能力域 | 结果 |
| --- | --- |
| ADR | 创建 `0001-opencode-mcp-real-test-decision.md`，list/get 均可读取 |
| Memory | 保存 `facts-473e04cde34b`，按 `LRNEV_WORKSPACE xpaas-boot-xmszh2` 可检索 |
| Errorbook | 记录 `ec315280290a`，按 `parent workspace` 可检索 |
| Agent | `opencode-agent-A` 注册、heartbeat、list、unregister 全链路通过 |
| Hooks | hook list 返回空配置但接口正常；hook tail log 返回空数组但接口正常 |
| Doctor | `errors=0, warnings=0, info=0` |

## 协议接入与工具发现

OpenCode 真实连接：

```text
opencode --pure mcp list
✓ lrnev connected
```

源码注册工具数：

```powershell
rg -c "server\.registerTool" product\lrnev-govern\src\mcp\tools\index.ts
38
```

新增工具存在性：

- `lrnev_lrnev_hook_tail_log` 在 OpenCode 会话 B 中真实调用成功。

已删除工具检查：

- 源码注册列表中未发现 `adr_suggest`。
- 源码注册列表中未发现 `lock_acquire`、`lock_release`、`lock_list`。

限制说明：

- `opencode mcp debug lrnev` 对本地 server 只返回 `MCP server lrnev is not a remote server`，不能显示 local MCP 的 `listTools` 明细。
- 因此“OpenCode CLI 展示 38 个工具名”无法由 OpenCode 命令直接截图式验证；本轮采用 `opencode --pure mcp list` 证明 server connected、OpenCode `tool_use` 事件证明工具可调用、源码注册计数证明 38 个工具。

## 真实项目与路径问题

本轮发现并验证了一个重要接入风险：

未显式传 `root` 且未设置 MCP server 环境变量时，`lrnev_init` 在会话 `ses_16f39d30fffetWe9wjziTtAGC4` 返回：

```text
root = E:\project
was_new = false
```

原因：`resolveWorkspaceRoot()` 会向上查找已初始化的 `.lrnev/PROJECT.md`，命中了 `E:\project\.lrnev`。

修正方式：

1. 项目级 `opencode.json` 为 `lrnev` MCP server 设置：

```json
"environment": {
  "LRNEV_WORKSPACE": "E:/project/xpaas/xpaas-skill/.test-code/xpaas-boot-xmszh2"
}
```

2. 对 `lrnev_init` 显式传：

```json
{
  "root": "E:/project/xpaas/xpaas-skill/.test-code/xpaas-boot-xmszh2",
  "project_name": "xpaas-boot-xmszh2"
}
```

修正后 `lrnev_init` 返回目标项目 root，且目标项目 `.lrnev/` 真实创建。

## 最终状态快照

`lrnev --workspace E:\project\xpaas\xpaas-skill\.test-code\xpaas-boot-xmszh2 status`：

- scenes：`01-opencode-realtest`
- specs：`01-00-opencode-login-flow`
- task counts：`completed=1`
- active_agents：空
- active_tasks：空
- recent_adrs：`0001 OpenCode MCP real test decision`
- open_errors：`ec315280290a`

`lrnev --workspace ... doctor`：

```json
{
  "ok": true,
  "summary": {
    "errors": 0,
    "warnings": 0,
    "info": 0
  },
  "issues": []
}
```

## 清单覆盖情况

| 清单项 | 状态 | 证据 |
| --- | --- | --- |
| MCP 握手/连接 | 通过 | `opencode --pure mcp list` 显示 `lrnev connected` |
| 工具发现 38 个 | 部分通过 | 源码注册计数 38；OpenCode CLI 不显示 local listTools 明细 |
| `adr_suggest` 已删 | 通过 | 源码注册列表未出现；OpenCode 可用工具中未调用/不可见 |
| `lrnev_hook_tail_log` 存在 | 通过 | 会话 B 真实调用成功 |
| 工具 description 含“何时用” | 未逐项用 OpenCode 验证 | `lrnev_guide(topic=tools)` 可返回工具速查；OpenCode 不显示工具 schema |
| 长会话多次调用稳定 | 通过 | 会话 A 15 步、会话 B 14 步均完成 |
| context resource list/read | 未测 | OpenCode run 未暴露 resource 操作入口 |
| 黄金路径 | 通过 | 会话 A |
| ready gate 失败 hint | 通过 | 会话 A |
| 非法状态跳转 | 通过 | 会话 A |
| completion gate | 通过 | 会话 A |
| ADR | 通过 | 会话 B |
| Errorbook | 通过 | 会话 B |
| Memory | 通过 | 会话 B |
| Agent | 通过 | 会话 B |
| Hooks | 通过 | 会话 B |
| Doctor | 通过 | 多次 OpenCode + CLI |
| 真实项目 init | 通过 | 会话 `ses_16f3753ddffec4tEMvki2Qt1Zr` |
| CLI vs MCP 一致性 | 通过 | MCP doctor 与 CLI doctor 均 0 error |

## 后续建议

1. 为 OpenCode/Cursor/Claude 等 MCP 接入文档明确写入 `LRNEV_WORKSPACE` 或 `root` 参数建议，避免上级 workspace 误命中。
2. 如果必须把“listTools 返回 38 个工具”作为发布门禁，建议增加一个小型 MCP smoke test 脚本，直接执行 initialize + tools/list，并把输出作为测试报告附件。
3. OpenCode 本地 MCP debug 不显示 tools/schema，报告中不应写成 OpenCode CLI 已直接展示 38 个工具名。
4. 当前测试数据留在目标项目 `.lrnev/` 中：`01-opencode-realtest`、`01-00-opencode-login-flow`、ADR 0001、memory facts、error incident。需要干净复测时删除目标项目 `.lrnev/` 后重新跑初始化会话。
