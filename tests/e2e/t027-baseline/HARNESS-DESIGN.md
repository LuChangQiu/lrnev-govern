# T-027 Phase 2 Clean Session Harness 设计

## 概述

Clean Session Harness 用于驱动客户端执行 12 个决策场景的盲测，验证双 SHA（A=45a86e15 vs B=6383e99）下的行为等价性。

---

## 核心设计原则

### 1. 盲测隔离

**prompt 只读 userInput**：
- Harness 从 fixture.userInput 构建 prompt
- 不注入 expectedAction/Target/prohibited
- 不注入 expectedDecisionContext（SHA A/B 无此参数）

**期望字段零注入**：
- fixture.expectedAction 仅用于事后对照
- fixture.prohibitedAction 仅用于失败判定
- 执行者不可见期望答案

### 2. E-06b 分轮注入

E-06b 场景特殊处理：
```
第1轮：注入 userInput 第1轮（"开新 Spec 做用户登录"）
  ↓
等待 AI 执行 spec_create(B)
  ↓
第2轮：注入 userInput 第2轮（"算了，还是在登录 Spec 里补充"）
```

**实现**：
- Harness 监听 MCP tool calls
- 检测 spec_create 成功后再注入第2轮

### 3. 工作区构建器

**构建逻辑**：
- 读取 fixture.decisionContext
- 创建 existing_specs（如 "01-00-user-login (in-progress)"）
- 设置 scene 状态

**示例（E-01）**：
```json
{
  "scene": "01-user-management",
  "existing_specs": ["00-introduction (in-progress)"],
  "spec_count": 1,
  "last_update": "2 hours ago"
}
```

Harness 需：
1. 创建 scene "01-user-management"
2. 创建 spec "00-introduction"，设置 status=in-progress
3. 设置 last_update 元信息

### 4. 预检（Precheck）

**目的**：验证场景前提未失效

**流程**：
1. 构建工作区后，调用 assess_goal（传入 fixture.userInput）
2. 获取服务端建议方向
3. 对照 fixture.aiGuidance 预期
4. 如果不符，报错并跳过场景

**示例（E-01）**：
- 场景前提：AI 建议 reuse_spec（因为有 in-progress Spec）
- 用户明确：new_spec
- 预检：assess_goal 应返回 "reuse_spec" 建议
- 如果返回 "new_spec"，说明场景前提失效

---

## 24 字段证据契约

### A类：工具元数据
- `surface_id`: 工具表面 ID
- `content_hash`: 内容 hash（SHA B 时填充）
- `consumer_type`: 'model' | 'client'

### B类：决策与动作
- `decision_context`: 决策上下文（SHA A/B 为 null，05-00 后填充）
- `user_decision_override`: 是否用户决策覆盖
- `tool_sequence`: 工具调用序列
- `action_taken`: 实际动作
- `action_success`: 是否成功
- `severity`: 严重度

### C类：运行环境
- `consumed_at`: 消费时间
- `trigger_context`: 触发上下文
- `prompt_id`: prompt ID
- `client`: 客户端名称
- `model_version`: 模型版本

### 元信息
- `scenario_id`: 场景 ID
- `fixture_hash`: fixture hash
- `run_id`: 运行 ID
- `mcp_version`: MCP 协议版本
- `git_sha`: Git SHA（45a86e15 或 6383e99）
- `session_clean`: 是否 clean session
- `failure_category`: 失败分类（可选）

---

## 客户端驱动方式

### Claude Code（优先）

**headless 模式**：
```bash
claude --mcp-config /path/to/t027-config.json -p "用户 prompt"
```

**隔离加载原则**：
- 使用 `--mcp-config` 指定独立配置
- 不污染项目根 `.mcp.json`
- lrnev-t027 与日常 lrnev 工具同名会冲突

**工具可用性验证**：
```bash
claude --mcp-config /path/to/t027-config.json -p "列出可用工具"
```

### Codex / OpenCode（待实施）

配置格式待验证后实施。

---

## 执行流程

### 1. 初始化
```bash
# 设置 SHA
export T027_SHA=sha-a

# 设置客户端
export T027_CLIENT=claude-code

# 运行 harness
node tests/e2e/t027-baseline/clean-session-harness.mjs
```

### 2. 单场景流程

```
加载 fixture (E-01)
  ↓
构建工作区（existing_specs, scene）
  ↓
预检（assess_goal 验证场景前提）
  ↓
循环 5 次 clean session:
  - 构建盲测 prompt（只读 userInput）
  - 驱动客户端执行
  - 录制 24 字段证据
  - 清理工作区
  ↓
保存证据到 .evidences/
```

### 3. 证据输出

**目录结构**：
```
tests/e2e/t027-baseline/.evidences/
├── t027-sha-a-claude-code.json     # SHA A + Claude Code 证据清单
├── t027-sha-b-claude-code.json     # SHA B + Claude Code 证据清单
└── sessions/                        # 会话录制（可选）
    ├── E-01-sha-a-run-001.jsonl
    └── ...
```

**证据清单格式**：
```json
[
  {
    "scenario_id": "E-01",
    "run_id": "run-1234567890-abc123",
    "git_sha": "45a86e15",
    "tool_sequence": ["spec_create"],
    "action_taken": "spec_create",
    "action_success": true,
    ...
  },
  ...
]
```

---

## 关键注意事项

### 盲测污染防护
- ❌ 不得在 prompt 中提及 expectedAction
- ❌ 不得在工作区中预创建目标 Spec
- ✅ 只读 userInput，期望答案事后对照

### E-06b 分轮保证
- ❌ 不得一次性注入两轮 prompt
- ✅ 必须监听 spec_create(B) 成功后再注入第2轮

### 预检失效处理
- 如果 assess_goal 返回方向与场景前提不符，报错并跳过
- 记录失效原因到证据中

### 工作区清理
- 每次 session 后必须清理到干净状态
- 避免残留 Spec/Task 影响下次 session

---

## 下一步实施

1. ✅ Harness 框架（本文档）
2. ⏳ Claude Code 真实接入冒烟
3. ⏳ 1 次真实会话录制样例
4. ⏳ 放量执行（12 场景 × 2 SHA × 5 sessions = 120 次）

---

**创建时间**: 2026-09-02  
**作者**: Claude Opus 5
