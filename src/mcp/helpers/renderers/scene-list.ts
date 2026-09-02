import type { ModelVisibleRenderer } from '../model-visible-contract.js';
import type { LrnevToolPayload } from '../../types/response-envelope.js';

/**
 * scene_list 渲染器
 *
 * 08-00 验证点：WORKFLOW_OVERVIEW 条款 + MVC required 字段
 */
export const sceneListRenderer: ModelVisibleRenderer = {
  render(payload: LrnevToolPayload<Array<{ id: string; name: string; broken?: unknown }>>): string {
    if (!payload.ok || !payload.data) {
      return '列表获取失败';
    }

    const lines: string[] = [];
    lines.push(`📁 Scene 列表（${payload.data.length} 个）`);
    lines.push('');

    for (const scene of payload.data) {
      const status = scene.broken ? ' ⚠️ 损坏' : '';
      lines.push(`- ${scene.id}${status}`);
    }
    lines.push('');

    // ai_followup 渲染
    if (payload.ai_followup?.instructions) {
      for (const instruction of payload.ai_followup.instructions) {
        lines.push(instruction);
      }
    }

    return lines.join('\n');
  },
};
