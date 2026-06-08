# 治理流程加固说明

本文档记录 `03-00-governance-flow-hardening` 落地后的运行语义，面向使用和维护 lrnev 的 AI / 开发者。重点覆盖 gate 语义、哨兵约定、序号语义、状态机、`project_status`、默认 Scene、adopt，以及与 OpenViking 的关系边界。

## 当前完成范围

`03-00-governance-flow-hardening` 已完成的核心范围：

- Gate 从“扫 TODO 字面量”改为结构契约检查。
- 模板统一使用 `<!-- FILL: ... -->` 哨兵，并提供 `doctor --migrate-todos`。
- `scene_create` / `spec_create` 去状态文件并发分配序号。
- `spec_create` 可不传 Scene，默认挂到 `00-default`。
- `lrnev init` 对存量项目默认被动 adopt，不补建历史 Scene/Spec。
- `project_status` 作为接手入口，读取轻量快照。
- Spec 状态机和 Task 状态机对称，且 gate 与 status 解耦。
- Task 支持 `validates` 追溯需求/设计，`in_progress` 时强制提醒回看上下文。
- Task 支持 `parent` 子任务，同一 `tasks.md` 的写入有 Spec 级短锁保护。

已完成的真机验证（v1.0.0 发布前）：

- OpenCode 1.15.13：初始化、黄金路径、能力域全覆盖 ✅
- Codex CLI 0.136.0：34 个 MCP 工具全调通、Java 项目探测修复验证 ✅

保留为可选后续优化的项：

- `ResolveCache`：请求级 ID 解析缓存。它只在现有局部 I/O 优化不能满足 NFR-5 时需要做；当前测试已覆盖关键读次数，因此不是阻塞项。

## 职责边界

lrnev 是确定性的项目治理引擎，只负责文件读写、ID 分配、状态机、锁、结构契约校验等能由规则判定的事情。

需要理解和判断的事情交给客户端 AI，通过 `ai_followup` 明确提示：内容质量自查、语义完整性、任务是否可拆分、该落 Spec 还是 ADR / Errorbook / Memory，都不由 lrnev 猜。

与 OpenViking 的关系是“采用文件系统范式和 L0/L1/L2 分层组织上下文”，但不引入向量模型或第二个语义模型。编码 AI 本身就是理解器，lrnev 只提供可检索、可追踪、可版本化的文件事实。

## NFR 说明

NFR 是 Non-Functional Requirement，表示非功能需求。

- **NFR-1 无回归**：新增/重构行为必须有测试覆盖，阶段收尾跑全量测试。
- **NFR-2 无新运行时依赖**：不引入 LLM、Embedding、向量数据库等强依赖。
- **NFR-3 向后兼容**：既有 `.lrnev/` 数据继续可读；旧 TODO 占位通过 `doctor --migrate-todos` 一次性迁移。
- **NFR-4 错误可观测**：坏数据不能静默消失，要返回 broken 条目或明确错误。
- **NFR-5 性能**：消除冗余 I/O，单次 `scene_get` / `gate_check` 的文件读取次数不增加。

`ResolveCache` 对应 NFR-5 的 P2 兜底方案：如果局部优化还不够，再给一次工具调用生命周期内加解析缓存，缓存 `sceneInput -> sceneId`、`(sceneId, specInput) -> specId` 等结果。不跨请求缓存，避免 create/update 后读到旧数据。

## Gate 语义

Gate 检查结构，不判断 prose 质量。

- `ready` gate 检查 requirements 必填章节、残留 `<!-- FILL: ... -->` 哨兵、未勾选验收项。
- **`ready` gate 的章节检查要求标题与中文模板完全一致**（`L0 摘要` / `L1 概览` / `L2 详情` / `范围` / `详细需求` / `验收标准`）；翻译或改名会判失败。
- **`completion` gate 只校验任务结构**（tasks.md 可读、有任务、全部 `completed`）；它**不检查** design.md / tasks.md 里的 FILL 哨兵——requirements 的 FILL 由 `ready` gate 负责。
- 正文里正常出现 `TODO` 不会导致 gate 失败。
- 存量旧模板里的裸 TODO 占位需要运行 `lrnev doctor --migrate-todos` 迁移。
- gate 通过后，`ai_followup` 会要求 AI 自查质量，并提示合适的 `spec.status` 回填值。
- gate 不读取也不要求 `spec.status`。status 是流程状态提示，不是 gate 前置条件。

## 多 Agent 存活

- 存活随 stdio 进程生命周期自动判定：连接初始化即自动注册，连接断开即自动注销并释放该 Agent 的 claim。
- 同主机以 `process.kill(pid,0)` 探活为准——进程活着就是 `active`，无需任何定时心跳;属主进程退出后其 claim 立即可被接手。
- 跨主机无法探 pid 时，回退到默认 **90 秒** 的 `last_heartbeat` 年龄阈值（惰性计算），此时可用 `agent_heartbeat` 兜底续活。
- 详见 [`docs/MULTI-AGENT.md`](MULTI-AGENT.md) 与 ADR《Agent 存活信号从心跳年龄改为 stdio 进程/连接生命周期》。


## 填空哨兵

模板统一使用明确的填空哨兵：

```md
<!-- FILL: 简短说明 -->
```

`doctor --migrate-todos` 只迁移旧模板占位形态，例如：

- `- TODO`
- `#### F-01 TODO`
- `- [ ] TODO`

带说明的 TODO、句中 TODO、已有注释里的 TODO 都不会被迁移。

## ID 与序号

Scene ID 保持 `{NN}-{name}`，Spec ID 保持 `{NN}-{VV}-{name}`。Spec ID 不带 Scene 前缀，因为路径已经表达了归属 Scene。

Scene / Spec 序号来自文件系统扫描，不再维护 `scene-numbers.json`。创建时使用原子目录创建和短临界区锁，避免并发 create 拿到同一序号。删除条目后新建可能复用序号；引用应使用完整 ID 和路径，不应把序号当永久业务标识。

## 状态机

Task 状态转换：

```text
pending -> in_progress -> completed
pending -> blocked
in_progress -> failed | blocked
blocked -> pending | in_progress
failed -> pending
```

Spec 状态值：

```text
draft -> ready -> in-progress -> completed -> archived
```

额外允许的 Spec 回退 / 归档路径包括 `ready -> draft`、`ready -> archived`、`in-progress -> ready`、`in-progress -> archived`、`completed -> in-progress | archived`。`archived` 是终态。

status 不阻塞 gate。用 `spec_update` 工具按状态机改 Spec 状态(非法转换会被拒绝)。推荐回填语义是：

- `ready` gate 通过：`spec_update status=ready`。
- 第一个 Task 改为 `in_progress`：`spec_update status=in-progress`。
- `completion` gate 通过：`spec_update status=completed`。
- `completed -> in-progress`：允许，但表示又出现未完成工作。

## 重写、归档与需求落位

**整体重写该不该开新版，按"是否有已实现沉淀"判，不要无脑开新版：**

- Spec **还没实现**(无 completed task 且 status 为 draft/ready)：要推翻/重写需求或设计，**直接编辑当前 requirements/design 即可，不要开新版**。开新版只会留下一堆没用的 pending。
- Spec **已有实现**(有 completed task 或 status=completed)：整体推翻重做才开新版 `spec_create --version`(VV+1)保留旧版对照，旧版被取代后用 `spec_update status=archived` 归档；只是增量加需求时，在本版 `task_create` 即可，不必新开 spec。

`spec_get` 对已有实现的 Spec 会提示考虑开新版(其余情况不提示，避免噪音)。

**归档语义**：`archived` 是终态。归档后的 Spec 仍出现在 `project_status` 的 specs 列表(可见历史)，但它的待办任务**不再进入** `claimable_next` / `free_tasks_count` / 顶层 `active_tasks`，不会再冒充"有活可领"。

**需求落位(用户记不住每个 Spec 是常态)**：用户用模糊需求("导出那块加个 Excel")让 AI 改东西时，AI 应自己先用 `context_search`(关键词)或读相关 Spec 的 `.abstract.md` 确认它对应哪个现有 Spec、实现到哪了，再判断是原地改、加 task 还是开新版——而不是凭模糊需求直接开新 Spec 或写代码。落位是 AI 的判断职责，不该要求用户记住 Spec 编号。

## 接手入口 project_status

接手项目时优先调用 `project_status`。它返回轻量快照：Scene、Spec、活跃 Task、最近 ADR、未关闭错误。

`project_status` 只读取 frontmatter 并解析 `tasks.md`，不读取 requirements / design 正文。需要深入上下文时，再根据返回的 `ai_followup` 调用 `scene_get` 或 `spec_get`。

## 默认 Scene 与 adopt

`spec_create` 可以不传 Scene。缺省时 Spec 会挂到 `00-default`，必要时 lrnev 会惰性创建这个最小 Scene。

`lrnev init` 对存量项目默认采用被动 adopt：只创建最小 `.lrnev/` 骨架和 `00-default`，不为已经完成的历史代码补建 Scene / Spec。`--scan` 是显式可选能力，用于用户确实希望基于代码库生成候选 Scene 草稿时。

## 小事分流

不是所有事情都应该开 Spec。

- 改错别字、微调样式，后续无人追问：可以不落地。
- 踩坑和错误经验：记录到 Errorbook。
- 小决策、选型、约定：记录到 ADR 或 Memory。
- 可交付特性，需要需求追踪、任务拆分、验收闭环：走 Spec。

`assess_goal` 只评估复杂度，不猜该落哪个产物。产物分流由客户端 AI 根据 `ai_followup` 和上下文判断。

## Spec 粒度与拆分

Scene 是业务场景，Spec 是可交付特性，Task 是执行单元。一个 Spec 只装一个可交付特性；用户一次说出多个需求时，先用 `assess_goal` 做辅助评估，再由 AI 按特性分别 `spec_create`，不要把多个可独立交付的特性塞进一个大 Spec。

拆分时按三条标尺自查：

1. 两块需求能否分别独立验收/独立上线？能就拆成两个 Spec。
2. 它们是否共享同一套验收标准？共享时可以合并为一个 Spec。
3. 某块方案不确定、需要先调研？那块单独做研究型 Spec，或先用 ADR 记录关键选择。

`scene_create` 的 `intent` 只提供单/多 Spec 的辅助信号，不是结论，也不会自动创建多个 Spec。最终拆几个仍由客户端 AI 结合上下文和用户意图判断。

## 任务追溯与子任务

Task 可以带可选的需求 / 设计锚点：

```md
### T-005 实现登录校验 <!-- lrnev-task: status=pending, created=..., validates=F-01|design#3.2 -->
```

当 Task 改为 `in_progress` 时，`ai_followup` 总会提醒 AI 回看需求 / 设计。带 `validates` 时提示具体锚点；不带时退化为回看本 Spec 的目标和验收标准。

Task 也可以记录父子关系：

```md
### T-006 登录 UI <!-- lrnev-task: status=pending, created=..., parent=T-005 -->
```

`task_create(parent=...)` 会把子任务插到父任务块附近，`task_list` / `project_status` 会体现层级。同一个 `tasks.md` 的并发 create / update 会用 Spec 级锁串行化，避免互相覆盖。

lrnev 不 spawn agent、不调度子任务、不裁决源码文件冲突。它只记录父子状态并保护 `tasks.md`。真正并行执行由客户端负责，而且只有在子任务修改的源码文件不重叠时才值得并行。
