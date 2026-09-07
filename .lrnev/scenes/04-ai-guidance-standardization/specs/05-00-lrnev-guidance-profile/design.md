---
spec: '05-00-lrnev-guidance-profile'
scene: '04-ai-guidance-standardization'
created: '2026-08-26'
---

# 05-00 lrnev Guidance Profile - 设计

## L0 摘要

把 lrnev Guidance Profile 设计成显式版本化、客户端可选适配的应用层协议：MCP 负责传输，Profile 实施最小结构化语义；04 决定字段是否保留或回退，而非决定是否建设 Profile。

## L1 概览

#### D-01 分层与逐字段门禁

```text
MCP Response Conformance（03，无语义门禁）
        -> 交付结构化 lrnev payload
Natural-language Semantic Model（01）
        -> 始终可用的文本角色
Agent E2E（04）
        -> 证明字段带来的改善或回退理由
lrnev Guidance Profile（05）
        -> 已决定实施的最小结构化语义，客户端显式适配
```

Profile `v1` 先实现最小角色结构。每个额外字段必须在 04 的前后对照中证明降低关键失败、改善客户端消费或提供必要可追溯性；否则删除该字段。06 始终发布基础语义和 Conformance 文档。

#### D-02 概念映射而非全字段 schema

Profile 以 01 的五种角色为基础。初始实现优先只结构化 `role + text`；只有存在明确歧义时才增加：

- `source_ref`：FACT 或 EXECUTION_CONSTRAINT 需要定位工作区/错误码时。
- `enforcement`：无法从 role 推出，且客户端确实需要区分 `client_boundary/server_enforced` 时。
- `profile_version`：所有 Profile payload 必须提供。

provenance × role × enforcement 保留为分析框架，不能因为模型完整就生成三列必填 schema。

## L2 详情

#### D-03 decision_context 请求边界

```typescript
type DecisionContext = {
  source: 'client_asserted';
  strength: 'explicit' | 'preferred' | 'unspecified';
  summary: string;
  direction?: 'new_scene' | 'new_spec' | 'reuse_spec' | 'no_spec' | 'other';
  target_ref?: string;
};
```

- v1 `decision_context` 只在 `assess_goal`、`scene_create`、`spec_create`、`task_create` 上作为可选输入；`spec_update`、`scene_get`、`spec_get` 等工具不传该字段。缺失表示客户端没有声明，不能等同 `unspecified`。
- `explicit/preferred` 必须提供 direction；`unspecified` 必须省略 direction。`other` 表示不在 v1 粗粒度枚举内，服务端不自动判断其方向。
- `target_ref` 只在用户/客户端声明具体 Scene/Spec 时提供，必须使用完整稳定引用，例如 `reuse_spec + scene=01-user-management, spec=01-00-user-login`；服务端可以做引用解析，但不能把声明升级为用户事实。
- 回退注记（T-006 裁决 2026-09-07，I6）：原 `reported_user_quote?: string`（客户端转述的用户原话，不可由服务端验证、不写入 Project Truth、不自动进入跨会话 memory）已回退移除——380 录制件 0 命中 + 设计零使用（服务端不解析/不持久化/不回显 quote 内容）；schema/类型/测试随本裁决同步删除，05-00 不再接收该输入字段。
- `assess_goal` 在写入前使用 context 组织建议；`scene_create/spec_create/task_create` 在写入后只用它避免返回自相矛盾的后续建议；`spec_update` 不参与 v1 context 对齐。
- 服务端只比较 direction 与当前工具类别：`new_scene→scene_create`、`new_spec→spec_create`、`reuse_spec→task_create`、`no_spec→不应调用落位工具`；`other` 不比较。target_ref 存在时再核对当前 scene/spec 参数。发现不一致返回 DECISION_BOUNDARY 对齐提示，但不解析 summary，也不以客户端声明阻断、重写或回滚用户请求。

#### D-04 服务端 guidance 输出边界

- 服务端可以输出 FACT、RECOMMENDATION、DECISION_BOUNDARY、EXECUTION_CONSTRAINT、ACTION_HINT（现以 ROLE_PREFIX 文本行 + 纯函数派生视图承载）。
- 服务端不得输出 USER_DECISION 或声称已看到用户原始对话。
- EXECUTION_CONSTRAINT 引用真实错误码/校验位置；Profile 不提供阻断实现。
- 回退注记（T-006 裁决 2026-09-07，O6）：payload.guidance 运行时挂载与 schema guidance 字段声明已回退，structuredContent 不再携带结构化数组；角色语义经文本通道交付（同源一致由纯函数链保证），结构化对象/schema 保留为契约库。

#### D-05 客户端 capability

- 02 只登记静态 capability 声明。
- 04 保存客户端运行时是否接收/消费 Profile 的证据。
- 05 根据 04 证据发布适配结论，不复制原始运行日志。
- 客户端不支持 Profile 时回退 01 文本；不得用更多字段反复诱导不支持的客户端。

#### D-06 一致性与降级

Profile 与文本由同一语义对象派生。未知 role 作为普通文本展示，不升级为 Constraint；Profile 解析失败不影响 03 的业务 data 和 `content` 文本呈现。若文本与 Profile 冲突，返回诊断并阻止发布该版本，而不是规定一个字段静默胜出。

#### D-07 E2E 验证

- 在触发门禁的原失败场景上做 Profile 前后对照，客户端/model/version/fixture 保持一致。
- 验证最终工具调用和用户目标，不只验证 messages 字段存在。
- 若客户端完全忽略 Profile，结论是 capability 不支持，不继续增加 schema 复杂度。
- Profile 未显著降低关键失败率时回退该实现，保留文本语义。

#### D-08 文档与发布

Profile 专属适配、能力声明和故障排查由本 Spec 输出；通用 MCP Conformance、基础文本角色和 E2E 方法由 06 汇总发布。所有结论引用 01/02/03/04 的权威产物。
