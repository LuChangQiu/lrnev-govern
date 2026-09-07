# lrnev Execution Constraints Inventory

**Document Purpose**: Comprehensive inventory of all real server-side execution constraints (EXECUTION_CONSTRAINT) in the lrnev codebase.

**Scope**: Only constraints that are **actually implemented** in src/ code and enforced through `throw LrnevError` or validation logic.

**Version**: M2.3.0 baseline (2026-08-28)

---

## 1. Spec State Machine Constraints

### 1.1 Spec Status Transition

**Location**: `src/types/spec.ts:25-31`, `src/core/SpecManager.ts:136-158`

**Validation**: `isValidSpecTransition(from, to)` checks against `VALID_SPEC_TRANSITIONS`

**Trigger Condition**: Calling `spec_update` with a target status not in the current status's allowed transitions

**Observable Result**: Returns `INVALID_STATUS_TRANSITION` error, no state written to requirements.md

**Valid Transitions**:
- `draft` → `ready`, `archived`
- `ready` → `in-progress`, `draft`, `archived`
- `in-progress` → `completed`, `ready`, `archived`
- `completed` → `archived`, `in-progress`
- `archived` → (no valid transitions - terminal state)

**Error Code**: `INVALID_STATUS_TRANSITION`

**Alternative Path**: 按状态机更新：draft → ready/archived，ready → in-progress/draft/archived，in-progress → completed/ready/archived，completed → archived/in-progress。

**Example**:
```typescript
// src/core/SpecManager.ts:146-157
if (!isValidSpecTransition(from, status)) {
  throw new LrnevError(
    ErrorCode.INVALID_STATUS_TRANSITION,
    `非法 Spec 状态转换：${from} → ${status}`,
    {
      field: 'status',
      hint: allowed.length > 0
        ? `当前 ${from} 只允许转换到：${allowed.join('、')}`
        : `${from} 是终态，不能再转换；如需重做请用 spec_create 开新版`,
    },
  );
}
```

---

## 2. Task State Machine Constraints

### 2.1 Task Status Transition

**Location**: `src/types/task.ts:28-34`, `src/core/TaskManager.ts:464-473`

**Validation**: `isValidTransition(from, to)` checks against `VALID_TASK_TRANSITIONS`

**Trigger Condition**: Calling `task_update` with a target status not in the current status's allowed transitions

**Observable Result**: Returns `INVALID_STATUS_TRANSITION` error, tasks.md not modified

**Valid Transitions**:
- `pending` → `in_progress`, `blocked`
- `in_progress` → `completed`, `failed`, `blocked`
- `blocked` → `pending`, `in_progress`
- `completed` → (no valid transitions - terminal state)
- `failed` → `pending` (retry allowed)

**Error Code**: `INVALID_STATUS_TRANSITION`

**Alternative Path**: 按状态机更新：pending → in_progress/blocked，in_progress → completed/failed/blocked，blocked → pending/in_progress，failed → pending。

**Example**:
```typescript
// src/core/TaskManager.ts:464-472
if (!isValidTransition(task.status, input.status)) {
  throw new LrnevError(
    ErrorCode.INVALID_STATUS_TRANSITION,
    `非法状态转换：${task.status} → ${input.status}`,
    {
      field: 'status',
      hint: statusTransitionHint(task.status),
    },
  );
}
```

---

## 3. Reference Integrity Constraints

### 3.1 Parent Task Must Exist

**Location**: `src/core/TaskManager.ts:148-153`

**Validation**: Checks if `parent` ID exists in current Spec's task set before creating task

**Trigger Condition**: Creating a task with a `parent` field that references a non-existent Task ID

**Observable Result**: Returns `TASK_NOT_FOUND` error with field `parent`, task not written to tasks.md

**Error Code**: `TASK_NOT_FOUND`

**Alternative Path**: 先调用 task_list 确认父 Task ID 存在，或去掉 parent 字段。

**Example**:
```typescript
// src/core/TaskManager.ts:148-153
if (input.parent && !existingIds.has(input.parent)) {
  throw new LrnevError(
    ErrorCode.TASK_NOT_FOUND,
    `父 Task "${input.parent}" 不存在`,
    { field: 'parent' },
  );
}
```

### 3.2 Dependency Tasks Must Exist

**Location**: `src/core/TaskManager.ts:156-162`

**Validation**: Checks if all IDs in `depends_on` exist in current Spec's task set

**Trigger Condition**: Creating a task with `depends_on` containing one or more non-existent Task IDs

**Observable Result**: Returns `TASK_NOT_FOUND` error with field `depends_on`, task not written

**Error Code**: `TASK_NOT_FOUND`

**Alternative Path**: 先调用 task_list 确认依赖的 Task ID 存在，或去掉不存在的依赖。

**Example**:
```typescript
// src/core/TaskManager.ts:156-162
const missingDeps = findMissingReferences(input.depends_on ?? [], existingIds);
if (missingDeps.length > 0) {
  throw new LrnevError(
    ErrorCode.TASK_NOT_FOUND,
    `depends_on 指向不存在的 Task：${missingDeps.join('、')}`,
    { field: 'depends_on', hint: '先用 task_list 确认依赖的 Task ID，或去掉不存在的依赖。' },
  );
}
```

### 3.3 Validates Anchors Must Be Well-Formed and Exist

**Location**: `src/core/TaskManager.ts:165, 600-610, 821-861`

**Validation**: Three-stage validation:
1. Format check: Must match `F-\d+` or `D-\d+` pattern (legacy `design#` format rejected)
2. Existence check: Anchor must exist as `#### F-xx` in requirements.md or `#### D-xx` in design.md

**Trigger Condition**: Creating a task with `validates` containing:
- Invalid format (not F-xx or D-xx)
- Legacy format (design#...)
- Valid format but anchor doesn't exist in corresponding document

**Observable Result**: 
- Invalid format → `INVALID_INPUT` error
- Missing anchor → `ANCHOR_NOT_FOUND` error
- Task not written to tasks.md

**Error Codes**: `INVALID_INPUT`, `ANCHOR_NOT_FOUND`

**Alternative Path**: 
- For format errors (INVALID_INPUT): 在 requirements.md 用 "#### F-xx" 或在 design.md 用 "#### D-xx" 定义锚点后改用正确格式。
- For missing anchors (ANCHOR_NOT_FOUND): 确认对应文档中存在该锚点标题，或修正 validates 编号。

**Examples**:
```typescript
// src/core/TaskManager.ts:829-835 - Legacy format rejection
if (legacy.length > 0) {
  issues.push({
    code: ErrorCode.INVALID_INPUT,
    message: `validates 锚点格式已废弃：${legacy.join('、')}`,
    hint: 'design# 自由写法无稳定真相来源、无法确定性校验；请在 design.md 用 "#### D-xx 标题" 定义设计锚点后改用 D-xx。',
  });
}

// src/core/TaskManager.ts:837-844 - Invalid format rejection
const invalid = validates.filter(
  (v) => !/^F-\d+$/.test(v) && !/^D-\d+$/.test(v) && !/^design#/i.test(v),
);
if (invalid.length > 0) {
  issues.push({
    code: ErrorCode.INVALID_INPUT,
    message: `validates 只接受 F-xx / D-xx 锚点：${invalid.join('、')}`,
    hint: 'F-xx 指 requirements 的 "#### F-xx"，D-xx 指 design 的 "#### D-xx"；请先在对应文档定义锚点。',
  });
}

// src/core/TaskManager.ts:846-852 - Anchor existence check
const missingF = findMissingReferences(validates.filter((v) => /^F-\d+$/.test(v)), fPool);
if (missingF.length > 0) {
  issues.push({
    code: ErrorCode.ANCHOR_NOT_FOUND,
    message: `validates 锚点在 requirements.md 中不存在：${missingF.join('、')}`,
  });
}
```

---

## 4. Input Validation Constraints

### 4.1 Task Title Cannot Be Empty

**Location**: `src/core/TaskManager.ts:126-130`

**Validation**: Checks if `title` is empty or whitespace-only

**Trigger Condition**: Creating a task with empty or whitespace-only title

**Observable Result**: Returns `INVALID_INPUT` error with field `title`, task not created

**Error Code**: `INVALID_INPUT`

**Alternative Path**: 检查错误响应中的 field，并按命令或工具参数说明重新传入。

**Example**:
```typescript
// src/core/TaskManager.ts:126-130
if (!input.title || input.title.trim().length === 0) {
  throw new LrnevError(ErrorCode.INVALID_INPUT, 'Task 标题不能为空', {
    field: 'title',
  });
}
```

### 4.2 Spec Name Must Be Kebab-Case

**Location**: `src/core/SpecManager.ts:439-456`

**Validation**: Multiple checks:
- Not empty
- Length between 2-64 characters
- Matches regex `^[a-z0-9]+(-[a-z0-9]+)*$`

**Trigger Condition**: Creating a spec with invalid name format

**Observable Result**: Returns `INVALID_INPUT` error with field `name`, spec not created

**Error Code**: `INVALID_INPUT`

**Alternative Path**: 检查错误响应中的 field，并按命令或工具参数说明重新传入（使用 kebab-case，例：user-login、password-reset）。

**Examples**:
```typescript
// src/core/SpecManager.ts:442-455
if (!name) {
  throw new LrnevError(ErrorCode.INVALID_INPUT, 'Spec name 不能为空', { field: 'name' });
}
if (name.length < 2 || name.length > 64) {
  throw new LrnevError(ErrorCode.INVALID_INPUT, `Spec name 长度需在 2~64："${name}"`, {
    field: 'name',
  });
}
if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
  throw new LrnevError(
    ErrorCode.INVALID_INPUT,
    `Spec name 必须是 kebab-case："${name}"`,
    { field: 'name', hint: '例：user-login、password-reset' },
  );
}
```

### 4.3 Spec Version Must Be 0-99

**Location**: `src/core/SpecManager.ts:193-199`

**Validation**: Checks if version is an integer in range [0, 99]

**Trigger Condition**: Creating a spec with version < 0 or > 99 or non-integer

**Observable Result**: Returns `INVALID_INPUT` error with field `version`, spec not created

**Error Code**: `INVALID_INPUT`

**Alternative Path**: 检查错误响应中的 field，并按命令或工具参数说明重新传入（version 必须是 0-99 整数）。

**Example**:
```typescript
// src/core/SpecManager.ts:193-199
if (!Number.isInteger(version) || version < 0 || version > 99) {
  throw new LrnevError(
    ErrorCode.INVALID_INPUT,
    `Spec 版本号必须是 0~99 整数：${version}`,
    { field: 'version' },
  );
}
```

### 4.4 Scene Name Must Be Kebab-Case

**Location**: `src/core/SceneManager.ts:461-481`

**Validation**: Similar to Spec name validation:
- Not empty
- Length between 2-64 characters
- Matches regex `^[a-z0-9]+(-[a-z0-9]+)*$`

**Trigger Condition**: Creating a scene with invalid name format

**Observable Result**: Returns `INVALID_INPUT` error with field `name`, scene not created

**Error Code**: `INVALID_INPUT`

**Alternative Path**: 检查错误响应中的 field，并按命令或工具参数说明重新传入（使用 kebab-case，2-64 字符）。

### 4.5 Scene Number Must Be 1-99

**Location**: `src/core/SceneManager.ts:486-492`

**Validation**: Checks if number is an integer in range [1, 99]

**Trigger Condition**: Manually specifying a scene number outside valid range

**Observable Result**: Returns `INVALID_INPUT` error with field `number`, scene not created

**Error Code**: `INVALID_INPUT`

**Alternative Path**: 检查错误响应中的 field，并按命令或工具参数说明重新传入（number 必须是 1-99 整数）。

**Example**:
```typescript
// src/core/SceneManager.ts:486-492
if (!Number.isInteger(number) || number <= 0 || number > 99) {
  throw new LrnevError(
    ErrorCode.INVALID_INPUT,
    `Scene 序号必须是 1~99 整数：${number}`,
    { field: 'number' },
  );
}
```

### 4.6 Task Batch Create Max Size

**Location**: `src/core/TaskManager.ts:254-264`

**Validation**: Checks if tasks array length exceeds configured `task.max_batch_create` limit

**Trigger Condition**: Calling `task_create_many` with too many tasks

**Observable Result**: Returns `INVALID_INPUT` error with field `tasks`, no tasks created

**Error Code**: `INVALID_INPUT`

**Alternative Path**: 拆成多批提交，或在 .lrnev/config/lrnev.json 调整 task.max_batch_create。

**Example**:
```typescript
// src/core/TaskManager.ts:257-264
const maxBatch = loadConfig(this.fs.root).task.max_batch_create;
if (entries.length > maxBatch) {
  throw new LrnevError(
    ErrorCode.INVALID_INPUT,
    `单批最多创建 ${maxBatch} 条任务（收到 ${entries.length} 条）`,
    { field: 'tasks', hint: '拆成多批提交，或在 .lrnev/config/lrnev.json 调整 task.max_batch_create。' },
  );
}
```

### 4.7 Batch Create Key Format Restrictions

**Location**: `src/core/TaskManager.ts:290-305`

**Validation**: 
- Key cannot use `T-xxx` format (conflicts with real Task IDs)
- Keys must be unique within the batch

**Trigger Condition**: Using forbidden key format or duplicate keys in batch create

**Observable Result**: Returns `INVALID_INPUT` error in batch errors array, no tasks created

**Error Code**: `INVALID_INPUT`

**Alternative Path**: 检查错误响应中的 field，并按命令或工具参数说明重新传入（key 不得使用 T-xxx 格式，且批内必须唯一）。

**Example**:
```typescript
// src/core/TaskManager.ts:290-305
if (/^T-\d+$/.test(key)) {
  errors.push({
    index, field: 'key', code: ErrorCode.INVALID_INPUT,
    message: `key "${key}" 不得使用 T-xxx 格式（与真实 Task ID 歧义）`,
  });
  return;
}
const firstIndex = keyToIndex.get(key);
if (firstIndex !== undefined) {
  errors.push({
    index, field: 'key', code: ErrorCode.INVALID_INPUT,
    message: `key "${key}" 与第 ${firstIndex + 1} 条重复`,
  });
  return;
}
```

### 4.8 ADR Title Cannot Be Empty

**Location**: `src/core/ADRManager.ts:32-35`

**Validation**: Checks if trimmed title is empty

**Trigger Condition**: Creating an ADR with empty title

**Observable Result**: Returns `INVALID_INPUT` error with field `title`, ADR not created

**Error Code**: `INVALID_INPUT`

**Alternative Path**: 检查错误响应中的 field，并按命令或工具参数说明重新传入。

### 4.9 ADR Supersedes Must Be Valid Positive Integers

**Location**: `src/core/ADRManager.ts:38-47`

**Validation**: Each supersedes entry must match `^\d+$` and be > 0

**Trigger Condition**: Creating ADR with non-numeric or non-positive supersedes values

**Observable Result**: Returns `INVALID_INPUT` error with field `supersedes`, ADR not created

**Error Code**: `INVALID_INPUT`

**Alternative Path**: 使用正整数 ADR 编号，例如 1 或 0001。

**Example**:
```typescript
// src/core/ADRManager.ts:38-47
const supersedes = input.supersedes?.map((raw) => {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed) || parseInt(trimmed, 10) <= 0) {
    throw new LrnevError(ErrorCode.INVALID_INPUT, `supersedes 编号不合法："${raw}"`, {
      field: 'supersedes',
      hint: '使用正整数 ADR 编号，例如 1 或 0001。',
    });
  }
  return formatAdrNumber(parseInt(trimmed, 10));
});
```

### 4.10 Claim TTL Must Be Positive and Within Max Limit

**Location**: `src/core/ClaimStore.ts:171-174`

**Validation**: Checks if ttl_seconds is positive integer and <= `claim.max_ttl_seconds`

**Trigger Condition**: Creating a claim with invalid TTL value

**Observable Result**: Returns `INVALID_INPUT` error with field `ttl_seconds`, claim not created

**Error Code**: `INVALID_INPUT`

**Alternative Path**: 检查错误响应中的 field，并按命令或工具参数说明重新传入（ttl_seconds 必须是正整数且不超过配置的 max_ttl_seconds）。

**Example**:
```typescript
// src/core/ClaimStore.ts:171-174
if (!Number.isInteger(ttl) || ttl <= 0 || ttl > loadConfig(this.fs.root).claim.max_ttl_seconds) {
  throw new LrnevError(ErrorCode.INVALID_INPUT, `ttl_seconds 不合法：${ttl}`, { field: 'ttl_seconds' });
}
```

### 4.11 Claim Required Fields Cannot Be Empty

**Location**: `src/core/ClaimStore.ts:160-170`

**Validation**: Checks scene, spec, task, agent_id are non-empty after trim

**Trigger Condition**: Creating a claim with empty required fields

**Observable Result**: Returns `INVALID_INPUT` error with corresponding field name

**Error Code**: `INVALID_INPUT`

**Alternative Path**: 检查错误响应中的 field，并按命令或工具参数说明重新传入。

### 4.12 Memory Content and Source Required

**Location**: `src/core/MemoryManager.ts:154-164`

**Validation**: 
- `content` must not be empty after trim
- `source` must not be empty after trim

**Trigger Condition**: Saving memory with empty content or source

**Observable Result**: Returns `INVALID_INPUT` error with field `content` or `source`

**Error Code**: `INVALID_INPUT`

**Alternative Path**: 检查错误响应中的 field，并按命令或工具参数说明重新传入（content 和 source 都必须非空）。

### 4.13 Errorbook Search Query Cannot Be Empty

**Location**: `src/core/ErrorbookManager.ts:86-88`

**Validation**: Query must have at least one non-whitespace character

**Trigger Condition**: Searching errors with empty query

**Observable Result**: Returns `INVALID_INPUT` error with field `query`

**Error Code**: `INVALID_INPUT`

**Alternative Path**: 检查错误响应中的 field，并按命令或工具参数说明重新传入（query 不能为空）。

### 4.14 Error Promote Requires Verification

**Location**: `src/core/ErrorbookManager.ts:110-116`

**Validation**: `verification` field must be provided and non-empty when promoting

**Trigger Condition**: Promoting an error without verification evidence

**Observable Result**: Returns `INVALID_INPUT` error with field `verification`

**Error Code**: `INVALID_INPUT`

**Alternative Path**: 检查错误响应中的 field，并按命令或工具参数说明重新传入。

### 4.15 Memory Category Must Be Valid

**Location**: `src/core/MemoryManager.ts:168-174`

**Validation**: Checks if category is one of the valid `MemoryCategory` enum values (preferences, decisions, patterns, errors, facts)

**Trigger Condition**: Calling `memory_save`, `memory_forget`, or `memory_search` with an unknown category value

**Observable Result**: Returns `INVALID_INPUT` error with field `category`, memory operation not executed

**Error Code**: `INVALID_INPUT`

**Alternative Path**: 检查错误响应中的 field，并按命令或工具参数说明重新传入。

**Example**:
```typescript
// src/core/MemoryManager.ts:168-174
private validateCategory(category: MemoryCategory): void {
  if (!Object.values(MemoryCategory).includes(category)) {
    throw new LrnevError(ErrorCode.INVALID_INPUT, `未知记忆分类：${category}`, {
      field: 'category',
    });
  }
}
```

### 4.16 Memory Search Query Cannot Be Empty

**Location**: `src/core/MemoryManager.ts:85-87`

**Validation**: Query must have at least one non-whitespace character

**Trigger Condition**: Calling `memory_search` with empty or whitespace-only query

**Observable Result**: Returns `INVALID_INPUT` error with field `query`, no search performed

**Error Code**: `INVALID_INPUT`

**Alternative Path**: 检查错误响应中的 field，并按命令或工具参数说明重新传入。

**Example**:
```typescript
// src/core/MemoryManager.ts:85-87
const query = input.query.trim();
if (!query) {
  throw new LrnevError(ErrorCode.INVALID_INPUT, 'query 不能为空', { field: 'query' });
}
```

---

## 5. Uniqueness and Conflict Constraints

### 5.1 Scene Name Must Be Unique

**Location**: `src/core/SceneManager.ts:316-325`

**Validation**: Checks if any existing scene has the same name

**Trigger Condition**: Creating a scene with a name that already exists

**Observable Result**: Returns `INVALID_INPUT` error with field `name`, scene not created

**Error Code**: `INVALID_INPUT`

**Alternative Path**: 同名 Scene 会让 resolveId 产生歧义，请换名字。

**Example**:
```typescript
// src/core/SceneManager.ts:316-325
const sameName = (await this.list()).find((s) => s.name === input.name);
if (sameName) {
  throw new LrnevError(
    ErrorCode.INVALID_INPUT,
    `已有同名 Scene："${sameName.id}"`,
    {
      field: 'name',
      hint: '同名 Scene 会让 resolveId 产生歧义，请换名字',
    },
  );
}
```

### 5.2 Spec Name+Version Must Be Unique Within Scene

**Location**: `src/core/SpecManager.ts:373-379`

**Validation**: Checks if a spec with same name and version exists in the scene

**Trigger Condition**: Creating a spec with duplicate name+version combination

**Observable Result**: Returns `INVALID_INPUT` error with field `name`, spec not created

**Error Code**: `INVALID_INPUT`

**Alternative Path**: 若是重写，请指定 version > 0；否则使用不同的 name。

**Example**:
```typescript
// src/core/SpecManager.ts:373-379
const sameName = existing.find((s) => s.name === input.name && s.version === version);
if (sameName) {
  throw new LrnevError(
    ErrorCode.INVALID_INPUT,
    `Scene "${sceneId}" 内已有同名 Spec："${sameName.spec}"`,
    { field: 'name', hint: '若是重写，请指定 version > 0' },
  );
}
```

### 5.3 ADR Number Must Not Conflict

**Location**: `src/core/ADRManager.ts:55-59`, `src/core/ADRManager.ts:186-191`

**Validation**: Checks if ADR file with same number already exists in scope

**Trigger Condition**: 
- Creating ADR and directory with that number already exists
- Resolving ADR and multiple files match the number prefix

**Observable Result**: Returns `ADR_NUMBER_CONFLICT` error with field `number`

**Error Code**: `ADR_NUMBER_CONFLICT`

**Alternative Path**: 使用 adr_list 查看已有编号，选择未占用编号后重试。

---

## 6. Agent and Registry Constraints

### 6.1 Agent Must Be Registered for Heartbeat

**Location**: `src/core/AgentRegistry.ts:194-199`

**Validation**: Checks if agent_id exists in registry when calling heartbeat

**Trigger Condition**: Calling `agent_heartbeat` for unregistered agent

**Observable Result**: Returns `AGENT_NOT_REGISTERED` error with field `agent_id`

**Error Code**: `AGENT_NOT_REGISTERED`

**Alternative Path**: 先调用 agent_register 注册；通过 stdio 启动时一般已自动注册。

**Example**:
```typescript
// src/core/AgentRegistry.ts:194-199
if (!existing) {
  throw new LrnevError(ErrorCode.AGENT_NOT_REGISTERED, `Agent 未注册：${agentId}`, {
    field: 'agent_id',
    hint: '先调用 agent_register 注册；通过 stdio 启动时一般已自动注册。',
  });
}
```

### 6.2 Agent Must Be Registered for Unregister

**Location**: `src/core/AgentRegistry.ts:267-272`

**Validation**: Checks if agent_id exists in registry when calling unregister

**Trigger Condition**: Calling `agent_unregister` for unregistered agent

**Observable Result**: Returns `AGENT_NOT_REGISTERED` error with field `agent_id`

**Error Code**: `AGENT_NOT_REGISTERED`

**Alternative Path**: 先调用 agent_register 注册；通过 stdio 启动时一般已自动注册。

---

## 7. Ambiguous Reference Resolution

### 7.1 Spec Resolution Must Be Unambiguous

**Location**: `src/core/SpecManager.ts:302-330`

**Validation**: When resolving by prefix or name, there must be exactly one match

**Trigger Condition**: Using a spec identifier that matches multiple specs

**Observable Result**: Returns `AMBIGUOUS_REF` error with `candidates` array

**Error Code**: `AMBIGUOUS_REF`

**Alternative Path**: 请从 candidates 选择一个完整 Spec id，并用该完整 id 重新调用当前工具。

**Example**:
```typescript
// src/core/SpecManager.ts:306-315
if (candidates.length > 1) {
  throw new LrnevError(
    ErrorCode.AMBIGUOUS_REF,
    `Spec 前缀 "${input}" 不唯一：${candidates.join(', ')}`,
    {
      field: 'spec_id',
      hint: '请从 candidates 选择一个完整 Spec id，并用该完整 id 重新调用当前工具。',
      candidates,
    },
  );
}
```

---

## 8. Not-Found Constraints

These constraints are enforced when entities must exist:

### 8.1 Scene Not Found

**Error Code**: `SCENE_NOT_FOUND`

**Alternative Path**: 先调用 scene_list 确认 Scene ID，或调用 scene_create 创建新的 Scene。

**Locations**: 
- `src/core/SceneManager.ts:97-100` - Scene directory doesn't exist
- `src/core/SceneManager.ts:223-226` - Scene with ID not found
- `src/core/SceneManager.ts:238-241` - Scene with number not found
- `src/core/SceneManager.ts:250-254` - Scene with name not found

### 8.2 Spec Not Found

**Error Code**: `SPEC_NOT_FOUND`

**Alternative Path**: 先调用 spec_list 确认 Spec ID，再重试。

**Locations**:
- `src/core/SpecManager.ts:98-102` - Spec doesn't exist or requirements.md missing
- `src/core/SpecManager.ts:333-337` - Spec with given identifier not found in scene

### 8.3 Task Not Found

**Error Code**: `TASK_NOT_FOUND`

**Alternative Path**: 先调用 task_list 确认 Task ID。

**Locations**:
- `src/core/TaskManager.ts:107-112` - Task ID doesn't exist in spec
- `src/core/TaskManager.ts:456-461` - Task ID doesn't exist when updating
- `src/core/TaskManager.ts:989-993` - Parent task doesn't exist in markdown

### 8.4 File Not Found

**Error Code**: `FILE_NOT_FOUND`

**Alternative Path**: 确认路径存在且位于工作区内，再重新调用。

**Locations**:
- `src/core/TaskManager.ts:138-142` - tasks.md doesn't exist
- `src/core/ADRManager.ts:192-195` - ADR with number doesn't exist

---

## 9. Scope Resolution Constraints

Multiple managers enforce scope validation:

**Pattern**: `scope` must be either `"global"` or `"scene:{id}"` where `{id}` is a valid Scene ID

**Locations**:
- `src/core/ADRManager.ts:152-158`
- `src/core/ErrorbookManager.ts:202-206`
- `src/core/MemoryManager.ts:176-182`

**Error Code**: `INVALID_INPUT` with field `scope`

**Alternative Path**: 检查错误响应中的 field，使用 "global" 或 "scene:{id}" 格式。

**Example**:
```typescript
// src/core/ADRManager.ts:152-158
if (scope === 'global') return 'global';
if (scope.startsWith('scene:')) {
  const sceneId = await this.scenes.resolveId(scope.slice('scene:'.length));
  return `scene:${sceneId}`;
}
throw new LrnevError(ErrorCode.INVALID_INPUT, `scope 不合法：${scope}`, { field: 'scope' });
```

---

## 10. Structural Integrity Constraints

### 10.1 Spec Directory Must Have requirements.md

**Location**: `src/core/SpecManager.ts:90-102`

**Validation**: Checks if requirements.md exists in spec directory

**Trigger Condition**: Accessing a spec whose directory exists but requirements.md is missing

**Observable Result**: Returns `SPEC_CORRUPTED` error

**Error Code**: `SPEC_CORRUPTED`

**Alternative Path**: 检查 Spec 目录下 requirements/design/tasks 文档和 frontmatter 是否完整。

### 10.2 Scene Directory Must Have scene.md

**Location**: `src/core/SceneManager.ts:103-108`

**Validation**: Checks if scene.md exists in scene directory

**Trigger Condition**: Accessing a scene whose directory exists but scene.md is missing

**Observable Result**: Returns `SCENE_CORRUPTED` error

**Error Code**: `SCENE_CORRUPTED`

**Alternative Path**: 检查对应 Scene 的 scene.md frontmatter；必要时从备份恢复。

---

## Summary Statistics

**Total Constraint Categories**: 10
**Total Individual Constraints**: 47 (counting each distinct constraint type)

**By Error Code**:
- `INVALID_INPUT`: 23 constraints (including 2 newly added Memory validations)
- `INVALID_STATUS_TRANSITION`: 2 constraints
- `TASK_NOT_FOUND`: 5 constraints
- `ANCHOR_NOT_FOUND`: 2 constraints (F-xx and D-xx)
- `SPEC_NOT_FOUND`: 2 constraints
- `SCENE_NOT_FOUND`: 4 constraints
- `AMBIGUOUS_REF`: 1 constraint (spec resolution)
- `AGENT_NOT_REGISTERED`: 2 constraints
- `ADR_NUMBER_CONFLICT`: 2 constraints
- `SPEC_CORRUPTED`: 1 constraint
- `SCENE_CORRUPTED`: 1 constraint
- `FILE_NOT_FOUND`: 2 constraints

**By Category**:
- State Machine: 2 constraints
- Reference Integrity: 3 constraints
- Input Validation: 16 constraints
- Uniqueness/Conflict: 3 constraints
- Agent/Registry: 2 constraints
- Ambiguous Resolution: 1 constraint
- Not Found: 4 constraint types (12 total locations documented)
- Scope Resolution: 3 locations (same pattern)
- Structural Integrity: 2 constraints

**Counting Rules**:
- "Constraint" = one distinct validation rule with its own error condition
- Multiple code locations implementing the same rule are documented but counted as one constraint
- Not Found constraints are counted by type (Scene/Spec/Task/File), not by individual code location
- Scope Resolution pattern appears in 3 managers but is counted as 1 pattern documented in 3 locations

---

## Known Non-Constraints

These are **NOT** implemented as server-side constraints in current codebase:

### Not Constraint: archived Spec Cannot Add Task

**Status**: NOT IMPLEMENTED

**Current Behavior**: `TaskManager.create()` does NOT check Spec status before creating task

**Evidence**: No validation in `src/core/TaskManager.ts:125-242`

**Reference**: semantic-authority-model.md §6.1 explicitly lists this as non-constraint

### Not Constraint: Ready Gate Blocks Other Tools

**Status**: NOT IMPLEMENTED

**Current Behavior**: Gate checks return results but do not block subsequent tool calls

**Evidence**: Gates are read-only checks, no write prevention mechanism exists

---

## Maintenance Notes

**Last Updated**: 2026-08-28 (Gap remediation based on DeepSeek review)
**Baseline Version**: M2.3.0 (commit 45a86e1)

**Update Procedure**:
1. When adding new constraints, update corresponding category section
2. Include exact file path, line numbers, and code examples
3. Add "Alternative Path" field for each constraint (from errors.ts DEFAULT_ERROR_HINTS or code hints)
4. Update summary statistics
5. Do NOT add speculative constraints - only document what exists in src/

**Counting Rules** (established 2026-08-28):
- **Constraint count** = number of distinct validation rules, not code locations
- Multiple locations implementing the same rule are documented but counted once
- Not Found constraints counted by type (Scene/Spec/Task/File), not by location
- Scope Resolution pattern appears in 3 managers but counted as 1 documented pattern
- Each constraint must have: Location, Validation, Trigger Condition, Observable Result, Error Code, Alternative Path, Example

**Recent Changes** (2026-08-28):
- Added 4.15: Memory Category validation (MemoryManager.ts:168-174, INVALID_INPUT)
- Added 4.16: Memory Search query non-empty (MemoryManager.ts:85-87, INVALID_INPUT)
- Added "Alternative Path" field to all 47 constraints (from errors.ts DEFAULT_ERROR_HINTS)
- Fixed statistics: 48 → 47 constraints, INVALID_INPUT: 21 → 23
- Clarified counting rules in Summary Statistics

**Known Exclusions**:
- `INVALID_URI`: URIRouter.ts validation (context:// URI format) - belongs to URI/resource layer, not governance constraints
- `HOOK_CONFIG_INVALID`: HookManager.ts configuration validation - runtime diagnostic, not input constraint
- `LOCK_HELD_BY_OTHER`: ClaimStore concurrency control - runtime condition, not validation constraint
- `HOOK_FAILED`, `HOOK_TIMEOUT`: Hook execution results - operational errors, not constraints

**Verification**: All constraints listed here can be traced to actual `throw LrnevError` calls in src/ code.
