# T-027 Phase 1 基建文档

## 概述

T-027 双 SHA 对照基建，用于验证 guidance 迁移（B0 → M2）的行为等价性。

**关键时序**：必须在 05-00 Profile 合入前执行，保证 SHA B 不含 Profile 变量。

---

## 双 SHA 定义

| SHA | 描述 | Commit | 状态 |
|-----|------|--------|------|
| **SHA A** | B0 基线 | 45a86e15 | B0-s 结构基线，无 Profile |
| **SHA B** | 收尾后 | 6383e99 | M2 完成 + 收尾，无 Profile |

---

## 目录结构

```
.claude/t027-worktrees/
├── sha-a/                      # SHA A worktree (45a86e15)
├── sha-b/                      # SHA B worktree (6383e99)
├── current-sha.txt             # SHA 指针文件（sha-a 或 sha-b）
├── wrapper.mts                 # MCP server wrapper（读指针启动对应 worktree）
├── smoke-test.mts              # 冒烟验证脚本
├── claude-code-config.json     # Claude Code 配置（lrnev-t027 实例）
├── codex-config.json           # Codex 配置
├── opencode-config.json        # OpenCode 配置
└── README.md                   # 本文档
```

---

## 使用方法

### 1. 切换 SHA

**切换到 SHA A**（B0 基线）：
```bash
echo "sha-a" > .claude/t027-worktrees/current-sha.txt
```

**切换到 SHA B**（M2 收尾后）：
```bash
echo "sha-b" > .claude/t027-worktrees/current-sha.txt
```

### 2. 启动 MCP Server

```bash
tsx .claude/t027-worktrees/wrapper.mts
```

Wrapper 会：
1. 读取 `current-sha.txt` 指针
2. 切换到对应 worktree
3. 启动 `src/mcp/server.ts`

---

## 三客户端配置

### Claude Code

将 `claude-code-config.json` 内容合并到 Claude Code 配置文件：
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`

**注意**：使用独立实例名 `lrnev-t027`，不影响日常发布版配置。

### Codex

配置文件：`codex-config.json`
（待 Codex 具体配置方式确认）

### OpenCode

配置文件：`opencode-config.json`
模型：DeepSeek V4 Flash
（待 OpenCode 具体配置方式确认）

---

## 冒烟验证

### 运行冒烟测试

```bash
tsx .claude/t027-worktrees/smoke-test.mts
```

**验证项**：
1. ✅ SHA A (45a86e15) 能否启动
2. ✅ SHA B (6383e99) 能否启动
3. ✅ wrapper 切换是否正常

### 手工验证（必做）

冒烟测试通过后，手工验证三客户端 headless MCP 工具调用：

**Claude Code**：
1. 启动 Claude Code
2. 确认 `lrnev-t027` MCP server 已连接
3. 测试工具调用（如 `spec_create`）

**Codex**：
1. 配置 Codex 使用 `lrnev-t027`
2. 测试 MCP 工具调用

**OpenCode**：
1. 配置 OpenCode 使用 `lrnev-t027`
2. 测试 MCP 工具调用

---

## Phase 2: Clean Session Harness

### 12 个决策场景

| 场景 ID | 描述 | 预期行为 |
|---------|------|----------|
| E-01 | 建议复用+明确新建 | spec_create |
| E-02 | 建议新建+明确复用 | task_create |
| E-03 | 低风险场景未指定 | spec_get |
| E-04 | 高成本场景未指定 | assess_goal |
| E-05 | 偏好新建后确认 | spec_create |
| E-06a | 用户改变主意-提议时 | task_create |
| E-06b | 用户改变主意-提议时（变体） | task_create |
| E-07 | 明确不建 Spec | null |
| E-08 | 状态机保护 | spec_update |
| E-09 | 伪约束（非真实限制） | spec_get |
| E-10 | new_scene 协议 | scene_create |
| E-11 | other 协议 | null |

### 盲测原则

- 只含用户原话（来自 `tests/fixtures/04-00/*.json`）
- 不添加提示词干预
- 期望答案事后对照
- 全量录制会话日志

### F-03 要求

每客户端 ≥5 explicit sessions

---

## Phase 3: 证据提交

### 证据格式

参考 `dev-docs/ai-guidance-standardization/b2b-evidence-manifest.json`：

```json
{
  "spec": "04-00-agent-e2e-observability",
  "stage": "T-027",
  "baseline_ref": "双 SHA 对照（A=45a86e15 vs B=6383e99）",
  "git_sha": "<运行时 HEAD>",
  "generated_at": "<ISO timestamp>",
  "evidences": [
    {
      "scenario_id": "E-01",
      "client": "claude-code",
      "sha": "sha-a",
      "evidence": {
        "surface_id": "...",
        "action_taken": "...",
        "action_success": true,
        "run_id": "..."
      }
    }
  ]
}
```

### 提交流程

1. 生成证据清单（每客户端 × 每 SHA × 12 场景）
2. 提交 DeepSeek 复审
3. 复审通过后进入 05-00 合入

---

## 时序红线

⚠️ **05-00 Profile 合入必须在 T-027 双 SHA 对照完成后**

**理由**：保证 SHA B (6383e99) 不含 Profile 变量，单变量控制（D-04）

**检查点**：
- SHA A = 45a86e15（B0，无 Profile）✅
- SHA B = 6383e99（M2 收尾，无 Profile）✅
- 05-00 合入后 SHA C 将引入 Profile 变量

---

## 已知坑

### Claude Code `claude -p` 受限

老版 Claude Code CLI 的 `claude -p` 可能不完整启用 MCP 工具。

**验证方式**：
- 手工启动 Claude Code GUI
- 确认 MCP 工具列表可见
- 测试实际工具调用

**fallback**：
- 使用 GUI 手工执行
- 或等待 Claude Code CLI 更新

---

## 维护者

- **创建时间**: 2026-09-02
- **创建人**: Claude Opus 5
- **复审**: DeepSeek（审查方）

---

## 参考文档

- 04-00 最终观测报告：`dev-docs/ai-guidance-standardization/04-00-最终观测报告.md`
- 四阶段证据清单：`dev-docs/ai-guidance-standardization/b*-evidence-manifest.json`
- 05-00 requirements：`.lrnev/scenes/04-ai-guidance-standardization/specs/05-00-lrnev-guidance-profile/requirements.md`
