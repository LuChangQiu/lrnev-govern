import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { dir as tmpDir, type DirectoryResult } from 'tmp-promise';

import { FileStorage } from '../../src/storage/FileStorage.js';
import { ensureWorkspace } from '../../src/storage/WorkspaceLocator.js';
import { SceneManager } from '../../src/core/SceneManager.js';
import { SpecManager } from '../../src/core/SpecManager.js';
import { TaskManager } from '../../src/core/TaskManager.js';
import { HOOK_LOG_REL } from '../../src/core/HookManager.js';
import { isLrnevError } from '../../src/shared/errors.js';

describe('TaskManager.createMany（00-default / 01-00-task-create-many）', () => {
  let workspace: DirectoryResult;
  let fs: FileStorage;
  let scenes: SceneManager;
  let specs: SpecManager;
  let tasks: TaskManager;

  const SCENE = 'user-management';
  const SPEC = 'user-login';
  const TASKS_MD = '.lrnev/scenes/01-user-management/specs/01-00-user-login/tasks.md';

  beforeEach(async () => {
    workspace = await tmpDir({ unsafeCleanup: true });
    await ensureWorkspace(workspace.path);
    fs = new FileStorage(workspace.path);
    scenes = new SceneManager(fs);
    specs = new SpecManager(fs, scenes);
    tasks = new TaskManager(fs, scenes, specs);

    await scenes.create({ name: SCENE });
    await specs.create({ scene: SCENE, name: SPEC });
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  async function expectLrnevError(promise: Promise<unknown>, code: string): Promise<any> {
    try {
      await promise;
    } catch (err) {
      expect(isLrnevError(err)).toBe(true);
      if (isLrnevError(err)) expect(err.code).toBe(code);
      return err;
    }
    throw new Error(`预期抛出 ${code}，实际成功`);
  }

  it('F-01: 按数组顺序连续分配 ID（接在已有 max 之后）', async () => {
    await tasks.create({ scene: SCENE, spec: SPEC, title: '先有的' });

    const res = await tasks.createMany({
      scene: SCENE,
      spec: SPEC,
      tasks: [{ title: 'A' }, { title: 'B' }, { title: 'C' }],
    });

    expect(res.data.created.map((t) => t.id)).toEqual(['T-002', 'T-003', 'T-004']);
    expect(res.data.created.map((t) => t.title)).toEqual(['A', 'B', 'C']);
    expect(res.data.count).toBe(3);
  });

  it('F-01: 空数组报 INVALID_INPUT 且不落盘', async () => {
    const before = await fs.read(TASKS_MD);
    await expectLrnevError(
      tasks.createMany({ scene: SCENE, spec: SPEC, tasks: [] }),
      'INVALID_INPUT',
    );
    expect(await fs.read(TASKS_MD)).toBe(before);
  });

  it('F-01: 批量与逐条创建的落盘结构等价（同字段同顺序）', async () => {
    await tasks.createMany({
      scene: SCENE,
      spec: SPEC,
      tasks: [
        { key: 'm', title: '建模', validates: ['F-01'], acceptance: ['模型齐全'] },
        { title: '接口', depends_on: ['m'], description: '基于模型' },
      ],
    });
    const batchList = await tasks.list(SCENE, SPEC);

    await specs.create({ scene: SCENE, name: 'password-reset' });
    await tasks.create({ scene: SCENE, spec: 'password-reset', title: '建模', validates: ['F-01'], acceptance: ['模型齐全'] });
    await tasks.create({ scene: SCENE, spec: 'password-reset', title: '接口', depends_on: ['T-001'], description: '基于模型' });
    const singleList = await tasks.list(SCENE, 'password-reset');

    const strip = (list: typeof batchList) => list.map((t) => ({
      id: t.id, title: t.title, description: t.description, status: t.status,
      acceptance: t.acceptance, depends_on: t.depends_on, validates: t.validates, parent: t.parent,
    }));
    expect(strip(batchList)).toEqual(strip(singleList));
  });

  it('F-02: 批内 key 前向与后向引用都解析为真实 ID', async () => {
    const res = await tasks.createMany({
      scene: SCENE,
      spec: SPEC,
      tasks: [
        { key: 'schema', title: '建模', depends_on: ['api'] },
        { key: 'api', title: '接口', depends_on: ['schema'] },
      ],
    });

    expect(res.data.created.map((t) => t.id)).toEqual(['T-001', 'T-002']);
    const list = await tasks.list(SCENE, SPEC);
    expect(list.find((t) => t.id === 'T-001')?.depends_on).toEqual(['T-002']);
    expect(list.find((t) => t.id === 'T-002')?.depends_on).toEqual(['T-001']);
  });

  it('F-02: key 匹配 T-xxx 格式整批拒绝', async () => {
    const err = await expectLrnevError(
      tasks.createMany({ scene: SCENE, spec: SPEC, tasks: [{ key: 'T-009', title: 'A' }] }),
      'INVALID_INPUT',
    );
    expect(err.errors).toHaveLength(1);
    expect(err.errors[0]).toMatchObject({ index: 0, field: 'key' });
  });

  it('F-02: 批内重复 key 整批拒绝', async () => {
    const err = await expectLrnevError(
      tasks.createMany({
        scene: SCENE,
        spec: SPEC,
        tasks: [{ key: 'a', title: 'A' }, { key: 'a', title: 'B' }],
      }),
      'INVALID_INPUT',
    );
    expect(err.errors[0]).toMatchObject({ index: 1, field: 'key' });
  });

  it('F-02: depends_on 既非批内 key 也非已存在 Task 时报 TASK_NOT_FOUND', async () => {
    const err = await expectLrnevError(
      tasks.createMany({ scene: SCENE, spec: SPEC, tasks: [{ title: 'A', depends_on: ['nope'] }] }),
      'TASK_NOT_FOUND',
    );
    expect(err.errors[0]).toMatchObject({ index: 0, field: 'depends_on', code: 'TASK_NOT_FOUND' });
  });

  it('F-02: depends_on 自引用 key 拒绝；引用已存在真实 Task 正常', async () => {
    await tasks.create({ scene: SCENE, spec: SPEC, title: '已存在' });

    await expectLrnevError(
      tasks.createMany({ scene: SCENE, spec: SPEC, tasks: [{ key: 'self', title: 'A', depends_on: ['self'] }] }),
      'INVALID_INPUT',
    );

    const res = await tasks.createMany({
      scene: SCENE,
      spec: SPEC,
      tasks: [{ title: 'B', depends_on: ['T-001'] }],
    });
    expect(res.data.created[0]!.id).toBe('T-002');
    const list = await tasks.list(SCENE, SPEC);
    expect(list.find((t) => t.id === 'T-002')?.depends_on).toEqual(['T-001']);
  });

  it('F-02: parent 不支持批内 key（报 TASK_NOT_FOUND）；已存在真实父任务正常走子任务路径', async () => {
    const err = await expectLrnevError(
      tasks.createMany({
        scene: SCENE,
        spec: SPEC,
        tasks: [{ key: 'p', title: '父' }, { title: '子', parent: 'p' }],
      }),
      'TASK_NOT_FOUND',
    );
    expect(err.errors[0]).toMatchObject({ index: 1, field: 'parent' });

    await tasks.create({ scene: SCENE, spec: SPEC, title: '真父' });
    const res = await tasks.createMany({
      scene: SCENE,
      spec: SPEC,
      tasks: [{ title: '子任务', parent: 'T-001' }],
    });
    const list = await tasks.list(SCENE, SPEC);
    expect(list.find((t) => t.id === res.data.created[0]!.id)?.parent).toBe('T-001');
  });

  it('F-03: 多处错误一次性全部返回（index/field/message 准确），文件零变更、ID 无占用', async () => {
    const before = await fs.read(TASKS_MD);
    const err = await expectLrnevError(
      tasks.createMany({
        scene: SCENE,
        spec: SPEC,
        tasks: [
          { title: 'OK', validates: ['F-01'] },
          { title: '坏锚点', validates: ['F-99'] },
          { title: '' },
          { title: '坏依赖', depends_on: ['T-777'] },
        ],
      }),
      'ANCHOR_NOT_FOUND',
    );

    expect(err.errors).toHaveLength(3);
    expect(err.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ index: 1, field: 'validates', code: 'ANCHOR_NOT_FOUND' }),
      expect.objectContaining({ index: 2, field: 'title', code: 'INVALID_INPUT' }),
      expect.objectContaining({ index: 3, field: 'depends_on', code: 'TASK_NOT_FOUND' }),
    ]));
    expect(await fs.read(TASKS_MD)).toBe(before);

    const res = await tasks.createMany({ scene: SCENE, spec: SPEC, tasks: [{ title: '重来' }] });
    expect(res.data.created[0]!.id).toBe('T-001');
  });

  it('F-03: validates 校验口径与单条一致（废弃 design# 格式整批拒）', async () => {
    const err = await expectLrnevError(
      tasks.createMany({ scene: SCENE, spec: SPEC, tasks: [{ title: 'A', validates: ['design#3.2'] }] }),
      'INVALID_INPUT',
    );
    expect(err.errors[0]!.message).toContain('已废弃');
  });

  it('F-04: 压缩返回 + 单次 followup，含批量创建摘要与下一步指引', async () => {
    const res = await tasks.createMany({
      scene: SCENE,
      spec: SPEC,
      tasks: [
        { key: 'a', title: '第一' },
        { title: '第二', depends_on: ['a'] },
        { title: '第三' },
      ],
    });

    expect(res.data.created).toEqual([
      { id: 'T-001', title: '第一' },
      { id: 'T-002', title: '第二' },
      { id: 'T-003', title: '第三' },
    ]);
    expect(JSON.stringify(res.data)).not.toContain('history');
    const joined = (res.ai_followup?.instructions ?? []).join('\n');
    expect(joined).toContain('3 个任务已创建');
    expect(joined).toContain('T-001..T-003');
    expect(joined).toContain('T-001');
  });

  it('F-04: 目标 spec 为 completed 时维护态回退提示只出现一次', async () => {
    await specs.updateStatus(SCENE, SPEC, 'ready');
    await specs.updateStatus(SCENE, SPEC, 'in-progress');
    await specs.updateStatus(SCENE, SPEC, 'completed');

    const res = await tasks.createMany({
      scene: SCENE,
      spec: SPEC,
      tasks: [{ title: 'A' }, { title: 'B' }],
    });

    const hits = (res.ai_followup?.instructions ?? []).filter((line) => line.includes('completed→in-progress'));
    expect(hits).toHaveLength(1);
  });

  it('超过 task.max_batch_create 上限报 INVALID_INPUT（config 可调）', async () => {
    await fs.writeJson('.lrnev/config/lrnev.json', { task: { max_batch_create: 2 } });

    await expectLrnevError(
      tasks.createMany({
        scene: SCENE,
        spec: SPEC,
        tasks: [{ title: 'A' }, { title: 'B' }, { title: 'C' }],
      }),
      'INVALID_INPUT',
    );
  });

  it('hook task.create 逐任务触发 N 次（与逐条创建语义等价）', async () => {
    await fs.writeJson('.lrnev/config/hooks.json', [{
      name: 'create-many-hook',
      event: 'task.create',
      command: [process.execPath, '-e', 'process.exit(0)'],
      mode: 'sync',
    }]);

    await tasks.createMany({
      scene: SCENE,
      spec: SPEC,
      tasks: [{ title: 'A' }, { title: 'B' }, { title: 'C' }],
    });

    const log = await fs.read(HOOK_LOG_REL);
    const hits = log.split('\n').filter((line) => line.includes('create-many-hook'));
    expect(hits).toHaveLength(3);
  });
});
