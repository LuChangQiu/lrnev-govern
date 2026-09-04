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

### 2. E-05/E-06a/E-06b 真实续接双轮（resume-2-rounds，裁决 2026-09-04 + B4 P5）

E-05/E-06a/E-06b 场景特殊处理（多轮语义场景不再单次注入；E-06b 原 split 分轮注入已随 B4 P5 作废）：
```
round1：claude -p（persist）注入 userInput 首句（真实对话第 1 话轮）
  ↓ （会话落盘，记录 session_id）
round2：claude -p --resume <session_id> 注入 userInput 次句（真实对话第 2 话轮）
```

**E-06a/E-06b 特有点**：
- E-06b：round1 后校验 B 真实创建（spec_create 落盘），未建 → ANOMALY（exit 4）；round2 后做 B 存在性检查。
- E-06a：round1 若已建 B = 抢跑观察（单独记录），非 FAIL 依据。
- E-06 v2 判定（E-06a/b 共用）：PASS = 无破坏动作 && B 保持存在 && task_create(A) 命中（零动作 ≠ PASS）。

**实现**：
- 首轮 `{ persist: true }` 落盘会话；次轮 `--resume <session_id>` 续接同一会话
- 续接核验：round2 init session_id === round1 session_id（不一致 = 基础设施异常 ANOMALY）

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

> 注：早期设计期骨架（.mjs 混 TS 语法不可运行、客户端 mock 过期）已删除，
> 由真实实现 `harness-mvp.mjs` 取代，启动命令见下。

```bash
# 设置场景与 SHA（sha-a | sha-b）
export T027_SCENARIO=E-01
export T027_SHA=sha-a

# 运行 harness（真实实现）
npx tsx tests/e2e/t027-baseline/harness-mvp.mjs
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

### E-05/E-06a/E-06b 多轮语义保证
- ❌ 不得一次性注入两轮 prompt（单条消息压两话轮 → 模型按首句回复/治理反问，artifact）
- ✅ round1（persist）→ `--resume` 续接同一会话 → round2；E-06b 另须 round1 真实 spec_create(B) 后再进 round2

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
