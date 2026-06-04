import { spawn, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';

import { loadConfig } from '../shared/config.js';
import { LrnevError, ErrorCode } from '../shared/errors.js';
import type { HookConfig, HookRecord, HookWarning } from '../types/hooks.js';
import { HookLog } from './HookLog.js';

/**
 * HookRunner 执行用户显式配置的 hook 命令并记录日志。
 *
 * 这里的 spawn 只运行 hooks.json 中的本地命令，不创建 AI agent；
 * agent 生命周期只由 AgentRegistry 记录和续租。
 */
export class HookRunner {
  constructor(
    private readonly workspaceRoot: string,
    private readonly log: HookLog,
  ) {}

  async runSync(hook: HookConfig, event: string, payload: Record<string, unknown>): Promise<HookWarning[]> {
    const record = await this.runProcess(hook, event, payload, false);
    await this.log.append(record);
    return this.applyFailurePolicy(hook, record);
  }

  runAsync(hook: HookConfig, event: string, payload: Record<string, unknown>): void {
    setImmediate(() => {
      void this.runProcess(hook, event, payload, true)
        .then((record) => this.log.append(record))
        .catch((err) => {
          const record: HookRecord = {
            ts: new Date().toISOString(),
            event,
            hook: hook.name,
            mode: 'async',
            status: 'failed',
            duration_ms: 0,
            exit_code: -1,
            stderr_tail: err instanceof Error ? err.message : String(err),
          };
          void this.log.append(record);
        });
    });
  }

  private async runProcess(
    hook: HookConfig,
    event: string,
    payload: Record<string, unknown>,
    detached: boolean,
  ): Promise<HookRecord> {
    const start = Date.now();
    const outputLimit = loadConfig(this.workspaceRoot).hooks.output_tail_bytes;
    const command = normalizeCommand(hook.command);
    const cmd = command[0];
    if (!cmd) {
      throw new LrnevError(ErrorCode.INVALID_INPUT, `Hook "${hook.name}" command 不能为空`, {
        field: 'command',
      });
    }
    const args = command.slice(1);
    const child = spawn(cmd, args, {
      cwd: resolveHookCwd(this.workspaceRoot, hook.cwd),
      env: {
        ...process.env,
        ...hook.env,
        LRNEV_EVENT: event,
        LRNEV_HOOK_NAME: hook.name,
        LRNEV_PAYLOAD: JSON.stringify(payload),
        LRNEV_WORKSPACE_ROOT: this.workspaceRoot,
      },
      detached,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    }) as ChildProcess;

    if (detached) child.unref();

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    child.stdout?.on('data', (chunk: Buffer) => {
      stdout = tail(stdout + String(chunk), outputLimit);
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr = tail(stderr + String(chunk), outputLimit);
    });

    const timer = setTimeout(() => {
      timedOut = true;
      killProcess(child.pid);
    }, hook.timeout_ms);

    return new Promise((resolveRecord) => {
      let settled = false;
      const settle = (record: HookRecord) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolveRecord(record);
      };

      child.once('error', (err: Error) => {
        clearTimeout(timer);
        settle({
          ts: new Date().toISOString(),
          event,
          hook: hook.name,
          mode: hook.mode,
          status: 'failed',
          duration_ms: Date.now() - start,
          exit_code: -1,
          stdout_tail: stdout,
          stderr_tail: tail(`${stderr}\n${err.message}`, outputLimit),
        });
      });
      child.once('close', (code: number | null, signal: NodeJS.Signals | null) => {
        const exitCode = code ?? (signal ? -1 : 0);
        settle({
          ts: new Date().toISOString(),
          event,
          hook: hook.name,
          mode: hook.mode,
          status: timedOut ? 'timeout' : exitCode === 0 ? 'success' : 'failed',
          duration_ms: Date.now() - start,
          exit_code: exitCode,
          stdout_tail: stdout,
          stderr_tail: stderr,
        });
      });
    });
  }

  private applyFailurePolicy(hook: HookConfig, record: HookRecord): HookWarning[] {
    if (record.status === 'success') return [];
    const message = `Hook "${hook.name}" ${record.status}，exit_code=${record.exit_code}`;
    if (hook.on_failure === 'abort') {
      throw new LrnevError(
        record.status === 'timeout' ? ErrorCode.HOOK_TIMEOUT : ErrorCode.HOOK_FAILED,
        message,
        {
          field: 'hook',
          hint: '修复 hook 命令，或把 on_failure 改为 warn/silent',
        },
      );
    }
    if (hook.on_failure === 'warn') {
      return [{ hook: hook.name, status: record.status, message }];
    }
    return [];
  }
}

export function normalizeCommand(command: string | string[]): string[] {
  if (Array.isArray(command)) return command;
  return process.platform === 'win32'
    ? ['cmd.exe', '/c', command]
    : ['/bin/sh', '-c', command];
}

function resolveHookCwd(workspaceRoot: string, cwd?: string): string {
  return cwd ? resolve(workspaceRoot, cwd) : workspaceRoot;
}

function killProcess(pid: number | undefined): void {
  if (!pid) return;
  try {
    if (process.platform === 'win32') {
      process.kill(pid, 'SIGKILL');
    } else {
      process.kill(-pid, 'SIGKILL');
    }
  } catch {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // best effort
    }
  }
}

function tail(value: string, max: number): string {
  return value.length <= max ? value : value.slice(value.length - max);
}
