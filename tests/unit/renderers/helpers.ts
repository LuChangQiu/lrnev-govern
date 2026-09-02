/**
 * 渲染器测试公共 helper 函数
 */

import type { LrnevToolPayload } from '../../../src/mcp/types/response-envelope.js';

/**
 * 创建标准 LrnevToolPayload
 */
export function createPayload<T>(data: T, ai_followup?: { instructions: string[] }): LrnevToolPayload<T> {
  return {
    response_version: '1',
    ok: true,
    data,
    ...(ai_followup && { ai_followup }),
  };
}

/**
 * 创建错误 payload
 */
export function createErrorPayload(error: string): LrnevToolPayload<never> {
  return {
    response_version: '1',
    ok: false,
    error: { message: error },
  } as LrnevToolPayload<never>;
}
