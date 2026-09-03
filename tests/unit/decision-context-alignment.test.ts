/**
 * 05-00 lrnev Guidance Profile - T-003 decision_context 对齐纯函数
 *
 * Spec: 05-00-lrnev-guidance-profile（F-04/F-05/F-06、D-03/D-04）
 * Task: T-003（裁决 Q1 文本通道 / Q4 target_ref 单次对齐）
 *
 * 覆盖：
 * - shouldCompareDirection：三个落位工具参与、assess_goal/spec_update 等不参与；
 * - alignDirectionWithTool：direction × 工具类别枚举映射全覆盖
 *   （new_scene→scene_create、new_spec→spec_create、reuse_spec→task_create、
 *    no_spec→mismatch、other/缺失→not_applicable）；
 * - parseTargetRef：完整/部分/宽容分隔解析；解析失败返回 null；
 * - sameReference：宽松引用比对（全 id ≡ 名称 ≡ 序号）；
 * - buildBoundaryLines：不一致才产出【决策边界】行；不解析 summary、
 *   不含 USER_DECISION、不阻断；
 * - buildAssessContextLines：FACT/RECOMMENDATION/DECISION_BOUNDARY 文本组织。
 */

import { describe, it, expect } from 'vitest';
import {
  DECISION_CONTEXT_DIRECTION_VALUES,
  type DecisionContextDirection,
  type DecisionContextInput,
} from '../../src/types/decision-context.js';
import {
  DECISION_BOUNDARY_PREFIX,
  FACT_PREFIX,
  RECOMMENDATION_PREFIX,
  alignDirectionWithTool,
  buildAssessContextLines,
  buildBoundaryLines,
  directionToPlacementTool,
  parseTargetRef,
  sameReference,
  shouldCompareDirection,
} from '../../src/core/decision-context.js';

/** 构造合法 DecisionContextInput（默认 explicit + new_spec）。 */
function ctx(over: Partial<DecisionContextInput>): DecisionContextInput {
  return {
    source: 'client_asserted',
    strength: 'explicit',
    summary: '用户决定概括',
    direction: 'new_spec',
    ...over,
  };
}

const SECRET_SUMMARY = 'PERSIST_SENTINEL_UNIT_9F3';
const SECRET_QUOTE = 'PERSIST_SENTINEL_QUOTE_9F3';

describe('decision-context-alignment（T-003 纯函数）', () => {
  describe('shouldCompareDirection：参与方向对齐的工具集合', () => {
    it('三个 v1 落位工具参与 direction × 工具类别对齐', () => {
      expect(shouldCompareDirection('scene_create')).toBe(true);
      expect(shouldCompareDirection('spec_create')).toBe(true);
      expect(shouldCompareDirection('task_create')).toBe(true);
    });

    it('assess_goal / spec_update / 读取工具 / 未知工具不参与对齐', () => {
      for (const toolName of ['assess_goal', 'spec_update', 'spec_get', 'scene_get', 'task_list', 'not_a_tool']) {
        expect(shouldCompareDirection(toolName)).toBe(false);
      }
    });
  });

  describe('alignDirectionWithTool：枚举映射全覆盖', () => {
    it('对齐：new_scene→scene_create、new_spec→spec_create、reuse_spec→task_create', () => {
      expect(alignDirectionWithTool('new_scene', 'scene_create')).toBe('aligned');
      expect(alignDirectionWithTool('new_spec', 'spec_create')).toBe('aligned');
      expect(alignDirectionWithTool('reuse_spec', 'task_create')).toBe('aligned');
    });

    it('错位：方向映射到别的工具时为 mismatch', () => {
      expect(alignDirectionWithTool('new_scene', 'spec_create')).toBe('mismatch');
      expect(alignDirectionWithTool('new_scene', 'task_create')).toBe('mismatch');
      expect(alignDirectionWithTool('new_spec', 'scene_create')).toBe('mismatch');
      expect(alignDirectionWithTool('new_spec', 'task_create')).toBe('mismatch');
      expect(alignDirectionWithTool('reuse_spec', 'scene_create')).toBe('mismatch');
      expect(alignDirectionWithTool('reuse_spec', 'spec_create')).toBe('mismatch');
    });

    it('no_spec：调用任何落位工具都视为 mismatch（no_spec 表示不应调用落位工具）', () => {
      expect(alignDirectionWithTool('no_spec', 'scene_create')).toBe('mismatch');
      expect(alignDirectionWithTool('no_spec', 'spec_create')).toBe('mismatch');
      expect(alignDirectionWithTool('no_spec', 'task_create')).toBe('mismatch');
    });

    it('other：不自动比较 → not_applicable', () => {
      expect(alignDirectionWithTool('other', 'scene_create')).toBe('not_applicable');
      expect(alignDirectionWithTool('other', 'spec_create')).toBe('not_applicable');
      expect(alignDirectionWithTool('other', 'task_create')).toBe('not_applicable');
    });

    it('direction 缺失（unspecified 语义）→ not_applicable', () => {
      expect(alignDirectionWithTool(undefined, 'scene_create')).toBe('not_applicable');
      expect(alignDirectionWithTool(undefined, 'task_create')).toBe('not_applicable');
    });

    it('assess_goal 等非落位工具不参与对齐（任何方向均 not_applicable）', () => {
      for (const direction of DECISION_CONTEXT_DIRECTION_VALUES) {
        expect(alignDirectionWithTool(direction, 'assess_goal')).toBe('not_applicable');
      }
      expect(alignDirectionWithTool('new_spec', 'spec_update')).toBe('not_applicable');
    });

    it('directionToPlacementTool 映射；no_spec/other 无落位工具', () => {
      expect(directionToPlacementTool('new_scene')).toBe('scene_create');
      expect(directionToPlacementTool('new_spec')).toBe('spec_create');
      expect(directionToPlacementTool('reuse_spec')).toBe('task_create');
      expect(directionToPlacementTool('no_spec')).toBeUndefined();
      expect(directionToPlacementTool('other')).toBeUndefined();
    });
  });

  describe('parseTargetRef：宽容解析与失败', () => {
    it('完整稳定引用解析出 scene 与 spec', () => {
      const parsed = parseTargetRef('scene=01-user-management, spec=01-00-user-login');
      expect(parsed).toEqual({ scene: '01-user-management', spec: '01-00-user-login' });
    });

    it('只含 scene 或只含 spec 时只返回对应字段', () => {
      expect(parseTargetRef('scene=01-user-management')).toEqual({ scene: '01-user-management' });
      expect(parseTargetRef('spec=01-00-user-login')).toEqual({ spec: '01-00-user-login' });
    });

    it('宽容分隔：顿号/分号/空白/噪音前缀都能解析', () => {
      expect(parseTargetRef('scene=01-user-management；spec=01-00-user-login')).toEqual({
        scene: '01-user-management',
        spec: '01-00-user-login',
      });
      expect(parseTargetRef('请复用 scene=01-user-management spec=01-00-user-login 谢谢')).toEqual({
        scene: '01-user-management',
        spec: '01-00-user-login',
      });
      expect(parseTargetRef('reuse_spec + scene=01-user-management, spec=01-00-user-login')).toEqual({
        scene: '01-user-management',
        spec: '01-00-user-login',
      });
    });

    it('重复键取首个值', () => {
      expect(parseTargetRef('scene=01-user-management, scene=02-billing')).toEqual({ scene: '01-user-management' });
    });

    it('解析失败返回 null：空串 / 纯空白 / 无 scene=/spec= 键值对 / 空值', () => {
      expect(parseTargetRef('')).toBeNull();
      expect(parseTargetRef('   ')).toBeNull();
      expect(parseTargetRef('reuse the existing spec, do not create new ones')).toBeNull();
      expect(parseTargetRef('scene=')).toBeNull();
      expect(parseTargetRef('scene=01-user-management, spec=')).toEqual({ scene: '01-user-management' });
    });
  });

  describe('sameReference：宽松引用比对', () => {
    it('原串相等 / 全 id ≡ 纯名称 / 序号等价都视为一致', () => {
      expect(sameReference('01-user-management', '01-user-management')).toBe(true);
      expect(sameReference('01-user-management', 'user-management')).toBe(true);
      expect(sameReference('01-00-user-login', 'user-login')).toBe(true);
      expect(sameReference('01-user-management', '01')).toBe(true);
      expect(sameReference('02-billing', '2')).toBe(true);
      expect(sameReference('User-Management', 'user-management')).toBe(true);
    });

    it('不同名称不一致（即使前导数字相同也不混淆两个不同实体）', () => {
      expect(sameReference('01-user-management', '01-billing')).toBe(false);
      expect(sameReference('01-00-user-login', '02-00-password-reset')).toBe(false);
    });
  });

  describe('buildBoundaryLines：不一致才产出【决策边界】行', () => {
    it('direction 对齐且无 target_ref → 不产任何行', () => {
      const lines = buildBoundaryLines({
        toolName: 'scene_create',
        context: ctx({ direction: 'new_scene' }),
        call: { name: 'user-management' },
      });
      expect(lines).toEqual([]);
    });

    it('direction 与工具类别不一致 → 一条【决策边界】行，含方向与工具名', () => {
      const lines = buildBoundaryLines({
        toolName: 'spec_create',
        context: ctx({ direction: 'reuse_spec', summary: SECRET_SUMMARY }),
        call: { scene: '01-user-management', name: 'user-login' },
      });
      expect(lines.length).toBe(1);
      expect(lines[0]).toContain(DECISION_BOUNDARY_PREFIX);
      expect(lines[0]).toContain('reuse_spec');
      expect(lines[0]).toContain('spec_create');
      // 纪律：不解析 summary、不包含 USER_DECISION、不声称读取用户原话
      expect(lines[0]).not.toContain(SECRET_SUMMARY);
      expect(lines[0]).not.toContain('USER_DECISION');
    });

    it('no_spec 下调用 scene_create → 一条【决策边界】行', () => {
      const lines = buildBoundaryLines({
        toolName: 'scene_create',
        context: ctx({ direction: 'no_spec' }),
        call: { name: 'user-management' },
      });
      expect(lines.length).toBe(1);
      expect(lines[0]).toContain('no_spec');
      expect(lines[0]).toContain('scene_create');
    });

    it('unspecified（无 direction）且无 target_ref → 不产任何行', () => {
      const lines = buildBoundaryLines({
        toolName: 'task_create',
        context: ctx({ strength: 'unspecified', direction: undefined }),
        call: { scene: '01-user-management', spec: '01-00-user-login' },
      });
      expect(lines).toEqual([]);
    });

    it('target_ref 无法解析 → 仅解析提示行，不阻断（方向已对齐）', () => {
      const lines = buildBoundaryLines({
        toolName: 'scene_create',
        context: ctx({ direction: 'new_scene', target_ref: 'user said reuse whatever' }),
        call: { name: 'user-management' },
      });
      expect(lines.length).toBe(1);
      expect(lines[0]).toContain(DECISION_BOUNDARY_PREFIX);
      expect(lines[0]).toContain('无法解析');
      expect(lines[0]).toContain('target_ref');
    });

    it('target_ref 与本次调用参数不一致 → 一条不一致行（不阻断）', () => {
      const lines = buildBoundaryLines({
        toolName: 'task_create',
        context: ctx({
          direction: 'reuse_spec',
          target_ref: 'scene=01-user-management, spec=01-00-other',
        }),
        call: { scene: '01-user-management', spec: '01-00-user-login' },
      });
      expect(lines.length).toBe(1);
      expect(lines[0]).toContain(DECISION_BOUNDARY_PREFIX);
      expect(lines[0]).toContain('spec "01-00-other"');
      expect(lines[0]).toContain('spec "01-00-user-login"');
      expect(lines[0]).toContain('不阻断');
    });

    it('target_ref 宽容匹配（全 id vs 纯名称）不产行', () => {
      const lines = buildBoundaryLines({
        toolName: 'scene_create',
        context: ctx({ direction: 'new_scene', target_ref: 'scene=06-billing' }),
        call: { name: 'billing' },
      });
      expect(lines).toEqual([]);
    });

    it('spec_create：target_ref.spec 与新建名称不一致时产行', () => {
      const lines = buildBoundaryLines({
        toolName: 'spec_create',
        context: ctx({
          direction: 'new_spec',
          target_ref: 'scene=01-user-management, spec=01-00-auth-flow',
        }),
        call: { scene: '01-user-management', name: 'user-login' },
      });
      expect(lines.length).toBe(1);
      expect(lines[0]).toContain('auth-flow');
      expect(lines[0]).toContain('user-login');
    });

    it('行内绝不含 summary / reported_user_quote 内容', () => {
      const lines = buildBoundaryLines({
        toolName: 'scene_create',
        context: ctx({
          direction: 'new_scene',
          summary: SECRET_SUMMARY,
          reported_user_quote: SECRET_QUOTE,
          target_ref: 'scene=07-payroll',
        }),
        call: { name: 'billing' },
      });
      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) {
        expect(line).not.toContain(SECRET_SUMMARY);
        expect(line).not.toContain(SECRET_QUOTE);
        expect(line).not.toContain('USER_DECISION');
      }
    });
  });

  describe('buildAssessContextLines：写入前的 FACT/RECOMMENDATION/DECISION_BOUNDARY', () => {
    it('无 direction（unspecified）→ 不追加任何行', () => {
      expect(buildAssessContextLines(ctx({ strength: 'unspecified', direction: undefined }))).toEqual([]);
    });

    it('explicit new_spec → 【事实】+【建议】行，建议提及落位工具 spec_create', () => {
      const lines = buildAssessContextLines(ctx({ direction: 'new_spec', summary: SECRET_SUMMARY }));
      expect(lines.length).toBe(2);
      expect(lines[0]).toContain(FACT_PREFIX);
      expect(lines[0]).toContain('direction=new_spec');
      expect(lines[1]).toContain(RECOMMENDATION_PREFIX);
      expect(lines[1]).toContain('spec_create');
      expect(lines.join('\n')).not.toContain(SECRET_SUMMARY);
      expect(lines.join('\n')).not.toContain('USER_DECISION');
    });

    it('explicit no_spec → 【事实】+【决策边界】行', () => {
      const lines = buildAssessContextLines(ctx({ direction: 'no_spec' }));
      expect(lines.length).toBe(2);
      expect(lines[0]).toContain(FACT_PREFIX);
      expect(lines[1]).toContain(DECISION_BOUNDARY_PREFIX);
      expect(lines[1]).toContain('no_spec');
      expect(lines[1]).toContain('scene_create');
    });

    it('preferred reuse_spec → 第二行保留 preferred 措辞', () => {
      const lines = buildAssessContextLines(ctx({ strength: 'preferred', direction: 'reuse_spec' }));
      expect(lines.length).toBe(2);
      expect(lines[0]).toContain('strength=preferred');
      expect(lines[1]).toContain(RECOMMENDATION_PREFIX);
      expect(lines[1]).toContain('reuse_spec');
      expect(lines[1]).toContain('先向用户确认');
    });

    it('other → 两条【事实】，不做自动比较', () => {
      const lines = buildAssessContextLines(ctx({ direction: 'other' }));
      expect(lines.length).toBe(2);
      expect(lines[0]).toContain(FACT_PREFIX);
      expect(lines[1]).toContain(FACT_PREFIX);
      expect(lines.join('\n')).not.toContain(DECISION_BOUNDARY_PREFIX);
      expect(lines.join('\n')).not.toContain(RECOMMENDATION_PREFIX);
    });
  });
});
