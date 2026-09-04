import type { ModelVisibleRenderer } from '../model-visible-contract.js';
import type { LrnevToolPayload } from '../../types/response-envelope.js';
import type { GovernanceReportResult } from '../../../types/governance-report.js';

/**
 * lrnev_report 渲染器
 *
 * D-04 list/inspection 类 required 字段：
 * - 欠债清单：未收口 tasks/failed tasks/blocked tasks（完整）
 * - 验收覆盖率：validates 覆盖情况（孤儿/坏 validates）
 * - 每条欠债的可执行下一步
 * - 统计数据（counts, coverage_ratio）
 *
 * 特殊要求：用户文本逃逸（task title, spec name）
 * 注意：escapeFrameworkMarkers 在 renderModelVisibleContent 统一调用，渲染器返回未逃逸文本
 */
export const lrnevReportRenderer: ModelVisibleRenderer = {
  render(payload: LrnevToolPayload<GovernanceReportResult>): string {
    if (!payload.ok || !payload.data) {
      return JSON.stringify(payload, null, 2);
    }

    const { data } = payload;
    const lines: string[] = [];

    lines.push('# 治理体检报告');
    lines.push('');
    lines.push(`生成时间: ${data.generated_at}`);
    lines.push(`范围: ${data.scope}`);
    lines.push('');

    // headline（确定性一句话总结）
    lines.push(`## 总览`);
    lines.push('');
    lines.push(data.headline);
    lines.push('');

    // 链路完整度统计
    lines.push('## 链路完整度');
    lines.push('');
    lines.push(`- Scene 数: ${data.chain.scene_count}`);
    lines.push(`- Spec 数: ${data.chain.spec_count}`);
    lines.push(`- Task 数: ${data.chain.task_count}`);
    lines.push('');

    // Scene 汇总
    if (data.chain.scenes.length > 0) {
      lines.push('### Scene 统计');
      lines.push('');
      for (const scene of data.chain.scenes) {
        const emptyLabel = scene.empty ? ' (空)' : '';
        lines.push(`- ${scene.scene} (${scene.name}): ${scene.spec_count} specs, ${scene.task_count} tasks${emptyLabel}`);
      }
      lines.push('');
    }

    // 未收口 Spec（欠债清单 1）
    if (data.chain.unclosed.length > 0) {
      lines.push('### ❌ 未收口 Spec');
      lines.push('');
      for (const item of data.chain.unclosed) {
        lines.push(`**${item.scene}/${item.spec}** - ${item.name}`);
        lines.push(`  状态: ${item.status} | 已完成: ${item.done}/${item.total} tasks`);
        if (item.paths) {
          lines.push(`  URI: ${item.paths.uri}`);
        }
        if (item.next_action) {
          lines.push(`  下一步: ${item.next_action}`);
        }
        lines.push('');
      }
    }

    // Failed Tasks（欠债清单 2）
    if (data.chain.failed_tasks.length > 0) {
      lines.push('### ❌ 失败任务');
      lines.push('');
      for (const task of data.chain.failed_tasks) {
        lines.push(`**${task.id}** - ${task.title}`);
        lines.push(`  Scene/Spec: ${task.scene}/${task.spec}`);
        if (task.next_action) {
          lines.push(`  下一步: ${task.next_action}`);
        }
        lines.push('');
      }
    }

    // Blocked Tasks（欠债清单 3）
    if (data.chain.blocked_tasks.length > 0) {
      lines.push('### ⚠️  阻塞任务');
      lines.push('');
      for (const task of data.chain.blocked_tasks) {
        lines.push(`**${task.id}** - ${task.title}`);
        lines.push(`  Scene/Spec: ${task.scene}/${task.spec}`);
        if (task.next_action) {
          lines.push(`  下一步: ${task.next_action}`);
        }
        lines.push('');
      }
    }

    // Validates 覆盖率
    lines.push('## Validates 覆盖率');
    lines.push('');
    lines.push(`- 总锚点数: ${data.coverage.anchor_total}`);
    lines.push(`- 已覆盖: ${data.coverage.anchor_covered}`);
    lines.push(`- 覆盖率: ${(data.coverage.coverage_ratio * 100).toFixed(1)}%`);
    if (data.coverage.archived_excluded > 0) {
      lines.push(`- 已排除 archived spec: ${data.coverage.archived_excluded}`);
    }
    lines.push('');

    // 在途孤儿锚点（正常态）
    if (data.coverage.in_flight_orphans.length > 0) {
      lines.push('### 在途孤儿锚点（未完成 Spec）');
      lines.push('');
      for (const group of data.coverage.in_flight_orphans) {
        lines.push(`**${group.scene}/${group.spec}** (${group.status})`);
        lines.push(`  孤儿锚点: ${group.anchors.join(', ')}`);
        if (group.paths) {
          lines.push(`  URI: ${group.paths.uri}`);
        }
        lines.push('');
      }
    }

    // 已收口孤儿锚点（欠债清单 4）
    if (data.coverage.debt_orphans.length > 0) {
      lines.push('### ❌ 已收口 Spec 的孤儿锚点');
      lines.push('');
      for (const group of data.coverage.debt_orphans) {
        lines.push(`**${group.scene}/${group.spec}** (${group.status})`);
        lines.push(`  孤儿锚点: ${group.anchors.join(', ')}`);
        if (group.paths) {
          lines.push(`  URI: ${group.paths.uri}`);
        }
        if (group.next_action) {
          lines.push(`  下一步: ${group.next_action}`);
        }
        lines.push('');
      }
    }

    // 坏 validates
    if (data.coverage.broken_validates.length > 0) {
      lines.push('### ⚠️  坏 validates（指向不存在锚点）');
      lines.push('');
      for (const item of data.coverage.broken_validates) {
        lines.push(`**${item.scene}/${item.spec}** Task ${item.task}`);
        lines.push(`  坏锚点: ${item.anchors.join(', ')}`);
        lines.push(`  下一步: ${item.next_action}`);
        lines.push('');
      }
    }

    // Release notes（可选）
    if (data.release_notes) {
      lines.push('## Release Notes');
      lines.push('');
      for (const scene of data.release_notes.scenes) {
        lines.push(`### ${scene.scene} - ${scene.name}`);
        lines.push('');
        for (const spec of scene.specs) {
          lines.push(`#### ${spec.spec} - ${spec.name}`);
          lines.push('');
          for (const taskTitle of spec.tasks) {
            lines.push(`- ${taskTitle}`);
          }
          lines.push('');
        }
      }
    }

    // Warnings
    if (data.warnings && data.warnings.length > 0) {
      lines.push('## 警告');
      lines.push('');
      for (const warning of data.warnings) {
        lines.push(`⚠️  ${warning}`);
      }
      lines.push('');
    }

    // 投影 ai_followup
    if (payload.ai_followup?.instructions) {
      lines.push('---');
      lines.push('');
      for (const instruction of payload.ai_followup.instructions) {
        lines.push(instruction);
      }
    }

    return lines.join('\n');
  },
};
