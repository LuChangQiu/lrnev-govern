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
tests/e2e/t027-baseline/          # 入库版本（受控）
├── wrapper.mjs                   # MCP server wrapper
├── smoke-test.mjs                # 冒烟验证（真实 MCP 握手）
├── mcp-entry.mjs                 # MCP 垫片入口
├── current-sha.txt               # 指针文件说明（真实文件在 .claude/）
├── claude-code-config.json       # Claude Code 配置
├── codex-config.toml             # Codex 配置（草稿）
├── opencode-config.md            # OpenCode 配置（草稿）
└── README.md                     # 本文档

.claude/t027-worktrees/           # 运行时文件（gitignore 区）
├── sha-a/                        # SHA A worktree (45a86e15)
├── sha-b/                        # SHA B worktree (6383e99)
├── mcp-entry.mjs                 # MCP 垫片入口（从入库版本自动复制）
└── current-sha.txt               # SHA 指针文件（sha-a 或 sha-b）
```

---

## 使用方法

### 1. 创建 Worktrees（首次运行）

```bash
# 从项目根目录运行
git worktree add .claude/t027-worktrees/sha-a 45a86e15
git worktree add .claude/t027-worktrees/sha-b 6383e99

# 创建指针文件（默认 SHA A）
echo "sha-a" > .claude/t027-worktrees/current-sha.txt
```

### 2. 依赖策略

**SHA A (45a86e15) 依赖解析**：
- 依赖 node_modules 上溯到主仓库（worktree 在主仓库内）
- SHA A 时代依赖版本：已在主仓库 node_modules 中
- **验证要求**：SHA A 必须真实启动成功（npm install 已在主仓库完成）

**SHA B (6383e99) 依赖解析**：
- 同 SHA A，依赖主仓库 node_modules
- 869/869 测试已验证依赖完整

### 3. 切换 SHA

**切换到 SHA A**（B0 基线）：
```bash
echo "sha-a" > .claude/t027-worktrees/current-sha.txt
```

**切换到 SHA B**（M2 收尾后）：
```bash
echo "sha-b" > .claude/t027-worktrees/current-sha.txt
```

### 4. 启动 MCP Server

```bash
# 从项目根目录运行
node tests/e2e/t027-baseline/wrapper.mjs
```

Wrapper 会：
1. 读取 `.claude/t027-worktrees/current-sha.txt` 指针
2. 切换到对应 worktree
3. 通过垫片入口启动 MCP server（调用 startMcpServer()）

---

## 冒烟验证

### 运行冒烟测试（真实 MCP 握手）

```bash
# 从项目根目录运行
node tests/e2e/t027-baseline/smoke-test.mjs
```

**验证项**：
1. ✅ SHA A (45a86e15) 能否启动并完成 MCP initialize 握手
2. ✅ SHA B (6383e99) 能否启动并完成 MCP initialize 握手
3. ✅ tools/list 返回工具清单
4. ✅ 按 SHA 记录工具清单摘要（验证单变量）

**不依赖超时假阳性**：
- 真实 stdio 通信
- 验证 initialize response
- 验证 tools/list response
- 记录工具清单 hash

**输出**：
- 工具清单摘要保存在 `tests/e2e/t027-baseline/.smoke-results/tools-summary.json`

---

## 放量与统计脚本（tools/scripts）

T-027 放量（数十至上百 clean session）与 F-04 门禁判定统计由仓库根 `scripts/` 两个工具承担：

**`scripts/t027-batch-runner.mjs`**：放量批次编排器（零依赖，仅 node 内置模块）。逐 session 以单 session 等价命令跑真实 harness，按 exit code 分类（0=PASS / 1=FAIL / 2=SKIP / 4=ANOMALY），失败做退避重试；session 后跑 validator strict（0 ERROR 才算 VALID）。产物写入 `.claude/t027-batch/<label>/`（gitignore 区：run.log、summary.json、sessions 日志）。

```bash
# 全 12 场景 × sha-a × 5 次（预算上限 $50）
node scripts/t027-batch-runner.mjs --all --sha sha-a --reps 5 --budget-usd 50 --label claude-sha-a-full
# 单场景单次（预算 $0.5，自测）
node scripts/t027-batch-runner.mjs --scenarios E-07 --sha sha-a --reps 1 --label claude-sha-a-selftest --budget-usd 0.5
# 预演（不真实调用）
node scripts/t027-batch-runner.mjs --scenarios E-01,E-07 --sha sha-a --reps 2 --dry-run
```

**`scripts/t027-f04-stats.mjs`**：对放量 evidence（契约 v2，`.evidences/e-<scenario>-<ts>-<rand>.json`）做 F-04 判定统计——每 场景×sha_label×client 的 session 汇总（PASS/FAIL/ANOMALY/OBSERVE）、消费率方差、FAIL 的 F-04 A-E 候选分类提示（启发式，最终 failure_class 由复审填写）、双 SHA 对照表。

```bash
node scripts/t027-f04-stats.mjs tests/e2e/t027-baseline/.evidences
node scripts/t027-f04-stats.mjs <file-or-dir>... --scenario E-01,E-02 --sha sha-b --json
```

> 两工具的判定语义规则表见各脚本头部 docstring（E-07/E-11 无期望动作口径、E-08 预期失败口径、E-02 v2 家族口径、E-06 sidecar verdict 优先等），改动判定前先读。

---

## 三客户端配置

### Claude Code

**配置文件**：`claude-code-config.json`

将内容合并到 Claude Code CLI 配置文件：
- 项目根目录：`.mcp.json`（推荐）
- 或全局：`~/.config/claude/mcp.json`

**注意**：
- 使用独立实例名 `lrnev-t027`，不影响日常发布版配置
- command 使用 node（无 PATH 依赖）
- args 指向入库 wrapper.mjs 绝对路径

### Codex（草稿，待验证）

配置文件：`codex-config.json`
状态：格式草稿，未实测（需改为 TOML 格式）

### OpenCode（草稿，待验证）

配置文件：`opencode-config.json`
模型：DeepSeek V4 Flash
状态：格式草稿，未实测（需改为 mcp 数组格式）

---

## Phase 2: Clean Session Harness

### 12 个决策场景

| 场景 ID | 描述 |
|---------|------|
| E-01 | 建议复用+明确新建 |
| E-02 | 建议新建+明确复用 |
| E-03 | 低风险场景未指定 |
| E-04 | 高成本场景未指定 |
| E-05 | 偏好新建后确认 |
| E-06a | 用户改变主意-提议时 |
| E-06b | 用户改变主意-提议时（变体） |
| E-07 | 明确不建 Spec |
| E-08 | 状态机保护（spec_update 非法状态转换） |
| E-09 | 旧 Spec 未更新：先读再建议（非去伪约束） |
| E-10 | new_scene 协议 |
| E-11 | other 协议 |

**注意**：
- E-08/E-09 描述已按 04-00 design D-01 修正

### 盲测原则

- 只含用户原话（来自 `tests/fixtures/04-00/*.json` 的 `userInput`）
- 不添加提示词干预
- 不向执行者展示预期答案
- 期望答案事后对照
- 全量录制会话日志

### F-03 要求

每客户端 ≥5 explicit sessions

---

## Phase 3: 证据提交

### 证据格式（占位示例，待实施时完善）

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

**注意**：此为占位示例，实际证据格式待 Phase 2 实施时完善。

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

## 维护者

- **创建时间**: 2026-09-02
- **创建人**: Claude Opus 5
- **复审**: DeepSeek（审查方）
- **修订**: 2026-09-02（修复 P0①②③⑤ + P1⑥⑦⑧）

---

## 参考文档

- 04-00 最终观测报告：`dev-docs/ai-guidance-standardization/deliverables/04-00-final-observation-report.md`
- 04-00 design：`.lrnev/scenes/04-ai-guidance-standardization/specs/04-00-agent-e2e-observability/design.md`
- 四阶段证据清单：`dev-docs/ai-guidance-standardization/evidence/b*-evidence-manifest.json`
- 05-00 requirements：`.lrnev/scenes/04-ai-guidance-standardization/specs/05-00-lrnev-guidance-profile/requirements.md`
