import type { ModelVisibleRenderer } from '../model-visible-contract.js';
import type { LrnevToolPayload } from '../../types/response-envelope.js';

/**
 * spec_get 渲染器
 *
 * 08-00 核心验证点：SPEC_REWRITE_GUIDANCE 例外条款
 * - 已完成 Spec 提示考虑开新版（整体推翻重做）
 * - draft/ready/in-progress 零噪音（不提示）
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

    // SPEC_REWRITE_GUIDANCE 例外条款（仅对 completed spec 提示）
    if (status === 'completed') {
      lines.push('💡 该 Spec 已实现完成');
      lines.push('');
      lines.push('如需整体推翻重做：');
      lines.push('- 创建新版本 Spec（spec_create version=1）');
      lines.push('- 原 Spec 标记为 archived（spec_update status=archived）');
      lines.push('');
      lines.push('如需小修小改：');
      lines.push('- 直接编辑 requirements.md / design.md / tasks.md');
      lines.push('- 无需开新 Spec');
    }

    // 文档状态
    if (documents) {
      lines.push('📁 文档状态：');
      lines.push(JSON.stringify(documents, null, 2));
    }

    return lines.join('\n');
  },
};
