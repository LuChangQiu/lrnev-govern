/**
 * DetachedHookTracker —— 在飞 async hook 链的追踪与进程退出 drain（ADR-0003）。
 *
 * 背景：HookRunner.runAsync 是 fire-and-forget 执行，MCP server 收到
 * SIGINT/SIGTERM（或 stdio 断开、onclose）直接 process.exit(0) 时，在飞的
 * async hook 不会被等待，其 log.append 丢失——而 lrnev_hook_tail_log 是用户
 * 排查 hook 的唯一手段（ADR-0003「Hook Drain 边界与超时策略」accepted）。
 *
 * 职责：
 * - track(name, event, chain)：登记一条在飞链；链 settle（无论成败）后自动移除。
 * - drain(timeoutMs)：等待当前全部在飞链 settle，最多 timeoutMs；超时后把仍
 *   pending 的链快照交给 onTimedOut（由 HookManager 注入，补写 timed_out 记录，
 *   让用户能看到"被触发但未完成"）；回调失败静默。
 * - 幂等与复用：并发 drain 共享同一次等待；同一链超时补写只触发一次（reported
 *   标记）；drain 结束（settle 或超时补写后）tracker 仍可继续 track/drain。
 *
 * 注意：drain 是"等待 + 超时报告"，不 kill 子进程（子进程 detached + unref，
 * 存活随进程退出而终止/孤儿化，见 ADR-0003 风险 2）。
 */

export interface DetachedHook {
  /** hook 名称（HookConfig.name）。 */
  name: string;
  /** 触发原事件（与 HookRecord.event 一致，非 ADR 草案的 'drain'，见实现说明）。 */
  event: string;
  /** 链启动时间戳（ms），用于计算 duration_ms。 */
  startedAt: number;
}

/**
 * 超时补写回调。
 *
 * drain 超时后仍 pending 的链会一次性作为快照传入（同一链只会被报告一次，
 * 重复 drain 不会重复补写）；回调可返回 Promise，drain 会等待其完成后再返回
 * （保证 timed_out 记录落盘后才继续进程退出流程）。
 */
export type OnHookTimedOut = (pending: DetachedHook[]) => void | Promise<void>;

interface TrackedChain extends DetachedHook {
  /** 在飞链本体（runAsync 承诺永不 reject）。 */
  chain: Promise<unknown>;
  /** 该链是否已做过 drain 超时补写（重复 drain 幂等的关键）。 */
  reported: boolean;
}

export class DetachedHookTracker {
  private readonly pending = new Set<TrackedChain>();
  /** 正在进行的 drain（并发调用共享同一次等待，避免重复计时/重复补写）。 */
  private draining: Promise<void> | null = null;

  constructor(options: { onTimedOut?: OnHookTimedOut } = {}) {
    this.onTimedOut = options.onTimedOut;
  }

  /** 超时补写回调（HookManager 构造时注入；可在构造后调整）。 */
  onTimedOut?: OnHookTimedOut;

  /** 当前在飞链数量（诊断用）。 */
  get size(): number {
    return this.pending.size;
  }

  /**
   * 登记一条在飞 async hook 链。
   *
   * chain settle（无论 fulfilled/rejected）后自动从追踪集合移除——
   * 之后即使进程未退出也不再被 drain 等待。
   */
  track(name: string, event: string, chain: Promise<unknown>): void {
    const entry: TrackedChain = {
      name,
      event,
      startedAt: Date.now(),
      chain,
      reported: false,
    };
    this.pending.add(entry);
    // 用 then(移除, 移除) 而非 finally：finally 派生链会随原链 reject 造成
    // unhandled rejection；双回调形式保证移除动作自身永不 reject。
    void chain.then(
      () => this.pending.delete(entry),
      () => this.pending.delete(entry),
    );
  }

  /**
   * 等待全部在飞链 settle，最多 timeoutMs；超时后对仍 pending 且未报告过的链
   * 调用 onTimedOut 补写。幂等：并发调用共享同一次 drain；结束后可再次调用
   * （再次 track 的链会进入下一次 drain 的等待范围）。
   *
   * @param timeoutMs 等待上限（默认 5000，ADR-0003 Q2：DSH drain 超时取半）。
   */
  drain(timeoutMs = 5000): Promise<void> {
    if (!this.draining) {
      this.draining = this.runDrain(timeoutMs).finally(() => {
        this.draining = null;
      });
    }
    return this.draining;
  }

  private async runDrain(timeoutMs: number): Promise<void> {
    if (this.pending.size === 0) return;
    const chains = [...this.pending].map((entry) => entry.chain);

    // race：全部 settle 先到 → 无事发生；timeoutMs 先到 → 走超时补写分支。
    const allSettled = await Promise.race([
      Promise.allSettled(chains).then(() => true),
      sleep(timeoutMs).then(() => false),
    ]);
    if (allSettled) return;

    // 只报告"本次超时仍未 settle 且此前未被报告过"的链；
    // 先标记再回调：即使回调抛错/日志写入失败，重复 drain 也不会重复补写。
    const overdue = [...this.pending].filter((entry) => !entry.reported);
    if (overdue.length === 0) return;
    for (const entry of overdue) entry.reported = true;
    if (!this.onTimedOut) return;
    try {
      await this.onTimedOut(overdue.map(({ name, event, startedAt }) => ({ name, event, startedAt })));
    } catch {
      // drain 处于进程退出前的最末路径，补写失败只能静默（日志不可用已无他法）。
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
