/**
 * 03-00 governance-report CLI e2e（T-005）。
 *
 * 覆盖输出形态：默认 text、--md、--json、--out 落盘、--scene、--md/--json 互斥、有债 exit 0。
 */

import { describe, expect, it } from 'vitest';
import { dir as tmpDir } from 'tmp-promise';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { buildCli } from '../../src/cli/index.js';

async function run(workspacePath: string, args: string[]): Promise<{ out: string; err: string }> {
  let out = '';
  let err = '';
  const program = buildCli({
    writeOut: (text) => { out += text; },
    writeErr: (text) => { err += text; },
  });
  await program.parseAsync(['node', 'lrnev', '--workspace', workspacePath, ...args]);
  return { out, err };
}

/** 建一个"做完没收口"的工作区：spec task 全完但 status=draft。 */
async function seed(workspacePath: string): Promise<void> {
  await run(workspacePath, ['init', '--project-name', 'rep']);
  await run(workspacePath, ['spec', 'create', 'login']);
  const { FileStorage } = await import('../../src/storage/FileStorage.js');
  const fs = new FileStorage(workspacePath);
  const specDir = '.lrnev/scenes/00-default/specs/01-00-login';
  await fs.write(`${specDir}/requirements.md`, [
    '---', "spec: '01-00-login'", "scene: '00-default'", 'status: draft', "created: '2026-06-01'", '---',
    '', '# 需求', '', '## L2 详情', '', '#### F-01 登录', '校验。', '',
  ].join('\n'));
  await fs.write(`${specDir}/tasks.md`, [
    '---', "spec: '01-00-login'", "scene: '00-default'", '---', '', '# 任务', '', '## 阶段 1', '',
    '### T-001 做登录 <!-- lrnev-task: status=completed, created=2026-06-01T00:00:00.000Z, validates=F-01 -->',
    '',
  ].join('\n'));
}

describe('report CLI e2e', () => {
  it('默认 text：含体检单标题、做完没收口、可执行下一步', async () => {
    const ws = await tmpDir({ unsafeCleanup: true });
    try {
      await seed(ws.path);
      const { out } = await run(ws.path, ['report']);
      expect(out).toContain('lrnev 治理体检');
      expect(out).toContain('做完没收口');
      expect(out).toContain('spec_gate_check');
      expect(out).toContain('① 链路完整度');
      expect(out).toContain('② validates 覆盖率');
    } finally {
      await ws.cleanup();
    }
  });

  it('--json：可 JSON.parse，含链路与覆盖率', async () => {
    const ws = await tmpDir({ unsafeCleanup: true });
    try {
      await seed(ws.path);
      const { out } = await run(ws.path, ['report', '--json']);
      const parsed = JSON.parse(out.trim());
      expect(parsed.ok).toBe(true);
      expect(parsed.data.chain.unclosed.length).toBe(1);
      expect(parsed.data.coverage.coverage_ratio).toBe(1);
    } finally {
      await ws.cleanup();
    }
  });

  it('--md：markdown 标题', async () => {
    const ws = await tmpDir({ unsafeCleanup: true });
    try {
      await seed(ws.path);
      const { out } = await run(ws.path, ['report', '--md']);
      expect(out).toContain('# lrnev 治理体检');
      expect(out).toContain('### 做完没收口');
    } finally {
      await ws.cleanup();
    }
  });

  it('--md --out：落盘到指定路径，且 stdout 仅提示；无 --out 不产文件', async () => {
    const ws = await tmpDir({ unsafeCleanup: true });
    try {
      await seed(ws.path);
      const outFile = join(ws.path, 'report.md');
      const { out } = await run(ws.path, ['report', '--md', '--out', outFile]);
      expect(out).toContain('已写入');
      const content = await readFile(outFile, 'utf-8');
      expect(content).toContain('# lrnev 治理体检');
      // 无 --out：直接打 stdout、不提示落盘
      const { out: out2 } = await run(ws.path, ['report']);
      expect(out2).not.toContain('已写入');
      expect(out2).toContain('lrnev 治理体检');
    } finally {
      await ws.cleanup();
    }
  });

  it('--scene：只含该 scene', async () => {
    const ws = await tmpDir({ unsafeCleanup: true });
    try {
      await seed(ws.path);
      const { out } = await run(ws.path, ['report', '--scene', '00-default', '--json']);
      const parsed = JSON.parse(out.trim());
      expect(parsed.data.scope).toBe('00-default');
    } finally {
      await ws.cleanup();
    }
  });

  it('--md 与 --json 互斥 → 结构化 INVALID_INPUT', async () => {
    const ws = await tmpDir({ unsafeCleanup: true });
    try {
      await seed(ws.path);
      const { err } = await run(ws.path, ['report', '--md', '--json']);
      const parsed = JSON.parse(err.trim());
      expect(parsed.ok).toBe(false);
      expect(parsed.errors[0].code).toBe('INVALID_INPUT');
    } finally {
      await ws.cleanup();
    }
  });
});
