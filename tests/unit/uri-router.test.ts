/**
 * URIRouter 单元测试
 *
 * 覆盖 design.md 第 4 节所有 URI 模式：
 *   - 4.1 全局资源（project / auto / steering）
 *   - 4.2 Scene 资源
 *   - 4.3 Spec 资源
 *   - 4.4 ADR 资源（全局 + Scene）
 *   - 4.5 Errorbook / Memory（全局 + Scene）
 *   - 4.6 查询参数 level / scope
 *
 * 关键测试点：
 *   - 往返：filePathToURI(uriToFilePath(parseURI(x))) ≈ 原 URI（核心案例）
 *   - 异常：非法格式 / 越界 / 缺字段
 */

import { describe, it, expect } from 'vitest';
import {
  parseURI,
  uriToFilePath,
  filePathToURI,
  formatAdrNumber,
} from '../../src/storage/URIRouter.js';
import { isLrnevError } from '../../src/shared/errors.js';

describe('parseURI - 基础', () => {
  it('应拒绝空字符串', () => {
    try {
      parseURI('');
      expect.fail();
    } catch (err) {
      expect(isLrnevError(err)).toBe(true);
    }
  });

  it('应拒绝非 context:// 协议', () => {
    try {
      parseURI('http://example.com');
      expect.fail();
    } catch (err) {
      expect(isLrnevError(err)).toBe(true);
    }
  });

  it('应拒绝无类型部分', () => {
    try {
      parseURI('context://');
      expect.fail();
    } catch (err) {
      expect(isLrnevError(err)).toBe(true);
    }
  });

  it('应拒绝未知类型', () => {
    try {
      parseURI('context://unknown/x');
      expect.fail();
    } catch (err) {
      expect(isLrnevError(err)).toBe(true);
    }
  });
});

describe('parseURI - 查询参数', () => {
  it('默认 level 应为 L2', () => {
    expect(parseURI('context://project').level).toBe('L2');
  });

  it('level 应支持 L0/L1/L2', () => {
    expect(parseURI('context://project?level=L0').level).toBe('L0');
    expect(parseURI('context://project?level=L1').level).toBe('L1');
    expect(parseURI('context://project?level=L2').level).toBe('L2');
  });

  it('level 应大小写不敏感', () => {
    expect(parseURI('context://project?level=l0').level).toBe('L0');
  });

  it('非法 level 应抛错', () => {
    try {
      parseURI('context://project?level=L9');
      expect.fail();
    } catch (err) {
      expect(isLrnevError(err)).toBe(true);
    }
  });

  it('默认 scope 应为 global', () => {
    expect(parseURI('context://adr/1').scope).toBe('global');
  });

  it('scope=scene:xxx 应正确解析', () => {
    const p = parseURI('context://adr/1?scope=scene:01-user');
    expect(p.scope).toBe('scene:01-user');
  });

  it('未知 scope 值应回退到 global', () => {
    expect(parseURI('context://adr/1?scope=invalid').scope).toBe('global');
  });

  it('多查询参数应都解析', () => {
    const p = parseURI('context://adr/1?level=L1&scope=scene:01');
    expect(p.level).toBe('L1');
    expect(p.scope).toBe('scene:01');
  });
});

describe('uriToFilePath - 全局资源（4.1）', () => {
  it('context://project', () => {
    expect(uriToFilePath(parseURI('context://project'))).toBe('.lrnev/PROJECT.md');
  });

  it('context://project/architecture', () => {
    expect(uriToFilePath(parseURI('context://project/architecture'))).toBe('.lrnev/ARCHITECTURE.md');
  });

  it('context://auto/codebase', () => {
    expect(uriToFilePath(parseURI('context://auto/codebase'))).toBe('.lrnev/auto/codebase.json');
  });

  it('context://auto/tech-stack（指向 codebase.json）', () => {
    expect(uriToFilePath(parseURI('context://auto/tech-stack'))).toBe('.lrnev/auto/codebase.json');
  });

  it('context://steering/core 别名映射', () => {
    expect(uriToFilePath(parseURI('context://steering/core'))).toBe('.lrnev/steering/CORE_PRINCIPLES.md');
  });

  it('context://steering/scope 别名映射', () => {
    expect(uriToFilePath(parseURI('context://steering/scope'))).toBe('.lrnev/steering/SCOPE_RULES.md');
  });

  it('context://steering/{自定义名} 应大写化', () => {
    expect(uriToFilePath(parseURI('context://steering/custom'))).toBe('.lrnev/steering/CUSTOM.md');
  });
});

describe('uriToFilePath - Scene 资源（4.2）', () => {
  it('context://scene 列表 URI 应返回 null', () => {
    expect(uriToFilePath(parseURI('context://scene'))).toBeNull();
  });

  it('context://scene/{id}', () => {
    expect(uriToFilePath(parseURI('context://scene/01-user'))).toBe('.lrnev/scenes/01-user/scene.md');
  });

  it('context://scene/{id}/architecture', () => {
    expect(uriToFilePath(parseURI('context://scene/01-user/architecture'))).toBe(
      '.lrnev/scenes/01-user/architecture.md',
    );
  });

  it('context://scene/{id}/roadmap', () => {
    expect(uriToFilePath(parseURI('context://scene/01-user/roadmap'))).toBe(
      '.lrnev/scenes/01-user/roadmap.md',
    );
  });

  it('未知 scene 子路径应抛错', () => {
    try {
      uriToFilePath(parseURI('context://scene/01-user/unknown'));
      expect.fail();
    } catch (err) {
      expect(isLrnevError(err)).toBe(true);
    }
  });
});

describe('uriToFilePath - Spec 资源（4.3）', () => {
  it('context://spec/{scene}/{spec} 默认 requirements.md', () => {
    expect(uriToFilePath(parseURI('context://spec/01-user/01-00-login'))).toBe(
      '.lrnev/scenes/01-user/specs/01-00-login/requirements.md',
    );
  });

  it('context://spec/{scene}/{spec}/design', () => {
    expect(uriToFilePath(parseURI('context://spec/01-user/01-00-login/design'))).toBe(
      '.lrnev/scenes/01-user/specs/01-00-login/design.md',
    );
  });

  it('context://spec/{scene}/{spec}/tasks', () => {
    expect(uriToFilePath(parseURI('context://spec/01-user/01-00-login/tasks'))).toBe(
      '.lrnev/scenes/01-user/specs/01-00-login/tasks.md',
    );
  });

  it('缺 scene 或 spec 应抛错', () => {
    try {
      parseURI('context://spec/only-scene');
      expect.fail();
    } catch (err) {
      expect(isLrnevError(err)).toBe(true);
    }
  });
});

describe('uriToFilePath - ADR 资源（4.4）', () => {
  it('全局 ADR 索引', () => {
    expect(uriToFilePath(parseURI('context://adr'))).toBe('.lrnev/decisions/adr/README.md');
  });

  it('全局 ADR 单条（前缀，需 glob）', () => {
    expect(uriToFilePath(parseURI('context://adr/1'))).toBe('.lrnev/decisions/adr/0001');
    expect(uriToFilePath(parseURI('context://adr/42'))).toBe('.lrnev/decisions/adr/0042');
    expect(uriToFilePath(parseURI('context://adr/1234'))).toBe('.lrnev/decisions/adr/1234');
  });

  it('Scene ADR 索引', () => {
    const p = parseURI('context://scene/01-user/adr');
    expect(p.kind).toBe('adr');
    expect(p.scope).toBe('scene:01-user');
    expect(uriToFilePath(p)).toBe('.lrnev/scenes/01-user/decisions/adr/README.md');
  });

  it('Scene ADR 单条', () => {
    expect(uriToFilePath(parseURI('context://scene/01-user/adr/3'))).toBe(
      '.lrnev/scenes/01-user/decisions/adr/0003',
    );
  });

  it('非数字 ADR 编号应抛错', () => {
    try {
      uriToFilePath(parseURI('context://adr/abc'));
      expect.fail();
    } catch (err) {
      expect(isLrnevError(err)).toBe(true);
    }
  });

  it('0 或负数应抛错', () => {
    try {
      uriToFilePath(parseURI('context://adr/0'));
      expect.fail();
    } catch (err) {
      expect(isLrnevError(err)).toBe(true);
    }
  });

  it('formatAdrNumber', () => {
    expect(formatAdrNumber(1)).toBe('0001');
    expect(formatAdrNumber(42)).toBe('0042');
    expect(formatAdrNumber(1234)).toBe('1234');
    expect(formatAdrNumber(12345)).toBe('12345');
  });
});

describe('uriToFilePath - Errorbook（4.5）', () => {
  it('全局 errorbook 索引', () => {
    expect(uriToFilePath(parseURI('context://errorbook'))).toBe('.lrnev/errorbook/README.md');
  });

  it('全局 errorbook 单条', () => {
    expect(uriToFilePath(parseURI('context://errorbook/abc123'))).toBe(
      '.lrnev/errorbook/promoted/abc123.md',
    );
  });

  it('Scene errorbook', () => {
    const p = parseURI('context://scene/01-user/errorbook/xyz');
    expect(p.kind).toBe('errorbook');
    expect(p.scope).toBe('scene:01-user');
    expect(uriToFilePath(p)).toBe('.lrnev/scenes/01-user/errorbook/promoted/xyz.md');
  });
});

describe('uriToFilePath - Memory（4.5）', () => {
  it('缺 category 应抛错', () => {
    try {
      uriToFilePath(parseURI('context://memory'));
      expect.fail();
    } catch (err) {
      expect(isLrnevError(err)).toBe(true);
    }
  });

  it('仅 category 应返回 null（列表）', () => {
    expect(uriToFilePath(parseURI('context://memory/preferences'))).toBeNull();
  });

  it('category + id', () => {
    expect(uriToFilePath(parseURI('context://memory/preferences/use-tabs'))).toBe(
      '.lrnev/memory/preferences/use-tabs.md',
    );
  });

  it('Scene memory', () => {
    const p = parseURI('context://scene/01-user/memory/patterns/m1');
    expect(p.kind).toBe('memory');
    expect(p.scope).toBe('scene:01-user');
    expect(uriToFilePath(p)).toBe('.lrnev/scenes/01-user/memory/patterns/m1.md');
  });
});

describe('filePathToURI - 反向映射', () => {
  it('PROJECT.md → context://project', () => {
    expect(filePathToURI('.lrnev/PROJECT.md')).toBe('context://project');
  });

  it('ARCHITECTURE.md → context://project/architecture', () => {
    expect(filePathToURI('.lrnev/ARCHITECTURE.md')).toBe('context://project/architecture');
  });

  it('codebase.json', () => {
    expect(filePathToURI('.lrnev/auto/codebase.json')).toBe('context://auto/codebase');
  });

  it('steering 别名反向', () => {
    expect(filePathToURI('.lrnev/steering/CORE_PRINCIPLES.md')).toBe('context://steering/core');
    expect(filePathToURI('.lrnev/steering/SCOPE_RULES.md')).toBe('context://steering/scope');
  });

  it('scene 子文档', () => {
    expect(filePathToURI('.lrnev/scenes/01-user/scene.md')).toBe('context://scene/01-user');
    expect(filePathToURI('.lrnev/scenes/01-user/architecture.md')).toBe(
      'context://scene/01-user/architecture',
    );
  });

  it('spec 三文档', () => {
    expect(filePathToURI('.lrnev/scenes/01-user/specs/01-00-login/requirements.md')).toBe(
      'context://spec/01-user/01-00-login',
    );
    expect(filePathToURI('.lrnev/scenes/01-user/specs/01-00-login/design.md')).toBe(
      'context://spec/01-user/01-00-login/design',
    );
    expect(filePathToURI('.lrnev/scenes/01-user/specs/01-00-login/tasks.md')).toBe(
      'context://spec/01-user/01-00-login/tasks',
    );
  });

  it('全局 ADR', () => {
    expect(filePathToURI('.lrnev/decisions/adr/0042-use-jwt.md')).toBe('context://adr/42');
  });

  it('Scene ADR', () => {
    expect(filePathToURI('.lrnev/scenes/01-user/decisions/adr/0003-something.md')).toBe(
      'context://scene/01-user/adr/3',
    );
  });

  it('全局 errorbook（promoted）', () => {
    expect(filePathToURI('.lrnev/errorbook/promoted/abc.md')).toBe('context://errorbook/abc');
  });

  it('Scene memory', () => {
    expect(filePathToURI('.lrnev/scenes/01-user/memory/patterns/m1.md')).toBe(
      'context://scene/01-user/memory/patterns/m1',
    );
  });

  it('无法识别的路径应返回 null', () => {
    expect(filePathToURI('.lrnev/random/file.md')).toBeNull();
    expect(filePathToURI('node_modules/x')).toBeNull();
  });

  it('反向时应兼容 Windows 反斜杠', () => {
    expect(filePathToURI('.lrnev\\scenes\\01-user\\scene.md')).toBe('context://scene/01-user');
  });
});

describe('双向往返核心案例', () => {
  const cases = [
    'context://project',
    'context://project/architecture',
    'context://auto/codebase',
    'context://steering/core',
    'context://scene/01-user',
    'context://scene/01-user/architecture',
    'context://scene/01-user/roadmap',
    'context://spec/01-user/01-00-login',
    'context://spec/01-user/01-00-login/design',
    'context://spec/01-user/01-00-login/tasks',
    'context://memory/preferences/use-tabs',
    'context://errorbook/abc123',
    'context://scene/01-user/memory/patterns/m1',
  ];

  for (const uri of cases) {
    it(`${uri} 应能 URI → path → URI 往返`, () => {
      const path = uriToFilePath(parseURI(uri));
      expect(path).not.toBeNull();
      const back = filePathToURI(path!);
      expect(back).toBe(uri);
    });
  }
});
