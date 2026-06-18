/**
 * GovernanceReport —— 治理体检（03-00 governance-report）。
 *
 * 零模型地从 .lrnev 文件确定性算出链路完整度（收口缺口 + failed/blocked）与 validates
 * 覆盖率（孤儿/坏 validates/archived 口径），并为每条欠债给可执行下一步。仿
 * GovernanceMap/ProjectStatus：自己扫 .lrnev，复用 TaskManager 纯函数，不新建扫描器；
 * 纯只读、无写副作用、不调 LLM。
 *
 * 口径对齐：unclosed 判定只镜像 GateRunner 的 all_tasks_completed（全平铺 every-completed）；
 * completion gate 的 FILL/design 子检查不在此复刻，report 不承诺 gate 必过、只引导去跑 gate。
 *
 * 本文件 T-001 范围：遍历 + 锚点 + 覆盖率 + 计数 + unclosed + failed/blocked + headline + scene。
 * paths（T-002）、broken_validates（T-003）、next_action（T-004）、release_notes（T-007）后续补。
 */

import { FileStorage } from '../storage/FileStorage.js';
import { parseFrontmatter } from '../storage/FrontmatterCodec.js';
import { DEFAULT_SCENE_ID, SceneManager } from './SceneManager.js';
import { tryParseSpecParts } from './SpecManager.js';
import { attachTaskChildren, extractAnchorPool, parseTasksFromMarkdown } from './TaskManager.js';
import type { AiFollowupResponse } from '../types/response.js';
import type { SpecFrontmatter, SpecStatus } from '../types/spec.js';
import type { Task } from '../types/task.js';
import type {
  GovernanceReportChain,
  GovernanceReportCoverage,
  GovernanceReportInput,
  GovernanceReportResult,
  BrokenValidatesItem,
  OrphanGroup,
  ReportPaths,
  ReportSceneStat,
  ReportTaskBrief,
  UnclosedSpec,
} from '../types/governance-report.js';

export class GovernanceReport {
  constructor(
    private readonly fs: FileStorage,
    private readonly scenes: SceneManager,
  ) {}

  async build(input: GovernanceReportInput = {}): Promise<AiFollowupResponse<GovernanceReportResult>> {
    const targetScene = input.scene ? await this.scenes.resolveId(input.scene) : undefined;
    const sceneList = (await this.scenes.list())
      .filter((scene) => !(scene.id === DEFAULT_SCENE_ID && scene.spec_count === 0 && !scene.broken))
      .filter((scene) => !targetScene || scene.id === targetScene);

    const sceneStats: ReportSceneStat[] = [];
    const unclosed: UnclosedSpec[] = [];
    const failedTasks: ReportTaskBrief[] = [];
    const blockedTasks: ReportTaskBrief[] = [];
    const inFlightOrphans: OrphanGroup[] = [];
    const debtOrphans: OrphanGroup[] = [];
    const brokenValidates: BrokenValidatesItem[] = [];
    let anchorTotal = 0;
    let anchorCovered = 0;
    let archivedExcluded = 0;
    let specCount = 0;
    let taskCount = 0;

    for (const scene of sceneList) {
      const files = await this.fs.list(`.lrnev/scenes/${scene.id}/specs/*/requirements.md`);
      files.sort();
      let sceneSpecCount = 0;
      let sceneTaskCount = 0;

      for (const file of files) {
        const match = /^\.lrnev\/scenes\/[^/]+\/specs\/([^/]+)\/requirements\.md$/.exec(file);
        if (!match) continue;
        const specId = match[1]!;
        const parts = tryParseSpecParts(specId);
        if (!parts) continue;

        sceneSpecCount += 1;
        specCount += 1;

        const reqContent = await this.fs.read(file);
        const { frontmatter } = parseFrontmatter<Partial<SpecFrontmatter>>(reqContent);
        const status: SpecStatus = frontmatter.status ?? 'draft';

        const designPath = `.lrnev/scenes/${scene.id}/specs/${specId}/design.md`;
        const designContent = this.fs.exists(designPath) ? await this.fs.read(designPath) : '';
        const tasksPath = `.lrnev/scenes/${scene.id}/specs/${specId}/tasks.md`;
        const tasks = this.fs.exists(tasksPath)
          ? attachTaskChildren(parseTasksFromMarkdown(await this.fs.read(tasksPath), scene.id, specId))
          : [];
        sceneTaskCount += tasks.length;
        taskCount += tasks.length;

        // archived spec：收尾方案，不计入任何欠债统计（仅计数被排除数）。
        if (status === 'archived') {
          archivedExcluded += 1;
          continue;
        }

        const paths = this.buildPaths(scene.id, specId);

        // failed / blocked 明细（带定位 + 可执行下一步）。
        for (const task of tasks) {
          if (task.status === 'failed') failedTasks.push(toBrief(task, paths, failedNextAction(task.id)));
          else if (task.status === 'blocked') blockedTasks.push(toBrief(task, paths, blockedNextAction(task.id)));
        }

        // validates 覆盖率：FILL-aware 锚点池 vs task validates 并集。
        const anchors = [
          ...collectAnchorIds(reqContent, 'F'),
          ...collectAnchorIds(designContent, 'D'),
        ];
        const validated = new Set<string>();
        for (const task of tasks) {
          for (const ref of task.validates ?? []) validated.add(ref);
        }
        const orphans = anchors.filter((anchor) => !validated.has(anchor));
        anchorTotal += anchors.length;
        anchorCovered += anchors.length - orphans.length;
        if (orphans.length > 0) {
          if (status === 'completed') {
            debtOrphans.push({ scene: scene.id, spec: specId, status, anchors: orphans, next_action: orphanDebtNextAction(orphans) });
          } else {
            inFlightOrphans.push({ scene: scene.id, spec: specId, status, anchors: orphans });
          }
        }

        // 坏 validates：task 的 validates 指向不存在锚点/废弃格式（口径同 TaskManager 存在性校验，
        // 用 extractAnchorPool 不滤 FILL）。这类引用本就不在真锚点池、不会虚增 covered；此处只做诊断列出。
        const fPool = extractAnchorPool(reqContent, 'F');
        const dPool = extractAnchorPool(designContent, 'D');
        for (const task of tasks) {
          const refs = task.validates ?? [];
          if (refs.length === 0) continue;
          const bad = refs.filter((ref) => {
            if (/^F-\d+$/.test(ref)) return !fPool.has(ref);
            if (/^D-\d+$/.test(ref)) return !dPool.has(ref);
            return true; // 废弃格式（如 design#3.2）或非法写法
          });
          if (bad.length > 0) {
            brokenValidates.push({ scene: scene.id, spec: specId, task: task.id, anchors: bad });
          }
        }

        // 做完没收口：只镜像 completion gate 的 all_tasks_completed（全平铺 every-completed）。
        if (status !== 'completed' && tasks.length > 0 && tasks.every((task) => task.status === 'completed')) {
          unclosed.push({
            scene: scene.id,
            spec: specId,
            name: parts.name,
            done: tasks.length,
            total: tasks.length,
            status,
            paths,
            next_action: unclosedNextAction(scene.id, specId),
          });
        }
      }

      sceneStats.push({
        scene: scene.id,
        name: scene.name,
        spec_count: sceneSpecCount,
        task_count: sceneTaskCount,
        empty: sceneSpecCount === 0,
      });
    }

    const chain: GovernanceReportChain = {
      scene_count: sceneStats.length,
      spec_count: specCount,
      task_count: taskCount,
      scenes: sceneStats,
      unclosed,
      failed_tasks: failedTasks,
      blocked_tasks: blockedTasks,
    };
    const coverage: GovernanceReportCoverage = {
      anchor_total: anchorTotal,
      anchor_covered: anchorCovered,
      coverage_ratio: anchorTotal > 0 ? anchorCovered / anchorTotal : 1,
      in_flight_orphans: inFlightOrphans,
      debt_orphans: debtOrphans,
      broken_validates: brokenValidates,
      archived_excluded: archivedExcluded,
    };
    const warnings: string[] = [];
    if (brokenValidates.length > 0) {
      const count = brokenValidates.reduce((sum, item) => sum + item.anchors.length, 0);
      warnings.push(`发现 ${count} 处坏 validates（指向不存在/废弃锚点），不计入覆盖率；详细修复请运行 lrnev doctor。`);
    }

    return {
      ok: true,
      data: {
        generated_at: new Date().toISOString(),
        scope: targetScene ?? 'all',
        headline: buildHeadline(unclosed.length, failedTasks.length, blockedTasks.length, debtOrphans.length),
        chain,
        coverage,
        ...(warnings.length > 0 && { warnings }),
      },
      ai_followup: {
        instructions: [
          '这是治理体检快照（链路完整度 + validates 覆盖率）。先看 headline，再按 unclosed / failed / 孤儿锚点逐条处理。',
          'report 只呈现欠债与下一步、不自动改任何文件；要收口请按提示去跑对应 gate/工具（report 标 unclosed 不代表 completion gate 必过，gate 还会查 FILL/design）。',
        ],
      },
    };
  }

  /** 一个 spec 的定位：context:// URI + requirements/tasks 绝对路径，供人和 AI 跳转。 */
  private buildPaths(sceneId: string, specId: string): ReportPaths {
    const dir = `.lrnev/scenes/${sceneId}/specs/${specId}`;
    return {
      uri: `context://spec/${sceneId}/${specId}`,
      requirements_path: this.fs.abs(`${dir}/requirements.md`),
      tasks_path: this.fs.abs(`${dir}/tasks.md`),
    };
  }
}

/** failed/blocked 任务投影（带所属 spec 定位与可执行下一步）。 */
function toBrief(task: Task, paths: ReportPaths, nextAction?: string): ReportTaskBrief {
  return {
    scene: task.scene,
    spec: task.spec,
    id: task.id,
    title: task.title,
    status: task.status,
    paths,
    ...(nextAction && { next_action: nextAction }),
  };
}

/** F-05 可执行下一步：确定性文案映射，不自动执行。 */
function unclosedNextAction(scene: string, spec: string): string {
  return `跑 spec_gate_check(scene=${scene}, spec=${spec}, gate=completion)；通过后 spec_update 把 status 改成 completed 收口（gate 还会查 FILL/design，未过按提示补）。`;
}

function failedNextAction(taskId: string): string {
  return `用 error_record 记录失败根因，修复后 task_update(${taskId}, status=pending) 重试。`;
}

function blockedNextAction(taskId: string): string {
  return `解除阻塞后 task_update(${taskId}) 切回 pending 或 in_progress。`;
}

function orphanDebtNextAction(anchors: string[]): string {
  return `给锚点 ${anchors.join('、')} 补一个 task 的 validates，或确认该需求/设计是否仍需要。`;
}

/**
 * FILL-aware 锚点 ID 提取：取 `#### F-xx` / `#### D-xx` 行的 ID，排除 `<!-- FILL:` 占位标题。
 * 与 TaskManager.extractAnchorPool 同正则家族，差异只在多一条 FILL 过滤（不改 extractAnchorPool，
 * 它服务 task 校验、语义不应受占位影响）。同名锚点去重。
 */
export function collectAnchorIds(content: string, prefix: 'F' | 'D'): string[] {
  const regex = new RegExp(`^####\\s+(${prefix}-\\d+)\\b`);
  const ids = new Set<string>();
  for (const line of content.split(/\r?\n/)) {
    if (line.includes('<!-- FILL:')) continue;
    const match = regex.exec(line);
    if (match) ids.add(match[1]!);
  }
  return [...ids];
}

/** 确定性 headline：有硬欠债（unclosed / failed）报欠债概述，否则报健康。 */
export function buildHeadline(unclosed: number, failed: number, blocked: number, debtOrphans: number): string {
  if (unclosed === 0 && failed === 0) {
    return '整体健康：无做完未收口的 spec，无失败任务。';
  }
  const parts: string[] = [];
  if (unclosed > 0) parts.push(`${unclosed} 个 spec 做完未收口`);
  if (failed > 0) parts.push(`${failed} 个任务失败`);
  if (blocked > 0) parts.push(`${blocked} 个任务阻塞`);
  if (debtOrphans > 0) parts.push(`${debtOrphans} 处已收口 spec 仍有孤儿锚点`);
  return `发现治理欠债：${parts.join('、')}。`;
}
