/**
 * ProjectStatus 生成轻量接手快照。
 *
 * 为了避免大项目膨胀，这里只读 requirements.md frontmatter 和 tasks.md 状态；
 * 不加载 requirements/design 正文，也不读取用户源码。
 */

import { FileStorage } from '../storage/FileStorage.js';
import { parseFrontmatter } from '../storage/FrontmatterCodec.js';
import { loadConfig } from '../shared/config.js';
import { DEFAULT_SCENE_ID, SceneManager } from './SceneManager.js';
import { tryParseSpecParts } from './SpecManager.js';
import { attachTaskChildren, parseTasksFromMarkdown } from './TaskManager.js';
import { AgentRegistry } from './AgentRegistry.js';
import { ClaimStore } from './ClaimStore.js';
import type { AiFollowupResponse, Scope } from '../types/response.js';
import type { TaskClaim } from '../types/claim.js';
import type { SpecFrontmatter } from '../types/spec.js';
import type { Task, TaskStatus } from '../types/task.js';
import type {
  ProjectStatusActiveAgent,
  ProjectStatusActiveClaim,
  ProjectStatusAdr,
  ProjectStatusError,
  ProjectStatusInput,
  ProjectStatusScene,
  ProjectStatusSnapshot,
  ProjectStatusSpec,
  ProjectStatusTask,
  ProjectStatusTaskBrief,
  ProjectStatusTaskCounts,
} from '../types/project-status.js';

export class ProjectStatus {
  constructor(
    private readonly fs: FileStorage,
    private readonly scenes: SceneManager,
  ) {}

  async get(input: ProjectStatusInput = {}): Promise<AiFollowupResponse<ProjectStatusSnapshot>> {
    const sceneId = input.scene ? await this.scenes.resolveId(input.scene) : undefined;
    const scenes = await this.listScenes(sceneId);
    const activeClaims = filterClaimsByScene(await new ClaimStore(this.fs).listActive(), sceneId);
    const activeAgents = await this.buildActiveAgentView(activeClaims, sceneId);
    const activeClaimSet = taskKeysFromClaims(activeClaims);
    const { specs, activeTasks } = await this.listSpecsAndTasks(activeClaimSet, sceneId);
    attachCurrentTaskHints(activeAgents, activeTasks);
    const recentAdrs = await this.listRecentAdrs(sceneId);
    const openErrors = await this.listOpenErrors(sceneId);

    return {
      ok: true,
      data: {
        generated_at: new Date().toISOString(),
        scenes,
        specs,
        active_agents: activeAgents,
        active_tasks: activeTasks,
        recent_adrs: recentAdrs,
        open_errors: openErrors,
      },
      ai_followup: {
        instructions: [
          activeTasks.length > 0
            ? '从 active_tasks 里的 in_progress / blocked Task 接手；需要细节时再调用 spec_get。'
            : '当前没有 in_progress / blocked Task；如要继续规划，先查看 specs 中的 draft/ready 项。',
          '需要某个 Scene 的上下文时调用 scene_get；需要某个 Spec 的文档状态时调用 spec_get。',
          'project_status 只做接手概览，不废弃 scene_list/spec_list 这类按需深入工具。',
        ],
        suggested_tools: [
          {
            name: 'spec_get',
            args_template: { scene: '<scene-id>', spec: '<spec-id>' },
            reason: '需要某个 Spec 的详细文档状态时再深入读取',
          },
          {
            name: 'scene_get',
            args_template: { scene: '<scene-id>' },
            reason: '需要某个 Scene 的边界和统计信息时再深入读取',
          },
        ],
      },
    };
  }

  private async listScenes(sceneId?: string): Promise<ProjectStatusScene[]> {
    if (sceneId) {
      const scene = await this.scenes.get(sceneId);
      return [{
        id: scene.id,
        name: scene.name,
        status: scene.status,
        spec_count: scene.spec_count,
      }];
    }
    return (await this.scenes.list())
      .filter((scene) => !(scene.id === DEFAULT_SCENE_ID && scene.spec_count === 0 && !scene.broken))
      .map((scene) => ({
        id: scene.id,
        name: scene.name,
        status: scene.status,
        spec_count: scene.spec_count,
      }));
  }

  private async listSpecsAndTasks(): Promise<{
    specs: ProjectStatusSpec[];
    activeTasks: ProjectStatusTask[];
  }>;
  private async listSpecsAndTasks(activeClaimSet?: Set<string>, sceneId?: string): Promise<{
    specs: ProjectStatusSpec[];
    activeTasks: ProjectStatusTask[];
  }>;
  private async listSpecsAndTasks(activeClaimSet: Set<string> = new Set(), sceneId?: string): Promise<{
    specs: ProjectStatusSpec[];
    activeTasks: ProjectStatusTask[];
  }> {
    const pattern = sceneId
      ? `.lrnev/scenes/${sceneId}/specs/*/requirements.md`
      : '.lrnev/scenes/*/specs/*/requirements.md';
    const files = await this.fs.list(pattern);
    files.sort();
    const specs: ProjectStatusSpec[] = [];
    const activeTasks: ProjectStatusTask[] = [];

    for (const file of files) {
      const ids = /^\.lrnev\/scenes\/([^/]+)\/specs\/([^/]+)\/requirements\.md$/.exec(file);
      if (!ids) continue;
      const sceneId = ids[1]!;
      const specId = ids[2]!;
      const content = await this.fs.readFrontmatterBlock(file);
      const { frontmatter } = parseFrontmatter<Partial<SpecFrontmatter>>(content);
      const parts = tryParseSpecParts(specId);
      if (!parts) continue;
      const tasksPath = `.lrnev/scenes/${sceneId}/specs/${specId}/tasks.md`;
      const tasks = this.fs.exists(tasksPath)
        ? attachTaskChildren(parseTasksFromMarkdown(await this.fs.read(tasksPath), sceneId, specId))
        : [];
      const active = tasks.filter((task): task is typeof task & { status: 'in_progress' | 'blocked' } => (
        task.status === 'in_progress' || task.status === 'blocked'
      ));
      const taskCounts = countTasksByStatus(tasks);
      const pendingTasks = tasks
        .filter((task): task is Task & { status: 'pending' } => task.status === 'pending')
        .sort((a, b) => a.id.localeCompare(b.id));
      const claimableTasks = pendingTasks.filter((task) => !activeClaimSet.has(taskKey(sceneId, specId, task.id)));
      const freeTasksCount = claimableTasks.length;
      const claimableNext = claimableTasks.slice(0, this.claimablePreview()).map(toProjectStatusTaskBrief);

      specs.push({
        scene: sceneId,
        spec: specId,
        name: parts.name,
        number: parts.number,
        version: parts.version,
        status: frontmatter.status ?? 'draft',
        ...(frontmatter.priority && { priority: frontmatter.priority }),
        ...(frontmatter.created && { created: frontmatter.created }),
        active_task_count: active.length,
        task_counts: taskCounts,
        free_tasks_count: freeTasksCount,
        claimable_next: claimableNext,
      });

      activeTasks.push(...active.map((task) => toProjectStatusTask(task)));
    }

    return { specs, activeTasks };
  }

  private async buildActiveAgentView(
    activeClaims: TaskClaim[],
    sceneId?: string,
  ): Promise<ProjectStatusActiveAgent[]> {
    const { data: agents } = await new AgentRegistry(this.fs).list();
    const claimsByAgent = new Map<string, ProjectStatusActiveClaim[]>();
    for (const claim of activeClaims) {
      const claims = claimsByAgent.get(claim.claimed_by) ?? [];
      claims.push({
        scene: claim.scene,
        spec: claim.spec,
        task: claim.task,
        ...(claim.touches_files && claim.touches_files.length > 0 && { touches_files: claim.touches_files }),
      });
      claimsByAgent.set(claim.claimed_by, claims);
    }

    const views = agents.agents.map((agent) => ({
      agent_id: agent.agent_id,
      status: agent.status,
      active_claims: claimsByAgent.get(agent.agent_id) ?? [],
      ...(agent.client && { client: agent.client }),
      last_heartbeat: agent.last_heartbeat,
    }));
    return sceneId ? views.filter((agent) => agent.active_claims.length > 0) : views;
  }

  private async listRecentAdrs(sceneId?: string): Promise<ProjectStatusAdr[]> {
    const files = sceneId
      ? await this.fs.list(`.lrnev/scenes/${sceneId}/decisions/adr/[0-9][0-9][0-9][0-9]-*.md`)
      : [
          ...(await this.fs.list('.lrnev/decisions/adr/[0-9][0-9][0-9][0-9]-*.md')),
          ...(await this.fs.list('.lrnev/scenes/*/decisions/adr/[0-9][0-9][0-9][0-9]-*.md')),
        ];
    const adrs: ProjectStatusAdr[] = [];
    for (const file of files) {
      const content = await this.fs.read(file);
      const { frontmatter } = parseFrontmatter<Record<string, unknown>>(content);
      const number = String(frontmatter.number ?? /\/(\d{4})-/.exec(file)?.[1] ?? '0000');
      adrs.push({
        scope: inferScope(file, 'decisions/adr'),
        number,
        title: String(frontmatter.title ?? extractHeading(content) ?? number),
        ...(typeof frontmatter.status === 'string' && { status: frontmatter.status }),
        ...(typeof frontmatter.created === 'string' && { created: frontmatter.created }),
        path: this.fs.abs(file),
      });
    }
    return adrs.sort((a, b) => (b.created ?? '').localeCompare(a.created ?? '')).slice(0, this.recentLimit());
  }

  private async listOpenErrors(sceneId?: string): Promise<ProjectStatusError[]> {
    const files = sceneId
      ? await this.fs.list(`.lrnev/scenes/${sceneId}/errorbook/incidents/*.md`)
      : [
          ...(await this.fs.list('.lrnev/errorbook/incidents/*.md')),
          ...(await this.fs.list('.lrnev/scenes/*/errorbook/incidents/*.md')),
        ];
    const errors: ProjectStatusError[] = [];
    for (const file of files) {
      const content = await this.fs.read(file);
      const { frontmatter } = parseFrontmatter<Record<string, unknown>>(content);
      errors.push({
        scope: inferScope(file, 'errorbook/incidents'),
        id: String(frontmatter.id ?? file.replace(/^.*\/([^/]+)\.md$/, '$1')),
        ...(typeof frontmatter.status === 'string' && { status: frontmatter.status }),
        ...(typeof frontmatter.last_seen === 'string' && { last_seen: frontmatter.last_seen }),
        path: this.fs.abs(file),
      });
    }
    return errors.sort((a, b) => (b.last_seen ?? '').localeCompare(a.last_seen ?? '')).slice(0, this.recentLimit());
  }

  private recentLimit(): number {
    return loadConfig(this.fs.root).project_status.recent_limit;
  }

  private claimablePreview(): number {
    return loadConfig(this.fs.root).project_status.claimable_preview;
  }
}

function inferScope(file: string, marker: string): Scope {
  const sceneMatch = /^\.lrnev\/scenes\/([^/]+)\//.exec(file);
  if (sceneMatch) return `scene:${sceneMatch[1]!}`;
  if (file.includes(`.lrnev/${marker}`)) return 'global';
  return 'global';
}

function extractHeading(content: string): string | null {
  return /^#\s+(?:\d{4}\.\s*)?(.+)$/m.exec(content)?.[1]?.trim() ?? null;
}

function toProjectStatusTask(
  task: Task & { status: 'in_progress' | 'blocked' },
): ProjectStatusTask {
  const activeChildren = (task.children ?? []).filter(
    (child): child is Task & { status: 'in_progress' | 'blocked' } => (
      child.status === 'in_progress' || child.status === 'blocked'
    ),
  );
  return {
    scene: task.scene,
    spec: task.spec,
    id: task.id,
    title: task.title,
    status: task.status,
    ...(task.parent && { parent: task.parent }),
    ...(activeChildren.length > 0 && { children: activeChildren.map((child) => toProjectStatusTask(child)) }),
    created: task.created,
    ...(task.updated && { updated: task.updated }),
  };
}

function toProjectStatusTaskBrief(task: Task): ProjectStatusTaskBrief {
  return {
    id: task.id,
    title: task.title,
  };
}

function countTasksByStatus(tasks: Task[]): ProjectStatusTaskCounts {
  const counts: ProjectStatusTaskCounts = {
    pending: 0,
    in_progress: 0,
    blocked: 0,
    completed: 0,
    failed: 0,
  };
  for (const task of tasks) counts[task.status]++;
  return counts;
}

function attachCurrentTaskHints(
  activeAgents: ProjectStatusActiveAgent[],
  activeTasks: ProjectStatusTask[],
): void {
  const hintsBySpec = new Map<string, string>();
  for (const task of [...activeTasks].sort(compareProjectStatusTasksDesc)) {
    if (task.status !== 'in_progress') continue;
    if (!hintsBySpec.has(task.spec)) hintsBySpec.set(task.spec, `${task.id} ${task.title}`);
  }

  for (const agent of activeAgents) {
    const hint = agent.active_claims
      .map((claim) => hintsBySpec.get(claim.spec))
      .find((value): value is string => Boolean(value));
    if (hint) agent.current_task_hint = hint;
  }
}

function compareProjectStatusTasksDesc(a: ProjectStatusTask, b: ProjectStatusTask): number {
  return taskTime(b).localeCompare(taskTime(a));
}

function taskTime(task: ProjectStatusTask): string {
  return task.updated ?? task.created;
}

function taskKeysFromClaims(claims: TaskClaim[]): Set<string> {
  return new Set(claims.map((claim) => taskKey(claim.scene, claim.spec, claim.task)));
}

function taskKey(scene: string, spec: string, task: string): string {
  return `${scene}/${spec}/${task}`;
}

function filterClaimsByScene(claims: TaskClaim[], sceneId: string | undefined): TaskClaim[] {
  return sceneId ? claims.filter((claim) => claim.scene === sceneId) : claims;
}
