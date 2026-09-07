---
spec: 03-00-mcp-response-conformance
scene: 04-ai-guidance-standardization
status: completed
priority: P1
created: '2026-08-26'
updated: '2026-09-07'
---

# 03-00 MCP Response Conformance - 需求

## L0 摘要

让 lrnev 工具响应符合 MCP 的结构化输出能力：为全部已注册工具声明 `outputSchema`，返回带独立版本的完整 `structuredContent` 和确定性、模型可见的 `content` 语义视图，规范 `isError`、annotations、协议版本和全量重构测试；不在本 Spec 定义 lrnev 的结构化 guidance 语义。

## L1 概览

### 目标

当前 `toToolResult` 把整个 lrnev 响应对象 `JSON.stringify` 后只放入 MCP `content[].text`；全部 `registerTool` 均未声明 `outputSchema`，也不返回 `structuredContent`。MCP 的 `content` 是通用的非结构化结果通道，`structuredContent` 是可选的机器可读增强。完整重构不保留“content 等于完整 JSON”的旧应用层契约，也不允许把数据随意摘要到模型无法判断；必须建立逐工具的 ModelVisibleContract。

本 Spec 只解决 MCP transport conformance，不解决“模型是否把 Recommendation 当 Rule”。结构化传输具有独立价值，不受 E2E 语义门禁约束；为避免污染文案迁移的基线/对照实验，路线图安排在语义 E2E 对照之后实施。

### 范围

**包含**：
- 为所有已注册工具建立明确的输出 schema，覆盖成功、可恢复业务失败和工具执行错误。
- 改造工具注册 helper 与 `toToolResult`，使同一个规范化结果同时生成完整 `structuredContent` 和确定性 `content` 语义视图。
- 定义独立 `response_version`、`structuredContent` 与 `content` 的语义一致性、未知字段、序列化失败和客户端降级规则。
- 为每个工具定义 ModelVisibleContract：模型必须看到的 data、完整 guidance、完整错误恢复信息、服务级截断标记和可继续查询路径。
- 规范 `isError` 的使用，区分成功结果、业务拒绝/歧义和内部错误。
- 复核 tool annotations、协议版本协商和 SDK 行为；annotations 只作为 hints，不作为权限或安全校验。
- 覆盖全部工具，而不是只覆盖含 `ai_followup` 的返回点。

**不包含**：
- 不定义 FACT/RECOMMENDATION/DECISION_BOUNDARY 等 lrnev 应用层 Profile。
- 不新增 `user_intent`、decision context、结构化 guidance messages 或数字 priority。
- 不改变现有工具名称和输入参数签名。
- 不假定客户端支持 `structuredContent` 就会理解 lrnev 私有语义。
- 不把 tool annotations 当作客户端必须信任的安全事实。

## L2 详情

### 详细需求

#### F-01 MCP 响应信封与 schema

- 验收：定义独立于 MCP protocol version 和 Profile version 的 `response_version`；每个 `registerTool` 声明符合实际返回的 `outputSchema`；必填字段缺失显式失败，不能用任意值或无约束 object 静默兜底。

#### F-02 全工具 structuredContent

- 验收：所有已注册工具的成功结果返回 `structuredContent`；不能只改 Spec/Task 或 `ai_followup` 工具；测试对 `tools/list` 中每个工具和实际调用结果做覆盖核对。

#### F-03 content 呈现一致性

- 验收：`structuredContent` 是完整机器数据；`content` 由同一个规范化结果按逐工具 ModelVisibleContract 渲染。所有 guidance 文本和 suggested tools、所有错误 code/message/hint/candidates、以及模型判断当前工具结果所需的 data 必须完整呈现；list/search/inspection 工具必须呈现服务已返回的全部条目及其决策字段。禁止分别拼装相互矛盾的结果；不保留“文本必须是完整 JSON”的旧应用层契约。

#### F-04 截断与模型可见完整性

- 验收：不允许在 `content` 渲染阶段静默省略 canonical payload 中被 ModelVisibleContract 标记为 required 的字段；需要控制体积时，只能在业务查询/分页阶段构造显式截断元数据，再由 structuredContent 与 content 同步呈现。

##### F-04.1 文本级截断（TextStatus 枚举）

**类型定义**：
```typescript
type TextStatus = 'complete' | 'truncated_by_budget' | 'incomplete_source';

interface TextMeta {
  text_status: TextStatus,
  original_length?: number,  // 当 text_status !== 'complete' 时提供
  returned_length: number,
}
```

**语义分离**：
- `complete` — 文本完整，无截断或残缺
- `truncated_by_budget` — 因 retainer 预算限制而截断（建议：换查询参数或缩小范围）
- `incomplete_source` — 上游源本身不完整（建议：去补写源文件，如 L0 尚未填写）

**应用位置**：
- `AnchorContext` — 锚点文本的截断状态
- `SummaryContext` — 摘要文本的截断状态

##### F-04.2 查询级截断（QueryMeta 三件套）

**类型定义**：
```typescript
type Omitted = 
  | { kind: 'none' }
  | { kind: 'exact', count: number }
  | { kind: 'unknown' };

interface QueryMeta {
  returned_count: number,    // 实际返回的项数
  total_count: number,       // 候选总数（lrnev 查询模式下总是可得，无 null）
  truncated: boolean,        // 是否因预算截断
  omitted: Omitted,          // 省略的项（保留 DSH RetainedItems 语义）
}
```

**应用位置**：
- `Searcher.search()` — context_search 结果截断
- `project_status` 的 `claimable_preview` — 可领取任务预览截断
- `task_create_many` — 批量上限处理

**关键约束**：
- `total_count` 不可为 `null`（lrnev 查询是"先全量收集候选，再 slice(0, N) 截断"）
- `truncated` 对齐原文措辞："若因预算省略，返回 `truncated: true`"
- `omitted` 三态保留 deepseek-harness 语义可追溯性

**参考**：ADR-0001 截断语义类型选择

#### F-05 错误与 isError 语义

- 验收：定义参数/状态/引用拒绝、歧义引用、内部错误等类别何时返回 `isError=true`，并保证结构化错误和文本错误一致；错误结果不得伪装成成功 FACT，也不得丢失可执行的恢复提示。

#### F-06 未知字段与降级

- 验收：客户端忽略 `structuredContent` 时仍可从 content 获得必要结果；新客户端遇到未知字段按 MCP 兼容规则忽略；schema/序列化失败时不能返回互相矛盾的 text 与 structuredContent，必须产生明确工具错误。

#### F-07 annotations 与协议版本

- 验收：全部工具的 readOnly/destructive/idempotent/openWorld hints 与当前真实行为复核；文档明确 annotations 是 hints，不参与授权；至少覆盖 SDK 当前支持的协议协商、content 通道和 structuredContent 通道。

#### F-08 全量契约测试

- 验收：重构现有“解析 content JSON”的协议测试：机器断言读取 structuredContent，模型可见断言读取 content 语义视图。测试覆盖 `tools/list` 的 outputSchema、所有工具的 response_version/结构化返回、逐工具 ModelVisibleContract、错误 `isError`、客户端降级和协议版本；不只断言字段存在。

#### F-09 M1/M2 实施里程碑

- 验收：
  - M1/B2a：完成统一注册/响应 helper、response_version、全工具 outputSchema 和 structuredContent；content 继续使用 B1 的 legacy JSON renderer，保留相同模型可见业务/guidance 信息；M1 独立通过 build、全量测试和 04 B2a 对照。
  - M2/B2b：在 M1 稳定基础上逐工具切换 ModelVisibleContract renderer，并迁移旧 `JSON.parse(content)` 测试；M2 独立通过 build、全量测试、content contract 测试和 04 B2b 对照。
  - M1 与 M2 不在同一次不可分割变更中完成；M2 能按工具回退到 M1 renderer。

### 非功能性需求

- 兼容性：保留 MCP `content` 作为通用非结构化结果通道；本次可废弃“content 必须承载完整 lrnev JSON”的旧应用层约定。
- 一致性：一个规范化 payload 只能有一个构建来源；content 是该对象的受测试语义投影。
- 性能：双通道返回、逐工具视图和完整 guidance 的 token/字节数必须测量；体积控制通过查询边界/分页完成，不静默压缩模型所需信息。
- 安全性：annotations 和客户端 capability 声明不替代服务端校验。

### 验收标准

- [ ] `status` 使用合法的 `draft`，不再使用 `research`。
- [ ] 全部已注册工具声明并返回可验证的结构化输出。
- [ ] response_version、MCP protocol version 和 Profile version 的边界独立且可验证。
- [ ] `structuredContent` 是完整机器数据，content 满足逐工具 ModelVisibleContract 且不与其矛盾。
- [ ] `isError`、未知字段、协议版本和旧客户端降级规则明确。
- [ ] 没有引入 lrnev Guidance Profile 或任何 USER_DECISION 字段。
- [ ] 旧 JSON text 解析测试已替换为 structured/schema + ModelVisibleContract 测试。
- [ ] M1/B2a 与 M2/B2b 可独立构建、测试、观测和按工具回退。
- [ ] 全量测试、构建和 MCP 协议测试通过。
