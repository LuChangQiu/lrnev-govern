/**
 * SpecManager 集成测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { dir as tmpDir, type DirectoryResult } from 'tmp-promise';
import { FileStorage } from '../../src/storage/FileStorage.js';
import { ensureWorkspace } from '../../src/storage/WorkspaceLocator.js';
import { DEFAULT_SCENE_ID, SceneManager } from '../../src/core/SceneManager.js';
import {
  SpecManager,
  formatSpecId,
  parseSpecParts,
} from '../../src/core/SpecManager.js';
import { today } from '../../src/core/Templates.js';
import { ErrorCode, isLrnevError } from '../../src/shared/errors.js';

describe('SpecManager', () => {
  let workspace: DirectoryResult;
  let fs: FileStorage;
  let scenes: SceneManager;
  let specs: SpecManager;

  beforeEach(async () => {
    workspace = await tmpDir({ unsafeCleanup: true });
    await ensureWorkspace(workspace.path);
    fs = new FileStorage(workspace.path);
    scenes = new SceneManager(fs);
    specs = new SpecManager(fs, scenes);
    await scenes.create({ name: 'user-management' });
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  describe('辅助函数', () => {
    it('formatSpecId 应正确拼接', () => {
      expect(formatSpecId(1, 0, 'user-login')).toBe('01-00-user-login');
      expect(formatSpecId(12, 3, 'feat')).toBe('12-03-feat');
    });

    it('formatSpecId 应拒绝超出两位约定的序号或版本', () => {
      expect(() => formatSpecId(100, 0, 'too-high')).toThrow();
      expect(() => formatSpecId(1, 100, 'too-high')).toThrow();
    });

    it('parseSpecParts 应正确拆分', () => {
      expect(parseSpecParts('01-00-user-login')).toEqual({
        number: 1,
        version: 0,
        name: 'user-login',
      });
      expect(parseSpecParts('12-03-name-with-dash')).toEqual({
        number: 12,
        version: 3,
        name: 'name-with-dash',
      });
    });

    it('parseSpecParts 应拒绝畸形目录名而不是返回 number 0', () => {
      for (const id of ['bad-name', '1-0-name', '01-000-name', '00-00-name', '01-00-bad_name']) {
        try {
          parseSpecParts(id);
          expect.fail(`应拒绝 ${id}`);
        } catch (err) {
          expect(isLrnevError(err)).toBe(true);
          if (isLrnevError(err)) {
            expect(err.code).toBe(ErrorCode.INVALID_INPUT);
          }
        }
      }
    });
  });

  describe('create', () => {
    it('should create a Spec under the default Scene when scene is omitted', async () => {
      const r = await specs.create({ name: 'quick-feature' });

      expect(r.ok).toBe(true);
      expect(r.data.scene).toBe(DEFAULT_SCENE_ID);
      expect(r.data.spec).toBe('01-00-quick-feature');
      expect(fs.exists(`.lrnev/scenes/${DEFAULT_SCENE_ID}/scene.md`)).toBe(true);
      expect(fs.exists(`.lrnev/scenes/${DEFAULT_SCENE_ID}/specs/${r.data.spec}/requirements.md`)).toBe(true);
    });

    it('首次创建应分配序号 01-00', async () => {
      const r = await specs.create({ scene: 'user-management', name: 'user-login' });
      expect(r.ok).toBe(true);
      expect(r.data.spec).toBe('01-00-user-login');
      expect(r.data.number).toBe(1);
      expect(r.data.version).toBe(0);
      expect(r.data.name).toBe('user-login');
      expect(r.data.scene).toBe('01-user-management');
    });

    it('应生成三份文档', async () => {
      const r = await specs.create({ scene: 'user-management', name: 'user-login' });
      const dir = `.lrnev/scenes/${r.data.scene}/specs/${r.data.spec}`;
      expect(fs.exists(`${dir}/requirements.md`)).toBe(true);
      expect(fs.exists(`${dir}/design.md`)).toBe(true);
      expect(fs.exists(`${dir}/tasks.md`)).toBe(true);
    });

    it('requirements.md 应包含 frontmatter 与 L0/L1/L2 章节', async () => {
      const r = await specs.create({ scene: 'user-management', name: 'user-login' });
      const content = await fs.read(
        `.lrnev/scenes/${r.data.scene}/specs/${r.data.spec}/requirements.md`,
      );
      expect(content).toContain("spec: '01-00-user-login'");
      expect(content).toContain("scene: '01-user-management'");
      expect(content).toContain('## L0 摘要');
      expect(content).toContain('## L1 概览');
    });

    it('F-07: spec_create 应使用 today() 生成 frontmatter created', async () => {
      const r = await specs.create({ scene: 'user-management', name: 'dated-spec' });
      const content = await fs.read(
        `.lrnev/scenes/${r.data.scene}/specs/${r.data.spec}/requirements.md`,
      );

      expect(r.data.created).toBe(today());
      expect(content).toContain(`created: '${today()}'`);
    });

    it('应返回 ai_followup', async () => {
      const r = await specs.create({ scene: 'user-management', name: 'user-login' });
      expect(r.ai_followup).toBeDefined();
      expect(r.ai_followup!.instructions.length).toBeGreaterThan(0);
      expect(r.ai_followup!.suggested_tools?.length).toBeGreaterThan(0);
    });

    it('F-11: spec_create followup 应包含 EARS 验收示范', async () => {
      const r = await specs.create({ scene: 'user-management', name: 'user-login' });
      const followup = r.ai_followup!.instructions.join('\n');

      expect(followup).toContain('EARS');
      expect(followup).toContain('WHEN 用户输错密码 THEN 系统返回 401 且不暴露用户是否存在');
    });

    it('F-09: 同 Scene 已有其它 Spec 时应提示先看摘要或搜索确认依赖', async () => {
      const first = await specs.create({ scene: 'user-management', name: 'profile' });
      const second = await specs.create({ scene: 'user-management', name: 'login' });
      const followup = second.ai_followup!.instructions.join('\n');

      expect(followup).toContain('本 Scene 已有 Spec');
      expect(followup).toContain(first.data.spec);
      expect(followup).toContain('按文档键控的 L0 摘要');
      expect(followup).toContain('context_search');
      expect(fs.exists('.lrnev/scenes/01-user-management/ontology.json')).toBe(false);
    });

    it('F-09: 同 Scene 只有当前 Spec 时不追加同侪依赖提示', async () => {
      const created = await specs.create({ scene: 'user-management', name: 'login' });
      const followup = created.ai_followup!.instructions.join('\n');

      expect(followup).not.toContain('本 Scene 已有 Spec');
      expect(followup).not.toContain('context_search 确认有无冲突/复用');
    });

    it('Scene 内连续创建应递增序号', async () => {
      const a = await specs.create({ scene: 'user-management', name: 'a-feat' });
      const b = await specs.create({ scene: 'user-management', name: 'b-feat' });
      const c = await specs.create({ scene: 'user-management', name: 'c-feat' });
      expect(a.data.number).toBe(1);
      expect(b.data.number).toBe(2);
      expect(c.data.number).toBe(3);
    });

    it('不同 Scene 的序号独立', async () => {
      await scenes.create({ name: 'order-fulfillment' });
      const a = await specs.create({ scene: 'user-management', name: 'aa' });
      const b = await specs.create({ scene: 'order-fulfillment', name: 'bb' });
      expect(a.data.number).toBe(1);
      expect(b.data.number).toBe(1);
    });

    it('重写场景：相同 name 不同 version 应成功', async () => {
      const v0 = await specs.create({ scene: 'user-management', name: 'feat-x' });
      const v1 = await specs.create({
        scene: 'user-management',
        name: 'feat-x',
        version: 1,
      });
      expect(v0.data.spec).toBe('01-00-feat-x');
      expect(v1.data.spec).toBe('01-01-feat-x');
      expect(v1.data.number).toBe(1);
      expect(v1.data.version).toBe(1);
    });

    it('重写版本后创建全新 Spec 应继续使用下一个主序号', async () => {
      await specs.create({ scene: 'user-management', name: 'feat-x' });
      await specs.create({ scene: 'user-management', name: 'feat-x', version: 1 });
      const y = await specs.create({ scene: 'user-management', name: 'feat-y' });
      expect(y.data.spec).toBe('02-00-feat-y');
    });

    it('算序号时不应读取已有 Spec 的 requirements 全文', async () => {
      const existing = await specs.create({ scene: 'user-management', name: 'existing' });
      const existingReq = `.lrnev/scenes/${existing.data.scene}/specs/${existing.data.spec}/requirements.md`;
      const readSpy = vi.spyOn(fs, 'read');

      await specs.create({ scene: 'user-management', name: 'new-feature' });

      const existingReads = readSpy.mock.calls.filter(([path]) => path === existingReq);
      expect(existingReads).toHaveLength(0);
    });

    it('并发创建不同 Spec 时主序号应互异', async () => {
      const results = await Promise.all(
        Array.from({ length: 5 }, (_, i) => specs.create({
          scene: 'user-management',
          name: `feat-${i}`,
        })),
      );

      const numbers = results.map((result) => result.data.number).sort((a, b) => a - b);
      expect(numbers).toEqual([1, 2, 3, 4, 5]);
      expect(new Set(results.map((result) => result.data.spec)).size).toBe(5);
    });

    it('目录创建冲突时应重试下一个 Spec 序号', async () => {
      let first = true;
      const original = fs.mkdirExclusive.bind(fs);
      vi.spyOn(fs, 'mkdirExclusive').mockImplementation(async (relPath) => {
        if (first && relPath.endsWith('/01-00-race-feat')) {
          first = false;
          return false;
        }
        return original(relPath);
      });

      const result = await specs.create({ scene: 'user-management', name: 'race-feat' });

      expect(result.data.spec).toBe('02-00-race-feat');
      expect(result.data.number).toBe(2);
    });

    it('同 scene + 同 name + 同 version 应拒绝', async () => {
      await specs.create({ scene: 'user-management', name: 'feat' });
      try {
        await specs.create({ scene: 'user-management', name: 'feat' });
        expect.fail();
      } catch (err) {
        expect(isLrnevError(err)).toBe(true);
      }
    });

    it('Scene 不存在应抛错', async () => {
      try {
        await specs.create({ scene: 'no-such-scene', name: 'x' });
        expect.fail();
      } catch (err) {
        expect(isLrnevError(err)).toBe(true);
      }
    });

    it('非法 version 应拒绝', async () => {
      await expect(
        specs.create({ scene: 'user-management', name: 'x', version: -1 }),
      ).rejects.toThrow();
      await expect(
        specs.create({ scene: 'user-management', name: 'x', version: 100 }),
      ).rejects.toThrow();
    });

    it('指定 priority 应写入 frontmatter', async () => {
      const r = await specs.create({
        scene: 'user-management',
        name: 'high-priority',
        priority: 'P0',
      });
      const content = await fs.read(
        `.lrnev/scenes/${r.data.scene}/specs/${r.data.spec}/requirements.md`,
      );
      expect(content).toContain('priority: P0');
    });

    it('F-12: 未指定 priority 时不应写入隐性默认值', async () => {
      const r = await specs.create({
        scene: 'user-management',
        name: 'no-priority',
      });
      const content = await fs.read(
        `.lrnev/scenes/${r.data.scene}/specs/${r.data.spec}/requirements.md`,
      );
      const got = await specs.get('user-management', r.data.spec);

      expect(content).not.toMatch(/^priority:/m);
      expect(got.priority).toBeUndefined();
    });

    it('F-01: priority 由模板渲染，SpecManager 不再暴露旧注入方法', async () => {
      const created = await specs.create({
        scene: 'user-management',
        name: 'template-priority',
        priority: 'P0',
      });

      const content = await fs.read(
        `.lrnev/scenes/${created.data.scene}/specs/${created.data.spec}/requirements.md`,
      );
      expect(content).toContain('priority: P0');
      const oldMethodName = `inject${'Priority'}`;
      expect(oldMethodName in specs).toBe(false);
    });

    describe('name 校验', () => {
      it('应拒绝大写', async () => {
        await expect(
          specs.create({ scene: 'user-management', name: 'BadName' }),
        ).rejects.toThrow();
      });
      it('应拒绝下划线', async () => {
        await expect(
          specs.create({ scene: 'user-management', name: 'bad_name' }),
        ).rejects.toThrow();
      });
      it('应接受合法 kebab', async () => {
        const r = await specs.create({
          scene: 'user-management',
          name: 'pwd-reset-v2',
        });
        expect(r.ok).toBe(true);
      });
    });
  });

  describe('list', () => {
    it('Scene 内为空应返回空', async () => {
      expect(await specs.list('user-management')).toEqual([]);
    });

    it('应按序号升序', async () => {
      await specs.create({ scene: 'user-management', name: 'c-feat' }); // 01
      await specs.create({ scene: 'user-management', name: 'a-feat' }); // 02
      await specs.create({ scene: 'user-management', name: 'b-feat' }); // 03
      const list = await specs.list('user-management');
      expect(list.map((s) => s.number)).toEqual([1, 2, 3]);
    });

    it('Scene 标识可以是名字 / 序号 / 完整 id', async () => {
      await specs.create({ scene: 'user-management', name: 'xx' });
      expect((await specs.list('user-management')).length).toBe(1);
      expect((await specs.list('1')).length).toBe(1);
      expect((await specs.list('01-user-management')).length).toBe(1);
    });

    it('requirements.md frontmatter 损坏时应返回 broken 降级条目', async () => {
      await specs.create({ scene: 'user-management', name: 'good' });
      await fs.write('.lrnev/scenes/01-user-management/specs/02-00-bad/requirements.md', [
        '---',
        'spec: [bad',
        '---',
        '',
        '# Bad Spec',
      ].join('\n'));

      const list = await specs.list('user-management');

      expect(list).toHaveLength(2);
      const broken = list.find((spec) => spec.spec === '02-00-bad');
      expect(broken?.broken?.error).toBeTruthy();
      expect(broken?.broken?.path).toContain('02-00-bad');
    });

    it('Spec 目录存在但 requirements.md 缺失时应返回 broken 降级条目', async () => {
      await fs.mkdir('.lrnev/scenes/01-user-management/specs/01-00-broken');
      await fs.write('.lrnev/scenes/01-user-management/specs/01-00-broken/tasks.md', '# Tasks\n');

      const list = await specs.list('user-management');

      expect(list).toHaveLength(1);
      expect(list[0]?.spec).toBe('01-00-broken');
      expect(list[0]?.documents.requirements).toBe(false);
      expect(list[0]?.documents.tasks).toBe(true);
      expect(list[0]?.broken?.error).toContain('requirements.md 缺失');
    });

    it('Spec 目录名畸形时应返回 broken 降级条目且不产生 number 0', async () => {
      await fs.write('.lrnev/scenes/01-user-management/specs/bad-spec/requirements.md', [
        '---',
        "spec: 'bad-spec'",
        "scene: '01-user-management'",
        'status: draft',
        "created: '2026-05-28'",
        '---',
        '',
        '# Bad Spec',
      ].join('\n'));

      const list = await specs.list('user-management');

      expect(list).toHaveLength(1);
      expect(list[0]?.spec).toBe('bad-spec');
      expect(list[0]?.number).not.toBe(0);
      expect(list[0]?.broken?.error).toContain('Spec id 格式无效');
    });
  });

  describe('get', () => {
    it('应通过完整 id 读取', async () => {
      const r = await specs.create({ scene: 'user-management', name: 'login' });
      const got = await specs.get('user-management', r.data.spec);
      expect(got.name).toBe('login');
      expect(got.documents.requirements).toBe(true);
      expect(got.documents.design).toBe(true);
      expect(got.documents.tasks).toBe(true);
    });

    it('应通过 "01-00" 前缀读取（唯一时）', async () => {
      await specs.create({ scene: 'user-management', name: 'login' });
      const got = await specs.get('user-management', '01-00');
      expect(got.name).toBe('login');
    });

    it('应通过 "01" 前缀读取（唯一时）', async () => {
      await specs.create({ scene: 'user-management', name: 'login' });
      const got = await specs.get('user-management', '01');
      expect(got.name).toBe('login');
    });

    it('应通过纯名字读取', async () => {
      await specs.create({ scene: 'user-management', name: 'login' });
      const got = await specs.get('user-management', 'login');
      expect(got.name).toBe('login');
    });

    it('数字主序号多版本时应抛 AMBIGUOUS_REF 并携带候选列表', async () => {
      await specs.create({ scene: 'user-management', name: 'feat' }); // 01-00-feat
      await specs.create({ scene: 'user-management', name: 'feat', version: 1 }); // 01-01-feat
      try {
        await specs.get('user-management', '01');
        expect.fail();
      } catch (err) {
        expect(isLrnevError(err)).toBe(true);
        if (isLrnevError(err)) {
          expect(err.code).toBe(ErrorCode.AMBIGUOUS_REF);
          expect(err.field).toBe('spec_id');
          expect(err.candidates).toEqual(['01-00-feat', '01-01-feat']);
        }
      }
    });

    it('纯名字多版本时应抛 AMBIGUOUS_REF 并携带候选列表', async () => {
      await specs.create({ scene: 'user-management', name: 'feat' });
      await specs.create({ scene: 'user-management', name: 'feat', version: 1 });
      try {
        await specs.get('user-management', 'feat');
        expect.fail();
      } catch (err) {
        expect(isLrnevError(err)).toBe(true);
        if (isLrnevError(err)) {
          expect(err.code).toBe(ErrorCode.AMBIGUOUS_REF);
          expect(err.field).toBe('spec_id');
          expect(err.candidates).toEqual(['01-00-feat', '01-01-feat']);
        }
      }
    });

    it('解析纯名字时应跳过畸形 Spec 目录而不是整体崩溃', async () => {
      await specs.create({ scene: 'user-management', name: 'good-feat' });
      await fs.write('.lrnev/scenes/01-user-management/specs/bad-spec/requirements.md', [
        '---',
        "spec: 'bad-spec'",
        "scene: '01-user-management'",
        'status: draft',
        "created: '2026-05-28'",
        '---',
        '',
        '# Bad Spec',
      ].join('\n'));

      const got = await specs.get('user-management', 'good-feat');

      expect(got.spec).toBe('01-00-good-feat');
    });

    it('不存在应抛 SPEC_NOT_FOUND', async () => {
      try {
        await specs.get('user-management', 'no-such');
        expect.fail();
      } catch (err) {
        expect(isLrnevError(err)).toBe(true);
        if (isLrnevError(err)) expect(err.code).toBe('SPEC_NOT_FOUND');
      }
    });

    it('Spec 目录存在但 requirements.md 缺失时应抛 SPEC_CORRUPTED', async () => {
      await fs.mkdir('.lrnev/scenes/01-user-management/specs/01-00-broken');
      try {
        await specs.get('user-management', '01-00-broken');
        expect.fail();
      } catch (err) {
        expect(isLrnevError(err)).toBe(true);
        if (isLrnevError(err)) {
          expect(err.code).toBe('SPEC_CORRUPTED');
          expect(err.message).toContain('requirements.md 缺失');
          expect(err.hint).toContain('lrnev_doctor');
        }
      }
    });
  });

  describe('12-F01 updateStatus（spec 状态机）', () => {
    it('合法转换应写回 frontmatter status', async () => {
      const created = await specs.create({ scene: 'user-management', name: 'login-flow' });
      const id = created.data.spec;

      const ready = await specs.updateStatus('user-management', id, 'ready');
      expect(ready.data.status).toBe('ready');
      expect((await specs.get('user-management', id)).status).toBe('ready');

      const archived = await specs.updateStatus('user-management', id, 'archived');
      expect(archived.data.status).toBe('archived');
      expect(archived.ai_followup?.instructions.join('\n')).toContain('归档');
    });

    it('非法转换应报 INVALID_STATUS_TRANSITION 并列出允许目标', async () => {
      const created = await specs.create({ scene: 'user-management', name: 'archive-test' });
      await specs.updateStatus('user-management', created.data.spec, 'archived');
      try {
        await specs.updateStatus('user-management', created.data.spec, 'ready');
        throw new Error('should have thrown');
      } catch (err) {
        expect(isLrnevError(err)).toBe(true);
        if (isLrnevError(err)) {
          expect(err.code).toBe(ErrorCode.INVALID_STATUS_TRANSITION);
          expect(err.message).toContain('archived → ready');
          expect(err.hint).toContain('终态');
        }
      }
    });

    it('相同状态应幂等返回，不报错', async () => {
      const created = await specs.create({ scene: 'user-management', name: 'idempotent' });
      const res = await specs.updateStatus('user-management', created.data.spec, 'draft');
      expect(res.data.status).toBe('draft');
      expect(res.ai_followup?.instructions.join('\n')).toContain('无需变更');
    });
  });

  describe('12-F03 重写版创建引导归档旧版', () => {
    it('version>0 且有同名旧版时 followup 含归档引导 + suggested_tools 含 spec_update', async () => {
      await specs.create({ scene: 'user-management', name: 'export-feature' });
      const rewrite = await specs.create({ scene: 'user-management', name: 'export-feature', version: 1 });

      const instructions = rewrite.ai_followup!.instructions.join('\n');
      expect(instructions).toContain('重写版');
      expect(instructions).toContain('archived');
      expect(rewrite.ai_followup!.suggested_tools?.map((t) => t.name)).toContain('spec_update');
      const archiveTool = rewrite.ai_followup!.suggested_tools?.find((t) => t.name === 'spec_update');
      expect(archiveTool?.args_template).toMatchObject({ status: 'archived' });
    });

    it('全新名字或 version=0 普通新建不追加归档引导', async () => {
      const fresh = await specs.create({ scene: 'user-management', name: 'brand-new' });
      const instructions = fresh.ai_followup!.instructions.join('\n');
      expect(instructions).not.toContain('重写版');
      expect(fresh.ai_followup!.suggested_tools?.map((t) => t.name)).not.toContain('spec_update');
    });
  });
});
