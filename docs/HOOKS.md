# Hooks 系统说明

Hooks 是 lrnev 的本地自动化扩展点。你可以在项目根目录的 `.lrnev/config/hooks.json` 里配置命令，让 lrnev 在 Spec、Task、ADR、Errorbook 和 Gate 事件发生后自动执行脚本。

适合做的事：

- Task 完成后跑 `git status`、提交检查或内部脚本。
- Completion gate 通过后发通知。
- 记录错误时同步到内部错误平台。
- 在不改 lrnev core 的情况下挂接团队自己的自动化。

不适合做的事：

- 复杂工作流编排。
- 跨机器分发。
- 在 lrnev core 里直接调用 LLM 或外部 HTTP 服务；需要 HTTP 时用 hook 命令自己调 `curl` 或脚本。

## 配置文件

配置路径固定为：

```text
.lrnev/config/hooks.json
```

顶层必须是数组。`lrnev init`（v2.1 起）会 scaffold 一个空数组 `[]`，直接编辑它加 hook 即可；该文件被删或为空数组时不会触发任何 hook，行为和旧版本一致。

最小配置：

```json
[
  {
    "name": "task-completed-check",
    "event": "task.update.completed",
    "command": ["git", "status", "--short"]
  }
]
```

完整示例见 [docs/examples/hooks.json](./examples/hooks.json)。

## 字段说明

| 字段 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `name` | 是 | 无 | kebab-case 名称，必须唯一，例如 `task-completed-check` |
| `event` | 是 | 无 | 事件名，支持 `task.update.*` 这种前缀通配 |
| `command` | 是 | 无 | 命令数组或字符串；推荐数组 |
| `timeout_ms` | 否 | `30000` | 超时时间，最大 `600000` |
| `mode` | 否 | `async` | `sync` 阻塞主流程，`async` 立刻返回 |
| `enabled` | 否 | `true` | 是否启用 |
| `env` | 否 | `{}` | 合并进子进程环境变量 |
| `cwd` | 否 | 工作区根目录 | 子进程工作目录；不能包含 `..` 跳出工作区 |
| `on_failure` | 否 | `warn` | `abort` / `warn` / `silent` |

## 事件列表

当前内置事件：

```text
spec.create
spec.gate_passed.ready
spec.gate_passed.completion
task.create
task.update.in_progress
task.update.completed
task.update.failed
task.update.blocked
adr.create
error.record
```

通配只支持后缀 `*` 的前缀匹配。例如：

```json
{
  "name": "all-task-updates",
  "event": "task.update.*",
  "command": ["node", "scripts/task-event.js"]
}
```

这会匹配 `task.update.in_progress`、`task.update.completed`、`task.update.failed`、`task.update.blocked`。

## 同步与异步

`mode: "async"` 是默认模式。lrnev 会启动子进程后立刻返回，子进程结束后把结果写入 `.lrnev/state/hook-log.jsonl`。这种模式适合通知、日志同步、非阻塞脚本。

`mode: "sync"` 会等待 hook 执行结束。它适合必须在主流程继续前完成的检查，例如完成 Task 前跑内部校验。

失败策略：

- `on_failure: "abort"`：同步 hook 失败或超时时抛错，主流程失败。
- `on_failure: "warn"`：主流程继续，响应的 `warnings` 和 `ai_followup.instructions` 会包含 hook 警告。
- `on_failure: "silent"`：主流程继续，只写 hook log。

异步 hook 不阻塞主流程，失败只写日志。

## 环境变量

lrnev 会把当前进程环境变量、配置里的 `env` 合并后传给子进程，并额外注入：

| 变量 | 含义 |
|------|------|
| `LRNEV_EVENT` | 当前事件名 |
| `LRNEV_HOOK_NAME` | 当前 hook 名称 |
| `LRNEV_PAYLOAD` | JSON 字符串形式的事件上下文 |
| `LRNEV_WORKSPACE_ROOT` | 工作区根目录绝对路径 |

示例：

```js
const payload = JSON.parse(process.env.LRNEV_PAYLOAD || "{}");
console.log(process.env.LRNEV_EVENT, payload.task_id);
```

## 命令安全与跨平台

优先使用数组命令：

```json
{
  "name": "safe-command",
  "event": "task.create",
  "command": ["node", "scripts/on-task-create.js"]
}
```

数组命令不走 shell，跨平台更稳定，也不会把参数拼接交给 shell 解释。

字符串命令会走平台 shell：

- Windows：`cmd.exe /c`
- macOS / Linux：`/bin/sh -c`

字符串命令适合少量兼容旧脚本的场景，但存在 shell 注入和平台差异风险。`lrnev doctor` 会对字符串命令报告 `HOOK_SHELL_FORM` info，提醒你优先改成数组形式。

`cwd` 只能在工作区内：

```json
{
  "name": "run-in-tools",
  "event": "task.create",
  "command": ["node", "index.js"],
  "cwd": "tools"
}
```

如果 `cwd` 包含 `..` 或解析后跳出工作区，该 hook 配置会被判为无效。

## 日志

每次执行会写一行 JSON 到：

```text
.lrnev/state/hook-log.jsonl
```

主要字段：

- `ts`
- `event`
- `hook`
- `mode`
- `status`：`success` / `failed` / `timeout`
- `duration_ms`
- `exit_code`
- `stdout_tail`
- `stderr_tail`

文件达到 10MB 前会自动 rotate，并压缩成 `hook-log.YYYYMMDD.jsonl.gz`。

读取最近日志：

```bash
lrnev hook tail-log -n 20
```

## CLI 用法

```bash
lrnev hook list
lrnev hook trigger task.update.completed --payload "{\"task_id\":\"T-001\"}"
lrnev hook disable task-completed-check
lrnev hook enable task-completed-check
lrnev hook tail-log -n 20
```

`hook trigger` 用来手动测试配置；它不会自动改变 Task 或 Spec 状态，只是按传入事件名触发匹配 hook。

## MCP 工具

MCP 侧工具和 CLI 对等：

- `lrnev_hook_list`
- `lrnev_hook_trigger`
- `lrnev_hook_enable`
- `lrnev_hook_disable`
- `lrnev_hook_tail_log`

`lrnev_hook_trigger` 参数示例：

```json
{
  "event": "task.update.completed",
  "payload": {
    "scene": "00-default",
    "spec": "02-00-hooks-system",
    "task_id": "T-002"
  }
}
```

## Doctor 检查

`lrnev doctor` 会额外检查 hooks：

| code | 级别 | 触发条件 |
|------|------|----------|
| `HOOK_CONFIG_INVALID` | warning | `hooks.json` 不是数组、字段不合法、重复 name、`cwd` 越界等 |
| `HOOK_SHELL_FORM` | info | `command` 是字符串命令 |
| `HOOK_CHRONIC_TIMEOUT` | warning | 同一个 hook 连续 3 次 timeout |
| `HOOK_CHRONIC_FAILURE` | error | 同一个 hook 连续 5 次非 success |

连续失败时建议先禁用：

```bash
lrnev hook disable <hook-name>
```

修复脚本后再启用。

## NFR 对照

- **NFR-1 性能**：未命中事件会尽早返回；命中 hook 时，协调成本不包含子进程运行时间。
- **NFR-2 无新运行时依赖**：执行和 rotate 只使用 Node 内置 `child_process` / `zlib`。
- **NFR-3 跨平台**：数组命令不走 shell；字符串命令按 Windows 与 Unix shell 分流。
- **NFR-4 可观察**：执行结果写入 hook log，长期失败由 doctor 报告。
- **NFR-5 向后兼容**：没有 `.lrnev/config/hooks.json` 时，行为等同旧版本。
