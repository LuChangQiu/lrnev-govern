import type { ModelVisibleRenderer } from '../model-visible-contract.js';
import type { LrnevToolPayload } from '../../types/response-envelope.js';

/**
 * agent_unregister 渲染器
 *
 * MVC required 字段（D-04 写入类）:
 * - agent_id（身份字段）
 * - unregistered（状态字段）
 * - claims_released（如有）
 * - ai_followup.instructions（如有）
 */
export const agentUnregisterRenderer: ModelVisibleRenderer<{
  agent_id: string;
  unregistered: boolean;
  claims_released?: number;
}> = {
  render(payload: LrnevToolPayload<{
    agent_id: string;
    unregistered: boolean;
    claims_released?: number;
  }>): string {
    if (!payload.ok || !payload.data) {
      return '注销失败';
    }

    const { agent_id, unregistered, claims_released } = payload.data;
    const lines: string[] = [];

    if (unregistered) {
      lines.push(`✅ Agent "${agent_id}" 已注销`);
      if (claims_released !== undefined && claims_released > 0) {
        lines.push(`   释放 ${claims_released} 个 claim`);
      }
    } else {
      lines.push(`Agent "${agent_id}" 不存在，无需注销`);
    }
    lines.push('');

    // 投影 ai_followup
    if (payload.ai_followup?.instructions) {
      for (const instruction of payload.ai_followup.instructions) {
        lines.push(instruction);
      }
    }

    return lines.join('\n');
  },
};
