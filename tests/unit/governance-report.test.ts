/**
 * GovernanceReport 单元测试（03-00 governance-report，T-001 计算核心）。
 *
 * 覆盖：scene/spec/task 计数、FILL-aware 锚点覆盖率、孤儿分类（in_flight/debt）、
 * unclosed（镜像 completion gate 的 all_tasks_completed）、failed/blocked 明细、
 * archived 排除、--scene 过滤、空工作区健康 headline。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { dir as tmpDir, type DirectoryResult } from 'tmp-promise';

import { FileStorage } from '../../src/storage/FileStorage.js';
import { ensureWorkspace } from '../../src/storage/WorkspaceLocator.js';
import { SceneManager } from '../../src/core/SceneManager.js';
import { SpecManager } from '../../src/core/SpecManager.js';
import { TaskManager } from '../../src/core/TaskManager.js';
import { GateRunner } from '../../src/core/GateRunner.js';
import { GovernanceReport, collectAnchorIds } from '../../src/core/GovernanceReport.js';

describe('GovernanceReport', () => {
  let workspace: DirectoryResult;
  let fs: FileStorage;
  let scenes: SceneManager;
  let specs: SpecManager;
  let report: GovernanceReport;

  beforeEach(async () => {
    workspace = await tmpDir({ unsafeCleanup: true });
    await ensureWorkspace(workspace.path);
    fs = new FileStorage(workspace.path);
    scenes = new SceneManager(fs);
    specs = new SpecManager(fs, scenes);
    report = new GovernanceReport(fs, scenes);
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  /** 写一份带 N 个 task 的 tasks.md（每个 task 指定 status / 可选 validates / 可选 parent）。 */
  async function writeTasks(
    sceneId: string,
    specId: string,
    tasks: { id: string; status: string; validates?: string[]; parent?: string }[],
  ): Promise<void> {
    const lines = ['---', `spec: '${specId}'`, `scene: '${sceneId}'`, '---', '', '# 任务', '', '## 阶段 1', ''];
    for (const t of tasks) {
      const meta = [`status=${t.status}`, 'created=2026-06-17T00:00:00.000Z'];
      if (t.parent) meta.push(`parent=${t.parent}`);
      if (t.validates?.length) meta.push(`validates=${t.validates.join('|')}`);
      lines.push(`### ${t.id} 任务 ${t.id} <!-- lrnev-task: ${meta.join(', ')} -->`, '');
    }
    await fs.write(`.lrnev/scenes/${sceneId}/specs/${specId}/tasks.md`, lines.join('\n'));
  }

  async function writeReq(sceneId: string, specId: string, status: string, anchors: string): Promise<void> {
    await fs.write(
      `.lrnev/scenes/${sceneId}/specs/${specId}/requirements.md`,
      `---\nspec: '${specId}'\nscene: '${sceneId}'\nstatus: ${status}\n---\n\n# 需求\n\n## L2 详情\n\n${anchors}\n`,
    );
  }

  it('空工作区：健康 headline、计数为 0', async () => {
    const res = await report.build();
    expect(res.data.headline).toContain('整体健康');
    expect(res.data.chain.spec_count).toBe(0);
    expect(res.data.coverage.coverage_ratio).toBe(1);
  });

  it('做完没收口：task 全 completed 但 status≠completed → 进 unclosed，与 completion gate 口径一致', async () => {
    const scene = await scenes.create({ name: 'demo-scene' });
    const spec = await specs.create({ scene: scene.data.id, name: 'login' });
    await writeReq(scene.data.id, spec.data.spec, 'draft', '#### F-01 登录\n校验。');
    await writeTasks(scene.data.id, spec.data.spec, [
      { id: 'T-001', status: 'completed', validates: ['F-01'] },
      { id: 'T-002', status: 'completed' },
    ]);

    const res = await report.build();
    const item = res.data.chain.unclosed.find((u) => u.spec === spec.data.spec);
    expect(item).toBeDefined();
    expect(item?.done).toBe(2);
    expect(item?.total).toBe(2);
    expect(item?.status).toBe('draft');
    expect(res.data.headline).toContain('做完未收口');
  });

  it('含未完成子任务的 spec 不被判 unclosed（与 gate 全平铺口径一致）', async () => {
    const scene = await scenes.create({ name: 'demo-scene' });
    const spec = await specs.create({ scene: scene.data.id, name: 'login' });
    await writeReq(scene.data.id, spec.data.spec, 'draft', '#### F-01 登录\n校验。');
    await writeTasks(scene.data.id, spec.data.spec, [
      { id: 'T-001', status: 'completed' },
      { id: 'T-002', status: 'pending', parent: 'T-001' },
    ]);

    const res = await report.build();
    expect(res.data.chain.unclosed.find((u) => u.spec === spec.data.spec)).toBeUndefined();
  });

  it('failed / blocked 任务逐条列出', async () => {
    const scene = await scenes.create({ name: 'demo-scene' });
    const spec = await specs.create({ scene: scene.data.id, name: 'login' });
    await writeReq(scene.data.id, spec.data.spec, 'in-progress', '#### F-01 登录\n校验。');
    await writeTasks(scene.data.id, spec.data.spec, [
      { id: 'T-001', status: 'failed' },
      { id: 'T-002', status: 'blocked' },
      { id: 'T-003', status: 'in_progress' },
    ]);

    const res = await report.build();
    expect(res.data.chain.failed_tasks.map((t) => t.id)).toEqual(['T-001']);
    expect(res.data.chain.blocked_tasks.map((t) => t.id)).toEqual(['T-002']);
    expect(res.data.headline).toContain('1 个任务失败');
  });

  it('覆盖率：孤儿按 spec 状态分 in_flight / debt；坏 validates 暂为空（T-003）', async () => {
    const scene = await scenes.create({ name: 'demo-scene' });
    // 在途 spec：有孤儿 = in_flight
    const draft = await specs.create({ scene: scene.data.id, name: 'draft-spec' });
    await writeReq(scene.data.id, draft.data.spec, 'draft', '#### F-01 a\nx\n\n#### F-02 b\ny');
    await writeTasks(scene.data.id, draft.data.spec, [{ id: 'T-001', status: 'pending', validates: ['F-01'] }]);
    // 已收口 spec：有孤儿 = debt
    const done = await specs.create({ scene: scene.data.id, name: 'done-spec' });
    await writeReq(scene.data.id, done.data.spec, 'completed', '#### F-01 a\nx\n\n#### F-02 b\ny');
    await writeTasks(scene.data.id, done.data.spec, [{ id: 'T-001', status: 'completed', validates: ['F-01'] }]);

    const res = await report.build();
    expect(res.data.coverage.in_flight_orphans.find((g) => g.spec === draft.data.spec)?.anchors).toEqual(['F-02']);
    expect(res.data.coverage.debt_orphans.find((g) => g.spec === done.data.spec)?.anchors).toEqual(['F-02']);
    expect(res.data.coverage.broken_validates).toEqual([]);
  });

  it('FILL 占位锚点不计入覆盖率分母', async () => {
    const scene = await scenes.create({ name: 'demo-scene' });
    const spec = await specs.create({ scene: scene.data.id, name: 'login' });
    await writeReq(scene.data.id, spec.data.spec, 'draft', '#### F-01 真实\nx\n\n#### F-02 <!-- FILL: 标题 -->');
    await writeTasks(scene.data.id, spec.data.spec, [{ id: 'T-001', status: 'completed', validates: ['F-01'] }]);

    const res = await report.build();
    // 只有 F-01 算真锚点，且已覆盖 → 100%
    expect(res.data.coverage.anchor_total).toBe(1);
    expect(res.data.coverage.anchor_covered).toBe(1);
  });

  it('archived spec 不计入欠债统计（archived_excluded 计数）', async () => {
    const scene = await scenes.create({ name: 'demo-scene' });
    const spec = await specs.create({ scene: scene.data.id, name: 'old' });
    await writeReq(scene.data.id, spec.data.spec, 'archived', '#### F-01 a\nx');
    await writeTasks(scene.data.id, spec.data.spec, [{ id: 'T-001', status: 'failed' }]);

    const res = await report.build();
    expect(res.data.coverage.archived_excluded).toBe(1);
    expect(res.data.chain.failed_tasks).toEqual([]); // archived 的 failed 不计
    expect(res.data.coverage.anchor_total).toBe(0); // archived 锚点不计
  });

  it('--scene 过滤：只含指定 scene', async () => {
    const a = await scenes.create({ name: 'scene-a' });
    const b = await scenes.create({ name: 'scene-b' });
    const sa = await specs.create({ scene: a.data.id, name: 'spec-a' });
    const sb = await specs.create({ scene: b.data.id, name: 'spec-b' });
    await writeReq(a.data.id, sa.data.spec, 'draft', '#### F-01 a\nx');
    await writeReq(b.data.id, sb.data.spec, 'draft', '#### F-01 b\ny');

    const res = await report.build({ scene: a.data.id });
    expect(res.data.scope).toBe(a.data.id);
    expect(res.data.chain.scenes.map((s) => s.scene)).toEqual([a.data.id]);
    expect(res.data.chain.spec_count).toBe(1);
  });

  it('每条欠债带定位 paths（context:// URI + requirements/tasks 路径）', async () => {
    const scene = await scenes.create({ name: 'demo-scene' });
    // unclosed spec：所有 task 完成但 status=draft。
    const closed = await specs.create({ scene: scene.data.id, name: 'all-done' });
    await writeReq(scene.data.id, closed.data.spec, 'draft', '#### F-01 a\nx');
    await writeTasks(scene.data.id, closed.data.spec, [{ id: 'T-001', status: 'completed' }]);
    // 另一个 spec 带 failed task。
    const buggy = await specs.create({ scene: scene.data.id, name: 'buggy' });
    await writeReq(scene.data.id, buggy.data.spec, 'in-progress', '#### F-01 b\ny');
    await writeTasks(scene.data.id, buggy.data.spec, [{ id: 'T-001', status: 'failed' }]);

    const res = await report.build();
    const unclosed = res.data.chain.unclosed.find((u) => u.spec === closed.data.spec);
    expect(unclosed?.paths?.uri).toBe(`context://spec/${scene.data.id}/${closed.data.spec}`);
    expect(unclosed?.paths?.requirements_path).toContain('requirements.md');
    expect(unclosed?.paths?.tasks_path).toContain('tasks.md');
    const failed = res.data.chain.failed_tasks.find((t) => t.spec === buggy.data.spec);
    expect(failed?.paths?.uri).toBe(`context://spec/${scene.data.id}/${buggy.data.spec}`);
  });

  it('坏 validates：列入 broken_validates、不虚增覆盖率、warnings 指向 doctor', async () => {
    const scene = await scenes.create({ name: 'demo-scene' });
    const spec = await specs.create({ scene: scene.data.id, name: 'login' });
    await writeReq(scene.data.id, spec.data.spec, 'in-progress', '#### F-01 真实\nx');
    // T-001 validates 指向真实 F-01，T-002 validates 指向不存在 F-99 + 废弃 design#3.2
    await writeTasks(scene.data.id, spec.data.spec, [
      { id: 'T-001', status: 'completed', validates: ['F-01'] },
      { id: 'T-002', status: 'pending', validates: ['F-99', 'design#3.2'] },
    ]);

    const res = await report.build();
    // 覆盖率只认真锚点 F-01，且已覆盖 → 100%，坏 ref 不虚增
    expect(res.data.coverage.anchor_total).toBe(1);
    expect(res.data.coverage.anchor_covered).toBe(1);
    // 坏 ref 列入 broken_validates
    const broken = res.data.coverage.broken_validates.find((b) => b.task === 'T-002');
    expect(broken?.anchors.sort()).toEqual(['F-99', 'design#3.2'].sort());
    // warnings 指向 doctor
    expect((res.data.warnings ?? []).join('\n')).toContain('doctor');
  });

  it('无坏 validates 时不产生 warnings 字段', async () => {
    const scene = await scenes.create({ name: 'demo-scene' });
    const spec = await specs.create({ scene: scene.data.id, name: 'login' });
    await writeReq(scene.data.id, spec.data.spec, 'draft', '#### F-01 a\nx');
    await writeTasks(scene.data.id, spec.data.spec, [{ id: 'T-001', status: 'completed', validates: ['F-01'] }]);
    const res = await report.build();
    expect(res.data.coverage.broken_validates).toEqual([]);
    expect(res.data.warnings).toBeUndefined();
  });

  it('collectAnchorIds：去重 + 排除 FILL', () => {
    const content = '#### F-01 a\n#### F-01 dup\n#### F-02 <!-- FILL: x -->\n#### F-03 c';
    expect(collectAnchorIds(content, 'F')).toEqual(['F-01', 'F-03']);
  });

  it('口径锁定：report 判 unclosed ⇔ GateRunner 的 all_tasks_completed 通过', async () => {
    const tasksMgr = new TaskManager(fs, scenes, specs);
    const gates = new GateRunner(fs, scenes, specs, tasksMgr);
    const scene = await scenes.create({ name: 'demo-scene' });

    // 全 completed 的 spec：report 判 unclosed，gate 的 all_tasks_completed 也 pass。
    const closed = await specs.create({ scene: scene.data.id, name: 'all-done' });
    await writeReq(scene.data.id, closed.data.spec, 'draft', '#### F-01 a\nx');
    await writeTasks(scene.data.id, closed.data.spec, [
      { id: 'T-001', status: 'completed' },
      { id: 'T-002', status: 'completed', parent: 'T-001' },
    ]);
    // 有未完成子任务的 spec：report 不判 unclosed，gate 的 all_tasks_completed 也 fail。
    const open = await specs.create({ scene: scene.data.id, name: 'has-open' });
    await writeReq(scene.data.id, open.data.spec, 'draft', '#### F-01 a\nx');
    await writeTasks(scene.data.id, open.data.spec, [
      { id: 'T-001', status: 'completed' },
      { id: 'T-002', status: 'pending', parent: 'T-001' },
    ]);

    const res = await report.build();
    const reportUnclosed = (spec: string): boolean =>
      res.data.chain.unclosed.some((u) => u.spec === spec);
    const gateAllDone = async (spec: string): Promise<boolean> => {
      const gr = await gates.check('completion', { scene: scene.data.id, spec });
      return gr.checks.find((c) => c.name === 'all_tasks_completed')?.passed === true;
    };

    expect(reportUnclosed(closed.data.spec)).toBe(true);
    expect(await gateAllDone(closed.data.spec)).toBe(true);

    expect(reportUnclosed(open.data.spec)).toBe(false);
    expect(await gateAllDone(open.data.spec)).toBe(false);
  });
});
