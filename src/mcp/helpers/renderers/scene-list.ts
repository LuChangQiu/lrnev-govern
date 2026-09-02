import type { ModelVisibleRenderer } from '../model-visible-contract.js';
import type { LrnevToolPayload } from '../../types/response-envelope.js';

/**
 * scene_list 渲染器
 *
 * 08-00 验证点：MVC required 字段 + ai_followup 投影
 * 渲染器职责：投影 canonical payload 中已有数据，不再创作 guidance 文本
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

    // ai_followup 渲染（投影 canonical payload 中已有数据）
    if (payload.ai_followup?.instructions) {
      for (const instruction of payload.ai_followup.instructions) {
        lines.push(instruction);
      }
    }

    return lines.join('\n');
  },
};
