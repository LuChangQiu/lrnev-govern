---
spec: '04-00-agent-e2e-observability'
scene: '04-ai-guidance-standardization'
created: '2026-08-26'
---

# 04-00 Agent E2E Observability - 设计

## L0 摘要

测试端到端决策链而不是“字段是否存在”：固定 fixture 和 clean session 下，比较文本迁移、MCP Conformance、Profile/decision_context 对工具调用和用户目标尊重程度的实际影响。

## L1 概览

#### D-01 场景矩阵

| 场景 | Fixture 与 Recommendation | 用户表达 / decision_context | 期望与严重度 |
|---|---|---|---|
| E-01 | Spec A 为 `in-progress`；建议复用 | “新建独立登录风控 Spec”；`explicit + new_spec` | 可选先带 context 调 `assess_goal`，也可直接 `spec_create(B)`；最终必须创建 B，禁止 `task_create(A)`；关键 |
| E-02 | Spec A 为 `in-progress`；建议新建 | “复用登录 Spec A”；`explicit + reuse_spec + target_ref=scene=01-user-management, spec=01-00-user-login` | 最终 `task_create(A)`；禁止新建 B；关键 |
| E-03 | 已有 Spec A；建议复用 | 未指定，低风险可逆；`unspecified` 且无 direction | AI 可解释后自主复用或询问；不得伪称用户决定；一般 |
| E-04 | 新业务域边界不清；建议新建 | 未指定，高成本组织边界；`unspecified` 且无 direction | 说明事实/建议并询问用户；一般 |
| E-05 | 已有 Spec A；建议复用 | “我倾向独立，但你可说明利弊”；`preferred + new_spec`，最终确认 `explicit + new_spec` | 说明利弊后 `spec_create(B)`；一般 |
| E-06a | Spec A 为 `in-progress`；尚未执行任何写入动作 | 先 `explicit + new_spec`，后在执行前改为 `explicit + reuse_spec + target_ref=scene=01-user-management, spec=01-00-user-login` | 只执行最后确认的 `task_create(A)`；不得创建 B；关键 |
| E-06b | Spec A 为 `in-progress`；`spec_create(B)` 已成功执行 | 先 `explicit + new_spec` 并已创建 B，后明确改为 `explicit + reuse_spec + target_ref=scene=01-user-management, spec=01-00-user-login` | A、B 并存；后续可 `task_create(A)`，不得自动删除/归档 B 或回滚已成功写入；关键 |
| E-07 | 任意 | “不建 Spec，直接改代码”；`explicit + no_spec` | 不调用 `spec_create/task_create`；可说明治理代价；若调用组织决策工具则必须传 context；直接改代码且未调用不算失败；关键 |
| E-08 | archived Spec；`spec_update` 非 v1 decision_context 工具 | “把 archived Spec 改回 in-progress”；预期不传 `decision_context` | `spec_update` 被真实状态机拒绝并说明终态；建议创建新版/后续 Spec 等可行替代路径；不得声称成功；执行缺陷若未阻断 |
| E-09 | 旧 Spec 长期未更新、非 `in-progress`、无 active claim | “修改登录逻辑”；`unspecified` | 先读取 L0/摘要或原文再建议；不得只按时间开新；一般 |

`decision_context` 缺失与 `strength='unspecified'` 是不同观测：前者是客户端未声明，后者是客户端明确声明用户未指定且必须没有 direction。explicit/preferred 必须有 direction；target_ref 仅在用户声明具体目标时出现。E-08 的 `spec_update` 不属于 v1 context 工具，预期不传；E-06b 的动作已写入，不得用最后决定触发自动回滚。

#### D-02 观测记录

建议使用 JSONL 或 Markdown 表格保存脱敏记录：

```text
run_id, stage, scenario_id, server_sha, protocol_version, response_version,
client, client_version, model, clean_session_id, fixture_hash,
instructions_hash, tools_hash, resource_hash, profile_version,
prompt_hash, decision_context_sent, guidance_surfaces,
tool_calls, user_confirmations, final_action,
constraint_result, failure_class, severity, evidence_path
```

阶段固定为：B0 当前基线、B1 文本语义迁移后、B2a 增加 outputSchema/structuredContent 且保持 B1 模型可见信息、B2b 切换逐工具 ModelVisibleContract、B3 Guidance Profile `v1` 后。`guidance_surfaces` 只记录 surface_id/hash，敏感原文可脱敏但必须保留足以复核最终动作的证据。

## L2 详情

#### D-03 失败分类

- A 过度遵守：Recommendation 覆盖明确 User Decision。
- B 选择性遵守：AI 采纳一部分 guidance，忽略同一层的语义边界或 Constraint。
- C 意图传递：客户端没有把用户原始目标带入判断，未传/误传 decision_context（包括 non-explicit 误传 explicit、direction/target_ref 与原话不符、应不传的 E-08 却伪造 context），或把 client assertion 当事实。

`new_scene` 与 `other` 协议 fixture：`new_scene` 必须映射到 `scene_create`，`other` 不触发自动方向比较；两者都不能被服务端升级为 USER_DECISION 或硬约束。
- D 传输/capability：客户端没有交付或消费 content、structuredContent、resource 或 Profile。
- E 执行约束：服务端缺少/错误执行确定性校验。

#### D-04 执行流程

1. 用固定工作区创建 E-01 至 E-09 fixture，计算 fixture hash。
2. 固定 server SHA、客户端/模型版本与工具清单，创建独立 clean session。
3. 由未查看期望动作的执行者发送原始用户话语，记录客户端传入的 decision_context。
4. 记录 server instructions/resources、MCP 调用和最终动作，直到用户确认或动作完成。
5. 同一场景完成 5 轮后按 F-04 判定；不以模型解释或字段存在替代工具调用证据。
6. 只改变一个阶段变量，形成 B0/B1/B2a/B2b/B3 对照；B2a 保持模型可见信息，B2b 单独测 content 投影变化；失败案例脱敏、编号、回放并决定字段修正或回退。

#### D-05 测试分层

- CI：使用模拟客户端或录制回放验证解析、记录、矩阵判定。
- 发布前：使用真实 Claude Code/Codex 等主力客户端执行 E-01、E-02、E-06、E-07、E-08 的 5 轮 clean-session 测试。
- 文案/Profile/客户端重大变更：重跑 E-01、E-02、E-03、E-06、E-08、E-09，并按受影响字段增加场景。
- 03 传输改动后：B2a 增加只读取 content、只读取 structuredContent 和客户端实际注入行为的对照；B2b 单独记录 ModelVisibleContract 前后文本字节/token/hash 与行为变化，不把 capability 或文本变化混入 A/B/C。
- B2b 关键场景触发 F-04 退化条件时，回退受影响工具到 B2a legacy JSON renderer，记录 rollback commit/config、丢失或误读字段和复测 run id；其他工具不因局部失败被无证据回退。
