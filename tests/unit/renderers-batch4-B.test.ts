/**
 * M2 第 4 批 B 组渲染器测试（3 个 inspection 类工具）
 *
 * 批次：agent_list, lrnev_guide, lrnev_doctor
 */

import { describe, it, expect } from 'vitest';
import { agentListRenderer } from '../../src/mcp/helpers/renderers/agent-list.js';
import { lrnevGuideRenderer } from '../../src/mcp/helpers/renderers/lrnev-guide.js';
import { lrnevDoctorRenderer } from '../../src/mcp/helpers/renderers/lrnev-doctor.js';
import type { LrnevToolPayload } from '../../src/mcp/types/response-envelope.js';
import type { AgentListResult } from '../../src/types/agent.js';
import type { DiagnosticReport } from '../../src/types/doctor.js';

describe('agent_list renderer', () => {
  it('renders complete agent list with all required fields', () => {
    const payload: LrnevToolPayload<AgentListResult> = {
      ok: true,
      data: {
        agents: [
          {
            agent_id: 'test-agent-1',
            pid: 12345,
            host: 'localhost',
            client: 'claude-code',
            started_at: '2026-09-02T10:00:00Z',
            last_heartbeat: '2026-09-02T10:05:00Z',
            status: 'active',
          },
          {
            agent_id: 'test-agent-2',
            pid: 67890,
            host: 'remote-host',
            started_at: '2026-09-02T09:00:00Z',
            last_heartbeat: '2026-09-02T09:30:00Z',
            status: 'dead',
          },
        ],
        registry_path: '.lrnev/agents/registry.json',
        issues: [],
      },
      ai_followup: {
        instructions: ['已读取 Agent 注册表。'],
      },
    };

    const content = agentListRenderer.render(payload);

    // Required fields: agent_id, pid, host, started_at, last_heartbeat, status
    expect(content).toContain('test-agent-1');
    expect(content).toContain('test-agent-2');
    expect(content).toContain('12345');
    expect(content).toContain('67890');
    expect(content).toContain('localhost');
    expect(content).toContain('remote-host');
    expect(content).toContain('claude-code');
    expect(content).toContain('2026-09-02T10:00:00Z');
    expect(content).toContain('2026-09-02T10:05:00Z');
    expect(content).toContain('active');
    expect(content).toContain('dead');
    expect(content).toContain('.lrnev/agents/registry.json');

    // ai_followup projection
    expect(content).toContain('已读取 Agent 注册表。');
  });

  it('renders empty agent list', () => {
    const payload: LrnevToolPayload<AgentListResult> = {
      ok: true,
      data: {
        agents: [],
        registry_path: '.lrnev/agents/registry.json',
        issues: [],
      },
      ai_followup: {
        instructions: ['当前无注册 Agent。'],
      },
    };

    const content = agentListRenderer.render(payload);

    expect(content).toContain('当前无注册 Agent');
    expect(content).toContain('.lrnev/agents/registry.json');
    expect(content).toContain('当前无注册 Agent。');
  });

  it('renders agent list with issues', () => {
    const payload: LrnevToolPayload<AgentListResult> = {
      ok: true,
      data: {
        agents: [],
        registry_path: '.lrnev/agents/registry.json',
        issues: [
          {
            code: 'AGENT_REGISTRY_INVALID',
            message: 'registry.json 损坏',
            path: '.lrnev/agents/registry.json',
          },
        ],
      },
      ai_followup: {
        instructions: ['Agent registry 损坏，已按空表降级；请运行 doctor 查看并修复。'],
      },
    };

    const content = agentListRenderer.render(payload);

    expect(content).toContain('AGENT_REGISTRY_INVALID');
    expect(content).toContain('registry.json 损坏');
    expect(content).toContain('Agent registry 损坏，已按空表降级');
  });

  it('does not contain hardcoded paraphrase', () => {
    const payload: LrnevToolPayload<AgentListResult> = {
      ok: true,
      data: {
        agents: [],
        registry_path: '.lrnev/agents/registry.json',
        issues: [],
      },
    };

    const content = agentListRenderer.render(payload);

    // Negative assertion: no guidance-like paraphrasing
    expect(content).not.toContain('建议');
    expect(content).not.toContain('推荐');
  });
});

describe('lrnev_guide renderer', () => {
  it('renders complete guide content for specific topic', () => {
    const payload: LrnevToolPayload<{ topic: string; content: string }> = {
      ok: true,
      data: {
        topic: 'workflow',
        content: '## 工作流 (workflow)\n新项目或首次接入：调用 lrnev_init 初始化 .lrnev 工作区。',
      },
      ai_followup: {
        instructions: ['已返回 工作流 小节；按其中的具体工具名继续调用。'],
      },
    };

    const content = lrnevGuideRenderer.render(payload);

    // Required fields: topic, complete content
    expect(content).toContain('lrnev 使用手册');
    expect(content).toContain('topic: workflow');
    expect(content).toContain('## 工作流 (workflow)');
    expect(content).toContain('新项目或首次接入：调用 lrnev_init 初始化 .lrnev 工作区。');
    expect(content).toContain('已返回 工作流 小节');
  });

  it('renders complete guide content for all topics', () => {
    const payload: LrnevToolPayload<{ topic: string; content: string }> = {
      ok: true,
      data: {
        topic: 'all',
        content: '## 工作流 (workflow)\n内容1\n\n## 工具速查 (tools)\n内容2',
      },
      ai_followup: {
        instructions: ['已返回 lrnev 完整手册；先按工作流判断是新建、接手、诊断还是记录轻产物。'],
      },
    };

    const content = lrnevGuideRenderer.render(payload);

    expect(content).toContain('lrnev 使用手册');
    expect(content).not.toContain('topic: all'); // 'all' 不显示 topic 标注
    expect(content).toContain('## 工作流 (workflow)');
    expect(content).toContain('## 工具速查 (tools)');
    expect(content).toContain('已返回 lrnev 完整手册');
  });

  it('does not create new guidance text', () => {
    const payload: LrnevToolPayload<{ topic: string; content: string }> = {
      ok: true,
      data: {
        topic: 'errors',
        content: '## 错误自救 (errors)\n原始内容',
      },
    };

    const content = lrnevGuideRenderer.render(payload);

    // Projection only: the content comes from guidance.ts, renderer doesn't create new text
    expect(content).toContain('原始内容');
    // The renderer should not add extra guidance beyond what's in payload
    const lineCount = content.split('\n').filter(line => line.trim()).length;
    expect(lineCount).toBeLessThan(10); // Simple projection should be concise
  });

  it('does not contain hardcoded paraphrase', () => {
    const payload: LrnevToolPayload<{ topic: string; content: string }> = {
      ok: true,
      data: {
        topic: 'concepts',
        content: '## 核心概念 (concepts)\nScene 是业务场景',
      },
    };

    const content = lrnevGuideRenderer.render(payload);

    // The renderer should only project, not paraphrase
    expect(content).toContain('Scene 是业务场景');
  });
});

describe('lrnev_doctor renderer', () => {
  it('renders complete diagnostic report with all required fields', () => {
    const payload: LrnevToolPayload<DiagnosticReport> = {
      ok: false,
      data: {
        ok: false,
        checked_at: '2026-09-02T10:30:00Z',
        summary: {
          errors: 2,
          warnings: 3,
          info: 1,
        },
        issues: [
          {
            code: 'MISSING_DIR',
            severity: 'error',
            message: '缺少标准目录：.lrnev/scenes',
            path: '.lrnev/scenes',
            suggestion: '运行 lrnev_init 或手动恢复该目录。',
          },
          {
            code: 'SPEC_DOC_MISSING',
            severity: 'error',
            message: 'Spec 缺少 requirements.md',
            path: '.lrnev/scenes/01-auth/specs/01-login/requirements.md',
            suggestion: '恢复缺失文档，或重新创建该 Spec 的文档骨架。',
          },
          {
            code: 'STALE_TASK',
            severity: 'warning',
            message: 'Task T-001 已 in_progress 超过 7 天',
            path: '.lrnev/scenes/01-auth/specs/01-login/tasks.md',
            suggestion: '确认任务是否仍在执行；必要时改为 blocked、failed 或 completed。',
          },
        ],
      },
      ai_followup: {
        instructions: ['发现 2 个错误和 3 个警告，请按修复建议处理。'],
      },
    };

    const content = lrnevDoctorRenderer.render(payload);

    // Required fields: checked_at, ok status, summary counts
    expect(content).toContain('2026-09-02T10:30:00Z');
    expect(content).toContain('✗ 发现问题');
    expect(content).toContain('错误**: 2');
    expect(content).toContain('警告**: 3');
    expect(content).toContain('信息**: 1');

    // Required fields: each issue with code, severity, message, path, suggestion
    expect(content).toContain('MISSING_DIR');
    expect(content).toContain('ERROR');
    expect(content).toContain('缺少标准目录：.lrnev/scenes');
    expect(content).toContain('.lrnev/scenes');
    expect(content).toContain('运行 lrnev_init 或手动恢复该目录。');

    expect(content).toContain('SPEC_DOC_MISSING');
    expect(content).toContain('requirements.md');
    expect(content).toContain('恢复缺失文档');

    expect(content).toContain('STALE_TASK');
    expect(content).toContain('WARNING');
    expect(content).toContain('Task T-001 已 in_progress 超过 7 天');
    expect(content).toContain('确认任务是否仍在执行');

    // ai_followup projection
    expect(content).toContain('发现 2 个错误和 3 个警告');
  });

  it('renders healthy diagnostic report', () => {
    const payload: LrnevToolPayload<DiagnosticReport> = {
      ok: true,
      data: {
        ok: true,
        checked_at: '2026-09-02T11:00:00Z',
        summary: {
          errors: 0,
          warnings: 0,
          info: 0,
        },
        issues: [],
      },
      ai_followup: {
        instructions: ['工作区健康，未发现问题。'],
      },
    };

    const content = lrnevDoctorRenderer.render(payload);

    expect(content).toContain('✓ 健康');
    expect(content).toContain('错误**: 0');
    expect(content).toContain('警告**: 0');
    expect(content).toContain('未发现问题');
    expect(content).toContain('工作区健康，未发现问题。');
  });

  it('does not contain hardcoded paraphrase', () => {
    const payload: LrnevToolPayload<DiagnosticReport> = {
      ok: true,
      data: {
        ok: true,
        checked_at: '2026-09-02T11:00:00Z',
        summary: {
          errors: 0,
          warnings: 0,
          info: 0,
        },
        issues: [],
      },
    };

    const content = lrnevDoctorRenderer.render(payload);

    // Negative assertion: no guidance creation beyond projection
    expect(content).not.toContain('建议您');
    expect(content).not.toContain('推荐');
  });
});
