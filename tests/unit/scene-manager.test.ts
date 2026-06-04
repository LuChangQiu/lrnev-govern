/**
 * SceneManager 集成测试（用真实临时目录）
 *
 * 覆盖：
 *   - create / get / list 正常路径
 *   - 序号不重用：删除 02 后再 create 应分配 03
 *   - resolveId 三种输入（完整 id / 数字 / 名字）
 *   - name 校验（kebab-case + 长度 + 字符）
 *   - 重名拒绝
 *   - ai_followup 字段结构
 *   - get 不存在时抛 SCENE_NOT_FOUND
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { dir as tmpDir, type DirectoryResult } from 'tmp-promise';
import { FileStorage } from '../../src/storage/FileStorage.js';
import { ensureWorkspace } from '../../src/storage/WorkspaceLocator.js';
import { DEFAULT_SCENE_ID, SceneManager, formatSceneId } from '../../src/core/SceneManager.js';
import { today } from '../../src/core/Templates.js';
import { isLrnevError } from '../../src/shared/errors.js';

describe('SceneManager', () => {
  let workspace: DirectoryResult;
  let fs: FileStorage;
  let manager: SceneManager;

  beforeEach(async () => {
    workspace = await tmpDir({ unsafeCleanup: true });
    await ensureWorkspace(workspace.path);
    fs = new FileStorage(workspace.path);
    manager = new SceneManager(fs);
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  describe('辅助函数', () => {
    it('formatSceneId 应拒绝超过两位约定的序号', () => {
      expect(() => formatSceneId(100, 'too-high')).toThrow();
    });
  });

  describe('create', () => {
    it('ensureExists should lazily create the minimal default Scene', async () => {
      const scene = await manager.ensureExists(DEFAULT_SCENE_ID);

      expect(scene.id).toBe(DEFAULT_SCENE_ID);
      expect(scene.number).toBe(0);
      expect(scene.name).toBe('default');
      expect(fs.exists(`.lrnev/scenes/${DEFAULT_SCENE_ID}/scene.md`)).toBe(true);
      expect(fs.exists(`.lrnev/scenes/${DEFAULT_SCENE_ID}/specs`)).toBe(true);
      expect(fs.exists(`.lrnev/scenes/${DEFAULT_SCENE_ID}/architecture.md`)).toBe(false);
      expect(fs.exists(`.lrnev/scenes/${DEFAULT_SCENE_ID}/roadmap.md`)).toBe(false);

      const again = await manager.ensureExists(DEFAULT_SCENE_ID);
      expect(again.id).toBe(DEFAULT_SCENE_ID);
    });

    it('首次创建应分配序号 01', async () => {
      const res = await manager.create({ name: 'user-management' });
      expect(res.ok).toBe(true);
      expect(res.data.id).toBe('01-user-management');
      expect(res.data.number).toBe(1);
      expect(res.data.name).toBe('user-management');
      expect(res.data.status).toBe('draft');
      expect(res.data.spec_count).toBe(0);
    });

    it('应生成三份文档', async () => {
      const res = await manager.create({ name: 'user-management' });
      expect(fs.exists(`.lrnev/scenes/${res.data.id}/scene.md`)).toBe(true);
      expect(fs.exists(`.lrnev/scenes/${res.data.id}/architecture.md`)).toBe(true);
      expect(fs.exists(`.lrnev/scenes/${res.data.id}/roadmap.md`)).toBe(true);
      expect(fs.exists(`.lrnev/scenes/${res.data.id}/specs`)).toBe(true);
    });

    it('scene.md 应包含 frontmatter 和 L0/L1/L2 章节', async () => {
      const res = await manager.create({ name: 'user-management', intent: '用户领域' });
      const content = await fs.read(`.lrnev/scenes/${res.data.id}/scene.md`);
      expect(content).toContain("id: '01-user-management'");
      expect(content).toContain('number: 1');
      expect(content).toContain('## L0 摘要');
      expect(content).toContain('## L1 概览');
      expect(content).toContain('## L2 详情');
    });

    it('F-07: scene_create 应使用 today() 生成 frontmatter created', async () => {
      const res = await manager.create({ name: 'dated-scene' });
      const content = await fs.read(`.lrnev/scenes/${res.data.id}/scene.md`);

      expect(res.data.created).toBe(today());
      expect(content).toContain(`created: '${today()}'`);
    });

    it('应返回 ai_followup 引导', async () => {
      const res = await manager.create({ name: 'user-management' });
      expect(res.ai_followup).toBeDefined();
      expect(res.ai_followup!.instructions.length).toBeGreaterThan(0);
      expect(res.ai_followup!.suggested_tools?.length).toBeGreaterThan(0);
    });

    it('F-01: 无 intent 时 scene_create followup 也应包含 Spec 拆分标尺', async () => {
      const res = await manager.create({ name: 'rubric-scene' });
      const instructions = res.ai_followup!.instructions.join('\n');

      expect(instructions).toContain('一个 Spec 只装一个可交付特性');
      expect(instructions).toContain('独立验收/独立上线');
      expect(instructions).toContain('共享同一套验收标准');
      expect(instructions).toContain('要先调研');
      expect(res.ai_followup!.suggested_tools?.map((tool) => tool.name)).not.toContain('assess_goal');
    });

    it('F-01: 多特性 intent 应附 multi 信号并建议 assess_goal', async () => {
      const res = await manager.create({
        name: 'multi-signal-scene',
        intent: '实现登录、注册、订单管理、支付、权限以及全链路通知平台',
      });
      const instructions = res.ai_followup!.instructions.join('\n');

      expect(instructions).toContain('信号提示');
      expect(instructions).toContain('多特性迹象');
      expect(instructions).toContain('独立验收/独立上线');
      expect(instructions).not.toContain('结论');
      expect(instructions).not.toContain('必须');
      expect(res.ai_followup!.suggested_tools?.map((tool) => tool.name)).toContain('assess_goal');
    });

    it('F-01: 单一特性 intent 应附中性信号且仍保留标尺，不劝退拆分', async () => {
      const res = await manager.create({ name: 'single-signal-scene', intent: '实现登录页' });
      const instructions = res.ai_followup!.instructions.join('\n');

      expect(instructions).toContain('信号提示');
      expect(instructions).toContain('请按上面三条标尺自行判断');
      expect(instructions).not.toContain('看起来是单一特性');
      expect(instructions).toContain('共享同一套验收标准');
      expect(res.ai_followup!.suggested_tools?.map((tool) => tool.name)).not.toContain('assess_goal');
    });

    it('F-01: 调研类 intent 应附 research 信号', async () => {
      const res = await manager.create({ name: 'research-signal-scene', intent: '调研支付网关选型' });
      const instructions = res.ai_followup!.instructions.join('\n');

      expect(instructions).toContain('信号提示');
      expect(instructions).toContain('调研/选型/不确定');
      expect(instructions).toContain('研究型 Spec');
    });

    it('连续创建应递增序号', async () => {
      const a = await manager.create({ name: 'a-scene' });
      const b = await manager.create({ name: 'b-scene' });
      const c = await manager.create({ name: 'c-scene' });
      expect(a.data.number).toBe(1);
      expect(b.data.number).toBe(2);
      expect(c.data.number).toBe(3);
    });

    it('删除中间一个后再创建应继续递增（不重用序号）', async () => {
      await manager.create({ name: 'a-scene' });
      const b = await manager.create({ name: 'b-scene' });
      await manager.create({ name: 'c-scene' });

      // 模拟用户手动删了 02-b-scene
      await fs.rm(`.lrnev/scenes/${b.data.id}`);

      const d = await manager.create({ name: 'd-scene' });
      expect(d.data.number).toBe(4); // 不重用 2
    });

    it('删除最高序号后再创建应按扫描 max+1 复用该序号', async () => {
      await manager.create({ name: 'a-scene' });
      const b = await manager.create({ name: 'b-scene' });

      await fs.rm(`.lrnev/scenes/${b.data.id}`);

      const c = await manager.create({ name: 'c-scene' });
      expect(c.data.number).toBe(2);
      expect(c.data.id).toBe('02-c-scene');
    });

    it('用户指定序号应被采纳', async () => {
      const res = await manager.create({ name: 'first', number: 10 });
      expect(res.data.number).toBe(10);
      expect(res.data.id).toBe('10-first');

      // 下一次自动分配应从 11 开始
      const next = await manager.create({ name: 'second' });
      expect(next.data.number).toBe(11);
    });

    it('用户指定序号超过 99 应拒绝', async () => {
      await expect(manager.create({ name: 'too-high', number: 100 })).rejects.toThrow();
    });

    it('重名应拒绝', async () => {
      await manager.create({ name: 'demo' });
      try {
        await manager.create({ name: 'demo' });
        expect.fail();
      } catch (err) {
        expect(isLrnevError(err)).toBe(true);
      }
    });

    it('手动指定序号但目录已被外部占用应拒绝', async () => {
      // 用户外部手动建了 01-foo（绕过 manager）
      await fs.mkdir('.lrnev/scenes/01-foo');
      try {
        await manager.create({ name: 'foo', number: 1 });
        expect.fail();
      } catch (err) {
        expect(isLrnevError(err)).toBe(true);
      }
    });

    it('并发创建 Scene 时序号应互异', async () => {
      const results = await Promise.all(
        Array.from({ length: 5 }, (_, i) => manager.create({ name: `scene-${i}` })),
      );

      const numbers = results.map((result) => result.data.number).sort((a, b) => a - b);
      expect(numbers).toEqual([1, 2, 3, 4, 5]);
      expect(new Set(results.map((result) => result.data.id)).size).toBe(5);
    });

    it('目录创建冲突时应重试下一个序号', async () => {
      let first = true;
      const original = fs.mkdirExclusive.bind(fs);
      vi.spyOn(fs, 'mkdirExclusive').mockImplementation(async (relPath) => {
        if (first && relPath.endsWith('/01-race-scene')) {
          first = false;
          return false;
        }
        return original(relPath);
      });

      const result = await manager.create({ name: 'race-scene' });

      expect(result.data.id).toBe('02-race-scene');
      expect(result.data.number).toBe(2);
    });

    describe('name 校验', () => {
      it('应拒绝空 name', async () => {
        await expect(manager.create({ name: '' })).rejects.toThrow();
      });
      it('应拒绝大写字母', async () => {
        await expect(manager.create({ name: 'UserMgmt' })).rejects.toThrow();
      });
      it('应拒绝下划线', async () => {
        await expect(manager.create({ name: 'user_mgmt' })).rejects.toThrow();
      });
      it('应拒绝以横线开头', async () => {
        await expect(manager.create({ name: '-bad' })).rejects.toThrow();
      });
      it('应拒绝过短', async () => {
        await expect(manager.create({ name: 'a' })).rejects.toThrow();
      });
      it('应接受合法 kebab-case', async () => {
        const res = await manager.create({ name: 'order-fulfillment-v2' });
        expect(res.ok).toBe(true);
      });
    });
  });

  describe('list', () => {
    it('空工作区应返回空列表', async () => {
      expect(await manager.list()).toEqual([]);
    });

    it('应按序号升序排列', async () => {
      await manager.create({ name: 'b-scene' }); // 01
      await manager.create({ name: 'a-scene', number: 5 }); // 05
      await manager.create({ name: 'c-scene' }); // 06

      const list = await manager.list();
      expect(list.map((s) => s.number)).toEqual([1, 5, 6]);
    });

    it('frontmatter 损坏时应返回 broken 降级条目', async () => {
      await manager.create({ name: 'good-scene' });
      await fs.write('.lrnev/scenes/02-bad-scene/scene.md', [
        '---',
        'id: [bad',
        '---',
        '',
        '# Bad Scene',
      ].join('\n'));

      const list = await manager.list();

      expect(list).toHaveLength(2);
      const broken = list.find((scene) => scene.id === '02-bad-scene');
      expect(broken?.broken?.error).toBeTruthy();
      expect(broken?.broken?.path).toContain('02-bad-scene');
    });
  });

  describe('get', () => {
    it('应通过完整 id 读取', async () => {
      const created = await manager.create({ name: 'demo' });
      const got = await manager.get(created.data.id);
      expect(got.id).toBe(created.data.id);
      expect(got.name).toBe('demo');
    });

    it('完整 id 读取时不应扫描 Scene 列表', async () => {
      const created = await manager.create({ name: 'demo' });
      const listSpy = vi.spyOn(fs, 'list');

      await manager.get(created.data.id);

      expect(listSpy).not.toHaveBeenCalledWith('.lrnev/scenes/*/scene.md');
    });

    it('应通过纯数字读取', async () => {
      await manager.create({ name: 'demo' });
      const got = await manager.get('1');
      expect(got.name).toBe('demo');
    });

    it('应通过纯名字读取', async () => {
      await manager.create({ name: 'demo' });
      const got = await manager.get('demo');
      expect(got.name).toBe('demo');
    });

    it('不存在时应抛 SCENE_NOT_FOUND', async () => {
      try {
        await manager.get('not-exist');
        expect.fail();
      } catch (err) {
        expect(isLrnevError(err)).toBe(true);
        if (isLrnevError(err)) expect(err.code).toBe('SCENE_NOT_FOUND');
      }
    });

    it('目录存在但 scene.md 缺失时应抛 SCENE_CORRUPTED', async () => {
      await fs.mkdir('.lrnev/scenes/01-broken');
      try {
        await manager.get('01-broken');
        expect.fail();
      } catch (err) {
        expect(isLrnevError(err)).toBe(true);
        if (isLrnevError(err)) {
          expect(err.code).toBe('SCENE_CORRUPTED');
          expect(err.message).toContain('scene.md 缺失');
          expect(err.hint).toContain('lrnev_doctor');
        }
      }
    });

    it('spec_count 应反映实际数量', async () => {
      const res = await manager.create({ name: 'demo' });
      // 模拟手动创建一个 Spec
      await fs.write(
        `.lrnev/scenes/${res.data.id}/specs/01-00-feat/requirements.md`,
        '---\nspec: x\n---\nbody',
      );
      const got = await manager.get(res.data.id);
      expect(got.spec_count).toBe(1);
    });
  });

  describe('resolveId', () => {
    it('完整 id 直接返回', async () => {
      const r = await manager.create({ name: 'demo' });
      expect(await manager.resolveId(r.data.id)).toBe(r.data.id);
    });

    it('"1" 应映射到 "01-..."', async () => {
      const r = await manager.create({ name: 'demo' });
      expect(await manager.resolveId('1')).toBe(r.data.id);
    });

    it('"demo" 应映射到 "01-demo"', async () => {
      const r = await manager.create({ name: 'demo' });
      expect(await manager.resolveId('demo')).toBe(r.data.id);
    });

    it('空字符串应抛错', async () => {
      await expect(manager.resolveId('')).rejects.toThrow();
    });

    it('找不到时应抛 SCENE_NOT_FOUND', async () => {
      try {
        await manager.resolveId('99');
        expect.fail();
      } catch (err) {
        expect(isLrnevError(err)).toBe(true);
      }
    });
  });

  describe('序号状态文件', () => {
    it('创建后不再写入 scene-numbers.json', async () => {
      await manager.create({ name: 'demo' });
      expect(fs.exists('.lrnev/state/scene-numbers.json')).toBe(false);
    });

    it('应始终从现有目录推断下一个序号', async () => {
      await manager.create({ name: 'aa' });
      await manager.create({ name: 'bb' });
      const c = await manager.create({ name: 'cc' });
      expect(c.data.number).toBe(3);
    });
  });

  describe('shared documents', () => {
    it('并发写同一 architecture.md 时应让后写冲突可见', async () => {
      const created = await manager.create({ name: 'shared-doc' });
      const snapshot = await manager.getSharedDocument(created.data.id, 'architecture');

      const writes = await Promise.allSettled([
        manager.updateSharedDocument({
          scene: created.data.id,
          document: 'architecture',
          content: snapshot.content + '\nA change\n',
          expected_revision: snapshot.revision,
        }),
        manager.updateSharedDocument({
          scene: created.data.id,
          document: 'architecture',
          content: snapshot.content + '\nB change\n',
          expected_revision: snapshot.revision,
        }),
      ]);

      expect(writes.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(writes.filter((result) => result.status === 'rejected')).toHaveLength(1);
      const finalDoc = await manager.getSharedDocument(created.data.id, 'architecture');
      expect(finalDoc.content.includes('A change') || finalDoc.content.includes('B change')).toBe(true);
      expect(finalDoc.content.includes('A change') && finalDoc.content.includes('B change')).toBe(false);
    });
  });
});
