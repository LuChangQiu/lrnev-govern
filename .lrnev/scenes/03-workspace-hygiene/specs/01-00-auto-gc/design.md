---
spec: '01-00-auto-gc'
scene: '03-workspace-hygiene'
created: '2026-07-06'
---

# 01-00 Auto Gc - 设计

## L0 摘要

在 AgentRegistry.register 的注册锁内追加一次 best-effort 清扫：复用 computeAgentStatus 双轨判死 + gc-agents 的"无未过期 claim"口径，本机死亡立即清、跨主机死亡过保留期清、幸存条目回写 status 真值，结果以可选 gc 字段随 register 返回。

## L1 概览

### 架构思路

- **清理搬到必然发生的写路径**：register 每个新会话必经、本来就持 `withRegistryLock`、本来就要写 registry.json——GC 的读写与锁成本近乎白嫖。不新增任何定时器/后台进程（保持 lrnev 无守护进程的形态）。
- **清理判据与死亡确定性对齐**：pid 探活是确定性信号（死了不会复活，重连拿新 agent_id），立即清；心跳是推断信号，加保留期缓冲。
- **只读路径零写副作用的决定（v2.0 S5/I-12）不动摇**：agent_list / project_status / diagnose 依旧不清理；doctor --gc-agents 原样保留为显式入口。
- **best-effort**：GC 任何异常不冒泡到 register 主流程。

### 主要模块

- `src/core/AgentRegistry.ts`：register 内追加 GC 调用；GC 实现放同文件或提取 `sweepRegistry` 私有方法。
- `src/core/ClaimStore.ts`：可能新增"列出过期 claim 并删除"的辅助方法（或复用 listAll + rm）。
- `src/shared/config.ts`：`agent.auto_gc` / `agent.gc_retention_days` 两个配置项与默认值。
- `src/mcp/tools/index.ts` / `src/cli/index.ts`：register 返回透传 gc 字段（CLI/MCP 对等）。

### 关键决策

| 决策 | 选项 | 倾向 | 是否产 ADR |
|---|---|---|---|
| 触发点 | register / 每次工具调用 / 定时器 | register（频率适中、已持锁、写路径） | 是（连同保留期语义一起记） |
| 本机死记录保留期 | 0（立即清）/ 统一 N 天 | 0——pid 判死是确定性死亡 | 同上 |
| status 谎言修复 | 删字段读时算 / 回写真值 | 回写——删字段会被旧版 normalizeAgentInfo 整条判无效 | 同上 |
| 默认开关 | 默认开 / opt-in | 默认开——"没人会去开配置"与"没人跑 gc"同病 | 同上 |

## L2 详情

### 模块详细设计

#### D-01 GC 扫描算法与锁语义

register 流程改为：注册新 agent 写入 registry 后（仍在 `withRegistryLock` 内），若 `auto_gc` 开启则执行清扫：

1. 读 claims：`ClaimStore.listAll()` 一次，构建 `claimOwnersWithUnexpired`（未过期 claim 属主集合，与 `Doctor.gcAgents` 同口径）。
2. 遍历 registry 条目（跳过刚注册的自己）：
   - `computeAgentStatus` 判定为 active → 保留，若落盘 status ≠ 计算值则回写（D-03）。
   - 判定为 dead 且属主在 `claimOwnersWithUnexpired` → 保留，status 回写为 "dead"。
   - 判定为 dead 且无未过期 claim：
     - 本机记录（host===hostname() 且 pid 合法）→ 立即删除条目，并删除其名下所有（必然已过期的）claim 文件。
     - 跨主机/pid 非法记录 → `now - last_heartbeat > gc_retention_days` 才删除，否则保留（status 回写 "dead"）。
3. 一次性写回 registry.json（与注册写合并为同一次保存：register 当前在锁内先建 map 再 saveRegistry，把 GC 清扫挪到 save 之前即可，避免双写）。

**禁止复用 `unregisterAndReleaseClaims`**：它内部再取 `withRegistryLock`，而 `FileStorage.withDirectoryLock` 是 mkdir 目录锁、不可重入——在 register 锁内调用会重试后抛 LOCK_HELD_BY_OTHER。GC 在锁内直接操作 registry map，claim 文件删除自行实现。

claim 文件删除的竞争根治：删除某 claim 前按其 `claimLockPath`（与 registry 锁不同命名空间，无死锁）取锁并重读判据，判据仍满足才删——消除"他人恰好接手生成新 claim"的 TOCTOU 窗口，而非仅靠重读缩小窗口。

#### D-02 过期 claim 的独立清扫

除死 agent 名下 claim 外，还存在属主已不在 registry 中的孤儿过期 claim（registry 曾被清理/手工编辑）。规则：

- 属主在 registry 且 active → 不删（即使过期，续租是属主的事）。
- 属主在 registry 且 dead → 随 D-01 的 agent 清理路径处理。
- 属主不在 registry（未注册/isAgentDead 返回 false 的向后兼容口径）→ 仅当 `now - expires_at > gc_retention_days` 才删（保守：未注册用法退回纯 TTL 语义，多留一个保留期）。

#### D-03 status 真值回写

- 只回写值、不增删字段：`AgentInfo.status` 结构不变，保证旧版 `normalizeAgentInfo`（要求 status 存在且为 'active'|'dead'）可解析。
- 回写时机仅在 GC 清扫内（register 路径）；只读路径（agent_list 等）依旧读时计算、不落盘。
- registry.json 的语义文档化：status 为"最近一次写路径（register 清扫 / heartbeat / 注册）触达时的计算值"——既有 heartbeat 路径本就无条件回写 'active'（活 agent 才调心跳，写入真实），与本回写语义一致；实时状态仍以读时计算为准。

#### D-04 配置项

`src/shared/config.ts` 的 agent 段新增：

```
agent: {
  ...,
  auto_gc: true,            // false 时 register 不做任何清扫与回写
  gc_retention_days: 7,     // 跨主机死亡记录 / 孤儿过期 claim 的保留期
}
```

既有 config 加载仅对类型不符回退默认（deepMerge），同类型非法值会原样透传——GC 实现处对 gc_retention_days 做防御：非正数/非有限数按默认 7 处理（新增防御，静默回退不抛错）。`Doctor.gcAgents` 不读取这两项。

#### D-05 返回契约与 CLI/MCP 对等

- register 现返回 `AiFollowupResponse<AgentInfo>`，而 **AgentInfo 同时是 registry.json 的落盘结构**——不能直接给 AgentInfo 加 gc 字段（会被写进 registry.json）。新建返回类型（如 `AgentRegisterResult = AgentInfo & { gc?: {...} }` 或独立 interface），register 返回改为 `AiFollowupResponse<AgentRegisterResult>`，落盘仍写纯 AgentInfo。
- `gc?: { removed_agents: number, removed_claims: number }`；两计数均为 0 时不出现该字段。
- `ai_followup.instructions` 不包含 GC 文案（不占注意力预算）。
- CLI `lrnev agent register --json` 直接 JSON 序列化响应（既有 format 路径），gc 字段自然同构透传。

### 数据模型

- registry.json：结构不变（Record<agent_id, AgentInfo>），仅条目增删与 status 值变化。
- claim 文件：结构不变，仅文件删除。
- 无新增文件、目录或持久化状态。

### 接口契约

- MCP `agent_register` / CLI `lrnev agent register`：入参不变；返回 data 新增可选 `gc` 字段。
- MCP 连接时的自动注册同样触发 GC（同一 register 代码路径）。
- `doctor --gc-agents` / `lrnev_doctor{gc_agents}`：完全不变。

### 错误处理

- GC 整体 try/catch 包裹：任何异常吞掉（可记入 debug 级日志），register 主流程照常返回成功——GC 失败的最坏结果是"这次没清干净"，下次 register 再清。
- 单个 claim 文件损坏（JSON 解析失败）：跳过该文件（不删——损坏文件的报告与处置归 doctor）。
- 删除失败（文件被占用等）：跳过，计数不含该条。

### 测试策略

- 单元（AgentRegistry / ClaimStore）：本机死立即清、跨主机保留期内不清/超期清、dead 持未过期 claim 保留、active 不动、status 回写值正确、跳过自己、孤儿过期 claim 超保留期清、损坏 claim 跳过、auto_gc=false 全关、gc 计数与字段出现条件。
- 集成：在临时工作区伪造 xpaas 式残留（死 pid 记录 + 过期 claim），register 一次后断言文件系统终态；旧版格式条目（status 字段在）可正常解析。
- CLI↔MCP 对等：同场景下 `lrnev agent register --json` 与 MCP 返回的 gc 字段同构。
- 回归：doctor --gc-agents 既有测试全部不动、全量套件全绿。
