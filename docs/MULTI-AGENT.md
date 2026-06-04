# 多 Agent 协作说明

多 Agent 协作用于一人多窗口、同一个 AI 多会话、或不同 AI 客户端同时处理同一项目的场景。lrnev 是 MCP 项目治理服务，不启动 AI、不调度任务、不编排执行；它只记录“哪个客户端声明正在做哪个 Task”，让后来者能看见现场并避免重复踩同一块工作。

## 核心模型

lrnev 把多窗口协作拆成三层：

| 层级 | 文件 | 含义 |
|------|------|------|
| Task 状态真相 | `.lrnev/scenes/*/specs/*/tasks.md` | Task 的 `pending/in_progress/blocked/completed/failed` 状态，只能由 task 工具更新 |
| Agent 心跳 | `.lrnev/agents/registry.json` | 当前有哪些客户端会话、最后一次心跳是什么时候 |
| Task claim | `.lrnev/runtime/claims/*.json` | 运行态软占用：谁声明正在做哪个 Task |

claim 是运行态，不是第二份任务状态索引。删掉 `.lrnev/runtime/claims/` 不会改变 `tasks.md`，只会丢失“谁正在做”的现场提示。

## Agent 注册表

每个 Agent 记录包含：

| 字段 | 含义 |
|------|------|
| `agent_id` | Agent 唯一标识；可以由客户端传入，也可以由 lrnev 自动生成 |
| `pid` | 当前进程 ID，用于排查 |
| `host` | 当前主机名，用于人类辨识 |
| `client` | 客户端名称，例如 `codex`、`claude-code`、`cursor` |
| `started_at` | Agent 首次注册时间 |
| `last_heartbeat` | 最近一次心跳时间 |
| `status` | 惰性计算后的 `active` 或 `dead` |

Agent 是否失活不靠后台轮询，而是在 `agent_list`、`project_status`、`doctor` 等读取动作发生时按配置惰性计算：

```text
now - last_heartbeat > agent.heartbeat_dead_ms
```

默认阈值是 90 秒，可在 `.lrnev/config/lrnev.json` 覆盖。

## Task Claim

claim 文件写在：

```text
.lrnev/runtime/claims/{scene}__{spec}__{task}.json
```

字段：

| 字段 | 含义 |
|------|------|
| `scene` | Scene ID |
| `spec` | Spec ID |
| `task` | Task ID，例如 `T-001` |
| `claimed_by` | 持有该 claim 的 `agent_id` |
| `claimed_at` | 首次 claim 时间 |
| `expires_at` | 过期时间；心跳会续租 |
| `touches_files` | 可选，声明预计修改的源码文件，只用于重叠提示 |

claim 是软占用：同一个 Task 已被活跃 Agent claim 时，第二个 Agent 再 claim 不会被硬阻止，但响应会带 `conflict`，提醒客户端先确认是否重复工作。

## CLI 用法

注册 Agent：

```bash
lrnev agent register --id codex-main --client codex
```

发送心跳：

```bash
lrnev agent heartbeat --id codex-main
```

领取 Task：

```bash
lrnev task claim --scene user-management --spec user-login --agent-id codex-main T-001
```

声明预计修改文件，用于重叠提示：

```bash
lrnev task claim --scene user-management --spec user-login --agent-id codex-main T-001 --touches-files src/auth.ts src/session.ts
```

释放 claim：

```bash
lrnev task release --scene user-management --spec user-login --agent-id codex-main T-001
```

开始或完成任务时也可以让 `task_update` 顺带处理 claim：

```bash
lrnev task update --scene user-management --spec user-login --agent-id codex-main --status in_progress T-001
lrnev task update --scene user-management --spec user-login --agent-id codex-main --status completed T-001
```

`in_progress` 会自动登记 claim；`completed/failed` 会自动释放当前 Agent 的 claim。

## MCP 工具

| 工具 | 作用 |
|------|------|
| `agent_register` | 注册当前客户端会话，返回 `agent_id` |
| `agent_heartbeat` | 更新心跳，并续租该 Agent 名下的活跃 claim |
| `agent_list` | 列出 Agent 注册表，并惰性计算 `active/dead` |
| `agent_unregister` | 注销 Agent 会话 |
| `task_claim` | 领取某个 Task，返回 claim 或软冲突 |
| `task_release` | 释放某个 Task claim |
| `project_status` | 查看 `active_agents.active_claims`、`active_tasks`、`claimable_next` |
| `lrnev_doctor` | 诊断 stale claim、损坏注册表等协作异常 |

典型调用顺序：

```json
{ "tool": "agent_register", "arguments": { "agent_id": "codex-main", "client": "codex" } }
```

```json
{ "tool": "task_claim", "arguments": { "scene": "00-default", "spec": "01-00-login", "task": "T-001", "agent_id": "codex-main", "touches_files": ["src/auth.ts"] } }
```

```json
{ "tool": "agent_heartbeat", "arguments": { "agent_id": "codex-main" } }
```

## 源码冲突边界

lrnev 不读源码、不锁源码、不裁决源码冲突。`touches_files` 只是客户端声明：

- 如果两个活跃 claim 声明了同一个文件，响应会提示重叠。
- 提示不阻止继续工作。
- 真正的源码冲突仍由 git、测试和 CI 发现。

## 物理写入互斥

`.lrnev/locks/*.lockdir` 仍会存在，但它只服务于 `FileStorage.withDirectoryLock`：在写 `tasks.md`、分配序号、写 claim 文件的一瞬间做文件级互斥，防止数据损坏。

它不是“谁正在做哪个 Spec”的协作状态。协作状态看 `task_claim` 和 `project_status.active_agents.active_claims`。

## Doctor 检查

| 诊断码 | 含义 | 严重级别 |
|--------|------|----------|
| `STALE_TASK_CLAIM` | Task 是 `in_progress`，但没有活跃 claim，可能无人正在做 | warning |
| `AGENT_REGISTRY_INVALID` | `registry.json` 损坏或结构无效 | warning |

`STALE_TASK_CLAIM` 不会自动把 Task 状态改回 pending。Task 状态是真相，claim 只是“有没有人正在做”的运行态提示。

## 客户端集成建议

客户端启动时：

1. 调用 `agent_register`，保存返回的 `agent_id`。
2. 每 30 秒调用一次 `agent_heartbeat`。
3. 开始做 Task 前调用 `task_claim`，必要时带 `touches_files`。
4. 完成、失败、放弃或交接时调用 `task_release`，或用带 `agent_id` 的 `task_update` 自动释放。
5. 新会话接手时先调 `project_status`，看 `active_agents.active_claims` 和 `claimable_next`。

伪代码：

```js
const agent = await callTool("agent_register", {
  agent_id: "codex-main",
  client: "codex"
});

const timer = setInterval(() => {
  callTool("agent_heartbeat", { agent_id: agent.agent_id });
}, 30_000);

await callTool("task_claim", {
  scene: "00-default",
  spec: "01-00-login",
  task: "T-001",
  agent_id: agent.agent_id,
  touches_files: ["src/auth.ts"]
});

process.on("exit", () => {
  clearInterval(timer);
  callTool("task_release", {
    scene: "00-default",
    spec: "01-00-login",
    task: "T-001",
    agent_id: agent.agent_id
  });
  callTool("agent_unregister", { agent_id: agent.agent_id });
});
```

## NFR 对照

NFR 是 Non-Functional Requirement，中文是“非功能性需求”。它描述系统质量要求，不是某个具体功能按钮。

| 编号 | 中文含义 | 本能力如何满足 |
|------|----------|----------------|
| NFR-1 | 零后台线程 | lrnev 不启动定时器或后台进程，心跳由客户端主动调用 |
| NFR-2 | 向后兼容 | 不注册 Agent 也能继续使用单窗口流程；只是没有“谁正在做”的运行态提示 |
| NFR-3 | 无新依赖 | 只使用 `.lrnev/` JSON 文件和 Node 内置能力 |
| NFR-4 | 并发安全 | claim 登记和 tasks.md 写入都走文件级互斥 |
| NFR-5 | 可观测 | `project_status` 看活跃 Agent/claim，`doctor` 看异常状态 |
