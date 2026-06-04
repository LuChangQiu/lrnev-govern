/**
 * FrontmatterCodec / MarkdownParser 单元测试
 *
 * 重点验证：
 *   - 往返序列化等价（不丢字段）
 *   - 章节切分按 ## 二级标题
 *   - 边界情况（无 frontmatter / 无章节 / 空文档）
 */

import { describe, it, expect } from 'vitest';
import {
  parseFrontmatter,
  serializeFrontmatter,
} from '../../src/storage/FrontmatterCodec.js';
import {
  parseDocument,
  serializeDocument,
  getSection,
  findSection,
  extractCodeRanges,
  inRanges,
} from '../../src/storage/MarkdownParser.js';

describe('FrontmatterCodec', () => {
  describe('parseFrontmatter', () => {
    it('应解析标准 frontmatter', () => {
      const input = `---\nname: demo\nstatus: draft\n---\n\n# Title\nbody`;
      const result = parseFrontmatter<{ name: string; status: string }>(input);
      expect(result.hasFrontmatter).toBe(true);
      expect(result.frontmatter.name).toBe('demo');
      expect(result.frontmatter.status).toBe('draft');
      expect(result.body).toContain('# Title');
    });

    it('无 frontmatter 时应返回空对象', () => {
      const result = parseFrontmatter('# Just markdown\nhello');
      expect(result.hasFrontmatter).toBe(false);
      expect(result.frontmatter).toEqual({});
      expect(result.body).toContain('# Just markdown');
    });

    it('应解析数字、布尔、数组字段', () => {
      const input = `---\nnum: 42\nflag: true\nlist:\n  - a\n  - b\n---\nbody`;
      const result = parseFrontmatter<{ num: number; flag: boolean; list: string[] }>(input);
      expect(result.frontmatter.num).toBe(42);
      expect(result.frontmatter.flag).toBe(true);
      expect(result.frontmatter.list).toEqual(['a', 'b']);
    });

    it('空 frontmatter 应返回空对象', () => {
      const input = `---\n---\nbody`;
      const result = parseFrontmatter(input);
      expect(result.frontmatter).toEqual({});
    });
  });

  describe('serializeFrontmatter', () => {
    it('应输出 ---  --- 分隔', () => {
      const out = serializeFrontmatter({ a: 1, b: 'x' }, 'body');
      expect(out.startsWith('---\n')).toBe(true);
      expect(out).toContain('\n---\n');
    });

    it('空 frontmatter 不输出 ---', () => {
      const out = serializeFrontmatter({}, 'body');
      expect(out.includes('---')).toBe(false);
      expect(out).toBe('body\n');
    });

    it('应正确处理需要引号的字符串', () => {
      const out = serializeFrontmatter({ a: 'hello: world', b: 'true' }, '');
      expect(out).toContain("a: 'hello: world'");
      expect(out).toContain("b: 'true'");
    });

    it('应正确处理数组', () => {
      const out = serializeFrontmatter({ tags: ['a', 'b'] }, '');
      expect(out).toContain('tags: [a, b]');
    });

    it('undefined 字段应跳过', () => {
      const out = serializeFrontmatter({ a: 1, b: undefined }, '');
      expect(out).toContain('a: 1');
      expect(out.includes('b:')).toBe(false);
    });
  });

  describe('往返等价（parse → serialize → parse）', () => {
    it('简单 frontmatter 往返字段保留', () => {
      const original = `---\nname: demo\nstatus: draft\nnum: 42\n---\n\n# Title\n\nbody text\n`;
      const parsed = parseFrontmatter(original);
      const serialized = serializeFrontmatter(parsed.frontmatter, parsed.body);
      const reparsed = parseFrontmatter(serialized);
      expect(reparsed.frontmatter).toEqual(parsed.frontmatter);
    });
  });
});

describe('MarkdownParser', () => {
  describe('extractCodeRanges / inRanges', () => {
    it('应返回 fenced code block 的原文字符区间', () => {
      const input = ['before', '```ts', 'const x = 1;', '```', 'after'].join('\n');
      const ranges = extractCodeRanges(input);
      const fenced = input.slice(ranges[0]![0], ranges[0]![1]);

      expect(fenced).toContain('```ts');
      expect(fenced).toContain('const x = 1;');
      expect(inRanges(ranges, input.indexOf('const'), input.indexOf('const') + 5)).toBe(true);
      expect(inRanges(ranges, input.indexOf('after'), input.indexOf('after') + 5)).toBe(false);
    });

    it('应支持 ~~~ fenced code block', () => {
      const input = ['a', '~~~', 'code', '~~~', 'b'].join('\n');
      const ranges = extractCodeRanges(input);

      expect(input.slice(ranges[0]![0], ranges[0]![1])).toContain('code');
    });

    it('应识别 inline code 和连续多个 inline code', () => {
      const input = 'a `one` b `two` c';
      const ranges = extractCodeRanges(input);

      expect(ranges.map(([start, end]) => input.slice(start, end))).toEqual(['`one`', '`two`']);
    });

    it('fenced code 内部的反引号不应额外生成 inline 区间', () => {
      const input = ['```md', '`inline-looking`', '```'].join('\n');
      const ranges = extractCodeRanges(input);

      expect(ranges).toHaveLength(1);
      expect(input.slice(ranges[0]![0], ranges[0]![1])).toContain('`inline-looking`');
    });

    it('未闭合 fenced code 应覆盖到文件末尾', () => {
      const input = ['before', '```', 'still code'].join('\n');
      const ranges = extractCodeRanges(input);

      expect(ranges[0]).toEqual([input.indexOf('```'), input.length]);
    });

    it('应支持空 inline code', () => {
      const input = 'a `` b';
      const ranges = extractCodeRanges(input);

      expect(ranges.map(([start, end]) => input.slice(start, end))).toEqual(['``']);
    });
  });

  describe('parseDocument', () => {
    it('应切分二级章节', () => {
      const input = `---\nname: x\n---\n\n# H1 Title\n\nintro\n\n## L0 摘要\n\n一句话\n\n## L1 概览\n\n多句话\n第二行\n\n## L2 详情\n\n详细\n`;
      const doc = parseDocument<{ name: string }>(input);
      expect(doc.frontmatter.name).toBe('x');
      expect(doc.sections.length).toBe(3);
      expect(doc.sections[0]?.title).toBe('L0 摘要');
      expect(doc.sections[0]?.content).toBe('一句话');
      expect(doc.sections[1]?.title).toBe('L1 概览');
      expect(doc.sections[1]?.content).toBe('多句话\n第二行');
      expect(doc.sections[2]?.title).toBe('L2 详情');
    });

    it('lead 应包含 H1 + 第一个 ## 前的所有内容', () => {
      const input = `# Title\n\n这是简介\n\n## 第一章\nbody`;
      const doc = parseDocument(input);
      expect(doc.lead).toContain('# Title');
      expect(doc.lead).toContain('这是简介');
    });

    it('无 ## 章节时 sections 应为空', () => {
      const input = `# H1\n\nbody only`;
      const doc = parseDocument(input);
      expect(doc.sections).toEqual([]);
      expect(doc.lead).toContain('body only');
    });

    it('### 三级标题应作为章节内容的一部分（不切分）', () => {
      const input = `## L1\n\n### sub\nx\n\n## L2\nfull`;
      const doc = parseDocument(input);
      expect(doc.sections.length).toBe(2);
      expect(doc.sections[0]?.content).toContain('### sub');
      expect(doc.sections[0]?.content).toContain('x');
    });

    it('空文档应不崩', () => {
      const doc = parseDocument('');
      expect(doc.sections).toEqual([]);
      expect(doc.lead).toBe('');
    });
  });

  describe('getSection / findSection', () => {
    const input = `## L0 摘要\n摘要内容\n\n## L1 概览\n概览内容`;
    const doc = parseDocument(input);

    it('getSection 精确匹配应找到', () => {
      expect(getSection(doc, 'L0 摘要')).toBe('摘要内容');
      expect(getSection(doc, 'L1 概览')).toBe('概览内容');
    });

    it('getSection 找不到应返回 null', () => {
      expect(getSection(doc, 'X')).toBeNull();
    });

    it('findSection 应支持谓词匹配', () => {
      const sec = findSection(doc, (t) => t.toLowerCase().startsWith('l0'));
      expect(sec?.title).toBe('L0 摘要');
    });
  });

  describe('serializeDocument', () => {
    it('应输出 frontmatter + lead + 章节', () => {
      const out = serializeDocument(
        { name: 'x' },
        '# Title\n\nintro',
        [
          { title: 'L0 摘要', level: 2, content: '一句话' },
          { title: 'L1 概览', level: 2, content: '多句话' },
        ],
      );
      expect(out).toContain('name: x');
      expect(out).toContain('# Title');
      expect(out).toContain('## L0 摘要');
      expect(out).toContain('一句话');
      expect(out).toContain('## L1 概览');
    });

    it('parse → serialize → parse 应等价', () => {
      const original = `---\nname: demo\n---\n\n# Title\n\nintro line\n\n## A\n\ncontent A\n\n## B\n\ncontent B`;
      const doc = parseDocument(original);
      const out = serializeDocument(doc.frontmatter, doc.lead, doc.sections);
      const reparsed = parseDocument(out);
      expect(reparsed.frontmatter).toEqual(doc.frontmatter);
      expect(reparsed.sections.map((s) => s.title)).toEqual(['A', 'B']);
      expect(reparsed.sections.map((s) => s.content)).toEqual(['content A', 'content B']);
    });
  });
});
