/**
 * 05-00 lrnev Guidance Profile - T-002 decision_context 输入 Schema 与负向校验
 *
 * Spec: 05-00-lrnev-guidance-profile（F-04 / D-03）
 * Task: T-002（裁决 Q2 错误表面 A、Q3 strip 语义、Q6 命名）
 *
 * 覆盖：
 * - 正向：explicit/preferred/unspecified 各合法形态、可选字段缺省、全字段形态；
 * - 缺失（undefined）≠ unspecified 语义（显式 unspecified 才占位，缺失不被改写）；
 * - 负向：条件规则（explicit/preferred 缺 direction、unspecified 带 direction）、
 *   source 非 client_asserted、summary 空、direction/strength 枚举非法、target_ref 空串；
 * - 哨兵：校验为纯函数——合法/非法输入均不触发任何文件系统写入。
 */

import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { promises as fs } from 'node:fs';
import {
  DecisionContextInputSchema,
  parseDecisionContextInput,
  type DecisionContextParseResult,
} from '../../src/mcp/types/decision-context-schema.js';
import {
  DECISION_CONTEXT_SOURCE_VALUES,
  DECISION_CONTEXT_STRENGTH_VALUES,
  DECISION_CONTEXT_DIRECTION_VALUES,
  type DecisionContextInput,
} from '../../src/types/decision-context.js';

/** 合法 explicit 形态：必须携带 direction。 */
const EXPLICIT_INPUT: DecisionContextInput = {
  source: 'client_asserted',
  strength: 'explicit',
  summary: '用户明确要求新建独立 Spec',
  direction: 'new_spec',
};

describe('decision-context-schema', () => {
  describe('正向：合法输入各形态', () => {
    it('explicit + direction 通过并原样返回', () => {
      const result = parseDecisionContextInput(EXPLICIT_INPUT);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(EXPLICIT_INPUT);
      }
    });

    it('preferred + direction + target_ref + reported_user_quote 全字段形态通过', () => {
      const input: DecisionContextInput = {
        source: 'client_asserted',
        strength: 'preferred',
        summary: '用户倾向复用已有 Spec',
        direction: 'reuse_spec',
        target_ref: 'scene=01-user-management, spec=01-00-user-login',
        reported_user_quote: '先看看有没有现成的能用，别重复造',
      };
      const result = parseDecisionContextInput(input);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(input);
      }
    });

    it('unspecified 省略 direction 通过', () => {
      const input: DecisionContextInput = {
        source: 'client_asserted',
        strength: 'unspecified',
        summary: '用户未明确组织方式',
      };
      const result = parseDecisionContextInput(input);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.direction).toBeUndefined();
      }
    });

    it('unspecified 且可选字段全缺省（仅必填）通过', () => {
      const input: DecisionContextInput = {
        source: 'client_asserted',
        strength: 'unspecified',
        summary: '仅声明来源，无可选信息',
      };
      const result = parseDecisionContextInput(input);
      expect(result.ok).toBe(true);
      if (result.ok) {
        // 无静默填充：输出对象不含任何可选字段键
        expect(Object.keys(result.data).sort()).toEqual(['source', 'strength', 'summary']);
      }
    });

    it('每个 direction 枚举值在 explicit 下都被接受', () => {
      for (const direction of DECISION_CONTEXT_DIRECTION_VALUES) {
        const result = parseDecisionContextInput({ ...EXPLICIT_INPUT, direction });
        expect(result.ok).toBe(true);
      }
    });

    it('explicit 下 target_ref 使用完整稳定引用通过', () => {
      const result = parseDecisionContextInput({
        ...EXPLICIT_INPUT,
        direction: 'reuse_spec',
        target_ref: 'scene=01-user-management, spec=01-00-user-login',
      });
      expect(result.ok).toBe(true);
    });
  });

  describe('缺失（undefined）≠ unspecified 语义', () => {
    it('parseDecisionContextInput(undefined) 返回显式失败，不把缺失改写为 unspecified 声明', () => {
      const result = parseDecisionContextInput(undefined);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        // 结构化信封错误：字段指向 decision_context 本身
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]!.field).toBe('decision_context');
      }
    });

    it('显式 strength=unspecified 占位保留，不被改写/移除', () => {
      const result = parseDecisionContextInput({
        source: 'client_asserted',
        strength: 'unspecified',
        summary: '占位声明',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.strength).toBe('unspecified');
      }
    });

    it('explicit 下 direction 键存在但值为 undefined 视为缺失 → 报错（必填方向不被 undefined 绕过）', () => {
      const result = parseDecisionContextInput({
        source: 'client_asserted',
        strength: 'explicit',
        summary: '明确方向但值为 undefined',
        direction: undefined,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors[0]!.field).toBe('decision_context.direction');
      }
    });

    it('unspecified 下 direction 键存在但值为 undefined 视为省略 → 通过', () => {
      const result = parseDecisionContextInput({
        source: 'client_asserted',
        strength: 'unspecified',
        summary: '无方向',
        direction: undefined,
      });
      expect(result.ok).toBe(true);
    });
  });

  describe('负向：条件规则（superRefine）', () => {
    it('explicit 缺少 direction 报错：字段路径为 decision_context.direction，消息可读', () => {
      const { source, strength, summary } = EXPLICIT_INPUT;
      const result = parseDecisionContextInput({ source, strength, summary });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.length).toBe(1);
        expect(result.errors[0]!.field).toBe('decision_context.direction');
        expect(result.errors[0]!.message).toContain('direction');
        expect(result.errors[0]!.message).toContain('explicit');
      }
    });

    it('preferred 缺少 direction 报错', () => {
      const result = parseDecisionContextInput({
        source: 'client_asserted',
        strength: 'preferred',
        summary: '有倾向但未声明方向',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors[0]!.field).toBe('decision_context.direction');
      }
    });

    it('unspecified 携带 direction 报错（禁止把 AI Recommendation 包装成用户方向）', () => {
      const result = parseDecisionContextInput({
        source: 'client_asserted',
        strength: 'unspecified',
        summary: '未指明方向却给了 direction',
        direction: 'new_spec',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors[0]!.field).toBe('decision_context.direction');
        expect(result.errors[0]!.message).toContain('unspecified');
        expect(result.errors[0]!.message).toContain('省略');
      }
    });

    it('schema 层条件规则 issue 直接指向字段路径 direction（code=custom）', () => {
      const { source, strength, summary } = EXPLICIT_INPUT;
      const parsed = DecisionContextInputSchema.safeParse({ source, strength, summary });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0]!.path).toEqual(['direction']);
        expect(parsed.error.issues[0]!.code).toBe('custom');
      }
    });
  });

  describe('负向：结构与枚举', () => {
    it('source 非 client_asserted（服务端伪造来源）报错', () => {
      const result = parseDecisionContextInput({
        ...EXPLICIT_INPUT,
        source: 'server_asserted',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors[0]!.field).toBe('decision_context.source');
      }
    });

    it('source 缺失报错', () => {
      const { strength, summary, direction } = EXPLICIT_INPUT;
      const result = parseDecisionContextInput({ strength, summary, direction });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.field === 'decision_context.source')).toBe(true);
      }
    });

    it('summary 为空字符串报错', () => {
      const result = parseDecisionContextInput({ ...EXPLICIT_INPUT, summary: '' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.field === 'decision_context.summary')).toBe(true);
      }
    });

    it('summary 为纯空白报错（非空 string 语义）', () => {
      const result = parseDecisionContextInput({ ...EXPLICIT_INPUT, summary: '   ' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.field === 'decision_context.summary')).toBe(true);
      }
    });

    it('summary 缺失报错', () => {
      const { source, strength, direction } = EXPLICIT_INPUT;
      const result = parseDecisionContextInput({ source, strength, direction });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.field === 'decision_context.summary')).toBe(true);
      }
    });

    it('direction 为非法枚举值报错', () => {
      const result = parseDecisionContextInput({
        ...EXPLICIT_INPUT,
        direction: 'banana',
      } as unknown as DecisionContextInput);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.field === 'decision_context.direction')).toBe(true);
      }
    });

    it('direction 为非字符串类型报错', () => {
      const result = parseDecisionContextInput({
        ...EXPLICIT_INPUT,
        direction: 42,
      } as unknown as DecisionContextInput);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.field === 'decision_context.direction')).toBe(true);
      }
    });

    it('strength 为非法枚举值报错', () => {
      const result = parseDecisionContextInput({
        ...EXPLICIT_INPUT,
        strength: 'maybe',
      } as unknown as DecisionContextInput);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.field === 'decision_context.strength')).toBe(true);
      }
    });

    it('target_ref 为空字符串报错（声明引用必须非空）', () => {
      const result = parseDecisionContextInput({
        ...EXPLICIT_INPUT,
        direction: 'reuse_spec',
        target_ref: '',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.field === 'decision_context.target_ref')).toBe(true);
      }
    });

    it('target_ref 为纯空白报错', () => {
      const result = parseDecisionContextInput({
        ...EXPLICIT_INPUT,
        direction: 'reuse_spec',
        target_ref: '   ',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.field === 'decision_context.target_ref')).toBe(true);
      }
    });

    it('target_ref 完全省略（无引用声明）在 reuse_spec 下通过', () => {
      const result = parseDecisionContextInput({
        ...EXPLICIT_INPUT,
        direction: 'reuse_spec',
      });
      expect(result.ok).toBe(true);
    });

    it('reported_user_quote 为空字符串不报错（服务端不可验证的转述原话，仅约束类型）', () => {
      const result = parseDecisionContextInput({
        ...EXPLICIT_INPUT,
        reported_user_quote: '',
      });
      expect(result.ok).toBe(true);
    });
  });

  describe('非法输入显式报错，不静默填充', () => {
    it('失败结果不含 data，不产出任意填充值', () => {
      const result = parseDecisionContextInput({
        source: 'client_asserted',
        strength: 'explicit',
        summary: '缺 direction',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect('data' in result).toBe(false);
      }
    });

    it('成功结果数据与输入完全一致（无改写/裁剪）', () => {
      const input: DecisionContextInput = {
        source: 'client_asserted',
        strength: 'unspecified',
        summary: '  带空白但非空的概括  ',
        reported_user_quote: '  原话两侧空白原样保留  ',
      };
      const result = parseDecisionContextInput(input);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.summary).toBe(input.summary);
        expect(result.data.reported_user_quote).toBe(input.reported_user_quote);
        expect(result.data).toEqual(input);
      }
    });
  });

  describe('导出面：枚举值唯一来源（供 T-003 广告层复用）', () => {
    it('导出枚举值与 F-04 契约一致', () => {
      expect(DECISION_CONTEXT_SOURCE_VALUES).toEqual(['client_asserted']);
      expect(DECISION_CONTEXT_STRENGTH_VALUES).toEqual(['explicit', 'preferred', 'unspecified']);
      expect(DECISION_CONTEXT_DIRECTION_VALUES).toEqual([
        'new_scene',
        'new_spec',
        'reuse_spec',
        'no_spec',
        'other',
      ]);
    });
  });

  describe('哨兵：校验为纯函数，不触碰文件系统', () => {
    const WRITE_METHODS = [
      'writeFile',
      'appendFile',
      'mkdir',
      'rename',
      'rm',
      'rmdir',
      'unlink',
      'copyFile',
    ] as const;

    let spies: MockInstance[] = [];

    beforeEach(() => {
      spies = WRITE_METHODS.map((method) =>
        vi.spyOn(fs, method).mockImplementation(() => {
          throw new Error(`校验函数不应触发文件系统写入：fs.promises.${method}`);
        }),
      );
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('合法输入解析不触发任何文件系统写入', () => {
      const result = parseDecisionContextInput(EXPLICIT_INPUT);
      expect(result.ok).toBe(true);
      for (const spy of spies) {
        expect(spy).not.toHaveBeenCalled();
      }
    });

    it('非法输入解析同样不触发任何文件系统写入（负向校验不落盘）', () => {
      const result: DecisionContextParseResult = parseDecisionContextInput({
        source: 'client_asserted',
        strength: 'explicit',
        summary: '缺 direction',
      });
      expect(result.ok).toBe(false);
      for (const spy of spies) {
        expect(spy).not.toHaveBeenCalled();
      }
    });
  });
});
