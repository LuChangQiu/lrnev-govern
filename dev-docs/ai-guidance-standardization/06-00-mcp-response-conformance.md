---
title: MCP Response Conformance - lrnev Guidance Transport
version: v1.0
status: stable
scene: 04-ai-guidance-standardization
spec: 06-00-guidance-documentation
created: 2026-09-02
---

# 06-00 MCP Response Conformance

## 1. 文档状态与适用范围

本文档定义 lrnev-govern MCP 工具响应的结构化传输契约，基于 03-00 M1/M2 迁移成果。它约束 lrnev 服务端如何使用 MCP `content` 和 `structuredContent` 字段、如何表达错误、如何标注响应版本，以及客户端如何正确消费这些通道。

**版本状态**: v1.0，2026-09-02 发布  
**适用对象**: MCP 客户端实现者、lrnev 服务端维护者、适配器开发者  
**依赖规范**: MCP Protocol 2025-11-25、03-00 M1/M2 迁移、01-00 Semantic Authority Model v0.1

## 2. 三句准确性红线

以下三句话是本文档的基础语义边界，必须逐字理解并遵守：

1. **content 是通用非结构化结果通道，structuredContent 是机器可读增强**
2. **Profile 不是 MCP 官方标准**
3. **decision_context 是 client_asserted 声明，不是服务端事实**

违反这三句话的任何实现或文档都构成语义失真。

## 3. MCP Response 结构概览

### 3.1 标准 MCP Tool Result Schema

```typescript
interface ToolResult {
  content: Content[];           // 必需：通用非结构化结果
  structuredContent?: unknown;  // 可选：机器可读增强
  isError?: boolean;            // 可选：标识错误响应
  annotations?: {               // 可选：hints，不是指令
    audience?: string[];
    priority?: number;
  };
}
```

### 3.2 lrnev 实施约定

- **content**: 包含 MVC 文本视图（Model-Visible Contract），人类可读且对 LLM 友好
- **structuredContent**: 包含完整的机器可读数据（data schema + meta），客户端优先消费此字段
- **isError**: 当工具调用失败时为 `true`（如状态机校验失败、输入无效）
- **annotations**: 仅作为 hints，不能作为授权、安全或强制执行依据

## 4. content vs structuredContent 边界

### 4.1 边界定义（F-02）

| 维度 | content | structuredContent |
|------|---------|-------------------|
| **性质** | 通用非结构化文本 | 机器可读结构化数据 |
| **目标受众** | LLM / 人类 | 客户端代码 / 工具 |
| **内容完整性** | MVC 文本视图（语义视图） | 完整数据（data + meta） |
| **MCP 协议地位** | 必需字段 | 可选增强字段 |
| **lrnev 职责** | 逐工具 MVC 渲染器生成 | toMcpToolResult 封装 |

**关键原则**:
- content 不是"structuredContent 的 JSON 字符串化"
- structuredContent 不是"content 的结构化解析"
- 两者是**独立通道**，各有明确受众和用途

### 4.2 历史迁移说明

**B0-B1 (text_v1 迁移)**:
- content: 从摘录文本迁移到完整 text_v1（移除黑名单词汇、修正伪约束）
- 证据: B0 → B1 content_hash 变化（71d1a6be → e8d4bd50）

**B1-B2a (M1: 结构化传输)**:
- 新增 structuredContent（51 个工具接入）
- content 保持 legacy JSON 不变（向后兼容）
- 证据: B1 → B2a content_hash 保持（e8d4bd50 → e8d4bd50）

**B2a-B2b (M2: MVC 渲染器)**:
- content 从 legacy JSON 切换到 MVC 文本视图（42/42 渲染器）
- structuredContent 保持不变
- 证据: B2a → B2b content_hash 保持（e8d4bd50 → e8d4bd50）

### 4.3 消费优先级（F-03）

**客户端推荐消费顺序**:
1. **structuredContent**: 优先解析完整数据，用于 UI 渲染、状态同步、导航
2. **content**: 作为 fallback 或 LLM 上下文，人类可读但不保证结构稳定
3. **isError**: 判断工具调用是否成功，决定错误处理流程

**示例**:
```typescript
// 推荐实现
function consumeToolResult(result: ToolResult) {
  if (result.isError) {
    // 错误处理：从 structuredContent 提取错误码、字段、hint
    const error = result.structuredContent as ErrorResult;
    handleError(error.error_code, error.error_field, error.hint);
    return;
  }
  
  // 正常流程：优先使用 structuredContent
  if (result.structuredContent) {
    const data = result.structuredContent as SpecCreateResult;
    updateUI(data.data.spec_id, data.data.scene_id);
  } else {
    // fallback: 解析 content（不推荐，仅兼容）
    parseContentText(result.content);
  }
}
```

## 5. annotations 语义（F-02）

### 5.1 annotations 仅为 hints

MCP 协议定义的 `annotations` 字段用于提供提示信息，**不能**作为：
- 授权或权限判断依据
- 安全策略执行依据
- 强制行为约束

### 5.2 lrnev 使用场景

当前 lrnev 未使用 `annotations` 字段。如未来使用，必须遵守以下原则：
- `audience`: 仅表示目标受众建议（如 `["model"]` / `["client"]`），不强制隐藏
- `priority`: 仅表示显示优先级建议，不覆盖用户选择或客户端逻辑

## 6. response_version 独立性（F-04）

### 6.1 三个独立版本

| 版本标识 | 定义域 | 当前值 | 变更触发 |
|---------|--------|--------|----------|
| **MCP protocol version** | MCP 标准 | 2025-11-25 | MCP 规范更新 |
| **lrnev response_version** | 应用层响应格式 | v1 | structuredContent schema 变更 |
| **lrnev Profile version** | Profile 适配契约 | v1 (计划) | Profile 能力变更 |

**独立性原则**:
- MCP protocol version 变更不自动触发 response_version 变更
- response_version 变更不自动触发 Profile version 变更
- 三者可以独立演进

### 6.2 response_version 变更历史

**v1 (M2 完成, 2026-09-02)**:
- structuredContent 完整数据 + MVC 文本视图
- 废弃 "content 完整 JSON" 应用层约定
- 破坏性迁移：客户端必须改为消费 structuredContent

**未来计划**:
- v2: 如 structuredContent schema 有不兼容变更时触发

### 6.3 破坏性迁移说明（F-04）

**旧约定（已废弃）**:
```typescript
// B0-B2a: content 包含完整 JSON
const result = await client.callTool("spec_create", params);
const data = JSON.parse(result.content[0].text); // ❌ 已废弃
```

**新约定（M2 后）**:
```typescript
// B2b+: structuredContent 包含完整数据，content 是 MVC 文本
const result = await client.callTool("spec_create", params);
const data = result.structuredContent as SpecCreateResult; // ✅ 推荐
const humanText = result.content[0].text; // 仅用于显示/日志
```

**迁移步骤**:
1. 检查客户端是否依赖 `JSON.parse(content[0].text)`
2. 改为直接消费 `structuredContent`
3. 保留 `content` 仅用于人类可读显示或 LLM 上下文
4. 验证：运行 B2b 阶段测试套件（12 个决策场景）

**回滚路径**:
- B2b 之前的客户端可以继续使用 legacy JSON（B2a 兼容层）
- 未来版本可能移除 legacy 支持，届时必须迁移

## 7. 错误响应契约

### 7.1 错误标识

当工具调用失败时：
```typescript
{
  isError: true,
  content: [{ type: "text", text: "【执行约束】... 错误描述" }],
  structuredContent: {
    success: false,
    error_code: "INVALID_STATUS_TRANSITION",
    error_field: "status",
    hint: "archived Spec 不能转换为 in-progress",
    current_value: "archived",
    attempted_value: "in-progress"
  }
}
```

### 7.2 错误码清单

参考 01-00 Semantic Authority Model 第 6 节真实 Execution Constraint 清单：

| 错误码 | 触发条件 | 错误字段 | 合法替代动作 |
|--------|----------|----------|-------------|
| `INVALID_STATUS_TRANSITION` | 状态机不允许的转换 | `status` | 选择状态机允许的目标状态 |
| `TASK_NOT_FOUND` | 父任务或依赖任务不存在 | `parent` / `depends_on` | 先创建依赖任务或修正引用 |
| `ANCHOR_NOT_FOUND` | validates 锚点不存在 | `validates` | 使用真实存在的 F-xx / D-xx 编号 |
| `INVALID_INPUT` | 必填参数缺失或格式错误 | 具体字段名 | 补齐或修正输入 |

## 8. 客户端实施要求（F-03）

### 8.1 必须实施

- ✅ 优先消费 `structuredContent`（data + meta）
- ✅ 检查 `isError` 判断工具调用成功性
- ✅ 保留 `content` 用于人类可读显示或 LLM 上下文
- ✅ 不依赖 `annotations` 作为授权或强制执行依据
- ✅ 错误时从 `structuredContent` 提取错误码、字段、hint

### 8.2 推荐实施

- 🎯 缓存 `structuredContent` schema 以优化解析性能
- 🎯 对 `content` MVC 文本视图做语法高亮（Markdown 格式）
- 🎯 在 UI 中区分显示 FACT / RECOMMENDATION / EXECUTION_CONSTRAINT

### 8.3 禁止行为

- ❌ 不得假设 `content` 是 JSON 字符串（B2b+ 已废弃）
- ❌ 不得依赖 `annotations` 做授权判断
- ❌ 不得把 `structuredContent` 的存在性作为能力判断（应检查 response_version）

## 9. 验证与测试

### 9.1 B0-B2b 等价性验证

证据来源：`../dev-docs/ai-guidance-standardization/{b0,b1,b2a,b2b}-evidence-manifest.json`

**行为等价性**:
- 12/12 场景 `action_taken` 完全一致（B0 → B1 → B2a → B2b）
- 11/12 场景 `action_success = true`（E-08 预期失败）

**内容演变**:
- B0 → B1: content_hash 变化（text_v1 迁移）
- B1 → B2a: content_hash 保持（M1 未改 content）
- B2a → B2b: content_hash 保持（M2 只改渲染通道）

**消费率稳定性**:
- 11/12 场景消费 `server_instructions:global:workflow_overview`
- 消费率: 91.7%（四阶段稳定）

### 9.2 客户端兼容性测试

**最低要求**:
- 能正确解析 `structuredContent` 中的 data schema
- 能正确处理 `isError = true` 的错误响应
- 能容错处理 `content` 文本（不依赖固定格式）

**推荐测试场景**:
- E-01: 明确用户请求优先于推荐
- E-04: 高成本场景未指定方向
- E-08: 状态机保护（预期失败）

## 10. 与其他规范的关系

| 规范 | 关系 | 边界 |
|------|------|------|
| **MCP Protocol 2025-11-25** | lrnev 实现 MCP 标准 | lrnev 不扩展 MCP 协议字段 |
| **01-00 Semantic Authority Model** | 约束 content 文本语义 | 本文档约束传输通道 |
| **03-00 M1/M2 迁移** | 本文档是 M1/M2 成果文档化 | 迁移实施由 03-00 负责 |
| **05-00 Profile (计划)** | Profile 基于本文档传输能力 | Profile 是应用层增强，不改 MCP |
| **06-00 Client Integration Guide** | 本文档约束传输，06-00 约束集成 | 互补关系 |

## 11. 更新与维护

### 11.1 版本更新触发

本文档需要更新的情况：
- MCP Protocol 版本更新（需评估兼容性）
- structuredContent schema 不兼容变更（触发 response_version 升级）
- 新增错误码或约束（更新第 7 节）

### 11.2 归属与责任

- **Owner**: 04-ai-guidance-standardization / 06-00-guidance-documentation
- **维护者**: lrnev 服务端团队
- **审查周期**: 每次 MCP 协议更新或 structuredContent schema 变更时

---

**生成时间**: 2026-09-02  
**生成人**: Claude Opus 5  
**对应 Spec**: 04-ai-guidance-standardization / 06-00-guidance-documentation  
**状态**: stable
