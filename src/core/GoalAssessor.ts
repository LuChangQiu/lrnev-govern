/**
 * GoalAssessor —— 目标复杂度启发式评估。
 *
 * 这里不调用 LLM，只根据目标文本里的范围词、风险词、模糊度做初筛，
 * 再通过 ai_followup 让 AI 和用户确认拆分方案。
 */

import { LrnevError, ErrorCode } from '../shared/errors.js';
import type { AiFollowupResponse } from '../types/response.js';
import type { GoalAssessment, GoalAssessmentKind } from '../types/goal.js';

export class GoalAssessor {
  assess(goal: string): AiFollowupResponse<GoalAssessment> {
    const text = goal.trim();
    if (!text) {
      throw new LrnevError(ErrorCode.INVALID_INPUT, 'goal 不能为空', { field: 'goal' });
    }

    const reasons: string[] = [];
    let score = 0;
    const hasResearchSignal = /调研|探索|不确定|选型|实验|research|spike|prototype/i.test(text);
    const hasImplementationSignal = /实现|开发|重构|修复|解决|交付|上线|落地|接入|新增|增加|改造|迁移|优化/i.test(text);

    const researchScore = addIfMatch(text, /调研|探索|不确定|选型|实验|research|spike|prototype/i, 4, reasons, '目标包含调研、选型或不确定方案');
    score += researchScore;
    score += addIfMatch(text, /平台|体系|全局|多个|全链路|工作流|framework|platform/i, 3, reasons, '目标涉及跨模块或平台级改造');
    score += addIfMatch(text, /重构|迁移|改造|migration/i, 2, reasons, '目标包含实现或结构调整信号');
    score += addIfMatch(text, /方案.*验证|验证.*方案/i, 2, reasons, '目标需要先验证方案可行性');
    score += addIfMatch(text, /权限|支付|认证|数据一致性|并发|安全|兼容|性能|架构|存储|协议/i, 1, reasons, '目标包含高风险技术约束，需结合上下文确认拆分粒度');
    score += addIfMatch(text, /以及|同时|并且|全部|所有|一整套|端到端/i, 2, reasons, '目标可能包含多个交付面');

    // 枚举信号：顿号/逗号/分号并列 ≥3 个实质项，多半是多个可交付特性。
    const enumeratedItems = text.split(/[、,，;；]/).map((item) => item.trim()).filter((item) => item.length >= 2);
    const hasStrongMultiFeatureSignal = enumeratedItems.length >= 3;
    if (hasStrongMultiFeatureSignal) {
      score += 3;
      reasons.push(`目标列举了 ${enumeratedItems.length} 个并列项，可能是多个可交付特性`);
    }

    if (text.length > 120) {
      score += 2;
      reasons.push('目标描述较长，可能需要拆分');
    }
    if (reasons.length === 0) {
      reasons.push('启发式信号不足，默认先按单个 Spec 候选处理');
    }

    // I-11: 强多特性信号直接抬升 kind，保证 reasons 与 kind 一致（不再被固定 score 阈值压回 single-spec）。
    const kind: GoalAssessmentKind =
      hasResearchSignal && !hasImplementationSignal ? 'research-program' :
        hasStrongMultiFeatureSignal || score >= 5 ? 'multi-spec-program' :
          'single-spec';
    const confidence = score >= 7 ? 'high' : score <= 1 ? 'low' : 'medium';

    const assessment: GoalAssessment = {
      kind,
      confidence,
      score,
      reasons,
      suggested_next_step: nextStep(kind),
    };

    return {
      ok: true,
      data: assessment,
      ai_followup: {
        instructions: [
          `评估结果是 ${kind}，请和用户确认这个拆分粒度是否正确。`,
          ...(confidence === 'low'
            ? ['启发式信号不足，请 AI 结合项目上下文和用户真实意图判断拆分粒度。']
            : []),
          assessment.suggested_next_step,
          '三档分流指引：改错别字、调样式等以后无人追问的小事可不落地；踩坑/错误用 error_record，小决策/选型用 adr_create，一句约定或要点用 memory_save；只有可交付特性且需要需求追踪、任务拆分时才 spec_create。',
          '边界 case（如重构某函数、修安全漏洞、加分页参数）不要靠规则硬分流，请结合上下文判断是否够格开 Spec。',
          '如果目标边界仍模糊，先补 Scene 背景或创建 ADR 记录关键选择，再创建 Spec。',
        ],
      },
    };
  }
}

function addIfMatch(
  text: string,
  pattern: RegExp,
  weight: number,
  reasons: string[],
  reason: string,
): number {
  if (!pattern.test(text)) return 0;
  reasons.push(reason);
  return weight;
}

function nextStep(kind: GoalAssessmentKind): string {
  if (kind === 'single-spec') {
    return '建议在现有 Scene 下创建一个 Spec，并把需求、设计、任务放入该 Spec。';
  }
  if (kind === 'multi-spec-program') {
    return '建议先确认 Scene 边界，再拆成多个 Spec，避免一个 Spec 承载过多变化。';
  }
  return '建议先做研究型 Scene 或 ADR，明确方案、约束和验证标准后再拆 Spec。';
}
