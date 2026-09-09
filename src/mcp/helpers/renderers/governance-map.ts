import type { ModelVisibleRenderer } from '../model-visible-contract.js';
import type { LrnevToolPayload } from '../../types/response-envelope.js';
import type { GovernanceMapResult } from '../../../types/governance-map.js';

/**
 * governance_map 渲染器
 *
 * D-04 list/inspection 类 required 字段：
 * - 完整层级：scene→spec（status/L0 标题）→anchor（F-/D-/T- 锚点标题）
 * - spec 条目的决策字段（status）；scene 无状态机（status 已从模板移除），不展示假状态
 * - 层级关系（scene→spec→anchors）
 *
 * 职责：投影 canonical payload 已有数据，不创作 guidance 文本
 */
export const governanceMapRenderer: ModelVisibleRenderer = {
  render(payload: LrnevToolPayload<GovernanceMapResult>): string {
    if (!payload.ok || !payload.data) {
      return JSON.stringify(payload, null, 2);
    }

    const { data } = payload;
    const lines: string[] = [];

    lines.push('# 治理地图（压缩全景）');
    lines.push('');
    lines.push(`生成时间: ${data.generated_at}`);
    lines.push('');

    // 完整层级：scene→spec→anchors
    for (const scene of data.scenes) {
      lines.push(`## Scene: ${scene.scene} - ${scene.name}`);
      if (scene.intent) {
        lines.push(`   意图: ${scene.intent}`);
      }
      lines.push('');

      if (scene.specs.length === 0) {
        lines.push('   （无 Spec）');
        lines.push('');
        continue;
      }

      for (const spec of scene.specs) {
        // 决策字段：status, priority（可选）
        const priorityLabel = spec.priority ? ` [${spec.priority}]` : '';
        lines.push(`   ### Spec: ${spec.spec} - ${spec.name}${priorityLabel}`);
        lines.push(`       状态: ${spec.status}`);

        // L0 标题（如有）
        if (spec.l0) {
          lines.push(`       L0: ${spec.l0}`);
        }

        // 锚点标题列表（完整）
        if (spec.anchors.length > 0) {
          lines.push('       锚点:');
          for (const anchor of spec.anchors) {
            lines.push(`         - ${anchor}`);
          }
        } else {
          lines.push('       （无锚点）');
        }
        lines.push('');
      }
    }

    // 投影 ai_followup
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
