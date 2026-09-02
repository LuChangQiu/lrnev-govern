import type { ModelVisibleRenderer } from '../model-visible-contract.js';
import type { LrnevToolPayload } from '../../types/response-envelope.js';

/**
 * spec_create 渲染器
 *
 * 08-00 核心验证点：
 * - USER_DECISION_PRIORITY_CLAUSE（【重要】...不得擅自撤销）
 * - 【事实】→【建议】→【重要】三行结构
 */
export const specCreateRenderer: ModelVisibleRenderer = {
  render(payload: LrnevToolPayload<{ spec: string; scene: string; followup?: string }>): string {
    if (!payload.ok || !payload.data) {
      // 错误路径由 errorRenderer 处理
      return JSON.stringify(payload, null, 2);
    }

    const { spec, scene, followup } = payload.data;
    const lines: string[] = [];

    // 【事实】行
    lines.push(`✅ 已创建 Spec: ${spec}`);
    lines.push(`   Scene: ${scene}`);
    lines.push('');

    // 【建议】行（assess_goal 推荐时的 followup）
    if (followup) {
      lines.push(`💡 ${followup}`);
      lines.push('');
    }

    // 【重要】行 - USER_DECISION_PRIORITY_CLAUSE
    lines.push('【重要】用户决定优先于建议');
    lines.push('- 若用户明确确认要开 spec → 已开，不得擅自撤销');
    lines.push('- 若用户只是描述需求、没说"开 spec" → 可建议直接做或归入已有 spec');
    lines.push('');

    // 下一步
    lines.push('📝 下一步：');
    lines.push(`1. 填写 requirements.md（定义功能需求）`);
    lines.push(`2. 运行 spec_gate_check 验证就绪状态`);
    lines.push(`3. 填写 design.md 和 tasks.md`);

    return lines.join('\n');
  },
};
