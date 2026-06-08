# 多 Agent 协作说明

多 Agent 协作用于一人多窗口、同一个 AI 多会话、或不同 AI 客户端同时处理同一项目的场景。lrnev 是 MCP 项目治理服务，不启动 AI、不调度任务、不编排执行；它只记录“哪个客户端声明正在做哪个 Task”，让后来者能看见现场并避免重复踩同一块工作。

## 核心模型

lrnev 把多窗口协作拆成三层：

| 层级 | 文件 | 含义 |
|------|------|------|
| Task 状态真相 | `.lrnev/scenes/*/specs/*/tasks.md` | Task 的 `pending/in_progress/blocked/completed/failed` 状态，只能由 task 工具更新 |
| Agent 存活 | `.lrnev/agents/registry.json` | 当前有哪些客户端会话；存活以进程是否在世为准 |
| Task claim | `.lrnev/runtime/claims/*.json` | 运行态软占用：谁声明正在做哪个 Task |

claim 是运行态，不是第二份任务状态索引。删掉 `.lrnev/runtime/claims/` 不会改变 `tasks.md`，只会丢失“谁正在做”的现场提示。

## Agent 注册表

每个 Agent 记录包含：

| 字段 | 含义 |
|------|------|
| `agent_id` | Agent 唯一标识；可以由客户端传入，也可以由 lrnev 自动生成 |
| `pid` | 当前进程 ID；同主机存活判定的主信号 |
| `host` | 当前主机名；用于人类辨识，也用于判断能否在本机探 pid |
| `client` | 客户端名称，例如 `codex`、`claude-code`、`cursor` |
| `started_at` | Agent 首次注册时间 |
| `last_heartbeat` | 最近一次活动时间；跨主机存活判定的兜底信号 |
| `status` | 惰性计算后的 `active` 或 `dead` |

### 存活判定:进程生命周期为主,心跳为兜底

lrnev 是 stdio MCP 服务，每个客户端窗口都会把它当**子进程**拉起。因此“这个会话还在吗”有一个免费且可靠的答案：**它的进程是否还在世**。存活判定按这个事实进行，不依赖任何客户端定时心跳：

- **同主机**（`host` == 当前主机）：用 `process.kill(pid, 0)` 探测 pid 是否在世。在世 = `active`，不在 = `dead`。`last_heartbeat` 多旧都不影响——哪怕客户端从不发心跳，只要进程活着就是 `active`。
- **跨主机**（无法探本机外的 pid）或 pid 缺失/非法：回退到心跳年龄阈值 `now - last_heartbeat > agent.heartbeat_dead_ms`（默认 90 秒，可在 `.lrnev/config/lrnev.json` 覆盖）。

判定是惰性的：只在 `agent_list`、`project_status`、`doctor` 等读取动作发生时计算，不起后台轮询。

> 设计背景见 ADR《Agent 存活信号从心跳年龄改为 stdio 进程/连接生命周期》。早期版本要求客户端每 30 秒调一次 `agent_heartbeat`，但 MCP 协议没有定时器、LLM 客户端也不会周期性主动调工具，导致活着的会话被误判为 dead、claim 被误回收。现在改用进程生命周期作为主信号。

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
| `expires_at` | TTL 过期时间(兜底) |
| `touches_files` | 可选，声明预计修改的源码文件，只用于重叠提示 |

claim 是软占用：同一个 Task 已被**活跃** Agent claim 时，第二个 Agent 再 claim 不会被硬阻止，但响应会带 `conflict`，提醒客户端先确认是否重复工作。

一个 claim 在以下任一情况下可被他人接手（reclaimable）：

- TTL `expires_at` 已过期；或
- 它的属主 Agent 已 `dead`（属主进程退出/崩溃）。

属主进程一旦退出，它的 claim 立即可被接手，不必干等 TTL。优雅退出时 claim 会被直接删除（见下文“会话生命周期”）；硬杀残留的 claim 则因属主 pid 探活判死而被视为可接手。

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
| `STALE_AGENT` | 同主机的某 Agent 进程(pid)已不在世，但仍留在注册表 | warning |
| `ORPHAN_CLAIM` | 某未过期 claim 的属主 Agent 已退出或不在注册表 | warning |
| `AGENT_REGISTRY_INVALID` | `registry.json` 损坏或结构无效 | warning |

`STALE_TASK_CLAIM` 不会自动把 Task 状态改回 pending。Task 状态是真相，claim 只是“有没有人正在做”的运行态提示。`STALE_AGENT` / `ORPHAN_CLAIM` 也只是提示，读取时已按 dead 计算，不影响接手；如想保持注册表/claim 目录干净，可按建议清理。

## 会话生命周期(自动)

通过 stdio 启动 lrnev MCP 服务时，会话注册与清理是**自动**的，客户端无需手动驱动：

1. MCP 连接初始化完成时，lrnev 自动注册当前会话 agent（pid = 该子进程，client 取自 MCP `clientInfo`）。
2. 连接断开（客户端正常关闭）时，lrnev 自动注销该 agent 并释放它名下的所有 claim。
3. 进程被硬杀（来不及触发断开钩子）时，残留记录由后续读取时的 pid 探活判死兜底。

因此：**不需要客户端定时发心跳，也不需要手动 `agent_register` / `agent_unregister`**。`agent_*` 工具与 CLI 仍然保留，供脚本化、跨主机协作或显式控制使用。

## 客户端集成建议

- 大多数场景下，注册/注销已自动完成；客户端只需在开始做 Task 前调用 `task_claim`（必要时带 `touches_files`），新会话接手时先调 `project_status` 看 `active_agents.active_claims` 和 `claimable_next`。
- 跨主机协作（agent 与读取方不在同一台机器）时，pid 探活不可用，可定期调用 `agent_heartbeat` 让对端基于 `last_heartbeat` 兜底判活。
- 用带 `agent_id` 的 `task_update` 可在 `in_progress` 时自动登记 claim、`completed/failed` 时自动释放。

```js
// 注册通常自动完成;如需显式控制(脚本/跨主机)仍可手动:
const agent = await callTool("agent_register", { client: "codex" });

await callTool("task_claim", {
  scene: "00-default",
  spec: "01-00-login",
  task: "T-001",
  agent_id: agent.agent_id,
  touches_files: ["src/auth.ts"]
});

// 连接断开时 lrnev 会自动注销并释放 claim;无需手写定时心跳或退出清理。
```

## NFR 对照

NFR 是 Non-Functional Requirement，中文是“非功能性需求”。它描述系统质量要求，不是某个具体功能按钮。

| 编号 | 中文含义 | 本能力如何满足 |
|------|----------|----------------|
| NFR-1 | 零后台线程 | lrnev 不启动定时器或后台进程；存活按进程生命周期惰性判定，不靠轮询，也不靠客户端定时心跳 |
| NFR-2 | 向后兼容 | 不注册 Agent 也能继续使用单窗口流程；`agent_heartbeat` 与跨主机兜底保留 |
| NFR-3 | 无新依赖 | 只使用 `.lrnev/` JSON 文件和 Node 内置能力 |
| NFR-4 | 并发安全 | claim 登记和 tasks.md 写入都走文件级互斥 |
| NFR-5 | 可观测 | `project_status` 看活跃 Agent/claim，`doctor` 看异常状态 |
