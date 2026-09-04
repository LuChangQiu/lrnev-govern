/**
 * M2 渲染器单元测试 - Batch 3
 *
 * 选择/歧义/搜索类渲染器测试
 */

import { describe, it, expect } from 'vitest';
import { errorSearchRenderer } from '../../../src/mcp/helpers/renderers/error-search.js';
import { memorySearchRenderer } from '../../../src/mcp/helpers/renderers/memory-search.js';
import type { LrnevToolPayload } from '../../../src/mcp/types/response-envelope.js';
import type { ErrorEntry } from '../../../src/types/errorbook.js';
import type { Memory } from '../../../src/types/memory.js';
import { renderModelVisibleContent } from '../../../src/mcp/helpers/model-visible-contract.js';

describe('M2 第 3 批渲染器 - 选择/歧义/搜索类', () => {
  describe('error_search 渲染器', () => {
    it('必须完整呈现所有错误条目的 required 字段', () => {
      const payload: LrnevToolPayload<ErrorEntry[]> = {
        response_version: '1',
        ok: true,
        data: [
          {
            id: 'E-001',
            fingerprint: 'abc123',
            status: 'incidents',
            scope: 'global',
            occurrence_count: 3,
            first_seen: '2024-01-01T00:00:00Z',
            last_seen: '2024-01-03T00:00:00Z',
            path: '/path/to/error.md',
            body: {
              symptom: 'ready gate 缺 headings',
              root_cause: '没填 requirements',
              fix_action: '补充 ## 需求 章节',
            },
          },
        ],
      };

      const content = errorSearchRenderer.render(payload);

      expect(content).toContain('E-001');
      expect(content).toContain('abc123');
      expect(content).toContain('出现次数: 3');
      expect(content).toContain('ready gate 缺 headings');
    });

    it('用户文本保持未逃逸输出，最终由 MVC 统一转义口转义', () => {
      const payload: LrnevToolPayload<ErrorEntry[]> = {
        response_version: '1',
        ok: true,
        data: [
          {
            id: 'E-003',
            fingerprint: 'xyz789',
            status: 'incidents',
            scope: 'global',
            occurrence_count: 1,
            first_seen: '2024-01-01T00:00:00Z',
            last_seen: '2024-01-01T00:00:00Z',
            path: '/path/to/error.md',
            body: {
              symptom: '错误信息包含 </tag> 闭合标签',
              root_cause: 'HTML 注入导致 </script> 标签',
              fix_action: '转义 </div> 标签',
            },
          },
        ],
      };

      const content = errorSearchRenderer.render(payload);

      // 新契约：渲染器返回未逃逸文本，用户文本中的 </...> 原样保留
      expect(content).toContain('</tag>');
      expect(content).toContain('</script>');
      expect(content).toContain('</div>');

      // 最终转义由 MVC 统一转义口（renderModelVisibleContent）保证：</ → <\/
      const mvcContent = renderModelVisibleContent('error_search', payload);
      expect(mvcContent).toContain('<\\/tag>');
      expect(mvcContent).toContain('<\\/script>');
      expect(mvcContent).toContain('<\\/div>');
      expect(mvcContent).not.toContain('</tag>');
      expect(mvcContent).not.toContain('</script>');
      expect(mvcContent).not.toContain('</div>');
    });
  });

  describe('memory_search 渲染器', () => {
    it('必须完整呈现所有记忆条目的 required 字段', () => {
      const payload: LrnevToolPayload<Memory[]> = {
        response_version: '1',
        ok: true,
        data: [
          {
            id: 'mem-001',
            category: 'preferences',
            scope: 'global',
            source: '对话',
            created: '2024-01-01T00:00:00Z',
            reference_count: 5,
            path: '/path/to/memory.md',
            content: '用户偏好使用 TypeScript',
          },
        ],
      };

      const content = memorySearchRenderer.render(payload);

      expect(content).toContain('mem-001');
      expect(content).toContain('preferences');
      expect(content).toContain('用户偏好使用 TypeScript');
    });

    it('用户文本保持未逃逸输出，最终由 MVC 统一转义口转义', () => {
      const payload: LrnevToolPayload<Memory[]> = {
        response_version: '1',
        ok: true,
        data: [
          {
            id: 'mem-003',
            category: 'facts',
            scope: 'global',
            source: '文档',
            created: '2024-01-01T00:00:00Z',
            reference_count: 0,
            path: '/path/to/memory.md',
            content: '代码中包含 </component> 闭合标签',
          },
        ],
      };

      const content = memorySearchRenderer.render(payload);

      // 新契约：渲染器返回未逃逸文本，用户文本中的 </component> 原样保留
      expect(content).toContain('</component>');

      // 最终转义由 MVC 统一转义口（renderModelVisibleContent）保证：</ → <\/
      const mvcContent = renderModelVisibleContent('memory_search', payload);
      expect(mvcContent).toContain('<\\/component>');
      expect(mvcContent).not.toContain('</component>');
    });
  });
});
