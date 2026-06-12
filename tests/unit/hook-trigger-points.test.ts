import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { dir as tmpDir, type DirectoryResult } from 'tmp-promise';

import { ADRManager } from '../../src/core/ADRManager.js';
import { ErrorbookManager } from '../../src/core/ErrorbookManager.js';
import { GateRunner } from '../../src/core/GateRunner.js';
import { HOOK_LOG_REL } from '../../src/core/HookManager.js';
import { SceneManager } from '../../src/core/SceneManager.js';
import { SpecManager } from '../../src/core/SpecManager.js';
import { TaskManager } from '../../src/core/TaskManager.js';
import { FileStorage } from '../../src/storage/FileStorage.js';
import { ensureWorkspace } from '../../src/storage/WorkspaceLocator.js';

describe('Hook 事件触发点', () => {
  let workspace: DirectoryResult;
  let fs: FileStorage;
  let scenes: SceneManager;
  let specs: SpecManager;
  let tasks: TaskManager;
  let gates: GateRunner;
  let adrs: ADRManager;
  let errors: ErrorbookManager;

  beforeEach(async () => {
    workspace = await tmpDir({ unsafeCleanup: true });
    await ensureWorkspace(workspace.path);
    fs = new FileStorage(workspace.path);
    scenes = new SceneManager(fs);
    specs = new SpecManager(fs, scenes);
    tasks = new TaskManager(fs, scenes, specs);
    gates = new GateRunner(fs, scenes, specs, tasks);
    adrs = new ADRManager(fs, scenes);
    errors = new ErrorbookManager(fs, scenes);
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  it('task.update.completed 应触发精确 hook 并写入 hook log', async () => {
    await seedSpec();
    await fs.writeJson('.lrnev/config/hooks.json', [{
      name: 'task-completed-hook',
      event: 'task.update.completed',
      command: [process.execPath, '-e', 'process.exit(0)'],
      mode: 'sync',
    }]);

    const task = await tasks.create({ scene: 'user-management', spec: 'user-login', title: '实现登录' });
    await tasks.update({
      scene: 'user-management',
      spec: 'user-login',
      task_id: task.data.id,
      status: 'in_progress',
    });
    await tasks.update({
      scene: 'user-management',
      spec: 'user-login',
      task_id: task.data.id,
      status: 'completed',
    });

    const records = await readHookLog();
    expect(records).toEqual(expect.arrayContaining([
      expect.objectContaining({
        event: 'task.update.completed',
        hook: 'task-completed-hook',
        status: 'success',
      }),
    ]));
  });

  it('task.update.* 应匹配所有任务状态变更', async () => {
    await seedSpec();
    await fs.writeJson('.lrnev/config/hooks.json', [{
      name: 'task-update-wildcard',
      event: 'task.update.*',
      command: [process.execPath, '-e', 'process.exit(0)'],
      mode: 'sync',
    }]);

    const task = await tasks.create({ scene: 'user-management', spec: 'user-login', title: '实现登录' });
    await tasks.update({
      scene: 'user-management',
      spec: 'user-login',
      task_id: task.data.id,
      status: 'in_progress',
    });

    const records = await readHookLog();
    expect(records).toEqual(expect.arrayContaining([
      expect.objectContaining({
        event: 'task.update.in_progress',
        hook: 'task-update-wildcard',
      }),
    ]));
  });

  it('hook warn 应追加到写入类响应的 ai_followup', async () => {
    await seedSpec();
    await fs.writeJson('.lrnev/config/hooks.json', [{
      name: 'task-create-warn',
      event: 'task.create',
      command: [process.execPath, '-e', 'process.exit(2)'],
      mode: 'sync',
      on_failure: 'warn',
    }]);

    const response = await tasks.create({
      scene: 'user-management',
      spec: 'user-login',
      title: '触发 warning',
    });

    expect(response.ok).toBe(true);
    expect(response.warnings?.join('\n')).toContain('task-create-warn');
    expect(response.ai_followup?.instructions.join('\n')).toContain('Hook 警告');
  });

  it('spec/adr/error/gate 成功路径应触发对应事件', async () => {
    await fs.writeJson('.lrnev/config/hooks.json', [
      { name: 'spec-create-hook', event: 'spec.create', command: [process.execPath, '-e', 'process.exit(0)'], mode: 'sync' },
      { name: 'adr-create-hook', event: 'adr.create', command: [process.execPath, '-e', 'process.exit(0)'], mode: 'sync' },
      { name: 'error-record-hook', event: 'error.record', command: [process.execPath, '-e', 'process.exit(0)'], mode: 'sync' },
      { name: 'ready-gate-hook', event: 'spec.gate_passed.ready', command: [process.execPath, '-e', 'process.exit(0)'], mode: 'sync' },
      { name: 'completion-gate-hook', event: 'spec.gate_passed.completion', command: [process.execPath, '-e', 'process.exit(0)'], mode: 'sync' },
    ]);

    const spec = await seedSpec();
    await adrs.create({
      title: '使用 hooks 扩展',
      scope: 'global',
      context: '需要扩展点',
      decision: '使用 hooks',
      consequences: '可以通过命令扩展',
    });
    await errors.record({
      symptom: 'hook 没触发',
      root_cause: '缺少埋点',
      fix_action: '补齐事件触发点',
      scope: 'global',
    });
    const task = await tasks.create({ scene: 'user-management', spec: 'user-login', title: '完成验收' });
    await tasks.update({ scene: 'user-management', spec: 'user-login', task_id: task.data.id, status: 'in_progress' });
    await tasks.update({ scene: 'user-management', spec: 'user-login', task_id: task.data.id, status: 'completed' });
    await gates.checkReady({ scene: 'user-management', spec: spec.data.spec });
    await gates.checkCompletion({ scene: 'user-management', spec: spec.data.spec });

    const events = (await readHookLog()).map((record) => record.event);
    expect(events).toEqual(expect.arrayContaining([
      'spec.create',
      'adr.create',
      'error.record',
      'spec.gate_passed.ready',
      'spec.gate_passed.completion',
    ]));
  });

  async function seedSpec() {
    await scenes.create({ name: 'user-management' });
    const spec = await specs.create({ scene: 'user-management', name: 'user-login' });
    await fs.write(
      `.lrnev/scenes/01-user-management/specs/${spec.data.spec}/requirements.md`,
      [
        '---',
        `spec: '${spec.data.spec}'`,
        "scene: '01-user-management'",
        "status: 'draft'",
        "created: '2026-06-01'",
        '---',
        '',
        '# User Login',
        '',
        '## L0 摘要',
        '用户登录。',
        '',
        '## L1 概览',
        '',
        '### 范围',
        '包含登录。',
        '',
        '## L2 详情',
        '',
        '### 详细需求',
        '实现登录。',
        '',
        '### 验收标准',
        '- [x] 登录成功',
        '',
      ].join('\n'),
    );
    // I-4 起 completion gate 也硬拦 design.md 的 FILL；补一份无 FILL 的 design。
    await fs.write(
      `.lrnev/scenes/01-user-management/specs/${spec.data.spec}/design.md`,
      [
        '---',
        `spec: '${spec.data.spec}'`,
        "scene: '01-user-management'",
        "created: '2026-06-01'",
        '---',
        '',
        '# User Login - 设计',
        '',
        '## L0 摘要',
        '登录设计，无占位。',
        '',
        '## L2 详情',
        '',
        '### 模块详细设计',
        '',
        '#### D-01 登录流程',
        '校验并签发 session。',
        '',
      ].join('\n'),
    );
    return spec;
  }

  async function readHookLog() {
    const content = await fs.read(HOOK_LOG_REL);
    return content
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { event: string; hook: string; status: string });
  }
});
