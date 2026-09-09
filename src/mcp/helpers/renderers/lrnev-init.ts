import type { ModelVisibleRenderer } from '../model-visible-contract.js';
import type { LrnevToolPayload } from '../../types/response-envelope.js';
import type { InitWorkspaceResult } from '../../../types/workspace.js';

/**
 * lrnev_init 渲染器
 *
 * MVC required 字段（D-04 写入类）:
 * - root（路径字段）
 * - was_new（状态字段）
 * - files_created/files_existing
 * - ai_followup.instructions（如有）
 */
export const lrnevInitRenderer: ModelVisibleRenderer<InitWorkspaceResult> = {
  render(payload: LrnevToolPayload<InitWorkspaceResult>): string {
    if (!payload.ok || !payload.data) {
      return '初始化失败';
    }

    const { root, was_new, files_created, files_existing } = payload.data;
    const lines: string[] = [];

    lines.push(`✅ 工作区已${was_new ? '创建' : '确认'}`);
    lines.push(`   根目录: ${root}`);
    lines.push('');

    if (files_created.length > 0) {
      lines.push(`已创建 ${files_created.length} 个文件：`);
      for (const file of files_created.slice(0, 10)) {
        lines.push(`   ${file}`);
      }
      if (files_created.length > 10) {
        lines.push(`   ... 及其他 ${files_created.length - 10} 个文件`);
      }
      lines.push('');
    }

    if (files_existing.length > 0) {
      lines.push(`已存在 ${files_existing.length} 个文件（未覆盖）`);
      lines.push('');
    }

    // ADR 0003：AGENTS.md 生成结果
    if (payload.data.agents_md === 'created') {
      lines.push('✅ 已在项目根生成 AGENTS.md（指针式，规则真源 .lrnev/steering；AI 不得自行修改本文件）');
      lines.push('');
    } else if (payload.data.agents_md === 'skipped-existing') {
      lines.push('⚠️ 项目根已存在 AGENTS.md（未覆盖——如需 lrnev 指引请手动合并 steering 引用）');
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
