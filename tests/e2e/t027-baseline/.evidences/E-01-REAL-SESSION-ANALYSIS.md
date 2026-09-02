# T-027 E-01 真实会话录制

## 会话信息

- **Session ID**: 32007855-13f3-418e-a223-d346c11250bd
- **时间戳**: 2026-09-02T09:42:51.158Z
- **模型**: claude-sonnet-5[1m]
- **SHA**: 当前主分支（非 SHA A/B worktree）

---

## 用户输入（盲测 prompt）

```
开新 Spec 做用户登录功能
```

---

## AI 行为分析

### 实际行为
AI **未直接调用 spec_create**，而是：
1. 调用了 `project_status` 工具（获取当前 scene 结构）
2. 分析了现有 5 个 scene
3. **询问用户确认** scene 归属：
   - 创建新 scene "用户认证"？
   - 放入 00-default？
   - 还是测试用例？

### 关键发现

**AI 的思考过程**（thinking tokens）：
```
"用户登录"如果是为 lrnev-govern 项目本身添加认证功能，理论上可能是一个新的业务域。
但更可能的是用户在做测试或演示。

我应该询问用户确认：
1. 这个"用户登录功能"是用于什么场景的？
2. 应该归入哪个 scene？还是需要创建新的 scene？

不过，用户说的很明确"开新 Spec"，我应该先直接执行...

让我先问一下用户，这样比较稳妥。
```

### 对照 E-01 期望

**期望行为**（fixture）:
- expectedAction: `spec_create`
- expectedTarget: 创建 Spec B (user-login)
- prohibitedAction: `task_create` on Spec A

**实际行为**:
- ❌ **未执行 spec_create**
- ✅ 尊重了用户明确意图（"开新 Spec"）
- ⚠️  但因为缺少 scene 归属信息，选择询问而非执行

---

## 根本问题：Fixture 缺少 Scene 信息

### E-01 fixture.decisionContext 现状
```typescript
decisionContext: {
  scene: '01-user-management',  // ← fixture 指定了 scene
  existing_specs: ['00-introduction (in-progress)'],
  spec_count: 1,
  last_update: '2 hours ago'
}
```

### 实际项目状态
```json
{
  "scenes": [
    "00-default",
    "01-findings-remediation",
    "02-context-delivery",
    "03-workspace-hygiene",
    "04-ai-guidance-standardization"
  ]
}
```

**问题**: 
- Fixture 假设存在 `01-user-management` scene
- 实际项目无此 scene
- AI 无法确定 spec 归属，选择询问

---

## 工具调用序列（真实）

### 1. project_status
```json
{
  "type": "tool_use",
  "name": "mcp__lrnev-t027__project_status",
  "input": {}
}
```

**返回**: 5 个 scene，无 user-management

---

## 24 字段证据记录

```json
{
  "scenario_id": "E-01",
  "run_id": "run-32007855-13f3-418e",
  "git_sha": "main (非 SHA A/B worktree)",
  "tool_sequence": ["project_status"],
  "action_taken": null,
  "action_success": false,
  "severity": "high",
  "session_clean": true,
  "client": "claude-code",
  "model_version": "claude-sonnet-5[1m]",
  "mcp_version": "2024-11-05",
  "consumed_at": "2026-09-02T09:42:51.158Z",
  "failure_category": "missing_scene_context",
  
  "user_decision_override": true,
  "decision_context": null,
  "surface_id": "server_instructions:global:workflow_overview",
  "content_hash": null,
  "consumer_type": "model"
}
```

---

## 判定

### 期望 vs 实际
- ❌ **未通过** - AI 未执行 spec_create
- ⚠️  **根因**: Fixture 工作区构建未完成（scene 不存在）

### 修正方向

**Harness 必须**:
1. ✅ 读取 fixture.decisionContext
2. ✅ 创建 scene (`01-user-management`)
3. ✅ 创建 existing_specs (`00-introduction`)
4. ✅ 设置 spec status (`in-progress`)
5. ✅ 验证工作区状态（precheck）
6. ✅ 然后再注入 prompt

**本次失败原因**: 
- 直接在主分支运行（非 worktree）
- 未构建 fixture 工作区
- AI 面对真实项目状态（无 user-management scene）

---

## 性能指标

- **TTFT**: 9209 ms
- **总耗时**: 39099 ms
- **Turns**: 2
- **Token 使用**:
  - Input: 8979
  - Output: 1207
  - Cache Read: 61802
  - Cache Creation: 58927
- **成本**: $0.285

---

## 下一步修正

1. ✅ 真实会话已录制
2. ❌ 场景失败（预期，缺少工作区构建）
3. ⏳ 实现 harness 工作区构建
4. ⏳ 重新测试 E-01（构建工作区后）

---

**创建时间**: 2026-09-02  
**状态**: 真实执行完成，发现工作区构建缺失问题
