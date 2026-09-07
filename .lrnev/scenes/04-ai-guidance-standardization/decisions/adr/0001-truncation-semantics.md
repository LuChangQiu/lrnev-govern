---
number: '0001'
title: '截断语义类型选择'
status: accepted
scope: 'scene:04-ai-guidance-standardization'
created: '2026-08-28'
date: '2026-08-28'
---

# 0001. 截断语义类型选择

## 背景

lrnev 当前在 `AnchorContext` 和 `SummaryContext` 中使用单一 `truncated: boolean` 字段表示文本被截断。三方（ClaudeCode / Codex / DeepSeek）在分析 deepseek-harness 的 `output-retention` 库时发现，该字段混淆了两种不同的语义：
1. **预算截断**（budget truncation）：retainer 因预算限制省略了本可获得的内容
2. **源残缺**（incomplete source）：上游源本身不完整（如 L0 尚未填写）

混淆这两种语义导致客户端 AI 无法做出正确判断：
- 预算截断 → 应换查询参数或缩小范围
- 源残缺 → 应去补写源文件

同时，lrnev 的查询工具（`Searcher.search` / `project_status` / `task_create_many`）在截断时丢失了"总共有多少条"的信息，客户端无法判断省略了多少内容。

## 决策

采用**两维度分离 + 枚举 + 三件套**的方案：

### 文本级截断：TextStatus 枚举（3 值）
```typescript
type TextStatus = 'complete' | 'truncated_by_budget' | 'incomplete_source';

interface TextMeta {
  text_status: TextStatus,
  original_length?: number,  // 当 text_status !== 'complete' 时提供
  returned_length: number,
}
```

**为什么是枚举而非多个 boolean**：
1. **互斥性明确**：一段文本不可能同时"预算截断"和"源残缺"
2. **可扩展**：未来可加 `permission_denied` 等状态（虽然当前不需要）
3. **语义清晰**：`text_status: 'incomplete_source'` 一目了然，无需推理

### 查询级截断：QueryMeta 三件套 + omitted 三态
```typescript
type Omitted = 
  | { kind: 'none' }
  | { kind: 'exact', count: number }
  | { kind: 'unknown' };

interface QueryMeta {
  returned_count: number,    // 实际返回的项数
  total_count: number,       // 候选总数（lrnev 查询模式下总是可得）
  truncated: boolean,        // 是否因预算截断
  omitted: Omitted,          // 省略的项（保留 DSH RetainedItems 语义）
}
```

**关键决策点**：
1. **`total_count` 不可为 null**
   - ClaudeCode 初始提议 `total_count: number | null`（无法计算时为 null）
   - DeepSeek 论证：lrnev 查询模式是"先全量收集候选，再 `slice(0, N)` 截断"
   - 验证：`Searcher.search()` / `project_status` 都是先算全量
   - 结论：`null` 分支是死类型，去掉

2. **恢复 `omitted` 三态**
   - 保留 deepseek-harness `RetainedItems` 的语义可追溯性
   - 当前 lrnev 只产生 `none` 或 `exact`，但保留 `unknown` 扩展性

3. **`query_truncated` 改名为 `truncated`**
   - 对齐 03-00 F-04 原文措辞："若因预算省略，返回 `truncated: true`"

## 后果

### 正面
1. **语义分离清晰**：预算截断与源残缺不再混淆
2. **客户端 AI 可判断**：看到 `text_status: 'incomplete_source'` 知道应该去补写文件
3. **查询元数据完整**：`total_count` 让客户端知道省略了多少
4. **对齐 03-00 F-04**：`truncated` 字段直接满足 F-04 要求
5. **DSH 语义可追溯**：保留 `omitted` 三态，未来审计时可追溯设计来源

### 负面
1. **类型复杂度增加**：从 1 个 boolean 变成 1 个枚举 + 1 个三态联合类型
2. **迁移成本**：需要修改所有使用 `AnchorContext.truncated` / `SummaryContext.truncated` 的代码

### 风险
1. **encoding_error 缺失**：ClaudeCode 初始提议包含此状态，但 DeepSeek 论证"编码错误属于 tool-domain error，不是 truncation"，最终去掉
   - 缓解：如果未来确实需要，可在 TextStatus 中加回（枚举可扩展）

## 实施

### 受影响的代码
- `src/types/response.ts` — 定义 `TextStatus` / `TextMeta` / `Omitted` / `QueryMeta`
- `src/types/response.ts` — 修改 `AnchorContext` / `SummaryContext`（注：context 类型在 response.ts 中）
- `src/core/Searcher.ts` — 使用 `ItemRetainer` 生成 `QueryMeta`
- `src/core/ProjectStatus.ts` — 为 `claimable_preview` 生成 `QueryMeta`
- `src/core/TaskManager.ts` — 为批量上限生成 `QueryMeta`（注：task_create_many 在 TaskManager 中）

### 测试要求
1. **TextStatus 覆盖**：验证 3 个状态都能正确产生
2. **total_count 非空**：验证所有查询工具都返回有效的 `total_count`
3. **omitted 三态**：验证 `none` / `exact` 正确计算（`unknown` 保留扩展性）
4. **向后兼容**：验证旧客户端从 `content` 仍可获得必要信息

## 参考

- deepseek-harness `packages/util/output-retention/README.md`："`truncated` means the retainer omitted otherwise-available content because of a budget. It does **not** mean the upstream was incomplete."
- 三方统一确认（修正版）§1："DeepSeek 审查意见 §1 — 恢复 omitted 三态、去掉 total_count:null、truncated 对齐 F-04 措辞"
- 会话日志 `ai-discussions/log/session-log.jsonl` seq 489-490：ClaudeCode 接受 DeepSeek 修正
