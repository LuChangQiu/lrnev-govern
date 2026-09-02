import type { ModelVisibleRenderer } from '../model-visible-contract.js';
import type { LrnevToolPayload } from '../../types/response-envelope.js';

/**
 * spec_get 渲染器
 *
 * 08-00 核心验证点：渲染 ai_followup 中的 SPEC_REWRITE_GUIDANCE（VV+1 语义）
 * - 已完成 Spec 提示考虑开新版（整体推翻重做）
 * - draft/ready/in-progress 零噪音（不提示）
 * - 禁止硬编码 version=1（必须使用 VV+1 语义）
 */
export const specGetRenderer: ModelVisibleRenderer = {
  render(payload: LrnevToolPayload<{ spec: string; scene: string; status: string; documents?: unknown }>): string {
    if (!payload.ok || !payload.data) {
      return JSON.stringify(payload, null, 2);
    }

    const { spec, scene, status, documents } = payload.data;
    const lines: string[] = [];

    lines.push(`📄 Spec: ${spec}`);
    lines.push(`   Scene: ${scene}`);
    lines.push(`   状态: ${status}`);
    lines.push('');

    // 文档状态
    if (documents) {
      lines.push('📁 文档状态：');
      lines.push(JSON.stringify(documents, null, 2));
      lines.push('');
    }

    // 渲染 ai_followup（包含 SPEC_REWRITE_GUIDANCE，由 SpecGuidance.ts 生成）
    if (payload.ai_followup?.instructions) {
      for (const instruction of payload.ai_followup.instructions) {
        lines.push(instruction);
      }
    }

    return lines.join('\n');
  },
};
