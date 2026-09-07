---
title: Client Integration Guide - lrnev Guidance Profile v1
version: v1.0
status: stable
scene: 04-ai-guidance-standardization
spec: 06-00-guidance-documentation
created: 2026-09-02
---

# 06-00 Client Integration Guide

## 1. 文档状态与适用范围

本文档面向 MCP 客户端实现者，说明如何正确集成 lrnev-govern MCP 服务端，包括如何保留用户原话、何时传递 decision_context、如何消费 content/structuredContent、如何处理真实 Constraint。

**版本状态**: v1.0，2026-09-02 发布  
**适用对象**: Claude Code、Codex、以及其他 MCP 客户端实现者  
**依赖规范**: MCP Response Conformance、01-00 Semantic Authority Model v0.1、03-00 M1/M2 迁移

## 2. 核心集成契约（F-03）

### 2.1 保留原始用户请求

**契约**: 客户端必须保留用户原话，不改写、不推断、不用自己的理解替代用户表达。

**错误示例**:
```
用户: "我想做一个登录功能"
客户端改写: "开新 Spec 实现用户认证模块" // ❌ 不应改写
```

**正确示例**:
```
用户: "我想做一个登录功能"
客户端传递: "我想做一个登录功能" // ✅ 原话保留
```

**原因**: 用户的原话是 decision_context 的唯一可靠来源（`user_quote`）。改写会丢失用户意图的细微差别，导致服务端无法准确判断用户是否明确了方向。

### 2.2 decision_context 传递规则

**decision_context 是 client_asserted 声明，不是服务端事实**（三句红线之一）。

#### 2.2.1 四工具传递规则

**仅以下 4 个工具接受 decision_context**（v1 约定）:
1. `spec_create`
2. `task_create`
3. `scene_create`
4. `assess_goal`

**其他工具不传递 decision_context**（包括但不限于）:
- `spec_update` — 状态变更不需要 decision_context
- `spec_get` / `spec_list` — 查询操作不需要
- `task_update` — 任务状态变更不需要
- 所有其他查询、更新、删除工具

#### 2.2.2 decision_context 结构

> **注记（2026-09-07，研究文档修正）**：本节成稿于 2026-09-02（06-00 研究期），早于实现定稿，与当前实现不一致，**仅作研究追溯，集成实现一律以源码为准**（`src/mcp/types/decision-context-schema.ts` + `src/types/decision-context.ts` 的 `DecisionContextInput`）。实现版差异：`source`（固定 `client_asserted`）/`strength`/`summary` 必填；`direction` 条件必填——`explicit`/`preferred` 必须提供、`unspecified` 必须**省略**（不接受 `null`）；`target_ref` 可选且须非空；无 `staleness_signals` 字段（那是 04-00 观测形状 `DecisionContext`，见 `src/types/evidence-contract.ts`）；`reported_user_quote`/`user_quote` 已按 T-006 裁决（I6，2026-09-07）移除。§2.2.3 示例中 `direction: null` 的写法已不合法。

```typescript
interface DecisionContext {
  strength: "explicit" | "preferred" | "unspecified";
  direction: "new_spec" | "reuse_spec" | "new_scene" | "no_spec" | "other" | null;
  target_ref?: string;
  staleness_signals?: string[];
}
```

**字段约束**:
- `strength`:
  - `explicit`: 用户明确表达（如"开新 Spec"、"在 XX Spec 里补充"）
  - `preferred`: 用户表达倾向但未强制（如"我倾向于..."）
  - `unspecified`: 用户未指定方向
  
- `direction`:
  - `explicit` / `preferred` **必须**提供 direction（不能为 null）
  - `unspecified` **必须**省略 direction（设为 null）
  - 枚举值: `new_spec` / `reuse_spec` / `new_scene` / `no_spec` / `other`

- `target_ref`:
  - 使用完整稳定引用（如 `"scene=01-user-management, spec=01-00-user-login"`）
  - 不使用序号前缀（避免歧义）

- `staleness_signals`:
  - 可选：提示当前上下文可能过期的信号
  - 示例: `["long time since update", "status=completed"]`

#### 2.2.3 传递示例

**场景 E-01: 明确新建 Spec**
```typescript
// 用户: "开新 Spec 做用户登录功能"
const result = await client.callTool("spec_create", {
  scene: "01-user-management",
  name: "user-login",
  decision_context: {
    strength: "explicit",
    direction: "new_spec",
    target_ref: "user-login"
  }
});
```

**场景 E-02: 明确复用 Spec**
```typescript
// 用户: "继续在登录 Spec 里补充用户登录"
const result = await client.callTool("task_create", {
  scene: "01-user-management",
  spec: "01-00-user-login",
  title: "实现用户登录",
  decision_context: {
    strength: "explicit",
    direction: "reuse_spec",
    target_ref: "scene=01-user-management, spec=01-00-user-login"
  }
});
```

**场景 E-03: 未指定方向**
```typescript
// 用户: "做用户登录功能"（未明确新建还是复用）
const result = await client.callTool("assess_goal", {
  goal: "做用户登录功能",
  decision_context: {
    strength: "unspecified",
    direction: null  // 必须省略 direction
  }
});
```

**场景 E-07: 明确不建 Spec**
```typescript
// 用户: "不用开 Spec，直接回答问题：lrnev 的 Scene 是什么？"
// 不调用 spec_create/scene_create，只进行对话
// 如需记录决策边界，可使用:
const decision_context = {
  strength: "explicit",
  direction: "no_spec"
};
// 但不传递给工具调用（因为没有工具调用）
```

### 2.3 缺失字段不推断

**契约**: 客户端不得推断缺失的字段值。

**错误示例**:
```typescript
// ❌ 不应推断 current_status
const result = await client.callTool("spec_update", {
  scene: "01-user-management",
  spec: "01-00-user-login",
  status: "completed",
  current_status: "in-progress"  // ❌ 服务端会自己检查当前状态
});
```

**正确示例**:
```typescript
// ✅ 只传递必需字段
const result = await client.callTool("spec_update", {
  scene: "01-user-management",
  spec: "01-00-user-login",
  status: "completed"
});
```

**原因**: 服务端会自己检查当前状态并验证状态机转换。客户端推断的值可能过期或错误，导致不必要的错误。

## 3. 内容消费优先级（F-03）

### 3.1 推荐消费顺序

```typescript
function consumeToolResult(result: ToolResult) {
  // 1. 先检查是否错误
  if (result.isError) {
    const error = result.structuredContent as ErrorResult;
    handleError(error.error_code, error.error_field, error.hint);
    return;
  }
  
  // 2. 优先消费 structuredContent（完整数据）
  if (result.structuredContent) {
    const data = result.structuredContent as ToolResultData;
    updateUI(data.data);  // 更新 UI
    syncState(data.meta); // 同步状态
    return;
  }
  
  // 3. fallback: 解析 content（不推荐，仅兼容）
  parseContentText(result.content);
}
```

### 3.2 structuredContent 数据结构

**成功响应**:
```typescript
{
  success: true,
  data: {
    // 工具特定数据
    spec_id: "01-00-user-login",
    scene_id: "01-user-management",
    // ...
  },
  meta: {
    timestamp: "2026-09-02T06:03:14.531Z",
    // 其他元信息
  }
}
```

**错误响应**:
```typescript
{
  success: false,
  error_code: "INVALID_STATUS_TRANSITION",
  error_field: "status",
  hint: "archived Spec 不能转换为 in-progress",
  current_value: "archived",
  attempted_value: "in-progress"
}
```

### 3.3 content 使用场景

**推荐用途**:
- 人类可读显示（日志、控制台输出）
- LLM 上下文（对话历史、提示词）
- 调试和审计（保留原始文本）

**不推荐用途**:
- ❌ 作为主要数据源（应使用 structuredContent）
- ❌ 解析为 JSON（B2b+ 已废弃 legacy JSON 约定）
- ❌ 作为 UI 数据绑定来源（结构不稳定）

## 4. 处理真实 Constraint（F-02）

### 4.1 识别真实 Constraint

参考 01-00 Semantic Authority Model 第 6 节，只有以下情况是服务端真实 Constraint：

| 约束 | 错误码 | 处理方式 |
|------|--------|----------|
| Spec 状态机保护 | `INVALID_STATUS_TRANSITION` | 展示错误，提示合法转换路径 |
| 父任务不存在 | `TASK_NOT_FOUND` (field: `parent`) | 提示先创建父任务或移除引用 |
| 依赖任务不存在 | `TASK_NOT_FOUND` (field: `depends_on`) | 提示先创建依赖或修正引用 |
| validates 锚点不存在 | `ANCHOR_NOT_FOUND` | 提示使用真实存在的 F-xx / D-xx 编号 |
| 必填参数缺失 | `INVALID_INPUT` | 提示补齐必填字段 |

### 4.2 Constraint vs Recommendation

**Constraint（执行约束）**:
- 服务端强制执行
- 违反时返回 `isError: true`
- 客户端必须尊重（不能绕过）

**Recommendation（建议）**:
- 服务端建议但不强制
- 用户明确要求其他合法动作时让位
- 客户端应展示但允许用户覆盖

**示例对比**:
```typescript
// Constraint: archived Spec 不能转换为 in-progress
// 客户端应该:
if (error.error_code === "INVALID_STATUS_TRANSITION") {
  showError("状态机不允许该转换");
  suggestAlternatives(["创建新 Spec", "查看 archived Spec 内容"]);
  // ✅ 不提供"强制转换"选项（因为服务端会拒绝）
}

// Recommendation: 已有相近 Spec，建议复用
// 客户端应该:
if (response.has_similar_specs) {
  showRecommendation("已有相近 Spec，建议复用");
  offerChoices([
    "在现有 Spec 下创建 Task",
    "创建新 Spec"  // ✅ 仍然提供新建选项（合法动作）
  ]);
}
```

### 4.3 错误处理流程

```typescript
function handleToolError(result: ToolResult) {
  const error = result.structuredContent as ErrorResult;
  
  // 1. 提取错误信息
  const { error_code, error_field, hint, current_value, attempted_value } = error;
  
  // 2. 显示错误
  console.error(`[${error_code}] ${hint}`);
  if (error_field) {
    console.error(`  字段: ${error_field}`);
  }
  if (current_value && attempted_value) {
    console.error(`  当前值: ${current_value}, 尝试值: ${attempted_value}`);
  }
  
  // 3. 提供合法替代动作
  const alternatives = suggestAlternatives(error_code, error_field);
  console.log("可选操作:");
  alternatives.forEach(alt => console.log(`  - ${alt}`));
  
  // 4. 保留原始错误上下文（用于审计/调试）
  logToAudit({
    error_code,
    error_field,
    hint,
    tool: result.tool_name,
    params: result.params,
    timestamp: new Date().toISOString()
  });
}
```

## 5. 客户端选型与门禁（F-04）

### 5.1 主力客户端选型

**Claude Code 主 + Codex 补**:
- **Claude Code**: 主要开发和验证客户端（覆盖率 ≥1/5）
- **Codex**: 补充验证和兼容性测试（覆盖率 ≥1/5）

**F-04 双客户端门禁**:
- 每个主力客户端必须覆盖 ≥1/5 的决策场景
- 总计至少 2 个主力客户端
- 覆盖至少 40% 的决策场景（2 × 1/5）

### 5.2 兼容性要求

**最低兼容性**:
- 支持 MCP Protocol 2025-11-25
- 能解析 structuredContent（data + meta）
- 能处理 isError 响应
- 能传递 decision_context（4 个工具）

**推荐兼容性**:
- 支持 content MVC 文本视图（Markdown 格式）
- 支持错误码智能提示（根据 error_code 提供合法替代）
- 支持 decision_context 可视化（显示当前决策边界）

## 6. 迁移路径（F-04）

### 6.1 从 B2a（legacy JSON）迁移到 B2b（MVC）

**破坏性变更**:
- content 从完整 JSON 字符串改为 MVC 文本视图
- 客户端必须改为消费 structuredContent

**迁移步骤**:

**步骤 1: 检查依赖**
```bash
# 搜索代码中的 JSON.parse(content[0].text)
grep -r "JSON.parse.*content" src/
```

**步骤 2: 改为消费 structuredContent**
```typescript
// 迁移前（B2a 及之前）
const result = await client.callTool("spec_create", params);
const data = JSON.parse(result.content[0].text); // ❌ 废弃

// 迁移后（B2b+）
const result = await client.callTool("spec_create", params);
const data = result.structuredContent as SpecCreateResult; // ✅ 推荐
```

**步骤 3: 保留 content 用于显示**
```typescript
// content 仍然有用（人类可读）
const result = await client.callTool("spec_create", params);
const data = result.structuredContent as SpecCreateResult;
const humanText = result.content[0].text; // 用于日志/显示

// 显示给用户
console.log(humanText);

// 更新 UI
updateUI(data.data.spec_id, data.data.scene_id);
```

**步骤 4: 验证**
- 运行 B2b 阶段测试套件（12 个决策场景）
- 验证所有场景的 action_taken 与 B2a 一致
- 验证 UI 数据正确（从 structuredContent 获取）
- 验证日志可读（从 content 获取）

### 6.2 回滚路径

**如果迁移失败**:
1. 检查是否有未迁移的 JSON.parse 调用
2. 验证 structuredContent 解析是否正确
3. 如无法立即修复，可暂时回退到 B2a（legacy JSON）
4. B2a 兼容层将在未来版本移除（届时必须迁移）

**B2a 兼容层**（临时）:
```typescript
// 仅用于紧急回滚，不推荐
const result = await client.callTool("spec_create", params);
const data = result.structuredContent || JSON.parse(result.content[0].text);
```

## 7. 枚举级对齐

### 7.1 枚举值不阻断

**契约**: 客户端和服务端的枚举值差异不应阻断协作。

**场景**: 服务端新增 decision_context.direction 枚举值 `"migrate_spec"`

**客户端处理**:
```typescript
type Direction = "new_spec" | "reuse_spec" | "new_scene" | "no_spec" | "other" | string;

function handleDirection(direction: Direction) {
  switch (direction) {
    case "new_spec":
      return "新建 Spec";
    case "reuse_spec":
      return "复用 Spec";
    case "new_scene":
      return "新建 Scene";
    case "no_spec":
      return "不建 Spec";
    case "other":
      return "其他";
    default:
      // ✅ 容错处理未知枚举值
      return `未知方向: ${direction}`;
  }
}
```

**原因**: 服务端可能先于客户端更新枚举值。客户端应该容错处理未知值，而不是崩溃或拒绝。

### 7.2 向后兼容

**服务端职责**:
- 新增枚举值不改变现有值的语义
- 废弃枚举值保留至少一个大版本

**客户端职责**:
- 使用 `string` 而非固定枚举类型（TypeScript）
- 对未知枚举值提供默认处理
- 在日志中记录未知枚举值（用于监控和更新）

## 8. 实施检查清单

### 8.1 必须实施（MUST）

- [ ] 保留原始用户请求（不改写）
- [ ] 仅在 4 个工具传递 decision_context（spec_create / task_create / scene_create / assess_goal）
- [ ] explicit/preferred 必须提供 direction
- [ ] unspecified 必须省略 direction
- [ ] 不推断缺失字段（如 current_status）
- [ ] 优先消费 structuredContent
- [ ] 检查 isError 判断工具调用成功性
- [ ] 识别真实 Constraint 并正确处理错误

### 8.2 推荐实施（SHOULD）

- [ ] content 用于人类可读显示或 LLM 上下文
- [ ] 区分显示 Constraint vs Recommendation
- [ ] 对未知枚举值提供容错处理
- [ ] 记录错误上下文用于审计
- [ ] 缓存 structuredContent schema

### 8.3 禁止行为（MUST NOT）

- [ ] ❌ 不得改写用户原话
- [ ] ❌ 不得在非指定工具传递 decision_context
- [ ] ❌ 不得推断缺失字段
- [ ] ❌ 不得假设 content 是 JSON 字符串（B2b+）
- [ ] ❌ 不得依赖 annotations 做授权判断
- [ ] ❌ 不得把 Recommendation 显示为 Constraint

## 9. 测试与验证

### 9.1 推荐测试场景

**最低覆盖**（双客户端门禁）:
- E-01: 明确新建 Spec（explicit + new_spec）
- E-02: 明确复用 Spec（explicit + reuse_spec）
- E-03: 未指定方向（unspecified）
- E-08: 状态机保护（预期失败）

**完整覆盖**（12 个决策场景）:
- E-01 ~ E-11 + E-06a/E-06b
- 参考 `../dev-docs/ai-guidance-standardization/{b0,b1,b2a,b2b}-evidence-manifest.json`

### 9.2 验证标准

**行为等价性**:
- 客户端行为与 B2b 证据一致（action_taken / action_success）
- 12/12 场景行为符合预期

**数据完整性**:
- structuredContent 数据完整且可解析
- content 文本可读且格式正确
- 错误响应包含 error_code / error_field / hint

**兼容性**:
- 支持 B2b（MVC 渲染器）
- 容错处理未知枚举值
- 向后兼容 B2a（如有兼容层）

## 10. 与其他文档的关系

| 文档 | 关系 | 边界 |
|------|------|------|
| **06-00 MCP Response Conformance** | 本文档基于 Conformance 约束 | Conformance 定义传输，本文档定义集成 |
| **01-00 Semantic Authority Model** | 本文档遵循 Semantic Authority | Semantic 定义语义，本文档定义客户端行为 |
| **03-00 M1/M2 迁移** | 本文档是 M1/M2 迁移的客户端指南 | M1/M2 定义迁移，本文档指导客户端适配 |
| **05-00 Profile (计划)** | Profile 基于本文档集成能力 | 本文档是 v1 基础，Profile 是增强 |

## 11. 更新与维护

### 11.1 版本更新触发

本文档需要更新的情况：
- decision_context 结构变更
- 新增支持 decision_context 的工具
- structuredContent schema 不兼容变更
- 新增错误码或 Constraint

### 11.2 归属与责任

- **Owner**: 04-ai-guidance-standardization / 06-00-guidance-documentation
- **维护者**: lrnev 服务端团队 + 主力客户端团队
- **审查周期**: 每次协议变更或客户端反馈时

---

**生成时间**: 2026-09-02  
**生成人**: Claude Opus 5  
**对应 Spec**: 04-ai-guidance-standardization / 06-00-guidance-documentation  
**状态**: stable
