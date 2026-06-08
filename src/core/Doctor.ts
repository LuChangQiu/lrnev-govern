/**
 * Doctor —— .lrnev 工作区自检。
 *
 * M1 只做诊断和修复建议，不自动修改用户内容。
 */

import { loadConfig } from '../shared/config.js';
import { MEMORY_CATEGORIES } from '../shared/paths.js';
import { FileStorage } from '../storage/FileStorage.js';
import { extractCodeRanges, inRanges } from '../storage/MarkdownParser.js';
import { parseURI, uriToFilePath } from '../storage/URIRouter.js';
import { migrateLegacyTodoPlaceholders } from './LegacyTodoMigration.js';
import { parseTasksFromMarkdown } from './TaskManager.js';
import { HookManager, HOOKS_CONFIG_REL } from './HookManager.js';
import { HookLog } from './HookLog.js';
import { AgentRegistry, computeAgentStatus } from './AgentRegistry.js';
import { ClaimStore } from './ClaimStore.js';
import { hostname } from 'node:os';
import type { DiagnosticIssue, DiagnosticReport, TodoMigrationReport } from '../types/doctor.js';
import type { HookRecord } from '../types/hooks.js';

const REQUIRED_DIRS = [
  '.lrnev',
  '.lrnev/scenes',
  '.lrnev/decisions/adr',
  '.lrnev/errorbook/incidents',
  '.lrnev/errorbook/promoted',
  '.lrnev/memory',
  '.lrnev/steering',
  '.lrnev/auto',
  '.lrnev/config',
  '.lrnev/agents',
  '.lrnev/runtime',
  '.lrnev/runtime/claims',
  '.lrnev/locks',
  '.lrnev/state',
  ...MEMORY_CATEGORIES.map((category) => `.lrnev/memory/${category}`),
];

export class Doctor {
  constructor(private readonly fs: FileStorage) {}

  async migrateTodosToSentinels(): Promise<TodoMigrationReport> {
    const files = await this.fs.list('.lrnev/**/*.md', { dot: true });
    files.sort();

    const changed: TodoMigrationReport['files'] = [];
    for (const file of files) {
      const content = await this.fs.read(file);
      const migrated = migrateLegacyTodoPlaceholders(content);
      if (migrated.replacements.length === 0) continue;
      await this.fs.write(file, migrated.content);
      changed.push({
        path: file,
        replacements: migrated.replacements,
      });
    }

    return {
      ok: true,
      migrated_at: new Date().toISOString(),
      scanned_files: files.length,
      changed_files: changed.length,
      replacements: changed.reduce((sum, file) => sum + file.replacements.length, 0),
      files: changed,
    };
  }

  async diagnose(): Promise<DiagnosticReport> {
    const issues: DiagnosticIssue[] = [];
    await this.checkWorkspaceDirs(issues);
    await this.checkSpecDocuments(issues);
    await this.checkSpecDocumentSizes(issues);
    await this.checkStaleTasks(issues);
    await this.checkStaleTaskClaims(issues);
    await this.checkStaleDirectoryLocks(issues);
    await this.checkAdrConflicts(issues);
    await this.checkContextReferences(issues);
    await this.checkHookConfig(issues);
    await this.checkHookHealth(issues);
    await this.checkAgentRegistry(issues);
    await this.checkStaleAgents(issues);
    await this.checkOrphanClaims(issues);

    const summary = {
      errors: issues.filter((issue) => issue.severity === 'error').length,
      warnings: issues.filter((issue) => issue.severity === 'warning').length,
      info: issues.filter((issue) => issue.severity === 'info').length,
    };
    return {
      ok: summary.errors === 0,
      checked_at: new Date().toISOString(),
      summary,
      issues,
    };
  }

  private async checkWorkspaceDirs(issues: DiagnosticIssue[]): Promise<void> {
    for (const dir of REQUIRED_DIRS) {
      if (!this.fs.exists(dir)) {
        issues.push({
          code: 'MISSING_DIR',
          severity: 'error',
          message: `缺少标准目录：${dir}`,
          path: dir,
          suggestion: '运行 lrnev_init 或手动恢复该目录。',
        });
      }
    }
  }

  private async checkSpecDocuments(issues: DiagnosticIssue[]): Promise<void> {
    const specDirs = await this.fs.list('.lrnev/scenes/*/specs/*');
    for (const dir of specDirs) {
      const stat = await this.fs.stat(dir).catch(() => null);
      if (!stat?.isDirectory) continue;
      for (const doc of ['requirements.md', 'design.md', 'tasks.md']) {
        const path = `${dir}/${doc}`;
        if (!this.fs.exists(path)) {
          issues.push({
            code: 'SPEC_DOC_MISSING',
            severity: 'error',
            message: `Spec 缺少 ${doc}`,
            path,
            suggestion: '恢复缺失文档，或重新创建该 Spec 的文档骨架。',
          });
        }
      }
    }
  }

  private async checkStaleTasks(issues: DiagnosticIssue[]): Promise<void> {
    const files = await this.fs.list('.lrnev/scenes/*/specs/*/tasks.md');
    const staleTaskDays = loadConfig(this.fs.root).doctor.stale_task_days;
    const maxAgeMs = staleTaskDays * 24 * 60 * 60 * 1000;
    const now = Date.now();
    for (const file of files) {
      const ids = /^\.lrnev\/scenes\/([^/]+)\/specs\/([^/]+)\/tasks\.md$/.exec(file);
      if (!ids) continue;
      const content = await this.fs.read(file);
      const tasks = parseTasksFromMarkdown(content, ids[1]!, ids[2]!);
      for (const task of tasks) {
        if (task.status !== 'in_progress') continue;
        const baseTime = new Date(task.updated ?? task.created).getTime();
        if (Number.isFinite(baseTime) && now - baseTime > maxAgeMs) {
          issues.push({
            code: 'STALE_TASK',
            severity: 'warning',
            message: `Task ${task.id} 已 in_progress 超过 ${staleTaskDays} 天`,
            path: file,
            suggestion: '确认任务是否仍在执行；必要时改为 blocked、failed 或 completed。',
          });
        }
      }
    }
  }

  private async checkStaleTaskClaims(issues: DiagnosticIssue[]): Promise<void> {
    const registry = new AgentRegistry(this.fs);
    const claimStore = new ClaimStore(this.fs, (agentId) => registry.isAgentDead(agentId));
    const activeClaimKeys = new Set(
      (await claimStore.listActive()).map((claim) => taskClaimKey(claim.scene, claim.spec, claim.task)),
    );
    const files = await this.fs.list('.lrnev/scenes/*/specs/*/tasks.md');
    for (const file of files) {
      const ids = /^\.lrnev\/scenes\/([^/]+)\/specs\/([^/]+)\/tasks\.md$/.exec(file);
      if (!ids) continue;
      const scene = ids[1]!;
      const spec = ids[2]!;
      const content = await this.fs.read(file);
      for (const task of parseTasksFromMarkdown(content, scene, spec)) {
        if (task.status !== 'in_progress') continue;
        if (activeClaimKeys.has(taskClaimKey(scene, spec, task.id))) continue;
        issues.push({
          code: 'STALE_TASK_CLAIM',
          severity: 'warning',
          message: `Task ${task.id} 处于 in_progress，但没有活跃 task claim`,
          path: file,
          suggestion: '如果仍在做，请调用 task_claim 或 task_update(agent_id) 重新登记；如果无人接手，可从 project_status 的可领任务视图重新认领。',
        });
      }
    }
  }

  private async checkSpecDocumentSizes(issues: DiagnosticIssue[]): Promise<void> {
    const warningKb = loadConfig(this.fs.root).spec.file_size_warning_kb;
    const warningBytes = warningKb * 1024;
    const files = await this.fs.list('.lrnev/scenes/*/specs/*/{requirements,design,tasks}.md');
    for (const file of files) {
      const fileStat = await this.fs.stat(file).catch(() => null);
      if (!fileStat?.isFile || fileStat.size <= warningBytes) continue;
      issues.push({
        code: 'SPEC_DOC_TOO_LARGE',
        severity: 'warning',
        message: `Spec 文档超过 ${warningKb} KB`,
        path: file,
        suggestion: '拆分过长内容，或补充 L0/L1 摘要后按需读取全文。',
      });
    }
  }

  private async checkStaleDirectoryLocks(issues: DiagnosticIssue[]): Promise<void> {
    const staleMinutes = loadConfig(this.fs.root).doctor.stale_lock_minutes;
    const maxAgeMs = staleMinutes * 60 * 1000;
    const now = Date.now();
    const locks = await this.fs.list('.lrnev/locks/*');
    for (const lock of locks) {
      const lockStat = await this.fs.stat(lock).catch(() => null);
      if (!lockStat?.isDirectory) continue;
      if (now - lockStat.mtime.getTime() <= maxAgeMs) continue;
      issues.push({
        code: 'STALE_DIRECTORY_LOCK',
        severity: 'warning',
        message: `目录锁超过 ${staleMinutes} 分钟未释放`,
        path: lock,
        suggestion: '确认没有 lrnev 调用仍在运行后，再删除该 .lockdir 目录。',
      });
    }
  }

  private async checkAdrConflicts(issues: DiagnosticIssue[]): Promise<void> {
    const dirs = ['.lrnev/decisions/adr', ...(await this.fs.list('.lrnev/scenes/*/decisions/adr'))];
    for (const dir of dirs) {
      const stat = await this.fs.stat(dir).catch(() => null);
      if (!stat?.isDirectory) continue;
      const files = await this.fs.list(`${dir}/[0-9][0-9][0-9][0-9]-*.md`);
      const groups = new Map<string, string[]>();
      for (const file of files) {
        const number = /\/(\d{4})-.+\.md$/.exec(file)?.[1];
        if (!number) continue;
        groups.set(number, [...(groups.get(number) ?? []), file]);
      }
      for (const [number, paths] of groups.entries()) {
        if (paths.length > 1) {
          issues.push({
            code: 'ADR_NUMBER_CONFLICT',
            severity: 'error',
            message: `ADR 编号 ${number} 冲突`,
            path: dir,
            suggestion: `保留一个 ${number}-*.md，并调整其他 ADR 编号。`,
          });
        }
      }
    }
  }

  private async checkContextReferences(issues: DiagnosticIssue[]): Promise<void> {
    const files = await this.fs.list('.lrnev/**/*.md', { dot: true });
    for (const file of files) {
      const content = await this.fs.read(file);
      for (const uri of extractContextUris(content)) {
        const target = await this.resolveReferencePath(uri);
        if (target === null) continue;
        if (!this.fs.exists(target)) {
          issues.push({
            code: 'BROKEN_CONTEXT_REF',
            severity: 'warning',
            message: `context 引用目标不存在：${uri}`,
            path: file,
            suggestion: '修正 URI，或恢复被引用的目标文档。',
          });
        }
      }
    }
  }

  private async checkHookConfig(issues: DiagnosticIssue[]): Promise<void> {
    const { hooks, issues: hookIssues } = await new HookManager(this.fs).loadHooks();
    for (const issue of hookIssues) {
      issues.push({
        code: issue.code,
        severity: 'warning',
        message: issue.message,
        path: issue.path,
        suggestion: '修复 .lrnev/config/hooks.json；无效 hook 会被跳过，但不会阻断主流程。',
      });
    }

    for (const hook of hooks) {
      if (typeof hook.command !== 'string') continue;
      issues.push({
        code: 'HOOK_SHELL_FORM',
        severity: 'info',
        message: `Hook "${hook.name}" 使用字符串命令，会通过平台 shell 执行。`,
        path: HOOKS_CONFIG_REL,
        suggestion: '优先改为 command 数组形式，减少 shell 注入和跨平台差异风险。',
      });
    }
  }

  private async checkHookHealth(issues: DiagnosticIssue[]): Promise<void> {
    const config = loadConfig(this.fs.root).hooks;
    const records = await new HookLog(this.fs).tail(config.health_scan_limit);
    const byHook = groupHookRecords(records);
    for (const [hook, hookRecords] of byHook.entries()) {
      const timeoutCount = countConsecutiveFromTail(hookRecords, (record) => record.status === 'timeout');
      if (timeoutCount >= config.chronic_timeout_threshold) {
        issues.push({
          code: 'HOOK_CHRONIC_TIMEOUT',
          severity: 'warning',
          message: `Hook "${hook}" 连续 ${timeoutCount} 次超时。`,
          path: '.lrnev/state/hook-log.jsonl',
          suggestion: '检查 hook 脚本性能、timeout_ms 配置，或临时禁用该 hook。',
        });
      }

      const failureCount = countConsecutiveFromTail(hookRecords, (record) => record.status !== 'success');
      if (failureCount >= config.chronic_failure_threshold) {
        issues.push({
          code: 'HOOK_CHRONIC_FAILURE',
          severity: 'error',
          message: `Hook "${hook}" 连续 ${failureCount} 次失败或超时。`,
          path: '.lrnev/state/hook-log.jsonl',
          suggestion: `运行 lrnev hook disable ${hook} 临时禁用，修复命令后再启用。`,
        });
      }
    }
  }

  private async checkAgentRegistry(issues: DiagnosticIssue[]): Promise<void> {
    const { issues: registryIssues } = await new AgentRegistry(this.fs).loadRegistry();
    for (const issue of registryIssues) {
      issues.push({
        code: issue.code,
        severity: 'warning',
        message: issue.message,
        path: issue.path,
        suggestion: '修复 .lrnev/agents/registry.json；损坏时 lrnev 会按空注册表降级。',
      });
    }
  }

  private async checkStaleAgents(issues: DiagnosticIssue[]): Promise<void> {
    const { registry } = await new AgentRegistry(this.fs).loadRegistry();
    const deadMs = loadConfig(this.fs.root).agent.heartbeat_dead_ms;
    const currentHost = hostname();
    for (const agent of Object.values(registry)) {
      // 只报本机 pid 已不在世的条目;跨主机无法探活,交给心跳年龄,不在这里强判。
      if (agent.host !== currentHost) continue;
      if (computeAgentStatus(agent, deadMs) !== 'dead') continue;
      issues.push({
        code: 'STALE_AGENT',
        severity: 'warning',
        message: `Agent ${agent.agent_id} 的进程(pid=${agent.pid})已不在世,但仍留在注册表`,
        path: '.lrnev/agents/registry.json',
        suggestion: '该会话已退出;可调用 agent_unregister 清理,或忽略(读取时已按 dead 计算,不影响接手)。',
      });
    }
  }

  private async checkOrphanClaims(issues: DiagnosticIssue[]): Promise<void> {
    const { registry } = await new AgentRegistry(this.fs).loadRegistry();
    const deadMs = loadConfig(this.fs.root).agent.heartbeat_dead_ms;
    const now = Date.now();
    for (const claim of await new ClaimStore(this.fs).listAll()) {
      // 已过期的 claim 走 STALE_TASK_CLAIM/惰性过滤,不在此重复报。
      if (new Date(claim.expires_at).getTime() <= now) continue;
      const owner = registry[claim.claimed_by];
      const ownerDead = owner ? computeAgentStatus(owner, deadMs) === 'dead' : undefined;
      if (owner && ownerDead === false) continue; // 属主仍活,正常占用
      const reason = owner
        ? `属主 Agent ${claim.claimed_by} 进程已退出`
        : `属主 Agent ${claim.claimed_by} 不在注册表`;
      issues.push({
        code: 'ORPHAN_CLAIM',
        severity: 'warning',
        message: `claim ${claim.scene}/${claim.spec}/${claim.task} 的${reason}`,
        path: `.lrnev/runtime/claims`,
        suggestion: '该 claim 已可被他人接手;可调 task_release 清理,或重新 task_claim 接手。',
      });
    }
  }

  private async resolveReferencePath(uri: string): Promise<string | null> {
    try {
      const rel = uriToFilePath(parseURI(uri));
      if (rel === null) return null;
      if (/\/\d{4}$/.test(rel)) {
        const matches = await this.fs.list(`${rel}-*.md`);
        return matches.length > 0 ? matches[0]! : rel;
      }
      return rel;
    } catch {
      return '__invalid_context_uri__';
    }
  }
}

function groupHookRecords(records: HookRecord[]): Map<string, HookRecord[]> {
  const byHook = new Map<string, HookRecord[]>();
  for (const record of records) {
    byHook.set(record.hook, [...(byHook.get(record.hook) ?? []), record]);
  }
  return byHook;
}

function countConsecutiveFromTail(
  records: HookRecord[],
  predicate: (record: HookRecord) => boolean,
): number {
  let count = 0;
  for (let i = records.length - 1; i >= 0; i--) {
    if (!predicate(records[i]!)) break;
    count++;
  }
  return count;
}

function extractContextUris(content: string): string[] {
  const codeRanges = extractCodeRanges(content);
  const uris: string[] = [];
  const regex = /context:\/\/[^\s)>\]}`]+/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    if (inRanges(codeRanges, match.index, match.index + match[0]!.length)) continue;
    const uri = match[0]!.replace(/[.,;，。；]+$/, '');
    if (uri.includes('{') || uri.includes('}')) continue;
    uris.push(uri);
  }
  return uris;
}

function taskClaimKey(scene: string, spec: string, task: string): string {
  return `${scene}/${spec}/${task}`;
}
