---
number: '0002'
title: 'MVC 逃逸层级契约'
status: accepted
scope: 'scene:04-ai-guidance-standardization'
created: '2026-08-28'
date: '2026-08-28'
---

# 0002. MVC 逃逸层级契约

## 背景

在定义 03-00 MCP Response Conformance 的 D-04（MVC 渲染契约）时，三方（ClaudeCode / Codex / DeepSeek）发现一个安全问题：用户在 `.lrnev/` 下自己编写的 markdown 文本（scene.md、requirements.md、tasks.md、ADR、Memory）会被注入到客户端的 prompt context 中。如果用户文本包含框架标记（如 `</system-reminder>`），可能闭合 lrnev 或客户端注入的框架，导致 prompt injection。

三方在讨论 `structuredContent` 是否需要逃逸时出现分歧：
- **ClaudeCode 观点**：structuredContent 也应逃逸，因为客户端 UI 可能渲染它
- **DeepSeek 观点**：structuredContent 是 source of truth，逃逸 = 改数据值

经过技术论证，三方达成折中方案：**逃逸层级契约**。

## 决策

采用**逃逸层级契约**：structuredContent 保真原文，content 渲染时逃逸，MVC 契约明确边界。

### 契约条款（4 条）

#### 1. structuredContent 保真工作区原文
`structuredContent` 中的文本字段 = 工作区文件原文（不逃逸）。

**理由**：
- structuredContent 是 source of truth，应与工作区文件字节级一致
- 逃逸结构化数据 = 改数据值，违反"文件即真相"原则
- 客户端需要对比 `structuredContent` 与工作区文件时，逃逸会导致误判

**实施**：
```typescript
// 构造 structuredContent（不逃逸）
const structuredContent = {
  l0: spec.l0,  // 直接从文件读取，不逃逸
  anchors: spec.anchors.map(a => ({
    id: a.id,
    text: a.text,  // 原文
  })),
};
```

#### 2. content 渲染时逃逸
MVC 渲染器生成 `content` 时调用 `escapeFrameworkMarkers()`，保护客户端的 prompt context 框架不被闭合。

**理由**：
- `content` 是面向模型的可读投影，已经不是"原始数据"
- 客户端会把 `content` 注入 prompt，必须防止框架闭合
- 逃逸只发生在渲染层，不影响数据层

**实施**：
```typescript
// MVC 渲染器（src/core/renderers/spec-renderer.ts）
function renderSpecRequirements(spec: Spec): RenderedContent {
  const raw = await fs.read(spec.requirementsPath);
  const anchors = extractAnchorSections(raw, 'F');
  
  // structuredContent 不逃逸
  const structuredContent = {
    l0: spec.l0,
    anchors: Array.from(anchors.entries()).map(([id, text]) => ({ id, text })),
  };
  
  // content 渲染时逃逸
  const content = `
<system-reminder type="spec-requirements" spec="${spec.id}">
${escapeFrameworkMarkers(spec.l0)}

${Array.from(anchors.entries()).map(([id, text]) => 
  `#### ${id}\n${escapeFrameworkMarkers(text)}`
).join('\n\n')}
</system-reminder>
  `.trim();
  
  return { structuredContent, content };
}
```

#### 3. 客户端 UI 渲染 structuredContent 自行逃逸
如果客户端 UI 要显示 `structuredContent.anchors[0].text`，由客户端负责逃逸。

**理由**：
- UI 渲染是客户端的责任，不是 lrnev MCP server 的责任
- lrnev 无法预知客户端如何渲染 UI（HTML？Markdown？纯文本？）
- 不同客户端的逃逸需求不同（HTML 需要逃逸 `<`，Markdown 需要逃逸 `](`）

**MVC 契约明确**：
> lrnev 保证 `structuredContent` 是工作区原文（保真）。客户端 UI 渲染 `structuredContent` 时，由客户端负责防止 injection（HTML escaping / Markdown escaping / 框架标记逃逸等）。

#### 4. 保真测试 + 安全测试
写 2 个契约测试，确保逃逸层级正确：

**保真测试**：
```typescript
test('structuredContent 保真工作区原文', async () => {
  const spec = await createTestSpec({ 
    l0: '包含 </system-reminder> 的文本' 
  });
  const result = await renderSpecRequirements(spec);
  
  // structuredContent 应该与工作区文件一致（未逃逸）
  expect(result.structuredContent.l0).toBe('包含 </system-reminder> 的文本');
});
```

**安全测试**：
```typescript
test('content 不含未逃逸的框架标记', async () => {
  const spec = await createTestSpec({ 
    l0: '包含 </system-reminder> 的文本' 
  });
  const result = await renderSpecRequirements(spec);
  
  // content 应该逃逸框架标记（文本转义，非 HTML 实体）
  expect(result.content).not.toContain('</system-reminder>');
  expect(result.content).toContain('<\\/system-reminder>');
});
```

### escapeFrameworkMarkers 实现

```typescript
// src/core/renderers/escape.ts
export function escapeFrameworkMarkers(userText: string): string {
  // 使用文本转义（DSH 方式），不使用 HTML 实体
  // </ 转义为 <\/ 防止闭合标签，但不影响合法的 </code> 等
  // 理由：HTML 实体 &lt; 在客户端 HTML 渲染时会解码还原，框架闭合漏洞回归
  return userText.replace(/<\//g, '<\\/');
}

// 幂等性：逃逸两次 = 逃逸一次
// escapeFrameworkMarkers(escapeFrameworkMarkers(x)) === escapeFrameworkMarkers(x)
// 因为 <\/ 不匹配 </ 模式，第二次不会再替换
```

## 后果

### 正面
1. **保真与安全兼顾**：structuredContent 保真，content 安全
2. **责任边界清晰**：lrnev 负责 prompt context 安全，客户端负责 UI 安全
3. **可审计**：保真测试确保 structuredContent 未被篡改
4. **可验证**：安全测试确保 content 不会闭合框架

### 负面
1. **双重维护**：structuredContent 和 content 需要分别处理
2. **客户端负担**：客户端 UI 需要自行逃逸（但这本来就是客户端责任）

### ClaudeCode 的让步
ClaudeCode 初始反对 structuredContent 不逃逸，理由是"客户端 UI 可能渲染它"。经过 DeepSeek 论证：
1. DSH 式文本转义防不了 HTML 注入（客户端 UI 的责任）
2. 逃逸结构化数据 = 改数据值，违反 source of truth 原则

ClaudeCode 接受该论证，但要求在 MVC 契约中明确**契约条款 3**，让客户端知道这是它的责任。

### DeepSeek 的让步
DeepSeek 同意在 MVC 契约中明确逃逸层级边界，并写保真测试 + 安全测试。

## 风险与缓解

### 风险 1：客户端不知道要自行逃逸
**缓解**：
- 在 MVC 契约文档中明确警告
- 在 `structuredContent` 的 schema 注释中标注："此字段保真工作区原文，UI 渲染时需自行逃逸"

### 风险 2：未来其他框架标记
**缓解**：
- `escapeFrameworkMarkers` 是可扩展的（当前只逃逸 `<system-reminder>`）
- 未来如使用其他框架标记，只需在此函数中添加

### 风险 3：幂等性失败
**缓解**：
- 写幂等性测试：`escapeFrameworkMarkers(escapeFrameworkMarkers(x)) === escapeFrameworkMarkers(x)`
- 当前实现已满足幂等性

## 实施

### 受影响的代码
- `src/core/renderers/escape.ts` — 新文件，实现 `escapeFrameworkMarkers()`
- `src/core/renderers/spec-renderer.ts` — MVC 渲染器，对 `content` 应用逃逸
- `src/types/mvc.ts` — MVC 契约类型定义
- `tests/unit/frame-escape.spec.ts` — 逃逸函数测试
- `tests/unit/mvc-contract.spec.ts` — 保真测试 + 安全测试

### 测试要求
1. **幂等性测试**：逃逸两次 = 逃逸一次
2. **保真测试**：structuredContent 与工作区文件字节级一致
3. **安全测试**：content 不含未逃逸的框架标记
4. **不破坏正常文本**：合法的 markdown 不受影响

## 参考

- deepseek-harness `packages/context/agent-instructions/`: "Literal `</system-reminder>` text anywhere in instruction content or model-visible path, scope, and budget metadata is escaped so repository-controlled text cannot close the plugin-owned frame."
- 三方统一确认（修正版）§2："逃逸层级契约：structuredContent 原文 + content 逃逸 + MVC 契约明确边界 + 保真测试"
- 会话日志 `ai-discussions/log/session-log.jsonl` seq 394：ClaudeCode 有条件接受（MVC 契约明确边界）
- 会话日志 seq 384：DeepSeek 提出逃逸层级契约（折中方案）
