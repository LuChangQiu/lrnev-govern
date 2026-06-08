/**
 * CLI 单元/集成测试。
 *
 * 直接通过 commander parseAsync 调用命令，验证 CLI 是 core 的可用薄包装。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { dir as tmpDir, type DirectoryResult } from 'tmp-promise';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { buildCli } from '../../src/cli/index.js';
import { DEFAULT_SCENE_ID } from '../../src/core/SceneManager.js';
import { FileStorage } from '../../src/storage/FileStorage.js';

describe('CLI', () => {
  let workspace: DirectoryResult;

  beforeEach(async () => {
    workspace = await tmpDir({ unsafeCleanup: true });
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  it('help 应包含全局选项和主要子命令', () => {
    const program = buildCli();
    const help = program.helpInformation();
    expect(help).toContain('--workspace');
    expect(help).toContain('--json');
    for (const command of [
      'init',
      'scene',
      'spec',
      'task',
      'adr',
      'goal',
      'summary',
      'session',
      'hook',
      'agent',
      'error',
      'memory',
      'gate',
      'doctor',
      'search',
      'status',
    ]) {
      expect(help).toContain(command);
    }
  });

  it('F-04: init --help 应说明 --scan 是占位 flag', () => {
    const program = buildCli();
    const init = program.commands.find((command) => command.name() === 'init');

    expect(init?.helpInformation()).toContain('占位');
  });

  it('F-09: init 在非 JSON 模式下应为已有代码项目打印人类友好提示', async () => {
    await writeFile(join(workspace.path, 'package.json'), JSON.stringify({ name: 'demo' }), 'utf-8');

    let out = '';
    let err = '';
    const program = buildCli({
      writeOut: (text) => { out += text; },
      writeErr: (text) => { err += text; },
    });
    await program.parseAsync(['node', 'lrnev', '--workspace', workspace.path, 'init', '--project-name', 'demo']);

    expect(JSON.parse(out).ok).toBe(true);
    expect(err).toContain('检测到已有代码');
    expect(err).toContain('探测信号仅供参考');
    expect(err).toContain('补全 PROJECT 与 ARCHITECTURE');

    let jsonErr = '';
    const jsonProgram = buildCli({
      writeOut: () => undefined,
      writeErr: (text) => { jsonErr += text; },
    });
    await jsonProgram.parseAsync(['node', 'lrnev', '--workspace', workspace.path, '--json', 'init', '--project-name', 'demo']);

    expect(jsonErr).toBe('');
  });

  it('应通过 CLI 跑通主要命令包装', async () => {
    const init = await run(['init', '--project-name', 'demo']);
    expect(init.ok).toBe(true);

    const scene = await run(['scene', 'create', 'user-management']);
    expect(scene.data.id).toBe('01-user-management');

    const spec = await run(['spec', 'create', '--scene', 'user-management', 'user-login']);
    expect(spec.data.spec).toBe('01-00-user-login');

    const scenes = await run(['scene', 'list']);
    expect(scenes.map((item: { id: string }) => item.id)).toEqual([
      DEFAULT_SCENE_ID,
      '01-user-management',
    ]);

    const sceneGot = await run(['scene', 'get', 'user-management']);
    expect(sceneGot.id).toBe('01-user-management');

    const specs = await run(['spec', 'list', '--scene', 'user-management']);
    expect(specs).toHaveLength(1);

    const specGot = await run(['spec', 'get', '--scene', 'user-management', 'user-login']);
    expect(specGot.spec).toBe('01-00-user-login');

    const task = await run(['task', 'create', '--scene', 'user-management', '--spec', 'user-login', '实现登录']);
    expect(task.data.id).toBe('T-001');

    const dashTitleTask = await run([
      'task',
      'create',
      '--scene',
      'user-management',
      '--spec',
      'user-login',
      '--scan 改占位',
    ]);
    expect(dashTitleTask.data.title).toBe('--scan 改占位');

    const taskList = await run(['task', 'list', '--scene', 'user-management', '--spec', 'user-login']);
    expect(taskList.data[0].id).toBe('T-001');
    expect(taskList.ai_followup.instructions.join('\n')).toContain('parent 字段');

    const readableTaskList = await run(['task', 'list', '--scene', 'user-management', '--spec', 'user-login', '--readable']);
    expect(readableTaskList.data[0]).toEqual({
      id: 'T-001',
      title: '实现登录',
      status: 'pending',
      acceptance: [],
      validates: [],
    });
    expect(JSON.stringify(readableTaskList.data)).not.toContain('history');
    expect(JSON.stringify(readableTaskList.data)).not.toContain('lrnev-task');

    const taskUpdate = await run(['task', 'update', '--scene', 'user-management', '--spec', 'user-login', '--status', 'in_progress', 'T-001']);
    expect(taskUpdate.data.status).toBe('in_progress');

    const adr = await run([
      'adr',
      'create',
      '--title',
      'Use file storage',
      '--context',
      'M1 需要可读数据。',
      '--decision',
      '使用文件系统。',
    ]);
    expect(adr.data.number).toBe('0001');

    const adrList = await run(['adr', 'list']);
    expect(adrList[0].number).toBe('0001');

    const adrGot = await run(['adr', 'get', '1']);
    expect(adrGot.number).toBe('0001');

    const goal = await run(['goal', 'assess', '实现用户登录']);
    expect(goal.data.kind).toBeDefined();

    const summary = await run([
      'summary',
      'save',
      '--uri',
      'context://project',
      '--l0',
      'Demo project',
      '--l1',
      'Demo project overview',
    ]);
    expect(summary.data.saved.map((item: { level: string }) => item.level)).toEqual(['L0', 'L1']);

    const candidatesFile = join(workspace.path, 'candidates.json');
    await writeFile(candidatesFile, JSON.stringify([
      { category: 'facts', content: 'CLI session commit works.', source: 'cli-test' },
    ]), 'utf-8');
    const session = await run([
      'session',
      'commit',
      '--summary',
      '提交 CLI 候选记忆。',
      '--candidates-file',
      candidatesFile,
    ]);
    expect(session.data.saved).toHaveLength(1);

    const hooks = await run(['hook', 'list']);
    expect(hooks.data.implemented).toBe(true);
    expect(hooks.data.hooks).toEqual([]);

    await new FileStorage(workspace.path).writeJson('.lrnev/config/hooks.json', [
      {
        name: 'cli-hook',
        event: 'task.create',
        command: ['node', '-e', 'console.log(process.env.LRNEV_EVENT)'],
        mode: 'sync',
      },
    ]);
    const disabledHook = await run(['hook', 'disable', 'cli-hook']);
    expect(disabledHook.data.enabled).toBe(false);
    const enabledHook = await run(['hook', 'enable', 'cli-hook']);
    expect(enabledHook.data.enabled).toBe(true);
    const triggeredHook = await run(['hook', 'trigger', 'task.create', '--payload', '{"task_id":"T-999"}']);
    expect(triggeredHook.data.matched).toBe(1);
    const hookLog = await run(['hook', 'tail-log', '-n', '1']);
    expect(hookLog.data[0].hook).toBe('cli-hook');

    const agent = await run(['agent', 'register', '--id', 'cli-agent', '--client', 'codex']);
    expect(agent.data.agent_id).toBe('cli-agent');
    const claimed = await run([
      'task',
      'claim',
      '--scene',
      'user-management',
      '--spec',
      'user-login',
      '--agent-id',
      'cli-agent',
      'T-001',
      '--touches-files',
      'src/auth.ts',
    ]);
    expect(claimed.data.claimed).toBe(true);
    const releasedClaim = await run([
      'task',
      'release',
      '--scene',
      'user-management',
      '--spec',
      'user-login',
      '--agent-id',
      'cli-agent',
      'T-001',
    ]);
    expect(releasedClaim.data.released).toBe(true);
    const heartbeat = await run(['agent', 'heartbeat', '--id', 'cli-agent']);
    expect(heartbeat.data.agent_id).toBe('cli-agent');
    const agents = await run(['agent', 'list']);
    expect(agents.data.agents.map((item: { agent_id: string }) => item.agent_id)).toContain('cli-agent');
    const unregistered = await run(['agent', 'unregister', '--id', 'cli-agent']);
    expect(unregistered.data.agent_id).toBe('cli-agent');

    const error = await run([
      'error',
      'record',
      '--symptom',
      '登录失败',
      '--root-cause',
      'token 过期',
      '--fix-action',
      '刷新 token',
      '--verification',
      '测试通过',
    ]);
    expect(error.data.status).toBe('incident');

    const promoted = await run(['error', 'promote', error.data.id, '--verification', '测试通过']);
    expect(promoted.data.status).toBe('promoted');

    const errorSearch = await run(['error', 'search', 'token']);
    expect(errorSearch[0].id).toBe(error.data.id);

    const memory = await run([
      'memory',
      'save',
      '--category',
      'facts',
      '--content',
      '项目源码在 product/lrnev-govern。',
      '--source',
      'workspace',
    ]);
    expect(memory.data.category).toBe('facts');

    const memorySearch = await run(['memory', 'search', 'lrnev-govern', '--category', 'facts']);
    expect(memorySearch[0].id).toBe(memory.data.id);

    const gate = await run(['gate', 'check', '--scene', 'user-management', '--spec', 'user-login', '--gate', 'creation']);
    expect(gate.gate).toBe('creation');

    const search = await run(['search', '登录']);
    expect(search.ok).toBe(true);

    const doctor = await run(['doctor']);
    expect(doctor.summary.errors).toBe(0);

    const migrateTodos = await run(['doctor', '--migrate-todos']);
    expect(migrateTodos.ok).toBe(true);
    expect(migrateTodos.changed_files).toBeGreaterThan(0);

    const migrateTodosAgain = await run(['doctor', '--migrate-todos']);
    expect(migrateTodosAgain.changed_files).toBe(0);

    const fs = new FileStorage(workspace.path);
    await fs.write('.lrnev/.abstract.md', 'legacy summary\n');
    await fs.write('.lrnev/.PROJECT.abstract.md', 'new summary\n');
    const migrateSummaries = await run(['doctor', '--migrate-summaries']);
    expect(migrateSummaries.ok).toBe(true);
    expect(migrateSummaries.removed_count).toBe(1);
    expect(fs.exists('.lrnev/.abstract.md')).toBe(false);
    expect(fs.exists('.lrnev/.PROJECT.abstract.md')).toBe(true);

    const status = await run(['status']);
    expect(status.data.scenes).toHaveLength(1);
    expect(status.data.active_tasks[0]).toMatchObject({
      id: 'T-001',
      status: 'in_progress',
    });

    const scopedStatus = await run(['status', '--scene', 'user-management']);
    expect(scopedStatus.data.scenes.map((item: { id: string }) => item.id)).toEqual(['01-user-management']);
    expect(scopedStatus.data.specs.map((item: { spec: string }) => item.spec)).toEqual(['01-00-user-login']);

    const forgotten = await run(['memory', 'forget', memory.data.id, '--category', 'facts']);
    expect(forgotten.data.deleted).toBe(true);
  });

  it('spec create should default to 00-default when --scene is omitted', async () => {
    await run(['init', '--project-name', 'demo']);

    const spec = await run(['spec', 'create', 'quick-feature']);

    expect(spec.data.scene).toBe(DEFAULT_SCENE_ID);
    expect(spec.data.spec).toBe('01-00-quick-feature');
  });

  async function run(args: string[]): Promise<any> {
    let out = '';
    const program = buildCli({ writeOut: (text) => { out += text; } });
    await program.parseAsync(['node', 'lrnev', '--workspace', workspace.path, '--json', ...args]);
    const chunks = out.trim().split(/\n(?=\{|\[)/);
    return JSON.parse(chunks.at(-1)!);
  }
});
