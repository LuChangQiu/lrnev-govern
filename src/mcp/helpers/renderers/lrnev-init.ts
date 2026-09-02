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
 * - codebase_detected
 * - ai_followup.instructions（如有）
 */
export const lrnevInitRenderer: ModelVisibleRenderer<InitWorkspaceResult> = {
  render(payload: LrnevToolPayload<InitWorkspaceResult>): string {
    if (!payload.ok || !payload.data) {
      return '初始化失败';
    }

    const { root, was_new, files_created, files_existing, codebase_detected } = payload.data;
    const lines: string[] = [];

    lines.push(`✅ 工作区已${was_new ? '创建' : '确认'}`);
    lines.push(`   根目录: ${root}`);
    lines.push(`   检测到代码: ${codebase_detected ? '是' : '否'}`);
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
