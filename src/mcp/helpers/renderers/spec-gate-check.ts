import type { ModelVisibleRenderer } from '../model-visible-contract.js';
import type { LrnevToolPayload } from '../../types/response-envelope.js';
import type { GateResult } from '../../../types/gate.js';

/**
 * spec_gate_check 渲染器
 *
 * MVC required 字段（D-04 gate 类）:
 * - gate（类型）
 * - passed（整体结果）
 * - checks（完整列表，passed/failed 都要呈现）
 * - 失败的 check：message/hint
 * - 可继续操作提示（如 gate=ready 失败但仍可 design）
 * - ai_followup.instructions（如有）
 */
export const specGateCheckRenderer: ModelVisibleRenderer<GateResult> = {
  render(payload: LrnevToolPayload<GateResult>): string {
    if (!payload.ok || !payload.data) {
      return 'Gate 检查失败';
    }

    const { gate, passed, checks } = payload.data;
    const lines: string[] = [];

    // 整体结果
    lines.push(passed ? `✅ ${gate} gate 通过` : `❌ ${gate} gate 未通过`);
    lines.push('');

    // 完整 checks 列表（passed/failed 都呈现）
    lines.push('检查项：');
    for (const check of checks) {
      const status = check.passed ? '✓' : '✗';
      const label = check.hard_fail ? '[必须]' : '[建议]';
      lines.push(`  ${status} ${label} ${check.name}`);
      if (!check.passed && check.message) {
        lines.push(`    ${check.message}`);
        if (check.hint) {
          lines.push(`    提示: ${check.hint}`);
        }
      }
    }
    lines.push('');

    // 投影 ai_followup
    if (payload.ai_followup?.instructions) {
      for (const instruction of payload.ai_followup.instructions) {
        lines.push(instruction);
      }
      lines.push('');
    }

    if (payload.ai_followup?.suggested_tools) {
      lines.push('建议工具：');
      for (const tool of payload.ai_followup.suggested_tools) {
        lines.push(`- ${tool.name}: ${tool.reason}`);
      }
    }

    return lines.join('\n');
  },
};
