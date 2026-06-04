/**
 * 配置层单元测试。
 *
 * 覆盖默认配置、用户部分覆盖、深度合并、数组替换、坏 JSON、类型不匹配回退。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { dir as tmpDir, type DirectoryResult } from 'tmp-promise';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  loadConfig,
  mergeConfig,
  DEFAULT_CONFIG,
  CONFIG_FILE_REL,
} from '../../src/shared/config.js';
import { isLrnevError } from '../../src/shared/errors.js';

describe('DEFAULT_CONFIG', () => {
  it('应导出完整结构', () => {
    expect(DEFAULT_CONFIG.lock.directory_lock_retries).toBeGreaterThan(0);
    expect(DEFAULT_CONFIG.lock.directory_lock_delay_ms).toBeGreaterThan(0);
    expect(DEFAULT_CONFIG.doctor.stale_task_days).toBeGreaterThan(0);
    expect(DEFAULT_CONFIG.search.max_depth).toBeGreaterThan(0);
    expect(DEFAULT_CONFIG.search.snippet_length).toBeGreaterThan(0);
    expect(DEFAULT_CONFIG.auto_analyzer.max_manifest_depth).toBeGreaterThan(0);
    expect(DEFAULT_CONFIG.auto_analyzer.max_sample_files).toBeGreaterThan(0);
    expect(Array.isArray(DEFAULT_CONFIG.auto_analyzer.ignore_dirs)).toBe(true);
    expect(DEFAULT_CONFIG.errorbook.fingerprint_length).toBeGreaterThan(0);
    expect(DEFAULT_CONFIG.memory.dedup_similarity_threshold).toBeGreaterThan(0);
    expect(DEFAULT_CONFIG.spec.create_max_attempts).toBe(10);
    expect(DEFAULT_CONFIG.scene.create_max_attempts).toBe(10);
    expect(DEFAULT_CONFIG.project_status.recent_limit).toBe(5);
    expect(DEFAULT_CONFIG.project_status.claimable_preview).toBe(5);
    expect(DEFAULT_CONFIG.claim.default_ttl_seconds).toBeGreaterThan(0);
    expect(DEFAULT_CONFIG.claim.max_ttl_seconds).toBeGreaterThan(DEFAULT_CONFIG.claim.default_ttl_seconds);
    expect(DEFAULT_CONFIG.hooks.default_timeout_ms).toBeGreaterThan(0);
    expect(DEFAULT_CONFIG.storage.frontmatter_read_bytes).toBeGreaterThan(0);
  });
});

describe('loadConfig', () => {
  let workspace: DirectoryResult;

  beforeEach(async () => {
    workspace = await tmpDir({ unsafeCleanup: true });
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  it('无用户配置时应返回默认配置副本', () => {
    const cfg = loadConfig(workspace.path);
    expect(cfg).toEqual(DEFAULT_CONFIG);
    expect(cfg).not.toBe(DEFAULT_CONFIG);
  });

  it('部分覆盖应深度合并', async () => {
    await writeUserConfig(workspace.path, {
      claim: { default_ttl_seconds: 60 },
      search: { max_depth: 5 },
    });
    const cfg = loadConfig(workspace.path);

    expect(cfg.claim.default_ttl_seconds).toBe(60);
    expect(cfg.search.max_depth).toBe(5);
    expect(cfg.claim.max_ttl_seconds).toBe(DEFAULT_CONFIG.claim.max_ttl_seconds);
    expect(cfg.search.top_k).toBe(DEFAULT_CONFIG.search.top_k);
    expect(cfg.memory).toEqual(DEFAULT_CONFIG.memory);
  });

  it('数组应整体替换而不是合并', async () => {
    await writeUserConfig(workspace.path, {
      auto_analyzer: { ignore_dirs: ['vendor'] },
    });
    const cfg = loadConfig(workspace.path);

    expect(cfg.auto_analyzer.ignore_dirs).toEqual(['vendor']);
    expect(cfg.auto_analyzer.max_sample_files).toBe(DEFAULT_CONFIG.auto_analyzer.max_sample_files);
  });

  it('user override 含 null 应回退默认值', async () => {
    await writeUserConfig(workspace.path, {
      claim: { default_ttl_seconds: null },
    });
    const cfg = loadConfig(workspace.path);

    expect(cfg.claim.default_ttl_seconds).toBe(DEFAULT_CONFIG.claim.default_ttl_seconds);
  });

  it('类型不匹配时应保留默认值', async () => {
    await writeUserConfig(workspace.path, {
      claim: { default_ttl_seconds: 'forever' },
    });
    const cfg = loadConfig(workspace.path);

    expect(cfg.claim.default_ttl_seconds).toBe(DEFAULT_CONFIG.claim.default_ttl_seconds);
  });

  it('多余字段应被忽略', async () => {
    await writeUserConfig(workspace.path, {
      claim: { default_ttl_seconds: 99 },
      unknown_section: { foo: 'bar' },
    });
    const cfg = loadConfig(workspace.path);

    expect(cfg.claim.default_ttl_seconds).toBe(99);
    expect('unknown_section' in cfg).toBe(false);
  });

  it('应接受带 UTF-8 BOM 的用户配置 JSON', async () => {
    const cfgPath = join(workspace.path, CONFIG_FILE_REL);
    await mkdir(join(workspace.path, '.lrnev', 'config'), { recursive: true });
    await writeFile(cfgPath, '\ufeff{"claim":{"default_ttl_seconds":66}}', 'utf-8');

    const cfg = loadConfig(workspace.path);

    expect(cfg.claim.default_ttl_seconds).toBe(66);
  });

  it('损坏的 JSON 应抛 LrnevError', async () => {
    const cfgPath = join(workspace.path, CONFIG_FILE_REL);
    await mkdir(join(workspace.path, '.lrnev', 'config'), { recursive: true });
    await writeFile(cfgPath, '{ not valid', 'utf-8');

    try {
      loadConfig(workspace.path);
      expect.fail();
    } catch (err) {
      expect(isLrnevError(err)).toBe(true);
    }
  });

  it('非对象顶层应被忽略并返回默认配置', async () => {
    const cfgPath = join(workspace.path, CONFIG_FILE_REL);
    await mkdir(join(workspace.path, '.lrnev', 'config'), { recursive: true });
    await writeFile(cfgPath, '[]', 'utf-8');

    const cfg = loadConfig(workspace.path);
    expect(cfg).toEqual(DEFAULT_CONFIG);
  });
});

describe('mergeConfig', () => {
  it('完全空覆盖应得到默认副本', () => {
    const m = mergeConfig(DEFAULT_CONFIG, {});
    expect(m).toEqual(DEFAULT_CONFIG);
    expect(m).not.toBe(DEFAULT_CONFIG);
  });

  it('深度嵌套合并', () => {
    const m = mergeConfig(DEFAULT_CONFIG, {
      search: { max_depth: 99, use_l0_ranking: false },
      spec: { create_max_attempts: 2 },
      scene: { create_max_attempts: 3 },
      project_status: { recent_limit: 1, claimable_preview: 2 },
      hooks: { health_scan_limit: 7 },
      storage: { frontmatter_read_bytes: 128 },
    });

    expect(m.search.max_depth).toBe(99);
    expect(m.search.use_l0_ranking).toBe(false);
    expect(m.search.top_k).toBe(DEFAULT_CONFIG.search.top_k);
    expect(m.spec.create_max_attempts).toBe(2);
    expect(m.spec.file_size_warning_kb).toBe(DEFAULT_CONFIG.spec.file_size_warning_kb);
    expect(m.scene.create_max_attempts).toBe(3);
    expect(m.project_status.recent_limit).toBe(1);
    expect(m.project_status.claimable_preview).toBe(2);
    expect(m.hooks.health_scan_limit).toBe(7);
    expect(m.storage.frontmatter_read_bytes).toBe(128);
  });
});

async function writeUserConfig(root: string, data: unknown): Promise<void> {
  const dir = join(root, '.lrnev', 'config');
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'lrnev.json'), JSON.stringify(data, null, 2), 'utf-8');
}
