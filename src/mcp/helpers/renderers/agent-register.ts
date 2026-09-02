import type { ModelVisibleRenderer } from '../model-visible-contract.js';
import type { LrnevToolPayload } from '../../types/response-envelope.js';
import type { AgentRegisterResult } from '../../../types/agent.js';

/**
 * agent_register 渲染器
 *
 * MVC required 字段（D-04 写入类）:
 * - agent_id（身份字段）
 * - status
 * - last_heartbeat
 * - gc（如有）
 * - ai_followup.instructions（如有）
 */
export const agentRegisterRenderer: ModelVisibleRenderer<AgentRegisterResult> = {
  render(payload: LrnevToolPayload<AgentRegisterResult>): string {
    if (!payload.ok || !payload.data) {
      return '注册失败';
    }

    const { agent_id, status, last_heartbeat, gc } = payload.data;
    const lines: string[] = [];

    lines.push(`✅ Agent "${agent_id}" 已注册`);
    lines.push(`   状态: ${status}`);
    lines.push(`   最后心跳: ${last_heartbeat}`);

    if (gc && (gc.removed_agents > 0 || gc.removed_claims > 0)) {
      lines.push('');
      lines.push('机会式 GC 已运行：');
      if (gc.removed_agents > 0) {
        lines.push(`   清理 ${gc.removed_agents} 个 dead agent 记录`);
      }
      if (gc.removed_claims > 0) {
        lines.push(`   清理 ${gc.removed_claims} 个过期 claim`);
      }
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
