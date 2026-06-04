import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { dir as tmpDir, type DirectoryResult } from 'tmp-promise';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { ProjectStatus } from '../../src/core/ProjectStatus.js';
import { AgentRegistry } from '../../src/core/AgentRegistry.js';
import { ClaimStore } from '../../src/core/ClaimStore.js';
import { DEFAULT_SCENE_ID, SceneManager } from '../../src/core/SceneManager.js';
import { SpecManager } from '../../src/core/SpecManager.js';
import { TaskManager } from '../../src/core/TaskManager.js';
import { FileStorage } from '../../src/storage/FileStorage.js';
import { ensureWorkspace } from '../../src/storage/WorkspaceLocator.js';

describe('ProjectStatus', () => {
  let workspace: DirectoryResult;
  let fs: FileStorage;
  let scenes: SceneManager;
  let specs: SpecManager;
  let tasks: TaskManager;
  let agents: AgentRegistry;
  let claims: ClaimStore;

  beforeEach(async () => {
    workspace = await tmpDir({ unsafeCleanup: true });
    await ensureWorkspace(workspace.path);
    fs = new FileStorage(workspace.path);
    scenes = new SceneManager(fs);
    specs = new SpecManager(fs, scenes);
    tasks = new TaskManager(fs, scenes, specs);
    agents = new AgentRegistry(fs);
    claims = new ClaimStore(fs);
  });

  afterEach(async () => {
    await workspace.cleanup();
    vi.restoreAllMocks();
  });

  it('returns a handoff snapshot with active tasks', async () => {
    const scene = await scenes.create({ name: 'user-management' });
    const spec = await specs.create({ scene: scene.data.id, name: 'user-login' });
    const task = await tasks.create({ scene: scene.data.id, spec: spec.data.spec, title: 'Implement login' });
    await tasks.update({ scene: scene.data.id, spec: spec.data.spec, task_id: task.data.id, status: 'in_progress' });

    const result = await new ProjectStatus(fs, scenes).get();

    expect(result.ok).toBe(true);
    expect(result.data.scenes).toHaveLength(1);
    expect(result.data.specs[0]).toMatchObject({
      scene: scene.data.id,
      spec: spec.data.spec,
      active_task_count: 1,
      task_counts: {
        pending: 0,
        in_progress: 1,
        blocked: 0,
        completed: 0,
        failed: 0,
      },
      free_tasks_count: 0,
      claimable_next: [],
    });
    expect(result.data.active_tasks).toEqual([
      expect.objectContaining({
        scene: scene.data.id,
        spec: spec.data.spec,
        id: task.data.id,
        title: 'Implement login',
        status: 'in_progress',
      }),
    ]);
    expect(result.ai_followup?.instructions.join('\n')).toContain('project_status');
  });

  it('F-02: specs should expose task_counts and claimable_next without returning completed details', async () => {
    await writeUserConfig(workspace.path, { project_status: { claimable_preview: 2 } });
    const scene = await scenes.create({ name: 'user-management' });
    const spec = await specs.create({ scene: scene.data.id, name: 'user-login' });
    await tasks.create({ scene: scene.data.id, spec: spec.data.spec, title: 'Pending A' });
    await tasks.create({ scene: scene.data.id, spec: spec.data.spec, title: 'Pending B' });
    await tasks.create({ scene: scene.data.id, spec: spec.data.spec, title: 'Pending C' });
    const inProgress = await tasks.create({ scene: scene.data.id, spec: spec.data.spec, title: 'Active task' });
    await tasks.update({
      scene: scene.data.id,
      spec: spec.data.spec,
      task_id: inProgress.data.id,
      status: 'in_progress',
    });
    const blocked = await tasks.create({ scene: scene.data.id, spec: spec.data.spec, title: 'Blocked task' });
    await tasks.update({ scene: scene.data.id, spec: spec.data.spec, task_id: blocked.data.id, status: 'blocked' });
    const completed = await tasks.create({ scene: scene.data.id, spec: spec.data.spec, title: 'Completed task' });
    await tasks.update({ scene: scene.data.id, spec: spec.data.spec, task_id: completed.data.id, status: 'in_progress' });
    await tasks.update({ scene: scene.data.id, spec: spec.data.spec, task_id: completed.data.id, status: 'completed' });
    const failed = await tasks.create({ scene: scene.data.id, spec: spec.data.spec, title: 'Failed task' });
    await tasks.update({ scene: scene.data.id, spec: spec.data.spec, task_id: failed.data.id, status: 'in_progress' });
    await tasks.update({ scene: scene.data.id, spec: spec.data.spec, task_id: failed.data.id, status: 'failed' });

    const result = await new ProjectStatus(fs, scenes).get();
    const specStatus = result.data.specs.find((item) => item.spec === spec.data.spec);

    expect(result.data.active_tasks.map((task) => task.title)).toEqual(['Active task', 'Blocked task']);
    expect(specStatus).toMatchObject({
      task_counts: {
        pending: 3,
        in_progress: 1,
        blocked: 1,
        completed: 1,
        failed: 1,
      },
      free_tasks_count: 3,
      claimable_next: [
        { id: 'T-001', title: 'Pending A' },
        { id: 'T-002', title: 'Pending B' },
      ],
    });
    expect(JSON.stringify(result.data)).not.toContain('Completed task');
    expect(JSON.stringify(result.data)).not.toContain('Failed task');
  });

  it('hides the empty default Scene from project_status noise', async () => {
    await scenes.ensureExists(DEFAULT_SCENE_ID);

    const result = await new ProjectStatus(fs, scenes).get();

    expect(result.data.scenes).toEqual([]);
  });

  it('shows parent-child task hierarchy in active tasks', async () => {
    const scene = await scenes.create({ name: 'user-management' });
    const spec = await specs.create({ scene: scene.data.id, name: 'user-login' });
    const parent = await tasks.create({ scene: scene.data.id, spec: spec.data.spec, title: 'Parent task' });
    await tasks.update({ scene: scene.data.id, spec: spec.data.spec, task_id: parent.data.id, status: 'in_progress' });
    const child = await tasks.create({
      scene: scene.data.id,
      spec: spec.data.spec,
      title: 'Child task',
      parent: parent.data.id,
    });
    await tasks.update({ scene: scene.data.id, spec: spec.data.spec, task_id: child.data.id, status: 'blocked' });

    const result = await new ProjectStatus(fs, scenes).get();
    const parentTask = result.data.active_tasks.find((task) => task.id === parent.data.id);
    const childTask = result.data.active_tasks.find((task) => task.id === child.data.id);

    expect(childTask).toMatchObject({ id: child.data.id, parent: parent.data.id });
    expect(parentTask?.children).toEqual([
      expect.objectContaining({ id: child.data.id, parent: parent.data.id, status: 'blocked' }),
    ]);
  });

  it('does not read requirements or design body text', async () => {
    const scene = await scenes.create({ name: 'user-management' });
    const spec = await specs.create({ scene: scene.data.id, name: 'user-login' });
    await tasks.create({ scene: scene.data.id, spec: spec.data.spec, title: 'Pending task' });

    const readSpy = vi.spyOn(fs, 'read');
    const frontmatterSpy = vi.spyOn(fs, 'readFrontmatterBlock');

    await new ProjectStatus(fs, scenes).get();

    const fullReads = readSpy.mock.calls.map(([path]) => path);
    expect(fullReads.filter((path) => path.endsWith('/requirements.md'))).toEqual([]);
    expect(fullReads.filter((path) => path.endsWith('/design.md'))).toEqual([]);
    expect(fullReads.filter((path) => path.endsWith('/tasks.md'))).toHaveLength(1);
    expect(frontmatterSpy.mock.calls.map(([path]) => path)).toContain(
      `.lrnev/scenes/${scene.data.id}/specs/${spec.data.spec}/requirements.md`,
    );
  });

  it('F-13: project_status.recent_limit 配置应限制 recent_adrs 和 open_errors 数量', async () => {
    await writeUserConfig(workspace.path, { project_status: { recent_limit: 1 } });
    await fs.write('.lrnev/decisions/adr/0001-a.md', ['---', "created: '2026-01-01'", '---', '# A'].join('\n'));
    await fs.write('.lrnev/decisions/adr/0002-b.md', ['---', "created: '2026-02-01'", '---', '# B'].join('\n'));
    await fs.write('.lrnev/errorbook/incidents/a.md', ['---', "last_seen: '2026-01-01'", '---', '# A'].join('\n'));
    await fs.write('.lrnev/errorbook/incidents/b.md', ['---', "last_seen: '2026-02-01'", '---', '# B'].join('\n'));

    const result = await new ProjectStatus(fs, scenes).get();

    expect(result.data.recent_adrs).toHaveLength(1);
    expect(result.data.recent_adrs[0]?.number).toBe('0002');
    expect(result.data.open_errors).toHaveLength(1);
    expect(result.data.open_errors[0]?.id).toBe('b');
  });

  it('F-08: project_status 应聚合活跃 Agent 及其 active_claims', async () => {
    const scene = await scenes.create({ name: 'user-management' });
    const login = await specs.create({ scene: scene.data.id, name: 'user-login' });
    const profile = await specs.create({ scene: scene.data.id, name: 'user-profile' });
    const loginTask = await tasks.create({ scene: scene.data.id, spec: login.data.spec, title: 'Implement login' });
    await tasks.update({
      scene: scene.data.id,
      spec: login.data.spec,
      task_id: loginTask.data.id,
      status: 'in_progress',
    });
    await agents.register({ agent_id: 'agent-a', client: 'claude' });
    await agents.register({ agent_id: 'agent-b', client: 'codex' });
    await claims.claim({ scene: scene.data.id, spec: login.data.spec, task: loginTask.data.id, agent_id: 'agent-a' });
    await claims.claim({ scene: scene.data.id, spec: profile.data.spec, task: 'T-001', agent_id: 'agent-b' });

    const result = await new ProjectStatus(fs, scenes).get();

    expect(result.data.active_agents).toEqual([
      expect.objectContaining({
        agent_id: 'agent-a',
        status: 'active',
        client: 'claude',
        active_claims: [expect.objectContaining({ scene: scene.data.id, spec: login.data.spec, task: loginTask.data.id })],
        current_task_hint: `${loginTask.data.id} Implement login`,
      }),
      expect.objectContaining({
        agent_id: 'agent-b',
        status: 'active',
        client: 'codex',
        active_claims: [expect.objectContaining({ scene: scene.data.id, spec: profile.data.spec, task: 'T-001' })],
      }),
    ]);
  });

  it('F-08: free_tasks_count and claimable_next should ignore active task claims', async () => {
    const scene = await scenes.create({ name: 'user-management' });
    const freeSpec = await specs.create({ scene: scene.data.id, name: 'free-work' });
    const lockedSpec = await specs.create({ scene: scene.data.id, name: 'locked-work' });
    for (const title of ['A', 'B', 'C']) {
      await tasks.create({ scene: scene.data.id, spec: freeSpec.data.spec, title });
    }
    for (const title of ['D', 'E']) {
      await tasks.create({ scene: scene.data.id, spec: lockedSpec.data.spec, title });
    }
    await agents.register({ agent_id: 'agent-a' });
    await claims.claim({ scene: scene.data.id, spec: lockedSpec.data.spec, task: 'T-001', agent_id: 'agent-a' });

    const result = await new ProjectStatus(fs, scenes).get();
    const free = result.data.specs.find((spec) => spec.spec === freeSpec.data.spec);
    const locked = result.data.specs.find((spec) => spec.spec === lockedSpec.data.spec);

    expect(free?.free_tasks_count).toBe(3);
    expect(locked?.free_tasks_count).toBe(1);
    expect(locked?.claimable_next).toEqual([{ id: 'T-002', title: 'E' }]);
  });

  it('F-14: 无 Agent 时 active_agents 为空且 project_status 不产生新文件', async () => {
    const scene = await scenes.create({ name: 'user-management' });
    const spec = await specs.create({ scene: scene.data.id, name: 'user-login' });
    await tasks.create({ scene: scene.data.id, spec: spec.data.spec, title: 'Pending task' });
    const beforeFiles = await fs.list('.lrnev/**/*', { dot: true });

    const result = await new ProjectStatus(fs, scenes).get();

    const afterFiles = await fs.list('.lrnev/**/*', { dot: true });
    expect(result.data.active_agents).toEqual([]);
    expect(result.data.specs[0]?.free_tasks_count).toBe(1);
    expect(afterFiles.sort()).toEqual(beforeFiles.sort());
  });

  it('F-04: large project status should stay bounded and avoid requirements/design body reads', async () => {
    await writeUserConfig(workspace.path, { project_status: { claimable_preview: 5 } });
    const scene = await scenes.create({ name: 'large-project' });
    for (let i = 1; i <= 30; i++) {
      const specId = `${String(i).padStart(2, '0')}-00-large-${String(i).padStart(2, '0')}`;
      await fs.write(
        `.lrnev/scenes/${scene.data.id}/specs/${specId}/requirements.md`,
        [
          '---',
          `spec: '${specId}'`,
          `scene: '${scene.data.id}'`,
          'status: draft',
          "created: '2026-06-03'",
          '---',
          `# ${specId} requirements`,
          '',
          'This body should not be read by project_status.',
        ].join('\n'),
      );
      await fs.write(`.lrnev/scenes/${scene.data.id}/specs/${specId}/design.md`, '# Design body should not be read\n');
      await fs.write(`.lrnev/scenes/${scene.data.id}/specs/${specId}/tasks.md`, makeScaleTasksMarkdown(i));
    }
    const readSpy = vi.spyOn(fs, 'read');
    const frontmatterSpy = vi.spyOn(fs, 'readFrontmatterBlock');

    const result = await new ProjectStatus(fs, scenes).get();

    expect(result.data.specs).toHaveLength(30);
    expect(result.data.active_tasks).toHaveLength(60);
    for (const item of result.data.specs) {
      expect(sumCounts(item.task_counts)).toBe(15);
      expect(item.claimable_next).toHaveLength(5);
      expect(item.free_tasks_count).toBe(10);
    }
    expect(JSON.stringify(result.data).length).toBeLessThan(80_000);
    const fullReads = readSpy.mock.calls.map(([path]) => path);
    expect(fullReads.filter((path) => path.endsWith('/requirements.md'))).toEqual([]);
    expect(fullReads.filter((path) => path.endsWith('/design.md'))).toEqual([]);
    expect(fullReads.filter((path) => path.endsWith('/tasks.md'))).toHaveLength(30);
    expect(frontmatterSpy.mock.calls).toHaveLength(30);
  });

  it('F-03: project_status should filter scenes, specs, active tasks, and active agents by scene', async () => {
    const sceneA = await scenes.create({ name: 'scene-a' });
    const sceneB = await scenes.create({ name: 'scene-b' });
    const specA = await specs.create({ scene: sceneA.data.id, name: 'feature-a' });
    const specB = await specs.create({ scene: sceneB.data.id, name: 'feature-b' });
    const taskA = await tasks.create({ scene: sceneA.data.id, spec: specA.data.spec, title: 'Active A' });
    const taskB = await tasks.create({ scene: sceneB.data.id, spec: specB.data.spec, title: 'Active B' });
    await tasks.update({ scene: sceneA.data.id, spec: specA.data.spec, task_id: taskA.data.id, status: 'in_progress' });
    await tasks.update({ scene: sceneB.data.id, spec: specB.data.spec, task_id: taskB.data.id, status: 'in_progress' });
    await agents.register({ agent_id: 'agent-a' });
    await agents.register({ agent_id: 'agent-b' });
    await claims.claim({ scene: sceneA.data.id, spec: specA.data.spec, task: taskA.data.id, agent_id: 'agent-a' });
    await claims.claim({ scene: sceneB.data.id, spec: specB.data.spec, task: taskB.data.id, agent_id: 'agent-b' });

    const result = await new ProjectStatus(fs, scenes).get({ scene: sceneA.data.id });

    expect(result.data.scenes.map((scene) => scene.id)).toEqual([sceneA.data.id]);
    expect(result.data.specs.map((spec) => spec.spec)).toEqual([specA.data.spec]);
    expect(result.data.active_tasks.map((task) => task.title)).toEqual(['Active A']);
    expect(result.data.active_agents).toEqual([
      expect.objectContaining({
        agent_id: 'agent-a',
        active_claims: [expect.objectContaining({ scene: sceneA.data.id, spec: specA.data.spec, task: taskA.data.id })],
      }),
    ]);
  });
});

async function writeUserConfig(root: string, data: unknown): Promise<void> {
  const dir = join(root, '.lrnev', 'config');
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'lrnev.json'), JSON.stringify(data, null, 2), 'utf-8');
}

function makeScaleTasksMarkdown(specIndex: number): string {
  const statuses = [
    ...Array.from({ length: 10 }, () => 'pending'),
    'in_progress',
    'blocked',
    'completed',
    'completed',
    'failed',
  ];
  return [
    '# Tasks',
    '',
    ...statuses.flatMap((status, index) => {
      const id = `T-${String(index + 1).padStart(3, '0')}`;
      return [
        `### ${id} Large ${specIndex}-${index + 1} <!-- lrnev-task: status=${status}, created=2026-06-03T00:00:00.000Z -->`,
        '',
      ];
    }),
  ].join('\n');
}

function sumCounts(counts: Record<string, number>): number {
  return Object.values(counts).reduce((sum, value) => sum + value, 0);
}
