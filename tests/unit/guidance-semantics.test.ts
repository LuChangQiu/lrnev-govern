import { describe, expect, it } from 'vitest';
import { WORKFLOW_OVERVIEW, TOOL_DESCRIPTIONS } from '../../src/mcp/guidance.js';
import { SPEC_REWRITE_GUIDANCE } from '../../src/core/SpecGuidance.js';
import { USER_DECISION_PRIORITY_CLAUSE } from '../../src/core/guidance-semantics.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('guidance-semantics', () => {
  describe('黑名单措辞（不应出现强制语气）', () => {
    const blacklist = [
      '必须使用已有 Spec',
      '禁止创建新 Spec',
      '不新开 spec',
      '默认不开 spec',
      '是才开 spec',
    ];

    it('WORKFLOW_OVERVIEW 不含黑名单措辞', () => {
      const text = WORKFLOW_OVERVIEW;
      for (const phrase of blacklist) {
        expect(text).not.toContain(phrase);
      }
    });

    it('spec_create 工具描述不含黑名单措辞', () => {
      const text = TOOL_DESCRIPTIONS.spec_create;
      expect(text).toBeDefined();
      for (const phrase of blacklist) {
        expect(text).not.toContain(phrase);
      }
    });

    it('SPEC_REWRITE_GUIDANCE 不含黑名单措辞', () => {
      for (const phrase of blacklist) {
        expect(SPEC_REWRITE_GUIDANCE).not.toContain(phrase);
      }
    });
  });

  describe('白名单条款（应出现建议语气 + 用户决定优先）', () => {
    it('WORKFLOW_OVERVIEW 包含用户决定优先条款', () => {
      const text = WORKFLOW_OVERVIEW;
      expect(text).toContain('用户已明确');
      expect(text).toContain('尊重用户决定');
    });

    it('spec_create 描述包含用户决定优先条款', () => {
      const text = TOOL_DESCRIPTIONS.spec_create;
      expect(text).toBeDefined();
      expect(text).toContain('用户已明确');
      expect(text).toContain('尊重用户决定');
    });

    it('SPEC_REWRITE_GUIDANCE 包含用户决定条款', () => {
      expect(SPEC_REWRITE_GUIDANCE).toContain('用户已明确');
      expect(SPEC_REWRITE_GUIDANCE).toContain('尊重用户决定');
    });
  });

  describe('AI-ADAPTATION.md 与常量一致性', () => {
    it('AI-ADAPTATION.md 包含与 USER_DECISION_PRIORITY_CLAUSE 一致的条款', () => {
      const aiAdaptationPath = resolve(__dirname, '../../docs/AI-ADAPTATION.md');
      const content = readFileSync(aiAdaptationPath, 'utf-8');

      // 核心短语必须出现
      expect(content).toContain('用户决定优先');
      expect(content).toContain('用户已明确要求');
      expect(content).toContain('尊重用户决定');

      // 验证三条判断标尺存在
      expect(content).toContain('整体推翻');
      expect(content).toContain('独立特性');
      expect(content).toContain('上下文冷却');
    });

    it('AI-ADAPTATION.md 不含黑名单措辞', () => {
      const aiAdaptationPath = resolve(__dirname, '../../docs/AI-ADAPTATION.md');
      const content = readFileSync(aiAdaptationPath, 'utf-8');

      const blacklist = [
        '必须使用已有 Spec',
        '禁止创建新 Spec',
        '不新开 spec',
        '默认不开 spec',
      ];

      for (const phrase of blacklist) {
        expect(content).not.toContain(phrase);
      }
    });
  });
});
