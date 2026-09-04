import type { ModelVisibleRenderer } from '../model-visible-contract.js';
import type { LrnevToolPayload } from '../../types/response-envelope.js';
import type { ADR } from '../../../types/adr.js';

/**
 * adr_get 渲染器
 *
 * MVC required 字段（D-04 选择/歧义类）:
 * - number/title（身份）
 * - status
 * - scope
 * - body（context/decision/alternatives/consequences 完整呈现）
 * - supersedes/superseded_by（如有）
 * - path
 * - ai_followup（如有）
 */
export const adrGetRenderer: ModelVisibleRenderer<ADR> = {
  render(payload: LrnevToolPayload<ADR>): string {
    if (!payload.ok || !payload.data) {
      return 'ADR 读取失败';
    }

    const { number, title, status, scope, body, supersedes, superseded_by, path } = payload.data;
    const lines: string[] = [];

    lines.push(`# ADR ${number}: ${title}`);
    lines.push('');
    lines.push(`**状态**: ${status}`);
    lines.push(`**范围**: ${scope}`);
    lines.push(`**路径**: ${path}`);
    lines.push('');

    if (supersedes && supersedes.length > 0) {
      lines.push(`**替代**: ${supersedes.join(', ')}`);
      lines.push('');
    }

    if (superseded_by && superseded_by.length > 0) {
      lines.push(`**被替代**: ${superseded_by.join(', ')}`);
      lines.push('');
    }

    lines.push('## 背景');
    lines.push('');
    lines.push(body.context);
    lines.push('');

    lines.push('## 决策');
    lines.push('');
    lines.push(body.decision);
    lines.push('');

    if (body.alternatives && body.alternatives.length > 0) {
      lines.push('## 备选方案');
      lines.push('');
      for (const alt of body.alternatives) {
        lines.push(alt);
      }
      lines.push('');
    }

    if (body.consequences) {
      lines.push('## 后果');
      lines.push('');
      lines.push(body.consequences);
      lines.push('');
    }

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
