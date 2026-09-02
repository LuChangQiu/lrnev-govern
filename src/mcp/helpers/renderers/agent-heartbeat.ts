import type { ModelVisibleRenderer } from '../model-visible-contract.js';
import type { LrnevToolPayload } from '../../types/response-envelope.js';
import type { AgentInfo } from '../../../types/agent.js';

/**
 * agent_heartbeat 渲染器
 *
 * MVC required 字段（D-04 写入类）:
 * - agent_id（身份字段）
 * - status
 * - last_heartbeat
 * - claims_renewed（如有）
 * - ai_followup.instructions（如有）
 */
export const agentHeartbeatRenderer: ModelVisibleRenderer<AgentInfo & { claims_renewed?: number }> = {
  render(payload: LrnevToolPayload<AgentInfo & { claims_renewed?: number }>): string {
    if (!payload.ok || !payload.data) {
      return '心跳失败';
    }

    const { agent_id, status, last_heartbeat, claims_renewed } = payload.data;
    const lines: string[] = [];

    lines.push(`✅ Agent "${agent_id}" 心跳已更新`);
    lines.push(`   状态: ${status}`);
    lines.push(`   最后心跳: ${last_heartbeat}`);
    if (claims_renewed !== undefined && claims_renewed > 0) {
      lines.push(`   续租 ${claims_renewed} 个 claim`);
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
