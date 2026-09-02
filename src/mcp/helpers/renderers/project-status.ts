import type { ModelVisibleRenderer } from '../model-visible-contract.js';
import type { LrnevToolPayload } from '../../types/response-envelope.js';
import type { ProjectStatusSnapshot } from '../../../types/project-status.js';

/**
 * project_status 渲染器
 *
 * D-04 list/inspection 类 required 字段：
 * - Active tasks（in_progress/pending/blocked，完整）
 * - Specs（含 task_counts, claimable_next）
 * - ADR count（recent_adrs）
 * - Open errors（open_errors count）
 * - Active agents（含 active_claims）
 *
 * 职责：投影 canonical payload 已有数据，不创作 guidance 文本
 */
export const projectStatusRenderer: ModelVisibleRenderer = {
  render(payload: LrnevToolPayload<ProjectStatusSnapshot>): string {
    if (!payload.ok || !payload.data) {
      return JSON.stringify(payload, null, 2);
    }

    const { data } = payload;
    const lines: string[] = [];

    lines.push('# 项目接手快照');
    lines.push('');
    lines.push(`生成时间: ${data.generated_at}`);
    lines.push('');

    // Scenes 概览
    lines.push('## Scenes');
    lines.push('');
    if (data.scenes.length === 0) {
      lines.push('（无 Scene）');
      lines.push('');
    } else {
      for (const scene of data.scenes) {
        lines.push(`- **${scene.id}** (${scene.name}): ${scene.status} | ${scene.spec_count} specs`);
      }
      lines.push('');
    }

    // Active Tasks（核心信息）
    lines.push('## Active Tasks');
    lines.push('');
    if (data.active_tasks.length === 0) {
      lines.push('当前没有 in_progress / blocked Task。');
      lines.push('');
    } else {
      for (const task of data.active_tasks) {
        const statusEmoji = task.status === 'blocked' ? '⚠️' : '🔄';
        lines.push(`${statusEmoji} **${task.id}** - ${task.title}`);
        lines.push(`   Scene/Spec: ${task.scene}/${task.spec}`);
        lines.push(`   状态: ${task.status}`);
        if (task.parent) {
          lines.push(`   父任务: ${task.parent}`);
        }
        lines.push(`   创建: ${task.created}`);
        if (task.updated) {
          lines.push(`   更新: ${task.updated}`);
        }

        // 子任务（递归）
        if (task.children && task.children.length > 0) {
          lines.push('   子任务:');
          for (const child of task.children) {
            lines.push(`     - ${child.id} (${child.status}): ${child.title}`);
          }
        }
        lines.push('');
      }
    }

    // Specs（含 task_counts 和 claimable_next）
    lines.push('## Specs');
    lines.push('');
    if (data.specs.length === 0) {
      lines.push('（无 Spec）');
      lines.push('');
    } else {
      for (const spec of data.specs) {
        const priorityLabel = spec.priority ? ` [${spec.priority}]` : '';
        lines.push(`### ${spec.scene}/${spec.spec} - ${spec.name}${priorityLabel}`);
        lines.push(`    状态: ${spec.status} | 版本: ${spec.number}-${spec.version}`);
        if (spec.created) {
          lines.push(`    创建: ${spec.created}`);
        }

        // Task counts（决策字段）
        lines.push(`    Task 统计: pending=${spec.task_counts.pending}, in_progress=${spec.task_counts.in_progress}, blocked=${spec.task_counts.blocked}, completed=${spec.task_counts.completed}, failed=${spec.task_counts.failed}`);
        lines.push(`    活跃任务数: ${spec.active_task_count}`);
        lines.push(`    可领任务数: ${spec.free_tasks_count}`);

        // Claimable next（预览）
        if (spec.claimable_next.length > 0) {
          lines.push('    下一批可领:');
          for (const task of spec.claimable_next) {
            const depsLabel = task.depends_on && task.depends_on.length > 0
              ? ` (依赖: ${task.depends_on.join(', ')})`
              : '';
            lines.push(`      - ${task.id}: ${task.title}${depsLabel}`);
          }
        }
        lines.push('');
      }
    }

    // Active Agents
    lines.push('## Active Agents');
    lines.push('');
    if (data.active_agents.length === 0) {
      lines.push('（无活跃 Agent）');
      lines.push('');
    } else {
      for (const agent of data.active_agents) {
        lines.push(`- **${agent.agent_id}** (${agent.status})`);
        if (agent.client) {
          lines.push(`  客户端: ${agent.client}`);
        }
        lines.push(`  最近心跳: ${agent.last_heartbeat}`);
        if (agent.current_task_hint) {
          lines.push(`  当前任务: ${agent.current_task_hint}`);
        }

        // Active claims
        if (agent.active_claims.length > 0) {
          lines.push('  已认领:');
          for (const claim of agent.active_claims) {
            const filesLabel = claim.touches_files && claim.touches_files.length > 0
              ? ` (涉及: ${claim.touches_files.join(', ')})`
              : '';
            lines.push(`    - ${claim.scene}/${claim.spec}/${claim.task}${filesLabel}`);
          }
        }
        lines.push('');
      }
    }

    // Recent ADRs
    lines.push('## Recent ADRs');
    lines.push('');
    if (data.recent_adrs.length === 0) {
      lines.push('（无最近 ADR）');
      lines.push('');
    } else {
      for (const adr of data.recent_adrs) {
        const statusLabel = adr.status ? ` (${adr.status})` : '';
        const createdLabel = adr.created ? ` - ${adr.created}` : '';
        lines.push(`- [${adr.scope}] ${adr.number}: ${adr.title}${statusLabel}${createdLabel}`);
      }
      lines.push('');
    }

    // Open Errors
    lines.push('## Open Errors');
    lines.push('');
    if (data.open_errors.length === 0) {
      lines.push('（无打开的错误）');
      lines.push('');
    } else {
      for (const error of data.open_errors) {
        const statusLabel = error.status ? ` (${error.status})` : '';
        const seenLabel = error.last_seen ? ` - 最近: ${error.last_seen}` : '';
        lines.push(`- [${error.scope}] ${error.id}${statusLabel}${seenLabel}`);
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
