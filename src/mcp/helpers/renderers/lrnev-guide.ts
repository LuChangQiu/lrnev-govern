import type { ModelVisibleRenderer } from '../model-visible-contract.js';
import type { LrnevToolPayload } from '../../types/response-envelope.js';

/**
 * lrnev_guide 渲染器
 *
 * MVC required 字段（D-04 inspection 类）:
 * - 完整指导内容（workflow/tools/errors/concepts 按 topic 投影）
 * - topic 标识
 * - ai_followup（如有）
 *
 * 渲染器职责：投影 guidance.ts 已生成的 content，不创作新文本
 */
export const lrnevGuideRenderer: ModelVisibleRenderer<{ topic: string; content: string }> = {
  render(payload: LrnevToolPayload<{ topic: string; content: string }>): string {
    if (!payload.ok || !payload.data) {
      return 'lrnev 手册读取失败';
    }

    const { topic, content } = payload.data;
    const lines: string[] = [];

    lines.push(`# lrnev 使用手册`);
    if (topic !== 'all') {
      lines.push(`(topic: ${topic})`);
    }
    lines.push('');

    // 投影完整指导内容（来自 guidance.ts buildGuide）
    lines.push(content);
    lines.push('');

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
