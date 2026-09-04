import type { ModelVisibleRenderer } from '../model-visible-contract.js';
import type { LrnevToolPayload } from '../../types/response-envelope.js';
import type { Scene } from '../../../types/scene.js';

/**
 * scene_create 渲染器
 *
 * 08-00 验证点：MVC required 字段 + ai_followup 投影
 * 渲染器职责：投影 canonical payload 中已有数据，不再创作 guidance 文本
 *
 * T-027 修复：身份字段读 data.id（Scene 的 schema 键），不再读 data.scene——
 * Scene 数据对象没有 scene 键，旧写法在 frontmatter 泄漏被裁剪后必然渲染出
 * "undefined"。
 */
export const sceneCreateRenderer: ModelVisibleRenderer<Scene> = {
  render(payload: LrnevToolPayload<Scene>): string {
    if (!payload.ok || !payload.data) {
      return 'Scene 创建失败';
    }

    const lines: string[] = [];
    lines.push(`✅ Scene 已创建：${payload.data.id}`);
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
