/**
 * spec get 的“开新版”引导（方案 C）：仅在 Spec 已有实现（存在 completed task 或
 * status=completed）时提示考虑 spec_create --version 开新版；其余情况零噪音。
 *
 * 下沉为 core 共享模块：CLI 与 MCP 共用同一判定，杜绝两路能力漂移（I-1）。
 * 独立成文件而非并入 SpecManager，是为避免 SpecManager ↔ TaskManager 的运行时循环 import。
 */

import { FileStorage } from '../storage/FileStorage.js';
import { parseTasksFromMarkdown } from './TaskManager.js';
import type { SpecManager } from './SpecManager.js';
import type { Spec } from '../types/spec.js';
import type { AiFollowupResponse } from '../types/response.js';

export const SPEC_REWRITE_GUIDANCE =
  '这个 Spec 已有实现（有 completed task 或 status=completed）。若要整体推翻重做，建议开新版 spec_create --version（VV+1）保留旧版对照，再用 spec_update 归档旧版；只是增量加需求时在本版 task_create 即可，不必新开 spec。';

export async function getSpecWithGuidance(
  fs: FileStorage,
  specs: SpecManager,
  scene: string,
  spec: string,
): Promise<Spec | AiFollowupResponse<Spec>> {
  const data = await specs.get(scene, spec);
  try {
    const tasksPath = `.lrnev/scenes/${data.scene}/specs/${data.spec}/tasks.md`;
    const completed = fs.exists(tasksPath)
      ? parseTasksFromMarkdown(await fs.read(tasksPath), data.scene, data.spec)
          .filter((task) => task.status === 'completed').length
      : 0;
    if (completed > 0 || data.status === 'completed') {
      return {
        ok: true,
        data,
        ai_followup: { instructions: [SPEC_REWRITE_GUIDANCE] },
      };
    }
  } catch {
    // 统计失败不阻断 spec get。
  }
  return data;
}
