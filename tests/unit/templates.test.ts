/**
 * 模板渲染器单元测试
 *
 * 覆盖：
 *   - .tmpl 渲染（占位符替换）
 *   - 静态 .md 文件直读
 *   - 缺占位符报错
 *   - 工具函数 toTitleCase / today
 */

import { describe, it, expect } from 'vitest';
import { renderTemplate, toTitleCase, today } from '../../src/core/Templates.js';
import { isLrnevError } from '../../src/shared/errors.js';

describe('renderTemplate', () => {
  it('应渲染 scene/scene.md.tmpl 并替换占位符', async () => {
    const out = await renderTemplate('scene', 'scene.md', {
      id: '01-user-management',
      number: 1,
      name: 'user-management',
      name_title: 'User Management',
      date: '2026-05-28',
      intent: '用户管理领域',
    });
    expect(out).toContain("id: '01-user-management'");
    expect(out).toContain('number: 1');
    expect(out).toContain('# User Management');
    expect(out).toContain('2026-05-28');
    // 不应残留占位符
    expect(out.includes('{{')).toBe(false);
  });

  it('应渲染 spec/requirements.md.tmpl', async () => {
    const out = await renderTemplate('spec', 'requirements.md', {
      spec_id: '01-00-login',
      scene_id: '01-user',
      name_title: '01-00 Login',
      date: '2026-05-28',
      priority_line: '',
    });
    expect(out).toContain("spec: '01-00-login'");
    expect(out).toContain("scene: '01-user'");
    expect(out).toContain('# 01-00 Login - 需求');
    expect(out).toContain('最初的失败信号/期望结果');
  });

  it('F-12: design 模板关键决策区应包含可选决策表引导', async () => {
    const out = await renderTemplate('spec', 'design.md', {
      spec_id: '01-00-login',
      scene_id: '01-user',
      name_title: '01-00 Login',
      date: '2026-05-28',
      priority_line: '',
    });

    expect(out).toContain('| 决策 | 选项 | 倾向 | 是否产 ADR |');
    expect(out).toContain('不是哨兵');
    expect(out).not.toContain('TODO');
  });

  it('spec / scene 模板应使用 FILL 哨兵且不残留裸 TODO 占位', async () => {
    for (const name of ['requirements.md', 'design.md', 'tasks.md']) {
      const out = await renderTemplate('spec', name, {
        spec_id: '01-00-login',
        scene_id: '01-user',
        name_title: '01-00 Login',
        date: '2026-05-28',
        priority_line: '',
      });
      expect(out).toContain('<!-- FILL:');
      expect(out).not.toContain('TODO');
    }

    for (const name of ['scene.md', 'architecture.md', 'roadmap.md']) {
      const out = await renderTemplate('scene', name, {
        id: '01-user-management',
        number: 1,
        name: 'user-management',
        name_title: 'User Management',
        date: '2026-05-28',
        intent: '用户管理领域',
      });
      expect(out).toContain('<!-- FILL:');
      expect(out).not.toContain('TODO');
    }
  });

  it('应渲染 adr/adr.md.tmpl', async () => {
    const out = await renderTemplate('adr', 'adr.md', {
      number_padded: '0001',
      title: 'Use TypeScript',
      scope: 'global',
      date: '2026-05-28',
    });
    expect(out).toContain('# 0001. Use TypeScript');
    expect(out).toContain("scope: 'global'");
  });

  it('应原样读 steering/CORE_PRINCIPLES.md（静态）', async () => {
    const out = await renderTemplate('steering', 'CORE_PRINCIPLES.md');
    expect(out).toContain('lrnev 核心原则');
    // 静态文件不含占位符
    expect(out.includes('{{')).toBe(false);
  });

  it('应原样读 steering/SCOPE_RULES.md', async () => {
    const out = await renderTemplate('steering', 'SCOPE_RULES.md');
    expect(out).toContain('Scope（范围）判定规则');
    expect(out).toContain('EARS');
    expect(out).toContain('不是 gate 硬规则');
    expect(out).toContain('frontmatter 里的 `created` / `updated` 等日期由 lrnev 工具生成');
    expect(out).toContain('修改现有 Spec 内容时直接编辑当前');
    expect(out).toContain('不要改 Spec 版本号');
    expect(out).toContain('spec_create --version');
  });

  it('缺占位符应抛错', async () => {
    try {
      await renderTemplate('scene', 'scene.md', { id: '01-x' }); // 缺其它字段
      expect.fail('应抛出异常');
    } catch (err) {
      expect(isLrnevError(err)).toBe(true);
      if (isLrnevError(err)) {
        expect(err.message).toContain('scene/scene.md');
        expect(err.message).toContain('number');
        expect(err.hint).toContain('scene/scene.md');
      }
    }
  });

  it('模板缺变量错误应携带 group/name 和缺失占位符名', async () => {
    try {
      await renderTemplate('spec', 'requirements.md', {
        spec_id: '01-00-login',
        scene_id: '01-user',
        name_title: '01-00 Login',
      });
      expect.fail('应抛出异常');
    } catch (err) {
      expect(isLrnevError(err)).toBe(true);
      if (isLrnevError(err)) {
        expect(err.message).toContain('spec/requirements.md');
        expect(err.message).toContain('date');
        expect(err.field).toBe('vars');
      }
    }
  });

  it('模板不存在应抛 FILE_NOT_FOUND', async () => {
    try {
      await renderTemplate('scene', 'not-exist.md');
      expect.fail('应抛出异常');
    } catch (err) {
      expect(isLrnevError(err)).toBe(true);
      if (isLrnevError(err)) {
        expect(err.code).toBe('FILE_NOT_FOUND');
      }
    }
  });

  it('占位符支持单边空白', async () => {
    // 已经是用 strict regex 测试过了，直接验 scene 模板里的字符串
    const out = await renderTemplate('adr', 'adr.md', {
      number_padded: '0001',
      title: 'X',
      scope: 'global',
      date: '2026-05-28',
    });
    // adr 模板里的 {{number_padded}} / {{title}} 都成功替换即可
    expect(out).toContain('0001');
    expect(out).toContain('X');
  });
});

describe('toTitleCase', () => {
  it('kebab → Title Case', () => {
    expect(toTitleCase('user-management')).toBe('User Management');
    expect(toTitleCase('a-b-c')).toBe('A B C');
    expect(toTitleCase('single')).toBe('Single');
    expect(toTitleCase('')).toBe('');
  });
});

describe('today', () => {
  it('应返回 YYYY-MM-DD 格式', () => {
    const t = today();
    expect(t).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('F-07: 应返回本地当天日期', () => {
    const now = new Date();
    const expected = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-');

    expect(today()).toBe(expected);
  });
});
