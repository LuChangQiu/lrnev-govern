import type { ModelVisibleRenderer } from '../model-visible-contract.js';
import type { LrnevToolPayload } from '../../types/response-envelope.js';

/**
 * spec_create 渲染器
 *
 * 08-00 核心验证点：
 * - 投影 SpecManager 真实 followup（【事实】→【建议】→【重要】三行结构，L216-218）
 * - ai_followup.instructions 包含 USER_DECISION_PRIORITY_CLAUSE + SPEC_CREATION_SUCCESS_FOLLOWUP
 * - 渲染器职责：投影已有数据，不再创作 guidance 文本
 */
export const specCreateRenderer: ModelVisibleRenderer = {
  render(payload: LrnevToolPayload<{ spec: string; scene: string; path: string }>): string {
    if (!payload.ok || !payload.data) {
      // 错误路径由 errorRenderer 处理
      return JSON.stringify(payload, null, 2);
    }

    const { spec, scene, path } = payload.data;
    const lines: string[] = [];

    // 基础事实（简洁版）
    lines.push(`✅ 已创建 Spec: ${spec}`);
    lines.push(`   Scene: ${scene}`);
    lines.push(`   路径: ${path}`);
    lines.push('');

    // 投影 SpecManager 真实 followup（包含【事实】→【建议】→【重要】三行结构）
    if (payload.ai_followup?.instructions) {
      for (const instruction of payload.ai_followup.instructions) {
        lines.push(instruction);
      }
      lines.push('');
    }

    return lines.join('\n');
  },
};
