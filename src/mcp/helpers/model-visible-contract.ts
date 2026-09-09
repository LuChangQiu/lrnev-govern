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
import { errorRenderer } from './renderers/error.js';
import { specCreateRenderer } from './renderers/spec-create.js';
import { specGetRenderer } from './renderers/spec-get.js';
import { specUpdateRenderer } from './renderers/spec-update.js';
import { specListRenderer } from './renderers/spec-list.js';
import { sceneCreateRenderer } from './renderers/scene-create.js';
import { sceneListRenderer } from './renderers/scene-list.js';
import { taskCreateRenderer } from './renderers/task-create.js';
import { assessGoalRenderer } from './renderers/assess-goal.js';
import { contextSearchRenderer } from './renderers/context-search.js';
import { taskCreateManyRenderer } from './renderers/task-create-many.js';
import { taskUpdateRenderer } from './renderers/task-update.js';
import { taskClaimRenderer } from './renderers/task-claim.js';
import { taskReleaseRenderer } from './renderers/task-release.js';
import { adrCreateRenderer } from './renderers/adr-create.js';
import { memorySaveRenderer } from './renderers/memory-save.js';
import { memoryForgetRenderer } from './renderers/memory-forget.js';
import { errorRecordRenderer } from './renderers/error-record.js';
import { errorPromoteRenderer } from './renderers/error-promote.js';
import { summarizeSaveRenderer } from './renderers/summarize-save.js';
import { sessionCommitRenderer } from './renderers/session-commit.js';
import { agentRegisterRenderer } from './renderers/agent-register.js';
import { agentHeartbeatRenderer } from './renderers/agent-heartbeat.js';
import { agentUnregisterRenderer } from './renderers/agent-unregister.js';
import { lrnevHookEnableRenderer } from './renderers/lrnev-hook-enable.js';
import { lrnevHookDisableRenderer } from './renderers/lrnev-hook-disable.js';
import { lrnevHookTriggerRenderer } from './renderers/lrnev-hook-trigger.js';
import { lrnevInitRenderer } from './renderers/lrnev-init.js';
import { specGateCheckRenderer } from './renderers/spec-gate-check.js';
import { adrGetRenderer } from './renderers/adr-get.js';
import { taskListRenderer } from './renderers/task-list.js';
import { sceneGetRenderer } from './renderers/scene-get.js';
import { errorSearchRenderer } from './renderers/error-search.js';
import { memorySearchRenderer } from './renderers/memory-search.js';
import { lrnevHookListRenderer } from './renderers/lrnev-hook-list.js';
import { lrnevHookTailLogRenderer } from './renderers/lrnev-hook-tail-log.js';
import { governanceMapRenderer } from './renderers/governance-map.js';
import { lrnevReportRenderer } from './renderers/lrnev-report.js';
import { projectStatusRenderer } from './renderers/project-status.js';
import { adrListRenderer } from './renderers/adr-list.js';
import { agentListRenderer } from './renderers/agent-list.js';
import { lrnevGuideRenderer } from './renderers/lrnev-guide.js';
import { lrnevDoctorRenderer } from './renderers/lrnev-doctor.js';

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
 * 初始化 M2 渲染器注册表。
 *
 * 第 0 批：错误路径专用（不计入工具渲染器数）
 * 第 1 批：9 个 B2b 证据工具（08-00 迁移验证）
 * 第 2 批：18 个写入/状态变更工具
 */
function initializeRenderers(): void {
  // 第 0 批：错误路径
  renderers.set('__error__', errorRenderer);

  // 第 1 批：9 个 B2b 证据工具
  renderers.set('spec_create', specCreateRenderer);
  renderers.set('spec_get', specGetRenderer);
  renderers.set('spec_update', specUpdateRenderer);
  renderers.set('spec_list', specListRenderer);
  renderers.set('scene_create', sceneCreateRenderer);
  renderers.set('scene_list', sceneListRenderer);
  renderers.set('task_create', taskCreateRenderer);
  renderers.set('assess_goal', assessGoalRenderer);
  renderers.set('context_search', contextSearchRenderer);

  // 第 2 批：18 个写入/状态变更工具
  renderers.set('task_create_many', taskCreateManyRenderer);
  renderers.set('task_update', taskUpdateRenderer);
  renderers.set('task_claim', taskClaimRenderer);
  renderers.set('task_release', taskReleaseRenderer);
  renderers.set('adr_create', adrCreateRenderer);
  renderers.set('memory_save', memorySaveRenderer);
  renderers.set('memory_forget', memoryForgetRenderer);
  renderers.set('error_record', errorRecordRenderer);
  renderers.set('error_promote', errorPromoteRenderer);
  renderers.set('summarize_save', summarizeSaveRenderer);
  renderers.set('session_commit', sessionCommitRenderer);
  renderers.set('agent_register', agentRegisterRenderer);
  renderers.set('agent_heartbeat', agentHeartbeatRenderer);
  renderers.set('agent_unregister', agentUnregisterRenderer);
  renderers.set('lrnev_hook_enable', lrnevHookEnableRenderer);
  renderers.set('lrnev_hook_disable', lrnevHookDisableRenderer);
  renderers.set('lrnev_hook_trigger', lrnevHookTriggerRenderer);
  renderers.set('lrnev_init', lrnevInitRenderer);

  // 第 3 批：8 个选择/歧义/搜索类工具
  renderers.set('spec_gate_check', specGateCheckRenderer);
  renderers.set('adr_get', adrGetRenderer);
  renderers.set('task_list', taskListRenderer);
  renderers.set('scene_get', sceneGetRenderer);
  renderers.set('error_search', errorSearchRenderer);
  renderers.set('memory_search', memorySearchRenderer);
  renderers.set('lrnev_hook_list', lrnevHookListRenderer);
  renderers.set('lrnev_hook_tail_log', lrnevHookTailLogRenderer);

  // 第 4 批：7 个 list/inspection 类工具
  renderers.set('governance_map', governanceMapRenderer);
  renderers.set('lrnev_report', lrnevReportRenderer);
  renderers.set('project_status', projectStatusRenderer);
  renderers.set('adr_list', adrListRenderer);
  renderers.set('agent_list', agentListRenderer);
  renderers.set('lrnev_guide', lrnevGuideRenderer);
  renderers.set('lrnev_doctor', lrnevDoctorRenderer);
}

// 模块加载时初始化
initializeRenderers();

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
