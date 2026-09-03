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
 *
 * 05-00 T-004（裁决 Q2）：改投影 ai_followup.instructions 到 content（与其余 41 个
 * 渲染器对齐）——GoalAssessor 的多条指令（含 decision_context 追加的【事实】/【建议】/
 * 【决策边界】行）此前对文本通道不可见 = 01 文本降级信息缺失（F-07）。渲染器职责不变：
 * 投影 canonical payload 中已有数据，不创作 guidance 文本。
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

    // 05-00 T-004（裁决 Q2）：投影 ai_followup.instructions（与其余渲染器一致）。
    // GoalAssessor 的完整指令（确认拆分粒度、三档分流、边界 case、decision_context
    // 追加的【事实】/【建议】/【决策边界】行等）随 content 文本通道送达。
    const instructions = payload.ai_followup?.instructions;
    if (instructions !== undefined && instructions.length > 0) {
      for (const instruction of instructions) {
        lines.push(instruction);
      }
      lines.push('');
    } else if (suggested_next_step) {
      // M1 兜底：无 ai_followup 的 payload 仍投影数据级 suggested_next_step
      lines.push(`建议步骤：${suggested_next_step}`);
      lines.push('');
    }

    // 引用 GOAL_ASSESSOR_OVERRIDE_CLAUSE 常量（08-00 语义权威）
    lines.push(GOAL_ASSESSOR_OVERRIDE_CLAUSE);

    return lines.join('\n');
  },
};
