/**
 * TaskManager 集成测试
 *
 * 覆盖：
 *   - create：T-XXX 序号、tasks.md 追加、ai_followup
 *   - update：状态机校验（合法 + 非法）
 *   - list / get
 *   - 持久化往返：create → 重新 list → 字段保留
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { dir as tmpDir, type DirectoryResult } from 'tmp-promise';
import { FileStorage } from '../../src/storage/FileStorage.js';
import { ensureWorkspace } from '../../src/storage/WorkspaceLocator.js';
import { SceneManager } from '../../src/core/SceneManager.js';
import { SpecManager } from '../../src/core/SpecManager.js';
import { ClaimStore } from '../../src/core/ClaimStore.js';
import {
  TaskManager,
  formatTaskId,
  computeNextTaskNumber,
  appendTaskToMarkdown,
  insertChildTaskToMarkdown,
  renderTaskBlock,
  parseTasksFromMarkdown,
  toReadableTask,
  extractAnchorPool,
  extractAnchorSections,
  clampText,
  designFirstLine,
} from '../../src/core/TaskManager.js';
import { isLrnevError } from '../../src/shared/errors.js';
import type { Task } from '../../src/types/task.js';

describe('TaskManager 纯函数', () => {
  it('formatTaskId', () => {
    expect(formatTaskId(1)).toBe('T-001');
    expect(formatTaskId(42)).toBe('T-042');
    expect(formatTaskId(999)).toBe('T-999');
  });

  it('computeNextTaskNumber', () => {
    expect(computeNextTaskNumber([])).toBe(1);
    expect(
      computeNextTaskNumber([{ id: 'T-001' } as Task, { id: 'T-003' } as Task]),
    ).toBe(4);
  });

  it('F-13: toReadableTask 只保留人读字段', () => {
    const readable = toReadableTask({
      id: 'T-001',
      scene: '01-s',
      spec: '01-00-x',
      title: '示例任务',
      description: '内部描述',
      status: 'in_progress',
      acceptance: ['验收 1'],
      depends_on: ['T-000'],
      parent: 'T-000',
      validates: ['F-01'],
      children: [],
      created: '2026-05-28T00:00:00Z',
      updated: '2026-05-28T01:00:00Z',
      history: [{ from: 'pending', to: 'in_progress', at: '2026-05-28T01:00:00Z' }],
    });

    expect(readable).toEqual({
      id: 'T-001',
      title: '示例任务',
      status: 'in_progress',
      acceptance: ['验收 1'],
      parent: 'T-000',
      validates: ['F-01'],
    });
    expect(JSON.stringify(readable)).not.toContain('history');
    expect(JSON.stringify(readable)).not.toContain('lrnev-task');
  });

  describe('renderTaskBlock', () => {
    it('应包含 ### + meta', () => {
      const task: Task = {
        id: 'T-001',
        scene: '01-s',
        spec: '01-00-x',
        title: '示例任务',
        status: 'pending',
        created: '2026-05-28T00:00:00Z',
      };
      const block = renderTaskBlock(task);
      expect(block).toContain('### T-001 示例任务');
      expect(block).toContain('status=pending');
      expect(block).toContain('created=2026-05-28T00:00:00Z');
    });

    it('应渲染描述、验收、依赖', () => {
      const block = renderTaskBlock({
        id: 'T-002',
        scene: '01',
        spec: 'x',
        title: 't',
        status: 'pending',
        created: 'now',
        description: '这是描述',
        acceptance: ['第一条', '第二条'],
        depends_on: ['T-001'],
      } as Task);
      expect(block).toContain('这是描述');
      expect(block).toContain('**验收**');
      expect(block).toContain('- 第一条');
      expect(block).toContain('- 第二条');
      expect(block).toContain('**依赖**：T-001');
    });

    it('应把 validates 写入 meta 注释', () => {
      const block = renderTaskBlock({
        id: 'T-003',
        scene: '01',
        spec: 'x',
        title: 't',
        status: 'pending',
        created: 'now',
        validates: ['F-01', 'D-01'],
      } as Task);

      expect(block).toContain('validates=F-01|D-01');
    });

    it('应把 parent 写入 meta 注释', () => {
      const block = renderTaskBlock({
        id: 'T-004',
        scene: '01',
        spec: 'x',
        title: 'child',
        status: 'pending',
        created: 'now',
        parent: 'T-001',
      } as Task);

      expect(block).toContain('parent=T-001');
    });
  });

  describe('appendTaskToMarkdown', () => {
    it('已有 ## 章节应追加到末尾', () => {
      const md = `---\nspec: x\n---\n\n# Title\n\n## 阶段 1\n\n### T-001 旧 <!-- lrnev-task: status=pending, created=t -->\n`;
      const out = appendTaskToMarkdown(md, {
        id: 'T-002',
        scene: 's',
        spec: 'x',
        title: '新任务',
        status: 'pending',
        created: 'now',
      } as Task);
      expect(out).toContain('### T-001 旧');
      expect(out).toContain('### T-002 新任务');
    });

    it('无 ## 章节应建一个 "## 任务" 章节', () => {
      const out = appendTaskToMarkdown('---\nspec: x\n---\n\nbody\n', {
        id: 'T-001',
        scene: 's',
        spec: 'x',
        title: 't',
        status: 'pending',
        created: 'now',
      } as Task);
      expect(out).toContain('## 任务');
      expect(out).toContain('### T-001');
    });

    it('子任务应插入父 Task 块末尾、下一个 Task 之前', () => {
      const md = [
        '## 阶段 1',
        '',
        '### T-001 父任务 <!-- lrnev-task: status=pending, created=t1 -->',
        '父任务描述',
        '',
        '### T-002 后续任务 <!-- lrnev-task: status=pending, created=t2 -->',
      ].join('\n');
      const out = insertChildTaskToMarkdown(md, 'T-001', {
        id: 'T-003',
        scene: 's',
        spec: 'x',
        title: '子任务',
        status: 'pending',
        parent: 'T-001',
        created: 'now',
      } as Task);

      expect(out.indexOf('### T-001 父任务')).toBeLessThan(out.indexOf('### T-003 子任务'));
      expect(out.indexOf('### T-003 子任务')).toBeLessThan(out.indexOf('### T-002 后续任务'));
      expect(out).toContain('parent=T-001');
    });

    it('F-05: 新子任务应追加到已有同 parent 子任务之后', () => {
      const md = [
        '## 阶段 1',
        '',
        '### T-001 父任务 <!-- lrnev-task: status=pending, created=t1 -->',
        '父任务描述',
        '',
        '### T-003 子任务 A <!-- lrnev-task: status=pending, created=t3, parent=T-001 -->',
        '',
        '### T-002 后续任务 <!-- lrnev-task: status=pending, created=t2 -->',
      ].join('\n');
      const out = insertChildTaskToMarkdown(md, 'T-001', {
        id: 'T-004',
        scene: 's',
        spec: 'x',
        title: '子任务 B',
        status: 'pending',
        parent: 'T-001',
        created: 'now',
      } as Task);

      expect(out.indexOf('### T-001 父任务')).toBeLessThan(out.indexOf('### T-003 子任务 A'));
      expect(out.indexOf('### T-003 子任务 A')).toBeLessThan(out.indexOf('### T-004 子任务 B'));
      expect(out.indexOf('### T-004 子任务 B')).toBeLessThan(out.indexOf('### T-002 后续任务'));
    });
  });

  describe('parseTasksFromMarkdown', () => {
    it('应解析多个 Task 块', () => {
      const md = [
        '## 阶段 1',
        '',
        '### T-001 标题 1 <!-- lrnev-task: status=pending, created=t1 -->',
        '描述 1',
        '',
        '**验收**：',
        '- a',
        '- b',
        '',
        '### T-002 标题 2 <!-- lrnev-task: status=completed, created=t2, updated=t3 -->',
        '描述 2',
        '',
        '**依赖**：T-001',
      ].join('\n');

      const tasks = parseTasksFromMarkdown(md, '01-s', '01-00-x');
      expect(tasks).toHaveLength(2);
      expect(tasks[0]?.id).toBe('T-001');
      expect(tasks[0]?.title).toBe('标题 1');
      expect(tasks[0]?.status).toBe('pending');
      expect(tasks[0]?.acceptance).toEqual(['a', 'b']);
      expect(tasks[1]?.status).toBe('completed');
      expect(tasks[1]?.depends_on).toEqual(['T-001']);
    });

    it('无 meta 注释的标题不应被识别为 Task（防御性）', () => {
      const md = '### T-099 老任务\n描述';
      const tasks = parseTasksFromMarkdown(md, 's', 'x');
      expect(tasks).toHaveLength(0);
    });

    it('应 round-trip 解析 validates meta', () => {
      const md = '### T-001 做登录 <!-- lrnev-task: status=pending, created=t1, validates=F-01|D-01 -->';
      const tasks = parseTasksFromMarkdown(md, '01-s', '01-00-x');
      expect(tasks[0]?.validates).toEqual(['F-01', 'D-01']);
    });

    it('应 round-trip 解析 parent meta', () => {
      const md = '### T-002 子任务 <!-- lrnev-task: status=pending, created=t1, parent=T-001 -->';
      const tasks = parseTasksFromMarkdown(md, '01-s', '01-00-x');
      expect(tasks[0]?.parent).toBe('T-001');
    });
  });

  describe('extractAnchorSections', () => {
    const doc = [
      '# 需求',
      '',
      '## L2 详情',
      '',
      '#### F-01 第一个功能',
      '描述 F-01。',
      '',
      '- 验收：A',
      '',
      '#### F-02 第二个功能',
      '描述 F-02。',
      '##### 子标题（应算正文，不切段）',
      '更多 F-02。',
      '',
      '### 非功能性需求',
      '与锚点无关的内容。',
    ].join('\n');

    it('切到下一个同级或更高级标题边界', () => {
      const sections = extractAnchorSections(doc, 'F');
      expect([...sections.keys()]).toEqual(['F-01', 'F-02']);
      expect(sections.get('F-01')).toBe('#### F-01 第一个功能\n描述 F-01。\n\n- 验收：A');
    });

    it('##### 更深标题算正文不切段；### 同级以上切段', () => {
      const sections = extractAnchorSections(doc, 'F');
      const f2 = sections.get('F-02') ?? '';
      expect(f2).toContain('##### 子标题（应算正文，不切段）');
      expect(f2).toContain('更多 F-02。');
      expect(f2).not.toContain('与锚点无关的内容。');
    });

    it('文档无对应前缀锚点时返回空 Map', () => {
      expect(extractAnchorSections(doc, 'D').size).toBe(0);
    });

    it('末尾锚点（无后续标题）收到文件末尾', () => {
      const md = '#### D-01 设计点\n正文一\n正文二';
      const sections = extractAnchorSections(md, 'D');
      expect(sections.get('D-01')).toBe('#### D-01 设计点\n正文一\n正文二');
    });

    it('与 extractAnchorPool 的 ID 集合一致', () => {
      expect(new Set(extractAnchorSections(doc, 'F').keys())).toEqual(extractAnchorPool(doc, 'F'));
    });
  });

  describe('clampText / designFirstLine', () => {
    it('clampText 未超限不截断', () => {
      expect(clampText('abc', 10)).toEqual({ text: 'abc', truncated: false });
    });
    it('clampText 超限截断并标记', () => {
      const r = clampText('abcdef', 3);
      expect(r.text).toBe('abc');
      expect(r.truncated).toBe(true);
    });
    it('designFirstLine 取标题 + 首个非空正文行', () => {
      expect(designFirstLine('#### D-01 标题\n\n首行正文\n第二行')).toBe('#### D-01 标题\n首行正文');
    });
    it('designFirstLine 无正文只回标题', () => {
      expect(designFirstLine('#### D-02 仅标题')).toBe('#### D-02 仅标题');
    });
  });
});

describe('TaskManager 集成', () => {
  let workspace: DirectoryResult;
  let fs: FileStorage;
  let scenes: SceneManager;
  let specs: SpecManager;
  let tasks: TaskManager;
  let claims: ClaimStore;

  beforeEach(async () => {
    workspace = await tmpDir({ unsafeCleanup: true });
    await ensureWorkspace(workspace.path);
    fs = new FileStorage(workspace.path);
    scenes = new SceneManager(fs);
    specs = new SpecManager(fs, scenes);
    tasks = new TaskManager(fs, scenes, specs);
    claims = new ClaimStore(fs);

    await scenes.create({ name: 'user-management' });
    await specs.create({ scene: 'user-management', name: 'user-login' });
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  describe('anchor_context (F-03)', () => {
    it('in_progress 回填 validates 锚点（requirements）', async () => {
      const t = await tasks.create({ scene: 'user-management', spec: 'user-login', title: '实现', validates: ['F-01'] });
      const r = await tasks.update({ scene: 'user-management', spec: 'user-login', task_id: t.data.id, status: 'in_progress' });
      expect(r.anchor_context).toHaveLength(1);
      expect(r.anchor_context?.[0]?.anchor).toBe('F-01');
      expect(r.anchor_context?.[0]?.source).toBe('requirements');
      expect(r.anchor_context?.[0]?.text).toContain('#### F-01');
      expect(r.anchor_context?.[0]?.truncated).toBe(false);
    });

    it('无 validates 不回 anchor_context（不回空数组），保留现有回看文案', async () => {
      const t = await tasks.create({ scene: 'user-management', spec: 'user-login', title: '无锚点' });
      const r = await tasks.update({ scene: 'user-management', spec: 'user-login', task_id: t.data.id, status: 'in_progress' });
      expect(r.anchor_context).toBeUndefined();
      expect(r.ai_followup?.instructions.join('\n')).toContain('先回看本 Spec 的 requirements');
    });

    it('D-xx 默认只回首行 + 标题', async () => {
      const t = await tasks.create({ scene: 'user-management', spec: 'user-login', title: '设计相关', validates: ['D-01'] });
      const r = await tasks.update({ scene: 'user-management', spec: 'user-login', task_id: t.data.id, status: 'in_progress' });
      const d = r.anchor_context?.find((a) => a.anchor === 'D-01');
      expect(d?.source).toBe('design');
      expect(d!.text.split('\n').length).toBeLessThanOrEqual(2);
    });

    it('completed 不回填 anchor_context', async () => {
      const t = await tasks.create({ scene: 'user-management', spec: 'user-login', title: 'x', validates: ['F-01'] });
      await tasks.update({ scene: 'user-management', spec: 'user-login', task_id: t.data.id, status: 'in_progress' });
      const r = await tasks.update({ scene: 'user-management', spec: 'user-login', task_id: t.data.id, status: 'completed' });
      expect(r.anchor_context).toBeUndefined();
    });

    it('claim 同样回填 anchor_context（堵 claim 旁路）', async () => {
      const t = await tasks.create({ scene: 'user-management', spec: 'user-login', title: 'claim 锚点', validates: ['F-01'] });
      const r = await tasks.claim({ scene: 'user-management', spec: 'user-login', task: t.data.id, agent_id: 'agent-a' });
      expect(r.anchor_context).toHaveLength(1);
      expect(r.anchor_context?.[0]?.anchor).toBe('F-01');
      expect(r.anchor_context?.[0]?.source).toBe('requirements');
      expect(r.ai_followup?.instructions.join('\n')).toContain('请回看 requirements.md / design.md 原文');
    });
  });

  describe('create', () => {
    it('应分配 T-001 序号并写入 tasks.md', async () => {
      const r = await tasks.create({
        scene: 'user-management',
        spec: 'user-login',
        title: '设计登录接口',
      });
      expect(r.ok).toBe(true);
      expect(r.data.id).toBe('T-001');
      expect(r.data.status).toBe('pending');
      const list = await tasks.list('user-management', 'user-login');
      expect(list).toHaveLength(1);
      expect(list[0]?.id).toBe('T-001');
    });

    it('F-01: 在 completed spec 上 task_create 提示状态回退', async () => {
      await specs.updateStatus('user-management', 'user-login', 'ready');
      await specs.updateStatus('user-management', 'user-login', 'in-progress');
      await specs.updateStatus('user-management', 'user-login', 'completed');
      const r = await tasks.create({ scene: 'user-management', spec: 'user-login', title: '维护态加参数' });
      expect(r.ai_followup?.instructions.join('\n')).toContain('completed→in-progress 合法');
    });

    it('应递增序号', async () => {
      const a = await tasks.create({
        scene: 'user-management',
        spec: 'user-login',
        title: 'A',
      });
      const b = await tasks.create({
        scene: 'user-management',
        spec: 'user-login',
        title: 'B',
      });
      expect(a.data.id).toBe('T-001');
      expect(b.data.id).toBe('T-002');
    });

    it('应保存描述 / 验收 / 依赖', async () => {
      const dep = await tasks.create({ scene: 'user-management', spec: 'user-login', title: '前置任务' });
      const r = await tasks.create({
        scene: 'user-management',
        spec: 'user-login',
        title: '示例',
        description: '描述内容',
        acceptance: ['验收 1', '验收 2'],
        depends_on: [dep.data.id],
      });
      const got = await tasks.get('user-management', 'user-login', r.data.id);
      expect(got.title).toBe('示例');
      expect(got.acceptance).toEqual(['验收 1', '验收 2']);
      expect(got.depends_on).toEqual([dep.data.id]);
    });

    it('depends_on 指向不存在的 Task 应硬拒、不落盘（I-7）', async () => {
      await expect(tasks.create({
        scene: 'user-management',
        spec: 'user-login',
        title: '坏依赖任务',
        depends_on: ['T-099'],
      })).rejects.toThrow(/T-099/);
      const list = await tasks.list('user-management', 'user-login');
      expect(list.find((t) => t.title === '坏依赖任务')).toBeUndefined();
    });

    it('S6: validates 含废弃 design# 格式应硬拒并提示改用 D-xx', async () => {
      await expect(tasks.create({
        scene: 'user-management',
        spec: 'user-login',
        title: '废弃锚点',
        validates: ['design#3.2'],
      })).rejects.toThrow(/废弃/);
    });

    it('S6: validates 含自由字符串应硬拒（只接受 F-xx/D-xx）', async () => {
      await expect(tasks.create({
        scene: 'user-management',
        spec: 'user-login',
        title: '自由串锚点',
        validates: ['登录相关'],
      })).rejects.toThrow(/只接受/);
    });

    it('S6: validates 的 F-xx 在 requirements 不存在应硬拒、不落盘', async () => {
      await expect(tasks.create({
        scene: 'user-management',
        spec: 'user-login',
        title: '坏F锚点',
        validates: ['F-99'],
      })).rejects.toThrow(/F-99/);
      const list = await tasks.list('user-management', 'user-login');
      expect(list.find((t) => t.title === '坏F锚点')).toBeUndefined();
    });

    it('S6: validates 的 D-xx 在 design 不存在应硬拒', async () => {
      await expect(tasks.create({
        scene: 'user-management',
        spec: 'user-login',
        title: '坏D锚点',
        validates: ['D-99'],
      })).rejects.toThrow(/D-99/);
    });

    it('S6: validates 的 F-xx/D-xx 均真实存在时正常创建（骨架自带 F-01/D-01）', async () => {
      const r = await tasks.create({
        scene: 'user-management',
        spec: 'user-login',
        title: '合法锚点任务',
        validates: ['F-01', 'D-01'],
      });
      expect(r.data.validates).toEqual(['F-01', 'D-01']);
    });

    it('S3: depends_on 前置未完成时 in_progress 给软提醒且不阻断（I-7 warning）', async () => {
      const dep = await tasks.create({ scene: 'user-management', spec: 'user-login', title: '前置' });
      const r = await tasks.create({
        scene: 'user-management', spec: 'user-login', title: '后置', depends_on: [dep.data.id],
      });
      const updated = await tasks.update({
        scene: 'user-management', spec: 'user-login', task_id: r.data.id, status: 'in_progress',
      });
      expect(updated.data.status).toBe('in_progress');
      expect(updated.ai_followup?.instructions.join('\n')).toContain(`前置 ${dep.data.id} 还未完成`);
    });

    it('S3: 前置全部完成时无依赖提醒', async () => {
      const dep = await tasks.create({ scene: 'user-management', spec: 'user-login', title: '前置2' });
      await tasks.update({ scene: 'user-management', spec: 'user-login', task_id: dep.data.id, status: 'in_progress' });
      await tasks.update({ scene: 'user-management', spec: 'user-login', task_id: dep.data.id, status: 'completed' });
      const r = await tasks.create({
        scene: 'user-management', spec: 'user-login', title: '后置2', depends_on: [dep.data.id],
      });
      const updated = await tasks.update({
        scene: 'user-management', spec: 'user-login', task_id: r.data.id, status: 'in_progress',
      });
      expect(updated.ai_followup?.instructions.join('\n')).not.toContain('还未完成，确认是否可开始');
    });

    it('S6 复核修复: 存量坏锚点在 task_update 推进时软提醒且不阻断', async () => {
      const r = await tasks.create({ scene: 'user-management', spec: 'user-login', title: '存量坏锚点任务' });
      // 模拟存量/手改数据：绕过 create 校验，直接把坏锚点写进 tasks.md
      const tasksPath = '.lrnev/scenes/01-user-management/specs/01-00-user-login/tasks.md';
      const content = await fs.read(tasksPath);
      await fs.write(tasksPath, content.replace(
        new RegExp(`(### ${r.data.id} [^<]*<!-- lrnev-task: [^>]*?)( -->)`),
        '$1, validates=design#3.2|F-99$2',
      ));

      const updated = await tasks.update({
        scene: 'user-management', spec: 'user-login', task_id: r.data.id, status: 'in_progress',
      });
      expect(updated.data.status).toBe('in_progress');
      const text = updated.ai_followup?.instructions.join('\n') ?? '';
      expect(text).toContain('design#3.2');
      expect(text).toContain('F-99');
      expect(text).toContain('废弃格式或在 requirements/design 中不存在');
    });

    it('S3: 父任务带未完成子任务标 completed 时给软提醒且不阻断（I-8）', async () => {
      const parent = await tasks.create({ scene: 'user-management', spec: 'user-login', title: '父容器' });
      await tasks.create({
        scene: 'user-management', spec: 'user-login', title: '子未完', parent: parent.data.id,
      });
      await tasks.update({ scene: 'user-management', spec: 'user-login', task_id: parent.data.id, status: 'in_progress' });
      const done = await tasks.update({
        scene: 'user-management', spec: 'user-login', task_id: parent.data.id, status: 'completed',
      });
      expect(done.data.status).toBe('completed');
      expect(done.ai_followup?.instructions.join('\n')).toContain('1 个子任务未完成');
    });

    it('应保存 validates 并在 tasks.md 可见', async () => {
      const r = await tasks.create({
        scene: 'user-management',
        spec: 'user-login',
        title: '实现登录校验',
        validates: ['F-01', 'D-01'],
      });
      const got = await tasks.get('user-management', 'user-login', r.data.id);
      const content = await fs.read('.lrnev/scenes/01-user-management/specs/01-00-user-login/tasks.md');

      expect(got.validates).toEqual(['F-01', 'D-01']);
      expect(content).toContain('validates=F-01|D-01');
    });

    it('应保存 parent、把子任务紧邻父任务并在 list 中体现层级', async () => {
      const parent = await tasks.create({
        scene: 'user-management',
        spec: 'user-login',
        title: '父任务',
      });
      const child = await tasks.create({
        scene: 'user-management',
        spec: 'user-login',
        title: '子任务',
        parent: parent.data.id,
      });

      const list = await tasks.list('user-management', 'user-login');
      const parentInList = list.find((task) => task.id === parent.data.id);
      const childInList = list.find((task) => task.id === child.data.id);
      const content = await fs.read('.lrnev/scenes/01-user-management/specs/01-00-user-login/tasks.md');

      expect(childInList?.parent).toBe(parent.data.id);
      expect(parentInList?.children).toEqual([
        expect.objectContaining({ id: child.data.id, parent: parent.data.id }),
      ]);
      expect(content).toContain(`parent=${parent.data.id}`);
      expect(content.indexOf(`### ${parent.data.id}`)).toBeLessThan(content.indexOf(`### ${child.data.id}`));
    });

    it('F-13: readable list 返回投影视图且不写 tasks.md', async () => {
      const created = await tasks.create({
        scene: 'user-management',
        spec: 'user-login',
        title: '实现登录校验',
        acceptance: ['非 EARS 自然语言验收'],
        validates: ['F-01'],
      });
      await tasks.update({
        scene: 'user-management',
        spec: 'user-login',
        task_id: created.data.id,
        status: 'in_progress',
      });
      const tasksPath = '.lrnev/scenes/01-user-management/specs/01-00-user-login/tasks.md';
      const before = await fs.read(tasksPath);
      const writeSpy = vi.spyOn(fs, 'write');

      const readable = await tasks.list('user-management', 'user-login', { view: 'readable' });
      const after = await fs.read(tasksPath);

      expect(writeSpy).not.toHaveBeenCalled();
      expect(after).toBe(before);
      expect(readable).toEqual([
        {
          id: created.data.id,
          title: '实现登录校验',
          status: 'in_progress',
          acceptance: ['非 EARS 自然语言验收'],
          validates: ['F-01'],
        },
      ]);
      expect(JSON.stringify(readable)).not.toContain('history');
      expect(JSON.stringify(readable)).not.toContain('lrnev-task');
    });

    it('F-08: task_claim/task_release API 应解析别名并返回 followup', async () => {
      const created = await tasks.create({
        scene: 'user-management',
        spec: 'user-login',
        title: '实现 claim API',
      });

      const claim = await tasks.claim({
        scene: 'user-management',
        spec: 'user-login',
        task: created.data.id,
        agent_id: 'agent-a',
        touches_files: ['src/auth.ts'],
      });

      expect(claim.data.claim).toMatchObject({
        scene: '01-user-management',
        spec: '01-00-user-login',
        task: created.data.id,
        claimed_by: 'agent-a',
      });
      expect(claim.ai_followup?.instructions.join('\n')).toContain('已登记 task claim');

      const released = await tasks.releaseClaim({
        scene: 'user-management',
        spec: 'user-login',
        task: created.data.id,
        agent_id: 'agent-a',
      });

      expect(released.data.released).toBe(true);
      expect(released.ai_followup?.instructions.join('\n')).toContain('已释放 task claim');
    });

    it('F-08: task_claim API 应提示 touches_files 重叠但不阻止 claim', async () => {
      const first = await tasks.create({ scene: 'user-management', spec: 'user-login', title: '先做 auth' });
      const second = await tasks.create({ scene: 'user-management', spec: 'user-login', title: '再做 session' });
      await tasks.claim({
        scene: 'user-management',
        spec: 'user-login',
        task: first.data.id,
        agent_id: 'agent-a',
        touches_files: ['src/auth.ts'],
      });

      const result = await tasks.claim({
        scene: 'user-management',
        spec: 'user-login',
        task: second.data.id,
        agent_id: 'agent-b',
        touches_files: ['src/auth.ts'],
      });

      expect(result.data.claimed).toBe(true);
      expect(result.data.overlaps).toEqual([
        expect.objectContaining({ task: first.data.id, claimed_by: 'agent-a', touches_files: ['src/auth.ts'] }),
      ]);
      expect(result.ai_followup?.instructions.join('\n')).toContain('touches_files 重叠警告');
    });

    it('F-02: 单 claim 不应主动提示 touches_files 声明', async () => {
      const created = await tasks.create({
        scene: 'user-management',
        spec: 'user-login',
        title: '单窗口工作',
      });

      const result = await tasks.claim({
        scene: 'user-management',
        spec: 'user-login',
        task: created.data.id,
        agent_id: 'agent-a',
      });

      expect(result.ai_followup?.instructions.join('\n')).not.toContain('多窗口并行时');
      expect(result.ai_followup?.instructions.join('\n')).not.toContain('传 touches_files');
    });

    it('F-02: 多 claim 上下文应提示可声明 touches_files', async () => {
      const first = await tasks.create({ scene: 'user-management', spec: 'user-login', title: '先做 auth' });
      const second = await tasks.create({ scene: 'user-management', spec: 'user-login', title: '再做 session' });
      await tasks.claim({
        scene: 'user-management',
        spec: 'user-login',
        task: first.data.id,
        agent_id: 'agent-a',
      });

      const result = await tasks.claim({
        scene: 'user-management',
        spec: 'user-login',
        task: second.data.id,
        agent_id: 'agent-b',
      });

      expect(result.ai_followup?.instructions.join('\n')).toContain('多窗口并行时');
      expect(result.ai_followup?.instructions.join('\n')).toContain('传 touches_files');
      expect(result.ai_followup?.instructions.join('\n')).toContain('这不是源码锁');
    });

    it('F-08: claim 全删不应影响 tasks.md', async () => {
      const created = await tasks.create({
        scene: 'user-management',
        spec: 'user-login',
        title: '验证 claim 运行态',
      });
      await tasks.claim({
        scene: 'user-management',
        spec: 'user-login',
        task: created.data.id,
        agent_id: 'agent-a',
      });
      const tasksPath = '.lrnev/scenes/01-user-management/specs/01-00-user-login/tasks.md';
      const before = await fs.read(tasksPath);

      await fs.rm('.lrnev/runtime/claims');
      const after = await fs.read(tasksPath);

      expect(after).toBe(before);
      expect(await claims.listActive()).toEqual([]);
    });

    it('F-05: 顺序创建多个子任务时 tasks.md 和 children 都保持创建顺序', async () => {
      const parent = await tasks.create({
        scene: 'user-management',
        spec: 'user-login',
        title: '父任务',
      });
      const childA = await tasks.create({
        scene: 'user-management',
        spec: 'user-login',
        title: '子任务 A',
        parent: parent.data.id,
      });
      const childB = await tasks.create({
        scene: 'user-management',
        spec: 'user-login',
        title: '子任务 B',
        parent: parent.data.id,
      });

      const content = await fs.read('.lrnev/scenes/01-user-management/specs/01-00-user-login/tasks.md');
      const list = await tasks.list('user-management', 'user-login');
      const parentInList = list.find((task) => task.id === parent.data.id);

      expect(content.indexOf(`### ${parent.data.id}`)).toBeLessThan(content.indexOf(`### ${childA.data.id}`));
      expect(content.indexOf(`### ${childA.data.id}`)).toBeLessThan(content.indexOf(`### ${childB.data.id}`));
      expect(parentInList?.children?.map((task) => task.id)).toEqual([
        childA.data.id,
        childB.data.id,
      ]);
    });

    it('task_create 的 followup 不应询问 AI 子任务', async () => {
      const r = await tasks.create({
        scene: 'user-management',
        spec: 'user-login',
        title: 'X',
      });
      const instructions = r.ai_followup?.instructions.join('\n') ?? '';
      expect(instructions).not.toContain('AI 子任务');
      expect(instructions).not.toContain('文件不相交');
    });

    it('并发创建同一父任务的子任务不应丢数据或串号', async () => {
      const parent = await tasks.create({
        scene: 'user-management',
        spec: 'user-login',
        title: '父任务',
      });

      const created = await Promise.all(
        Array.from({ length: 5 }, (_, i) => tasks.create({
          scene: 'user-management',
          spec: 'user-login',
          title: `子任务 ${i + 1}`,
          parent: parent.data.id,
        })),
      );

      const ids = created.map((result) => result.data.id);
      const list = await tasks.list('user-management', 'user-login');
      const parentInList = list.find((task) => task.id === parent.data.id);

      expect(new Set(ids).size).toBe(5);
      expect(list).toHaveLength(6);
      expect(parentInList?.children).toHaveLength(5);
      for (const id of ids) {
        expect(list).toEqual(expect.arrayContaining([
          expect.objectContaining({ id, parent: parent.data.id }),
        ]));
      }
    });

    it('应返回 ai_followup', async () => {
      const r = await tasks.create({
        scene: 'user-management',
        spec: 'user-login',
        title: 'X',
      });
      expect(r.ai_followup).toBeDefined();
      expect(r.ai_followup!.instructions.length).toBeGreaterThan(0);
    });

    it('空标题应拒绝', async () => {
      await expect(
        tasks.create({ scene: 'user-management', spec: 'user-login', title: '' }),
      ).rejects.toThrow();
    });

    it('并发改不同 Spec 的 tasks.md 应互不影响', async () => {
      await specs.create({ scene: 'user-management', name: 'password-reset' });

      const [loginTask, resetTask] = await Promise.all([
        tasks.create({ scene: 'user-management', spec: 'user-login', title: 'Login task' }),
        tasks.create({ scene: 'user-management', spec: 'password-reset', title: 'Reset task' }),
      ]);

      await Promise.all([
        tasks.update({
          scene: 'user-management',
          spec: 'user-login',
          task_id: loginTask.data.id,
          status: 'in_progress',
        }),
        tasks.update({
          scene: 'user-management',
          spec: 'password-reset',
          task_id: resetTask.data.id,
          status: 'in_progress',
        }),
      ]);

      const loginTasks = await tasks.list('user-management', 'user-login');
      const resetTasks = await tasks.list('user-management', 'password-reset');
      expect(loginTasks).toEqual([
        expect.objectContaining({ id: 'T-001', title: 'Login task', status: 'in_progress' }),
      ]);
      expect(resetTasks).toEqual([
        expect.objectContaining({ id: 'T-001', title: 'Reset task', status: 'in_progress' }),
      ]);
    });
  });

  describe('update（状态机）', () => {
    let taskId: string;

    beforeEach(async () => {
      const r = await tasks.create({
        scene: 'user-management',
        spec: 'user-login',
        title: 'T',
      });
      taskId = r.data.id;
    });

    it('pending → in_progress 合法', async () => {
      const r = await tasks.update({
        scene: 'user-management',
        spec: 'user-login',
        task_id: taskId,
        status: 'in_progress',
      });
      expect(r.data.status).toBe('in_progress');
      expect(r.data.history?.length).toBe(1);
      expect(r.ai_followup?.instructions.join('\n')).toContain('先回看本 Spec 的 requirements 目标与验收标准');
      expect(r.ai_followup?.instructions.join('\n')).toContain('spec.status 改为 in-progress');
      // S4(I-10): 无弱信号的小任务不再被劝拆并行
      expect(r.ai_followup?.instructions.join('\n')).not.toContain('文件不相交');
    });

    it('S4: 大任务(acceptance≥3) in_progress 仍含并行提示', async () => {
      const big = await tasks.create({
        scene: 'user-management',
        spec: 'user-login',
        title: '大任务',
        acceptance: ['一', '二', '三'],
      });
      const r = await tasks.update({
        scene: 'user-management', spec: 'user-login', task_id: big.data.id, status: 'in_progress',
      });
      expect(r.ai_followup?.instructions.join('\n')).toContain('文件不相交');
      expect(r.ai_followup?.instructions.join('\n')).toContain('lrnev 只锁 tasks.md');
    });

    it('S4: 子任务(有 parent) in_progress 不含并行提示', async () => {
      const child = await tasks.create({
        scene: 'user-management',
        spec: 'user-login',
        title: '子任务',
        parent: taskId,
        acceptance: ['一', '二', '三'],
      });
      const r = await tasks.update({
        scene: 'user-management', spec: 'user-login', task_id: child.data.id, status: 'in_progress',
      });
      expect(r.ai_followup?.instructions.join('\n')).not.toContain('文件不相交');
    });

    it('F-08: task_update 到 in_progress 且传 agent_id 时应登记 task claim', async () => {
      const r = await tasks.update({
        scene: 'user-management',
        spec: 'user-login',
        task_id: taskId,
        status: 'in_progress',
        agent_id: 'agent-a',
        touches_files: ['src/auth.ts', 'src/auth.ts'],
      });

      const active = await claims.listActive();
      expect(active).toEqual([
        expect.objectContaining({
          scene: '01-user-management',
          spec: '01-00-user-login',
          task: taskId,
          claimed_by: 'agent-a',
          touches_files: ['src/auth.ts'],
        }),
      ]);
      expect(r.ai_followup?.instructions.join('\n')).toContain('已登记 task claim');
    });

    it('F-02: task_update 在多 claim 上下文应提示可声明 touches_files', async () => {
      const other = await tasks.create({
        scene: 'user-management',
        spec: 'user-login',
        title: '并行任务',
      });
      await claims.claim({
        scene: '01-user-management',
        spec: '01-00-user-login',
        task: other.data.id,
        agent_id: 'agent-a',
      });

      const r = await tasks.update({
        scene: 'user-management',
        spec: 'user-login',
        task_id: taskId,
        status: 'in_progress',
        agent_id: 'agent-b',
      });

      expect(r.ai_followup?.instructions.join('\n')).toContain('多窗口并行时');
      expect(r.ai_followup?.instructions.join('\n')).toContain('传 touches_files');
      expect(r.ai_followup?.instructions.join('\n')).toContain('重叠提示');
    });

    it('F-08: task_update 遇到他人活跃 claim 应只提示冲突不阻止状态更新', async () => {
      await claims.claim({
        scene: '01-user-management',
        spec: '01-00-user-login',
        task: taskId,
        agent_id: 'agent-a',
      });

      const r = await tasks.update({
        scene: 'user-management',
        spec: 'user-login',
        task_id: taskId,
        status: 'in_progress',
        agent_id: 'agent-b',
      });

      const active = await claims.listActive();
      expect(r.data.status).toBe('in_progress');
      expect(active).toEqual([
        expect.objectContaining({
          task: taskId,
          claimed_by: 'agent-a',
        }),
      ]);
      expect(r.ai_followup?.instructions.join('\n')).toContain('已有活跃 claim');
    });

    it('in_progress followup 有 validates 时应指向具体需求/设计锚点', async () => {
      const created = await tasks.create({
        scene: 'user-management',
        spec: 'user-login',
        title: '带锚点任务',
        validates: ['F-01', 'D-01'],
      });

      const r = await tasks.update({
        scene: 'user-management',
        spec: 'user-login',
        task_id: created.data.id,
        status: 'in_progress',
      });

      expect(r.ai_followup?.instructions.join('\n')).toContain('F-01、D-01');
    });

    it('Spec 已 completed 时开始 Task 应提示这是状态回退', async () => {
      const reqPath = '.lrnev/scenes/01-user-management/specs/01-00-user-login/requirements.md';
      const req = await fs.read(reqPath);
      await fs.write(reqPath, req.replace('status: draft', 'status: completed'));

      const r = await tasks.update({
        scene: 'user-management',
        spec: 'user-login',
        task_id: taskId,
        status: 'in_progress',
      });

      expect(r.ai_followup?.instructions.join('\n')).toContain('回退到 in-progress');
      expect(r.ai_followup?.instructions.join('\n')).toContain('未完成工作');
    });

    it('pending → completed 非法', async () => {
      try {
        await tasks.update({
          scene: 'user-management',
          spec: 'user-login',
          task_id: taskId,
          status: 'completed',
        });
        expect.fail();
      } catch (err) {
        expect(isLrnevError(err)).toBe(true);
        if (isLrnevError(err)) expect(err.code).toBe('INVALID_STATUS_TRANSITION');
      }
    });

    it('pending → in_progress → completed 合法链', async () => {
      await tasks.update({
        scene: 'user-management',
        spec: 'user-login',
        task_id: taskId,
        status: 'in_progress',
      });
      const r = await tasks.update({
        scene: 'user-management',
        spec: 'user-login',
        task_id: taskId,
        status: 'completed',
      });
      expect(r.data.status).toBe('completed');
      expect(r.data.history?.length).toBe(2);
    });

    it('F-08: task_update 到 completed 时应释放同 agent 的 task claim', async () => {
      await tasks.update({
        scene: 'user-management',
        spec: 'user-login',
        task_id: taskId,
        status: 'in_progress',
        agent_id: 'agent-a',
      });
      expect(await claims.listActive()).toHaveLength(1);

      const r = await tasks.update({
        scene: 'user-management',
        spec: 'user-login',
        task_id: taskId,
        status: 'completed',
        agent_id: 'agent-a',
      });

      expect(await claims.listActive()).toEqual([]);
      expect(r.ai_followup?.instructions.join('\n')).toContain('已释放 task claim');
    });

    it('所有子任务 completed 时应提示父任务可完成', async () => {
      const parent = await tasks.create({
        scene: 'user-management',
        spec: 'user-login',
        title: '父任务',
      });
      await tasks.update({
        scene: 'user-management',
        spec: 'user-login',
        task_id: parent.data.id,
        status: 'in_progress',
      });
      const childA = await tasks.create({
        scene: 'user-management',
        spec: 'user-login',
        title: '子任务 A',
        parent: parent.data.id,
      });
      const childB = await tasks.create({
        scene: 'user-management',
        spec: 'user-login',
        title: '子任务 B',
        parent: parent.data.id,
      });

      await tasks.update({ scene: 'user-management', spec: 'user-login', task_id: childA.data.id, status: 'in_progress' });
      await tasks.update({ scene: 'user-management', spec: 'user-login', task_id: childA.data.id, status: 'completed' });
      await tasks.update({ scene: 'user-management', spec: 'user-login', task_id: childB.data.id, status: 'in_progress' });
      const r = await tasks.update({
        scene: 'user-management',
        spec: 'user-login',
        task_id: childB.data.id,
        status: 'completed',
      });

      expect(r.ai_followup?.instructions.join('\n')).toContain(`父任务 "${parent.data.id}"`);
      expect(r.ai_followup?.instructions.join('\n')).toContain('所有子任务已 completed');
    });

    it('并发更新同一 tasks.md 的多个子任务不应互相覆盖', async () => {
      const parent = await tasks.create({
        scene: 'user-management',
        spec: 'user-login',
        title: '父任务',
      });
      const created = await Promise.all(
        Array.from({ length: 5 }, (_, i) => tasks.create({
          scene: 'user-management',
          spec: 'user-login',
          title: `子任务 ${i + 1}`,
          parent: parent.data.id,
        })),
      );

      await Promise.all(created.map((result) => tasks.update({
        scene: 'user-management',
        spec: 'user-login',
        task_id: result.data.id,
        status: 'in_progress',
      })));

      const list = await tasks.list('user-management', 'user-login');
      for (const result of created) {
        expect(list).toEqual(expect.arrayContaining([
          expect.objectContaining({ id: result.data.id, status: 'in_progress', parent: parent.data.id }),
        ]));
      }
    });

    it('completed 后任何转换都非法', async () => {
      await tasks.update({
        scene: 'user-management',
        spec: 'user-login',
        task_id: taskId,
        status: 'in_progress',
      });
      await tasks.update({
        scene: 'user-management',
        spec: 'user-login',
        task_id: taskId,
        status: 'completed',
      });
      await expect(
        tasks.update({
          scene: 'user-management',
          spec: 'user-login',
          task_id: taskId,
          status: 'pending',
        }),
      ).rejects.toThrow();
    });

    it('failed → pending 应合法（可重试）', async () => {
      await tasks.update({
        scene: 'user-management',
        spec: 'user-login',
        task_id: taskId,
        status: 'in_progress',
      });
      await tasks.update({
        scene: 'user-management',
        spec: 'user-login',
        task_id: taskId,
        status: 'failed',
      });
      const r = await tasks.update({
        scene: 'user-management',
        spec: 'user-login',
        task_id: taskId,
        status: 'pending',
      });
      expect(r.data.status).toBe('pending');
    });

    it('update 后再次 list 应反映新状态（持久化）', async () => {
      await tasks.update({
        scene: 'user-management',
        spec: 'user-login',
        task_id: taskId,
        status: 'in_progress',
      });
      const list = await tasks.list('user-management', 'user-login');
      expect(list[0]?.status).toBe('in_progress');
    });

    it('completed 应触发 ai_followup 建议跑 completion gate', async () => {
      await tasks.update({
        scene: 'user-management',
        spec: 'user-login',
        task_id: taskId,
        status: 'in_progress',
      });
      const r = await tasks.update({
        scene: 'user-management',
        spec: 'user-login',
        task_id: taskId,
        status: 'completed',
      });
      expect(r.ai_followup?.suggested_tools?.[0]?.name).toBe('spec_gate_check');
    });
  });

  describe('get', () => {
    it('不存在应抛 TASK_NOT_FOUND', async () => {
      try {
        await tasks.get('user-management', 'user-login', 'T-999');
        expect.fail();
      } catch (err) {
        expect(isLrnevError(err)).toBe(true);
      }
    });
  });
});
