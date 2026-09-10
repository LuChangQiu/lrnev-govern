import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('docs', () => {
  it('F-05: AI-ADAPTATION 提供常驻提示词模板全文，README 单源化指向', () => {
    const aiAdaptation = readFileSync(resolve(__dirname, '../../docs/AI-ADAPTATION.md'), 'utf-8');
    const readme = readFileSync(resolve(__dirname, '../../README.md'), 'utf-8');

    // 全文关键词锁只对 AI-ADAPTATION（唯一权威源）
    for (const keyword of [
      '常驻提示词',
      '本项目用',
      'project_status',
      'spec_create',
      'error_record',
      'adr_create',
      'memory_save',
      'task_update(in_progress)',
      'task_update(completed)',
      'lrnev_guide',
    ]) {
      expect(aiAdaptation).toContain(keyword);
    }

    // README 单源化（T-006/3.0.0 定案）：只锁指向，不复制全文
    expect(readme).toContain('常驻提示词');
    expect(readme).toContain('防长对话遗忘');
    expect(readme).toContain('docs/AI-ADAPTATION.md');

    expect(aiAdaptation).toContain('Claude Code');
    expect(aiAdaptation).toContain('CLAUDE.md');
    expect(aiAdaptation).toContain('Cursor');
    expect(aiAdaptation).toContain('.cursor/rules');
    expect(aiAdaptation).toContain('Codex');
  });

  it('F-06: README init 示例应使用默认目录名形式', () => {
    const readme = readFileSync(resolve(__dirname, '../../README.md'), 'utf-8');

    expect(readme).toContain('lrnev init');
    expect(readme).toContain('不传 --project-name 则默认用当前文件夹名');
    expect(readme).not.toMatch(/^lrnev init --project-name/m);
  });

  it('F-08: MULTI-AGENT 文档应说明 task claim 模型', () => {
    const content = readFileSync(resolve(__dirname, '../../docs/MULTI-AGENT.md'), 'utf-8');

    expect(content).toContain('task_claim');
    expect(content).toContain('task_release');
    expect(content).toContain('active_claims');
    expect(content).toContain('.lrnev/runtime/claims');
    expect(content).toContain('claim 是运行态');
    expect(content).toContain('FileStorage.withDirectoryLock');
  });

  it('发布文档和 CHANGELOG 应反映 lrnev 当前版本', () => {
    const publish = readFileSync(resolve(__dirname, '../../dev-docs/PUBLISH.md'), 'utf-8');
    const changelog = readFileSync(resolve(__dirname, '../../CHANGELOG.md'), 'utf-8');
    const readme = readFileSync(resolve(__dirname, '../../README.md'), 'utf-8');
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf-8')) as { version: string };

    expect(publish).toContain('package.json name 是 "lrnev"');
    // 版本号从 package.json 动态取，防止发布文档示例随版本演进漂移
    expect(publish).toContain(`"version": "${pkg.version}"`);
    expect(publish).toContain(`lrnev-${pkg.version}.tgz`);
    expect(changelog).toContain(`## [${pkg.version}]`);
    expect(changelog).toContain(`[${pkg.version}]: https://github.com/LuChangQiu/lrnev-govern/releases/tag/v${pkg.version}`);
    expect(changelog).toContain('spec_update');
    expect(changelog).toContain('archived');
    // README 不写死"当前版本"：版本真源 = package.json / npm，手写必然漂移
    // （2026-09-09 发 3.1.0 时实测漏更 3.0.0）。README 里 "3.0.0 起 / 3.0.0 升级注意"
    // 属历史语义，不在此断言范围。
    expect(readme).not.toMatch(/当前版本\s*\*\*\d+\.\d+\.\d+/);
  });
});
