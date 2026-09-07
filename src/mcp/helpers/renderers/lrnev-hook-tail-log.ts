import type { ModelVisibleRenderer } from '../model-visible-contract.js';
import type { LrnevToolPayload } from '../../types/response-envelope.js';
import type { HookRecord } from '../../../types/hooks.js';

/**
 * lrnev_hook_tail_log 渲染器
 *
 * MVC required 字段（D-04 搜索/列表类）：
 * - 全部日志记录列表
 * - 每条记录的关键字段：ts, hook, event, status, duration_ms, exit_code, stdout_tail, stderr_tail
 * - ai_followup 投影
 */
export const lrnevHookTailLogRenderer: ModelVisibleRenderer<HookRecord[]> = {
  render(payload: LrnevToolPayload<HookRecord[]>): string {
    if (!payload.ok || !payload.data) {
      return '日志读取失败';
    }

    const lines: string[] = [];
    const count = payload.data.length;

    lines.push(`📜 最近 ${count} 条 Hook 执行日志`);
    lines.push('');

    if (count === 0) {
      lines.push('无执行记录。');
    } else {
      for (const record of payload.data) {
        const statusEmoji = record.status === 'success' ? '✅' : record.status === 'failed' ? '❌' : '⏱️';
        lines.push(`${statusEmoji} ${record.ts}`);
        lines.push(`   Hook: ${record.hook}`);
        lines.push(`   事件: ${record.event}`);
        lines.push(`   状态: ${record.status}`);
        lines.push(`   模式: ${record.mode}`);
        lines.push(`   耗时: ${record.duration_ms}ms`);
        // exit_code 已 optional：invoked/timed_out 记录无子进程退出码，显示 '-'。
        lines.push(`   退出码: ${record.exit_code ?? '-'}`);

        if (record.stdout_tail) {
          lines.push(`   stdout: ${record.stdout_tail}`);
        }
        if (record.stderr_tail) {
          lines.push(`   stderr: ${record.stderr_tail}`);
        }
        lines.push('');
      }
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
