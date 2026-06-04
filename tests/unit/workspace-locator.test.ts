/**
 * WorkspaceLocator 单元测试
 *
 * 覆盖 design.md 第 1.1 节"工作区根路径解析"三种查找方式：
 *   1. 环境变量 LRNEV_WORKSPACE
 *   2. 向上查找 .lrnev/
 *   3. 兜底当前目录
 *
 * + ensureWorkspace 幂等性
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { dir as tmpDir, type DirectoryResult } from 'tmp-promise';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  resolveWorkspaceRoot,
  ensureWorkspace,
} from '../../src/storage/WorkspaceLocator.js';
import { ENV_WORKSPACE, WORKSPACE_DIR } from '../../src/shared/paths.js';

describe('resolveWorkspaceRoot', () => {
  let workspace: DirectoryResult;
  let originalEnv: string | undefined;

  beforeEach(async () => {
    workspace = await tmpDir({ unsafeCleanup: true });
    originalEnv = process.env[ENV_WORKSPACE];
    delete process.env[ENV_WORKSPACE];
  });

  afterEach(async () => {
    if (originalEnv !== undefined) {
      process.env[ENV_WORKSPACE] = originalEnv;
    } else {
      delete process.env[ENV_WORKSPACE];
    }
    await workspace.cleanup();
  });

  it('环境变量 LRNEV_WORKSPACE 应优先于其他来源', () => {
    process.env[ENV_WORKSPACE] = workspace.path;
    // 即便 startDir 在别处也用 env
    const otherDir = process.cwd();
    const result = resolveWorkspaceRoot(otherDir);
    expect(result.source).toBe('env');
    expect(result.root).toBe(workspace.path);
  });

  it('环境变量存在但目录里没 .lrnev 时 exists=false', () => {
    process.env[ENV_WORKSPACE] = workspace.path;
    const result = resolveWorkspaceRoot();
    expect(result.exists).toBe(false);
  });

  it('环境变量存在且目录里有 .lrnev 时 exists=true', async () => {
    await mkdir(join(workspace.path, WORKSPACE_DIR));
    process.env[ENV_WORKSPACE] = workspace.path;
    const result = resolveWorkspaceRoot();
    expect(result.exists).toBe(true);
  });

  it('无环境变量时应向上查找 .lrnev/', async () => {
    // 构造已初始化 workspace/.lrnev/ + workspace/sub/deeper/
    await mkdir(join(workspace.path, WORKSPACE_DIR));
    await writeFile(join(workspace.path, WORKSPACE_DIR, 'PROJECT.md'), '# Demo\n');
    const deeper = join(workspace.path, 'sub', 'deeper');
    await mkdir(deeper, { recursive: true });

    const result = resolveWorkspaceRoot(deeper);
    expect(result.source).toBe('lookup');
    expect(result.root).toBe(workspace.path);
    expect(result.exists).toBe(true);
  });

  it('向上查找应能跨多级', async () => {
    await mkdir(join(workspace.path, WORKSPACE_DIR));
    await writeFile(join(workspace.path, WORKSPACE_DIR, 'PROJECT.md'), '# Demo\n');
    const deeper = join(workspace.path, 'a', 'b', 'c', 'd', 'e');
    await mkdir(deeper, { recursive: true });

    const result = resolveWorkspaceRoot(deeper);
    expect(result.source).toBe('lookup');
    expect(result.root).toBe(workspace.path);
  });

  it('F-08: 祖先有裸 .lrnev 但无 PROJECT.md 时不应向上吸附', async () => {
    await mkdir(join(workspace.path, WORKSPACE_DIR));
    const deeper = join(workspace.path, 'sub', 'deeper');
    await mkdir(deeper, { recursive: true });

    const result = resolveWorkspaceRoot(deeper);

    expect(result.source).toBe('cwd');
    expect(result.root).toBe(deeper);
    expect(result.exists).toBe(false);
  });

  it('找不到 .lrnev 应兜底为 startDir 且 exists=false', () => {
    // workspace 临时目录里没有 .lrnev
    const result = resolveWorkspaceRoot(workspace.path);
    expect(result.source).toBe('cwd');
    expect(result.exists).toBe(false);
  });

  it('环境变量为空字符串时应忽略（视为未设置）', () => {
    process.env[ENV_WORKSPACE] = '   ';
    const result = resolveWorkspaceRoot(workspace.path);
    expect(result.source).not.toBe('env');
  });
});

describe('ensureWorkspace', () => {
  let workspace: DirectoryResult;

  beforeEach(async () => {
    workspace = await tmpDir({ unsafeCleanup: true });
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  it('首次调用应返回 true 并创建完整目录骨架', async () => {
    const wasNew = await ensureWorkspace(workspace.path);
    expect(wasNew).toBe(true);

    const expectedDirs = [
      '.lrnev',
      '.lrnev/scenes',
      '.lrnev/decisions/adr',
      '.lrnev/errorbook',
      '.lrnev/errorbook/incidents',
      '.lrnev/errorbook/promoted',
      '.lrnev/memory',
      '.lrnev/memory/preferences',
      '.lrnev/memory/decisions',
      '.lrnev/memory/patterns',
      '.lrnev/memory/errors',
      '.lrnev/memory/facts',
      '.lrnev/steering',
      '.lrnev/auto',
      '.lrnev/config',
      '.lrnev/agents',
      '.lrnev/runtime',
      '.lrnev/runtime/claims',
      '.lrnev/locks',
      '.lrnev/state',
    ];
    for (const dir of expectedDirs) {
      expect(existsSync(join(workspace.path, dir))).toBe(true);
    }
  });

  it('应写入 state/version.json', async () => {
    await ensureWorkspace(workspace.path);
    const versionPath = join(workspace.path, '.lrnev', 'state', 'version.json');
    expect(existsSync(versionPath)).toBe(true);
    const content = JSON.parse(await readFile(versionPath, 'utf-8'));
    expect(content.lrnev_schema_version).toBe('1');
    expect(typeof content.created_at).toBe('string');
  });

  it('已存在时再次调用应返回 false（幂等）', async () => {
    await ensureWorkspace(workspace.path);
    const second = await ensureWorkspace(workspace.path);
    expect(second).toBe(false);
  });

  it('再次调用不应覆盖已有 version.json', async () => {
    await ensureWorkspace(workspace.path);
    const versionPath = join(workspace.path, '.lrnev', 'state', 'version.json');
    const before = `${JSON.stringify({
      lrnev_schema_version: '1',
      created_at: '2026-01-01T00:00:00.000Z',
    }, null, 2)}\n`;
    await writeFile(versionPath, before, 'utf-8');

    await ensureWorkspace(workspace.path);

    const after = await readFile(versionPath, 'utf-8');
    expect(after).toBe(before);
  });

  it('已存在但缺某个子目录时应补齐（容灾）', async () => {
    await ensureWorkspace(workspace.path);
    // 模拟用户误删 errorbook/incidents
    const incidents = join(workspace.path, '.lrnev', 'errorbook', 'incidents');
    await import('node:fs/promises').then((m) => m.rm(incidents, { recursive: true, force: true }));
    expect(existsSync(incidents)).toBe(false);

    await ensureWorkspace(workspace.path);
    expect(existsSync(incidents)).toBe(true);
  });

  it('应能在不存在的父路径下创建工作区', async () => {
    const nested = join(workspace.path, 'a', 'b', 'c');
    await mkdir(nested, { recursive: true });
    const wasNew = await ensureWorkspace(nested);
    expect(wasNew).toBe(true);
    expect(existsSync(join(nested, '.lrnev'))).toBe(true);
  });
});

describe('集成：resolveWorkspaceRoot + ensureWorkspace', () => {
  let workspace: DirectoryResult;
  let originalEnv: string | undefined;

  beforeEach(async () => {
    workspace = await tmpDir({ unsafeCleanup: true });
    originalEnv = process.env[ENV_WORKSPACE];
    delete process.env[ENV_WORKSPACE];
  });

  afterEach(async () => {
    if (originalEnv !== undefined) process.env[ENV_WORKSPACE] = originalEnv;
    else delete process.env[ENV_WORKSPACE];
    await workspace.cleanup();
  });

  it('首次定位 → 初始化 → 再次定位，应从 cwd 切换为 lookup', async () => {
    // 1. 首次定位（不存在）
    const first = resolveWorkspaceRoot(workspace.path);
    expect(first.source).toBe('cwd');
    expect(first.exists).toBe(false);

    // 2. 初始化
    await ensureWorkspace(first.root);
    await writeFile(join(first.root, '.lrnev', 'PROJECT.md'), '# Demo\n');

    // 3. 从子目录定位应找到根
    const deeper = join(workspace.path, 'src');
    await mkdir(deeper);
    const second = resolveWorkspaceRoot(deeper);
    expect(second.source).toBe('lookup');
    expect(second.exists).toBe(true);
    expect(second.root).toBe(workspace.path);
  });
});
