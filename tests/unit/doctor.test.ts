/**
 * Doctor 单元测试。
 *
 * 覆盖标准目录、Spec 三文档、陈旧任务、ADR 编号冲突、过期锁和 context 引用检查。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { dir as tmpDir, type DirectoryResult } from 'tmp-promise';
import { hostname } from 'node:os';

import { FileStorage } from '../../src/storage/FileStorage.js';
import { ensureWorkspace } from '../../src/storage/WorkspaceLocator.js';
import { SceneManager } from '../../src/core/SceneManager.js';
import { SpecManager } from '../../src/core/SpecManager.js';
import { Doctor } from '../../src/core/Doctor.js';
import { ClaimStore } from '../../src/core/ClaimStore.js';
import { AGENT_REGISTRY_REL } from '../../src/core/AgentRegistry.js';

describe('Doctor', () => {
  let workspace: DirectoryResult;
  let fs: FileStorage;
  let scenes: SceneManager;
  let specs: SpecManager;
  let doctor: Doctor;

  beforeEach(async () => {
    workspace = await tmpDir({ unsafeCleanup: true });
    await ensureWorkspace(workspace.path);
    fs = new FileStorage(workspace.path);
    scenes = new SceneManager(fs);
    specs = new SpecManager(fs, scenes);
    doctor = new Doctor(fs);
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  it('完整空工作区应无错误和警告', async () => {
    const report = await doctor.diagnose();
    expect(report.ok).toBe(true);
    expect(report.summary.errors).toBe(0);
    expect(report.summary.warnings).toBe(0);
    expect(report.issues.some((issue) => issue.code === 'BROKEN_CONTEXT_REF')).toBe(false);
  });

  it('应以 warning 报告 PROJECT/ARCHITECTURE onboarding 未补全且不影响 ok', async () => {
    await fs.write('.lrnev/PROJECT.md', [
      '# demo',
      '',
      '<!-- FILL: 一句话说明这个项目是什么 -->',
    ].join('\n'));
    await fs.write('.lrnev/ARCHITECTURE.md', [
      '# demo 架构',
      '',
      '<!-- FILL: 技术栈；自动探测疑似候选（待核实）：typescript -->',
    ].join('\n'));

    const report = await doctor.diagnose();
    const onboarding = report.issues.filter((issue) => issue.code === 'ONBOARDING_INCOMPLETE');

    expect(report.ok).toBe(true);
    expect(report.summary.errors).toBe(0);
    expect(onboarding).toHaveLength(2);
    expect(onboarding.every((issue) => issue.severity === 'warning')).toBe(true);

    await fs.write('.lrnev/PROJECT.md', '# demo\n\n已补全。\n');
    await fs.write('.lrnev/ARCHITECTURE.md', '# demo 架构\n\n已补全。\n');

    const clean = await doctor.diagnose();
    expect(clean.issues.some((issue) => issue.code === 'ONBOARDING_INCOMPLETE')).toBe(false);
  });

  it('应报告缺失标准目录', async () => {
    await fs.rm('.lrnev/memory/facts');
    const report = await doctor.diagnose();
    expect(report.issues.some((issue) => issue.code === 'MISSING_DIR')).toBe(true);
  });

  it('应报告 Spec 三文档缺失', async () => {
    const scene = await scenes.create({ name: 'user-management' });
    const spec = await specs.create({ scene: scene.data.id, name: 'user-login' });
    await fs.rm(`.lrnev/scenes/${scene.data.id}/specs/${spec.data.spec}/design.md`);

    const report = await doctor.diagnose();
    expect(report.issues.some((issue) => issue.code === 'SPEC_DOC_MISSING')).toBe(true);
  });

  it('应报告长时间 in_progress 的 Task', async () => {
    const scene = await scenes.create({ name: 'user-management' });
    const spec = await specs.create({ scene: scene.data.id, name: 'user-login' });
    await fs.write(
      `.lrnev/scenes/${scene.data.id}/specs/${spec.data.spec}/tasks.md`,
      [
        '## 任务',
        '',
        '### T-001 老任务 <!-- lrnev-task: status=in_progress, created=2026-01-01T00:00:00.000Z -->',
        '仍在执行',
      ].join('\n'),
    );

    const report = await doctor.diagnose();
    expect(report.issues.some((issue) => issue.code === 'STALE_TASK')).toBe(true);
  });

  it('F-08: in_progress 但无活跃 claim 应报告 STALE_TASK_CLAIM', async () => {
    const scene = await scenes.create({ name: 'user-management' });
    const spec = await specs.create({ scene: scene.data.id, name: 'user-login' });
    await fs.write(
      `.lrnev/scenes/${scene.data.id}/specs/${spec.data.spec}/tasks.md`,
      [
        '## 任务',
        '',
        '### T-001 无人 claim <!-- lrnev-task: status=in_progress, created=2026-06-03T00:00:00.000Z -->',
        '',
        '### T-002 有人 claim <!-- lrnev-task: status=in_progress, created=2026-06-03T00:00:00.000Z -->',
      ].join('\n'),
    );
    await new ClaimStore(fs).claim({
      scene: scene.data.id,
      spec: spec.data.spec,
      task: 'T-002',
      agent_id: 'agent-a',
    });

    const report = await doctor.diagnose();
    const issues = report.issues.filter((issue) => issue.code === 'STALE_TASK_CLAIM');

    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toContain('T-001');
  });

  it('应报告 ADR 编号冲突', async () => {
    await fs.write('.lrnev/decisions/adr/0001-a.md', '# A\n');
    await fs.write('.lrnev/decisions/adr/0001-b.md', '# B\n');

    const report = await doctor.diagnose();
    expect(report.issues.some((issue) => issue.code === 'ADR_NUMBER_CONFLICT')).toBe(true);
  });

  it('应报告损坏的 context 引用', async () => {
    await fs.write('.lrnev/PROJECT.md', '参考 context://scene/99-missing\n');

    const report = await doctor.diagnose();
    expect(report.issues.some((issue) => issue.code === 'BROKEN_CONTEXT_REF')).toBe(true);
  });

  it('F-02: 不应把 code block / inline code / 占位 context URI 当成真实引用', async () => {
    await fs.write(
      '.lrnev/PROJECT.md',
      [
        '# Demo',
        '',
        '`context://project` 只是示例。',
        '',
        '```md',
        'context://scene/99-missing',
        '```',
        '',
        '占位示例 context://scene/{id}/architecture 不应检查。',
      ].join('\n'),
    );

    const report = await doctor.diagnose();
    expect(report.issues.filter((issue) => issue.code === 'BROKEN_CONTEXT_REF')).toHaveLength(0);
  });

  it('F-02: 正文中的真实坏 context 引用仍会被识别', async () => {
    await fs.write('.lrnev/PROJECT.md', '正文引用 context://scene/99-missing\n');

    const report = await doctor.diagnose();
    const broken = report.issues.filter((issue) => issue.code === 'BROKEN_CONTEXT_REF');
    expect(broken).toHaveLength(1);
    expect(broken[0]?.message).toContain('context://scene/99-missing');
  });

  it('应精确迁移旧模板 TODO 占位且幂等', async () => {
    await fs.write(
      '.lrnev/legacy.md',
      [
        '# Legacy',
        '',
        '- TODO',
        '  - TODO',
        '- TODO with explanation',
        '',
        '#### F-01 TODO',
        '#### F-02 TODO with explanation',
        '',
        '- [ ] TODO',
        '- [ ] TODO with explanation',
        '',
        'TODO in normal body text should stay.',
        '<!-- FILL: already migrated -->',
        '',
      ].join('\n'),
    );

    const report = await doctor.migrateTodosToSentinels();

    expect(report.ok).toBe(true);
    expect(report.changed_files).toBe(1);
    expect(report.replacements).toBe(4);
    expect(report.files[0]?.path).toBe('.lrnev/legacy.md');

    const content = await fs.read('.lrnev/legacy.md');
    expect(content).toContain('- <!-- FILL: 旧 TODO 占位 -->');
    expect(content).toContain('  - <!-- FILL: 旧 TODO 占位 -->');
    expect(content).toContain('#### F-01 <!-- FILL: 功能标题 -->');
    expect(content).toContain('- [ ] <!-- FILL: 待填写验收标准 -->');
    expect(content).toContain('- TODO with explanation');
    expect(content).toContain('#### F-02 TODO with explanation');
    expect(content).toContain('- [ ] TODO with explanation');
    expect(content).toContain('TODO in normal body text should stay.');
    expect(content).toContain('<!-- FILL: already migrated -->');

    const second = await doctor.migrateTodosToSentinels();
    expect(second.changed_files).toBe(0);
    expect(second.replacements).toBe(0);
    expect(await fs.read('.lrnev/legacy.md')).toBe(content);
  });

  it('F-11: migrate-todos 不应修改 fenced/inline code 里的旧 TODO 字面量', async () => {
    await fs.write(
      '.lrnev/legacy-code.md',
      [
        '# Legacy Code',
        '',
        '`- TODO`',
        '',
        '```md',
        '- TODO',
        '- [ ] TODO',
        '#### F-01 TODO',
        '```',
        '',
        '- TODO',
      ].join('\n'),
    );

    const report = await doctor.migrateTodosToSentinels();
    const content = await fs.read('.lrnev/legacy-code.md');

    expect(report.replacements).toBe(1);
    expect(content).toContain('`- TODO`');
    expect(content).toContain(['```md', '- TODO', '- [ ] TODO', '#### F-01 TODO', '```'].join('\n'));
    expect(content).toContain('- <!-- FILL:');
  });

  it('应报告并清理旧式目录级摘要文件', async () => {
    await fs.write('.lrnev/.abstract.md', 'legacy project summary\n');
    await fs.write('.lrnev/scenes/00-default/.overview.md', 'legacy scene overview\n');
    await fs.write('.lrnev/.PROJECT.abstract.md', 'new project summary\n');
    await fs.write('.lrnev/PROJECT.md', '# demo\n');

    const report = await doctor.diagnose();
    const legacyIssues = report.issues.filter((issue) => issue.code === 'LEGACY_SUMMARY');

    expect(report.ok).toBe(true);
    expect(report.summary.errors).toBe(0);
    expect(legacyIssues).toHaveLength(2);
    expect(legacyIssues.every((issue) => issue.severity === 'warning')).toBe(true);
    expect(legacyIssues.map((issue) => issue.path)).toEqual([
      '.lrnev/.abstract.md',
      '.lrnev/scenes/00-default/.overview.md',
    ]);

    const migrated = await doctor.migrateLegacySummaries();

    expect(migrated.ok).toBe(true);
    expect(migrated.removed).toEqual([
      '.lrnev/.abstract.md',
      '.lrnev/scenes/00-default/.overview.md',
    ]);
    expect(migrated.removed_count).toBe(2);
    expect(fs.exists('.lrnev/.abstract.md')).toBe(false);
    expect(fs.exists('.lrnev/scenes/00-default/.overview.md')).toBe(false);
    expect(fs.exists('.lrnev/.PROJECT.abstract.md')).toBe(true);
    expect(await fs.read('.lrnev/PROJECT.md')).toBe('# demo\n');

    const clean = await doctor.diagnose();
    expect(clean.issues.some((issue) => issue.code === 'LEGACY_SUMMARY')).toBe(false);
  });

  it('F-07: hooks.json 配置错误应报告 HOOK_CONFIG_INVALID', async () => {
    await fs.writeJson('.lrnev/config/hooks.json', [{
      name: 'Bad Name',
      event: 'task.create',
      command: [],
    }]);

    const report = await doctor.diagnose();
    const hookIssue = report.issues.find((issue) => issue.code === 'HOOK_CONFIG_INVALID');

    expect(hookIssue).toBeDefined();
    expect(hookIssue?.severity).toBe('warning');
    expect(hookIssue?.path).toBe('.lrnev/config/hooks.json');
  });

  it('F-07: 字符串命令应报告 HOOK_SHELL_FORM info', async () => {
    await fs.writeJson('.lrnev/config/hooks.json', [{
      name: 'shell-form',
      event: 'task.create',
      command: 'echo hello',
    }]);

    const report = await doctor.diagnose();
    const shellIssue = report.issues.find((issue) => issue.code === 'HOOK_SHELL_FORM');

    expect(shellIssue).toBeDefined();
    expect(shellIssue?.severity).toBe('info');
    expect(shellIssue?.message).toContain('shell-form');
  });

  it('F-07: 连续 3 次 timeout 应报告 HOOK_CHRONIC_TIMEOUT warning', async () => {
    await writeHookRecords([
      hookRecord('slow-hook', 'timeout'),
      hookRecord('slow-hook', 'timeout'),
      hookRecord('slow-hook', 'timeout'),
    ]);

    const report = await doctor.diagnose();
    const timeoutIssue = report.issues.find((issue) => issue.code === 'HOOK_CHRONIC_TIMEOUT');

    expect(timeoutIssue).toBeDefined();
    expect(timeoutIssue?.severity).toBe('warning');
    expect(timeoutIssue?.message).toContain('slow-hook');
  });

  it('F-07: 连续 5 次非 success 应报告 HOOK_CHRONIC_FAILURE error', async () => {
    await writeHookRecords([
      hookRecord('flaky-hook', 'failed'),
      hookRecord('flaky-hook', 'failed'),
      hookRecord('flaky-hook', 'timeout'),
      hookRecord('flaky-hook', 'failed'),
      hookRecord('flaky-hook', 'failed'),
    ]);

    const report = await doctor.diagnose();
    const failureIssue = report.issues.find((issue) => issue.code === 'HOOK_CHRONIC_FAILURE');

    expect(report.ok).toBe(false);
    expect(failureIssue).toBeDefined();
    expect(failureIssue?.severity).toBe('error');
    expect(failureIssue?.message).toContain('flaky-hook');
  });

  it('F-07(agent): registry.json 损坏应报告 AGENT_REGISTRY_INVALID', async () => {
    await fs.write('.lrnev/agents/registry.json', '{bad json');

    const report = await doctor.diagnose();
    const issue = report.issues.find((item) => item.code === 'AGENT_REGISTRY_INVALID');

    expect(issue).toBeDefined();
    expect(issue?.severity).toBe('warning');
  });

  it('F-02: spec.file_size_warning_kb 配置应控制 Spec 文档大小警告', async () => {
    await fs.writeJson('.lrnev/config/lrnev.json', {
      spec: { file_size_warning_kb: 1 },
    });
    const scene = await scenes.create({ name: 'user-management' });
    const spec = await specs.create({ scene: scene.data.id, name: 'user-login' });
    await fs.write(
      `.lrnev/scenes/${scene.data.id}/specs/${spec.data.spec}/requirements.md`,
      `${'x'.repeat(1500)}\n`,
    );

    const report = await doctor.diagnose();

    expect(report.issues.some((issue) => issue.code === 'SPEC_DOC_TOO_LARGE')).toBe(true);
  });

  it('F-02: doctor.stale_lock_minutes 配置应控制陈旧目录锁诊断', async () => {
    await fs.writeJson('.lrnev/config/lrnev.json', {
      doctor: { stale_lock_minutes: 0 },
    });
    await fs.mkdir('.lrnev/locks/old.lockdir');

    const report = await doctor.diagnose();

    expect(report.issues.some((issue) => issue.code === 'STALE_DIRECTORY_LOCK')).toBe(true);
  });

  it('F-06: 同 host 且 pid 已不在世的 agent 应报 STALE_AGENT', async () => {
    await fs.writeJson(AGENT_REGISTRY_REL, {
      ghost: {
        agent_id: 'ghost',
        pid: 2 ** 30,
        host: hostname(),
        started_at: new Date().toISOString(),
        last_heartbeat: new Date().toISOString(),
        status: 'active',
      },
    });

    const report = await doctor.diagnose();

    expect(report.issues.some((issue) => issue.code === 'STALE_AGENT')).toBe(true);
  });

  it('F-06: 跨 host 的 agent 不应被 STALE_AGENT 误报(无法探 pid)', async () => {
    await fs.writeJson(AGENT_REGISTRY_REL, {
      remote: {
        agent_id: 'remote',
        pid: 2 ** 30,
        host: 'some-other-host',
        started_at: new Date().toISOString(),
        last_heartbeat: new Date().toISOString(),
        status: 'active',
      },
    });

    const report = await doctor.diagnose();

    expect(report.issues.some((issue) => issue.code === 'STALE_AGENT')).toBe(false);
  });

  it('F-06: 属主已死的未过期 claim 应报 ORPHAN_CLAIM', async () => {
    await fs.writeJson(AGENT_REGISTRY_REL, {
      ghost: {
        agent_id: 'ghost',
        pid: 2 ** 30,
        host: hostname(),
        started_at: new Date().toISOString(),
        last_heartbeat: new Date().toISOString(),
        status: 'active',
      },
    });
    await new ClaimStore(fs).claim({
      scene: '00-default',
      spec: '01-00-login',
      task: 'T-001',
      agent_id: 'ghost',
      ttl_seconds: 3600,
    });

    const report = await doctor.diagnose();

    expect(report.issues.some((issue) => issue.code === 'ORPHAN_CLAIM')).toBe(true);
  });

  async function writeHookRecords(records: Array<Record<string, unknown>>): Promise<void> {
    await fs.write('.lrnev/state/hook-log.jsonl', records.map((record) => JSON.stringify(record)).join('\n') + '\n');
  }

  function hookRecord(hook: string, status: 'success' | 'failed' | 'timeout'): Record<string, unknown> {
    return {
      ts: new Date().toISOString(),
      event: 'task.update.completed',
      hook,
      mode: 'sync',
      status,
      duration_ms: 1,
      exit_code: status === 'success' ? 0 : 1,
    };
  }
});
