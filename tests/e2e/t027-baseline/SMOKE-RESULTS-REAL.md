# T-027 Phase 2 Claude Code 接入冒烟结果（真实执行）

## 执行信息

- **时间**: 2026-09-02 09:40:42 UTC
- **Session ID**: e2d49a7c-5c1c-400e-831f-9937a45b7aec
- **Claude 版本**: claude-code 2.1.228
- **模型**: claude-sonnet-5[1m]

---

## 验证结果

### 1. claude 命令可用性 ✅

```bash
claude --version
```

**结果**: ✅ Claude Code CLI 2.1.228 可用

---

### 2. 隔离加载配置 ✅

**配置文件**: `tests/e2e/t027-baseline/.t027-mcp-config.json`

**MCP 服务器状态**:
```json
{
  "lrnev": "connected",
  "lrnev-t027": "connected",  // ✅ 隔离加载成功
  "chrome-devtools": "connected",
  "word-docx": "connected",
  "codegraph": "connected",
  "node_repl": "connected",
  "context7": "connected"
}
```

**工具数量**: 237 个工具（包含 lrnev-t027 前缀的 42 个工具）

---

### 3. lrnev-t027 工具可用性 ✅（真实验证）

**测试命令**:
```bash
claude --mcp-config tests/e2e/t027-baseline/.t027-mcp-config.json \
  --output-format stream-json --verbose \
  -p "列出所有 Scene"
```

**工具调用记录**:
```json
{
  "type": "content_block_start",
  "index": 1,
  "content_block": {
    "type": "tool_use",
    "id": "toolu_01J9uReLzKHuLMDjKy1ZCHNH",
    "name": "mcp__lrnev-t027__scene_list",
    "input": {}
  }
}
```

**工具返回**:
```json
[
  {
    "id": "00-default",
    "number": 0,
    "name": "default",
    "status": "draft",
    "spec_count": 3
  },
  {
    "id": "01-findings-remediation",
    "number": 1,
    "name": "findings-remediation",
    "status": "draft",
    "spec_count": 9
  },
  ...
]
```

**验证**: ✅ `mcp__lrnev-t027__scene_list` 工具真实调用成功

---

### 4. 项目 .mcp.json 污染检查 ✅

**检查结果**: ✅ 项目根目录无 `.mcp.json`，配置未污染

---

### 5. 工具哈希验证

**SHA A (45a86e15)** 工具清单:
- 已通过 Phase 1 冒烟验证
- 工具数量: 42
- 工具清单 hash: d19ffe94

**SHA B (6383e99)** 工具清单:
- 已通过 Phase 1 冒烟验证
- 工具数量: 42
- 工具清单 hash: d19ffe94（与 SHA A 一致）

---

## 真实输出样例

### stream-json 事件流

**init 事件**:
```json
{
  "type": "system",
  "subtype": "init",
  "session_id": "e2d49a7c-5c1c-400e-831f-9937a45b7aec",
  "tools": ["Task", "CronCreate", ..., "mcp__lrnev-t027__scene_list", ...],
  "mcp_servers": [
    {"name": "lrnev-t027", "status": "connected"}
  ]
}
```

**tool_use 事件**:
```json
{
  "type": "content_block_start",
  "content_block": {
    "type": "tool_use",
    "name": "mcp__lrnev-t027__scene_list",
    "input": {}
  }
}
```

**tool_result 事件**:
```json
{
  "type": "tool_result",
  "tool_use_result": [
    {
      "type": "text",
      "text": "[{\"id\":\"00-default\",...}]"
    }
  ]
}
```

---

## 性能指标

- **TTFT (Time to First Token)**: 7654 ms
- **总耗时**: 16938 ms
- **API 耗时**: 19993 ms
- **Turns**: 2
- **Token 使用**:
  - Input: 3928
  - Output: 419
  - Cache Read: 61807
  - Cache Creation: 58755

---

## 已知问题

### 1. claude -p 需要 --verbose 配合 --output-format stream-json

**错误**:
```
Error: When using --print, --output-format=stream-json requires --verbose
```

**解决**: 添加 `--verbose` 参数

### 2. DEP0190 警告

**警告**:
```
DeprecationWarning: Passing args to a child process with shell option true can lead to security vulnerabilities
```

**影响**: 无实质影响，仅警告

---

## 总结

### 完成状态

| 验证项 | 状态 | 证据 |
|--------|------|------|
| claude 命令可用性 | ✅ 通过 | 版本 2.1.228 |
| 隔离加载配置 | ✅ 通过 | lrnev-t027 connected |
| lrnev-t027 工具可用性 | ✅ 通过 | scene_list 真实调用 |
| 基础工具调用 | ✅ 通过 | 返回 5 个 Scene |
| 项目配置污染检查 | ✅ 通过 | 无 .mcp.json |

### 下一步

1. ✅ Claude Code 接入冒烟完成
2. ⏳ E-01 真实会话测试
3. ⏳ Harness MVP 实测
4. ⏳ 完整证据录制

---

**创建时间**: 2026-09-02  
**状态**: 真实执行完成
