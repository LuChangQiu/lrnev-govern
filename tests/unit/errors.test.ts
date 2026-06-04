import { describe, it, expect } from 'vitest';
import { ErrorCode, LrnevError, isLrnevError } from '../../src/shared/errors.js';

describe('LrnevError 异常类', () => {
  it('应携带错误码与消息', () => {
    const err = new LrnevError(ErrorCode.SCENE_NOT_FOUND, 'Scene "demo" 不存在');
    expect(err.code).toBe('SCENE_NOT_FOUND');
    expect(err.message).toBe('Scene "demo" 不存在');
    expect(err.name).toBe('LrnevError');
  });

  it('应支持 field / hint / cause 可选项', () => {
    const cause = new Error('底层 IO 错误');
    const err = new LrnevError(ErrorCode.FILE_NOT_FOUND, '文件丢失', {
      field: 'path',
      hint: '检查 .lrnev/ 目录',
      cause,
    });
    expect(err.field).toBe('path');
    expect(err.hint).toBe('检查 .lrnev/ 目录');
    expect(err.cause).toBe(cause);
  });

  it('应支持 candidates 可选项', () => {
    const candidates = ['01-00-feat', '01-01-feat'];
    const err = new LrnevError(ErrorCode.AMBIGUOUS_REF, 'Spec 引用不唯一', {
      field: 'spec_id',
      candidates,
    });
    expect(err.candidates).toEqual(candidates);
  });

  it('toErrorInfo 应返回标准 ErrorInfo 结构', () => {
    const err = new LrnevError(ErrorCode.INVALID_URI, 'URI 格式错误', {
      field: 'uri',
      hint: '应以 context:// 开头',
    });
    expect(err.toErrorInfo()).toEqual({
      code: 'INVALID_URI',
      message: 'URI 格式错误',
      field: 'uri',
      hint: '应以 context:// 开头',
    });
  });

  it('toErrorInfo 应包含 candidates', () => {
    const err = new LrnevError(ErrorCode.AMBIGUOUS_REF, 'Spec 引用不唯一', {
      field: 'spec_id',
      hint: '使用完整 id',
      candidates: ['01-00-feat', '01-01-feat'],
    });
    expect(err.toErrorInfo()).toEqual({
      code: 'AMBIGUOUS_REF',
      message: 'Spec 引用不唯一',
      field: 'spec_id',
      hint: '使用完整 id',
      candidates: ['01-00-feat', '01-01-feat'],
    });
  });

  it('未显式传 hint 时应使用错误码默认 hint', () => {
    const err = new LrnevError(ErrorCode.INTERNAL_ERROR, '内部错误');
    const info = err.toErrorInfo();
    expect(info).toEqual({
      code: 'INTERNAL_ERROR',
      message: '内部错误',
      hint: expect.stringContaining('doctor'),
    });
    expect('field' in info).toBe(false);
  });

  it('instanceof 检查应成立', () => {
    const err = new LrnevError(ErrorCode.SCENE_NOT_FOUND, 'x');
    expect(err instanceof LrnevError).toBe(true);
    expect(err instanceof Error).toBe(true);
  });
});

describe('isLrnevError 类型守卫', () => {
  it('LrnevError 应返回 true', () => {
    expect(isLrnevError(new LrnevError(ErrorCode.INTERNAL_ERROR, 'x'))).toBe(true);
  });

  it('普通 Error 应返回 false', () => {
    expect(isLrnevError(new Error('x'))).toBe(false);
  });

  it('null/undefined/字符串应返回 false', () => {
    expect(isLrnevError(null)).toBe(false);
    expect(isLrnevError(undefined)).toBe(false);
    expect(isLrnevError('error')).toBe(false);
    expect(isLrnevError({ code: 'X' })).toBe(false);
  });
});

describe('ErrorCode 常量', () => {
  it('应包含已发布契约错误码', () => {
    const expectedCodes = [
      'SCENE_NOT_FOUND',
      'SCENE_CORRUPTED',
      'SPEC_NOT_FOUND',
      'SPEC_CORRUPTED',
      'AMBIGUOUS_REF',
      'TASK_NOT_FOUND',
      'INVALID_STATUS_TRANSITION',
      'INVALID_URI',
      'FILE_NOT_FOUND',
      'LOCK_HELD_BY_OTHER',
      'HOOK_FAILED',
      'HOOK_TIMEOUT',
      'HOOK_CONFIG_INVALID',
      'AGENT_NOT_REGISTERED',
      'ADR_NUMBER_CONFLICT',
      'INVALID_INPUT',
      'INTERNAL_ERROR',
    ];
    for (const code of expectedCodes) {
      expect(Object.values(ErrorCode)).toContain(code);
    }
  });

  it('错误码值不应重复', () => {
    const values = Object.values(ErrorCode);
    expect(new Set(values).size).toBe(values.length);
  });

  it('每个错误码都应自动提供可操作 hint', () => {
    for (const code of Object.values(ErrorCode)) {
      const info = new LrnevError(code, 'x').toErrorInfo();
      expect(info.hint).toEqual(expect.any(String));
      expect(info.hint?.length).toBeGreaterThan(0);
    }
  });
});
