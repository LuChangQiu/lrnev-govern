---
number: 0003
title: Hook Drain 边界与超时策略
status: accepted
date: 2026-08-28
supersedes: []
---

# ADR-0003: Hook Drain 边界与超时策略

## 背景

lrnev 当前的 `HookManager.runAsync()` 使用 fire-and-forget 模式运行异步 hook：

```typescript
// src/core/HookRunner.ts:27-29
runAsync(hook: HookConfig, event: string, payload: Record<string, unknown>): void {
  setImmediate(() => {
    void this.runProcess(hook, event, payload, true)
      .then((record) => this.log.append(record))
```

这导致一个 **bug 级问题**：
- MCP server 进程退出时，在飞的 async hook 子进程不会被 kill
- `log.append` 可能丢失，而 `lrnev_hook_tail_log` 是用户排查 hook 的唯一手段
- 用户看不到 async hook 的执行结果

三方（ClaudeCode / Codex / DeepSeek）在分析 deepseek-harness 的 `hook-protocol` 时发现，DSH 使用 `createDetachedRuns()` + `drain()` 机制解决此问题。

## 决策

采用 **detached hook tracker + 进程退出 drain + 5s 超时 + 先写 invoked** 的方案。

### 核心机制

#### 1. DetachedHookTracker
```typescript
// src/core/HookRunner.ts 新增
export class DetachedHookTracker {
  private runs = new Set<Promise<void>>();
  private abortController = new AbortController();

  track(chain: Promise<void>): void {
    this.runs.add(chain);
    chain.finally(() => this.runs.delete(chain));
  }

  async drain(timeoutMs: number = 5000): Promise<void> {
    // 触发 abort（虽然当前 lrnev 的 spawn 不支持 signal，但预留接口）
    this.abortController.abort();
    
    // 等待所有在飞的链，最多 timeoutMs
    const timeout = new Promise<void>((resolve) => 
      setTimeout(resolve, timeoutMs)
    );
    const result = await Promise.race([
      Promise.allSettled(Array.from(this.runs)),
      timeout.then(() => 'timeout' as const),
    ]);
    
    // 超时后补写 timed_out 记录（缺口 3 修正）
    if (result === 'timeout' && this.runs.size > 0) {
      // 注入回调以写入超时记录（需要 HookManager 的 log 引用）
      this.onTimeout?.();
    }
  }
  
  // 允许 HookManager 注入超时回调
  onTimeout?: () => void;

  get signal(): AbortSignal {
    return this.abortController.signal;
  }
}
```

#### 2. 进程退出边界
```typescript
// src/core/HookManager.ts
export class HookManager {
  private detached = new DetachedHookTracker();
  private pendingHooks = new Map<string, HookConfig>();  // 追踪未完成的 hook

  constructor(/* ... */) {
    // 注入超时回调
    this.detached.onTimeout = () => {
      for (const [name, hook] of this.pendingHooks.entries()) {
        this.log.append({
          hook_name: name,
          event: 'drain',
          status: 'timed_out',
          timestamp: new Date().toISOString(),
        });
      }
    };
    
    // SIGTERM/SIGINT 信号处理（缺口 3 修正）
    const shutdown = async () => {
      await this.detached.drain(5000);
      process.exit(0);
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  }

  private runAsync(hook: HookConfig, event: string, payload: Record<string, unknown>): void {
    // 先写 invoked 记录（确保日志完整）
    const invokedRecord: HookRecord = {
      hook_name: hook.name,
      event,
      status: 'invoked',
      timestamp: new Date().toISOString(),
    };
    this.log.append(invokedRecord);
    
    // 追踪异步链
    this.pendingHooks.set(hook.name, hook);
    const chain = this.runner
      .runProcess(hook, event, payload, true)
      .then((record) => {
        this.log.append(record);
        this.pendingHooks.delete(hook.name);
      })
      .catch((err) => {
        console.error('[HookManager] async hook chain failed:', err);
      });
    
    this.detached.track(chain);  // 追踪，不再 fire-and-forget
  }
}
```

### 关键决策点

#### Q1: drain 边界是什么？
**选项**：
1. 单次 MCP 调用结束
2. Agent E2E session 结束
3. 进程退出

**决策**：选择 **进程退出**。

**理由**（ClaudeCode / DeepSeek 一致）：
1. lrnev 是 MCP server，生命周期 = 进程生命周期
2. 单次 MCP 调用太短（async hook 可能还没启动）
3. "Agent E2E session"概念在 lrnev 中不存在（lrnev 无会话状态）
4. DSH 的 `fiber.dispose()` 对应 lrnev 的进程退出

#### Q2: 超时多久？
**决策**：**5 秒**。

**理由**（DeepSeek 提议，ClaudeCode 同意）：
1. DSH 的 `DEFAULT_HOOK_TIMEOUT_MS` 是 10s，drain 超时取一半（5s）
2. drain 不应阻塞进程退出太久
3. 5s 足够让正常的 hook 完成（大部分 hook <1s）

#### Q3: 超时后怎么办？
**决策**：hook 状态标记为 `timed_out`，区分"真失败"和"drain 超时"。

```typescript
interface HookRecord {
  hook_name: string;
  event: string;
  status: 'invoked' | 'success' | 'failed' | 'timed_out';
  exit_code?: number;
  stdout_tail?: string;
  stderr_tail?: string;
  timestamp: string;
}
```

**理由**：
- `failed` = hook 脚本返回非零 exit code
- `timed_out` = drain 超时，hook 可能还在运行
- 用户看到 `timed_out` 知道"不是 hook 失败，是等待超时"

#### Q4: 先写 invoked 还是后写？
**决策**：**先写 `invoked` 记录**，再启动异步链。

**理由**（DeepSeek 提议，ClaudeCode 同意）：
1. 确保日志完整：即使 drain 超时，至少能看到"hook 被触发了"
2. 排查方便：用户能知道"哪个 hook 被触发但没完成"
3. 顺序清晰：`invoked` → (`success` | `failed` | `timed_out`)

## 后果

### 正面
1. **修复 bug**：async hook 的日志不再丢失
2. **可排查**：用户能看到所有 hook 的执行记录（包括超时的）
3. **优雅退出**：进程退出前等待 hook 完成（最多 5s）
4. **不变式明确**：进程退出 = 没有 detached hook work 遗留

### 负面
1. **进程退出延迟**：最多延迟 5s（但这是必要的）
2. **复杂度增加**：需要维护 `DetachedHookTracker` 状态

### 风险

#### 风险 1：5s 不够
某些 hook（如运行完整测试套件）可能需要 >5s。

**缓解**：
- 5s 是 drain 超时，不是 hook 本身的超时
- hook 本身的超时由 `HookRunner.runProcess` 控制（可配置）
- 如果 hook 需要 >5s，应该设计为 detached（`runAsync`），而不是 sync

#### 风险 2：abort signal 不起作用
当前 lrnev 的 `spawn` 不支持 `AbortSignal`，`abortController.abort()` 不会真的 kill 子进程。

**缓解**：
- 预留 `signal` 接口，未来可集成
- 当前主要依赖 `Promise.race` 的超时兜底

#### 风险 3：并发多个 drain
如果多个地方调用 `drain()`（如手动调用 + 进程退出自动调用），可能重复等待。

**缓解**：
- 限制：只在 `process.on('beforeExit')` 中调用 `drain()`
- 测试：验证重复调用 `drain()` 是幂等的

## 实施

### 受影响的代码
- `src/core/HookRunner.ts` — 新增 `DetachedHookTracker` 类
- `src/core/HookManager.ts` — 修改 `runAsync()`，使用 tracker
- `src/types/hook.ts` — 修改 `HookRecord`，增加 `timed_out` 状态
- `tests/unit/hook-quiescence.spec.ts` — drain 机制测试

### 测试要求
1. **drain 成功**：验证所有 detached runs 在 drain 后完成
2. **drain 超时**：验证超时后不再等待，状态标记为 `timed_out`
3. **先写 invoked**：验证 `invoked` 记录在异步链启动前写入
4. **幂等性**：验证重复调用 `drain()` 不会出错

### 迁移步骤
1. 实现 `DetachedHookTracker`
2. 修改 `HookManager` 使用 tracker
3. 写测试验证 drain 行为
4. 在 `process.on('beforeExit')` 中注册 drain

## 不做什么

### 不实现的 DSH 特性
1. **不实现 `updatedInput` 重写**：DSH 的 hook 可以重写工具输入，lrnev 不需要
2. **不实现 `mergeHookOutputs` 权限折叠**：lrnev 无 veto 模型
3. **不实现 PreToolUse veto**：lrnev 是治理引擎，不是流程裁判

这些特性与 lrnev "只引导不强制"的定位不符，故意不移植。

## 参考

- deepseek-harness `packages/hooks/hook-protocol/src/events.ts`：`createDetachedRuns()` / `drain()` 实现
- 三方统一确认（修正版）§3："drain 边界：进程退出 + 5s 超时 + 先写 invoked + timed_out 错误码"
- 会话日志 `ai-discussions/log/session-log.jsonl` seq 23：ClaudeCode 完全同意 drain 边界
- 会话日志 seq 387：DeepSeek 完全同意 drain 边界

## 未来增强

### 可配置超时
未来可以在 `hooks.json` 中配置 drain 超时：

```json
{
  "drain_timeout_ms": 10000,
  "groups": [...]
}
```

### abort signal 集成
当 Node.js 的 `child_process.spawn` 支持 `signal` 选项后，可以在 `drain()` 时真正 kill 子进程。

### 进度报告
可以在 drain 时报告进度：

```typescript
async drain(timeoutMs: number): Promise<void> {
  const startTime = Date.now();
  console.log(`[HookManager] Draining ${this.runs.size} detached hooks...`);
  
  // ... drain 逻辑 ...
  
  const elapsed = Date.now() - startTime;
  console.log(`[HookManager] Drained in ${elapsed}ms`);
}
```
