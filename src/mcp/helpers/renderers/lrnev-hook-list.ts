import type { ModelVisibleRenderer } from '../model-visible-contract.js';
import type { LrnevToolPayload } from '../../types/response-envelope.js';
import type { HookListResult } from '../../../types/hooks.js';

/**
 * lrnev_hook_list 渲染器
 *
 * MVC required 字段（D-04 搜索/列表类）：
 * - 全部 hooks 配置列表（name, event, command, enabled, timeout, mode）
 * - recent 执行记录列表（timestamp, hook_name, event, status, duration, exit_code）
 * - config_path
 * - issues（如有）
 * - ai_followup 投影
 */
export const lrnevHookListRenderer: ModelVisibleRenderer<HookListResult> = {
  render(payload: LrnevToolPayload<HookListResult>): string {
    if (!payload.ok || !payload.data) {
      return 'Hook 列表获取失败';
    }

    const { hooks, recent, config_path, issues } = payload.data;
    const lines: string[] = [];

    lines.push(`📋 Hook 配置列表（${hooks.length} 个）`);
    lines.push(`   配置文件: ${config_path}`);
    lines.push('');

    if (hooks.length === 0) {
      lines.push('当前没有 hook 配置。');
    } else {
      for (const hook of hooks) {
        const commandStr = Array.isArray(hook.command) ? hook.command.join(' ') : hook.command;
        lines.push(`## ${hook.name}`);
        lines.push(`   事件: ${hook.event}`);
        lines.push(`   命令: ${commandStr}`);
        lines.push(`   启用: ${hook.enabled ? '是' : '否'}`);
        lines.push(`   模式: ${hook.mode}`);
        lines.push(`   超时: ${hook.timeout_ms}ms`);
        lines.push(`   失败策略: ${hook.on_failure}`);
        if (hook.cwd) {
          lines.push(`   工作目录: ${hook.cwd}`);
        }
        lines.push('');
      }
    }

    if (issues.length > 0) {
      lines.push(`⚠️  配置问题（${issues.length} 个）：`);
      for (const issue of issues) {
        const location = issue.name ? `[${issue.name}]` : issue.index !== undefined ? `[索引 ${issue.index}]` : '';
        lines.push(`   ${location} ${issue.message}`);
      }
      lines.push('');
    }

    if (recent.length > 0) {
      lines.push(`📊 最近执行记录（${recent.length} 条）：`);
      for (const record of recent) {
        const statusEmoji = record.status === 'success' ? '✅' : record.status === 'failed' ? '❌' : '⏱️';
        // exit_code 已 optional：invoked/timed_out 记录无子进程退出码，显示 '-'.
        lines.push(`   ${statusEmoji} ${record.ts} | ${record.hook} | ${record.event} | ${record.status} | ${record.duration_ms}ms | exit=${record.exit_code ?? '-'}`);
        if (record.stderr_tail) {
          lines.push(`      stderr: ${record.stderr_tail}`);
        }
      }
      lines.push('');
    }

    // ai_followup 投影
    if (payload.ai_followup?.instructions) {
      for (const instruction of payload.ai_followup.instructions) {
        lines.push(instruction);
      }
    }

    return lines.join('\n');
  },
};
