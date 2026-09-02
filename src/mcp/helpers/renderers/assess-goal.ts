import type { ModelVisibleRenderer } from '../model-visible-contract.js';
import type { LrnevToolPayload } from '../../types/response-envelope.js';
import { GOAL_ASSESSOR_OVERRIDE_CLAUSE } from '../../../core/guidance-semantics.js';

/**
 * assess_goal 渲染器
 *
 * 08-00 核心验证点：GOAL_ASSESSOR_OVERRIDE_CLAUSE
 * - 评估结果是建议，不是强制
 * - 用户可选择更高或更低粒度
 * - 必须读取 suggested_next_step 字段（不是 reasoning）
 */
export const assessGoalRenderer: ModelVisibleRenderer = {
  render(payload: LrnevToolPayload<{ kind: string; suggested_next_step?: string }>): string {
    if (!payload.ok || !payload.data) {
      return JSON.stringify(payload, null, 2);
    }

    const { kind, suggested_next_step } = payload.data;
    const lines: string[] = [];

    lines.push(`📊 目标复杂度评估：${kind}`);
    lines.push('');

    if (suggested_next_step) {
      lines.push(`建议步骤：${suggested_next_step}`);
      lines.push('');
    }

    // 引用 GOAL_ASSESSOR_OVERRIDE_CLAUSE 常量（08-00 语义权威）
    lines.push(GOAL_ASSESSOR_OVERRIDE_CLAUSE);

    return lines.join('\n');
  },
};
