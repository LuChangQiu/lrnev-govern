---
spec: '09-00-structured-ai-followup'
scene: '01-findings-remediation'
created: '2026-08-26'
---

# 09-00 Structured Ai Followup - 设计

> **⚠️ 当前状态：暂缓执行，待重写**
>
> 当前设计不应执行，详见 requirements.md 开头的暂缓说明。
>
> 以下内容保留作为参考，但**不应按此执行**。

## L0 摘要

兼容式扩展 AiFollowup 类型，双字段填充策略，提供辅助函数和 lint 确保 kind 用对，doctor 命令做存量迁移。

## L1 概览

### 架构思路

**核心原则：向后兼容 + 渐进迁移**

1. **兼容式扩展**：保留 `instructions`，新增 `messages`，新旧客户端都能工作
2. **双字段填充**：所有返回点同时填充两个字段，`instructions` 保留文本前缀（【事实】等），`messages` 用结构化
3. **辅助函数封装**：提供 `createFollowup()` 统一生成逻辑，避免各处重复实现
4. **Lint 防护**：提供 `validateFollowupMessage()` 在开发时检查 kind 是否用对
5. **存量迁移**：doctor 命令解析前缀生成 messages，无法解析的标记为 recommendation 并报告

### 主要模块

- `src/types/response.ts`：扩展 `AiFollowup` 类型定义
- `src/shared/followup-builder.ts`（新增）：提供 `createFollowup()` 辅助函数
- `src/shared/followup-rules.ts`（新增）：定义 kind 使用规范和 `validateFollowupMessage()`
- `src/core/SpecManager.ts`：修改所有返回 followup 的方法
- `src/core/TaskManager.ts`：修改所有返回 followup 的方法
- `src/core/GoalAssessor.ts`：修改 assess() 返回
- `src/core/GateGuidance.ts`：修改 buildGateFollowup()
- `src/core/SceneManager.ts`：修改 create() 等返回
- `src/core/WorkspaceManager.ts`：修改 init() 返回
- `src/mcp/tools/lrnev-doctor.ts`：新增 `--migrate-followup` 选项（或在现有 doctor 中集成）
- `docs/GOVERNANCE-FLOW.md`：补充结构化协议说明

### 关键决策

| 决策 | 选项 | 倾向 | 是否产 ADR |
|---|---|---|---|
| priority 字段是否暴露给客户端 | A: 暴露，让客户端自己比较；B: 不暴露，lrnev 内部排序后返回 | **A** | 否（客户端可能有自己的优先级策略） |
| instructions 是否立刻标记 @deprecated | A: 标记，鼓励客户端迁移；B: 不标记，避免产生”要被删除”的误解 | **A** | 否（用 @deprecated 但文档明确”会长期保留”） |
| 无法解析前缀时的默认 kind | A: recommendation；B: fact；C: 报错不迁移 | **A** | 否（最安全，不会误判为 constraint） |
| 是否允许一个 followup 同时有多个 user_decision | A: 允许；B: 报错 | **A** | 否（可能多轮对话积累多个用户决定） |
| doctor 迁移是否自动写回文件 | A: 自动写回；B: 只输出 diff，由用户确认 | **B** | 否（安全优先，避免破坏现有数据） |

## L2 详情

### 模块详细设计

#### D-01 AiFollowup 类型扩展

**位置**：`src/types/response.ts`

**设计**：

```typescript
/**
 * AI followup 消息的语义分类。
 * 
 * 优先级：user_decision (1) > constraint (2) > recommendation (3)
 * fact 不参与优先级比较，只是背景信息。
 */
export type MessageKind = 
  | 'fact'           // 项目当前状态，不可辩驳，不参与决策
  | 'recommendation' // lrnev 的治理建议，可以有例外
  | 'user_decision'  // 用户明确做出的决定，优先级最高
  | 'constraint';    // 结构/状态/完整性约束，违反会阻断

/**
 * 结构化 followup 消息。
 */
export interface AiFollowupMessage {
  kind: MessageKind;
  text: string;
  
  /**
   * 优先级（数字越小越高）：
   * - user_decision: 1
   * - constraint: 2
   * - recommendation: 3
   * - fact: 0（不参与比较）
   */
  priority: number;
}

/**
 * AI followup 响应。
 * 
 * 新客户端应优先读取 `messages` 字段，旧客户端继续读取 `instructions`。
 * lrnev 内部会同时填充两个字段以保证兼容性。
 */
export interface AiFollowup {
  /**
   * @deprecated 保留以兼容旧客户端；新客户端应优先读 messages。
   * 
   * 注意：此字段会长期保留，不会被删除。
   */
  instructions?: string[];
  
  /**
   * 结构化消息列表。
   * 
   * 新客户端应优先消费此字段。当 recommendation 和 user_decision 冲突时，
   * 比较 priority 字段选择优先级高的那个。
   */
  messages?: AiFollowupMessage[];
  
  suggested_tools?: ToolHint[];
}
```

**向后兼容保证**：

- `instructions` 标记 `@deprecated` 但不删除
- 文档明确说明”会长期保留，用于兼容”
- 测试继续覆盖 `instructions` 字段

#### D-02 辅助函数封装（统一生成逻辑）

**位置**：`src/shared/followup-builder.ts`（新增）

**设计**：

```typescript
import type { AiFollowup, AiFollowupMessage, MessageKind } from '../types/response.js';

/**
 * 创建结构化 followup，同时填充 instructions 和 messages。
 * 
 * @example
 * ```typescript
 * const followup = createFollowup([
 *   { kind: 'fact', text: 'Spec 已创建成功。' },
 *   { kind: 'recommendation', text: '如果这是已有特性的增量...' },
 *   { kind: 'user_decision', text: '用户已明确要求创建独立 Spec。' },
 *   { kind: 'constraint', text: '不得擅自撤销用户决定。' },
 * ]);
 * ```
 */
export function createFollowup(
  messages: Array<{ kind: MessageKind; text: string }>,
): AiFollowup {
  const priorityMap: Record<MessageKind, number> = {
    fact: 0,
    user_decision: 1,
    constraint: 2,
    recommendation: 3,
  };
  
  const prefixMap: Record<MessageKind, string> = {
    fact: '【事实】',
    recommendation: '【建议】',
    user_decision: '【用户决定】',
    constraint: '【约束】',
  };
  
  const structuredMessages: AiFollowupMessage[] = messages.map((m) => ({
    kind: m.kind,
    text: m.text,
    priority: priorityMap[m.kind],
  }));
  
  const instructions = messages.map((m) => `${prefixMap[m.kind]}${m.text}`);
  
  return {
    instructions,
    messages: structuredMessages,
  };
}

/**
 * 合并多个 followup（用于组合多个来源的 followup）。
 */
export function mergeFollowup(...followups: AiFollowup[]): AiFollowup {
  const allInstructions: string[] = [];
  const allMessages: AiFollowupMessage[] = [];
  
  for (const f of followups) {
    if (f.instructions) allInstructions.push(...f.instructions);
    if (f.messages) allMessages.push(...f.messages);
  }
  
  return {
    instructions: allInstructions.length > 0 ? allInstructions : undefined,
    messages: allMessages.length > 0 ? allMessages : undefined,
  };
}
```

**使用示例**（SpecManager.ts:217）：

```typescript
// 旧方式（手动拼接）
const instructions = [
  '【事实】Spec 已创建成功。',
  '【建议】如果这是...',
];

// 新方式（用辅助函数）
const followup = createFollowup([
  { kind: 'fact', text: 'Spec 已创建成功。' },
  { kind: 'recommendation', text: '如果这是...' },
]);
```

#### D-03 kind 使用规范和 lint

**位置**：`src/shared/followup-rules.ts`（新增）

**设计**：

```typescript
import type { MessageKind } from '../types/response.js';

/**
 * kind 使用规范。
 */
export const FOLLOWUP_KIND_RULES: Record<MessageKind, {
  description: string;
  forbiddenPhrases: string[];
  requiredContext?: string;
}> = {
  fact: {
    description: '客观可验证的项目状态，不包含建议或判断',
    forbiddenPhrases: ['建议', '可以', '应该', '通常', '最好'],
  },
  recommendation: {
    description: 'lrnev 的治理建议，可以有例外',
    forbiddenPhrases: ['必须', '禁止', '不得', '不要', '不能'],
  },
  user_decision: {
    description: '用户明确做出的决定，只能来自用户输入或确认',
    forbiddenPhrases: [],
    requiredContext: '必须有明确的用户输入来源',
  },
  constraint: {
    description: '结构/状态/完整性约束，违反会阻断操作',
    forbiddenPhrases: ['建议', '可以考虑', '通常'],
  },
};

/**
 * 验证 followup message 是否符合规范。
 * 
 * 开发时可选启用（如 NODE_ENV=development 时自动调用）。
 */
export function validateFollowupMessage(
  kind: MessageKind,
  text: string,
): { valid: boolean; errors: string[] } {
  const rule = FOLLOWUP_KIND_RULES[kind];
  const errors: string[] = [];
  
  // 检查禁止词
  for (const phrase of rule.forbiddenPhrases) {
    if (text.includes(phrase)) {
      errors.push(
        `kind='${kind}' 的 text 不应包含”${phrase}”（违反规范：${rule.description}）`,
      );
    }
  }
  
  // 特殊检查：user_decision 不能由 lrnev 自己生成
  if (kind === 'user_decision') {
    // 这里只能做文本检查，真正的来源验证需要在调用处
    if (!text.includes('用户') && !text.includes('明确') && !text.includes('要求')) {
      errors.push(
        `kind='user_decision' 的 text 应明确表明来自用户输入（当前：${text}）`,
      );
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 开发时自动验证（可选启用）。
 */
export function createValidatedFollowup(
  messages: Array<{ kind: MessageKind; text: string }>,
): AiFollowup {
  if (process.env.NODE_ENV === 'development') {
    for (const m of messages) {
      const result = validateFollowupMessage(m.kind, m.text);
      if (!result.valid) {
        console.warn(`[followup validation]`, result.errors.join('\n'));
      }
    }
  }
  
  return createFollowup(messages);
}
```

#### D-04 doctor 迁移策略

**位置**：`src/mcp/tools/lrnev-doctor.ts`（修改现有 doctor 或新增选项）

**设计**：

当前 lrnev 的 followup 是运行时生成的，不持久化到文件。所以”迁移”主要是：

1. **扫描代码**：检查所有返回 followup 的地方是否都用了 `createFollowup()`
2. **扫描测试**：检查测试断言是否都升级为同时检查 `instructions` 和 `messages`
3. **（如果未来有持久化）**：扫描 `.lrnev/` 下的 JSON 文件，解析前缀生成 messages

**实现**（假设未来有持久化）：

```typescript
function migrateFollowup(oldFollowup: { instructions: string[] }): AiFollowup {
  const messages: Array<{ kind: MessageKind; text: string }> = [];
  
  for (const line of oldFollowup.instructions) {
    let kind: MessageKind = 'recommendation'; // 默认
    let text = line;
    
    // 解析前缀
    if (line.startsWith('【事实】')) {
      kind = 'fact';
      text = line.slice('【事实】'.length);
    } else if (line.startsWith('【建议】')) {
      kind = 'recommendation';
      text = line.slice('【建议】'.length);
    } else if (line.startsWith('【用户决定】')) {
      kind = 'user_decision';
      text = line.slice('【用户决定】'.length);
    } else if (line.startsWith('【约束】') || line.startsWith('【重要】')) {
      kind = 'constraint';
      text = line.slice(line.indexOf('】') + 1);
    }
    
    messages.push({ kind, text });
  }
  
  return createFollowup(messages);
}
```

**doctor 命令行为**：

```bash
lrnev doctor --migrate-followup

# 输出：
# 扫描 10 个文件...
# ✓ SpecManager.ts 已使用 createFollowup()
# ✓ TaskManager.ts 已使用 createFollowup()
# ✗ GoalAssessor.ts 仍手动拼接 instructions
# 
# 建议：修改 GoalAssessor.ts:67-76 使用 createFollowup()
```

#### D-05 修改所有返回点（以 SpecManager 为例）

**位置**：`src/core/SpecManager.ts:215-229`

**旧代码**：

```typescript
const instructions = [
  '【事实】Spec 已创建成功。',
  '【建议】如果这是...',
];

return {
  ok: true,
  data: spec,
  ai_followup: { instructions },
};
```

**新代码**：

```typescript
import { createFollowup } from '../shared/followup-builder.js';

const followup = createFollowup([
  { kind: 'fact', text: 'Spec 已创建成功。' },
  { kind: 'recommendation', text: '如果这是已有特性的增量...' },
  { kind: 'constraint', text: '不得擅自撤销用户决定。' },
]);

return {
  ok: true,
  data: spec,
  ai_followup: followup,
};
```

**需要修改的文件清单**（约 10+ 处）：

- `src/core/SpecManager.ts`：create / update / gate 返回
- `src/core/TaskManager.ts`：create / update 返回
- `src/core/GoalAssessor.ts`：assess 返回
- `src/core/GateGuidance.ts`：buildGateFollowup
- `src/core/SceneManager.ts`：create 返回
- `src/core/WorkspaceManager.ts`：init 返回
- `src/core/SpecGuidance.ts`：getSpecWithGuidance 返回
- 其他返回 `ai_followup` 的地方

#### D-06 客户端适配指南

**位置**：`docs/AI-ADAPTATION.md` 或新增 `docs/STRUCTURED-FOLLOWUP.md`

**内容**：

```markdown
## 结构化 AI Followup 使用指南

### 客户端适配

**新客户端（推荐）**：

```typescript
const result = await lrnevTool.spec_create({ name: 'login' });

// 优先读 messages
if (result.ai_followup?.messages) {
  // 过滤出 user_decision 和 constraint
  const critical = result.ai_followup.messages
    .filter(m => m.kind === 'user_decision' || m.kind === 'constraint')
    .sort((a, b) => a.priority - b.priority);
  
  // 如果有冲突，按 priority 执行优先级高的
  if (critical.length > 0) {
    const highestPriority = critical[0];
    // 执行对应动作...
  }
}
```

**旧客户端（兼容）**：

```typescript
// 继续读 instructions
if (result.ai_followup?.instructions) {
  for (const line of result.ai_followup.instructions) {
    console.log(line);
  }
}
```

### 优先级规则

当 `messages` 中出现冲突时，按 `priority` 字段判断：

| kind | priority | 说明 |
|---|---|---|
| user_decision | 1 | 最高，覆盖 recommendation 和 constraint |
| constraint | 2 | 中等，违反会阻断，但不覆盖 user_decision |
| recommendation | 3 | 最低，只是建议 |
| fact | 0 | 不参与比较，只是背景信息 |

**示例**：

```typescript
messages: [
  { kind: 'recommendation', text: '建议复用已有 Spec', priority: 3 },
  { kind: 'user_decision', text: '用户明确要求新建 Spec', priority: 1 },
]

// 结论：执行 user_decision（priority 1 < 3）
```
```

### 数据模型

**类型定义**（见 D-01）

**优先级映射**：

```
MessageKind → priority
━━━━━━━━━━━━━━━━━━━
fact           → 0
user_decision  → 1
constraint     → 2
recommendation → 3
```

### 接口契约

**AiFollowup 接口变化**（兼容式扩展）：

```typescript
// v2.2（旧）
interface AiFollowup {
  instructions?: string[];
  suggested_tools?: ToolHint[];
}

// v2.3+（新）
interface AiFollowup {
  instructions?: string[];  // 保留
  messages?: AiFollowupMessage[];  // 新增
  suggested_tools?: ToolHint[];
}
```

**向后兼容保证**：

- 所有工具同时返回 `instructions` 和 `messages`
- 旧客户端读 `instructions` 仍能正常工作
- `instructions` 字段不会被删除

### 错误处理

**kind 使用错误**（开发时）：

```typescript
// 错误示例：recommendation 包含”必须”
createFollowup([
  { kind: 'recommendation', text: '必须使用已有 Spec' }
]);

// 在 NODE_ENV=development 时会 console.warn：
// [followup validation] kind='recommendation' 的 text 不应包含”必须”
```

**迁移失败降级**：

```typescript
// 如果无法解析前缀，默认标记为 recommendation
migrateFollowup({ instructions: ['这是一条没有前缀的指引'] });
// → { kind: 'recommendation', text: '这是一条没有前缀的指引' }
```

### 测试策略

#### 单元测试

**新增**：

1. **followup-builder.test.ts**：
   - 测试 `createFollowup()` 正确填充 `instructions` 和 `messages`
   - 测试前缀映射正确
   - 测试 priority 分配正确

2. **followup-rules.test.ts**：
   - 测试 `validateFollowupMessage()` 能捕获禁止词
   - 测试 user_decision 的特殊检查

3. **已有测试修改**：
   - 所有断言 `instructions` 的测试保持不变（向后兼容）
   - 新增断言 `messages` 的测试（双重覆盖）

**示例**（spec-manager.test.ts）：

```typescript
it('spec_create 返回结构化 followup', async () => {
  const r = await specs.create({ scene: 'user-management', name: 'login' });
  
  // 旧断言保持
  expect(r.ai_followup!.instructions).toBeDefined();
  expect(r.ai_followup!.instructions![0]).toContain('【事实】');
  
  // 新增断言
  expect(r.ai_followup!.messages).toBeDefined();
  expect(r.ai_followup!.messages![0].kind).toBe('fact');
  expect(r.ai_followup!.messages![0].priority).toBe(0);
});
```

#### 集成测试

**doctor 迁移测试**：

```typescript
it('doctor --migrate-followup 能解析前缀', () => {
  const oldFollowup = {
    instructions: [
      '【事实】Spec 已创建',
      '【建议】可以考虑复用',
    ],
  };
  
  const migrated = migrateFollowup(oldFollowup);
  
  expect(migrated.messages![0].kind).toBe('fact');
  expect(migrated.messages![1].kind).toBe('recommendation');
});
```

#### E2E / 客户端测试

**验收方式**：用实际客户端（Claude Code）验证：

1. **优先级冲突解决**：
   - 发送包含 recommendation 和 user_decision 的 followup
   - 验证客户端 AI 是否按 priority 执行 user_decision

2. **向后兼容**：
   - 用旧版客户端连接新版 lrnev
   - 验证仍能读取 `instructions` 字段
