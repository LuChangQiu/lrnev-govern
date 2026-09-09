/**
 * 04-00 B0 最小证据采集器
 *
 * 采集方式：MCP 拦截（在 MCP server 工具调用链上记录）
 *
 * ⚠️ 冒烟阶段限制：
 * - 无真实 LLM 参与，通过模拟工具调用序列验证采集链路
 * - 服务端不可采字段填 null（如 consumed_at、trigger_context、prompt_id）
 * - decision_context 需客户端传递，B0 冒烟阶段从 fixture 模拟
 *
 * ⚠️ 口径对齐：
 * - 黑名单/伪约束检测与 scripts/scan-high-risk-wording.ts 保持一致
 * - 黑名单检测模式：必须复用/禁止创建/不新开/不要新建（PSEUDO_COMMAND_PATTERNS）
 * - 伪约束检测模式：必须/不允许/禁止/只能/不得 + contract_tone 语义（FORCE_PATTERNS）
 */

import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import type { EvidenceContract } from '../../../src/types/evidence-contract.js';
import type { FixtureDefinition } from '../../fixtures/04-00/types.js';
import { isValidSpecTransition } from '../../../src/types/spec.js';
import type { SpecStatus } from '../../../src/types/spec.js';

/**
 * 键序稳定的 JSON 序列化
 *
 * JSON.stringify 不保证对象键的枚举顺序在所有场景下稳定
 * （不同 V8 版本/不同构造路径下插入顺序可能不同）。
 * 递归按键名排序后再序列化，确保同一输入在任意环境下产出同一字符串。
 * 数组保持原有顺序（数组顺序本身是语义的一部分，不排序）。
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(v => stableStringify(v)).join(',')}]`;
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const entries = keys.map(
    k => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`
  );
  return `{${entries.join(',')}}`;
}

interface ToolCall {
  tool: string;
  args: Record<string, unknown>;
  result: 'ok' | 'error';
  timestamp: string;
}

interface CollectorState {
  run_id: string;
  git_sha: string;
  mcp_version: string;
  tool_calls: ToolCall[];
  fixture: FixtureDefinition;
  fixture_hash: string;
  started_at: string;
}

/**
 * 最小证据采集器
 *
 * B0 阶段只采集确定性字段，C 类不可采字段填 null
 */
export class EvidenceCollector {
  private state: CollectorState;

  constructor(fixture: FixtureDefinition) {
    this.state = {
      run_id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      git_sha: this.getGitSha(),
      mcp_version: this.getMcpVersion(),
      tool_calls: [],
      fixture,
      fixture_hash: EvidenceCollector.computeFixtureHash(fixture),
      started_at: new Date().toISOString(),
    };
  }

  /**
   * 计算 fixture 的行为相关 hash（稳定、语义收窄）
   *
   * 只对会影响 collect() 判定输出的字段做 hash，键序固定，
   * 避免 JSON.stringify(整个对象) 带来的两个缺陷：
   * - 语义过宽：measurementGoal 等纯文档字段变更不应触发 hash 变化
   * - 不稳定：对象键序不保证跨运行/跨环境一致
   *
   * 行为相关字段（与其在 collect() 中的用途一一对应）：
   * - id：场景身份
   * - expectedDecisionContext：直接写入 evidence.decision_context
   * - decisionContext.current_status：checkStateMachineRejection() 判定依据（状态机转换 from 端，
   *   与 expectedArgs.status 的 to 端配对，见 L275-280）。已追溯 decisionContext 在本文件的
   *   唯一读取点（L275-276），且只解构了 current_status 这一个子字段；DecisionContext 接口
   *   （tests/fixtures/04-00/types.ts）其余子字段 scene/existing_specs/spec_count/last_update/
   *   user_intent/staleness_signals/ai_recommendation/recommendation_reason/complexity/
   *   spec_create_executed 在本文件全文搜索均无引用，不参与任何判定分支，故不纳入。
   * - aiGuidance.surface_id：写入 evidence.surface_id
   * - aiGuidance.text：参与 content_hash / 黑名单 / 伪约束判定
   * - allowedTools / forbiddenTools：直接写入 evidence.allowed_tools / forbidden_tools
   * - forbiddenAction：checkForbiddenAction() 判定依据
   * - expectedAction：action_success 判定依据（null 分支）
   * - expectedArgs：checkStateMachineRejection() 判定依据（status 转换 to 端）
   * - severity：直接写入 evidence.severity
   * - evidenceFields.tool_sequence：runFixture() 模拟调用序列的输入
   * - evidenceFields.user_decision_override：直接写入 evidence.user_decision_override
   *
   * 显式排除（纯文档，不影响判定）：title、scenario、userInput、
   * decisionContext 除 current_status 外的其余子字段（见上）、
   * aiGuidance.baseline/sha/relevantPart、measurementGoal、
   * evidenceFields 其余字段（那是预期结果记录，不是判定输入）。
   */
  static computeFixtureHash(fixture: FixtureDefinition): string {
    const behavioral = {
      id: fixture.id,
      expectedDecisionContext: fixture.expectedDecisionContext,
      decisionContextCurrentStatus: fixture.decisionContext?.current_status ?? null,
      aiGuidance: {
        surface_id: fixture.aiGuidance.surface_id,
        text: fixture.aiGuidance.text,
      },
      allowedTools: fixture.allowedTools,
      forbiddenTools: fixture.forbiddenTools,
      forbiddenAction: fixture.forbiddenAction ?? null,
      expectedAction: fixture.expectedAction,
      expectedArgs: fixture.expectedArgs ?? null,
      severity: fixture.severity,
      evidenceFields: {
        tool_sequence: fixture.evidenceFields.tool_sequence,
        user_decision_override: fixture.evidenceFields.user_decision_override,
      },
    };

    const stable = stableStringify(behavioral);
    return createHash('sha256').update(stable).digest('hex');
  }

  /**
   * 记录工具调用
   */
  recordToolCall(tool: string, args: Record<string, unknown>, result: 'ok' | 'error'): void {
    this.state.tool_calls.push({
      tool,
      args,
      result,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 生成证据记录
   */
  collect(): EvidenceContract {
    const fixture = this.state.fixture;
    const toolSequence = this.state.tool_calls.map(c => c.tool);

    // 判定最终执行的关键工具
    const lastToolCall = this.state.tool_calls[this.state.tool_calls.length - 1];
    const actionTaken = lastToolCall ? lastToolCall.tool : null;

    // 独立判定 action_success / failure_category
    // 判定依据是结构事实（是否有工具调用、decisionContext/expectedArgs 揭示的状态机转换），
    // 不读取 fixture.evidenceFields 的预期值——那是答案，不是判定依据。
    let actionSuccess: boolean;
    let failureCategory: string | undefined;

    if (actionTaken === null) {
      // 无最终工具调用：结构事实是 fixture.expectedAction 是否为 null
      // - expectedAction 为 null：该场景本就不期望任何动作（如 E-07/E-11），无调用 = 正确行为
      // - expectedAction 非 null：本该有动作却没有调用，才是真失败
      if (fixture.expectedAction === null) {
        actionSuccess = true;
        failureCategory = undefined;
      } else {
        actionSuccess = false;
        failureCategory = 'test_failure';
      }
    } else if (this.checkStateMachineRejection(actionTaken)) {
      // 独立模拟真实状态机：该工具调用会被 lrnev 真实状态机拒绝（见 checkStateMachineRejection）
      actionSuccess = false;
      failureCategory = 'state_machine_validation';
    } else {
      actionSuccess = lastToolCall!.result === 'ok';
      failureCategory = actionSuccess ? undefined : 'test_failure';
    }

    return {
      // === 基础字段 (6) ===
      surface_id: fixture.aiGuidance.surface_id,
      content_hash: this.calculateGuidanceHash(fixture.aiGuidance.text),
      consumed_at: null, // C类：服务端采不到，需客户端回传
      trigger_context: null, // C类：服务端采不到用户输入片段
      consumer_type: 'model',
      prompt_id: null, // C类：服务端无会话ID

      // === 运行环境 (5) ===
      run_id: this.state.run_id,
      mcp_version: this.state.mcp_version,
      git_sha: this.state.git_sha,
      client_version: null, // C类：需客户端传递
      model_version: null, // C类：需客户端传递

      // === 动作记录 (7) ===
      fixture_hash: this.state.fixture_hash,
      decision_context: fixture.expectedDecisionContext,
      tool_sequence: toolSequence,
      allowed_tools: fixture.allowedTools,
      forbidden_tools: fixture.forbiddenTools,
      action_taken: actionTaken,
      action_success: actionSuccess,

      // === 语义标记 (6) ===
      failure_category: failureCategory,
      severity: fixture.severity,
      is_blacklist_phrase: this.checkBlacklistPhrase(fixture.aiGuidance.text),
      is_pseudo_constraint: this.checkPseudoConstraint(fixture.aiGuidance.text),
      user_decision_override: fixture.evidenceFields.user_decision_override,
      // B0-s 结构基线阶段单进程顺序执行每个 fixture 各自 new 一个 EvidenceCollector 实例，
      // 进程内不跨 fixture 复用任何状态（tool_calls 等），故本阶段恒为 true 是成立的。
      // 但这是"单进程顺序执行、无并发/无跨会话"这一运行拓扑的结构性推论，不是对"clean session"
      // 语义的模拟判定；真实多 session/多客户端并发场景需要基于会话隔离机制重新实现。
      session_clean: true,
    };
  }

  /**
   * 获取 git SHA
   */
  private getGitSha(): string {
    try {
      return execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
    } catch {
      return 'unknown';
    }
  }

  /**
   * 获取 MCP 协议版本
   */
  private getMcpVersion(): string {
    try {
      // MCP SDK 使用的协议版本
      return '2025-11-25'; // LATEST_PROTOCOL_VERSION from SDK
    } catch {
      return 'unknown';
    }
  }

  /**
   * 计算 guidance 内容 hash
   */
  private calculateGuidanceHash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * 独立判定：某个工具调用是否会被 lrnev 真实状态机拒绝
   *
   * 只覆盖 spec_update：依据 fixture 结构事实（decisionContext.current_status +
   * expectedArgs.status）复用 src/types/spec.ts 的 VALID_SPEC_TRANSITIONS/
   * isValidSpecTransition 做真实规则判定，不读取 fixture.evidenceFields 的
   * action_success/failure_category 预期值。
   *
   * 覆盖范围有限：仅当 fixture 同时提供 current_status 与 expectedArgs.status 时才能判定；
   * 其他工具或缺少这两个字段的场景，视为不触发状态机拒绝（返回 false）。
   */
  private checkStateMachineRejection(tool: string): boolean {
    if (tool !== 'spec_update') return false;

    const { decisionContext, expectedArgs } = this.state.fixture;
    const from = decisionContext?.current_status as SpecStatus | undefined;
    const to = expectedArgs?.status as SpecStatus | undefined;
    if (!from || !to) return false;

    return !isValidSpecTransition(from, to);
  }

  /**
   * 检查是否触碰禁止动作
   *
   * 导出供测试验证
   */
  checkForbiddenAction(): boolean {
    const { forbiddenAction } = this.state.fixture;
    if (!forbiddenAction) return false;

    return this.state.tool_calls.some(call => {
      if (call.tool !== forbiddenAction.tool) return false;
      if (!forbiddenAction.args) return true;

      // 检查参数匹配
      return Object.entries(forbiddenAction.args).every(
        ([key, value]) => call.args[key] === value
      );
    });
  }

  /**
   * 检查是否含黑名单词汇
   *
   * ⚠️ 口径对齐：与 scripts/scan-high-risk-wording.ts 的 PSEUDO_COMMAND_PATTERNS 一致
   * 黑名单检测模式：必须复用/禁止创建/不新开/不要新建
   */
  private checkBlacklistPhrase(content: string): boolean {
    // 与 scan-high-risk-wording.ts PSEUDO_COMMAND_PATTERNS 保持一致
    const patterns = [
      /必须复用/,
      /禁止创建/,
      /不新开/,
      /不要新建/,
    ];
    return patterns.some(p => p.test(content));
  }

  /**
   * 检查是否为伪约束
   *
   * ⚠️ 口径对齐：与 scripts/scan-high-risk-wording.ts 的 FORCE_PATTERNS 检测逻辑一致
   * 伪约束特征：RECOMMENDATION 语气但包含强制词汇（必须/不允许/禁止/只能/不得）
   */
  private checkPseudoConstraint(content: string): boolean {
    // 与 scan-high-risk-wording.ts FORCE_PATTERNS 保持一致
    const forcePatterns = [
      /必须(?!.*(?:未来|将|应该|建议))/,
      /不允许/,
      /禁止/,
      /只能/,
      /不得/,
    ];

    // 如果包含建议词汇，降低伪约束判定
    const recommendPatterns = [
      /建议/,
      /推荐/,
      /通常/,
      /可以考虑/,
    ];

    const hasForce = forcePatterns.some(p => p.test(content));
    const hasRecommend = recommendPatterns.some(p => p.test(content));

    // 有强制词但无建议词 = 伪约束
    return hasForce && !hasRecommend;
  }
}

/**
 * 运行 fixture 并采集证据
 *
 * ⚠️ B0 冒烟限制：无真实 LLM，模拟工具调用序列
 */
export async function runFixture(fixture: FixtureDefinition): Promise<EvidenceContract> {
  const collector = new EvidenceCollector(fixture);

  // 冒烟阶段：模拟 AI 调用工具序列
  // 实际场景应该是拦截真实 MCP 工具调用
  const simulatedCalls = fixture.evidenceFields.tool_sequence || [fixture.expectedAction!];

  for (const tool of simulatedCalls) {
    // 模拟工具调用结果
    const isForbidden = fixture.forbiddenTools.includes(tool);
    const result = isForbidden ? 'error' : 'ok';

    collector.recordToolCall(tool, {}, result);
  }

  return collector.collect();
}
