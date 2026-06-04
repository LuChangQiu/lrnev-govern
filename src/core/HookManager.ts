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
        runner.runAsync(hook, event, payload);
      }
    }
    return {
      event,
      matched: matched.length,
      warnings,
    };
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
