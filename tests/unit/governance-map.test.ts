/**
 * GovernanceMap 单元测试（02-00 F-01）。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { dir as tmpDir, type DirectoryResult } from 'tmp-promise';

import { FileStorage } from '../../src/storage/FileStorage.js';
import { ensureWorkspace } from '../../src/storage/WorkspaceLocator.js';
import { SceneManager } from '../../src/core/SceneManager.js';
import { SpecManager } from '../../src/core/SpecManager.js';
import { GovernanceMap } from '../../src/core/GovernanceMap.js';

describe('GovernanceMap', () => {
  let workspace: DirectoryResult;
  let fs: FileStorage;
  let scenes: SceneManager;
  let specs: SpecManager;
  let map: GovernanceMap;

  beforeEach(async () => {
    workspace = await tmpDir({ unsafeCleanup: true });
    await ensureWorkspace(workspace.path);
    fs = new FileStorage(workspace.path);
    scenes = new SceneManager(fs);
    specs = new SpecManager(fs, scenes);
    map = new GovernanceMap(fs, scenes);
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  it('F-01: 输出 scene→spec→锚点标题，含 status/L0，只含标题级（不含正文）', async () => {
    const scene = await scenes.create({ name: 'user-management' });
    const spec = await specs.create({ scene: scene.data.id, name: 'login' });
    await fs.write(
      `.lrnev/scenes/${scene.data.id}/specs/${spec.data.spec}/requirements.md`,
      '---\nstatus: ready\npriority: P0\n---\n\n# 登录 - 需求\n\n## L0 摘要\n\n打通登录与会话。\n\n## L2 详情\n\n#### F-01 记住我\n勾选记住我。\n\n#### F-02 短信验证\n发码。\n',
    );
    await fs.write(
      `.lrnev/scenes/${scene.data.id}/specs/${spec.data.spec}/design.md`,
      '# 设计\n\n#### D-01 会话存储\n用 redis。\n',
    );

    const res = await map.build();
    const mapped = res.data.scenes.find((s) => s.scene === scene.data.id);
    expect(mapped?.name).toBe('user-management');
    const sp = mapped?.specs.find((x) => x.spec === spec.data.spec);
    expect(sp?.status).toBe('ready');
    expect(sp?.priority).toBe('P0');
    expect(sp?.l0).toBe('打通登录与会话。');
    expect(sp?.anchors).toEqual(['#### F-01 记住我', '#### F-02 短信验证', '#### D-01 会话存储']);
    expect(sp?.anchors.join('\n')).not.toContain('勾选记住我');
  });

  it('空的 00-default 场景不出现在地图', async () => {
    const res = await map.build();
    expect(res.data.scenes.find((s) => s.scene === '00-default')).toBeUndefined();
  });

  it('L0 为占位/FILL 时不输出 l0', async () => {
    const scene = await scenes.create({ name: 'demo-scene' });
    const spec = await specs.create({ scene: scene.data.id, name: 'demo-spec' });
    const res = await map.build();
    const sp = res.data.scenes.flatMap((s) => s.specs).find((x) => x.spec === spec.data.spec);
    expect(sp).toBeDefined();
    expect(sp?.l0).toBeUndefined();
  });
});
