/**
 * spec get 的分层引导（方案 C + E-02 G1）：
 * - spec 已实现（存在 completed task 或 status=completed）→ 提示考虑 spec_create --version 开新版；
 * - spec 存在且未完成（draft/ready/in-progress）→ 给出"新增开发增量 vs 修改既有正文"的边界引导
 *   （可独立验收的新增开发增量用 task_create 登记任务；仅修改既有正文内容可直接编辑原文件）；
 * - 其余情况（spec 不存在抛错、archived 参考态）零噪音。
 *
 * 下沉为 core 共享模块：CLI 与 MCP 共用同一判定，杜绝两路能力漂移（I-1）。
 * 独立成文件而非并入 SpecManager，是为避免 SpecManager ↔ TaskManager 的运行时循环 import。
 */

import { FileStorage } from '../storage/FileStorage.js';
import { parseTasksFromMarkdown } from './TaskManager.js';
import { ROLE_PREFIX } from './guidance-semantics.js';
import type { SpecManager } from './SpecManager.js';
import type { Spec } from '../types/spec.js';
import type { AiFollowupResponse } from '../types/response.js';

/**
 * spec 已实现时的"开新版"引导（仅对已完成 Spec 提示，其余零噪音）。
 */
export const SPEC_REWRITE_GUIDANCE =
  '这个 Spec 已有实现（有 completed task 或 status=completed）。若要整体推翻重做（新需求与已有 requirements/design 方向相反），建议开新版 spec_create --version（VV+1）保留旧版对照，再用 spec_update 归档旧版；只是增量加需求时在本版 task_create 即可，不必新开 spec。注意：以上是建议，若用户已明确要求独立 Spec（如"帮我新建一个 Spec"），即使已有相似 Spec 可以承载，也应尊重用户决定。';

/**
 * spec 存在但未完成（draft/ready/in-progress）时的增量/正文边界引导（E-02 G1）。
 *
 * 触发场景：AI 刚 spec_get 读完一个进行中 Spec、正要决定"继续开发"的下一个动作
 * （E-02 实测：此时 AI 直接编辑 spec 文档手写任务，从不调用 task_create）。
 *
 * 边界语义：新增可独立验收的开发增量 = 治理登记（task_create）；仅修改既有正文内容 = 直接编辑。
 */
export const SPEC_INCREMENT_GUIDANCE = [
  ROLE_PREFIX.RECOMMENDATION,
  '已有 Spec 下新增可独立验收的开发增量 → 用 task_create 登记任务；仅修改既有正文内容 → 可直接编辑原文件。',
].join('');

export async function getSpecWithGuidance(
  fs: FileStorage,
  specs: SpecManager,
  scene: string,
  spec: string,
): Promise<Spec | AiFollowupResponse<Spec>> {
  const data = await specs.get(scene, spec);

  // archived 是已冻结的参考态：不挂任何"开发/改写"引导，零噪音。
  if (data.status === 'archived') return data;

  let hasImplementation = data.status === 'completed';
  if (!hasImplementation) {
    try {
      const tasksPath = `.lrnev/scenes/${data.scene}/specs/${data.spec}/tasks.md`;
      if (fs.exists(tasksPath)) {
        hasImplementation = parseTasksFromMarkdown(await fs.read(tasksPath), data.scene, data.spec)
          .some((task) => task.status === 'completed');
      }
    } catch {
      // 统计失败不阻断 spec get：无法证明已实现 → 按"未完成"给增量/正文边界引导。
    }
  }

  return {
    ok: true,
    data,
    ai_followup: {
      instructions: [hasImplementation ? SPEC_REWRITE_GUIDANCE : SPEC_INCREMENT_GUIDANCE],
    },
  };
}
