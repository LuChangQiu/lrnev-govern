import type { ModelVisibleRenderer } from '../model-visible-contract.js';
import type { LrnevToolPayload } from '../../types/response-envelope.js';
import type { AgentListResult } from '../../../types/agent.js';

/**
 * agent_list 渲染器
 *
 * MVC required 字段（D-04 inspection 类）:
 * - 完整 agent 列表：agent_id/client/registered_at/last_heartbeat
 * - 状态判定：active/dead（根据 last_heartbeat 惰性计算）
 * - 每个 agent 的 claims（task_id/expires_at）
 * - registry_path
 * - issues（如有）
 */
export const agentListRenderer: ModelVisibleRenderer<AgentListResult> = {
  render(payload: LrnevToolPayload<AgentListResult>): string {
    if (!payload.ok || !payload.data) {
      return 'Agent 列表读取失败';
    }

    const { agents, registry_path, issues } = payload.data;
    const lines: string[] = [];

    lines.push(`# Agent 注册表`);
    lines.push('');
    lines.push(`**注册表路径**: ${registry_path}`);
    lines.push('');

    if (agents.length === 0) {
      lines.push('当前无注册 Agent');
      lines.push('');
    } else {
      lines.push(`共 ${agents.length} 个 Agent：`);
      lines.push('');

      for (const agent of agents) {
        const statusBadge = agent.status === 'active' ? '✓' : '✗';
        lines.push(`## ${agent.agent_id} [${statusBadge} ${agent.status}]`);
        lines.push('');
        lines.push(`- **PID**: ${agent.pid}`);
        lines.push(`- **Host**: ${agent.host}`);
        if (agent.client) {
          lines.push(`- **Client**: ${agent.client}`);
        }
        lines.push(`- **Started At**: ${agent.started_at}`);
        lines.push(`- **Last Heartbeat**: ${agent.last_heartbeat}`);
        lines.push('');
      }
    }

    // 投影 issues
    if (issues.length > 0) {
      lines.push('## ⚠️ Registry Issues');
      lines.push('');
      for (const issue of issues) {
        lines.push(`- [${issue.code}] ${issue.message}`);
        lines.push(`  路径: ${issue.path}`);
      }
      lines.push('');
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
