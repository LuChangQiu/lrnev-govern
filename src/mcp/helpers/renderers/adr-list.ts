import type { ModelVisibleRenderer } from '../model-visible-contract.js';
import type { LrnevToolPayload } from '../../types/response-envelope.js';
import type { ADR } from '../../../types/adr.js';

/**
 * adr_list 渲染器
 *
 * D-04 list/inspection 类 required 字段：
 * - 完整 ADR 列表（全部条目）
 * - 每个条目的决策字段（number, title, status, scope）
 * - supersedes/superseded_by 关系
 *
 * 职责：投影 canonical payload 已有数据，不创作 guidance 文本
 */
export const adrListRenderer: ModelVisibleRenderer = {
  render(payload: LrnevToolPayload<ADR[]>): string {
    if (!payload.ok || !payload.data) {
      return JSON.stringify(payload, null, 2);
    }

    const adrs = payload.data;
    const lines: string[] = [];

    lines.push('# ADR 列表');
    lines.push('');

    if (adrs.length === 0) {
      lines.push('暂无 ADR。');
      lines.push('');
    } else {
      // 按 scope 分组
      const globalAdrs = adrs.filter(adr => adr.scope === 'global');
      const sceneAdrs = adrs.filter(adr => adr.scope !== 'global');

      // Global ADRs
      if (globalAdrs.length > 0) {
        lines.push('## 全局 ADR');
        lines.push('');
        for (const adr of globalAdrs) {
          lines.push(`### ${adr.number}. ${adr.title}`);
          lines.push(`    状态: ${adr.status}`);
          lines.push(`    创建: ${adr.created}`);

          // supersedes 关系
          if (adr.supersedes && adr.supersedes.length > 0) {
            lines.push(`    取代: ${adr.supersedes.join(', ')}`);
          }

          // superseded_by 关系（读时派生）
          if (adr.superseded_by && adr.superseded_by.length > 0) {
            lines.push(`    被取代: ${adr.superseded_by.join(', ')}`);
          }

          lines.push(`    路径: ${adr.path}`);
          lines.push('');
        }
      }

      // Scene ADRs（按 scope 分组）
      if (sceneAdrs.length > 0) {
        const byScope = new Map<string, ADR[]>();
        for (const adr of sceneAdrs) {
          const list = byScope.get(adr.scope) ?? [];
          list.push(adr);
          byScope.set(adr.scope, list);
        }

        for (const [scope, list] of byScope) {
          lines.push(`## ${scope} ADR`);
          lines.push('');
          for (const adr of list) {
            lines.push(`### ${adr.number}. ${adr.title}`);
            lines.push(`    状态: ${adr.status}`);
            lines.push(`    创建: ${adr.created}`);

            // supersedes 关系
            if (adr.supersedes && adr.supersedes.length > 0) {
              lines.push(`    取代: ${adr.supersedes.join(', ')}`);
            }

            // superseded_by 关系（读时派生）
            if (adr.superseded_by && adr.superseded_by.length > 0) {
              lines.push(`    被取代: ${adr.superseded_by.join(', ')}`);
            }

            lines.push(`    路径: ${adr.path}`);
            lines.push('');
          }
        }
      }
    }

    // 投影 ai_followup（如有）
    if (payload.ai_followup?.instructions) {
      lines.push('---');
      lines.push('');
      for (const instruction of payload.ai_followup.instructions) {
        lines.push(instruction);
      }
    }

    return lines.join('\n');
  },
};
