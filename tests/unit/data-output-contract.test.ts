/**
 * 03-00-mcp-response-conformance —— 输出契约回归测试（T-027 F-04 #3 正式修复）
 *
 * 背景：真实客户端（opencode 等）严格校验 structuredContent 与 tools/list 广告的
 * outputSchema 一致（JSON Schema additionalProperties:false）。两个历史缺陷形态：
 *   A. Manager 读路径 `...parsed.frontmatter` 全展开 → 用户 frontmatter 的 schema 外键
 *      泄漏进 data（-32602 additional properties）；
 *   B. 工具注册的 outputSchema 与 handler 真实返回形状错配（task_create_many 注册成数组、
 *      task_release/memory_forget 等复用 SimpleConfirmationDataSchema 等）。
 *
 * 本文件守护契约：Manager 返回对象必须能被对应 DataSchema「严格解析」——即
 *   safeParse 成功（类型正确、必填齐全），且解析后 JSON 与原对象逐字节相等
 *   （zod 默认会剥离未声明键，若出现剥离即说明存在 additional properties 泄漏）。
 * 覆盖：SceneManager list/get、SpecManager get/updateStatus、ADRManager get/list、
 * MemoryManager save/search、TaskManager createMany/update/claim/release。
 *
 * 红线：本文件不改 .lrnev/ 与 t027-baseline/.evidences/，只读 manager + schema。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { dir as tmpDir, type DirectoryResult } from 'tmp-promise';

import { FileStorage } from '../../src/storage/FileStorage.js';
import { ensureWorkspace } from '../../src/storage/WorkspaceLocator.js';
import { SceneManager } from '../../src/core/SceneManager.js';
import { SpecManager } from '../../src/core/SpecManager.js';
import { ADRManager } from '../../src/core/ADRManager.js';
import { MemoryManager } from '../../src/core/MemoryManager.js';
import { TaskManager } from '../../src/core/TaskManager.js';

import {
  SceneDataSchema,
  SpecDataSchema,
  ADRDataSchema,
  MemoryDataSchema,
  TaskDataSchema,
  TaskClaimResultSchema,
  TaskClaimReleaseResultSchema,
  CreateManyTasksResultSchema,
  MemoryForgetResultSchema,
} from '../../src/mcp/types/output-schemas.js';

interface Parseable {
  parse: (value: unknown) => unknown;
}

/**
 * 严格契约断言：value 必须能被 schema 解析，且解析结果与原对象深度相等。
 *
 * zod 的 object 默认会剥离未声明键（等价于客户端 additionalProperties:false 的
 * 拒绝语义）；若 value 含任何 schema 外键，parse 输出会比输入少键，toEqual 即失败
 * ——这正是真实客户端报 -32602 的服务器侧镜像。类型/必填错误由 parse 抛错拦截。
 * （不用 JSON.stringify 比较：zod 输出按键声明顺序重建对象，比较对键序敏感。）
 */
function expectStrictSchemaMatch(schema: Parseable, value: unknown, label: string): void {
  const result = schema.parse(value);
  expect(result, `${label} 存在 schema 外键或类型/结构漂移`).toEqual(value);
}

describe('03-00 输出契约：Manager 返回可被 DataSchema 严格解析（T-027 修复）', () => {
  let workspace: DirectoryResult;
  let fs: FileStorage;
  let scenes: SceneManager;
  let specs: SpecManager;
  let adrs: ADRManager;
  let memories: MemoryManager;
  let tasks: TaskManager;

  beforeEach(async () => {
    workspace = await tmpDir({ unsafeCleanup: true });
    await ensureWorkspace(workspace.path);
    fs = new FileStorage(workspace.path);
    scenes = new SceneManager(fs);
    specs = new SpecManager(fs, scenes);
    adrs = new ADRManager(fs, scenes);
    memories = new MemoryManager(fs, scenes);
    tasks = new TaskManager(fs, scenes, specs);
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  /** 在 frontmatter 顶部注入一条 schema 外键（复刻 harness fixture 的 `scene:` 泄漏）。 */
  async function injectFrontmatterKey(relPath: string, keyLine: string): Promise<void> {
    const content = await fs.read(relPath);
    const patched = content.startsWith('---\n')
      ? content.replace('---\n', `---\n${keyLine}\n`)
      : `---\n${keyLine}\n${content}`;
    await fs.write(relPath, patched);
  }

  describe('SceneManager', () => {
    it('get/list：即便 scene.md frontmatter 含 schema 外键，返回也只含 SceneDataSchema 声明键', async () => {
      const created = await scenes.create({ name: 'user-management', intent: '用户域' });
      const scenePath = `.lrnev/scenes/${created.data.id}/scene.md`;
      // 复刻 t027 基线 fixture 曾写入的 `scene: <id>` 外键（T-027 F-04 发现 #3 形态 A）
      await injectFrontmatterKey(scenePath, `scene: ${created.data.id}`);
      await injectFrontmatterKey(scenePath, 'unrelated_note: leaked');

      const got = await scenes.get('user-management');
      expectStrictSchemaMatch(SceneDataSchema, got, 'SceneManager.get');
      // 泄漏键必须被裁剪
      expect(got).not.toHaveProperty('scene');
      expect(got).not.toHaveProperty('unrelated_note');

      const listed = await scenes.list();
      expect(listed.length).toBeGreaterThan(0);
      for (const item of listed) {
        expectStrictSchemaMatch(SceneDataSchema, item, 'SceneManager.list item');
      }
    });
  });

  describe('SpecManager', () => {
    it('get：requirements.md frontmatter 含 schema 外键时返回仍只含 SpecDataSchema 声明键', async () => {
      await scenes.create({ name: 'user-management' });
      const created = await specs.create({ scene: 'user-management', name: 'user-login', priority: 'P1' });
      const reqPath = `.lrnev/scenes/${created.data.scene}/specs/${created.data.spec}/requirements.md`;
      await injectFrontmatterKey(reqPath, 'scene_note: leaked');
      await injectFrontmatterKey(reqPath, 'legacy_flag: true');

      const got = await specs.get('user-management', 'user-login');
      expectStrictSchemaMatch(SpecDataSchema, got, 'SpecManager.get');
      expect(got).not.toHaveProperty('scene_note');
      expect(got).not.toHaveProperty('legacy_flag');

      const listed = await specs.list('user-management');
      for (const item of listed) {
        expectStrictSchemaMatch(SpecDataSchema, item, 'SpecManager.list item');
      }
    });

    it('updateStatus：写回 round-trip 保留自定义键，读边界剪裁；返回可被严格解析', async () => {
      await scenes.create({ name: 'user-management' });
      await specs.create({ scene: 'user-management', name: 'user-login' });
      const reqPath = '.lrnev/scenes/01-user-management/specs/01-00-user-login/requirements.md';
      await injectFrontmatterKey(reqPath, 'stray_key: keep-out');

      const updated = await specs.updateStatus('user-management', 'user-login', 'ready');
      expectStrictSchemaMatch(SpecDataSchema, updated.data, 'SpecManager.updateStatus.data');

      // 写路径 round-trip（DeepSeek 裁决 2026-09-04）：spec_update 只覆盖 status/updated，
      // 用户自定义键必须保留在磁盘（不毁数据）；泄漏防护只在读边界（get 白名单）。
      const onDisk = await fs.read(reqPath);
      expect(onDisk).toContain('status: ready');
      expect(onDisk).toContain('stray_key: keep-out');

      const after = await specs.get('user-management', 'user-login');
      expectStrictSchemaMatch(SpecDataSchema, after, 'SpecManager.get after update');
      // 读边界剪裁：自定义键不进返回对象
      expect(after).not.toHaveProperty('stray_key');
    });
  });

  describe('ADRManager', () => {
    it('create/get/list：返回 ADR 含嵌套 body，ADRDataSchema 严格可解析（含 superseded_by 派生）', async () => {
      const first = await adrs.create({
        title: 'Decision one',
        scope: 'global',
        context: '背景一',
        decision: '决策一',
        alternatives: ['备选一'],
        consequences: '后果一',
      });
      expectStrictSchemaMatch(ADRDataSchema, first.data, 'ADRManager.create.data');

      await adrs.create({
        title: 'Decision two',
        scope: 'global',
        context: '背景二',
        decision: '决策二',
        supersedes: ['1'],
      });

      const got = await adrs.get('global', '1');
      expectStrictSchemaMatch(ADRDataSchema, got, 'ADRManager.get');
      // superseded_by 是读时派生字段，应在 schema 声明内
      expect(got.superseded_by).toEqual(['0002']);

      const listed = await adrs.list('global');
      expect(listed.length).toBe(2);
      for (const item of listed) {
        expectStrictSchemaMatch(ADRDataSchema, item, 'ADRManager.list item');
      }
    });
  });

  describe('MemoryManager', () => {
    it('save/search：记忆 frontmatter 含外键时返回仍只含 MemoryDataSchema 声明键', async () => {
      const saved = await memories.save({
        category: 'facts',
        content: '项目源码在 product/lrnev-govern。',
        source: 'workspace',
        scope: 'global',
        tentative: false,
      });
      expectStrictSchemaMatch(MemoryDataSchema, saved.data, 'MemoryManager.save.data');

      // 篡改落盘文件注入外键，随后 search 走 readMemory 读回
      const savedPath = (saved.data.path as string).replace(fs.root, '').replace(/^[\\/]/, '');
      await injectFrontmatterKey(savedPath, 'scene: 01-user-management');
      await injectFrontmatterKey(savedPath, 'extra_note: leaked');

      const results = await memories.search({ query: 'lrnev-govern', scope: 'global' });
      expect(results.length).toBe(1);
      for (const item of results) {
        expectStrictSchemaMatch(MemoryDataSchema, item, 'MemoryManager.search item');
      }
      expect(results[0]).not.toHaveProperty('scene');
      expect(results[0]).not.toHaveProperty('extra_note');

      // memory_forget data 形状 { id, deleted }（T-027：不再复用 SimpleConfirmationDataSchema）
      const forgotten = await memories.forget({
        id: saved.data.id,
        category: 'facts',
        scope: 'global',
      });
      expectStrictSchemaMatch(MemoryForgetResultSchema, forgotten.data, 'MemoryManager.forget.data');
    });
  });

  describe('TaskManager', () => {
    it('createMany/update/claim/release 返回形状与对应 schema 严格一致（形态 B 修复）', async () => {
      await scenes.create({ name: 'user-management' });
      await specs.create({ scene: 'user-management', name: 'user-login' });

      const many = await tasks.createMany({
        scene: 'user-management',
        spec: 'user-login',
        tasks: [{ title: '建模' }, { title: '接口' }],
      });
      // task_create_many 的 data 是 { created, count } 对象，不是 Task 数组
      expectStrictSchemaMatch(CreateManyTasksResultSchema, many.data, 'TaskManager.createMany.data');
      expect(many.data.created.map((t: { id: string }) => t.id)).toEqual(['T-001', 'T-002']);

      const updated = await tasks.update({
        scene: 'user-management',
        spec: 'user-login',
        task_id: 'T-001',
        status: 'in_progress',
        agent_id: 'agent-a',
      });
      expectStrictSchemaMatch(TaskDataSchema, updated.data, 'TaskManager.update.data');

      const claimed = await tasks.claim({
        scene: 'user-management',
        spec: 'user-login',
        task: 'T-001',
        agent_id: 'agent-a',
      });
      expectStrictSchemaMatch(TaskClaimResultSchema, claimed.data, 'TaskManager.claim.data');

      const released = await tasks.releaseClaim({
        scene: 'user-management',
        spec: 'user-login',
        task: 'T-001',
        agent_id: 'agent-a',
      });
      expectStrictSchemaMatch(TaskClaimReleaseResultSchema, released.data, 'TaskManager.releaseClaim.data');
    });
  });
});
