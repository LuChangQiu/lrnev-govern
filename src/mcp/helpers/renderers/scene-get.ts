import type { ModelVisibleRenderer } from '../model-visible-contract.js';
import type { LrnevToolPayload } from '../../types/response-envelope.js';
import type { Scene } from '../../../types/scene.js';
import { escapeFrameworkMarkers } from '../model-visible-contract.js';

/**
 * scene_get 渲染器
 *
 * MVC required 字段（D-04 选择/歧义类）:
 * - id/number/name（身份）
 * - status
 * - intent（如有）
 * - spec_count（统计）
 * - path
 * - broken（如损坏）
 * - ai_followup（如有）
 */
export const sceneGetRenderer: ModelVisibleRenderer<Scene> = {
  render(payload: LrnevToolPayload<Scene>): string {
    if (!payload.ok || !payload.data) {
      return 'Scene 读取失败';
    }

    const { id, number, name, status, intent, spec_count, path, broken } = payload.data;
    const lines: string[] = [];

    lines.push(`# Scene ${id}`);
    lines.push('');
    lines.push(`**序号**: ${number}`);
    lines.push(`**名称**: ${name}`);
    lines.push(`**状态**: ${status}`);
    lines.push(`**Spec 数量**: ${spec_count}`);
    lines.push(`**路径**: ${path}`);
    lines.push('');

    if (intent) {
      lines.push('**业务意图**:');
      lines.push(escapeFrameworkMarkers(intent));
      lines.push('');
    }

    if (broken) {
      lines.push('⚠️ **损坏标记**:');
      lines.push(`  错误: ${broken.error}`);
      lines.push(`  路径: ${broken.path}`);
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
