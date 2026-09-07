# 治理流程说明

本文档面向使用和维护 lrnev 的 AI / 开发者，是治理运行语义的权威说明。重点覆盖 gate 语义、哨兵约定、序号语义、状态机、`project_status`、治理体检 report、默认 Scene、adopt，以及与 OpenViking 的关系边界。

## 演进脉络

治理语义的基座由 `03-00-governance-flow-hardening`（v1.0 前）落地，其后各版本演进：v2.0 确定性硬校验（FILL 硬拦、validates 锚点）、v2.1 上下文送达（anchor_context、治理地图）、v2.2 治理体检 report、v2.3 机会式 GC 与批量建任务。基座范围包括：

- Gate 从“扫 TODO 字面量”改为结构契约检查。
- 模板统一使用 `<!-- FILL: ... -->` 哨兵，并提供 `doctor --migrate-todos`。
- `scene_create` / `spec_create` 去状态文件并发分配序号。
- `spec_create` 可不传 Scene，默认挂到 `00-default`。
- `lrnev init` 对存量项目默认被动 adopt，不补建历史 Scene/Spec。
- `project_status` 作为接手入口，读取轻量快照。
- Spec 状态机和 Task 状态机对称，且 gate 与 status 解耦。
- Task 支持 `validates` 追溯需求/设计，`in_progress` 时强制提醒回看上下文。
- Task 支持 `parent` 子任务，同一 `tasks.md` 的写入有 Spec 级短锁保护。

各版本均经真机验证（多客户端多模型），实测矩阵见 [`docs/AI-ADAPTATION.md`](AI-ADAPTATION.md)。

## 职责边界

lrnev 是确定性的项目治理引擎，只负责文件读写、ID 分配、状态机、锁、结构契约校验等能由规则判定的事情。

需要理解和判断的事情交给客户端 AI，通过 `ai_followup` 明确提示：内容质量自查、语义完整性、任务是否可拆分、该落 Spec 还是 ADR / Errorbook / Memory，都不由 lrnev 猜。

与 OpenViking 的关系是“采用文件系统范式和 L0/L1/L2 分层组织上下文”，但不引入向量模型或第二个语义模型。编码 AI 本身就是理解器，lrnev 只提供可检索、可追踪、可版本化的文件事实。

## NFR 说明

NFR 是 Non-Functional Requirement，表示非功能需求。以下约束适用于 lrnev 的所有演进：

- **NFR-1 无回归**：新增/重构行为必须有测试覆盖，阶段收尾跑全量测试。
- **NFR-2 无新运行时依赖**：不引入 LLM、Embedding、向量数据库等强依赖。
- **NFR-3 向后兼容**：既有 `.lrnev/` 数据继续可读；旧 TODO 占位通过 `doctor --migrate-todos` 一次性迁移。
- **NFR-4 错误可观测**：坏数据不能静默消失，要返回 broken 条目或明确错误。
- **NFR-5 性能**：消除冗余 I/O，单次 `scene_get` / `gate_check` 的文件读取次数不增加。

## Gate 语义

Gate 检查结构，不判断 prose 质量。

- `ready` gate 检查 requirements 必填章节、残留 `<!-- FILL: ... -->` 哨兵、未勾选验收项。
- **`ready` gate 的章节检查要求标题与中文模板完全一致**（`L0 摘要` / `L1 概览` / `L2 详情` / `范围` / `详细需求` / `验收标准`）；翻译或改名会判失败。这是**模板契约（I-13，by-design）**：标题即结构锚点，放宽会让结构校验失去确定性；国际化需求将通过标题 alias 表另行设计，不会悄悄放宽现有契约。
- **`completion` gate 校验任务结构**（tasks.md 可读、有任务、全部 `completed`），并**硬拦 requirements.md / design.md 残留的 `<!-- FILL: ... -->` 哨兵**（design.md 缺失同样判失败）——“任务做完了”不等于“内容填完了”，空壳不能通过。它**不检查** tasks.md 自带的模板 FILL（task_create 只追加任务、不替换占位）。
- 正文里正常出现 `TODO` 不会导致 gate 失败。
- 存量旧模板里的裸 TODO 占位需要运行 `lrnev doctor --migrate-todos` 迁移。
- gate 通过后，`ai_followup` 会要求 AI 自查质量，并提示合适的 `spec.status` 回填值。
- **需求审核门（`ready` gate passed，v2.1）**：`ready` 通过时 `ai_followup` 追加"请暂停，把 requirements.md 展示给用户确认后再继续"——这是用户审核"做什么"方向的人工门（只引导不强制；用户说"直接做"可跳过）。落位到已有 spec 加 task 不触发；`completion`/`creation` 不受影响。
- gate 不读取也不要求 `spec.status`。status 是流程状态提示，不是 gate 前置条件。

## 多 Agent 存活

- 存活随 stdio 进程生命周期自动判定：连接初始化即自动注册，连接断开即自动注销并释放该 Agent 的 claim。
- 同主机以 `process.kill(pid,0)` 探活为准——进程活着就是 `active`，无需任何定时心跳;属主进程退出后其 claim 立即可被接手。
- 跨主机无法探 pid 时，回退到默认 **90 秒** 的 `last_heartbeat` 年龄阈值（惰性计算），此时可用 `agent_heartbeat` 兜底续活。
- 硬杀/崩溃残留的死记录与过期 claim 由 register 时的**机会式 GC** 自动清扫（v2.3 起，本机判死即清、跨主机过保留期才清、持有效 claim 的保留；`agent.auto_gc` 可关），只读路径仍零写副作用。
- 详见 [`docs/MULTI-AGENT.md`](MULTI-AGENT.md)（该 ADR 未单独成文：设计背景与决策记录见 CHANGELOG [1.2.0]「Agent 存活信号改为进程生命周期」条目，机会式 GC 见 [2.3.0] 条目，语义以 MULTI-AGENT 与 CHANGELOG 为准）。


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

Scene / Spec 序号来自文件系统扫描，不再维护 `scene-numbers.json`。创建时使用原子目录创建和短临界区锁，避免并发 create 拿到同一序号。

**序号会复用、引用必须用完整 ID（I-9，by-design）**：删除条目（用户手动 `rm` 目录——lrnev 没有删除工具）后新建会拿到相同序号；任何用短序号（如“spec 03”）的引用会**静默指向新的同号条目**，lrnev 不警告、不检测悬空引用。所以文档/跨 Spec 引用一律写完整 ID 和路径，不要把序号当永久业务标识。doctor 的悬空序号引用深扫为后续可选项。

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

额外允许的 Spec 回退 / 归档路径包括 `draft -> archived`、`ready -> draft`、`ready -> archived`、`in-progress -> ready`、`in-progress -> archived`、`completed -> in-progress | archived`。`archived` 是终态。

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

**需求落位(用户记不住每个 Spec 是常态)**：用户用模糊需求("导出那块加个 Excel")让 AI 改东西时，AI 应自己先用 `context_search`(关键词)或读相关 Spec 的 L0/L1 sidecar 摘要（`.requirements.abstract.md` / `.requirements.overview.md`，sidecar 优先、requirements 内联 L0/L1 兜底）确认它对应哪个现有 Spec、实现到哪了，再判断是原地改、加 task 还是开新版——而不是凭模糊需求直接开新 Spec 或写代码。落位是 AI 的判断职责，不该要求用户记住 Spec 编号。

## 接手入口 project_status

接手项目时优先调用 `project_status`。它返回轻量快照：Scene、Spec、活跃 Task、最近 ADR、未关闭错误。

`project_status` 只读取 frontmatter 并解析 `tasks.md`，不读取 requirements / design 正文。需要深入上下文时，再根据返回的 `ai_followup` 调用 `scene_get` 或 `spec_get`。

两个有意为之的口径（v2.3 文档化）：

- **空的 `00-default` 不出现在 scenes 列表**（与治理地图口径一致）——它是惰性兜底 Scene，没有 Spec 时列出只是噪音；`scene_list` 仍会显示它。
- **`claimable_next` 是预览不是全量**：每个 Spec 最多展示 `project_status.claimable_preview`（默认 5）条，全量数量看 `free_tasks_count`；条目带 `depends_on` 时表示有前置依赖——依赖未完成**不阻断**领取（软提醒哲学），领取与推进时 followup 会点名提醒。预览与全量的核对关系另有结构化字段：每个 Spec 的 `claimable_meta`（QueryMeta，语义见文末「截断与省略的显式元数据」节）。

## 治理体检 report（v2.2）

`lrnev report` / `lrnev_report` 是零模型的治理体检，定位是**给人看的"分红"**（lrnev 第一个主消费者是用户而非 AI 的工具），不是 CI gate：

- **链路完整度**：scene/spec/task 计数、"做完没收口"（task 全 completed 但 spec status≠completed）、failed/blocked 明细。
- **validates 覆盖率**：真锚点覆盖率、孤儿锚点（按 spec 状态分在途/真欠债）、坏 validates（指向不存在锚点，不计覆盖、指向 doctor）。
- 每条欠债带**可执行下一步**（如 unclosed → `spec_gate_check(completion)` + `spec_update`）与 `context://` 定位。
- 输出：默认 text（人读体检单）、`--md`、`--json`、`--out` 落盘（不给不写文件）、`--scene` 过滤。

口径约定："做完没收口"判定**只镜像 completion gate 的 `all_tasks_completed`**（全平铺 every-completed），不复刻 gate 的 FILL/design 子检查——所以 report 标 unclosed ≠ "gate 必过"，它只引导你去跑 gate。report 与 `doctor` 分工：doctor 管结构健康与坏引用的详细修复、stale 判定；report 管治理进度的呈现与下一步，不重复 doctor。report **不提供退出码 / `--fail-on`**，有债也 exit 0。

## 默认 Scene 与 adopt

`spec_create` 可以不传 Scene。缺省时 Spec 会挂到 `00-default`，必要时 lrnev 会惰性创建这个最小 Scene。

`lrnev init` 对存量项目默认采用被动 adopt：只创建最小 `.lrnev/` 骨架和 `00-default`，不为已经完成的历史代码补建 Scene / Spec。`--scan` 目前是**占位 flag（行为同默认 init，不做主动扫描）**；基于代码库生成候选 Scene 属规划中能力，落地前无需传。

`init` 返回的 `was_new` 以 **PROJECT.md 是否已存在**判定（它是"已初始化"标记）——`.lrnev/` 目录存在不代表初始化过（MCP 连接自动注册会先创建 `.lrnev/agents/`）。

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

Task 可以带可选的需求 / 设计锚点（validates）：

```md
### T-005 实现登录校验 <!-- lrnev-task: status=pending, created=..., validates=F-01|D-02 -->
```

**锚点体系**：`F-xx` 指 requirements 的功能需求（`#### F-xx` 标题），`D-xx` 指 design 的设计点（`#### D-xx` 标题），两者对称。**validates 只接受这两种格式**，并做存在性硬校验——引用 requirements/design 里不存在的编号会被 `task_create` 拒绝、不落盘（与 depends_on 坏引用同类处理）。lrnev 仍不判断需求/设计写得好不好，只判断“这个编号在不在”。旧式 `design#3.2` 自由写法已废弃（design 里没有稳定章节号，无法确定性校验），会被拒绝并提示改用 `D-xx`。

当 Task 改为 `in_progress`（或经 `task_claim` 领取）时，除文字提醒外还**把验收口径作为结构化字段随返回回填**（v2.1）：带 `validates` 时返回顶层 `anchor_context`——从 requirements/design 抽出对应 `#### F-xx`/`#### D-xx` 段落（按句末/换行边界截断，D-xx 默认首行+标题）；不带 `validates` 时退化为 `summary_context`——spec 级 L0/L1 摘要（**读取契约：sidecar 优先、requirements 内联兜底**）；两者皆无才退回纯文字"回看本 Spec 目标与验收"。followup 始终保留"仍需回看原文"，`task_claim` 同样回填（堵旁路）。回填块自带截断/残缺元数据（`meta.text_status`），且 `task_update` / `task_claim` 的 content 文本会把这些块连同状态行一并投影——语义见下节「截断与省略的显式元数据」。

Task 也可以记录父子关系：

```md
### T-006 登录 UI <!-- lrnev-task: status=pending, created=..., parent=T-005 -->
```

`task_create(parent=...)` 会把子任务插到父任务块附近，`task_list` / `project_status` 会体现层级。同一个 `tasks.md` 的并发 create / update 会用 Spec 级锁串行化，避免互相覆盖。

**批量创建（v2.3）**：spec ready 后一次性拆任务清单用 `task_create_many` / CLI `task create-many --from-file`——两阶段原子执行（全量校验通过才单次写入 tasks.md），任一条失败整批不写并一次性返回全部错误明细（index/field/message）；批内依赖用元素级 `key` 临时键（禁 `T-\d+` 格式，落盘时解析为真实 ID），`parent` 仍只接受已存在的真实 Task ID。校验口径与单条 `task_create` 完全一致（同一份代码）；ID 按数组顺序 max+1 连续分配，落盘产物与逐条创建等价，hook `task.create` 逐任务触发。临时补单个任务仍用 `task_create`。

lrnev 不 spawn agent、不调度子任务、不裁决源码文件冲突。它只记录父子状态并保护 `tasks.md`。真正并行执行由客户端负责，而且只有在子任务修改的源码文件不重叠时才值得并行。

## 截断与省略的显式元数据（3.0.0，F-04）

lrnev 返回内容可能因**体积预算**或**源残缺**而"给一部分"——此时显式标注而非静默省略。两类元数据与 `structuredContent` 同源，`content` 文本通道也同步渲染（文本-only 客户端不必解析 JSON 也能收到同等信号）。

### 段落级：`anchor_context[].meta` / `summary_context.meta`

`text_status` 三态（类型见 `src/types/truncation.ts`）：

| `text_status` | 含义 | 客户端处置 |
|---|---|---|
| `complete` | 正文完整返回 | 直接使用 |
| `truncated_by_budget` | 预算截断：源内容完整，但受体积上限省略了尾部 | 只用于快速定向，关键判断前查原文 |
| `incomplete_source` | 源残缺：锚点/摘要标题在但正文未填（如仍是 `<!-- FILL -->` 占位） | 先去补写 requirements/design；lrnev 不会把占位噪声当正文回填 |

非 `complete` 时附 `original_length`（截断/残缺前原始长度）；三态恒有 `returned_length`（= 实际返回的 `text` 长度）。`task_update(in_progress)` / `task_claim` 的 content 文本会逐块投影「锚点上下文 {anchor}（requirements.md/design.md）+ 正文 + 状态：text_status=…」行，`summary_context` 同理（`Spec 摘要上下文（sidecar/内联）` + L0/L1 + 状态行）。

### 查询级：QueryMeta 四件套

`returned_count`（实际返回条数）/ `total_count`（截断前候选总数，lrnev 先全量收集再截断，**恒可得**）/ `truncated`（是否因预算省略）/ `omitted`（省略详情，只可能是 `{kind:"none"}` 或 `{kind:"exact", count: N}`）。出现位置与消费指引：

- **`context_search` 的 `data.query_meta`**：`total_count` = 全量召回命中数，`returned_count` = 按 `top_k` 截断后的返回数。`truncated: true` 表示还有命中被省略（`omitted.count` 条）——若在意被省略的命中，换更精确的关键词或加 `scope` 缩小范围重试；不要把"只返回 N 条"误读成"只有 N 条命中"。
- **`project_status` 每个 Spec 的 `claimable_meta`**：`total_count` = 该 Spec 的 `free_tasks_count`（可领任务全量），`returned_count` = `claimable_next` 预览条数。`truncated: true` 表示预览只取了前 `project_status.claimable_preview` 条。
- **`task_create_many` 的 `data.query_meta`**：核对信息（`created` 条数 = 请求批、`truncated` 恒为 `false`）——批量是原子 all-or-nothing，超 `task.max_batch_create` 在上限处直接报错，不是截断。

> 严格契约边界：这些字段的 canonical 定义与信封（structuredContent）语义以根 README「MCP 响应契约」节为权威，本文件只解释治理语义与消费方式。
