import { resolve } from 'node:path';

import { z } from 'zod';

import { loadConfig } from '../shared/config.js';
import { ErrorCode, LrnevError } from '../shared/errors.js';
import { FileStorage } from '../storage/FileStorage.js';
import type {
  HookConfig,
  HookConfigIssue,
  HookEvent,
  HookListResult,
  HookRecord,
  TriggerHookResult,
} from '../types/hooks.js';
import type { AiFollowupResponse } from '../types/response.js';
import { DetachedHookTracker, type DetachedHook } from './DetachedHookTracker.js';
import { HOOK_LOG_REL, HookLog } from './HookLog.js';
import { HookRunner } from './HookRunner.js';

export const HOOKS_CONFIG_REL = '.lrnev/config/hooks.json';
export { HOOK_LOG_REL };

const managersByRoot = new Map<string, HookManager>();
const HOOK_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * HookManager 负责 hooks.json 的加载、校验、启停和事件触发。
 *
 * Hook 是用户显式配置的自动化扩展，不是 lrnev 自行 spawn agent 的机制。
 */
export class HookManager {
  constructor(private readonly fs: FileStorage) {}

  /**
   * 在飞 async hook 链追踪器（ADR-0003「Hook Drain 边界与超时策略」）。
   *
   * 进程退出 drain 超时后，经 onTimedOut 补写 timed_out 记录：保证用户经
   * lrnev_hook_tail_log 能看到"被触发但未完成"的 hook（先写 invoked 之外的
   * 第二重证据），而不是静默丢失。
   */
  private readonly detached = new DetachedHookTracker({
    onTimedOut: (pending) => this.appendTimedOutRecords(pending),
  });

  async list(): Promise<AiFollowupResponse<HookListResult>> {
    const { hooks, issues } = await this.loadHooks();
    const recent = await this.readRecentRecords(loadConfig(this.fs.root).hooks.recent_list_limit);
    return {
      ok: true,
      data: {
        implemented: true,
        hooks,
        recent,
        config_path: HOOKS_CONFIG_REL,
        issues,
      },
      ...(issues.length > 0 && { warnings: issues.map((issue) => issue.message) }),
      ai_followup: {
        instructions: issues.length > 0
          ? [
            'hooks.json 存在无效配置，lrnev 会跳过这些条目。',
            '请根据 issues 修复字段后重新运行 hook list 或 doctor。',
          ]
          : [
            hooks.length > 0
              ? 'Hook 配置已加载；可用 hook trigger 手动测试事件。'
              : '当前没有 hook 配置；需要扩展自动化时在 .lrnev/config/hooks.json 中添加配置。',
          ],
      },
    };
  }

  async trigger(event: HookEvent | string, payload: Record<string, unknown> = {}): Promise<TriggerHookResult> {
    const { hooks } = await this.loadHooks();
    const matched = hooks.filter((hook) => hook.enabled && eventMatches(hook.event, event));
    if (matched.length === 0) {
      return { event, matched: 0, warnings: [] };
    }
    const runner = new HookRunner(this.fs.root, new HookLog(this.fs));
    const warnings: string[] = [];
    for (const hook of matched) {
      if (hook.mode === 'sync') {
        warnings.push(...(await runner.runSync(hook, event, payload)).map((warning) => warning.message));
      } else {
        // ADR-0003：async hook 不再裸 fire-and-forget——invoked 记录已在
        // runAsync 内部先写，链交给 detached 追踪，进程退出 drain 时统一等待。
        // runAsync 承诺永不 reject；此处 catch 是防御未来内部改动的兜底
        // （补 failed 记录后照常 settle，不让任何意外 reject 逃出追踪链）。
        const chain = runner.runAsync(hook, event, payload).catch(async (err) => {
          try {
            await new HookLog(this.fs).append({
              ts: new Date().toISOString(),
              event,
              hook: hook.name,
              mode: hook.mode,
              status: 'failed',
              duration_ms: 0,
              exit_code: -1,
              stderr_tail: err instanceof Error ? err.message : String(err),
            });
          } catch {
            // 日志不可用只能静默（同 appendTimedOutRecords）。
          }
        });
        this.detached.track(hook.name, event, chain);
      }
    }
    return {
      event,
      matched: matched.length,
      warnings,
    };
  }

  /**
   * ADR-0003：等待本实例全部在飞 async hook 链 settle，最多 timeoutMs。
   *
   * 幂等性由 DetachedHookTracker 保证（并发 drain 共享一次等待；同一链只补写
   * 一次 timed_out）；drain 完成（settle 或超时补写后）仍可继续触发/再次 drain。
   * 进程退出挂接（src/mcp/server.ts shutdown）持有 root 对应的单例
   * getHookManager(root)，经此方法收尾。
   *
   * @param timeoutMs 等待上限，默认 5000（ADR-0003 Q2 决策）。
   */
  async drainDetached(timeoutMs = 5000): Promise<void> {
    await this.detached.drain(timeoutMs);
  }

  /**
   * drain 超时补写：对仍在运行的链各落一条 timed_out 记录。
   * 进程即将退出，日志写入尽力而为（失败静默）。
   */
  private async appendTimedOutRecords(pending: DetachedHook[]): Promise<void> {
    const log = new HookLog(this.fs);
    const now = Date.now();
    for (const item of pending) {
      const record: HookRecord = {
        ts: new Date(now).toISOString(),
        // event 语义偏离 ADR-0003 草案（草案超时合成记录用 event:'drain'）：
        // 保留触发原事件，与 invoked/终态记录一致，tail-log 可按事件过滤定位；
        // status:'timed_out' 已足以表达"drain 等待超时"，见实现说明。
        event: item.event,
        hook: item.name,
        mode: 'async',
        status: 'timed_out',
        duration_ms: now - item.startedAt,
        // exit_code 省略：drain 超时时子进程可能仍在运行，没有退出码。
        stderr_tail: 'drain 等待超时未完成：进程退出时该 hook 可能仍在运行（记录由进程退出 drain 补写）',
      };
      try {
        await log.append(record);
      } catch {
        // 进程退出最末路径：hook 日志写入失败只能静默。
      }
    }
  }

  async triggerResponse(
    event: HookEvent | string,
    payload: Record<string, unknown> = {},
  ): Promise<AiFollowupResponse<TriggerHookResult>> {
    const result = await this.trigger(event, payload);
    return {
      ok: true,
      data: result,
      ...(result.warnings.length > 0 && { warnings: result.warnings }),
      ai_followup: {
        instructions: result.warnings.length > 0
          ? ['Hook 已触发，但存在非致命 warning；请调用 lrnev_hook_tail_log 或 CLI hook tail-log 查看 hook-log 中的 warnings。']
          : [`事件 "${event}" 已触发，匹配 ${result.matched} 个 hook；如需确认输出，请调用 lrnev_hook_tail_log 或 CLI hook tail-log。`],
      },
    };
  }

  async setEnabled(name: string, enabled: boolean): Promise<AiFollowupResponse<HookConfig>> {
    return this.fs.withDirectoryLock('.lrnev/locks/hooks-config.lockdir', async () => {
      const raw = await this.readRawConfig();
      const index = raw.findIndex((item) => isPlainObject(item) && item.name === name);
      if (index === -1) {
        throw new LrnevError(ErrorCode.INVALID_INPUT, `Hook 不存在：${name}`, { field: 'name' });
      }
      raw[index] = { ...(raw[index] as Record<string, unknown>), enabled };
      await this.fs.writeJson(HOOKS_CONFIG_REL, raw);
      const { hooks } = await this.loadHooks();
      const hook = hooks.find((item) => item.name === name);
      if (!hook) {
        throw new LrnevError(ErrorCode.INVALID_INPUT, `Hook 配置更新后仍无效：${name}`, {
          field: 'name',
          hint: '运行 lrnev doctor 查看 hooks.json 校验错误。',
        });
      }
      return {
        ok: true,
        data: hook,
        ai_followup: {
          instructions: [
            `Hook "${name}" 已${enabled ? '启用' : '禁用'}。`,
            '请调用 hook list 确认配置状态；必要时用 hook trigger 做一次手动验证。',
          ],
        },
      };
    });
  }

  async loadHooks(): Promise<{ hooks: HookConfig[]; issues: HookConfigIssue[] }> {
    if (!this.fs.exists(HOOKS_CONFIG_REL)) {
      return { hooks: [], issues: [] };
    }

    let parsed: unknown;
    try {
      parsed = await this.fs.readJson<unknown>(HOOKS_CONFIG_REL);
    } catch (err) {
      return {
        hooks: [],
        issues: [{
          code: ErrorCode.HOOK_CONFIG_INVALID,
          message: err instanceof Error ? err.message : String(err),
          path: HOOKS_CONFIG_REL,
        }],
      };
    }

    if (!Array.isArray(parsed)) {
      return {
        hooks: [],
        issues: [{
          code: ErrorCode.HOOK_CONFIG_INVALID,
          message: 'hooks.json 顶层必须是数组',
          path: HOOKS_CONFIG_REL,
        }],
      };
    }

    const seen = new Set<string>();
    const hooks: HookConfig[] = [];
    const issues: HookConfigIssue[] = [];
    for (let i = 0; i < parsed.length; i++) {
      const result = this.hookSchema().safeParse(parsed[i]);
      if (!result.success) {
        issues.push(...result.error.issues.map((issue) => ({
          code: ErrorCode.HOOK_CONFIG_INVALID,
          index: i,
          message: `hooks.json 配置无效：${issue.path.join('.') || '<item>'} ${issue.message}`,
          path: HOOKS_CONFIG_REL,
        })));
        continue;
      }
      const hook = result.data;
      if (seen.has(hook.name)) {
        issues.push({
          code: ErrorCode.HOOK_CONFIG_INVALID,
          index: i,
          name: hook.name,
          message: `Hook name 重复：${hook.name}`,
          path: HOOKS_CONFIG_REL,
        });
        continue;
      }
      seen.add(hook.name);

      const cwdIssue = validateCwd(this.fs.root, hook.cwd, i, hook.name);
      if (cwdIssue) {
        issues.push(cwdIssue);
        continue;
      }

      hooks.push(hook);
    }

    return { hooks, issues };
  }

  private async readRawConfig(): Promise<unknown[]> {
    if (!this.fs.exists(HOOKS_CONFIG_REL)) return [];
    const raw = await this.fs.readJson<unknown>(HOOKS_CONFIG_REL);
    if (!Array.isArray(raw)) {
      throw new LrnevError(ErrorCode.INVALID_INPUT, 'hooks.json 顶层必须是数组', {
        field: 'hooks',
      });
    }
    return raw;
  }

  async readRecentRecords(limit?: number): Promise<HookRecord[]> {
    return new HookLog(this.fs).tail(limit);
  }

  async tailLog(limit?: number): Promise<AiFollowupResponse<HookRecord[]>> {
    return {
      ok: true,
      data: await this.readRecentRecords(limit),
      ai_followup: {
        instructions: ['已读取最近 hook 执行日志；如发现 failed/timeout，请结合 stderr_tail 修 hooks.json 后再运行 hook trigger 验证。'],
      },
    };
  }

  private hookSchema() {
    const config = loadConfig(this.fs.root).hooks;
    return z.object({
      name: z.string().regex(HOOK_NAME_RE),
      event: z.string().min(1),
      command: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
      timeout_ms: z.number().int().positive().max(config.max_timeout_ms).default(config.default_timeout_ms),
      mode: z.enum(['sync', 'async']).default('async'),
      enabled: z.boolean().default(true),
      env: z.record(z.string()).default({}),
      cwd: z.string().optional(),
      on_failure: z.enum(['abort', 'warn', 'silent']).default('warn'),
    }).strict();
  }
}

export function getHookManager(root: string): HookManager {
  const storage = new FileStorage(root);
  const key = storage.root;
  let manager = managersByRoot.get(key);
  if (!manager) {
    manager = new HookManager(storage);
    managersByRoot.set(key, manager);
  }
  return manager;
}

export function appendHookWarnings<T>(
  response: AiFollowupResponse<T>,
  warnings: string[],
): AiFollowupResponse<T> {
  if (warnings.length === 0) return response;
  return {
    ...response,
    warnings: [...(response.warnings ?? []), ...warnings],
    ai_followup: {
      instructions: [
        ...(response.ai_followup?.instructions ?? []),
        ...warnings.map((warning) => `Hook 警告：${warning}`),
      ],
      ...(response.ai_followup?.suggested_tools && {
        suggested_tools: response.ai_followup.suggested_tools,
      }),
    },
  };
}

export function eventMatches(pattern: string, event: string): boolean {
  if (pattern === event) return true;
  if (!pattern.endsWith('*')) return false;
  return event.startsWith(pattern.slice(0, -1));
}

function validateCwd(
  root: string,
  cwd: string | undefined,
  index: number,
  name: string,
): HookConfigIssue | null {
  if (!cwd) return null;
  const resolved = resolve(root, cwd);
  const rootWithSep = root.endsWith('\\') || root.endsWith('/') ? root : `${root}${process.platform === 'win32' ? '\\' : '/'}`;
  const hasParentSegment = cwd.split(/[\\/]+/).includes('..');
  if (hasParentSegment || (resolved !== root && !resolved.startsWith(rootWithSep))) {
    return {
      code: ErrorCode.HOOK_CONFIG_INVALID,
      index,
      name,
      message: `Hook cwd 越出工作区：${cwd}`,
      path: HOOKS_CONFIG_REL,
    };
  }
  return null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
