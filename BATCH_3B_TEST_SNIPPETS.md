# M2 第 3 批 B 组测试代码片段

以下测试代码片段应插入到 `tests/unit/renderers.test.ts` 文件中。

## 1. error_search 测试

```typescript
describe('error_search 渲染器', () => {
  it('必须完整呈现所有错误条目的 required 字段', () => {
    const payload: LrnevToolPayload<ErrorEntry[]> = {
      response_version: '1',
      ok: true,
      data: [
        {
          id: 'E-001',
          fingerprint: 'abc123',
          status: 'incident',
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
        {
          id: 'E-002',
          fingerprint: 'def456',
          status: 'promoted',
          scope: 'global',
          occurrence_count: 1,
          first_seen: '2024-01-02T00:00:00Z',
          last_seen: '2024-01-02T00:00:00Z',
          promoted_at: '2024-01-05T00:00:00Z',
          path: '/path/to/error2.md',
          body: {
            symptom: 'tsc 失败',
            root_cause: '类型错误',
            fix_action: '修复类型定义',
            verification: '运行 tsc 通过',
          },
          tags: ['typescript', 'build'],
        },
      ],
    };

    const content = errorSearchRenderer.render(payload);

    // Required 字段断言：id, fingerprint, status, occurrence_count
    expect(content).toContain('E-001');
    expect(content).toContain('abc123');
    expect(content).toContain('incident');
    expect(content).toContain('出现次数: 3');

    expect(content).toContain('E-002');
    expect(content).toContain('def456');
    expect(content).toContain('promoted');
    expect(content).toContain('出现次数: 1');

    // 用户文本字段（symptom/root_cause/fix_action）
    expect(content).toContain('ready gate 缺 headings');
    expect(content).toContain('没填 requirements');
    expect(content).toContain('补充 ## 需求 章节');
    expect(content).toContain('tsc 失败');
    expect(content).toContain('类型错误');
    expect(content).toContain('修复类型定义');

    // verification 和 tags
    expect(content).toContain('运行 tsc 通过');
    expect(content).toContain('typescript');
    expect(content).toContain('build');
  });

  it('必须逃逸用户文本中的框架标记', () => {
    const payload: LrnevToolPayload<ErrorEntry[]> = {
      response_version: '1',
      ok: true,
      data: [
        {
          id: 'E-003',
          fingerprint: 'xyz789',
          status: 'incident',
          scope: 'global',
          occurrence_count: 1,
          first_seen: '2024-01-01T00:00:00Z',
          last_seen: '2024-01-01T00:00:00Z',
          path: '/path/to/error.md',
          body: {
            symptom: '错误信息包含 </tag> 闭合标签',
            root_cause: 'HTML 注入导致 </script> 标签',
            fix_action: '转义 </div> 标签',
            verification: '测试 </html> 闭合',
          },
        },
      ],
    };

    const content = errorSearchRenderer.render(payload);

    // 必须逃逸 </ 为 <\/
    expect(content).toContain('<\\/tag>');
    expect(content).toContain('<\\/script>');
    expect(content).toContain('<\\/div>');
    expect(content).toContain('<\\/html>');

    // 不应包含未逃逸的 </
    expect(content).not.toMatch(/<\/(?!\\)/);
  });

  it('空结果时必须明确说明无匹配', () => {
    const payload: LrnevToolPayload<ErrorEntry[]> = {
      response_version: '1',
      ok: true,
      data: [],
      ai_followup: {
        instructions: [
          'error_search 是零模型关键词检索、无语义召回：未命中时请换记录原文的关键词/错误码/文件名重试，不要用近义改述（I-14）。',
        ],
      },
    };

    const content = errorSearchRenderer.render(payload);

    expect(content).toContain('找到 0 个错误条目');
    expect(content).toContain('无匹配结果');
  });

  it('必须投影 ai_followup.instructions', () => {
    const payload: LrnevToolPayload<ErrorEntry[]> = {
      response_version: '1',
      ok: true,
      data: [],
      ai_followup: {
        instructions: [
          'error_search 是零模型关键词检索、无语义召回：未命中时请换记录原文的关键词/错误码/文件名重试，不要用近义改述（I-14）。',
        ],
      },
    };

    const content = errorSearchRenderer.render(payload);

    expect(content).toContain('error_search 是零模型关键词检索');
    expect(content).toContain('不要用近义改述');
  });

  it('禁止硬编码 paraphrase', () => {
    const payload: LrnevToolPayload<ErrorEntry[]> = {
      response_version: '1',
      ok: true,
      data: [],
    };

    const content = errorSearchRenderer.render(payload);

    // 不应包含自创的 paraphrase 文案
    expect(content).not.toContain('💡');
    expect(content).not.toContain('建议');
  });
});

## 2. memory_search 测试

```typescript
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
        {
          id: 'mem-002',
          category: 'decisions',
          scope: 'global',
          source: 'ADR-001',
          created: '2024-01-02T00:00:00Z',
          reference_count: 2,
          tentative: true,
          path: '/path/to/memory2.md',
          content: '决定采用 MVC 架构',
        },
      ],
    };

    const content = memorySearchRenderer.render(payload);

    // Required 字段断言：id, category, content, source, created
    expect(content).toContain('mem-001');
    expect(content).toContain('preferences');
    expect(content).toContain('用户偏好使用 TypeScript');
    expect(content).toContain('对话');
    expect(content).toContain('2024-01-01T00:00:00Z');
    expect(content).toContain('引用次数: 5');

    expect(content).toContain('mem-002');
    expect(content).toContain('decisions');
    expect(content).toContain('决定采用 MVC 架构');
    expect(content).toContain('ADR-001');
    expect(content).toContain('不确定: 是');
  });

  it('必须逃逸用户文本中的框架标记', () => {
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
          content: '代码中包含 </component> 闭合标签和 </div> 元素',
        },
      ],
    };

    const content = memorySearchRenderer.render(payload);

    // 必须逃逸 </ 为 <\/
    expect(content).toContain('<\\/component>');
    expect(content).toContain('<\\/div>');

    // 不应包含未逃逸的 </
    expect(content).not.toMatch(/<\/(?!\\)/);
  });

  it('空结果时必须明确说明无匹配', () => {
    const payload: LrnevToolPayload<Memory[]> = {
      response_version: '1',
      ok: true,
      data: [],
    };

    const content = memorySearchRenderer.render(payload);

    expect(content).toContain('找到 0 条记忆');
    expect(content).toContain('无匹配结果');
  });

  it('必须投影 ai_followup.instructions（如有）', () => {
    const payload: LrnevToolPayload<Memory[]> = {
      response_version: '1',
      ok: true,
      data: [],
      ai_followup: {
        instructions: ['记忆搜索完成，无匹配结果。'],
      },
    };

    const content = memorySearchRenderer.render(payload);

    expect(content).toContain('记忆搜索完成');
  });

  it('禁止硬编码 paraphrase', () => {
    const payload: LrnevToolPayload<Memory[]> = {
      response_version: '1',
      ok: true,
      data: [],
    };

    const content = memorySearchRenderer.render(payload);

    // 不应包含自创的 paraphrase 文案
    expect(content).not.toContain('💡');
    expect(content).not.toContain('建议参考');
  });
});

## 3. lrnev_hook_list 测试

```typescript
describe('lrnev_hook_list 渲染器', () => {
  it('必须完整呈现所有 hooks 配置的 required 字段', () => {
    const payload: LrnevToolPayload<HookListResult> = {
      response_version: '1',
      ok: true,
      data: {
        implemented: true,
        hooks: [
          {
            name: 'notify-on-complete',
            event: 'task.update.completed',
            command: ['echo', 'Task completed'],
            timeout_ms: 5000,
            mode: 'async',
            enabled: true,
            env: {},
            on_failure: 'warn',
          },
          {
            name: 'validate-spec',
            event: 'spec.create',
            command: 'npm run validate',
            timeout_ms: 10000,
            mode: 'sync',
            enabled: false,
            env: { NODE_ENV: 'test' },
            cwd: '/path/to/project',
            on_failure: 'abort',
          },
        ],
        recent: [
          {
            ts: '2024-01-01T12:00:00Z',
            event: 'task.update.completed',
            hook: 'notify-on-complete',
            mode: 'async',
            status: 'success',
            duration_ms: 150,
            exit_code: 0,
          },
          {
            ts: '2024-01-01T12:05:00Z',
            event: 'spec.create',
            hook: 'validate-spec',
            mode: 'sync',
            status: 'failed',
            duration_ms: 3000,
            exit_code: 1,
            stderr_tail: 'Validation error: missing field',
          },
        ],
        config_path: '.lrnev/config/hooks.json',
        issues: [],
      },
    };

    const content = lrnevHookListRenderer.render(payload);

    // Hook 配置 required 字段
    expect(content).toContain('notify-on-complete');
    expect(content).toContain('task.update.completed');
    expect(content).toContain('echo Task completed');
    expect(content).toContain('启用: 是');
    expect(content).toContain('模式: async');
    expect(content).toContain('超时: 5000ms');

    expect(content).toContain('validate-spec');
    expect(content).toContain('spec.create');
    expect(content).toContain('npm run validate');
    expect(content).toContain('启用: 否');
    expect(content).toContain('模式: sync');
    expect(content).toContain('工作目录: /path/to/project');

    // Recent records required 字段
    expect(content).toContain('2024-01-01T12:00:00Z');
    expect(content).toContain('success');
    expect(content).toContain('150ms');
    expect(content).toContain('exit=0');

    expect(content).toContain('2024-01-01T12:05:00Z');
    expect(content).toContain('failed');
    expect(content).toContain('3000ms');
    expect(content).toContain('exit=1');
    expect(content).toContain('Validation error: missing field');

    // Config path
    expect(content).toContain('.lrnev/config/hooks.json');
  });

  it('必须呈现 issues 配置问题', () => {
    const payload: LrnevToolPayload<HookListResult> = {
      response_version: '1',
      ok: true,
      data: {
        implemented: true,
        hooks: [],
        recent: [],
        config_path: '.lrnev/config/hooks.json',
        issues: [
          {
            code: 'HOOK_CONFIG_INVALID',
            index: 0,
            message: 'Hook name 重复：test-hook',
            path: '.lrnev/config/hooks.json',
          },
          {
            code: 'HOOK_CONFIG_INVALID',
            name: 'bad-hook',
            message: 'cwd 不存在',
            path: '.lrnev/config/hooks.json',
          },
        ],
      },
    };

    const content = lrnevHookListRenderer.render(payload);

    expect(content).toContain('配置问题（2 个）');
    expect(content).toContain('[索引 0]');
    expect(content).toContain('Hook name 重复：test-hook');
    expect(content).toContain('[bad-hook]');
    expect(content).toContain('cwd 不存在');
  });

  it('空配置时必须明确说明', () => {
    const payload: LrnevToolPayload<HookListResult> = {
      response_version: '1',
      ok: true,
      data: {
        implemented: true,
        hooks: [],
        recent: [],
        config_path: '.lrnev/config/hooks.json',
        issues: [],
      },
    };

    const content = lrnevHookListRenderer.render(payload);

    expect(content).toContain('Hook 配置列表（0 个）');
    expect(content).toContain('当前没有 hook 配置');
  });

  it('必须投影 ai_followup.instructions', () => {
    const payload: LrnevToolPayload<HookListResult> = {
      response_version: '1',
      ok: true,
      data: {
        implemented: true,
        hooks: [],
        recent: [],
        config_path: '.lrnev/config/hooks.json',
        issues: [],
      },
      ai_followup: {
        instructions: ['当前没有 hook 配置；需要扩展自动化时在 .lrnev/config/hooks.json 中添加配置。'],
      },
    };

    const content = lrnevHookListRenderer.render(payload);

    expect(content).toContain('需要扩展自动化时在');
  });

  it('禁止硬编码 paraphrase', () => {
    const payload: LrnevToolPayload<HookListResult> = {
      response_version: '1',
      ok: true,
      data: {
        implemented: true,
        hooks: [],
        recent: [],
        config_path: '.lrnev/config/hooks.json',
        issues: [],
      },
    };

    const content = lrnevHookListRenderer.render(payload);

    // 不应包含自创的 paraphrase 文案
    expect(content).not.toContain('💡');
    expect(content).not.toContain('温馨提示');
  });
});

## 4. lrnev_hook_tail_log 测试

```typescript
describe('lrnev_hook_tail_log 渲染器', () => {
  it('必须完整呈现所有日志记录的 required 字段', () => {
    const payload: LrnevToolPayload<HookRecord[]> = {
      response_version: '1',
      ok: true,
      data: [
        {
          ts: '2024-01-01T12:00:00Z',
          event: 'task.update.completed',
          hook: 'notify-slack',
          mode: 'async',
          status: 'success',
          duration_ms: 250,
          exit_code: 0,
          stdout_tail: 'Notification sent successfully',
        },
        {
          ts: '2024-01-01T12:05:00Z',
          event: 'spec.create',
          hook: 'run-tests',
          mode: 'sync',
          status: 'failed',
          duration_ms: 5000,
          exit_code: 1,
          stderr_tail: 'Test suite failed: 3 errors',
        },
        {
          ts: '2024-01-01T12:10:00Z',
          event: 'task.update.in_progress',
          hook: 'update-tracker',
          mode: 'async',
          status: 'timeout',
          duration_ms: 10000,
          exit_code: 124,
        },
      ],
    };

    const content = lrnevHookTailLogRenderer.render(payload);

    // Required 字段断言：ts, hook, event, status, mode, duration_ms, exit_code
    expect(content).toContain('2024-01-01T12:00:00Z');
    expect(content).toContain('notify-slack');
    expect(content).toContain('task.update.completed');
    expect(content).toContain('success');
    expect(content).toContain('async');
    expect(content).toContain('250ms');
    expect(content).toContain('退出码: 0');
    expect(content).toContain('Notification sent successfully');

    expect(content).toContain('2024-01-01T12:05:00Z');
    expect(content).toContain('run-tests');
    expect(content).toContain('spec.create');
    expect(content).toContain('failed');
    expect(content).toContain('sync');
    expect(content).toContain('5000ms');
    expect(content).toContain('退出码: 1');
    expect(content).toContain('Test suite failed: 3 errors');

    expect(content).toContain('timeout');
    expect(content).toContain('10000ms');
    expect(content).toContain('退出码: 124');
  });

  it('空日志时必须明确说明', () => {
    const payload: LrnevToolPayload<HookRecord[]> = {
      response_version: '1',
      ok: true,
      data: [],
    };

    const content = lrnevHookTailLogRenderer.render(payload);

    expect(content).toContain('最近 0 条 Hook 执行日志');
    expect(content).toContain('无执行记录');
  });

  it('必须投影 ai_followup.instructions', () => {
    const payload: LrnevToolPayload<HookRecord[]> = {
      response_version: '1',
      ok: true,
      data: [],
      ai_followup: {
        instructions: ['已读取最近 hook 执行日志；如发现 failed/timeout，请结合 stderr_tail 修 hooks.json 后再运行 hook trigger 验证。'],
      },
    };

    const content = lrnevHookTailLogRenderer.render(payload);

    expect(content).toContain('已读取最近 hook 执行日志');
    expect(content).toContain('如发现 failed/timeout');
  });

  it('禁止硬编码 paraphrase', () => {
    const payload: LrnevToolPayload<HookRecord[]> = {
      response_version: '1',
      ok: true,
      data: [],
    };

    const content = lrnevHookTailLogRenderer.render(payload);

    // 不应包含自创的 paraphrase 文案
    expect(content).not.toContain('💡');
    expect(content).not.toContain('提示');
  });
});
```

## 导入语句（需添加到 renderers.test.ts 顶部）

```typescript
import { errorSearchRenderer } from '../../src/mcp/helpers/renderers/error-search.js';
import { memorySearchRenderer } from '../../src/mcp/helpers/renderers/memory-search.js';
import { lrnevHookListRenderer } from '../../src/mcp/helpers/renderers/lrnev-hook-list.js';
import { lrnevHookTailLogRenderer } from '../../src/mcp/helpers/renderers/lrnev-hook-tail-log.js';
import type { ErrorEntry } from '../../src/types/errorbook.js';
import type { Memory } from '../../src/types/memory.js';
import type { HookListResult, HookRecord } from '../../src/types/hooks.js';
```
