/**
 * GateRunner 单元测试。
 *
 * 覆盖 creation / ready / completion 三个核心 Gate 的成功与失败路径。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { dir as tmpDir, type DirectoryResult } from 'tmp-promise';

import {
  GateRunner,
  findFillSentinels,
  findMissingSections,
  findUncheckedItems,
} from '../../src/core/GateRunner.js';
import { findLegacyTodoPlaceholders } from '../../src/core/LegacyTodoMigration.js';
import { SceneManager } from '../../src/core/SceneManager.js';
import { SpecManager } from '../../src/core/SpecManager.js';
import { TaskManager } from '../../src/core/TaskManager.js';
import { FileStorage } from '../../src/storage/FileStorage.js';
import { ensureWorkspace } from '../../src/storage/WorkspaceLocator.js';

describe('GateRunner', () => {
  let workspace: DirectoryResult;
  let fs: FileStorage;
  let scenes: SceneManager;
  let specs: SpecManager;
  let tasks: TaskManager;
  let gates: GateRunner;
  let sceneId: string;
  let specId: string;

  beforeEach(async () => {
    workspace = await tmpDir({ unsafeCleanup: true });
    await ensureWorkspace(workspace.path);
    fs = new FileStorage(workspace.path);
    scenes = new SceneManager(fs);
    specs = new SpecManager(fs, scenes);
    tasks = new TaskManager(fs, scenes, specs);
    gates = new GateRunner(fs, scenes, specs, tasks);

    sceneId = (await scenes.create({ name: 'user-management' })).data.id;
    specId = (await specs.create({ scene: sceneId, name: 'user-login' })).data.spec;
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  it('creation gate 应在三文档骨架存在且 frontmatter 合法时通过', async () => {
    const result = await gates.checkCreation({ scene: sceneId, spec: specId });
    expect(result.passed).toBe(true);
    expect(result.checks.every((check) => check.passed)).toBe(true);
  });

  it('creation gate 应发现 requirements.md 缺失', async () => {
    await fs.rm(`.lrnev/scenes/${sceneId}/specs/${specId}/requirements.md`);
    const result = await gates.checkCreation({ scene: sceneId, spec: specId });
    expect(result.passed).toBe(false);
    expect(result.checks.find((check) => check.name === 'requirements_exists')?.passed).toBe(false);
  });

  it('creation gate 应发现 frontmatter scene 不匹配', async () => {
    const path = `.lrnev/scenes/${sceneId}/specs/${specId}/requirements.md`;
    const content = await fs.read(path);
    await fs.write(path, content.replace(`scene: '${sceneId}'`, "scene: '99-wrong'"));

    const result = await gates.checkCreation({ scene: sceneId, spec: specId });
    expect(result.passed).toBe(false);
    expect(result.checks.find((check) => check.name === 'frontmatter_scene')?.passed).toBe(false);
  });

  it('pure helpers should detect sentinels, missing headings, and unchecked items', () => {
    const content = [
      '## L0 Summary',
      '',
      '<!-- FILL: one line -->',
      '',
      '## L2 Details',
      '',
      '- [ ] unfinished item',
      '',
      'TODO in body is just text',
    ].join('\n');

    expect(findFillSentinels(content)).toEqual([
      { line: 3, text: '<!-- FILL: one line -->' },
    ]);
    expect(findMissingSections(content, ['L0 Summary', 'L1 Overview'])).toEqual(['L1 Overview']);
    expect(findUncheckedItems(content)).toEqual([
      { line: 7, text: '- [ ] unfinished item' },
    ]);
  });

  it('ready gate should reject explicit FILL sentinels', async () => {
    const result = await gates.checkReady({ scene: sceneId, spec: specId });
    expect(result.passed).toBe(false);
    expect(result.checks.find((check) => check.name === 'requirements_no_fill_sentinels')?.passed).toBe(false);
  });

  it('ready gate should read requirements.md only once', async () => {
    await writeReadyRequirements();
    const reqPath = `.lrnev/scenes/${sceneId}/specs/${specId}/requirements.md`;
    const readSpy = vi.spyOn(fs, 'read');

    await gates.checkReady({ scene: sceneId, spec: specId });

    const reads = readSpy.mock.calls.filter(([path]) => path === reqPath);
    expect(reads).toHaveLength(1);
  });

  it('ready gate should reject missing required sections', async () => {
    await writeReadyRequirements();
    const path = `.lrnev/scenes/${sceneId}/specs/${specId}/requirements.md`;
    const content = await fs.read(path);
    await fs.write(path, content.replace('## L1 概览', '## Missing Overview'));

    const result = await gates.checkReady({ scene: sceneId, spec: specId });
    expect(result.passed).toBe(false);
    expect(result.checks.find((check) => check.name === 'requirements_sections_present')?.passed).toBe(false);
  });

  it('F-09: ready gate should reject missing acceptance section', async () => {
    await writeReadyRequirements();
    const path = `.lrnev/scenes/${sceneId}/specs/${specId}/requirements.md`;
    const content = await fs.read(path);
    await fs.write(path, content.replace('### 验收标准', '### 其他验收'));

    const result = await gates.checkReady({ scene: sceneId, spec: specId });
    const check = result.checks.find((item) => item.name === 'requirements_sections_present');

    expect(result.passed).toBe(false);
    expect(check?.passed).toBe(false);
    expect(check?.message).toContain('验收标准');
  });

  it('F-03: ready gate should keep unchecked acceptance checklist as soft warning', async () => {
    await writeReadyRequirements({ uncheckedAcceptance: true });
    const result = await gates.checkReady({ scene: sceneId, spec: specId });
    const check = result.checks.find((item) => item.name === 'requirements_acceptance_checked');
    expect(result.passed).toBe(true);
    expect(check?.passed).toBe(false);
    expect(check?.hard_fail).toBe(false);
  });

  it('F-11: ready gate should not require EARS-formatted acceptance text', async () => {
    await writeReadyRequirements({ acceptanceText: '自然语言验收：登录失败时应提示用户重试。' });

    const result = await gates.checkReady({ scene: sceneId, spec: specId });

    expect(result.passed).toBe(true);
  });

  it('ready gate should ignore TODO text in normal body content', async () => {
    await writeReadyRequirements({ includeBodyTodo: true });
    const result = await gates.checkReady({ scene: sceneId, spec: specId });
    expect(result.passed).toBe(true);
  });

  it('ready gate should not depend on Scene architecture or roadmap content', async () => {
    await writeReadyRequirements();
    await fs.write(`.lrnev/scenes/${sceneId}/architecture.md`, '');
    await fs.write(`.lrnev/scenes/${sceneId}/roadmap.md`, '');

    const result = await gates.checkReady({ scene: sceneId, spec: specId });

    expect(result.passed).toBe(true);
  });

  it('ready gate should reject legacy TODO template placeholders with migration hint', async () => {
    await writeReadyRequirements();
    const path = `.lrnev/scenes/${sceneId}/specs/${specId}/requirements.md`;
    const content = await fs.read(path);
    await fs.write(path, content.replace('#### F-01 Ready detail', '#### F-01 TODO'));

    const result = await gates.checkReady({ scene: sceneId, spec: specId });

    const check = result.checks.find((item) => item.name === 'requirements_no_legacy_todo_placeholders');
    expect(result.passed).toBe(false);
    expect(check?.passed).toBe(false);
    expect(check?.hint).toContain('lrnev doctor --migrate-todos');
  });

  it('F-11: ready gate should ignore sentinels and checklist markers inside code spans', async () => {
    await writeReadyRequirements({ includeCodeMarkers: true });

    const result = await gates.checkReady({ scene: sceneId, spec: specId });

    expect(result.passed).toBe(true);
    expect(result.checks.find((check) => check.name === 'requirements_no_fill_sentinels')?.passed).toBe(true);
    expect(result.checks.find((check) => check.name === 'requirements_no_legacy_todo_placeholders')?.passed).toBe(true);
    expect(result.checks.find((check) => check.name === 'requirements_acceptance_checked')?.passed).toBe(true);
  });

  it('F-11: pure scanners should strip fenced code and inline code', () => {
    const content = [
      '正文没有占位。',
      '',
      '`<!-- FILL: inline -->`',
      '`- [ ] inline checklist`',
      '`- TODO`',
      '',
      '```md',
      '<!-- FILL: fenced -->',
      '- [ ] fenced checklist',
      '- TODO',
      '```',
      '',
      '<!-- FILL: real -->',
      '- [ ] real checklist',
      '- TODO',
    ].join('\n');

    expect(findFillSentinels(content)).toEqual([
      { line: 13, text: '<!-- FILL: real -->' },
    ]);
    expect(findUncheckedItems(content)).toEqual([
      { line: 14, text: '- [ ] real checklist' },
    ]);
    expect(findLegacyTodoPlaceholders(content)).toEqual([
      { line: 15, text: '- TODO' },
    ]);
  });

  it('completion gate 应要求至少有任务', async () => {
    const result = await gates.checkCompletion({ scene: sceneId, spec: specId });
    expect(result.passed).toBe(false);
    expect(result.checks.find((check) => check.name === 'tasks_exist')?.passed).toBe(false);
  });

  it('completion gate 应拦截未完成任务', async () => {
    await tasks.create({ scene: sceneId, spec: specId, title: '实现登录接口' });
    const result = await gates.checkCompletion({ scene: sceneId, spec: specId });
    expect(result.passed).toBe(false);
    expect(result.checks.find((check) => check.name === 'all_tasks_completed')?.passed).toBe(false);
  });

  it('completion gate 应在所有任务 completed 且 requirements/design 无 FILL 时通过', async () => {
    await writeReadyRequirements();
    await writeCleanDesign();
    const task = await tasks.create({ scene: sceneId, spec: specId, title: '实现登录接口' });
    await tasks.update({ scene: sceneId, spec: specId, task_id: task.data.id, status: 'in_progress' });
    await tasks.update({ scene: sceneId, spec: specId, task_id: task.data.id, status: 'completed' });

    const result = await gates.checkCompletion({ scene: sceneId, spec: specId });
    expect(result.passed).toBe(true);
  });

  it('completion gate 应拦截 requirements.md 残留 FILL（I-4）', async () => {
    await writeCleanDesign(); // design 干净，隔离出 requirements 的 FILL（骨架自带）
    const task = await tasks.create({ scene: sceneId, spec: specId, title: '实现登录接口' });
    await tasks.update({ scene: sceneId, spec: specId, task_id: task.data.id, status: 'in_progress' });
    await tasks.update({ scene: sceneId, spec: specId, task_id: task.data.id, status: 'completed' });

    const result = await gates.checkCompletion({ scene: sceneId, spec: specId });
    expect(result.passed).toBe(false);
    expect(result.checks.find((check) => check.name === 'requirements_no_fill')?.passed).toBe(false);
  });

  it('completion gate 应拦截 design.md 残留 FILL（I-4）', async () => {
    await writeReadyRequirements(); // requirements 干净，隔离出 design 的 FILL（骨架自带）
    const task = await tasks.create({ scene: sceneId, spec: specId, title: '实现登录接口' });
    await tasks.update({ scene: sceneId, spec: specId, task_id: task.data.id, status: 'in_progress' });
    await tasks.update({ scene: sceneId, spec: specId, task_id: task.data.id, status: 'completed' });

    const result = await gates.checkCompletion({ scene: sceneId, spec: specId });
    expect(result.passed).toBe(false);
    expect(result.checks.find((check) => check.name === 'design_no_fill')?.passed).toBe(false);
  });

  it('completion gate 应忽略 tasks.md 的模板 FILL（I-4：只查 requirements/design）', async () => {
    await writeReadyRequirements();
    await writeCleanDesign();
    // tasks.md 骨架自带模板 FILL（L14/L18），create 只追加任务、不替换占位；不应影响 completion。
    const task = await tasks.create({ scene: sceneId, spec: specId, title: '实现登录接口' });
    await tasks.update({ scene: sceneId, spec: specId, task_id: task.data.id, status: 'in_progress' });
    await tasks.update({ scene: sceneId, spec: specId, task_id: task.data.id, status: 'completed' });

    const result = await gates.checkCompletion({ scene: sceneId, spec: specId });
    expect(result.passed).toBe(true);
  });

  it('completion gate should report a readable failure when task listing throws', async () => {
    const throwingTasks = {
      list: async () => {
        throw new Error('boom');
      },
    } as unknown as TaskManager;
    const gateWithBrokenTasks = new GateRunner(fs, scenes, specs, throwingTasks);

    const result = await gateWithBrokenTasks.checkCompletion({ scene: sceneId, spec: specId });
    expect(result.passed).toBe(false);
    expect(result.checks.find((check) => check.name === 'tasks_readable')?.passed).toBe(false);
  });

  async function markSceneActive(): Promise<void> {
    const path = `.lrnev/scenes/${sceneId}/scene.md`;
    const content = await fs.read(path);
    await fs.write(path, content.replace('status: draft', 'status: active'));
  }

  async function writeReadyRequirements(
    opts: {
      acceptanceText?: string;
      includeBodyTodo?: boolean;
      uncheckedAcceptance?: boolean;
      includeCodeMarkers?: boolean;
    } = {},
  ): Promise<void> {
    const path = `.lrnev/scenes/${sceneId}/specs/${specId}/requirements.md`;
    const content = await fs.read(path);
    const checked = opts.uncheckedAcceptance ? ' ' : 'x';
    const acceptanceText = opts.acceptanceText ?? 'Ready acceptance.';
    const bodyTodo = opts.includeBodyTodo ? '\n\nTODO in normal body text is allowed.\n' : '\n';
    const codeMarkers = opts.includeCodeMarkers
      ? [
        '',
        'inline `<!-- FILL: example -->` and `- [ ] example` and `- TODO` are documentation.',
        '',
        '```md',
        '<!-- FILL: example -->',
        '- [ ] example',
        '- TODO',
        '```',
      ].join('\n')
      : '';
    await fs.write(path, [
      content.split('---').slice(0, 2).join('---'),
      '---',
      '',
      '# Ready Requirements',
      '',
      '## L0 摘要',
      '',
      'Ready summary.',
      '',
      '## L1 概览',
      '',
      '### 目标',
      '',
      'Ready goal.',
      '',
      '### 范围',
      '',
      'Ready scope.',
      '',
      '## L2 详情',
      '',
      '### 详细需求',
      '',
      '#### F-01 Ready detail',
      '',
      'Ready details.',
      '',
      '### 验收标准',
      '',
      `- [${checked}] ${acceptanceText}`,
      codeMarkers,
      bodyTodo,
    ].join('\n'));
  }

  async function writeCleanDesign(): Promise<void> {
    const path = `.lrnev/scenes/${sceneId}/specs/${specId}/design.md`;
    const content = await fs.read(path);
    await fs.write(path, [
      content.split('---').slice(0, 2).join('---'),
      '---',
      '',
      '# Clean Design',
      '',
      '## L0 摘要',
      '',
      'Clean design summary, no fill.',
      '',
      '## L2 详情',
      '',
      '### 模块详细设计',
      '',
      '#### D-01 模块设计',
      '',
      'Concrete design content.',
    ].join('\n'));
  }
});
