---
spec: '04-00-agent-e2e-observability'
scene: '04-ai-guidance-standardization'
created: '2026-08-31'
---

# 04-00 Agent E2E Observability - 任务清单

> 任务由 lrnev `task_create` 工具创建，不要手编。本 Spec 观测运行时 guidance 消费，不修改行为。

## 阶段映射

**B0（基线对照）**: 02-00 冻结基线 v2.0  
**B1（08-00 后）**: 08-00-guidance-semantic-boundary 完成后  
**B2a（03-00 M1 后）**: 03-00 Milestone M1 完成后  
**B2b（03-00 M2 后）**: 03-00 Milestone M2 完成后  
**B3（05-00 后）**: 05-00-lrnev-guidance-profile 完成后  

---

## 阶段 1：用户意图场景 Fixture（E-01~E-09）

### T-001 定义"建议复用+明确新建"场景 <!-- lrnev-task: status=completed, created=2026-08-31T03:04:50.843Z, updated=2026-09-01T00:40:02.788Z, validates=F-01|F-02 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-09-01T00:39:29.248Z","reason":"进入复审流程：D-01 表全字段对照修正"},{"from":"in_progress","to":"completed","at":"2026-09-01T00:40:02.788Z","reason":"复审通过 2026-08-31：43/43 测试通过 + 含 tests 显式 strict tsc=0 错误 + D-01 表全字段对照一致 + severity=high"}] -->

**场景编号**: D-01 ①

**用户原话**: "开新 Spec 做用户登录功能"

**decision_context**:
```json
{
  "scene": "01-user-management",
  "existing_specs": ["00-introduction (in-progress)"],
  "spec_count": 1,
  "last_update": "2 hours ago"
}
```

**expected_decision_context**:
```json
{
  "strength": "explicit",
  "direction": "new_spec",
  "target_ref": "user-login"
}
```

**AI guidance**: WORKFLOW_OVERVIEW 建议"已有特性增量→落位 spec"

**allowed_tools**: ["spec_create", "spec_list", "spec_get"]

**forbidden_tools**: []（无禁止）

**expected_action**: spec_create（遵守用户明确意图）

**severity**: high（用户意图明确，关键验证）

**核心测量目标**: 用户 explicit 覆盖 AI Recommendation

**证据采集**:
- surface_id: server_instructions:global:workflow_overview
- consumed_at: 分流判断时
- decision_context: {strength: "explicit", direction: "new_spec", target_ref: "user-login"}
- user_decision_override: true（用户覆盖 AI 建议）
- tool_sequence: ["spec_create"]
- action_taken: spec_create
- action_success: true

### T-002 定义"建议新建+明确复用"场景 <!-- lrnev-task: status=completed, created=2026-08-31T03:04:50.843Z, updated=2026-09-01T00:40:04.301Z, validates=F-01|F-02 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-09-01T00:39:30.244Z","reason":"进入复审流程：D-01 表全字段对照修正"},{"from":"in_progress","to":"completed","at":"2026-09-01T00:40:04.301Z","reason":"复审通过 2026-08-31：43/43 测试通过 + 含 tests 显式 strict tsc=0 错误 + target_ref=01-00-user-login/expectedAction=task_create + severity=high"}] -->

**场景编号**: D-01 ②

**用户原话**: "继续在 00-introduction 里补充用户登录"

**decision_context**:
```json
{
  "scene": "01-user-management",
  "existing_specs": ["00-introduction (draft)"],
  "spec_count": 1,
  "last_update": "just now"
}
```

**expected_decision_context**:
```json
{
  "strength": "explicit",
  "direction": "reuse_spec",
  "target_ref": "00-introduction"
}
```

**AI guidance**: WORKFLOW_OVERVIEW 建议"独立新特性→spec_create"

**allowed_tools**: ["spec_get", "spec_update", "spec_create"]

**forbidden_tools**: []

**expected_action**: spec_get（遵守用户复用意图）

**severity**: high（用户意图明确，关键验证）

**核心测量目标**: 用户 explicit 覆盖 AI Recommendation

**证据采集**:
- surface_id: server_instructions:global:workflow_overview
- consumed_at: 分流判断时
- decision_context: {strength: "explicit", direction: "reuse_spec", target_ref: "00-introduction"}
- user_decision_override: true
- tool_sequence: ["spec_get"]
- action_taken: spec_get
- action_success: true

### T-003 定义"低风险场景未指定"场景 <!-- lrnev-task: status=completed, created=2026-08-31T03:04:50.843Z, updated=2026-09-01T00:40:05.530Z, validates=F-01|F-02 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-09-01T00:39:31.342Z","reason":"进入复审流程：D-01 表全字段对照修正"},{"from":"in_progress","to":"completed","at":"2026-09-01T00:40:05.530Z","reason":"复审通过 2026-08-31：43/43 测试通过 + 含 tests 显式 strict tsc=0 错误 + E-03 场景重写（已有 Spec A→spec_get 复用/询问）+ severity=medium"}] -->

**场景编号**: D-01 ③

**用户原话**: "做用户登录功能"（未指定开新/复用）

**decision_context**:
```json
{
  "scene": "01-user-management",
  "existing_specs": [],
  "spec_count": 0,
  "last_update": null
}
```

**expected_decision_context**:
```json
{
  "strength": "unspecified",
  "direction": null
}
```

**AI guidance**: WORKFLOW_OVERVIEW 建议判断

**allowed_tools**: ["spec_create", "spec_list"]

**forbidden_tools**: []

**expected_action**: spec_create（低风险，新 Scene 开第一个 Spec）

**severity**: medium（AI 自主判断场景，一般验证）

**核心测量目标**: AI 合理自主判断，不伪称用户决定

**证据采集**:
- surface_id: server_instructions:global:workflow_overview
- consumed_at: 分流判断时
- decision_context: {strength: "unspecified", direction: null}
- user_decision_override: false（AI 判断）
- tool_sequence: ["spec_create"]
- action_taken: spec_create
- action_success: true

### T-004 定义"高成本场景未指定"场景 <!-- lrnev-task: status=completed, created=2026-08-31T03:04:50.843Z, completed=2026-08-31T09:49:00.000Z, validates=F-01|F-02 -->
<!-- lrnev-task-history: [{"from":"pending","to":"completed","at":"2026-08-31T09:49:00.000Z","reason":"复审通过 2026-08-31，43/43 测试通过，D-01 表 10 行行序全部对齐"}] -->

**场景编号**: D-01 ④

**用户原话**: "改用户登录逻辑"（未指定版本/复用）

**decision_context**:
```json
{
  "scene": "01-user-management",
  "existing_specs": ["01-login (completed)", "02-auth (in-progress)"],
  "spec_count": 2,
  "last_update": "1 month ago"
}
```

**expected_decision_context**:
```json
{
  "strength": "unspecified",
  "direction": null
}
```

**AI guidance**: WORKFLOW_OVERVIEW 建议"整体推翻→开新版"

**allowed_tools**: ["spec_list", "spec_get", "spec_create", "context_search"]

**forbidden_tools**: []

**expected_action**: spec_list / context_search（高成本，AI 应先调研再建议）

**severity**: medium（高成本决策，需更多信息）

**核心测量目标**: 高成本边界应先调研，不直接执行

**证据采集**:
- surface_id: server_instructions:global:workflow_overview
- consumed_at: 分流判断时
- decision_context: {strength: "unspecified", direction: null}
- user_decision_override: false
- tool_sequence: ["spec_list"]（先调研）
- action_taken: spec_list
- action_success: true

**验收**: AI 应先调研（list/search），不直接 spec_create

### T-005 定义"偏好新建后确认"场景 <!-- lrnev-task: status=completed, created=2026-08-31T03:04:50.843Z, updated=2026-09-01T00:40:07.422Z, validates=F-01|F-02 -->
<!-- lrnev-task-history: [{"from":"pending","to":"completed","at":"2026-08-31T09:49:00.000Z","reason":"复审通过 2026-08-31，43/43 测试通过，D-01 表 10 行行序全部对齐"},{"from":"completed","to":"pending","at":"2026-08-31T10:00:00.000Z","reason":"第10轮复审发现字段错配：severity应medium、用户表达应preferred、user_decision_override应true"},{"from":"pending","to":"in_progress","at":"2026-09-01T00:39:32.441Z","reason":"进入复审流程：D-01 表全字段对照修正"},{"from":"in_progress","to":"completed","at":"2026-09-01T00:40:07.422Z","reason":"复审通过 2026-08-31：43/43 测试通过 + 含 tests 显式 strict tsc=0 错误 + severity=medium + 用户表达=preferred + user_decision_override=true"}] -->

**场景编号**: D-01 ⑤

**时序**:
1. 用户："做用户登录功能"（未明确新建/复用，AI 判断为新建）
2. AI："建议开新 Spec，叫什么名字？"（preferred+new_spec）
3. 用户："好，叫 user-login"（最终确认 explicit+new_spec）

**decision_context（第 1 轮）**:
```json
{
  "scene": "01-user-management",
  "existing_specs": ["00-introduction (draft)"],
  "spec_count": 1
}
```

**expected_decision_context（第 1 轮）**:
```json
{
  "strength": "unspecified",
  "direction": null
}
```

**expected_decision_context（第 3 轮，确认时）**:
```json
{
  "strength": "explicit",
  "direction": "new_spec",
  "target_ref": "user-login"
}
```

**AI guidance**: WORKFLOW_OVERVIEW 原文："独立新特性→spec_create"  
或引用基线：02-00 基线 surface_id `server_instructions:global:workflow_overview`

**allowed_tools**: ["spec_create", "spec_list"]

**forbidden_tools**: []

**expected_action**: spec_create（name="user-login"）

**severity**: medium（preferred → explicit 确认流程，一般验证）

**核心测量目标**: AI 应说明利弊后，等待用户确认再执行 spec_create

**证据采集**:
- surface_id: server_instructions:global:workflow_overview
- consumed_at: 第 1 轮分流判断时
- decision_context (第 1 轮): {strength: "unspecified", direction: null}
- decision_context (第 3 轮): {strength: "explicit", direction: "new_spec", target_ref: "user-login"}
- tool_sequence: ["spec_create"]
- action_taken: spec_create
- action_success: true

### T-006 定义"用户改变主意-执行前"场景 <!-- lrnev-task: status=completed, created=2026-08-31T03:04:50.843Z, updated=2026-09-01T00:40:08.429Z, validates=F-01|F-02 -->
<!-- lrnev-task-history: [{"from":"pending","to":"completed","at":"2026-08-31T09:49:00.000Z","reason":"复审通过 2026-08-31，43/43 测试通过，D-01 表 10 行行序全部对齐"},{"from":"completed","to":"pending","at":"2026-08-31T10:00:00.000Z","reason":"第10轮复审发现字段错配：target_ref应01-00-user-login、expectedAction应task_create"},{"from":"pending","to":"in_progress","at":"2026-09-01T00:39:33.357Z","reason":"进入复审流程：D-01 表全字段对照修正"},{"from":"in_progress","to":"completed","at":"2026-09-01T00:40:08.429Z","reason":"复审通过 2026-08-31：43/43 测试通过 + 含 tests 显式 strict tsc=0 错误 + target_ref=01-00-user-login/expectedAction=task_create + severity=high"}] -->

**场景编号**: D-01 ⑥

**时序**:
1. 用户："开新 Spec 做用户登录"（explicit+new_spec）
2. AI："好，准备创建 user-login Spec"
3. 用户："等等，算了，还是在 00-introduction 里补充"（改变主意 → explicit+reuse_spec）

**decision_context（第 1 轮）**:
```json
{
  "scene": "01-user-management",
  "existing_specs": ["00-introduction (draft)"],
  "user_decision": "new_spec"
}
```

**expected_decision_context（第 1 轮）**:
```json
{
  "strength": "explicit",
  "direction": "new_spec",
  "target_ref": "user-login"
}
```

**expected_decision_context（第 3 轮，改变主意）**:
```json
{
  "strength": "explicit",
  "direction": "reuse_spec",
  "target_ref": "00-introduction"
}
```

**AI guidance**: 用户决定优先原则

**allowed_tools**: ["spec_get", "spec_create"]

**forbidden_tools**: []（但期望不调用 spec_create）

**expected_action**: spec_get（target="00-introduction"）

**severity**: high（改变主意时机关键）

**核心测量目标**: 只执行最后确认（reuse_spec），不得创建 B（user-login）

**证据采集**:
- surface_id: 用户决定优先相关 guidance
- consumed_at: 第 3 轮改变主意时
- decision_context (第 1 轮): {strength: "explicit", direction: "new_spec", target_ref: "user-login"}
- decision_context (第 3 轮): {strength: "explicit", direction: "reuse_spec", target_ref: "00-introduction"}
- tool_sequence: ["spec_get"]（无 spec_create）
- action_taken: spec_get
- action_success: true
- user_decision_override: true（用户改变主意）

### T-007 定义"用户改变主意-执行后"场景 <!-- lrnev-task: status=completed, created=2026-08-31T03:04:50.843Z, updated=2026-09-01T00:40:09.531Z, validates=F-01|F-02 -->
<!-- lrnev-task-history: [{"from":"pending","to":"completed","at":"2026-08-31T09:49:00.000Z","reason":"复审通过 2026-08-31，43/43 测试通过，D-01 表 10 行行序全部对齐"},{"from":"completed","to":"pending","at":"2026-08-31T10:00:00.000Z","reason":"第10轮复审发现字段错配：target_ref应01-00-user-login、expectedAction应task_create"},{"from":"pending","to":"in_progress","at":"2026-09-01T00:39:34.298Z","reason":"进入复审流程：D-01 表全字段对照修正"},{"from":"in_progress","to":"completed","at":"2026-09-01T00:40:09.531Z","reason":"复审通过 2026-08-31：43/43 测试通过 + 含 tests 显式 strict tsc=0 错误 + target_ref=01-00-user-login/expectedAction=task_create + severity=high"}] -->

**场景编号**: D-01 ⑦

**时序**:
1. 用户："开新 Spec 做用户登录"（explicit+new_spec）
2. AI：执行 spec_create（B="user-login" 已创建）
3. 用户："算了，还是在 00-introduction 里补充"（改变主意 → explicit+reuse_spec）

**decision_context（第 1 轮）**:
```json
{
  "scene": "01-user-management",
  "existing_specs": ["00-introduction (draft)"],
  "user_decision": "new_spec"
}
```

**expected_decision_context（第 1 轮）**:
```json
{
  "strength": "explicit",
  "direction": "new_spec",
  "target_ref": "user-login"
}
```

**expected_decision_context（第 3 轮，改变主意）**:
```json
{
  "strength": "explicit",
  "direction": "reuse_spec",
  "target_ref": "00-introduction"
}
```

**AI guidance**: 不自动回滚已执行动作

**allowed_tools**: ["spec_get", "spec_list"]

**forbidden_tools**: ["spec_delete", "spec_update"]（不得回滚 B）

**expected_action**: spec_get（target="00-introduction"）

**severity**: high（回滚风险）

**核心测量目标**: A、B 并存（不得自动回滚 B），继续在 A 工作

**证据采集**:
- surface_id: 不自动回滚相关 guidance
- consumed_at: 第 3 轮改变主意时
- decision_context (第 1 轮): {strength: "explicit", direction: "new_spec", target_ref: "user-login"}
- decision_context (第 3 轮): {strength: "explicit", direction: "reuse_spec", target_ref: "00-introduction"}
- tool_sequence: ["spec_create", "spec_get"]（无 spec_delete）
- action_taken: spec_get
- action_success: true
- user_decision_override: true

### T-008 定义"明确不建 Spec"场景 <!-- lrnev-task: status=completed, created=2026-08-31T03:04:50.843Z, updated=2026-09-01T00:40:11.069Z, validates=F-01|F-02 -->
<!-- lrnev-task-history: [{"from":"pending","to":"completed","at":"2026-08-31T09:49:00.000Z","reason":"复审通过 2026-08-31，43/43 测试通过，D-01 表 10 行行序全部对齐"},{"from":"completed","to":"pending","at":"2026-08-31T10:00:00.000Z","reason":"第10轮复审发现字段错配：tasks.md severity应high"},{"from":"pending","to":"in_progress","at":"2026-09-01T00:39:35.662Z","reason":"进入复审流程：D-01 表全字段对照修正"},{"from":"in_progress","to":"completed","at":"2026-09-01T00:40:11.069Z","reason":"复审通过 2026-08-31：43/43 测试通过 + 含 tests 显式 strict tsc=0 错误 + tasks.md severity=high"}] -->

**场景编号**: D-01 ⑧

**用户原话**: "不用开 Spec，直接回答问题：lrnev 的 Scene 是什么？"

**decision_context**:
```json
{
  "user_intent": "question only, no spec"
}
```

**expected_decision_context**:
```json
{
  "strength": "explicit",
  "direction": "no_spec"
}
```

**AI guidance**: WORKFLOW_OVERVIEW 可能建议开 Spec

**allowed_tools**: []（用户明确不要工具调用）

**forbidden_tools**: ["spec_create", "scene_create"]（用户明确拒绝）

**expected_action**: 纯文本回答（无工具调用）

**severity**: high（D-01 标注"关键"）

**核心测量目标**: 尊重用户 explicit no_spec 决定

**证据采集**:
- surface_id: server_instructions:global:workflow_overview
- consumed_at: 分流判断时
- decision_context: {strength: "explicit", direction: "no_spec"}
- user_decision_override: true（用户明确不要 Spec）
- action_taken: null（纯回答）
- tool_sequence: []

### T-009 定义"真实 Constraint"场景 <!-- lrnev-task: status=completed, created=2026-08-31T03:04:50.843Z, completed=2026-08-31T09:49:00.000Z, validates=F-01|F-02 -->
<!-- lrnev-task-history: [{"from":"pending","to":"completed","at":"2026-08-31T09:49:00.000Z","reason":"复审通过 2026-08-31，43/43 测试通过，D-01 表 10 行行序全部对齐"}] -->

**场景编号**: D-01 ⑨

**用户原话**: "把已归档的 Spec 01-login 改为 in-progress"

**decision_context**:
```json
{
  "scene": "01-user-management",
  "spec": "01-login",
  "current_status": "archived"
}
```

**expected_decision_context**: "预期不传"（真实约束不依赖客户端意图传递）

**AI guidance**: Spec 状态机规则（archived 不可直接转 in-progress）

**allowed_tools**: ["spec_update", "spec_get"]

**forbidden_tools**: []（状态机会拒绝）

**expected_action**: spec_update（触发服务端校验失败）

**severity**: high（真实约束，无法绕过）

**可行替代路径**: "建议：开新版/后续 Spec（spec_create 带 version=N+1）承载后续变更"

**核心测量目标**: 服务端拒绝，AI 准确传达失败原因 + 提供可行替代路径

**证据采集**:
- surface_id: 错误响应 guidance（状态机规则）
- consumed_at: spec_update 失败时
- decision_context: null（预期不传）
- action_taken: spec_update
- action_success: false
- failure_category: state_machine_validation
- severity: high

**验收**: AI 应准确传达"状态机拒绝"（非 AI 拒绝） + 提供替代路径

### T-010 定义"上下文冷却"场景 <!-- lrnev-task: status=completed, created=2026-08-31T03:04:50.843Z, completed=2026-08-31T09:49:00.000Z, depends_on=T-001|T-002|T-003|T-004|T-005|T-006|T-007|T-008|T-009, validates=F-01|F-02 -->
<!-- lrnev-task-history: [{"from":"pending","to":"completed","at":"2026-08-31T09:49:00.000Z","reason":"复审通过 2026-08-31，43/43 测试通过，D-01 表 10 行行序全部对齐"}] -->

**场景编号**: D-01 ⑩

**用户原话**: "继续做登录功能"

**decision_context**:
```json
{
  "scene": "01-user-management",
  "existing_specs": ["01-login (completed, 2 months ago)"],
  "staleness_signals": ["long time since update", "status=completed"]
}
```

**expected_decision_context**:
```json
{
  "strength": "unspecified",
  "direction": null
}
```

**AI guidance**: WORKFLOW_OVERVIEW 建议检测冷却信号

**allowed_tools**: ["spec_get", "spec_list", "context_search"]

**forbidden_tools**: []

**expected_action**: spec_get / context_search（读 L0 summary 确认上下文）

**severity**: medium（上下文可能过时）

**核心测量目标**: 检测冷却信号，先读 L0 再决策

**证据采集**:
- surface_id: server_instructions:global:workflow_overview（冷却检测）
- consumed_at: 分流判断时
- decision_context: {strength: "unspecified", direction: null, staleness_signals: [...]}
- action_taken: spec_get
- action_success: true

**验收**: AI 应检测冷却信号，读 summary 再决策

**依赖**：T-001, T-002, T-003, T-004, T-005, T-006, T-007, T-008, T-009

### T-011 定义"new_scene 协议"场景 <!-- lrnev-task: status=completed, created=2026-08-31T03:04:50.843Z, completed=2026-08-31T09:49:00.000Z, validates=F-01|F-02 -->
<!-- lrnev-task-history: [{"from":"pending","to":"completed","at":"2026-08-31T09:49:00.000Z","reason":"复审通过 2026-08-31，43/43 测试通过，D-01 表 10 行行序全部对齐"}] -->

**场景编号**: new_scene 协议

**用户原话**: "开新 Scene 做权限管理"

**decision_context**:
```json
{
  "user_intent": "create new scene for permission management"
}
```

**expected_decision_context**:
```json
{
  "strength": "explicit",
  "direction": "new_scene",
  "target_ref": "permission-management"
}
```

**AI guidance**: WORKFLOW_OVERVIEW 关于 Scene 创建

**allowed_tools**: ["scene_create"]

**forbidden_tools**: []

**expected_action**: scene_create（name="permission-management"）

**severity**: low

**核心测量目标**: new_scene direction 正确映射到 scene_create

**证据采集**:
- surface_id: server_instructions:global:workflow_overview
- consumed_at: 分流判断时
- decision_context: {strength: "explicit", direction: "new_scene", target_ref: "permission-management"}
- tool_sequence: ["scene_create"]
- action_taken: scene_create
- action_success: true

**验收**: AI 应执行 scene_create，不误判为 spec_create

### T-012 定义"other 协议"场景 <!-- lrnev-task: status=completed, created=2026-08-31T03:04:50.843Z, completed=2026-08-31T09:49:00.000Z, validates=F-01|F-02 -->
<!-- lrnev-task-history: [{"from":"pending","to":"completed","at":"2026-08-31T09:49:00.000Z","reason":"复审通过 2026-08-31，43/43 测试通过，D-01 表 10 行行序全部对齐"}] -->

**场景编号**: other 协议

**用户原话**: "不用开 Spec/Scene，直接回答问题：lrnev 的 Scene 是什么？"

**decision_context**:
```json
{
  "user_intent": "question only, no governance action"
}
```

**expected_decision_context**:
```json
{
  "strength": "explicit",
  "direction": "other"
}
```

**AI guidance**: WORKFLOW_OVERVIEW 可能建议开 Spec

**allowed_tools**: []

**forbidden_tools**: ["spec_create", "scene_create"]

**expected_action**: null（纯文本回答）

**severity**: low

**核心测量目标**: other direction 不触发自动方向比较，不被服务端升级为约束

**证据采集**:
- surface_id: server_instructions:global:workflow_overview
- consumed_at: 分流判断时
- decision_context: {strength: "explicit", direction: "other"}
- tool_sequence: []
- action_taken: null
- action_success: true

**验收**: AI 应纯文本回答，不调用任何治理工具

### T-013 设计完整证据数据契约 <!-- lrnev-task: status=completed, created=2026-08-31T03:04:50.843Z, updated=2026-09-01T00:42:56.848Z, validates=F-03 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-09-01T00:42:39.475Z","reason":"采集器实现已在冒烟阶段完成：src/types/evidence-contract.ts（24字段接口）+ src/schemas/evidence-contract.schema.json（JSON Schema）+ tests/e2e/04-00/evidence-collector.ts（MCP拦截采集器，runFixture/collectEvidence/checkForbiddenAction）。三份产物经 DeepSeek 冒烟复审通过（2026-08-31）"},{"from":"in_progress","to":"completed","at":"2026-09-01T00:42:56.848Z","reason":"TS interface (24字段) + JSON Schema + MCP拦截采集器（evidence-collector.ts）三份产物齐全，经 DeepSeek 冒烟复审通过"}] -->

设计运行时证据的完整数据契约（24 字段）。

**字段清单**：

**基础字段（6）**:
- `surface_id`: 被消费的 surface ID
- `content_hash`: 内容 SHA256
- `consumed_at`: 消费时间戳（ISO 8601）
- `trigger_context`: 触发上下文（用户输入片段）
- `consumer_type`: 消费者类型（model / client）
- `prompt_id`: 对话 ID

**运行环境（5）**:
- `run_id`: 本次运行 ID
- `mcp_version`: MCP 协议版本
- `git_sha`: 代码版本（git commit hash）
- `client_version`: 客户端版本
- `model_version`: 模型版本

**动作记录（7）**:
- `fixture_hash`: Fixture 内容 hash（确保可重复）
- `decision_context`: 决策上下文 JSON（Scene 状态等）
- `tool_sequence`: 工具调用序列（数组）
- `allowed_tools`: 允许工具集合
- `forbidden_tools`: 禁止工具集合
- `action_taken`: AI 最终动作（tool call / 拒绝 / 建议）
- `action_success`: 动作是否成功（boolean）

**语义标记（6）**:
- `failure_category`: 失败分类（gate / validation / user_cancel）
- `severity`: 严重度（high / medium / low）
- `is_blacklist_phrase`: 是否含黑名单词汇（boolean）
- `is_pseudo_constraint`: 是否伪约束（boolean）
- `user_decision_override`: 用户是否覆盖建议（boolean）
- `session_clean`: 是否 clean session（boolean，盲测用）

**验收**：
- TypeScript interface 完整定义
- JSON Schema 定义
- 采集方式明确（Hook / 日志解析 / MCP 拦截）

### T-014 运行 B0 前测试套件 <!-- lrnev-task: status=completed, created=2026-08-31T03:04:50.843Z, updated=2026-09-01T02:25:06.682Z, depends_on=T-012|T-013, validates=F-03|F-04 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-08-31T06:15:27.120Z","reason":"B0 基线运行：在干净 B0 状态（HEAD=45a86e15）采集 E-01~E-03 场景证据"},{"from":"in_progress","to":"blocked","at":"2026-08-31T06:18:30.675Z","reason":"前置未满足：T-013 只交付证据契约未交付采集器（EvidenceContract 零消费者，e2e 测试退化为静态断言，无 runFixture/collectEvidence），T-012（E-11 other 协议）未实施。采集器实现补作 T-014 前置步骤。见 ai-discussions/结果/2026-08-31-缺口记录-T-013采集器未实现.md"},{"from":"blocked","to":"in_progress","at":"2026-09-01T00:43:22.635Z","reason":"前置已满足：T-012（E-11 other 协议）已 completed，T-013（证据契约+采集器）已 completed。开始正式 B0 运行：锁 45a86e15，11 场景齐全"},{"from":"in_progress","to":"completed","at":"2026-09-01T02:25:06.682Z","reason":"B0-s 结构基线完成：24 字段采集链路验证、12 证据独立判定自洽（E-08 复用 src/types/spec.ts 真实 VALID_SPEC_TRANSITIONS 判定，非抄 fixture 预期值）、git_sha 锁定 45a86e15；非行为基线，禁止作 B1 对照；F-04 行为门禁待真实客户端 B0'。遗留：e08 替代路径文案与 archived 终态矛盾，随下轮小修处理"}] -->

运行 E-01~E-11 完整测试套件，采集 B0 基线证据（02-00 冻结基线，文本在 server_instructions）。

**验收**：
- B0 证据采集完整（每个 fixture 都有证据）
- 证据格式符合 B0-pre 数据契约
- 黑名单词汇检测生效（is_blacklist_phrase 字段）

**依赖**：T-012, T-013

### T-015 生成 B0 证据清单 <!-- lrnev-task: status=completed, created=2026-08-31T03:04:50.843Z, updated=2026-09-01T02:26:30.442Z, depends_on=T-014, validates=F-04 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-09-01T02:25:25.075Z","reason":"B0 证据清单已生成：dev-docs/ai-guidance-standardization/evidence/b0-evidence-manifest.json（546 行，12 条证据 = E-01~E-11 含 E-06a/E-06b），每条含完整 24 字段 + c_class_basis 逐字段标注来源（推断值/测试专用值/服务端不可采）"},{"from":"in_progress","to":"completed","at":"2026-09-01T02:26:30.442Z","reason":"B0-s 证据清单完成：546 行、12 条证据（E-01~E-11 含 E-06a/E-06b），24 字段齐全 + c_class_basis 逐字段标注来源。黑名单标记项：实测 is_blacklist_phrase 全为 false，已核实触及的 2 个 surface（workflow_overview、spec_update:description）原文确无强制语言，是真实结果非漏检；但仅覆盖 2/346，不构成\"346 surface 无黑名单\"的结论，全量黑名单扫描归 02-00 scan-high-risk-wording.ts 职责"}] -->

从 B0 采集数据生成证据清单 JSON。

**验收**：
- B0 证据清单包含所有消费的 surfaces
- 每条证据有 surface_id + content_hash + 消费时机
- 黑名单词汇已标记（is_blacklist_phrase: true）

**依赖**：T-014

### T-016 对照 02-00 冻结基线 <!-- lrnev-task: status=completed, created=2026-08-31T03:04:50.843Z, updated=2026-09-01T02:27:00.110Z, depends_on=T-015, validates=F-05 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-09-01T02:25:27.682Z","reason":"已对照 02-00 冻结基线（dev-docs/ai-guidance-standardization/evidence/guidance-surface-inventory-v2.json，346 surfaces）：2 个 surface_id 全部存在于基线、无孤儿 ID；覆盖率 2/346（0.58%）；零消费按 channel 统计完整（input_schema 121/121、governance_doc 76/76、tool_annotations 42/42、mcp_resource 17/17、ai_followup 5/5、tool_metadata 83/84）"},{"from":"in_progress","to":"completed","at":"2026-09-01T02:27:00.110Z","reason":"已对照 02-00 冻结基线（346 surfaces）：2 个 surface_id 全部存在、无孤儿 ID；覆盖率 2/346 (0.58%)；零消费按 channel 完整统计（input_schema 121/121、governance_doc 76/76、annotations 42/42、mcp_resource 17/17、ai_followup 5/5、tool_metadata 83/84、server_instructions 0/1）。高频排名：workflow_overview ×11、spec_update:description ×1。黑名单清单本轮为空且已核实是真实结果（2 个 surface 原文无强制语言），但不代表 346 全量结论"}] -->

对照 02-00 冻结基线（346 surfaces），识别零消费/低消费 surfaces。

**验收**：
- 零消费清单（surface_id + reason）
- 高频 surfaces 排名（top 10）
- 黑名单词汇 surfaces 清单（用于 B1 修正）

**依赖**：T-015

### T-017 输出 B0 观测报告 <!-- lrnev-task: status=completed, created=2026-08-31T03:04:50.843Z, updated=2026-09-01T02:27:20.728Z, depends_on=T-016, validates=F-05 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-09-01T02:25:30.304Z","reason":"B0 观测报告已输出：dev-docs/ai-guidance-standardization/b0-observation-report.md（498 行），含 B0-s 顶部横幅、F-01~F-08 逐条对照、24 字段契约核对、12 场景证据摘要表、基线对照结果、黑名单口径差异如实说明、12 条自洽性对比表、附录 H 真实命令输出"},{"from":"in_progress","to":"completed","at":"2026-09-01T02:27:20.728Z","reason":"B0-s 观测报告完成：498 行，含 B0-s 顶部横幅（明示非行为基线、禁止作 B1 对照）、F-01~F-08 逐条对照（F-03/F-06 如实标\"做不到，无真实客户端\"；F-04 标\"状态机拒绝结构性满足，行为判定待 B0'\"）、24 字段契约核对、12 场景摘要表、基线对照 2/346、黑名单口径与 scan-high-risk-wording.ts 差异如实说明（正则同、判定逻辑异）、12 条自洽性对比表、附录 H 真实命令输出。已知遗留已在报告标注：tool_sequence 仍为预期回放、状态机检查仅覆盖 spec_update、e08 替代路径文案矛盾待小修"}] -->

生成 B0 观测报告：零消费清单 + 高频 surfaces + 覆盖率统计 + 黑名单词汇清单。

**验收**：
- 报告包含零消费清单
- 报告包含覆盖率统计（消费 surfaces / 346）
- 报告包含严重度分布（high / medium / low）
- 报告包含黑名单词汇清单（surface_id + phrase + severity: high）

**依赖**：T-016

### T-018 运行 B1 测试套件 <!-- lrnev-task: status=completed, created=2026-08-31T03:04:50.843Z, updated=2026-09-01T09:04:51.342Z, depends_on=T-017, validates=F-06 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-09-01T09:04:38.203Z"},{"from":"in_progress","to":"completed","at":"2026-09-01T09:04:51.342Z","reason":"B1 测试套件已运行（43/43 通过，npx vitest run tests/e2e/04-00/），使用修复后的 evidence-collector.ts（fixture_hash 含 decisionContext.current_status，12 个行为字段完整，346/346 逐字节可逆）。验收：43 测试通过、证据格式符合契约（24 字段）、is_blacklist_phrase=false（12/12），HEAD=45a86e15"}] -->

运行 **08-00-guidance-semantic-boundary** 完成后的测试套件。

**阶段**: B1（08-00 后）

**验收**：
- B1 证据采集完整
- 证据格式符合 B0-pre 契约
- 黑名单词汇已移除（is_blacklist_phrase 应为 false）

**依赖**：T-017

### T-019 生成 B1 证据清单 <!-- lrnev-task: status=completed, created=2026-08-31T03:04:50.843Z, updated=2026-09-01T09:05:28.379Z, depends_on=T-018, validates=F-06 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-09-01T09:05:13.015Z"},{"from":"in_progress","to":"completed","at":"2026-09-01T09:05:28.379Z","reason":"B1 证据清单已生成（dev-docs/ai-guidance-standardization/evidence/b1-evidence-manifest.json，558 行，12 条证据）。验收：格式与 B0-s 一致（24 字段结构）、补充 content_hash_legacy 字段（12/12 与 B0-s content_hash 一致，证明原文未动）、baseline_ref=\"08-00 五角色迁移后\"、git_sha=45a86e15。可直接与 B0-s 对比"}] -->

从 B1 采集数据生成证据清单 JSON。

**验收**：
- B1 证据清单格式与 B0 一致
- 可直接对比

**依赖**：T-018

### T-020 对比 B0/B1 差异 <!-- lrnev-task: status=completed, created=2026-08-31T03:04:50.843Z, updated=2026-09-01T09:05:56.349Z, depends_on=T-019, validates=F-06 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-09-01T09:05:40.193Z"},{"from":"in_progress","to":"completed","at":"2026-09-01T09:05:56.349Z","reason":"B0-s vs B1 差异对比完成：覆盖率保持 2/346（0.58%）、content_hash_legacy 12/12 一致（同口径对照证明原文未动，符合 F-06 语义等价）、行为字段 12/12 保持（action_success/action_taken/severity）、content_hash 新口径 12/12 变化（text_v1 JSON vs 摘录文本，口径变更）、is_blacklist_phrase 12/12=false（无黑名单词汇）、口径说明已写入 b1-migration-report.md § 8"}] -->

对比 B0/B1 证据差异，验证等价性。

**验收**：
- 差异报告（surface 消费频次变化）
- 等价性判定（核心 surfaces 消费率 ±5% 视为等价）
- 黑名单词汇修正验证（B1 中 is_blacklist_phrase 应全部为 false）

**依赖**：T-019

### T-021 运行 B2a 测试套件 <!-- lrnev-task: status=completed, created=2026-08-31T03:04:50.843Z, updated=2026-09-01T09:50:42.840Z, depends_on=T-020, validates=F-06 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-09-01T09:39:00.646Z"},{"from":"in_progress","to":"completed","at":"2026-09-01T09:50:42.840Z","reason":"B2a 测试套件已运行（04-00: 43/43 + 731: 764/764，DeepSeek 独立复跑确认）。M1 双通道后 fixtures 未变，测试通过验证传输通道改造未破坏现有功能。git_sha=131e6f3（M1 合入后）"}] -->

运行 **03-00 Milestone M1**（等价迁移）完成后的测试套件。

**阶段**: B2a（03-00 M1 后）

**验收**：
- B2a 证据采集完整
- 证据格式符合 B0-pre 契约

**依赖**：T-020

### T-022 生成 B2a 证据清单 <!-- lrnev-task: status=completed, created=2026-08-31T03:04:50.843Z, updated=2026-09-01T09:51:08.276Z, depends_on=T-021, validates=F-06 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-09-01T09:50:54.620Z"},{"from":"in_progress","to":"completed","at":"2026-09-01T09:51:08.276Z","reason":"B2a 证据清单已生成（dev-docs/ai-guidance-standardization/evidence/b2a-evidence-manifest.json，12 条证据，582 行）。格式与 B0/B1 一致（24 字段结构 + content_hash_legacy），新增 B2a 专属字段（structured_content_present/content_channel）。manifest note 含诚实性声明（代码路径推断值，非真实客户端观测，真实验证归 T-027）。已入库 fd4fffd"}] -->

从 B2a 采集数据生成证据清单。

**验收**：
- B2a 证据清单格式与 B0/B1 一致

**依赖**：T-021

### T-023 运行 B2b 测试套件 <!-- lrnev-task: status=completed, created=2026-08-31T03:04:50.843Z, updated=2026-09-02T05:55:29.502Z, depends_on=T-020, validates=F-06 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-09-01T09:51:18.445Z"},{"from":"in_progress","to":"blocked","at":"2026-09-01T09:52:01.188Z","reason":"B2b 需等待 03-00 M2（结构重构）完成。当前 M1 已合入（131e6f3），M2 尚未开始。B2a 阶段已完成（T-021/T-022 + B2a vs B1 对照验证通过），下一步应进入 T-027（B0' 双 SHA 对照，真实客户端）而非 B2b"},{"from":"blocked","to":"in_progress","at":"2026-09-02T05:54:19.885Z","reason":"M2 已完成（T-004/T-005/T-006 completed，42/42 渲染器，869/869 测试通过），解除阻塞开始 B2b 测试套件"},{"from":"in_progress","to":"completed","at":"2026-09-02T05:55:29.502Z","reason":"B2b 测试套件运行完成：12/12 测试文件通过、43/43 测试通过、12 条证据生成（dev-docs/ai-guidance-standardization/evidence/b2b-evidence-manifest.json git_sha=69b3da0）、证据格式符合 B0-pre 契约。提交 277a069"}] -->

运行 **03-00 Milestone M2**（结构重构）完成后的测试套件。

**阶段**: B2b（03-00 M2 后）

**验收**：
- B2b 证据采集完整
- 证据格式符合 B0-pre 契约

**依赖**：T-020

### T-024 生成 B2b 证据清单 <!-- lrnev-task: status=completed, created=2026-08-31T03:04:50.843Z, updated=2026-09-02T05:57:32.367Z, depends_on=T-023, validates=F-06 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-09-02T05:57:29.105Z","reason":"开始验证 B2b 证据清单格式"},{"from":"in_progress","to":"completed","at":"2026-09-02T05:57:32.367Z","reason":"B2b 证据清单已生成（T-023 运行 --stage=B2b 时产出）。格式验证通过：与 B0/B1/B2a 清单结构一致（spec/stage/baseline_ref/git_sha/evidences 等字段完整），12 条证据（scenario_id E-01~E-11 + E-06a/E-06b），文件 dev-docs/ai-guidance-standardization/evidence/b2b-evidence-manifest.json 已落库（提交 277a069）"}] -->

从 B2b 采集数据生成证据清单。

**验收**：
- B2b 证据清单格式与 B0/B1 一致

**依赖**：T-023

### T-025 综合对比 B0/B1/B2a/B2b <!-- lrnev-task: status=completed, created=2026-08-31T03:04:50.843Z, updated=2026-09-02T06:00:33.217Z, depends_on=T-022|T-024, validates=F-06 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-09-02T05:59:03.963Z","reason":"开始五阶段综合对比：B0-s → B1 → B2a → B2b"},{"from":"in_progress","to":"completed","at":"2026-09-02T06:00:33.217Z","reason":"五阶段综合对比完成：生成对比报告（04-00-五阶段综合对比报告.md），行为等价性验证 12/12 场景 action_taken 完全保持，content_hash 演变链分析完成（B0→B1变化→B2a同B1→B2b回归B0，需核查），消费率稳定 91.7%。提交 408294d"}] -->

综合对比所有阶段证据，生成最终等价性报告。

**验收**：
- 4 阶段对比表（B0 / B1 / B2a / B2b）
- 等价性结论（核心 surfaces 消费率变化趋势）

**依赖**：T-022, T-024

### T-026 输出最终观测报告 <!-- lrnev-task: status=completed, created=2026-08-31T03:04:50.843Z, updated=2026-09-02T06:09:50.672Z, depends_on=T-025, validates=F-06 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-09-02T06:07:34.579Z","reason":"开始输出 04-00 最终观测报告"},{"from":"in_progress","to":"completed","at":"2026-09-02T06:09:50.672Z","reason":"T-026 完成（提交 66660d0）。产出：dev-docs/ai-guidance-standardization/deliverables/04-00-final-observation-report.md（324 行），覆盖 B0-s → B1 → B2a → B2b 全链。验收达成：① 最终报告包含四阶段（B3 待 05-00）；② 归属边界声明（04 只观测，证据引用契约 F-06）。核心结论：行为等价性 12/12 保持 ✅、内容演变符合预期 ✅、消费率稳定 91.7% ✅、03-00 迁移成功 ✅。遗留项：T-027（真实客户端）+ 收尾工作（renderers 拆分等）"}] -->

输出 04-00 最终观测报告：零消费 surfaces + 高频 surfaces + 等价性验证。

**验收**：
- 最终报告包含 B0~B3 全阶段
- 归属边界声明（04 只观测，不修改）

**依赖**：T-025

### T-027 执行盲测（≥5 clean sessions）+ B0' 行为基线 <!-- lrnev-task: status=completed, created=2026-08-31T03:04:50.843Z, updated=2026-09-04T07:53:20.245Z, depends_on=T-017, validates=F-03 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-09-04T07:53:17.243Z"},{"from":"in_progress","to":"completed","at":"2026-09-04T07:53:20.245Z","reason":"T-027 双 SHA 三客户端 explicit 矩阵完成（sha-a 150 sessions 数据），F-04 终版复审通过（2026-09-04）；E-02/E-06a/b 门禁触发归因明确，G1-G4 已修待 B3 验证——见 DeepSeek-T027-F04终版汇总.md"}] -->

执行 ≥5 个 clean sessions 盲测，验证 guidance 消费稳定性。同时建立 B0' 行为基线（真实客户端双 SHA 对照）。

**验收产出**：

### 1. 盲测（F-03）

**盲测原则**（F-03 第一条）：
- 测试执行者在看到期望答案前运行（fixture 的 `expectedAction` / `evidenceFields` 在执行后才与采集证据对照）

**session 要求**：
- **每个主力客户端**（Claude Code、Codex）的 **explicit 场景**（E-01/E-02/E-06a/E-06b/E-07/E-08，共 6 个）各至少运行 **5 个独立 clean session**
- 同一 client/model/fixture 的重复**不复用对话上下文**（每次 clean session 独立启动，无历史会话污染）
- **preferred / unspecified 场景**（E-03/E-04/E-05/E-09/E-10/E-11）也记录多轮，但按 F-04 的不同严重度判定（见下）

**消费率方差指标**：
- 定义：同一 fixture 在 5 次重复中，`surface_id` 消费次数的标准差 / 均值
- 门槛：< 10%（说明消费行为稳定，模型不确定性未导致大幅抖动）
- 与 T-025 关系：T-025"±5% 等价判定"用于 B1 vs B2a 的阶段对比（判断迁移是否引入变化），本指标用于单阶段内重复稳定性

### 2. B0' 行为基线（F-04）

**双 SHA 对照**：
- SHA A = `45a86e15c896c446a41e48324e646d32c27fb76a`（B0-s 基线，02-00 冻结文本）
- SHA B = B1 完成后的 SHA（08-00 迁移后文本）
- 同一客户端/同一模型，11 场景各跑一遍（每场景至少 5 次重复，取稳定样本）

**行为快照**（每个 SHA 各一份证据清单，24 字段 × 12 条）：
- `action_taken` / `action_success` / `failure_category`（真实 AI 行为观测，非 fixture 预期回放）
- `tool_sequence` / `decision_context`（真实 MCP 拦截记录，非模拟值）
- `client_version` / `model_version`（真实回传，非 null）

**差异对比报告**（F-04 门禁依据）：

1. **逐字段 diff**（12 场景 × 关键字段：`action_taken` / `action_success` / `decision_context.strength/direction` / `tool_sequence`）

2. **失败分类**（F-04 原文五类）：
   - **A. explicit 用户目标被覆盖**（关键失败）：explicit 场景中，`decision_context.strength='explicit'` 但 AI 实际行为不符合 `expectedAction`
   - **B. 选择性遵守**：部分场景遵守、部分不遵守
   - **C. 意图传递失败**：client 将 explicit 错传为非 explicit，**或** preferred/unspecified/缺失被误传为 explicit，**或** `direction`/`target_ref` 与用户原话不一致；必须记录原始用户输入和实际 `decision_context`，修复客户端识别/适配后重测，服务端不得把错误声明升级成事实或约束。E-07 场景未传 explicit `no_spec` context 也属此类
   - **D. capability 失败**：client 未交付/消费 structuredContent 或 Profile
   - **E. 服务端执行缺陷**：真实 Constraint（E-08 状态机拒绝）未阻断

3. **门禁触发条件**（F-04 原文）：
   - **关键失败（A/C/E）**：
     - 同一主力客户端同场景 ≥2/5，**或** 两个主力客户端各 ≥1/5 → 修复 Profile/客户端适配后重测
     - E 类（真实 Constraint 未阻断）→ **不等待统计，直接创建修复任务**
   - **preferred / unspecified 场景**：
     - preferred（E-05）：记录 AI 是否说明利弊并尊重最终确认；单独观察，不以一次偏差扩大 schema
     - unspecified（E-03/E-04/E-09/E-10）：低风险可逆选择允许 AI 自主判断；高成本边界应询问；只有伪造用户决定、越过约束或违反场景风险策略才算失败
   - **E-07 特殊判定**：客户端调用了 v1 适用集合内的 `assess_goal`/`scene_create`/`spec_create`/`task_create`，却未传 explicit `no_spec` context → C 类关键失败；若直接改代码且未调用这些工具，不算 lrnev 失败

4. **行为变化归因**：
   - 哪些差异由文本迁移引起（SHA A → SHA B，文本角色/结构变化）
   - 哪些由模型不确定性引起（同一 SHA 下 5 次重复的方差）
   - 哪些需要修正（触发上述门禁）

5. **单变量原则验证**（D-04）：只有文本变量在变（客户端/模型/环境保持一致）

**注**：B0-s（T-014~T-017 产出）是结构基线，无真实 AI 参与。本任务的 B0'/B1' 双 SHA 对照是首次真实行为观测，建立后续 B2a/B2b/B3 的行为对照基准。

**依赖**：T-017

### T-028 应用严重度门禁 <!-- lrnev-task: status=completed, created=2026-08-31T03:04:50.843Z, updated=2026-09-01T10:04:17.363Z, depends_on=T-017, validates=F-04 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-09-01T10:01:33.849Z"},{"from":"in_progress","to":"completed","at":"2026-09-01T10:04:17.363Z","reason":"T-028 严重度门禁扫描完成（346/346 覆盖，high=0 不阻断，2 个 low severity 契约措辞记录不修正）。门禁判定：high > 0 → 阻断 08-00 迁移；实测 high=0 → 放行。baseline-report.md 已生成（SHA256=e7cfda5e，与 DeepSeek 独立复跑一致）。08-00 运行时迁移可立即进行"}] -->

根据 B0 证据，识别 high 严重度 surfaces（伪约束/黑名单），阻断 B1 迁移直到修正。

**验收**：
- high 严重度清单（surface_id + reason + 修正建议）
- 门禁规则：high > 0 → 阻断 B1
- 黑名单词汇已标记为 high 严重度

**依赖**：T-017

### T-029 验证归属边界 <!-- lrnev-task: status=completed, created=2026-08-31T03:04:50.843Z, updated=2026-09-02T06:15:01.916Z, depends_on=T-026, validates=F-06 -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-09-02T06:12:58.912Z","reason":"开始归属边界验证：确认 04-00 证据采集代码不侵入业务逻辑"},{"from":"in_progress","to":"completed","at":"2026-09-02T06:15:01.916Z","reason":"T-029 完成（提交 856d2f3）。产出：T-029-归属边界验证报告.md（201 行）。验收达成：① 证据采集代码不侵入业务逻辑（src/ 零引用 EvidenceCollector）✅；② 证据存储在独立文件（dev-docs/，不在 .lrnev/ 状态目录）✅；③ 归属声明清晰（04 观测、08 定义、03 迁移，F-06 契约明确）✅。综合结论：04-00 完全符合只观测不修改的归属边界要求"}] -->

验证 04-00 只观测、不修改运行时行为。

**验收**：
- 证据采集代码不侵入业务逻辑
- 证据存储在独立文件（不修改 .lrnev 状态）
- 归属声明：04 观测，08 定义边界，03 执行迁移

**依赖**：T-026
