---
spec: '03-00-mcp-response-conformance'
scene: '04-ai-guidance-standardization'
created: '2026-08-26'
---

# 03-00 MCP Response Conformance - 设计

## L0 摘要

以 MCP `structuredContent` 承载完整机器数据，以 `content` 承载同一结果的确定性模型语义视图；不再复制完整 JSON 作为旧应用层 fallback，也不允许不受约束的“简洁摘要”丢失模型判断所需信息。

## L1 概览

#### D-01 分层边界

```text
MCP transport
  outputSchema / structuredContent / content / isError / annotations
        |
        v
lrnev application envelope
  ok / data / errors / ai_followup / context fields
        |
        v
lrnev Guidance Profile（05，受 E2E 门禁）
  文本角色、来源、执行强度、可选结构化 guidance
```

本 Spec 只负责前两层之间的正确映射，不定义第三层。

#### D-02 规范化响应信封

现有 `AiFollowupResponse<T>` 继续作为业务层基础，但 MCP 层需要显式 schema：

```typescript
type LrnevToolPayload<T> = {
  response_version: '1';
  ok: boolean;
  data?: T;
  errors?: ErrorInfo[];
  ai_followup?: AiFollowup;
  anchor_context?: AnchorContext[];
  summary_context?: SummaryContext;
};
```

`response_version` 是 lrnev response envelope 自己的版本，不等同 MCP protocol version 或 `lrnev.guidance/v1` Profile version。实际 schema 必须根据各工具业务数据定义必填/可选字段；公共 envelope helper 负责复用，不允许用完全无约束的 `{}` 伪装成 schema 完成覆盖。

#### D-03 工具注册改造

为 `registerTool` 增加统一注册/响应 helper：

1. 接收 input schema、output schema、annotations 和 handler。
2. handler 先生成唯一的规范化 payload。
3. 成功时返回 `structuredContent: payload` 与由该 payload 的 ModelVisibleContract 渲染的 `content` 文本。
4. 失败时按 D-05 的分类构造错误 payload 和 `isError`。
5. `tools/list` 中的 outputSchema 与 handler 实际返回由测试逐一对应。

改造范围是 `src/mcp/tools/index.ts` 中全部注册工具，不只修改 `toToolResult` 或含 `ai_followup` 的工具。

#### D-04 ModelVisibleContract 与双通道语义一致性

`structuredContent` 是完整规范化对象；`content` 是其面向模型/通用客户端的文本投影，不要求也不应重复 JSON。每个工具声明 ModelVisibleContract：

| 工具类别 | content 必须完整呈现 |
|---|---|
| 写入/状态变更 | 身份、状态、路径、写入结果、全部 guidance、suggested tools |
| 选择/歧义 | 全部 candidates、完整引用、错误 code/message/hint、重试参数 |
| list/search/inspection | 服务当前返回的全部条目、条目身份/状态/决策字段、分页/截断元数据 |
| gate/validation | 全部 checks、失败 code/message/hint、可继续操作 |
| 纯确认 | 成功/失败、受影响身份和必要下一步 |

渲染器从同一结果对象取值；不允许在 content 阶段静默省略 required 字段。任何体积限制必须先在查询/分页阶段写入 canonical payload 的 `truncated`、计数和后续查询路径，再由两个通道同时呈现。测试验证 contract 字段与 structuredContent 对应且不矛盾。

##### D-04.1 逃逸层级契约（frame escaping）

用户在 `.lrnev/` 下自己编写的文本（scene.md、requirements.md、tasks.md 等）会被注入到客户端 prompt context 中。若用户文本包含框架标记（如 `</system-reminder>`），可能闭合框架导致 prompt injection。

**逃逸层级**：
1. **structuredContent 保真工作区原文**（不逃逸）
   - `structuredContent` 是 source of truth，应与工作区文件字节级一致
   - 客户端需要对比 `structuredContent` 与工作区文件时，逃逸会导致误判
   
2. **content 渲染时逃逸**
   - MVC 渲染器生成 `content` 时调用 `escapeFrameworkMarkers()`
   - 保护客户端的 prompt context 框架不被闭合
   
3. **客户端 UI 渲染 structuredContent 自行逃逸**
   - 如果客户端 UI 要显示 `structuredContent.anchors[0].text`，由客户端负责逃逸
   - lrnev 无法预知客户端如何渲染 UI（HTML / Markdown / 纯文本）

**实施**：
```typescript
// src/core/renderers/escape.ts
export function escapeFrameworkMarkers(userText: string): string {
  // 使用文本转义（DSH 方式），不使用 HTML 实体
  // </ 转义为 <\/ 防止闭合标签
  // 理由：HTML 实体 &lt; 在客户端 HTML 渲染时会解码还原，框架闭合漏洞回归
  return userText.replace(/<\//g, '<\\/');
}

// src/core/renderers/spec-renderer.ts
function renderSpecRequirements(spec: Spec): RenderedContent {
  const structuredContent = {
    l0: spec.l0,  // 不逃逸，保真原文
    anchors: spec.anchors.map(a => ({ id: a.id, text: a.text })),
  };
  
  const content = `
<system-reminder type="spec-requirements" spec="${spec.id}">
${escapeFrameworkMarkers(spec.l0)}

${spec.anchors.map(a => 
  `#### ${a.id}\n${escapeFrameworkMarkers(a.text)}`
).join('\n\n')}
</system-reminder>
  `.trim();
  
  return { structuredContent, content };
}
```

**测试要求**：
- 保真测试：`structuredContent.l0 === spec.l0`（未逃逸）
- 安全测试：`content` 不含未逃逸的 `</system-reminder>`（应为 `<\/system-reminder>`）
- 幂等性测试：`escapeFrameworkMarkers(escapeFrameworkMarkers(x)) === escapeFrameworkMarkers(x)`
- HTML 渲染安全：验证客户端 HTML 渲染不会将 `<\/` 还原为 `</`

**参考**：ADR-0002 MVC 逃逸层级契约

## L2 详情

#### D-05 错误与 isError

- 参数、状态机、引用完整性等导致工具动作未执行时，返回结构化错误并按 MCP 工具错误语义设置 `isError`。
- 歧义引用必须保留 candidates 和重试提示，不能因兼容而只返回自然语言。
- 内部异常不得暴露原始堆栈，返回稳定错误码和封装消息。
- schema 校验或序列化失败时不得只回退一份旧文本并声称成功；应返回明确工具错误。
- MCP SDK 对 `isError=true` 结果不做 outputSchema 成功校验；错误 content 仍必须满足对应工具的 ModelVisibleContract。

#### D-06 annotations 与版本

- annotations 逐工具核对真实副作用，但仅作为 MCP hints；服务端安全和状态校验仍在 handler。
- 记录并测试 SDK 支持的 MCP protocol versions；客户端不使用 structuredContent 时仍通过 `content` 获得可读结果。
- 客户端忽略 `structuredContent` 属 capability 事实，由 04 观测，不代表 Conformance 失败。

#### D-07 测试策略

- 枚举 `tools/list`，断言每个工具都有 outputSchema。
- 对每类成功 payload 验证 schema、response_version、structuredContent 和 ModelVisibleContract。
- 覆盖业务拒绝、歧义引用、内部错误、未知字段、分页和截断。
- 现有 content JSON parse 测试迁移为：structuredContent 业务断言 + content contract/快照断言；不保留双套断言真相。
- 使用只读取 `content[0].text` 的消费方式，验证完整 guidance、完整错误恢复信息和该工具定义的决策数据仍可理解。
- 跑全量单元、集成、E2E 和 build；本 Spec 不以模型是否遵循 Recommendation 作为验收。

#### D-08 实施里程碑

#### M1：MCP 结构化传输（对应 B2a）

- 引入公共注册/响应 helper、独立 `response_version`、全工具 outputSchema 和 structuredContent。
- `content` 继续使用 B1 的 legacy JSON renderer；允许加入 response_version 等版本元数据，但不得减少 B1 已有业务字段、guidance 或错误恢复信息。
- 新增 structured/schema 断言，同时保留 legacy content 断言；M1 全量测试通过后运行 04 B2a，确认 transport/capability 行为。

#### M2：模型可见视图（对应 B2b）

- 在 M1 稳定后，按工具类别逐个切换 ModelVisibleContract renderer。
- 将旧 JSON parse 测试替换为 structuredContent 业务断言和 content contract/快照断言。
- 每批工具单独通过 build、全量测试和 04 B2b；renderer 必须支持按工具回退到 M1，不使用一次性全局开关掩盖问题。
