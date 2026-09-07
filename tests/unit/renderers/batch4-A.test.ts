/**
 * M2 第 4 批 A 组渲染器测试（独立文件）
 *
 * 4 个 list/inspection 类工具：
 * - governance_map
 * - lrnev_report
 * - project_status
 * - adr_list
 *
 * 验收要点：
 * 1. required 字段完整呈现
 * 2. 无硬编码 paraphrase（否定断言）
 * 3. ai_followup 正确投影
 * 4. escapeFrameworkMarkers 逃逸验证（lrnev_report）
 */

import { describe, it, expect } from 'vitest';
import { governanceMapRenderer } from '../../../src/mcp/helpers/renderers/governance-map.js';
import { lrnevReportRenderer } from '../../../src/mcp/helpers/renderers/lrnev-report.js';
import { projectStatusRenderer } from '../../../src/mcp/helpers/renderers/project-status.js';
import { adrListRenderer } from '../../../src/mcp/helpers/renderers/adr-list.js';
import { escapeFrameworkMarkers } from '../../../src/mcp/helpers/model-visible-contract.js';
import type { LrnevToolPayload } from '../../../src/mcp/types/response-envelope.js';
import type { GovernanceMapResult } from '../../../src/types/governance-map.js';
import type { GovernanceReportResult } from '../../../src/types/governance-report.js';
import type { ProjectStatusSnapshot } from '../../../src/types/project-status.js';
import type { ADR } from '../../../src/types/adr.js';

describe('M2 第 4 批 A 组渲染器', () => {
  describe('governance_map 渲染器', () => {
    it('应呈现完整层级：scene→spec（status/L0）→anchors', () => {
      const payload: LrnevToolPayload<GovernanceMapResult> = {
        response_version: '1',
        ok: true,
        data: {
          generated_at: '2026-09-02T10:00:00Z',
          scenes: [
            {
              scene: '01-auth',
              name: 'Authentication',
              status: 'active',
              intent: 'User authentication system',
              specs: [
                {
                  spec: '01-01-login',
                  name: 'Login',
                  status: 'completed',
                  priority: 'P0',
                  l0: 'User login with email and password',
                  anchors: [
                    '#### F-01 用户输入',
                    '#### F-02 验证逻辑',
                    '#### D-01 数据库查询',
                  ],
                },
              ],
            },
          ],
        },
        ai_followup: {
          instructions: [
            '这是治理全景（scene→spec→锚点标题）。按需用 context://spec/<scene>/<spec> 或 context_search 跳到具体段落，别全文通读。',
          ],
        },
      };

      const content = governanceMapRenderer.render(payload);

      // Required 字段：scene, spec, status
      expect(content).toContain('Scene: 01-auth - Authentication');
      expect(content).toContain('状态: active');
      expect(content).toContain('意图: User authentication system');
      expect(content).toContain('Spec: 01-01-login - Login [P0]');
      expect(content).toContain('状态: completed');

      // L0 标题
      expect(content).toContain('L0: User login with email and password');

      // 完整锚点列表
      expect(content).toContain('#### F-01 用户输入');
      expect(content).toContain('#### F-02 验证逻辑');
      expect(content).toContain('#### D-01 数据库查询');

      // ai_followup 投影
      expect(content).toContain('这是治理全景');
    });

    it('应正确处理空 spec 列表', () => {
      const payload: LrnevToolPayload<GovernanceMapResult> = {
        response_version: '1',
        ok: true,
        data: {
          generated_at: '2026-09-02T10:00:00Z',
          scenes: [
            {
              scene: '00-default',
              name: 'Default',
              status: 'active',
              specs: [],
            },
          ],
        },
      };

      const content = governanceMapRenderer.render(payload);
      expect(content).toContain('（无 Spec）');
    });

    it('不应硬编码 paraphrase', () => {
      const payload: LrnevToolPayload<GovernanceMapResult> = {
        response_version: '1',
        ok: true,
        data: {
          generated_at: '2026-09-02T10:00:00Z',
          scenes: [],
        },
      };

      const content = governanceMapRenderer.render(payload);

      // 否定断言：不应有与 guidance-semantics 无关的硬编码建议文本
      expect(content).not.toMatch(/建议.*开.*Spec/i);
      expect(content).not.toMatch(/推荐.*创建/i);
    });
  });

  describe('lrnev_report 渲染器', () => {
    it('应呈现完整欠债清单和覆盖率', () => {
      const payload: LrnevToolPayload<GovernanceReportResult> = {
        response_version: '1',
        ok: true,
        data: {
          generated_at: '2026-09-02T10:00:00Z',
          scope: 'all',
          headline: '发现治理欠债：1 个 spec 做完未收口、1 个任务失败。',
          chain: {
            scene_count: 1,
            spec_count: 1,
            task_count: 3,
            scenes: [
              {
                scene: '01-auth',
                name: 'Authentication',
                spec_count: 1,
                task_count: 3,
                empty: false,
              },
            ],
            unclosed: [
              {
                scene: '01-auth',
                spec: '01-01-login',
                name: 'Login',
                done: 3,
                total: 3,
                status: 'in-progress',
                paths: {
                  uri: 'context://spec/01-auth/01-01-login',
                  requirements_path: '/path/to/requirements.md',
                  tasks_path: '/path/to/tasks.md',
                },
                next_action: '跑 spec_gate_check(scene=01-auth, spec=01-01-login, gate=completion)；通过后 spec_update 把 status 改成 completed 收口。',
              },
            ],
            failed_tasks: [
              {
                scene: '01-auth',
                spec: '01-01-login',
                id: 'T-003',
                title: '集成测试</failed>',
                status: 'failed',
                next_action: '用 error_record 记录失败根因，修复后 task_update(T-003, status=pending) 重试。',
              },
            ],
            blocked_tasks: [],
          },
          coverage: {
            anchor_total: 5,
            anchor_covered: 3,
            coverage_ratio: 0.6,
            in_flight_orphans: [],
            debt_orphans: [],
            broken_validates: [],
            archived_excluded: 0,
          },
        },
        ai_followup: {
          instructions: [
            '这是治理体检快照（链路完整度 + validates 覆盖率）。先看 headline，再按 unclosed / failed / 孤儿锚点逐条处理。',
          ],
        },
      };

      const content = lrnevReportRenderer.render(payload);

      // Required 字段：headline, chain, coverage
      expect(content).toContain('发现治理欠债：1 个 spec 做完未收口、1 个任务失败。');
      expect(content).toContain('Scene 数: 1');
      expect(content).toContain('Spec 数: 1');
      expect(content).toContain('Task 数: 3');

      // 未收口 Spec（欠债清单）
      expect(content).toContain('未收口 Spec');
      expect(content).toContain('**01-auth/01-01-login** - Login');
      expect(content).toContain('已完成: 3/3 tasks');
      expect(content).toContain('跑 spec_gate_check');

      // Failed tasks（欠债清单，含用户文本）
      expect(content).toContain('失败任务');
      expect(content).toContain('T-003');
      expect(content).toContain('集成测试</failed>'); // 用户文本（未逃逸，由统一逃逸层处理）

      // Coverage 统计
      expect(content).toContain('总锚点数: 5');
      expect(content).toContain('已覆盖: 3');
      expect(content).toContain('覆盖率: 60.0%');

      // ai_followup 投影
      expect(content).toContain('这是治理体检快照');
    });

    it('应处理 release_notes 和 warnings', () => {
      const payload: LrnevToolPayload<GovernanceReportResult> = {
        response_version: '1',
        ok: true,
        data: {
          generated_at: '2026-09-02T10:00:00Z',
          scope: 'all',
          headline: '治理债：无硬欠债。',
          chain: {
            scene_count: 0,
            spec_count: 0,
            task_count: 0,
            scenes: [],
            unclosed: [],
            failed_tasks: [],
            blocked_tasks: [],
          },
          coverage: {
            anchor_total: 0,
            anchor_covered: 0,
            coverage_ratio: 1,
            in_flight_orphans: [],
            debt_orphans: [],
            broken_validates: [],
            archived_excluded: 0,
          },
          release_notes: {
            scenes: [
              {
                scene: '01-auth',
                name: 'Authentication',
                specs: [
                  {
                    spec: '01-01-login',
                    name: 'Login',
                    tasks: ['实现登录接口', '添加单元测试'],
                  },
                ],
              },
            ],
          },
          warnings: ['发现 2 处坏 validates（指向不存在/废弃锚点），不计入覆盖率；详细修复请运行 lrnev doctor。'],
        },
      };

      const content = lrnevReportRenderer.render(payload);

      // Release notes
      expect(content).toContain('Release Notes');
      expect(content).toContain('01-auth - Authentication');
      expect(content).toContain('实现登录接口');
      expect(content).toContain('添加单元测试');

      // Warnings
      expect(content).toContain('警告');
      expect(content).toContain('发现 2 处坏 validates');
    });

    it('用户文本经统一逃逸层处理后应正确逃逸', () => {
      const payload: LrnevToolPayload<GovernanceReportResult> = {
        response_version: '1',
        ok: true,
        data: {
          generated_at: '2026-09-02T10:00:00Z',
          scope: 'all',
          headline: '治理债：无硬欠债。',
          chain: {
            scene_count: 1,
            spec_count: 1,
            task_count: 1,
            scenes: [],
            unclosed: [],
            failed_tasks: [
              {
                scene: '01-auth',
                spec: '01-01-login',
                id: 'T-001',
                title: 'Fix </script> injection',
                status: 'failed',
              },
            ],
            blocked_tasks: [],
          },
          coverage: {
            anchor_total: 0,
            anchor_covered: 0,
            coverage_ratio: 1,
            in_flight_orphans: [],
            debt_orphans: [],
            broken_validates: [],
            archived_excluded: 0,
          },
        },
      };

      // 渲染器返回未逃逸内容
      const rawContent = lrnevReportRenderer.render(payload);
      expect(rawContent).toContain('Fix </script> injection');

      // 统一逃逸层处理
      const escapedContent = escapeFrameworkMarkers(rawContent);
      expect(escapedContent).toContain('Fix <\\/script> injection');
      expect(escapedContent).not.toContain('</script>');
    });

    it('不应硬编码 paraphrase', () => {
      const payload: LrnevToolPayload<GovernanceReportResult> = {
        response_version: '1',
        ok: true,
        data: {
          generated_at: '2026-09-02T10:00:00Z',
          scope: 'all',
          headline: '治理债：无硬欠债。',
          chain: {
            scene_count: 0,
            spec_count: 0,
            task_count: 0,
            scenes: [],
            unclosed: [],
            failed_tasks: [],
            blocked_tasks: [],
          },
          coverage: {
            anchor_total: 0,
            anchor_covered: 0,
            coverage_ratio: 1,
            in_flight_orphans: [],
            debt_orphans: [],
            broken_validates: [],
            archived_excluded: 0,
          },
        },
      };

      const content = lrnevReportRenderer.render(payload);

      // 否定断言：不应有硬编码建议文本
      expect(content).not.toMatch(/建议.*先.*再/i);
      expect(content).not.toMatch(/推荐.*使用/i);
    });
  });

  describe('project_status 渲染器', () => {
    it('应呈现 active tasks, specs, agents, ADRs, errors', () => {
      const payload: LrnevToolPayload<ProjectStatusSnapshot> = {
        response_version: '1',
        ok: true,
        data: {
          generated_at: '2026-09-02T10:00:00Z',
          scenes: [
            {
              id: '01-auth',
              name: 'Authentication',
              status: 'active',
              spec_count: 2,
            },
          ],
          specs: [
            {
              scene: '01-auth',
              spec: '01-01-login',
              name: 'Login',
              number: 1,
              version: 0,
              status: 'in-progress',
              priority: 'P0',
              created: '2026-09-01',
              active_task_count: 1,
              task_counts: {
                pending: 2,
                in_progress: 1,
                blocked: 0,
                completed: 3,
                failed: 0,
              },
              free_tasks_count: 2,
              claimable_next: [
                {
                  id: 'T-004',
                  title: '添加密码加密',
                  depends_on: ['T-003'],
                },
              ],
            },
          ],
          active_agents: [
            {
              agent_id: 'agent-a',
              status: 'active',
              active_claims: [
                {
                  scene: '01-auth',
                  spec: '01-01-login',
                  task: 'T-001',
                  touches_files: ['src/auth/login.ts'],
                },
              ],
              client: 'claude-code',
              last_heartbeat: '2026-09-02T10:00:00Z',
              current_task_hint: 'T-001 实现登录接口',
            },
          ],
          active_tasks: [
            {
              scene: '01-auth',
              spec: '01-01-login',
              id: 'T-001',
              title: '实现登录接口',
              status: 'in_progress',
              created: '2026-09-01T10:00:00Z',
              updated: '2026-09-02T09:00:00Z',
            },
          ],
          recent_adrs: [
            {
              scope: 'global',
              number: '0001',
              title: '使用 JWT 认证',
              status: 'accepted',
              created: '2026-09-01',
              path: '/path/to/adr/0001.md',
            },
          ],
          open_errors: [
            {
              scope: 'scene:01-auth',
              id: 'error-001',
              status: 'open',
              last_seen: '2026-09-02',
              path: '/path/to/error.md',
            },
          ],
        },
        ai_followup: {
          instructions: [
            '从 active_tasks 里的 in_progress / blocked Task 接手；需要细节时再调用 spec_get。',
          ],
        },
      };

      const content = projectStatusRenderer.render(payload);

      // Scenes 格式：**id** (name): status | N specs
      expect(content).toContain('**01-auth** (Authentication): active | 2 specs');

      // Active tasks（完整）
      expect(content).toContain('Active Tasks');
      expect(content).toContain('**T-001** - 实现登录接口');
      expect(content).toContain('状态: in_progress');
      expect(content).toContain('创建: 2026-09-01T10:00:00Z');
      expect(content).toContain('更新: 2026-09-02T09:00:00Z');

      // Specs（含 task_counts 和 claimable_next）
      expect(content).toContain('01-auth/01-01-login - Login [P0]');
      expect(content).toContain('状态: in-progress | 版本: 1-0');
      expect(content).toContain('Task 统计: pending=2, in_progress=1, blocked=0, completed=3, failed=0');
      expect(content).toContain('活跃任务数: 1');
      expect(content).toContain('可领任务数: 2');
      expect(content).toContain('T-004: 添加密码加密 (依赖: T-003)');

      // Active agents 格式：**agent_id** (status)
      expect(content).toContain('**agent-a** (active)');
      expect(content).toContain('客户端: claude-code');
      expect(content).toContain('当前任务: T-001 实现登录接口');
      expect(content).toContain('01-auth/01-01-login/T-001 (涉及: src/auth/login.ts)');

      // Recent ADRs
      expect(content).toContain('Recent ADRs');
      expect(content).toContain('[global] 0001: 使用 JWT 认证 (accepted) - 2026-09-01');

      // Open errors
      expect(content).toContain('Open Errors');
      expect(content).toContain('[scene:01-auth] error-001 (open) - 最近: 2026-09-02');

      // ai_followup 投影
      expect(content).toContain('从 active_tasks 里的 in_progress / blocked Task 接手');
    });

    it('F-04.2: spec.claimable_meta.truncated 时追加可领预览省略行', () => {
      const payload: LrnevToolPayload<ProjectStatusSnapshot> = {
        response_version: '1',
        ok: true,
        data: {
          generated_at: '2026-09-02T10:00:00Z',
          scenes: [],
          specs: [
            {
              scene: '01-auth',
              spec: '01-01-login',
              name: 'Login',
              number: 1,
              version: 0,
              status: 'in-progress',
              active_task_count: 0,
              task_counts: {
                pending: 2,
                in_progress: 0,
                blocked: 0,
                completed: 0,
                failed: 0,
              },
              free_tasks_count: 2,
              claimable_next: [
                {
                  id: 'T-001',
                  title: '添加密码加密',
                },
              ],
              claimable_meta: {
                returned_count: 1,
                total_count: 2,
                truncated: true,
                omitted: { kind: 'exact', count: 1 },
              },
            },
          ],
          active_agents: [],
          active_tasks: [],
          recent_adrs: [],
          open_errors: [],
        },
      };

      const content = projectStatusRenderer.render(payload);

      expect(content).toContain('可领任务预览已省略：共 2 条只预览 1 条');
    });

    it('应正确处理空列表', () => {
      const payload: LrnevToolPayload<ProjectStatusSnapshot> = {
        response_version: '1',
        ok: true,
        data: {
          generated_at: '2026-09-02T10:00:00Z',
          scenes: [],
          specs: [],
          active_agents: [],
          active_tasks: [],
          recent_adrs: [],
          open_errors: [],
        },
      };

      const content = projectStatusRenderer.render(payload);

      expect(content).toContain('（无 Scene）');
      expect(content).toContain('当前没有 in_progress / blocked Task');
      expect(content).toContain('（无 Spec）');
      expect(content).toContain('（无活跃 Agent）');
      expect(content).toContain('（无最近 ADR）');
      expect(content).toContain('（无打开的错误）');
    });

    it('不应硬编码 paraphrase', () => {
      const payload: LrnevToolPayload<ProjectStatusSnapshot> = {
        response_version: '1',
        ok: true,
        data: {
          generated_at: '2026-09-02T10:00:00Z',
          scenes: [],
          specs: [],
          active_agents: [],
          active_tasks: [],
          recent_adrs: [],
          open_errors: [],
        },
      };

      const content = projectStatusRenderer.render(payload);

      // 否定断言：不应有硬编码建议文本
      expect(content).not.toMatch(/建议.*调用/i);
      expect(content).not.toMatch(/推荐.*使用/i);
    });
  });

  describe('adr_list 渲染器', () => {
    it('应呈现完整 ADR 列表和 supersedes 关系', () => {
      const payload: LrnevToolPayload<ADR[]> = {
        response_version: '1',
        ok: true,
        data: [
          {
            number: '0001',
            title: '使用 TypeScript',
            status: 'accepted',
            scope: 'global',
            created: '2026-09-01',
            date: '2026-09-01',
            path: '/path/to/0001.md',
            body: {
              context: '需要类型安全',
              decision: '使用 TypeScript',
              alternatives: ['JavaScript', 'Flow'],
              consequences: '需要编译步骤',
            },
          },
          {
            number: '0002',
            title: '使用 JWT 认证',
            status: 'proposed',
            scope: 'global',
            created: '2026-09-02',
            date: '2026-09-02',
            supersedes: ['0001'],
            path: '/path/to/0002.md',
            body: {
              context: '需要无状态认证',
              decision: '使用 JWT',
              alternatives: ['Session'],
              consequences: '无法撤销',
            },
          },
          {
            number: '0001',
            title: '使用 PostgreSQL',
            status: 'accepted',
            scope: 'scene:01-auth',
            created: '2026-09-01',
            date: '2026-09-01',
            superseded_by: ['0002'],
            path: '/path/to/scene/0001.md',
            body: {
              context: '需要关系型数据库',
              decision: '使用 PostgreSQL',
              alternatives: ['MySQL', 'MongoDB'],
              consequences: '需要运维',
            },
          },
        ],
      };

      const content = adrListRenderer.render(payload);

      // 全局 ADR
      expect(content).toContain('全局 ADR');
      expect(content).toContain('0001. 使用 TypeScript');
      expect(content).toContain('状态: accepted');
      expect(content).toContain('创建: 2026-09-01');

      // supersedes 关系
      expect(content).toContain('0002. 使用 JWT 认证');
      expect(content).toContain('取代: 0001');

      // Scene ADR
      expect(content).toContain('scene:01-auth ADR');
      expect(content).toContain('0001. 使用 PostgreSQL');
      expect(content).toContain('被取代: 0002');
    });

    it('应正确处理空 ADR 列表', () => {
      const payload: LrnevToolPayload<ADR[]> = {
        response_version: '1',
        ok: true,
        data: [],
      };

      const content = adrListRenderer.render(payload);
      expect(content).toContain('暂无 ADR');
    });

    it('不应硬编码 paraphrase', () => {
      const payload: LrnevToolPayload<ADR[]> = {
        response_version: '1',
        ok: true,
        data: [],
      };

      const content = adrListRenderer.render(payload);

      // 否定断言：不应有硬编码建议文本
      expect(content).not.toMatch(/建议.*创建.*ADR/i);
      expect(content).not.toMatch(/推荐.*记录/i);
    });
  });
});
