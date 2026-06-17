/**
 * GateGuidance —— spec_gate_check 的 ai_followup 构造，CLI 与 MCP 共用。
 *
 * 下沉到 core 是为了根治 CLI/MCP followup 漂移（同 SpecGuidance 的做法）：
 * 此前 gate followup 只在 MCP 工具层构造，CLI `gate check` 只返回原始 GateResult，
 * 导致 ready gate 的"需求审核门"提示在 CLI 通道不可见。
 */

import type { AiFollowup } from '../types/response.js';
import type { GateResult, GateType } from '../types/gate.js';

/** 按 gate 结果构造 followup：通过给下一步引导（含 ready 的需求审核门），未通过列出失败项与修法。 */
export function buildGateFollowup(
  result: GateResult,
  gate: GateType,
  scene: string,
  spec: string,
): AiFollowup {
  if (!result.passed) {
    return {
      instructions: [
        `${gate} gate 未通过，请按下面失败项修复文档或任务状态，然后用相同 scene/spec/gate 重新调用 spec_gate_check。`,
        ...result.checks
          .filter((check) => !check.passed)
          .map((check) => `${check.name}: ${check.message ?? '检查未通过'}${check.hint ? `；建议：${check.hint}` : ''}`),
      ],
    };
  }
  return buildPassedGateFollowup(gate, scene, spec);
}

function buildPassedGateFollowup(gate: GateType, scene: string, spec: string): AiFollowup {
  if (gate === 'ready') {
    return {
      instructions: [
        'ready gate 已通过：requirements 结构契约完整。',
        '请暂停：把 requirements.md 展示给用户确认「做什么」后再继续——这是用户审核需求方向的唯一人工门，确认后再建 task 与设计；如用户明确说「直接做」则可跳过。',
        '请 AI 自查需求质量和验收标准是否可验证。',
        '建议把 Spec 状态回填为 ready；gate 检查不依赖 status。',
        '若涉及跨模块/跨 Spec 改动，请在 design.md 说明影响面，也可在 Scene 的 architecture.md 用自然语言记录关键实体与依赖；若涉及框架/存储/协议/安全等关键技术决策，建议询问用户是否调用 adr_create 沉淀“为什么”（不强制，不新建本体文件，无决策则不阻塞进入 tasks）。',
        '这个执行项要不要拆成子任务(--parent)？自查三条：1. 大到能拆成可分别认领/可并行的步骤吗？能就拆。2. 子步骤要各自独立验收吗？是就拆。3. 否则保持单个 Task，别为拆而拆。',
      ],
      suggested_tools: [
        {
          name: 'adr_create',
          args_template: {
            title: '<decision-title>',
            scope: `scene:${scene}`,
            context: '<decision context from this Spec>',
            decision: '<confirmed decision>',
          },
          reason: '进入设计/任务前记录关键技术决策',
        },
      ],
    };
  }
  if (gate === 'completion') {
    return {
      instructions: [
        'completion gate 已通过：所有结构化 Task 均已 completed。',
        '建议把 Spec 状态回填为 completed；gate 检查不依赖 status。',
        '请回看本 Spec 的 L0 摘要与验收标准，逐条确认验收标准是否真达成（不只是代码写完）。有未达成项请不要标 spec.status=completed，回去补齐。',
        '如摘要已过期，请总结本次完成内容，方便后续接手。',
      ],
      suggested_tools: [
        {
          name: 'summarize_save',
          args_template: {
            uri: `context://spec/${scene}/${spec}/tasks`,
            l0: '<completion summary>',
            l1: '<completed tasks, verification, residual risks>',
          },
          reason: '完成后保持任务摘要最新',
        },
      ],
    };
  }
  return {
    instructions: [`${gate} gate 已通过，继续下一步流程。`],
  };
}
