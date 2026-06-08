import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('docs', () => {
  it('F-05: AI-ADAPTATION 和 README 应提供常驻提示词模板', () => {
    const aiAdaptation = readFileSync(resolve(__dirname, '../../docs/AI-ADAPTATION.md'), 'utf-8');
    const readme = readFileSync(resolve(__dirname, '../../README.md'), 'utf-8');

    for (const content of [aiAdaptation, readme]) {
      expect(content).toContain('常驻提示词');
      expect(content).toContain('本项目用 lrnev 治理');
      expect(content).toContain('project_status');
      expect(content).toContain('spec_create');
      expect(content).toContain('error_record');
      expect(content).toContain('adr_create');
      expect(content).toContain('memory_save');
      expect(content).toContain('task_update(in_progress)');
      expect(content).toContain('task_update(completed)');
      expect(content).toContain('lrnev_guide');
    }

    expect(aiAdaptation).toContain('Claude Code');
    expect(aiAdaptation).toContain('CLAUDE.md');
    expect(aiAdaptation).toContain('Cursor');
    expect(aiAdaptation).toContain('.cursor/rules');
    expect(aiAdaptation).toContain('Codex');
    expect(readme).toContain('防长对话遗忘');
    expect(readme).toContain('docs/AI-ADAPTATION.md');
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

    expect(publish).toContain('package.json name 是 "lrnev"');
    expect(publish).toContain('"version": "1.3.0"');
    expect(publish).toContain('lrnev-1.3.0.tgz');
    expect(changelog).toContain('## [1.3.0]');
    expect(changelog).toContain('spec_update');
    expect(changelog).toContain('archived');
  });
});
