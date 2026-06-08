/**
 * 03 governance hardening trial-run 回归。
 *
 * 覆盖 docs/03-GOVERNANCE-HARDENING-TRIAL-RUN.md 第 1 节的关键链路：
 * init -> spec create -> ready gate -> task/child task -> completion -> status/doctor。
 */

import { describe, expect, it } from 'vitest';
import { dir as tmpDir } from 'tmp-promise';

import { buildCli } from '../../src/cli/index.js';
import type { GateResult } from '../../src/types/gate.js';

describe('governance hardening fixes e2e', () => {
  it('trial-run 核心链路不再触发已知 governance 问题', async () => {
    const workspace = await tmpDir({ unsafeCleanup: true });
    try {
      const init = await runCli(workspace.path, ['init', '--project-name', 'trial-app']);
      expect(init.ok).toBe(true);
      expect(init.data.was_new).toBe(true);

      const withPriority = await runCli(workspace.path, ['spec', 'create', 'user-login', '--priority', 'P1']);
      const creation = await runCli(workspace.path, [
        'gate',
        'check',
        '--scene',
        '00-default',
        '--spec',
        withPriority.data.spec,
        '--gate',
        'creation',
      ]) as GateResult;
      expect(creation.checks.find((check) => check.name === 'frontmatter_created')?.passed).toBe(true);

      const noPriority = await runCli(workspace.path, ['spec', 'create', 'no-priority']);
      const noPrioritySpec = await runCli(workspace.path, [
        'spec',
        'get',
        '--scene',
        '00-default',
        noPriority.data.spec,
      ]);
      expect(noPrioritySpec.priority).toBeUndefined();

      await writeReadyRequirements(
        workspace.path,
        '00-default',
        noPriority.data.spec,
        { checked: false },
      );
      const ready = await runCli(workspace.path, [
        'gate',
        'check',
        '--scene',
        '00-default',
        '--spec',
        noPriority.data.spec,
        '--gate',
        'ready',
      ]) as GateResult;
      const acceptanceCheck = ready.checks.find((check) => check.name === 'requirements_acceptance_checked');
      expect(ready.passed).toBe(true);
      expect(acceptanceCheck?.passed).toBe(false);
      expect(acceptanceCheck?.hard_fail).toBe(false);

      const parent = await runCli(workspace.path, [
        'task',
        'create',
        '--scene',
        '00-default',
        '--spec',
        noPriority.data.spec,
        '实现登录拆分主任务',
      ]);
      const childA = await runCli(workspace.path, [
        'task',
        'create',
        '--scene',
        '00-default',
        '--spec',
        noPriority.data.spec,
        '--parent',
        parent.data.id,
        '前端登录表单',
      ]);
      const childB = await runCli(workspace.path, [
        'task',
        'create',
        '--scene',
        '00-default',
        '--spec',
        noPriority.data.spec,
        '--parent',
        parent.data.id,
        '后端登录 API',
      ]);
      const dashTitle = await runCli(workspace.path, [
        'task',
        'create',
        '--scene',
        '00-default',
        '--spec',
        noPriority.data.spec,
        '--scan 改占位',
      ]);
      expect(dashTitle.data.title).toBe('--scan 改占位');

      const taskList = await runCli(workspace.path, [
        'task',
        'list',
        '--scene',
        '00-default',
        '--spec',
        noPriority.data.spec,
      ]);
      const listedParent = taskList.data.find((task: { id: string }) => task.id === parent.data.id);
      expect(listedParent.children.map((task: { id: string }) => task.id)).toEqual([
        childA.data.id,
        childB.data.id,
      ]);
      expect(taskList.ai_followup.instructions.join('\n')).toContain('全量平铺');

      for (const id of [parent.data.id, childA.data.id, childB.data.id, dashTitle.data.id]) {
        await runCli(workspace.path, [
          'task',
          'update',
          '--scene',
          '00-default',
          '--spec',
          noPriority.data.spec,
          '--status',
          'in_progress',
          id,
        ]);
        await runCli(workspace.path, [
          'task',
          'update',
          '--scene',
          '00-default',
          '--spec',
          noPriority.data.spec,
          '--status',
          'completed',
          id,
        ]);
      }

      const completion = await runCli(workspace.path, [
        'gate',
        'check',
        '--scene',
        '00-default',
        '--spec',
        noPriority.data.spec,
        '--gate',
        'completion',
      ]) as GateResult;
      expect(completion.passed).toBe(true);

      const scanHelp = helpFor(['init']);
      expect(scanHelp).toContain('占位');

      const goal = await runCli(workspace.path, ['goal', 'assess', '实现用户登录']);
      expect(goal.ok).toBe(true);
      const hooks = await runCli(workspace.path, ['hook', 'list']);
      expect(hooks.data.implemented).toBe(true);
      expect(hooks.data.hooks).toEqual([]);

      const status = await runCli(workspace.path, ['status']);
      expect(status.data.scenes).toHaveLength(1);
      expect(status.data.specs.length).toBeGreaterThanOrEqual(2);

      const doctor = await runCli(workspace.path, ['doctor']);
      expect(doctor.summary.errors).toBe(0);
      expect(doctor.summary.warnings).toBe(2);
      expect(doctor.issues.map((issue: { code: string }) => issue.code)).toEqual(
        expect.arrayContaining(['ONBOARDING_INCOMPLETE']),
      );
    } finally {
      await workspace.cleanup();
    }
  });
});

async function runCli(workspacePath: string, args: string[]): Promise<any> {
  let out = '';
  let err = '';
  const program = buildCli({
    writeOut: (text) => { out += text; },
    writeErr: (text) => { err += text; },
  });
  await program.parseAsync(['node', 'lrnev', '--workspace', workspacePath, '--json', ...args]);
  if (!out.trim()) {
    throw new Error(err.trim() || `CLI command produced no output: ${args.join(' ')}`);
  }
  return JSON.parse(out.trim().split(/\n(?=\{|\[)/).at(-1)!);
}

function helpFor(args: string[]): string {
  const program = buildCli();
  let command = program;
  for (const name of args) {
    const next = command.commands.find((candidate) => candidate.name() === name);
    if (!next) throw new Error(`Command not found: ${name}`);
    command = next;
  }
  return command.helpInformation();
}

async function writeReadyRequirements(
  root: string,
  sceneId: string,
  specId: string,
  opts: { checked: boolean },
): Promise<void> {
  const { FileStorage } = await import('../../src/storage/FileStorage.js');
  const fs = new FileStorage(root);
  await fs.write(`.lrnev/scenes/${sceneId}/specs/${specId}/requirements.md`, [
    '---',
    `spec: '${specId}'`,
    `scene: '${sceneId}'`,
    'status: draft',
    "created: '2026-06-01'",
    '---',
    '',
    '# No Priority - 需求',
    '',
    '## L0 摘要',
    '',
    '登录能力需求完整。',
    '',
    '## L1 概览',
    '',
    '### 目标',
    '',
    '用户可以登录。',
    '',
    '### 用户故事',
    '',
    '- 作为用户，我希望登录，以便访问系统。',
    '',
    '### 范围',
    '',
    '**包含**：',
    '- 邮箱密码登录。',
    '',
    '**不包含**：',
    '- 第三方登录。',
    '',
    '## L2 详情',
    '',
    '### 详细需求',
    '',
    '#### F-01 Login',
    '',
    '- 校验用户名和密码。',
    '',
    '### 非功能性需求',
    '',
    '- 性能：不新增性能风险。',
    '',
    '### 边界与依赖',
    '',
    '- 无外部依赖。',
    '',
    '### 验收标准',
    '',
    `- [${opts.checked ? 'x' : ' '}] 登录成功返回 session。`,
    '',
  ].join('\n'));
}
