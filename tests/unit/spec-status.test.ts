import { describe, expect, it } from 'vitest';

import {
  SpecStatus,
  VALID_SPEC_TRANSITIONS,
  isValidSpecTransition,
} from '../../src/types/spec.js';

describe('Spec 状态机', () => {
  it('SpecStatus 应导出 5 个枚举值', () => {
    expect(SpecStatus.DRAFT).toBe('draft');
    expect(SpecStatus.READY).toBe('ready');
    expect(SpecStatus.IN_PROGRESS).toBe('in-progress');
    expect(SpecStatus.COMPLETED).toBe('completed');
    expect(SpecStatus.ARCHIVED).toBe('archived');
  });

  it('应允许设计定义的合法转换', () => {
    const validCases: Array<[SpecStatus, SpecStatus]> = [
      ['draft', 'ready'],
      ['draft', 'archived'],
      ['ready', 'in-progress'],
      ['ready', 'draft'],
      ['ready', 'archived'],
      ['in-progress', 'completed'],
      ['in-progress', 'ready'],
      ['in-progress', 'archived'],
      ['completed', 'archived'],
      ['completed', 'in-progress'],
    ];

    for (const [from, to] of validCases) {
      expect(isValidSpecTransition(from, to)).toBe(true);
    }
  });

  it('应拒绝非法转换', () => {
    const invalidCases: Array<[SpecStatus, SpecStatus]> = [
      ['draft', 'completed'],
      ['draft', 'in-progress'],
      ['ready', 'completed'],
      ['completed', 'ready'],
      ['archived', 'draft'],
      ['archived', 'in-progress'],
    ];

    for (const [from, to] of invalidCases) {
      expect(isValidSpecTransition(from, to)).toBe(false);
    }
  });

  it('archived 应为终态', () => {
    expect(VALID_SPEC_TRANSITIONS.archived).toEqual([]);
  });
});
