/**
 * 05-00-lrnev-guidance-profile T-001 单元测试
 *
 * 覆盖：
 * - LrnevGuidanceItem 对象结构（schema 解析：全量 / role 缺省降级 / 字段约束）。
 * - Profile 版本独立性：GUIDANCE_PROFILE_ID/VERSION ≠ MCP protocolVersion / response_version。
 * - 服务端输出角色枚举（五角色 UPPER_SNAKE，不含 USER_DECISION）。
 * - 未知 role → 文本降级（绝不升级为 EXECUTION_CONSTRAINT）。
 * - 冲突诊断各分支 → 阻止发布；一致项不误报。
 * - 无数字 priority / 非三维必填 schema。
 * - buildGuidanceView 同源一致（text 与 profile 从同一语义输入派生）。
 */

import { describe, expect, it } from 'vitest';
import { LATEST_PROTOCOL_VERSION, SUPPORTED_PROTOCOL_VERSIONS } from '@modelcontextprotocol/sdk/types.js';

import {
  GUIDANCE_PROFILE_ID,
  GUIDANCE_PROFILE_VERSION,
  GUIDANCE_ROLES,
  ROLE_PREFIX,
  type GuidRole,
} from '../../src/core/guidance-semantics.js';

import { LrnevGuidanceItemSchema, type LrnevGuidanceItem } from '../../src/mcp/types/guidance-profile.js';

import {
  assertGuidancePublishable,
  buildGuidanceView,
  diagnoseGuidance,
  GuidancePublishError,
  normalizeRole,
  type GuidanceDiagnosisKind,
} from '../../src/mcp/helpers/guidance-profile.js';

/** 当前 envelope response_version（见 src/mcp/types/response-envelope.ts 的 LrnevResponseVersion 字面量 '1'）。 */
const ENVELOPE_RESPONSE_VERSION = '1';

describe('guidance-profile', () => {
  // ------------------------------------------------------------
  // 1) 对象结构：LrnevGuidanceItem + zod schema
  // ------------------------------------------------------------
  describe('LrnevGuidanceItem 对象结构', () => {
    it('全量对象解析成功：role + text + profile_version + source_ref + enforcement', () => {
      const parsed = LrnevGuidanceItemSchema.safeParse({
        role: 'FACT',
        text: 'Spec 01 当前状态为 in-progress。',
        profile_version: 'v1',
        source_ref: 'spec-manager.ts:216',
        enforcement: 'client_boundary',
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.role).toBe('FACT');
        expect(parsed.data.text).toBe('Spec 01 当前状态为 in-progress。');
        expect(parsed.data.profile_version).toBe('v1');
        expect(parsed.data.source_ref).toBe('spec-manager.ts:216');
        expect(parsed.data.enforcement).toBe('client_boundary');
      }
    });

    it('role 缺省合法：纯文本降级项（text + profile_version 即可）', () => {
      const parsed = LrnevGuidanceItemSchema.safeParse({
        text: '这是一条纯文本降级内容。',
        profile_version: 'v1',
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.role).toBeUndefined();
        expect(parsed.data.text).toBe('这是一条纯文本降级内容。');
      }
    });

    it('source_ref 出现时须为非空字符串（不收紧格式），空串被拒', () => {
      const parsed = LrnevGuidanceItemSchema.safeParse({
        text: 'x',
        profile_version: 'v1',
        source_ref: '',
      });
      expect(parsed.success).toBe(false);
      const parsedOk = LrnevGuidanceItemSchema.safeParse({
        text: 'x',
        profile_version: 'v1',
        source_ref: '任意非空引用，格式不收紧',
      });
      expect(parsedOk.success).toBe(true);
    });

    it('enforcement 值域两值；\'none\' 不序列化（被 schema 拒绝）', () => {
      for (const bad of ['none', 'NONE', 'server', '']) {
        const parsed = LrnevGuidanceItemSchema.safeParse({
          text: 'x',
          profile_version: 'v1',
          enforcement: bad,
        });
        expect(parsed.success).toBe(false);
      }
      for (const ok of ['client_boundary', 'server_enforced']) {
        const parsed = LrnevGuidanceItemSchema.safeParse({
          text: 'x',
          profile_version: 'v1',
          enforcement: ok,
        });
        expect(parsed.success).toBe(true);
      }
    });

    it('role 仅接受五角色 UPPER_SNAKE；小写与 USER_DECISION 在 schema 层被拒', () => {
      const bad = LrnevGuidanceItemSchema.safeParse({ text: 'x', profile_version: 'v1', role: 'fact' });
      expect(bad.success).toBe(false);
      const userDecision = LrnevGuidanceItemSchema.safeParse({
        text: 'x',
        profile_version: 'v1',
        role: 'USER_DECISION',
      });
      expect(userDecision.success).toBe(false);
    });

    it('text 必填非空', () => {
      expect(LrnevGuidanceItemSchema.safeParse({ text: '', profile_version: 'v1' }).success).toBe(false);
      expect(LrnevGuidanceItemSchema.safeParse({ profile_version: 'v1' }).success).toBe(false);
    });

    it('无数字 priority：schema 不要求、对象不含 priority 字段', () => {
      const parsed = LrnevGuidanceItemSchema.safeParse({ text: 'x', profile_version: 'v1' });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data).not.toHaveProperty('priority');
        expect(parsed.data).not.toHaveProperty('provenance');
      }
    });
  });

  // ------------------------------------------------------------
  // 2) Profile 版本独立性
  // ------------------------------------------------------------
  describe('Profile 版本独立性（≠ MCP protocolVersion / response_version）', () => {
    it('Profile 名称与版本字面量正确', () => {
      expect(GUIDANCE_PROFILE_ID).toBe('lrnev.guidance');
      expect(GUIDANCE_PROFILE_VERSION).toBe('v1');
      expect(`${GUIDANCE_PROFILE_ID}/${GUIDANCE_PROFILE_VERSION}`).toBe('lrnev.guidance/v1');
    });

    it('Profile 版本 ≠ MCP 当前/支持的 protocolVersion', () => {
      expect(GUIDANCE_PROFILE_VERSION).not.toBe(LATEST_PROTOCOL_VERSION);
      expect(GUIDANCE_PROFILE_ID).not.toBe(LATEST_PROTOCOL_VERSION);
      for (const supported of SUPPORTED_PROTOCOL_VERSIONS) {
        expect(GUIDANCE_PROFILE_VERSION).not.toBe(supported);
      }
    });

    it('Profile 名称/版本 ≠ response envelope 的 response_version', () => {
      expect(GUIDANCE_PROFILE_VERSION).not.toBe(ENVELOPE_RESPONSE_VERSION);
      expect(GUIDANCE_PROFILE_ID).not.toBe(ENVELOPE_RESPONSE_VERSION);
    });

    it('Profile 版本是语义版本形态（vN），不是 MCP 日期形态', () => {
      expect(GUIDANCE_PROFILE_VERSION).toMatch(/^v\d+$/);
      expect(GUIDANCE_PROFILE_VERSION).not.toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  // ------------------------------------------------------------
  // 3) 服务端可输出角色枚举（五角色）
  // ------------------------------------------------------------
  describe('服务端输出角色枚举', () => {
    it('GUIDANCE_ROLES 恰为五角色且顺序稳定', () => {
      expect([...GUIDANCE_ROLES]).toEqual([
        'FACT',
        'RECOMMENDATION',
        'DECISION_BOUNDARY',
        'EXECUTION_CONSTRAINT',
        'ACTION_HINT',
      ]);
    });

    it('USER_DECISION 不在服务端输出集（仅 client_asserted 来源）', () => {
      expect(GUIDANCE_ROLES).not.toContain('USER_DECISION');
      const asAny = GUIDANCE_ROLES as readonly string[];
      expect(asAny).not.toContain('user_decision');
    });

    it('ROLE_PREFIX 键与五角色一一对应，前缀与 01-00 冻结表一致', () => {
      expect(Object.keys(ROLE_PREFIX)).toEqual([...GUIDANCE_ROLES]);
      expect(ROLE_PREFIX.FACT).toBe('【事实】');
      expect(ROLE_PREFIX.RECOMMENDATION).toBe('【建议】');
      expect(ROLE_PREFIX.DECISION_BOUNDARY).toBe('【决策边界】');
      expect(ROLE_PREFIX.EXECUTION_CONSTRAINT).toBe('【执行约束】');
      // ACTION_HINT 前缀按 01-00 semantic-authority-model 冻结表为【下一步】（【操作提示】只是角色描述词）
      expect(ROLE_PREFIX.ACTION_HINT).toBe('【下一步】');
    });
  });

  // ------------------------------------------------------------
  // 4) normalizeRole：大小写不敏感；未知 role → 文本降级
  // ------------------------------------------------------------
  describe('normalizeRole 与未知 role 降级', () => {
    it('大小写不敏感解析五角色', () => {
      expect(normalizeRole('FACT')).toBe('FACT');
      expect(normalizeRole('fact')).toBe('FACT');
      expect(normalizeRole('Fact')).toBe('FACT');
      expect(normalizeRole('recommendation')).toBe('RECOMMENDATION');
      expect(normalizeRole('decision_boundary')).toBe('DECISION_BOUNDARY');
      expect(normalizeRole('execution_constraint')).toBe('EXECUTION_CONSTRAINT');
      expect(normalizeRole('action_hint')).toBe('ACTION_HINT');
    });

    it('未知 role（含 USER_DECISION / 拼写错误）返回 undefined，绝不升级为 Constraint', () => {
      expect(normalizeRole('USER_DECISION')).toBeUndefined();
      expect(normalizeRole('user_decision')).toBeUndefined();
      expect(normalizeRole('constraint')).toBeUndefined();
      expect(normalizeRole('FACT2')).toBeUndefined();
      expect(normalizeRole('')).toBeUndefined();
      expect(normalizeRole(' decision_boundary ')).toBe('DECISION_BOUNDARY');
      // 关键断言：未知值永远不是 EXECUTION_CONSTRAINT
      expect(normalizeRole('BOGUS_ROLE')).not.toBe('EXECUTION_CONSTRAINT');
      expect(normalizeRole('anything')).toBeUndefined();
    });

    it('buildGuidanceView：未知 role 输入降级为普通文本行且 profile 项 role 缺省', () => {
      const view = buildGuidanceView([{ role: 'BOGUS_ROLE', text: '看不懂的角色内容' }]);
      expect(view.textLines).toEqual(['看不懂的角色内容']);
      expect(view.profileItems).toHaveLength(1);
      expect(view.profileItems[0]!.role).toBeUndefined();
      expect(view.profileItems[0]!.text).toBe('看不懂的角色内容');
      expect(view.profileItems[0]!.profile_version).toBe(GUIDANCE_PROFILE_VERSION);
    });
  });

  // ------------------------------------------------------------
  // 5) 冲突诊断各分支 → 阻止发布
  // ------------------------------------------------------------
  describe('冲突诊断与发布守卫', () => {
    const kindsOf = (items: LrnevGuidanceItem[]): GuidanceDiagnosisKind[] =>
      diagnoseGuidance(items).map((d) => d.kind);

    it('无冲突项：诊断为空、发布守卫放行', () => {
      const items: LrnevGuidanceItem[] = [
        { role: 'FACT', text: 'Spec 01 状态为 in-progress。', profile_version: 'v1' },
        {
          role: 'EXECUTION_CONSTRAINT',
          text: '状态机拒绝该迁移。',
          profile_version: 'v1',
          source_ref: 'INVALID_STATUS_TRANSITION',
          enforcement: 'server_enforced',
        },
        { role: 'RECOMMENDATION', text: '可考虑复用已有 Spec。', profile_version: 'v1' },
        { text: '纯文本降级行', profile_version: 'v1' },
      ];
      expect(diagnoseGuidance(items)).toEqual([]);
      expect(() => assertGuidancePublishable(items)).not.toThrow();
    });

    it('前缀与 role 冲突 → prefix_role_mismatch → 阻止发布', () => {
      const items: LrnevGuidanceItem[] = [
        {
          role: 'RECOMMENDATION',
          text: '【执行约束】状态机拒绝该迁移。', // 文本前缀属于 EXECUTION_CONSTRAINT
          profile_version: 'v1',
        },
      ];
      expect(kindsOf(items)).toEqual(['prefix_role_mismatch']);
      expect(() => assertGuidancePublishable(items)).toThrow(GuidancePublishError);
    });

    it('文本前缀与声明 role 一致时不误报', () => {
      const items: LrnevGuidanceItem[] = [
        { role: 'FACT', text: '【事实】Spec 01 状态为 in-progress。', profile_version: 'v1' },
      ];
      expect(diagnoseGuidance(items)).toEqual([]);
    });

    it('EXECUTION_CONSTRAINT 缺 source_ref → constraint_missing_source_ref → 阻止发布', () => {
      const items: LrnevGuidanceItem[] = [
        { role: 'EXECUTION_CONSTRAINT', text: '状态机拒绝该迁移。', profile_version: 'v1' },
      ];
      expect(kindsOf(items)).toEqual(['constraint_missing_source_ref']);
      expect(() => assertGuidancePublishable(items)).toThrow(GuidancePublishError);
    });

    it('RECOMMENDATION 带 server_enforced → recommendation_server_enforced → 阻止发布', () => {
      const items: LrnevGuidanceItem[] = [
        {
          role: 'RECOMMENDATION',
          text: '建议复用已有 Spec。',
          profile_version: 'v1',
          enforcement: 'server_enforced',
        },
      ];
      expect(kindsOf(items)).toEqual(['recommendation_server_enforced']);
      expect(() => assertGuidancePublishable(items)).toThrow(GuidancePublishError);
    });

    it('DECISION_BOUNDARY 带 server_enforced → boundary_server_enforced → 阻止发布', () => {
      const items: LrnevGuidanceItem[] = [
        {
          role: 'DECISION_BOUNDARY',
          text: '用户已确认新建 Spec B。',
          profile_version: 'v1',
          enforcement: 'server_enforced',
        },
      ];
      expect(kindsOf(items)).toEqual(['boundary_server_enforced']);
      expect(() => assertGuidancePublishable(items)).toThrow(GuidancePublishError);
    });

    it('EXECUTION_CONSTRAINT 带 client_boundary → constraint_client_boundary → 阻止发布', () => {
      const items: LrnevGuidanceItem[] = [
        {
          role: 'EXECUTION_CONSTRAINT',
          text: '状态机拒绝该迁移。',
          profile_version: 'v1',
          source_ref: 'INVALID_STATUS_TRANSITION',
          enforcement: 'client_boundary',
        },
      ];
      expect(kindsOf(items)).toEqual(['constraint_client_boundary']);
      expect(() => assertGuidancePublishable(items)).toThrow(GuidancePublishError);
    });

    it('FACT/ACTION_HINT/无 role 项携带 enforcement → enforcement_on_non_enforcing_role → 阻止发布', () => {
      const fact = [{ role: 'FACT' as const, text: '事实内容', profile_version: 'v1', enforcement: 'client_boundary' as const }];
      const hint = [{ role: 'ACTION_HINT' as const, text: '可考虑 task_list', profile_version: 'v1', enforcement: 'server_enforced' as const }];
      const roleLess = [{ text: '纯文本', profile_version: 'v1', enforcement: 'client_boundary' as const }];
      expect(kindsOf(fact)).toEqual(['enforcement_on_non_enforcing_role']);
      expect(kindsOf(hint)).toEqual(['enforcement_on_non_enforcing_role']);
      expect(kindsOf(roleLess)).toEqual(['enforcement_on_non_enforcing_role']);
      expect(() => assertGuidancePublishable(fact)).toThrow(GuidancePublishError);
      expect(() => assertGuidancePublishable(hint)).toThrow(GuidancePublishError);
      expect(() => assertGuidancePublishable(roleLess)).toThrow(GuidancePublishError);
    });

    it('与角色隐含 enforcement 一致的显式取值不判冲突', () => {
      const items: LrnevGuidanceItem[] = [
        {
          role: 'RECOMMENDATION',
          text: '建议复用。',
          profile_version: 'v1',
          enforcement: 'client_boundary', // RECOMMENDATION 隐含 client_boundary
        },
        {
          role: 'DECISION_BOUNDARY',
          text: '以最后确认方向为准。',
          profile_version: 'v1',
          enforcement: 'client_boundary',
        },
        {
          role: 'EXECUTION_CONSTRAINT',
          text: '校验失败。',
          profile_version: 'v1',
          source_ref: 'VALIDATION_REF',
          enforcement: 'server_enforced',
        },
      ];
      expect(diagnoseGuidance(items)).toEqual([]);
      expect(() => assertGuidancePublishable(items)).not.toThrow();
    });

    it('多条冲突一次性全部诊断（不提前短路）', () => {
      const items: LrnevGuidanceItem[] = [
        {
          role: 'RECOMMENDATION',
          text: '【执行约束】必须这么做。',
          profile_version: 'v1',
          enforcement: 'server_enforced',
        },
        { role: 'EXECUTION_CONSTRAINT', text: '真实约束', profile_version: 'v1' },
      ];
      const kinds = kindsOf(items);
      expect(kinds).toContain('prefix_role_mismatch');
      expect(kinds).toContain('recommendation_server_enforced');
      expect(kinds).toContain('constraint_missing_source_ref');
      expect(() => assertGuidancePublishable(items)).toThrow(GuidancePublishError);
    });

    it('发布守卫错误携带 diagnoses，可逐条定位', () => {
      const items: LrnevGuidanceItem[] = [
        { role: 'EXECUTION_CONSTRAINT', text: '真实约束', profile_version: 'v1' },
      ];
      try {
        assertGuidancePublishable(items);
        throw new Error('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(GuidancePublishError);
        const pubErr = err as GuidancePublishError;
        expect(pubErr.diagnoses).toHaveLength(1);
        expect(pubErr.diagnoses[0]!.index).toBe(0);
        expect(pubErr.diagnoses[0]!.kind).toBe('constraint_missing_source_ref');
        expect(pubErr.message).toContain('阻止发布');
      }
    });
  });

  // ------------------------------------------------------------
  // 6) buildGuidanceView：唯一构建源同源一致
  // ------------------------------------------------------------
  describe('buildGuidanceView 唯一构建源', () => {
    it('已知 role 从同一输入派生前缀文本行 + 结构化项（1:1 同序同内容）', () => {
      const input = [
        { role: 'FACT' as GuidRole, text: 'Spec 01 状态为 in-progress。' },
        { role: 'RECOMMENDATION' as GuidRole, text: '可考虑在现有 Spec 下创建 Task。' },
      ];
      const view = buildGuidanceView(input);

      expect(view.textLines).toEqual([
        '【事实】Spec 01 状态为 in-progress。',
        '【建议】可考虑在现有 Spec 下创建 Task。',
      ]);
      expect(view.profileItems).toHaveLength(2);
      expect(view.profileItems[0]).toMatchObject({
        role: 'FACT',
        text: 'Spec 01 状态为 in-progress。',
        profile_version: GUIDANCE_PROFILE_VERSION,
      });
      expect(view.profileItems[1]).toMatchObject({
        role: 'RECOMMENDATION',
        text: '可考虑在现有 Spec 下创建 Task。',
        profile_version: GUIDANCE_PROFILE_VERSION,
      });
    });

    it('同源一致性：textLines 内容与 profileItems 文本来自同一输入、长度一致', () => {
      const input = [
        { role: 'FACT' as GuidRole, text: 'A' },
        { text: 'B（纯文本）' },
        { role: 'action_hint' as GuidRole, text: 'C' }, // 小写 role 也会被 normalize
      ];
      const view = buildGuidanceView(input);
      expect(view.textLines).toHaveLength(input.length);
      expect(view.profileItems).toHaveLength(input.length);
      // profile text 与输入 text 一致
      view.profileItems.forEach((item, i) => {
        expect(item.text).toBe(input[i]!.text);
      });
      // 文本行 = 前缀 + profile text（已知 role 项），或 = 原样文本（纯文本项）
      expect(view.textLines[0]).toBe(`${ROLE_PREFIX.FACT}${input[0]!.text}`);
      expect(view.textLines[1]).toBe(input[1]!.text);
      expect(view.textLines[2]).toBe(`${ROLE_PREFIX.ACTION_HINT}${input[2]!.text}`);
    });

    it('source_ref / enforcement 随结构化项带出，纯文本降级项不带', () => {
      const view = buildGuidanceView([
        {
          role: 'EXECUTION_CONSTRAINT',
          text: '状态机拒绝 archived → in-progress。',
          source_ref: 'INVALID_STATUS_TRANSITION',
          enforcement: 'server_enforced',
        },
      ]);
      expect(view.profileItems[0]).toMatchObject({
        role: 'EXECUTION_CONSTRAINT',
        source_ref: 'INVALID_STATUS_TRANSITION',
        enforcement: 'server_enforced',
      });
      const plainView = buildGuidanceView([{ text: '未知内容' }]);
      expect(plainView.profileItems[0]).not.toHaveProperty('source_ref');
      expect(plainView.profileItems[0]).not.toHaveProperty('enforcement');
      expect(plainView.profileItems[0]).not.toHaveProperty('role');
    });

    it('text 已自带同角色前缀时不重复加前缀（防双前缀）', () => {
      const view = buildGuidanceView([{ role: 'FACT', text: '【事实】Spec 已创建。' }]);
      expect(view.textLines).toEqual(['【事实】Spec 已创建。']);
    });

    it('空输入返回空视图', () => {
      const view = buildGuidanceView([]);
      expect(view.textLines).toEqual([]);
      expect(view.profileItems).toEqual([]);
    });
  });
});
