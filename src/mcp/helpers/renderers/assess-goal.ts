import type { ModelVisibleRenderer } from '../model-visible-contract.js';
import type { LrnevToolPayload } from '../../types/response-envelope.js';

/**
 * assess_goal 渲染器
 *
 * 08-00 核心验证点：GOAL_ASSESSOR_OVERRIDE_CLAUSE
 * - 评估结果是建议，不是强制
 * - 用户可选择更高或更低粒度
 */
export const assessGoalRenderer: ModelVisibleRenderer = {
  render(payload: LrnevToolPayload<{ kind: string; reasoning?: string }>): string {
    if (!payload.ok || !payload.data) {
      return JSON.stringify(payload, null, 2);
    }

    const { kind, reasoning } = payload.data;
    const lines: string[] = [];

    lines.push(`📊 目标复杂度评估：${kind}`);
    lines.push('');

    if (reasoning) {
      lines.push(`理由：${reasoning}`);
      lines.push('');
    }

    // GOAL_ASSESSOR_OVERRIDE_CLAUSE
    lines.push('💡 这是建议，不是强制');
    lines.push('');

    if (kind === 'single-spec') {
      lines.push('建议：开 1 个 Spec');
      lines.push('- 可选：若用户明确要拆分 → 拆成多个 Spec');
      lines.push('- 可选：若用户明确直接做 → 跳过 spec，直接改代码');
    } else if (kind === 'multi-spec-program') {
      lines.push('建议：拆分为多个 Spec（按独立可交付特性）');
      lines.push('- 可选：若用户明确要合并 → 合成 1 个 Spec');
    } else if (kind === 'research-program') {
      lines.push('建议：先调研，产出 ADR 后再决定是否开 Spec');
      lines.push('- 可选：若用户明确要边做边研究 → 开 Spec 边实现边调研');
    }

    lines.push('');
    lines.push('【重要】用户决定优先于评估建议');

    return lines.join('\n');
  },
};
