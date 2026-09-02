import type { ModelVisibleRenderer } from '../model-visible-contract.js';
import type { LrnevToolPayload } from '../../types/response-envelope.js';
import type { DiagnosticReport } from '../../../types/doctor.js';

/**
 * lrnev_doctor 渲染器
 *
 * MVC required 字段（D-04 inspection 类）:
 * - 完整 issues 列表（broken spec/task/gate/claim/hook/context）
 * - 每个 issue：type/severity/message/affected_paths/fix_suggestion
 * - summary（errors/warnings/info 计数）
 * - checked_at
 * - ok 状态
 */
export const lrnevDoctorRenderer: ModelVisibleRenderer<DiagnosticReport> = {
  render(payload: LrnevToolPayload<DiagnosticReport>): string {
    if (!payload.data) {
      return '工作区诊断失败';
    }

    const { ok, checked_at, summary, issues } = payload.data;
    const lines: string[] = [];

    lines.push(`# lrnev 工作区诊断`);
    lines.push('');
    lines.push(`**检查时间**: ${checked_at}`);
    lines.push(`**状态**: ${ok ? '✓ 健康' : '✗ 发现问题'}`);
    lines.push('');

    lines.push('## 摘要');
    lines.push('');
    if (summary) {
      lines.push(`- **错误**: ${summary.errors}`);
      lines.push(`- **警告**: ${summary.warnings}`);
      lines.push(`- **信息**: ${summary.info}`);
    } else {
      lines.push('（无统计信息）');
    }
    lines.push('');

    if (!issues || issues.length === 0) {
      lines.push('未发现问题。');
      lines.push('');
    } else {
      lines.push(`## 问题详情 (${issues.length} 项)`);
      lines.push('');

      for (const issue of issues) {
        const severityBadge = formatSeverity(issue.severity);
        lines.push(`### [${severityBadge}] ${issue.code}`);
        lines.push('');
        lines.push(`**消息**: ${issue.message}`);
        if (issue.path) {
          lines.push(`**路径**: ${issue.path}`);
        }
        if (issue.suggestion) {
          lines.push(`**修复建议**: ${issue.suggestion}`);
        }
        lines.push('');
      }
    }

    // 投影 ai_followup
    if (payload.ai_followup?.instructions) {
      for (const instruction of payload.ai_followup.instructions) {
        lines.push(instruction);
      }
      lines.push('');
    }

    return lines.join('\n');
  },
};

function formatSeverity(severity: string): string {
  switch (severity) {
    case 'error':
      return '✗ ERROR';
    case 'warning':
      return '⚠ WARNING';
    case 'info':
      return 'ℹ INFO';
    default:
      return severity.toUpperCase();
  }
}
