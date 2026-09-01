/**
 * 03-00-mcp-response-conformance M2 (T-004)
 *
 * Legacy JSON 渲染器（M1 回退目标）。
 *
 * 用途：
 * - 未注册 M2 renderer 的工具自动回退到此
 * - 按工具回退时的目标 renderer
 * - 保留 M1 的 legacy JSON 格式作为稳定基线
 */

import type { ModelVisibleRenderer } from '../model-visible-contract.js';
import type { LrnevToolPayload } from '../../types/response-envelope.js';

/**
 * Legacy JSON 渲染器（M1 格式）。
 *
 * 将完整 payload 序列化为 JSON（与 M1 行为一致）。
 */
export const legacyJsonRenderer: ModelVisibleRenderer = {
  render(payload: LrnevToolPayload<unknown>): string {
    return JSON.stringify(payload, null, 2);
  },
};
