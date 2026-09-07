---
title: E2E Evidence Index - lrnev Capability Matrix
version: v1.0
status: stable
scene: 04-ai-guidance-standardization
spec: 06-00-guidance-documentation
created: 2026-09-02
---

# 06-00 E2E Evidence Index

## 1. 文档状态与适用范围

本文档是 lrnev-govern MCP 服务端 client/model/version capability 的唯一证据索引。它引用 04-00 采集的运行时证据，说明哪些决策场景已验证、哪些客户端/模型已测试、覆盖率如何计算，以及如何引用证据。

**版本状态**: v1.0，2026-09-02 发布  
**适用对象**: 客户端适配者、服务端维护者、测试团队  
**依赖规范**: 04-00 Agent E2E Observability、证据引用契约（F-06）

## 2. 证据引用契约（F-06）

### 2.1 核心原则

**04 是 client/model/version 运行时 capability 的唯一证据源**。

**只引用 run_id/evidence_path**:
- ✅ 引用: `run_id`, `evidence_path`, `git_sha`, `stage`, `scenario_id`
- ✅ 引用: 结论性字段（`action_taken`, `action_success`, `content_hash`）
- ❌ 禁止: 复制原始日志、改写观察、伪造证据

**证据引用格式**:
```markdown
**证据**: `dev-docs/ai-guidance-standardization/evidence/b2b-evidence-manifest.json`
- run_id: `run-1788328994399-wp5en8l`
- scenario_id: `E-01`
- action_taken: `spec_create`
- action_success: `true`
- git_sha: `408294d`
```

### 2.2 静态声明 vs 运行时观察 vs Profile 适配

| 类型 | 定义 | 来源 | 示例 |
|------|------|------|------|
| **静态声明** | 服务端提供的能力声明 | 02-00 Guidance Surface Inventory | 346 个 guidance surfaces |
| **运行时观察** | 实际消费和行为证据 | 04-00 E2E Observability | 12 个决策场景证据 |
| **Profile 适配结论** | 客户端对 Profile 的适配情况 | 05-00 Profile (计划) | Claude Code v1 适配完成 |

**本文档职责**: 索引运行时观察证据，不复制静态声明或伪造 Profile 适配结论。

## 3. 四阶段证据索引

### 3.1 阶段概览

| 阶段 | git_sha | 证据数 | 生成时间 | 关键里程碑 | 证据文件 |
|------|---------|--------|----------|-----------|----------|
| **B0-s** | 45a86e15 | 12 | 2026-09-01 | 摘录基线（结构事实判定） | `../evidence/b0-evidence-manifest.json` |
| **B1** | 45a86e15 | 12 | 2026-09-01 | text_v1 迁移生效 | `../evidence/b1-evidence-manifest.json` |
| **B2a** | 131e6f3 | 12 | 2026-09-01 | M1 完成（结构化传输 + legacy JSON） | `../evidence/b2a-evidence-manifest.json` |
| **B2b** | 408294d | 12 | 2026-09-02 | M2 完成（42/42 MVC 渲染器） | `../evidence/b2b-evidence-manifest.json` |
| **B3**（真机对照） | 918581e | 20（claude 15 + opencode 5 sessions） | 2026-09-04 | T-027 真实客户端对照（sha-c；G1-G4 + 05-00 Profile + 输出契约根治 + 归一判定）：claude E-02/E-06a/E-06b + opencode E-02 | `tests/e2e/t027-baseline/.evidences/`（真机录制件，非 manifest） |
| **B4**（真机复测） | 2b3c8fa | 20（claude 15 + opencode 5 sessions） | 2026-09-07 | T-027 发布内容快照复测（sha-d；G1 措辞修订 9c1c640 + G5 归档边界 d9dfb9a + L7 --profile 4cce0b5 + P5 E-06 harness 70f4980 + schema 2.0.2）：claude E-02/E-06a/E-06b（E-06b 真实续接）+ opencode E-02 | `tests/e2e/t027-baseline/.evidences/`（真机录制件，非 manifest） |

**说明**:
- B0-s/B1/B2a：结构基线（-s 后缀），fixture 驱动，无真实 LLM/客户端参与
- B2b：M2 后真实证据，基于 schema 修复（69b3da0）和生成器修正（052ba74）
- B0~B2b 覆盖相同 12 个场景（E-01 ~ E-11 + E-06a/E-06b）
- **B3/B4**：T-027 真实客户端对照（判定口径 PASS/5，不并入 B0-B2b 结构等价性编号），覆盖 E-02/E-06a/E-06b × claude/opencode；证据以录制件存 `tests/e2e/t027-baseline/.evidences/`（361 tracked，sha_label=sha-c/sha-d，证据契约 2.0.1/2.0.2）；PASS 判定引用 `04-00-final-observation-report.md` 的"B3/B4 补充观测"节

### 3.2 B0-s（摘录基线）

**证据文件**: `dev-docs/ai-guidance-standardization/evidence/b0-evidence-manifest.json`

**关键特征**:
- content_hash: `71d1a6be9d5d926ec2120f84ede0968be5eca75e93978866b53e5729735aac85`
- 摘录文本（fixture.aiGuidance.text）
- 结构事实判定（EvidenceCollector 基于 fixture 结构、工具序列、状态机规则）
- C 类字段（consumed_at/trigger_context/prompt_id）为权宜推断值
- client_version/model_version 为 null（需 05-00 Profile 阶段回传）

**代表性场景**:
- E-01: 明确新建 Spec → `action_taken: spec_create`, `action_success: true`
- E-08: 状态机保护 → `action_taken: spec_update`, `action_success: false`, `failure_category: state_machine_validation`

**引用示例**:
```markdown
**B0-s 基线**（E-01 明确新建 Spec）:
- run_id: `run-1788244394236-9prccvg`
- surface_id: `server_instructions:global:workflow_overview`
- content_hash: `71d1a6be9d5d926ec2120f84ede0968be5eca75e93978866b53e5729735aac85`
- decision_context: `{ strength: "explicit", direction: "new_spec", target_ref: "user-login" }`
- action_taken: `spec_create`
- action_success: `true`
```

### 3.3 B1（text_v1 迁移生效）

**证据文件**: `dev-docs/ai-guidance-standardization/evidence/b1-evidence-manifest.json`

**关键特征**:
- content_hash: `e8d4bd509f511469cc8bb0582d2b224b12405604755849dc52dfa701e6e2dc86`（变化）
- text_v1 引入（移除黑名单词汇、修正伪约束）
- 08-00 迁移后完整文本
- 行为与 B0 完全等价（12/12 action_taken 一致）

**内容演变**:
- B0 → B1: content_hash 变化（71d1a6be → e8d4bd50）
- 原因: 08-00 text_v1 引入，surface_id `server_instructions:global:workflow_overview` 内容更新

**引用示例**:
```markdown
**B1 text_v1 迁移**（E-01 明确新建 Spec）:
- run_id: `run-1788252994556-fea4oc7`
- surface_id: `server_instructions:global:workflow_overview`
- content_hash: `e8d4bd509f511469cc8bb0582d2b224b12405604755849dc52dfa701e6e2dc86`（新）
- content_hash_legacy: `71d1a6be9d5d926ec2120f84ede0968be5eca75e93978866b53e5729735aac85`（旧）
- action_taken: `spec_create`（与 B0 一致）
- action_success: `true`
```

### 3.4 B2a（M1 结构化传输）

**证据文件**: `dev-docs/ai-guidance-standardization/evidence/b2a-evidence-manifest.json`

**关键特征**:
- content_hash: `e8d4bd509f511469cc8bb0582d2b224b12405604755849dc52dfa701e6e2dc86`（与 B1 一致）
- 新增 `structured_content_present: true` 和 `content_channel: "legacy"`
- M1 完成（51 个工具接入 structuredContent）
- content 保持 legacy JSON 不变（向后兼容）

**内容演变**:
- B1 → B2a: content_hash 保持（e8d4bd50 → e8d4bd50）
- 原因: M1 只增加结构化传输层，legacy JSON renderer 保持 content 文本不变

**引用示例**:
```markdown
**B2a M1 结构化传输**（E-01 明确新建 Spec）:
- run_id: `run-1788256080208-30fh7sr`
- surface_id: `server_instructions:global:workflow_overview`
- content_hash: `e8d4bd509f511469cc8bb0582d2b224b12405604755849dc52dfa701e6e2dc86`（与 B1 一致）
- structured_content_present: `true`（新增）
- content_channel: `"legacy"`（新增）
- action_taken: `spec_create`（与 B0/B1 一致）
- action_success: `true`
```

### 3.5 B2b（M2 MVC 渲染器）

**证据文件**: `dev-docs/ai-guidance-standardization/evidence/b2b-evidence-manifest.json`

**关键特征**:
- content_hash: `e8d4bd509f511469cc8bb0582d2b224b12405604755849dc52dfa701e6e2dc86`（与 B1/B2a 一致，修正后）
- M2 完成（42/42 MVC 渲染器）
- content 从 legacy JSON 切换到 MVC 文本视图
- structuredContent 保持不变
- 基于 schema 修复（69b3da0）和生成器修正（052ba74）

**内容演变**:
- B2a → B2b: content_hash 保持（e8d4bd50 → e8d4bd50，修正后）
- 原因: MVC 渲染器只改渲染通道（text 视图），未改源文本

**生成器修正记录**:
- 初次发现: B2b hash 回归 B0（71d1a6be），非预期
- 根因: `scripts/run-b0-baseline.mts` L98/L135 只有 B1/B2a 加载 v3，B2b 不在分支中
- 修正: 提交 052ba74，将 B2b 加入 v3 分支条件
- 验证: B2b 重生成，hash 修正为 e8d4bd50（与 B1/B2a 一致）

**引用示例**:
```markdown
**B2b M2 MVC 渲染器**（E-01 明确新建 Spec）:
- run_id: `run-1788328994399-wp5en8l`
- surface_id: `server_instructions:global:workflow_overview`
- content_hash: `e8d4bd509f511469cc8bb0582d2b224b12405604755849dc52dfa701e6e2dc86`（与 B1/B2a 一致）
- git_sha: `408294df3e27cf1a904935519e891d54af1efd72`
- decision_context: `{ strength: "explicit", direction: "new_spec", target_ref: "user-login" }`
- action_taken: `spec_create`（与 B0/B1/B2a 一致）
- action_success: `true`
```

## 4. 12 个决策场景覆盖说明（F-05）

### 4.1 场景清单

| 场景 ID | 描述 | 预期行为 | 四阶段一致性 | severity |
|---------|------|----------|-------------|----------|
| **E-01** | 建议复用 + 明确新建 | spec_create | ✅ | high |
| **E-02** | 建议新建 + 明确复用 | task_create | ✅ | high |
| **E-03** | 低风险场景未指定 | spec_get | ✅ | medium |
| **E-04** | 高成本场景未指定 | assess_goal | ✅ | medium |
| **E-05** | 偏好新建后确认 | spec_create | ✅ | medium |
| **E-06a** | 用户改变主意（提议时） | task_create | ✅ | high |
| **E-06b** | 用户改变主意（执行后） | task_create | ✅ | high |
| **E-07** | 明确不建 Spec | null | ✅ | high |
| **E-08** | 状态机保护 | spec_update (失败) | ✅ | high |
| **E-09** | 伪约束（非真实限制） | spec_get | ✅ | medium |
| **E-10** | new_scene 协议 | scene_create | ✅ | low |
| **E-11** | other 协议 | null | ✅ | low |

**注**: E-07/E-11 的 `action_taken=null` 为预期行为（不采取工具调用）

### 4.2 场景详情

#### E-01: 明确用户请求优先于推荐

**场景描述**: 已有相近 Spec A，服务端给出"在 A 下建 Task"的 RECOMMENDATION；用户明确要求"新建 Spec B"。

**验证内容**:
- decision_context: `{ strength: "explicit", direction: "new_spec", target_ref: "user-login" }`
- allowed_tools: `["spec_create", "spec_list", "spec_get"]`
- forbidden_tools: `["task_create"]`
- action_taken: `spec_create`
- action_success: `true`

**证据引用**（B2b）:
- run_id: `run-1788328994399-wp5en8l`
- fixture_hash: `b936841e9d623f041acfec50cb2355a5d0117fcd956f45e87327c63269ce94d1`
- user_decision_override: `true`

#### E-02: 建议新建 + 明确复用

**场景描述**: 服务端建议新建 Spec，但用户明确要求"在登录 Spec 里补充"。

**验证内容**:
- decision_context: `{ strength: "explicit", direction: "reuse_spec", target_ref: "scene=01-user-management, spec=01-00-user-login" }`
- allowed_tools: `["task_create", "spec_get"]`
- forbidden_tools: `["spec_create"]`
- action_taken: `task_create`
- action_success: `true`

**证据引用**（B2b）:
- run_id: `run-1788328994531-vb00wuv`
- fixture_hash: `df13132b404b0d1e79ce55c2cddb52a1ab8ce6b6bc9dbcbfb99e0179b72dd510`
- user_decision_override: `true`

#### E-03: 未指定方向

**场景描述**: 用户仅表达"做用户登录功能"，未说明应复用还是创建。

**验证内容**:
- decision_context: `{ strength: "unspecified", direction: null }`
- allowed_tools: `["spec_get", "spec_list", "task_create"]`
- forbidden_tools: `[]`
- action_taken: `spec_get`
- action_success: `true`

**证据引用**（B2b）:
- run_id: `run-1788328994651-tbg15k4`
- fixture_hash: `af795a7aaecefba0331e912ddbe522c774f04c9d29396009e5671d4382af067a`
- user_decision_override: `false`

#### E-04: 高成本场景未指定

**场景描述**: 用户目标模糊且成本高（"我想做一个支付模块，支持微信、支付宝、银行卡"）。

**验证内容**:
- decision_context: `{ strength: "unspecified", direction: null }`
- allowed_tools: `["spec_list", "scene_list", "assess_goal"]`
- forbidden_tools: `["spec_create", "scene_create"]`
- action_taken: `assess_goal`
- action_success: `true`

**证据引用**（B2b）:
- run_id: `run-1788328994770-jne54c1`
- fixture_hash: `a2b6d2e95f4f6498ed7fdd7da2b52e70556181ea453a95a3ba4af9db8755666d`
- user_decision_override: `false`

#### E-05: 偏好新建后确认

**场景描述**: 用户先表达倾向"我倾向独立做用户登录，但你可以说明利弊"（preferred），后确认"好，叫 user-login"（explicit）。

**验证内容**:
- decision_context: `{ strength: "explicit", direction: "new_spec", target_ref: "user-login" }`
- allowed_tools: `["spec_create", "spec_list"]`
- forbidden_tools: `[]`
- action_taken: `spec_create`
- action_success: `true`

**证据引用**（B2b）:
- run_id: `run-1788328994885-u6j1pya`
- fixture_hash: `22d42104873a021a446f1c43ec0c130bab8244f8191705466093e4cf7ccf2aa2`
- user_decision_override: `true`
- trigger_context: `第1轮："我倾向独立做用户登录，但你可以说明利弊"（preferred+new_spec）\n第3轮："好，叫 user-login"（确认 explicit+new_spec）`

#### E-06a: 用户改变主意（提议时）

**场景描述**: 用户先"开新 Spec 做用户登录"（explicit+new_spec），随后在工具调用前改变主意"等等，算了，还是在登录 Spec 里补充"（explicit+reuse_spec）。

**验证内容**:
- decision_context: `{ strength: "explicit", direction: "reuse_spec", target_ref: "scene=01-user-management, spec=01-00-user-login" }`
- allowed_tools: `["task_create", "spec_get"]`
- forbidden_tools: `["spec_create"]`
- action_taken: `task_create`
- action_success: `true`

**证据引用**（B2b）:
- run_id: `run-1788328995003-gdc631d`
- fixture_hash: `2e8cc9c4a834a254273a80c3407bc92ec154cdb379bb5fd56a6445b3fe7db884`
- user_decision_override: `true`

#### E-06b: 用户改变主意（执行后）

**场景描述**: 用户先"开新 Spec 做用户登录"（explicit+new_spec），AI 已执行 spec_create，用户后悔"算了，还是在登录 Spec 里补充"（explicit+reuse_spec）。

**验证内容**:
- decision_context: `{ strength: "explicit", direction: "reuse_spec", target_ref: "scene=01-user-management, spec=01-00-user-login" }`
- allowed_tools: `["task_create", "spec_get", "spec_list"]`
- forbidden_tools: `[]`
- action_taken: `task_create`
- action_success: `true`

**证据引用**（B2b）:
- run_id: `run-1788328995120-dne51af`
- fixture_hash: `66f1f6180261e7de182c475b893261aa4d001b6c4b85322dcbcb974a9e3ac542`
- user_decision_override: `true`

#### E-07: 明确不建 Spec

**场景描述**: 用户明确"不用开 Spec，直接回答问题：lrnev 的 Scene 是什么？"

**验证内容**:
- decision_context: `{ strength: "explicit", direction: "no_spec" }`
- allowed_tools: `[]`
- forbidden_tools: `["spec_create", "scene_create", "task_create"]`
- action_taken: `null`（预期：不调用工具）
- action_success: `true`

**证据引用**（B2b）:
- run_id: `run-1788328995305-0fpl6kd`
- fixture_hash: `a1dbbf33bc9201a6ceb47517aacb5ef57e3ebf6b712c87778d7b21eec70a0cd7`
- user_decision_override: `true`
- tool_sequence: `[]`

#### E-08: 状态机保护

**场景描述**: 用户要求"把已归档的 Spec 01-login 改为 in-progress"（违反状态机规则）。

**验证内容**:
- decision_context: `null`（spec_update 不传 decision_context）
- allowed_tools: `["spec_update", "spec_get"]`
- forbidden_tools: `[]`
- action_taken: `spec_update`
- action_success: `false`（预期失败）
- failure_category: `"state_machine_validation"`

**证据引用**（B2b）:
- run_id: `run-1788328995477-zbfzmiw`
- fixture_hash: `852bc0d57aa646302c42d3dbeb11679e38c352e7c815265a7e0c532a38146239`
- surface_id: `tool_metadata:spec_update:description`（不同于其他场景）
- user_decision_override: `false`

#### E-09: 伪约束（非真实限制）

**场景描述**: 用户"继续做登录功能"，上下文显示 Spec 已 completed 且很久未更新（staleness_signals）。

**验证内容**:
- decision_context: `{ strength: "unspecified", direction: null, staleness_signals: ["long time since update", "status=completed"] }`
- allowed_tools: `["spec_get", "spec_list", "context_search"]`
- forbidden_tools: `[]`
- action_taken: `spec_get`
- action_success: `true`

**证据引用**（B2b）:
- run_id: `run-1788328995687-z917s8z`
- fixture_hash: `8d69d07a8b5d1aadc50d40231a556509501bac2a0b84833b8d20f5ae736a4e29`
- user_decision_override: `false`

#### E-10: new_scene 协议

**场景描述**: 用户明确"开新 Scene 做权限管理"。

**验证内容**:
- decision_context: `{ strength: "explicit", direction: "new_scene", target_ref: "permission-management" }`
- allowed_tools: `["scene_create"]`
- forbidden_tools: `[]`
- action_taken: `scene_create`
- action_success: `true`

**证据引用**（B2b）:
- run_id: `run-1788328995872-67d950e`
- fixture_hash: `1c7739ba293e725178d28eb969af1c9f1d74aa4fe1a21cbbebd5ae5532485446`
- user_decision_override: `false`
- severity: `low`

#### E-11: other 协议

**场景描述**: 用户明确"不用开 Spec/Scene，直接回答问题：lrnev 的 Scene 是什么？"（与 E-07 类似但 direction 不同）。

**验证内容**:
- decision_context: `{ strength: "explicit", direction: "other" }`
- allowed_tools: `[]`
- forbidden_tools: `["spec_create", "scene_create"]`
- action_taken: `null`（预期：不调用工具）
- action_success: `true`

**证据引用**（B2b）:
- run_id: `run-1788328995995-pmbsgu6`
- fixture_hash: `05dfec6bf84dd9e5bd35ffc5b98f84292dfe85ce495d96bb130801f6c053b93b`
- user_decision_override: `false`
- severity: `low`

## 5. 核心 surfaces 消费率

### 5.1 消费覆盖统计

**基线**: 02-00 guidance-surface-inventory-v2（346 surfaces）

**主要消费 surface**:
- `server_instructions:global:workflow_overview`（工作流程概览）
- 消费场景: 11/12（除 E-08 外，E-08 消费 `tool_metadata:spec_update:description`）
- 消费率: **91.7%**（11/12）

**四阶段消费率趋势**:
- B0-s: 91.7%（11/12）
- B1: 91.7%（11/12）
- B2a: 91.7%（11/12）
- B2b: 91.7%（11/12）
- **结论**: 四阶段消费率稳定 ✅

### 5.2 未覆盖 surfaces

**观察**: 本测试套件（E-01 ~ E-11）只覆盖"建议新建/复用 Spec"决策场景，未覆盖其他 guidance surfaces（如工具元数据、错误提示、Gate 检查等）。

**说明**: 04-00 的职责是观测 client/model 运行时消费行为，不负责覆盖所有 surfaces。完整覆盖由 05-00（Profile）和 06-00（实施）完成。

### 5.3 高频 surfaces 引用

**E-01 场景（代表性）**:
```markdown
**B2b 证据**:
- surface_id: `server_instructions:global:workflow_overview`
- consumed_at: `2026-09-02T06:03:14.531Z`
- consumer_type: `model`
- trigger_context: `"开新 Spec 做用户登录功能"`
- content_hash: `e8d4bd509f511469cc8bb0582d2b224b12405604755849dc52dfa701e6e2dc86`
```

**E-08 场景（特殊）**:
```markdown
**B2b 证据**（状态机保护）:
- surface_id: `tool_metadata:spec_update:description`（不同于其他场景）
- consumed_at: `2026-09-02T06:03:15.687Z`
- consumer_type: `model`
- trigger_context: `"把已归档的 Spec 01-login 改为 in-progress"`
- content_hash: `5f7ed8dd9c59e29cd1586db46ce4f363e6e36731e20467fd2391a3ce94b7211f`（不同 hash）
```

## 6. 综合对比报告引用

### 6.1 报告清单

| 报告 | 路径 | 内容 | 状态 |
|------|------|------|------|
| **最终观测报告** | `dev-docs/ai-guidance-standardization/deliverables/04-00-final-observation-report.md` | B0-B2b 全链证据总览、等价性验证、消费率分析 | 完成 |
| **五阶段综合对比报告** | `../../archive/04-00-五阶段综合对比报告.md` | content_hash 演变链、行为保持验证、生成器修正记录 | 完成 |

### 6.2 关键结论

**行为等价性** ✅:
- 12/12 场景 `action_taken` 四阶段一致
- 11/12 场景 `action_success = true`（E-08 预期失败）
- 无回归、无意外行为变化

**内容演变** ✅:
- B0 → B1: content_hash 变化（text_v1 迁移）
- B1 → B2a: content_hash 保持（M1 未改 content）
- B2a → B2b: content_hash 保持（M2 只改渲染通道）

**消费稳定性** ✅:
- 四阶段消费率稳定 91.7%

**经验固化** 🎯:
- 五阶段对比成功暴露生成器 B2b 分支缺失 bug
- 修正后证据完整性得到保障
- 这正是测试/对比应该做的事：发现隐藏问题

### 6.3 引用示例

```markdown
**证据来源**: 04-00 最终观测报告
- 报告路径: `dev-docs/ai-guidance-standardization/deliverables/04-00-final-observation-report.md`
- 结论: 12/12 场景行为完全保持，四阶段等价性验证通过
- 消费率: 91.7%（11/12 场景消费 workflow_overview）
- 证据文件: `dev-docs/ai-guidance-standardization/evidence/{b0,b1,b2a,b2b}-evidence-manifest.json`
```

## 7. Capability 矩阵（F-05）

### 7.1 决策场景能力矩阵

| 场景 | 能力描述 | 验证客户端 | 验证模型 | 证据阶段 |
|------|----------|-----------|----------|----------|
| E-01 | 明确请求优先于推荐 | fixture-driven | fixture-driven | B0/B1/B2a/B2b |
| E-02 | 明确复用覆盖建议 | fixture-driven | fixture-driven | B0/B1/B2a/B2b |
| E-03 | 低风险未指定可选择 | fixture-driven | fixture-driven | B0/B1/B2a/B2b |
| E-04 | 高成本未指定需评估 | fixture-driven | fixture-driven | B0/B1/B2a/B2b |
| E-05 | 偏好后确认可执行 | fixture-driven | fixture-driven | B0/B1/B2a/B2b |
| E-06a | 改变主意（提议时） | fixture-driven | fixture-driven | B0/B1/B2a/B2b |
| E-06b | 改变主意（执行后） | fixture-driven | fixture-driven | B0/B1/B2a/B2b |
| E-07 | 明确不建 Spec | fixture-driven | fixture-driven | B0/B1/B2a/B2b |
| E-08 | 状态机保护生效 | fixture-driven | fixture-driven | B0/B1/B2a/B2b |
| E-09 | 伪约束不阻断 | fixture-driven | fixture-driven | B0/B1/B2a/B2b |
| E-10 | new_scene 协议 | fixture-driven | fixture-driven | B0/B1/B2a/B2b |
| E-11 | other 协议 | fixture-driven | fixture-driven | B0/B1/B2a/B2b |
| E-02（真机 claude） | 明确复用覆盖建议（真实客户端，激励缺口实证） | claude | claude | B3（sha-c）0/5 → B4（sha-d）0/5（四 SHA 0/5 终确认 → 裁决 1.4，不阻塞发布） |
| E-02（真机 opencode） | 明确复用覆盖建议（真实客户端） | opencode | opencode | B3（sha-c）4/5 → B4（sha-d）5/5（0 个 -32602） |
| E-06a（真机 claude） | 改变主意（提议时） | claude | claude | B3（sha-c）1/5 → B4（sha-d）1/5（归档率 4/5→0/5，G5 生效） |
| E-06b（真机 claude） | 改变主意（执行后·真实续接） | claude | claude | B3（sha-c）5/5（split 伪 PASS）→ B4（sha-d）4/5（真实续接首测） |

**说明**:
- B0-B2b 阶段均为 fixture-driven，无真实 LLM/客户端参与（其 manifest 的 client_version/model_version 为 null，需真实客户端阶段回填）
- B3/B4 真机行由 T-027 于 2026-09-04/07 执行（claude/opencode × sha-c=918581e/sha-d=2b3c8fa）；PASS/5 判定引用 `04-00-final-observation-report.md` 的"B3/B4 补充观测"节（判定汇总存本机 ai-discussions；GitHub 证据见 tests/e2e/t027-baseline/.evidences/）
- B3/B4 真机录制件承载 client/model 真实标识（sha-d 起证据契约 2.0.2 带 sha_label）

### 7.2 客户端能力预期（05-00 Profile）

**主力客户端**（F-04 双客户端门禁）:
- **Claude Code**: 覆盖率 ≥1/5（≥2.4 个场景）
- **Codex**: 覆盖率 ≥1/5（≥2.4 个场景）
- **总计**: 至少 40% 覆盖率（2 × 1/5）

**能力要求**:
- 支持 decision_context 传递（4 个工具）
- 支持 structuredContent 消费
- 支持 isError 处理
- 支持用户原话保留

### 7.3 真机补充证据（B3/B4 阶段，T-027）——已完成

**B3/B4（真实客户端对照/复测）已由 T-027 完成**（2026-09-04 / 2026-09-07）：
- ✅ 真实客户端盲测（claude/opencode × sha-c=918581e / sha-d=2b3c8fa，每场景 ≥5 clean sessions）
- ✅ 建立真实客户端行为基线（B3 对照 + B4 发布内容快照复测，判定结果见 §3.1/§7.1 与 `04-00-final-observation-report.md`"B3/B4 补充观测"节）
- ✅ 证据契约 2.0.1/2.0.2 的 sha_label 落库：B3 录制件以 sha-c=918581e 为快照，B4 录制件以 sha-d=2b3c8fa 为快照
- 原计划的"发布前重跑受影响客户端核心场景" = B4（2026-09-07 执行完毕，见 §3.1）

## 8. 与其他文档的关系

| 文档 | 关系 | 边界 |
|------|------|------|
| **04-00 最终观测报告** | 本文档索引 04-00 证据 | 04-00 采集证据，本文档索引证据 |
| **04-00 五阶段综合对比报告** | 本文档引用对比结论 | 04-00 分析演变，本文档引用结论 |
| **02-00 Guidance Surface Inventory** | 本文档引用静态声明 | 02-00 声明能力，本文档索引消费 |
| **05-00 Profile (计划)** | 本文档提供运行时证据 | 本文档索引 B0-B2b，05-00 补充 B3 |
| **06-00 MCP Response Conformance** | 本文档验证传输能力 | Conformance 定义契约，本文档验证实施 |
| **06-00 Client Integration Guide** | 本文档验证集成能力 | Integration 定义集成，本文档验证效果 |

## 9. 更新与维护

### 9.1 版本更新触发

本文档需要更新的情况：
- 新增决策场景（E-12+）
- 新增阶段证据（B3+）
- 新增客户端/模型验证
- capability 矩阵变更

### 9.2 归属与责任

- **Owner**: 04-ai-guidance-standardization / 06-00-guidance-documentation
- **维护者**: lrnev 服务端团队 + 测试团队
- **审查周期**: 每次证据更新或 Profile 适配时

### 9.3 证据保留策略

**证据文件**:
- 保留所有阶段证据文件（b0/b1/b2a/b2b-evidence-manifest.json，位于 ../evidence/）
- **不存在 `b3-evidence-manifest.json`**——B3/B4 真机阶段证据（sha-c/sha-d）以录制件形式存 `tests/e2e/t027-baseline/.evidences/`（361 tracked，证据契约 2.0.1/2.0.2），不复制进 dev-docs 档案
- 不删除或覆盖历史证据
- 新阶段证据追加，不替换旧阶段

**报告文件**:
- 保留最终观测报告和综合对比报告
- 新报告追加版本号（如 04-00-final-observation-report-v2.md）
- 旧报告保留用于回溯和审计

---

**生成时间**: 2026-09-02  
**生成人**: Claude Opus 5  
**对应 Spec**: 04-ai-guidance-standardization / 06-00-guidance-documentation  
**状态**: stable
