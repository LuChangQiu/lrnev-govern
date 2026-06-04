import { describe, it, expect } from 'vitest';
import { TaskStatus, VALID_TASK_TRANSITIONS, isValidTransition } from '../../src/types/task.js';

describe('Task 状态机', () => {
  it('TaskStatus 应导出 5 个枚举值', () => {
    expect(TaskStatus.PENDING).toBe('pending');
    expect(TaskStatus.IN_PROGRESS).toBe('in_progress');
    expect(TaskStatus.BLOCKED).toBe('blocked');
    expect(TaskStatus.COMPLETED).toBe('completed');
    expect(TaskStatus.FAILED).toBe('failed');
  });

  describe('合法转换', () => {
    const validCases: Array<[string, string]> = [
      ['pending', 'in_progress'],
      ['pending', 'blocked'],
      ['in_progress', 'completed'],
      ['in_progress', 'failed'],
      ['in_progress', 'blocked'],
      ['blocked', 'pending'],
      ['blocked', 'in_progress'],
      ['failed', 'pending'],
    ];
    for (const [from, to] of validCases) {
      it(`${from} → ${to} 应该合法`, () => {
        expect(isValidTransition(from as TaskStatus, to as TaskStatus)).toBe(true);
      });
    }
  });

  describe('非法转换', () => {
    const invalidCases: Array<[string, string]> = [
      ['pending', 'completed'],
      ['pending', 'failed'],
      ['completed', 'pending'],
      ['completed', 'in_progress'],
      ['completed', 'failed'],
      ['failed', 'completed'],
      ['failed', 'in_progress'],
      ['blocked', 'completed'],
      ['blocked', 'failed'],
    ];
    for (const [from, to] of invalidCases) {
      it(`${from} → ${to} 应该非法`, () => {
        expect(isValidTransition(from as TaskStatus, to as TaskStatus)).toBe(false);
      });
    }
  });

  it('completed 应为终态（无任何出边）', () => {
    expect(VALID_TASK_TRANSITIONS.completed).toEqual([]);
  });

  it('failed 应只能回到 pending（可重试语义）', () => {
    expect(VALID_TASK_TRANSITIONS.failed).toEqual(['pending']);
  });
});
