import { describe, it, expect } from 'vitest';
import {
  LrnevToolPayload,
  shouldSetIsError,
  wrapInternalError,
  createSchemaValidationError,
} from '../../src/mcp/types/response-envelope.js';

describe('response-envelope', () => {
  describe('shouldSetIsError', () => {
    it('ok=true 应返回 false', () => {
      const payload: LrnevToolPayload = {
        response_version: '1',
        ok: true,
        data: { confirmed: true },
      };
      expect(shouldSetIsError(payload)).toBe(false);
    });

    it('ok=false（业务拒绝）应返回 true', () => {
      const payload: LrnevToolPayload = {
        response_version: '1',
        ok: false,
        errors: [{
          code: 'GATE_FAILED',
          message: 'Gate check failed',
        }],
      };
      expect(shouldSetIsError(payload)).toBe(true);
    });

    it('ok=false（内部错误）应返回 true', () => {
      const payload: LrnevToolPayload = {
        response_version: '1',
        ok: false,
        errors: [{
          code: 'INTERNAL_ERROR',
          message: 'Internal error',
        }],
      };
      expect(shouldSetIsError(payload)).toBe(true);
    });

    it('ok=false（歧义引用 AMBIGUOUS_REF）应返回 true', () => {
      const payload: LrnevToolPayload = {
        response_version: '1',
        ok: false,
        errors: [{
          code: 'AMBIGUOUS_REF',
          message: 'Ambiguous reference',
          candidates: ['scene-a', 'scene-b'],
        }],
      };
      expect(shouldSetIsError(payload)).toBe(true);
    });

    it('ok=false（任意其他错误码）应返回 true', () => {
      const payload: LrnevToolPayload = {
        response_version: '1',
        ok: false,
        errors: [{
          code: 'SCENE_NOT_FOUND',
          message: 'Scene not found',
        }],
      };
      expect(shouldSetIsError(payload)).toBe(true);
    });

    it('ok=false 且没有 errors 数组时应返回 true', () => {
      const payload: LrnevToolPayload = {
        response_version: '1',
        ok: false,
      };
      expect(shouldSetIsError(payload)).toBe(true);
    });
  });

  describe('wrapInternalError', () => {
    it('应包装内部错误为 INTERNAL_ERROR', () => {
      const error = new Error('Test error');
      const errorInfo = wrapInternalError(error, 'test_operation');

      expect(errorInfo.code).toBe('INTERNAL_ERROR');
      expect(errorInfo.message).toContain('内部错误');
      expect(errorInfo.hint).toBeTruthy();

      // 验证该错误在 payload 中会触发 isError
      const payload: LrnevToolPayload = {
        response_version: '1',
        ok: false,
        errors: [errorInfo],
      };
      expect(shouldSetIsError(payload)).toBe(true);
    });
  });

  describe('createSchemaValidationError', () => {
    it('应创建 schema 验证失败错误', () => {
      const errorInfo = createSchemaValidationError('spec_name', 'missing field');

      expect(errorInfo.code).toBe('INTERNAL_ERROR');
      expect(errorInfo.message).toContain('spec_name');
      expect(errorInfo.message).toContain('missing field');

      // 验证该错误在 payload 中会触发 isError
      const payload: LrnevToolPayload = {
        response_version: '1',
        ok: false,
        errors: [errorInfo],
      };
      expect(shouldSetIsError(payload)).toBe(true);
    });

    it('应创建 schema 验证失败错误（无 details）', () => {
      const errorInfo = createSchemaValidationError('spec_name');

      expect(errorInfo.code).toBe('INTERNAL_ERROR');
      expect(errorInfo.message).toContain('spec_name');
      expect(errorInfo.hint).toBeTruthy();
    });
  });
});
