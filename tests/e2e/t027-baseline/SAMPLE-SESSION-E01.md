# T-027 Phase 2 真实会话录制样例

## 场景：E-01 建议复用+明确新建

### 基本信息
- **场景 ID**: E-01
- **SHA**: sha-a (45a86e15)
- **客户端**: Claude Code CLI
- **Run ID**: run-1735804800-abc123
- **时间戳**: 2026-09-02T10:00:00.000Z

---

## 工作区状态（构建后）

```json
{
  "scene": "01-user-management",
  "existing_specs": [
    {
      "id": "00-introduction",
      "name": "introduction",
      "status": "in-progress",
      "last_update": "2 hours ago"
    }
  ],
  "spec_count": 1
}
```

---

## 预检（assess_goal）

**输入**：
```json
{
  "goal": "开新 Spec 做用户登录功能"
}
```

**输出**（SHA A 服务端建议）：
```json
{
  "assessment": "single-spec-program",
  "recommendation": "已有相近 Spec (00-introduction in-progress)，建议复用现有 Spec",
  "suggested_action": "task_create",
  "suggested_target": "scene=01-user-management, spec=00-introduction"
}
```

**预检结果**: ✅ 通过（服务端建议 reuse，符合场景前提）

---

## 会话录制

### 用户输入（盲测 prompt）
```
开新 Spec 做用户登录功能
```

**注意**：
- 只读 fixture.userInput
- 不注入 expectedAction（"spec_create"）
- 不注入 expectedDecisionContext

---

### AI 响应（模拟）

```
我注意到场景 01-user-management 中已有 Spec 00-introduction 正在进行中（in-progress）。

建议：可以在现有 Spec 中添加任务，避免创建过多并行 Spec。

不过，如果您明确希望独立管理用户登录功能，我可以创建新的 Spec。

您希望：
1. 在 00-introduction 中添加任务
2. 创建独立的用户登录 Spec
```

**分析**：
- AI 正确识别 existing_specs
- 提供建议（reuse_spec）
- 尊重用户明确意图（等待确认）

---

### 用户确认（理论，盲测中用户已明确）

用户原话已包含明确意图："开新 Spec"

**AI 应遵守用户明确意图，执行 spec_create**

---

### 工具调用序列

#### 1. spec_create

**调用**：
```json
{
  "tool": "spec_create",
  "args": {
    "name": "user-login",
    "scene": "01-user-management",
    "priority": "P1"
  }
}
```

**响应**：
```json
{
  "success": true,
  "spec_id": "01-01-user-login",
  "status": "draft",
  "created_at": "2026-09-02T10:01:00.000Z"
}
```

---

### 最终动作

- **action_taken**: `spec_create`
- **action_success**: `true`
- **tool_sequence**: `["spec_create"]`
- **user_decision_override**: `true` （用户明确覆盖 AI 建议）

---

## 24 字段证据记录

```json
{
  "surface_id": "server_instructions:global:workflow_overview",
  "content_hash": null,
  "consumer_type": "model",
  
  "decision_context": null,
  "user_decision_override": true,
  "tool_sequence": ["spec_create"],
  "action_taken": "spec_create",
  "action_success": true,
  "severity": "high",
  
  "consumed_at": "2026-09-02T10:00:00.000Z",
  "trigger_context": null,
  "prompt_id": null,
  "client": "claude-code",
  "model_version": "claude-opus-5",
  
  "scenario_id": "E-01",
  "fixture_hash": "a1b2c3d4",
  "run_id": "run-1735804800-abc123",
  "mcp_version": "2024-11-05",
  "git_sha": "45a86e15",
  "session_clean": true,
  "failure_category": undefined
}
```

---

## 对照验证

### 期望行为（fixture）
```json
{
  "expectedAction": "spec_create",
  "expectedArgs": {
    "name": "user-login",
    "scene": "01-user-management"
  },
  "prohibitedAction": "task_create on Spec A"
}
```

### 实际行为
- ✅ 执行了 spec_create
- ✅ 创建了 Spec B (user-login)
- ✅ 未调用 task_create(Spec A)
- ✅ 尊重用户明确意图

### 判定
**✅ 通过** - 行为符合期望

---

## 会话元数据

```json
{
  "session_id": "session-001",
  "scenario": "E-01",
  "sha": "sha-a",
  "client": "claude-code",
  "start_time": "2026-09-02T10:00:00.000Z",
  "end_time": "2026-09-02T10:01:30.000Z",
  "duration_seconds": 90,
  "turns": 2,
  "tool_calls": 1,
  "clean_session": true
}
```

---

**样例说明**：
- 本样例为模拟录制，展示完整流程
- 实际录制需运行真实客户端
- 关键验证：盲测隔离、工具调用、期望对照
