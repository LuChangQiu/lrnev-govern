/**
 * 03-00-mcp-response-conformance M2 (T-004)
 *
 * ModelVisibleContract 渲染器框架。
 *
 * D-04 核心约束：
 * 1. Canonical 单源：renderer 从同一 payload 取值，禁止独立数据源
 * 2. 逃逸层级：content 渲染后统一逃逸框架标记（</ → <\/）
 * 3. 体积控制同步：截断元数据先写 payload，两通道同步渲染
 * 4. 错误路径 MVC：schema 失败返回工具错误，isError=true 时 content 仍满足 MVC
 */

import type { LrnevToolPayload } from '../types/response-envelope.js';

/**
 * ModelVisibleContract 渲染器接口。
 *
 * 每个工具类别实现一个 renderer，将 canonical payload (structuredContent)
 * 渲染为模型可见的 content 文本。
 *
 * D-04 硬性要求：
 * - **Canonical 单源**: renderer 从同一 payload 取值，禁止独立数据源
 * - **逃逸层级**: 返回文本由调用方统一逃逸框架标记（</ → <\/）
 * - **体积控制同步**: 截断元数据先写 payload，再两通道同步渲染
 * - **错误路径 MVC**: isError=true 时 content 仍满足 ModelVisibleContract
 */
export interface ModelVisibleRenderer<T = unknown> {
  /**
   * 渲染 canonical payload 为 content 文本。
   *
   * @param payload 完整的 structuredContent (source of truth)
   * @returns 模型可见的文本投影（未逃逸，由调用方统一处理）
   */
  render(payload: LrnevToolPayload<T>): string;
}

/**
 * 工具名称到 renderer 的映射（支持按工具回退）。
 */
type RendererRegistry = Map<string, ModelVisibleRenderer>;

/**
 * 全局 renderer 注册表（按工具注册，非全局开关）。
 */
const renderers: RendererRegistry = new Map();

/**
 * 注册工具的 ModelVisibleContract 渲染器。
 *
 * @param toolName 工具名称
 * @param renderer 渲染器实现
 */
export function registerRenderer(toolName: string, renderer: ModelVisibleRenderer): void {
  renderers.set(toolName, renderer);
}

/**
 * 批量注册工具的 ModelVisibleContract 渲染器。
 *
 * @param toolNames 工具名称列表
 * @param renderer 共享的渲染器实现
 */
export function registerRendererBatch(toolNames: string[], renderer: ModelVisibleRenderer): void {
  for (const toolName of toolNames) {
    renderers.set(toolName, renderer);
  }
}

/**
 * 渲染 content（M2 主入口）。
 *
 * 查找工具的 renderer，如果未找到则回退到 M1 legacy JSON。
 *
 * D-04.1 逃逸层级契约：
 * - structuredContent: 不逃逸（source of truth，字节级精确）
 * - content: 渲染后统一逃逸框架标记（</ → <\/，防 prompt injection）
 *
 * @param toolName 工具名称
 * @param payload Canonical payload (structuredContent)
 * @returns 逃逸后的 content 文本
 */
export function renderModelVisibleContent(toolName: string, payload: LrnevToolPayload<unknown>): string {
  const renderer = renderers.get(toolName);

  let rawContent: string;
  if (renderer) {
    // M2: 使用工具的 ModelVisibleContract 渲染器
    rawContent = renderer.render(payload);
  } else {
    // M1 回退: legacy JSON
    rawContent = JSON.stringify(payload, null, 2);
  }

  // D-04.1: 统一逃逸框架标记
  return escapeFrameworkMarkers(rawContent);
}

/**
 * 逃逸框架标记（DSH 文本转义方式，ADR-0002）。
 *
 * 将 </ 转义为 <\/ 防止用户文本闭合客户端 prompt 框架标签。
 *
 * **为何不用 HTML 实体**：
 * - &lt; 在客户端 HTML 渲染时会解码还原为 <
 * - 框架闭合漏洞回归（prompt injection）
 *
 * **幂等性契约**：
 * - escapeFrameworkMarkers(escapeFrameworkMarkers(x)) === escapeFrameworkMarkers(x)
 * - 多次逃逸不会产生 <\\\/ 或更多反斜杠
 *
 * **实现策略**：
 * - 只转义 </ 不转义 <\/（已逃逸标记不重复转义）
 * - 正则 /<(?!\\)\// 匹配 </ 后面不跟 \ 的情况
 *
 * @param userText 用户控制的文本（可能含 </ 标签）
 * @returns 逃逸后的文本（</ → <\/）
 */
export function escapeFrameworkMarkers(userText: string): string {
  // </ → <\/ （仅转义未逃逸的）
  // 负向前瞻 (?!\\) 确保 <\/ 不被重复转义为 <\\/
  return userText.replace(/<(?!\\)\//g, '<\\/');
}
