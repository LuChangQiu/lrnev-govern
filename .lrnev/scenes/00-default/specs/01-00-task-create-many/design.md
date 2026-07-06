---
spec: '01-00-task-create-many'
scene: '00-default'
created: '2026-07-06'
---

# 01-00 Task Create Many - 设计

## L0 摘要

TaskManager 新增 createMany：批内先全量校验（复用单条校验逻辑 + key 解析）再一次性写入 tasks.md，MCP 新工具 task_create_many 与 CLI task create-many --from-file 共用同一 core 方法。

## L1 概览

### 架构思路

- **core 唯一业务层**：批量逻辑全部在 `TaskManager.createMany`；MCP 工具与 CLI 子命令都是薄包装（CLI/MCP 对等靠共用 core 保证，不靠两边各写一遍）。
- **校验复用不复制**：单条 task_create 的校验现耦合在 create 闭包内，且 assertValidatesAnchors 等为 throw-first（首错即抛）并自读锚点池——需改造为"收集错误 + 外部注入共享锚点池"的可复用形态，单条路径改走同一函数保持外部行为不变，批量 = 循环调用收集全部错误 → 全过才进入写入阶段。两条路径的校验行为由同一份代码保证一致（重构量比"直接复用"大，任务拆分按此估）。
- **两阶段执行**：阶段一纯校验零写入（含 key 唯一性、key 格式、批内引用解析的可满足性）；阶段二分配 ID、解析 key→ID、单次序列化写 tasks.md。失败只可能发生在阶段一，天然原子。
- **不做的复杂度**：无 dry_run 参数（原子失败即校验）、无 mode 参数（只有 all-or-nothing）、无部分成功语义。

### 主要模块

- `src/core/TaskManager.ts`：新增 `createMany`；单条校验逻辑重构为收集式可复用函数（不改变单条外部行为）；followup 文案与单条同模式在 core 内联生成（单次）。
- `src/types/task.ts`：`CreateManyTasksInput`（含元素级 `key` 字段）、`CreateManyTasksResult`（`created: [{id, title}]`）、批量错误明细类型（index/field/message）。
- `src/shared/errors.ts`：LrnevError 现仅支持 field/hint/candidates 载荷——扩展可选批量错误明细（`errors: [{index, field, message, code}]`）并接入 toErrorInfo 与 MCP/CLI 错误序列化（加法扩展，既有错误路径不变）。
- `src/shared/config.ts`：单批上限 `task.max_batch_create`（默认 50；先例：memory.max_candidates_per_commit）。
- `src/mcp/tools/index.ts`：注册 `task_create_many`（zod schema，描述自包含）。
- `src/mcp/guidance.ts`：`TOOL_DESCRIPTIONS` 新增 task_create_many 条目（tool-descriptions 测试会覆盖）。
- `src/cli/index.ts`：`task create-many --scene --spec --from-file <path|->`。

### 关键决策

| 决策 | 选项 | 倾向 | 是否产 ADR |
|---|---|---|---|
| 新工具 vs task_create 扩参 | 扩参不涨工具数 / 新工具语义单纯 | 新工具——互斥 schema 是弱模型误用陷阱；瘦身归战略第四步统一做 | 是 |
| 批内引用语法 | #N 序号 / key 临时键 | key——可读、抗数组重排；禁 T-\d+ 格式防歧义 | 同上 |
| dry_run | 加 / 不加 | 不加——原子 + 全错误列表已覆盖其价值 | 同上 |
| 失败语义 | all-or-nothing / mode 参数可选 partial | 仅 all-or-nothing，不做成参数 | 同上 |

## L2 详情

### 模块详细设计

#### D-01 两阶段 createMany 算法

```
createMany(input):
  阶段一（纯校验，零写入）：
    1. tasks 数组非空、每条 title 非空（复用单条必填校验）
    2. key 规则：批内唯一、不匹配 /^T-\d+$/
    3. 读一次 tasks.md 现状 + requirements/design 锚点池（extractAnchorPool，各读一次，整批共享）
    4. 逐条校验 validates（F-xx/D-xx 存在性）、parent（须为已存在真 ID）、
       depends_on（每项：批内 key 命中 → 合法；否则按已存在 T-xxx 校验）
    5. 收集全部错误 [{index, field, message, code}]；非空则抛批量校验错误，结束
  阶段二（分配与写入）：
    6. 从现状 max+1 起按数组顺序分配 T-xxx（computeNextTaskNumber 同规则）
    7. depends_on 中的批内 key 替换为分配的真 ID
    8. 全部任务序列化后 tasks.md 单次写入：无 parent 的追加；含 parent 的走既有
       insertChildTaskToMarkdown 路径（与单条一致）。持既有 withTasksFileLock 目录锁，
       落盘走 FileStorage 的 tmp+rename 原子写——两阶段 + 单次写入天然原子
    9. 返回 created: [{id, title}]
```

parent 只接受已存在的真 T-xxx（不支持批内 key）：父子拆分场景中父任务通常已存在；批内同时建父子会引入"引用即将创建的父"的额外规则，首版不做（范围外，需求侧未承诺）。

hook 事件：逐任务触发既有 `task.create` 事件 × N（与逐条创建语义等价，hook 消费方无需感知批量概念，不新增事件类型）。

维护态提示：目标 spec 状态为 completed 时，followup 附一次状态回退提示（completed → in-progress），与单条 task_create 口径一致、只出现一次。

#### D-02 key 解析与冲突规则

- key 命名空间与真 ID 严格隔离：`/^T-\d+$/` 格式的 key 在阶段一直接拒绝（INVALID_INPUT）。
- depends_on 解析优先级：批内 key 精确匹配 → 已存在任务 ID 精确匹配 → 都不中报 TASK_NOT_FOUND（带 index/field）。
- 批内引用不限方向（后面元素可被前面依赖），因为解析发生在全部 ID 分配之后。
- 自引用（元素 depends_on 自己的 key）报 INVALID_INPUT。

#### D-03 批量错误契约

- 现状：LrnevError 仅有 field/hint/candidates 载荷（src/shared/errors.ts），无通用 details——本 Spec 对其做加法扩展：新增可选 `errors: [{index, field, message, code}]` 明细数组，接入 toErrorInfo 与 MCP/CLI 错误序列化；既有错误路径（不带 errors）行为不变。
- 错误码沿用既有枚举：单条性质的错误用原码（ANCHOR_NOT_FOUND / TASK_NOT_FOUND / INVALID_INPUT），批量失败的顶层错误码取第一类失败（或 INVALID_INPUT），全量明细在 errors 数组。
- MCP 与 CLI 输出同一结构（CLI 走统一 {ok:false, error} 包装）。

#### D-04 MCP 工具 schema 与 followup

- schema：`{scene, spec, tasks: [{title, description?, validates?, acceptance?, depends_on?, parent?, key?}]}`；描述写明"批量原子创建；批内依赖用 key；单个任务用 task_create"。
- followup 单次：`N 个任务已创建（T-xxx..T-yyy）` + 建议从第一个无依赖任务 task_update(in_progress) 开始 + 保留指向 requirements 验收口径的常规提示。不逐条展开 anchor_context（任务启动上下文按既有设计在 in_progress/claim 时刻回填，创建时刻不预送）。

#### D-05 CLI create-many

- `lrnev task create-many --scene <s> --spec <sp> --from-file <path>`；`-` 读 stdin。
- 文件内容：JSON 数组（与 MCP tasks 字段同构）或 `{"tasks": [...]}` 包装对象二选一均接受（宽进，方便手写）。
- 文件不存在 / JSON 非法 / 结构不符 → INVALID_INPUT（结构化，不裸抛）。

### 数据模型

- tasks.md 格式零变更：落盘产物与逐条 task_create 等价（同样的标题行注释状态机、同样的字段序列化）。
- 无新增持久化文件；key 是纯请求期概念，不落盘。

### 接口契约

- MCP `task_create_many`：入参见 D-04；成功返回 `{created: [{id, title}], count}`；失败返回批量错误契约（D-03）。
- CLI `lrnev task create-many`：见 D-05，输出 `{ok, data, ai_followup}` 包装。
- 既有 `task_create` 契约与行为完全不变。

### 错误处理

- 所有失败都发生在写入前（两阶段设计），无半批状态需要恢复。
- 写入阶段的 IO 异常（磁盘满等）按既有 task_create 写入异常口径处理——tasks.md 单次写入，不存在部分任务落盘。
- 空数组、超过 `task.max_batch_create`（config，默认 50）的数组报 INVALID_INPUT。

### 测试策略

- 单元（tests/unit/task-manager.test.ts 扩展）：连续编号与顺序、与逐条创建产物等价（含 parent 子任务路径）、key 解析（前向/后向引用、自引用拒绝、重复 key 拒绝、T-格式 key 拒绝）、混合引用真 ID、全量错误收集（多条错误一次返回、index/field 准确）、原子性（失败后文件零变更、ID 无占用）、空数组/超 max_batch_create 上限、completed spec 维护态提示单次出现、hook task.create 触发 N 次。
- 单条回归：task_create 全部既有测试不动、行为不变；tool-descriptions 测试覆盖新工具描述。
- CLI↔MCP 对等：同一 JSON 输入两路提交，落盘与返回同构（沿用 tests/unit/cli.test.ts 既有对等断言写法）；--from-file 错误路径（缺文件/坏 JSON/stdin）。
- 集成：ready 后真实 spec 上一次创建 10 条（含 validates + 批内依赖），completion 链路（task_update → gate）照常工作。
