---
spec: 01-00-auto-gc
scene: 03-workspace-hygiene
status: completed
priority: P1
created: '2026-07-06'
updated: '2026-07-06'
---

# 01-00 Auto Gc - 需求

## L0 摘要

在 agent register 时机会式清理已死 agent 记录与过期 claim 文件，并回写 status 真值，让运行态文件不再无界增长、不再对人说谎。

## L1 概览

### 目标

真实项目（xpaas-xmxxgl，约 3 周使用）实测：`agents/registry.json` 积累 64 条死进程记录（文件内全标 "active"）、`runtime/claims/` 积累 14 个全部过期的 claim 文件。清理机制 `doctor --gc-agents` 存在但没人会主动跑——与维护态缺口同构的"有门但找不到门"发现性问题。本 Spec 把清理搬到必然发生的动作（register）里自动完成：

1. registry.json 与 claims/ 不再无界增长，无需用户记得任何维护命令。
2. registry.json 落盘的 status 字段与真实存活状态收敛（消除"文件即真相"的谎言）。
3. 保持既有安全语义：dead 但持未过期 claim 的记录保留（接手线索）；跨主机记录有保留期防误清。

### 用户故事

- 作为多窗口使用 lrnev 的开发者，我希望死掉的 agent 记录和过期 claim 自动被清理，以便 agent_list / registry.json 反映真实状态，而不需要我记得跑 doctor --gc-agents。
- 作为直接打开 registry.json 查看的用户，我希望文件里的 status 字段可信，以便"文件即真相"的承诺成立。
- 作为跨主机协作的远端会话，我希望自己不会因为一段时间没续心跳就被别的窗口自动清掉，以便协作线索安全。

### 范围

**包含**：
- agent_register（MCP 连接自动注册与显式注册、CLI agent register）触发的机会式 GC
- 死 agent 记录清理（本机 pid 判死立即清；跨主机心跳判死过保留期才清；均要求名下无未过期 claim）
- 过期 claim 文件清理（过期超保留期且属主非 active）
- 存活条目 status 字段回写计算真值
- 配置项：auto_gc 开关（默认开）、gc_retention_days 跨主机保留期（默认 7）
- register 返回中附 GC 结果摘要（不进 followup instructions）

**不包含**：
- `doctor --gc-agents` 的行为变更（原样保留，语义不变：显式、判死即清、无保留期）
- agent_list / project_status 等只读路径的任何写副作用（v2.0 S5/I-12 决定不动摇）
- locks / hook-log / errorbook 的清理（hook-log 已有 rotate，locks 由 doctor 提示，不在本 Spec）
- registry 文件格式变更（不新增/删除字段，只回写既有 status 字段的值）

## L2 详情

### 详细需求

#### F-01 register 时机会式清理死 agent 记录
- 描述：agent 注册（含 MCP 连接自动注册）成功后，在同一注册锁内顺手清理可安全删除的死 agent 记录。清理判据双轨：本机记录（host 相同且 pid 合法）经 pid 探活判死即为确定性死亡，立即可清；跨主机记录（host 不同或 pid 非法）按 last_heartbeat 判死后还需超过保留期（gc_retention_days）才可清。两类都必须满足"名下无未过期 claim"（与 doctor --gc-agents 同口径），dead 但持未过期 claim 的保留。
- 验收：
  - WHEN 新会话 register 且 registry 中存在本机 pid 已死、名下无未过期 claim 的记录 THEN 该记录在本次 register 后从 registry.json 消失。
  - WHEN registry 中存在跨主机心跳判死、但 last_heartbeat 距今未超过 gc_retention_days 的记录 THEN 该记录保留。
  - WHEN registry 中存在跨主机心跳判死且 last_heartbeat 距今超过 gc_retention_days、名下无未过期 claim 的记录 THEN 该记录被清理。
  - WHEN 死 agent 名下仍有未过期 claim THEN 该 agent 记录与其 claim 均保留。
  - WHEN 记录判定为 active THEN 不被清理。

#### F-02 过期 claim 文件清理
- 描述：register 时同步清理"已过期且属主 agent 非 active"的 claim 文件。属主为本机死 agent 的过期 claim 立即清；属主为跨主机判死或未注册 agent 的过期 claim，过期时长超过保留期才清。未过期 claim 一律不动。
- 验收：
  - WHEN register 时存在属主为本机已死 agent 的过期 claim 文件 THEN 该文件被删除。
  - WHEN 过期 claim 属主未注册（registry 中无记录）且过期时长超过 gc_retention_days THEN 该文件被删除。
  - WHEN claim 未过期 THEN 无论属主状态如何，文件保留（属主判死时的接管仍走既有 isReclaimable 逻辑，不在 GC 删除范围）。

#### F-03 status 字段回写真值
- 描述：GC 扫描本来就持注册锁并写 registry.json，顺手把幸存条目的 status 字段回写为 computeAgentStatus 计算出的当前真值。不改字段结构（老版本 normalizeAgentInfo 要求 status 字段存在且合法，去掉字段会导致多版本共存时整条被判无效）。语义文档化：既有 heartbeat 路径也会无条件回写 status:'active'（活 agent 才会调心跳，该写入是真实的）——registry.json 的 status 定义为"最近一次写路径（register 清扫 / heartbeat / 注册）触达时的计算值"，实时状态仍以读时计算为准。
- 验收：
  - WHEN register 完成后打开 registry.json THEN 幸存条目的 status 与该时刻 computeAgentStatus 计算结果一致（如 dead 但持未过期 claim 的条目落盘 status 为 "dead"）。
  - WHEN 用旧版本 lrnev 读取新版本写出的 registry.json THEN 所有条目仍能被 normalizeAgentInfo 正常解析。

#### F-04 配置与开关
- 描述：config 新增 `agent.auto_gc`（布尔，默认 true）与 `agent.gc_retention_days`（正数，默认 7）。auto_gc 为 false 时 register 完全不做清理与回写（行为与 v2.2 一致）。doctor --gc-agents 不读这两个配置、行为不变。注意：既有 config 加载只对**类型不符**回退默认（deepMerge 口径），同类型非法值（如负数）会原样接受——本 Spec 需在 GC 实现处对 gc_retention_days 做防御（非正数/非有限数按默认 7 处理），这是新增防御而非既有口径。
- 验收：
  - WHEN 配置 auto_gc=false THEN register 后 registry.json 中死记录与过期 claim 原样保留、status 不回写。
  - WHEN 未配置任何新项 THEN 默认 auto_gc=true、gc_retention_days=7 生效。
  - WHEN 配置 gc_retention_days 为负数、0 或 NaN THEN GC 按默认 7 天保留期执行（实现处防御回退，不抛错）。

#### F-05 透明返回且不占 AI 注意力
- 描述：本次 register 实际清理了内容时，返回的 data 中附结构化摘要（如 `gc: { removed_agents, removed_claims }`）；什么都没清时不出现该字段。GC 结果不写入 ai_followup.instructions（不占 AI 注意力预算）。CLI 与 MCP 返回对等。
- 验收：
  - WHEN register 触发了实际清理 THEN 返回 data 含 gc 字段且计数准确；ai_followup.instructions 不包含 GC 相关文案。
  - WHEN register 未清理任何内容 THEN 返回 data 不含 gc 字段。
  - WHEN 通过 CLI agent register 触发同样场景 THEN JSON 输出与 MCP 返回同构。

#### F-06 GC 失败不影响注册主流程
- 描述：GC 是 best-effort 附带动作。清理过程中任何异常（单个 claim 文件损坏、删除失败等）不得导致 register 本身失败；跳过出错条目继续。
- 验收：
  - WHEN claims 目录中存在损坏 JSON 文件 THEN register 正常成功，损坏文件跳过（doctor 仍负责报告）。
  - WHEN 某文件删除失败（如被占用） THEN register 正常成功，该条目留待下次。

### 非功能性需求

- 性能：GC 为一次 registry 遍历 + 一次 claims 目录遍历，量级为几十条 JSON 小文件；register 额外耗时应无感（<50ms 量级）。不引入任何新依赖，零模型。
- 兼容性：registry.json / claim 文件格式不变；旧版本 lrnev 与新版本混跑同一工作区时读写互不破坏；响应契约只新增可选字段（gc），旧消费方忽略即可。

### 边界与依赖

- 依赖既有 `computeAgentStatus`（双轨判死）、`ClaimStore.listAll`、注册锁 `withRegistryLock`。注意：**不可复用** `unregisterAndReleaseClaims`——它内部再取 withRegistryLock，而目录锁不可重入，在 register 锁内调用会死锁重试后抛 LOCK_HELD_BY_OTHER；GC 需在锁内直接操作 registry map 并自行删 claim 文件。
- 与 v2.0 S5/I-12 决定的关系：该决定禁止的是"只读路径自动删"，register 是写路径，不冲突；doctor --gc-agents 作为显式入口原样共存。
- 不依赖其他 Spec。

### 验收标准

<!-- 最初的失败信号：xpaas-xmxxgl 项目 registry.json 积累 64 条死记录全标 active、claims/ 积累 14 个过期文件，无人跑过 doctor --gc-agents -->
- [x] 在积累了死 agent 记录与过期 claim 的工作区（如 xpaas-xmxxgl 现状复制件）上，新会话 register 一次后：本机死记录消失、过期 claim 清理、幸存条目 status 为真值、返回含 gc 摘要。
- [x] auto_gc=false 时行为与 v2.2 完全一致。
- [x] doctor --gc-agents 既有测试全部不受影响。
- [x] 全量测试套件保持全绿。
