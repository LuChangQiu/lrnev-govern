---
spec: 01-00-task-create-many
scene: 00-default
status: completed
priority: P1
created: '2026-07-06'
updated: '2026-07-06'
---

# 01-00 Task Create Many - 需求

## L0 摘要

新增 task_create_many 工具/命令：spec 拆解阶段一次原子性创建多个 task，支持批内 key 依赖引用与压缩返回，单个 task_create 保持原样。

## L1 概览

### 目标

真实使用反馈（xpaas-xmxxgl，GPT-5.5 会话）：ready gate 后拆任务需要连续调用 task_create 10 次，每次一轮往返 + 一坨完整 followup——交互成本高、token 浪费在机械重复上。目标：

1. "spec ready 后一次性拆任务"场景从 N 次调用降为 1 次。
2. followup 只回一次，返回压缩为创建摘要（id/title 列表）。
3. 批内任务可以互相依赖（后面的 task 依赖同批前面的 task），不需要预知将分配的 ID。
4. 校验口径与单条 task_create 完全一致，原子落盘：任一条失败整批不写。

### 用户故事

- 作为拆解 spec 的 AI 会话，我希望把已经想好的任务列表一次提交，以便把注意力留在任务拆分质量上，而不是逐条搬运。
- 作为需要临时补一个小任务的会话，我希望单个 task_create 保持原有简单语义，以便小场景不被批量语义拖累。
- 作为消费返回的调用方，我希望批量创建失败时一次拿到全部错误（条目序号 + 字段 + 原因），以便一轮修完，不挤牙膏。

### 范围

**包含**：
- 新 MCP 工具 `task_create_many`（不改造现有 task_create）
- 批内 key 临时键与 depends_on 解析（批内 key 优先、真 T-xxx 兼容）
- 原子性：整批校验（validates 锚点、depends_on、parent、必填字段）全过才落盘
- 压缩返回 + 单次 followup
- CLI 对等：`lrnev task create-many --from-file <tasks.json|->`

**不包含**：
- 单条 task_create 的任何行为变更
- dry_run / validate-only 模式（原子失败即校验，全错误列表返回，独立 dry_run 无增量价值）
- 部分成功模式（mode=partial）——只有 all-or-nothing 一种行为，不做成参数
- 标题重复检查等单条路径不存在的新校验（两条路径语义对等）
- 批量 update / 批量 claim（不在本 Spec）

## L2 详情

### 详细需求

#### F-01 批量创建入参与确定性编号
- 描述：`task_create_many` 接受 `scene`、`spec` 与 `tasks` 数组；每个元素支持与单条 task_create 相同的字段（title 必填，description / validates / acceptance / depends_on / parent 可选），另支持可选 `key`（批内临时键）。ID 按数组顺序以既有 max+1 规则连续分配（确定性，与逐条调用 task_create 的结果一致）。
- 验收：
  - WHEN 提交含 3 个元素的 tasks 数组且当前 spec 最大任务号为 T-004 THEN 创建 T-005、T-006、T-007，顺序与数组一致。
  - WHEN tasks 数组为空 THEN 报 INVALID_INPUT，不落盘。
  - WHEN 逐条 task_create 与一次 task_create_many 提交相同内容 THEN 落盘的 tasks.md 内容等价。

#### F-02 批内 key 依赖引用
- 描述：元素可声明 `key`（批内唯一临时键）；同批其它元素的 `depends_on` 可引用该 key，落盘时解析为实际分配的 T-xxx。解析顺序：先匹配批内 key，再匹配已存在的真实 T-xxx。key 不得匹配 `T-\d+` 格式（防歧义），批内 key 不得重复。
- 验收：
  - WHEN 元素 B 的 depends_on 含元素 A 的 key THEN 落盘后 B 的 depends_on 为 A 实际分配的 T-xxx。
  - WHEN key 格式匹配 T-\d+ THEN 整批报 INVALID_INPUT。
  - WHEN 批内两个元素声明相同 key THEN 整批报 INVALID_INPUT。
  - WHEN depends_on 引用既不是批内 key 也不是已存在的 T-xxx THEN 整批报 TASK_NOT_FOUND（与单条口径一致）。
  - WHEN depends_on 引用同批任意位置的 key（含声明在后的元素） THEN 正常解析（批内引用不限方向）。

#### F-03 原子性与全量错误返回
- 描述：所有条目的校验（validates 的 F-xx/D-xx 存在性、depends_on/parent 存在性、必填字段、key 规则）先全部执行完，任一失败则整批不落盘，一次性返回全部错误；每条错误含条目序号（index）、字段（field）、原因（message）。校验规则与单条 task_create 逐项一致（如 ANCHOR_NOT_FOUND、TASK_NOT_FOUND 等既有错误码），不新增单条路径没有的校验。
- 验收：
  - WHEN 第 2 条 validates 引用不存在锚点且第 5 条 depends_on 引用不存在任务 THEN 返回同时包含两条错误（各带 index/field/message），且 tasks.md 无任何变更。
  - WHEN 全部条目校验通过 THEN 一次写入全部任务。
  - WHEN 校验失败 THEN 不产生任何 ID 占用（下次创建仍从原 max+1 开始）。

#### F-04 压缩返回与单次 followup
- 描述：成功返回只含创建摘要 `created: [{id, title}]`（不逐条展开完整任务与 followup）；ai_followup 只出现一次，内容为下一步指引（如"从第一个无依赖任务开始 task_update(in_progress)"）。
- 验收：
  - WHEN 成功创建 N 条 THEN 返回 data.created 长度为 N 且 ai_followup 只有一份。
  - WHEN 与逐条调用 task_create N 次对比 THEN 返回体总量显著更小（不含 N 份重复 followup）。

#### F-05 CLI 对等
- 描述：新增 `lrnev task create-many --scene <s> --spec <sp> --from-file <path>`，`--from-file -` 表示读 stdin；文件内容为 JSON（结构与 MCP 入参的 tasks 数组同构）。输出走统一 `{ok, data, ai_followup}` 包装，错误结构与 MCP 一致。
- 验收：
  - WHEN 同一份 tasks JSON 分别经 CLI 与 MCP 提交 THEN 落盘结果与返回结构同构。
  - WHEN --from-file 指向不存在文件或非法 JSON THEN 报结构化 INVALID_INPUT。

### 非功能性需求

- 性能：批量与逐条的总 IO 相当或更少（tasks.md 一次读写 vs N 次）；无新依赖，零模型。
- 兼容性：不改动既有 task_create / task_update / tasks.md 格式；MCP 工具数 +1（41→42），schema 描述需自包含（弱模型可用）。

### 边界与依赖

- 复用 TaskManager 的既有校验与写入基础设施（锚点池 extractAnchorPool、depends_on/parent 校验、ID 分配、tasks.md 序列化）。
- 与工具瘦身（战略第四步）的关系：届时按场景分组暴露统一处理，本 Spec 不做预防性设计。
- 不依赖其他 Spec。

### 验收标准

<!-- 最初的失败信号：真实会话连续 10 次 task_create，每次完整 followup，交互与 token 成本高（GPT-5.5 使用反馈，2026-07-06） -->
- [x] 10 条任务（含批内 key 依赖 + validates 锚点）一次调用创建成功，tasks.md 与逐条创建等价。
- [x] 混入 2 处坏引用时整批拒绝、两条错误一次返回、文件零变更。
- [x] CLI --from-file 与 MCP 提交同构等价。
- [x] 单条 task_create 既有测试全部不受影响，全量套件全绿。
