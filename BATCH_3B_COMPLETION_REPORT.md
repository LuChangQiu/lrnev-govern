# M2 第 3 批 B 组完成报告

**日期**: 2026-09-02  
**批次**: 第 3 批 B 组（4 个搜索/列表类工具渲染器）  
**状态**: ✅ 实施完成，待 Claude 合并和复审

---

## 一、已完成的 4 个渲染器

### 1. error-search.ts
- **路径**: `src/mcp/helpers/renderers/error-search.ts`
- **工具**: `error_search`
- **返回类型**: `ErrorEntry[]`
- **Required 字段**:
  - 全部错误条目列表
  - 每条: id, fingerprint, status, occurrence_count, first_seen, last_seen
  - 每条: symptom, root_cause, fix_action (⚠️ 已逃逸)
  - verification (如有)
  - tags (如有)
  - ai_followup 投影
- **逃逸字段**: symptom, root_cause, fix_action, verification

### 2. memory-search.ts
- **路径**: `src/mcp/helpers/renderers/memory-search.ts`
- **工具**: `memory_search`
- **返回类型**: `Memory[]`
- **Required 字段**:
  - 全部记忆条目列表
  - 每条: id, category, content, source, created
  - tentative (如有)
  - reference_count (如有)
  - ai_followup 投影 (如有)
- **逃逸字段**: content

### 3. lrnev-hook-list.ts
- **路径**: `src/mcp/helpers/renderers/lrnev-hook-list.ts`
- **工具**: `lrnev_hook_list`
- **返回类型**: `HookListResult`
- **Required 字段**:
  - 全部 hooks 配置列表 (name, event, command, enabled, mode, timeout_ms, on_failure, cwd?)
  - recent 执行记录列表 (ts, hook, event, status, mode, duration_ms, exit_code, stdout_tail?, stderr_tail?)
  - config_path
  - issues (如有)
  - ai_followup 投影
- **逃逸字段**: 无（配置和日志数据，非用户自由文本）

### 4. lrnev-hook-tail-log.ts
- **路径**: `src/mcp/helpers/renderers/lrnev-hook-tail-log.ts`
- **工具**: `lrnev_hook_tail_log`
- **返回类型**: `HookRecord[]`
- **Required 字段**:
  - 全部日志记录列表
  - 每条: ts, hook, event, status, mode, duration_ms, exit_code
  - stdout_tail, stderr_tail (如有)
  - ai_followup 投影
- **逃逸字段**: 无（日志数据）

---

## 二、7 点验收自查

### ✅ 1. 投影 canonical payload，不创作 guidance 文本
- 所有渲染器仅读取 `payload.data` 和 `payload.ai_followup`
- 无任何自创 guidance 文本

### ✅ 2. 禁止硬编码 paraphrase
- 全部 4 个渲染器无硬编码近似文本
- 测试包含否定断言（不包含 "💡"、"建议"、"提示" 等）

### ✅ 3. MVC required 字段完整呈现（D-04 搜索/列表类）
- **error_search**: 全部条目 + 每条 9 个关键字段
- **memory_search**: 全部条目 + 每条 5 个关键字段
- **lrnev_hook_list**: hooks 配置列表 + recent 记录 + config_path + issues
- **lrnev_hook_tail_log**: 全部日志记录 + 每条 7 个关键字段

### ✅ 4. 逃逸用户文本
- **error_search**: symptom, root_cause, fix_action, verification 全部调用 `escapeFrameworkMarkers()`
- **memory_search**: content 调用 `escapeFrameworkMarkers()`
- **lrnev_hook_list**: 无需逃逸（配置数据）
- **lrnev_hook_tail_log**: 无需逃逸（日志数据）
- 测试验证: `</ → <\/` 转义正确，且不匹配 `/<\/(?!\\)/`

### ✅ 5. 不修改共享文件
- ❌ 未修改 `model-visible-contract.ts`（注册由 Claude 统一合并）
- ❌ 未修改 `tests/unit/renderers.test.ts`（测试由 Claude 统一合并）
- ✅ 仅创建 4 个渲染器文件
- ✅ 单独提供测试代码片段 (`BATCH_3B_TEST_SNIPPETS.md`)

### ✅ 6. 单元测试
- 每个渲染器包含 4-5 个测试用例:
  - Required 字段完整性断言
  - 逃逸验证（error_search/memory_search）
  - 空结果处理
  - ai_followup 投影
  - 禁止硬编码 paraphrase（否定断言）

### ✅ 7. legacyRawFormat 已弃用
- error_search 和 memory_search 之前传 `legacyRawFormat: true`
- M2 后必须通过渲染器覆盖（已实现）

---

## 三、特殊处理说明

### 逃逸处理（escapeFrameworkMarkers）

**error_search (4 个字段需逃逸)**:
```typescript
lines.push(`   症状: ${escapeFrameworkMarkers(error.body.symptom)}`);
lines.push(`   根因: ${escapeFrameworkMarkers(error.body.root_cause)}`);
lines.push(`   修复: ${escapeFrameworkMarkers(error.body.fix_action)}`);
if (error.body.verification) {
  lines.push(`   验证: ${escapeFrameworkMarkers(error.body.verification)}`);
}
```

**memory_search (1 个字段需逃逸)**:
```typescript
lines.push(`   内容: ${escapeFrameworkMarkers(memory.content)}`);
```

**为什么 hook 相关工具不需要逃逸**:
- `lrnev_hook_list`: hooks.json 配置数据（command/event 是结构化配置，非用户自由文本）
- `lrnev_hook_tail_log`: 执行日志（stdout_tail/stderr_tail 是进程输出，不是用户直接输入的文本）

逃逸只针对**用户直接记录的自由文本**（error 的 symptom/root_cause/fix_action、memory 的 content）。

---

## 四、数据源验证

### error_search
- **Manager**: `ErrorbookManager.search()` → `Promise<ErrorEntry[]>`
- **MCP 包装**: `toMcpToolResult(..., 'error_search', true)` → 添加 ai_followup (空结果时)
- **Payload**: `LrnevToolPayload<ErrorEntry[]>`

### memory_search
- **Manager**: `MemoryManager.search()` → `Promise<Memory[]>`
- **MCP 包装**: `toMcpToolResultFromData(..., 'memory_search', true)`
- **Payload**: `LrnevToolPayload<Memory[]>`

### lrnev_hook_list
- **Manager**: `HookManager.list()` → `Promise<AiFollowupResponse<HookListResult>>`
- **MCP 包装**: `toMcpToolResult(..., 'lrnev_hook_list')`
- **Payload**: `LrnevToolPayload<HookListResult>`

### lrnev_hook_tail_log
- **Manager**: `HookManager.tailLog()` → `Promise<AiFollowupResponse<HookRecord[]>>`
- **MCP 包装**: `toMcpToolResult(..., 'lrnev_hook_tail_log')`
- **Payload**: `LrnevToolPayload<HookRecord[]>`

---

## 五、待 Claude 执行的合并步骤

### 1. 注册渲染器（model-visible-contract.ts）

在 `initializeRenderers()` 函数中添加（第 3 批 B 组注释块）:
```typescript
import { errorSearchRenderer } from './renderers/error-search.js';
import { memorySearchRenderer } from './renderers/memory-search.js';
import { lrnevHookListRenderer } from './renderers/lrnev-hook-list.js';
import { lrnevHookTailLogRenderer } from './renderers/lrnev-hook-tail-log.js';

// ... 在 initializeRenderers() 中添加：
  // 第 3 批 B 组：4 个搜索/列表类工具
  renderers.set('error_search', errorSearchRenderer);
  renderers.set('memory_search', memorySearchRenderer);
  renderers.set('lrnev_hook_list', lrnevHookListRenderer);
  renderers.set('lrnev_hook_tail_log', lrnevHookTailLogRenderer);
```

### 2. 合并测试代码（renderers.test.ts）

将 `BATCH_3B_TEST_SNIPPETS.md` 中的测试代码合并到 `tests/unit/renderers.test.ts`:
- 添加 import 语句
- 添加 4 个 describe 块

### 3. 运行验证

```bash
# TypeScript 编译
npm run build

# 单元测试
npm test

# B2b 证据生成（全部渲染器注册后）
npm run evidence:b2b
```

---

## 六、文件清单

### 新增文件（4 个渲染器）
- `src/mcp/helpers/renderers/error-search.ts`
- `src/mcp/helpers/renderers/memory-search.ts`
- `src/mcp/helpers/renderers/lrnev-hook-list.ts`
- `src/mcp/helpers/renderers/lrnev-hook-tail-log.ts`

### 交付物（供 Claude 合并）
- `BATCH_3B_TEST_SNIPPETS.md` - 测试代码片段
- `BATCH_3B_COMPLETION_REPORT.md` - 本报告

### 待修改文件（由 Claude 执行）
- `src/mcp/helpers/model-visible-contract.ts` - 添加 4 个注册
- `tests/unit/renderers.test.ts` - 合并测试代码

---

## 七、与 A 组并行协调

本批次（B 组）与 A 组并行实施，互不依赖：
- **A 组**: adr_get, task_list, spec_gate_check, scene_get
- **B 组**: error_search, memory_search, lrnev_hook_list, lrnev_hook_tail_log

Claude 需要在两组都完成后，统一合并注册和测试。

---

## 八、预期验收结果

- ✅ TypeScript 编译通过
- ✅ 单元测试全部通过（801 + 16 新增测试 = 817？）
- ✅ B2b 证据 content_hash 变化（预期：4 个工具的 content_hash 改变）
- ✅ B2b action_success 保持不变（渲染器不改变工具行为）

---

## 九、红线确认

- ✅ 02-00 基线未修改
- ✅ 08-00 常量未绕过（本批次无需引用 guidance-semantics.ts 常量）
- ✅ M1 legacy renderer 未删除
- ✅ 已入库证据未改写
- ✅ 报告≠落库（本报告仅供参考，以实测为准）
- ✅ 先复审后落库（等待 DeepSeek 复审通过）

---

**实施完成，交接给 Claude 进行合并和验收。**
