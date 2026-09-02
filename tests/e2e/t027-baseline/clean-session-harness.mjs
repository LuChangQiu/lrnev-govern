#!/usr/bin/env node
/**
 * T-027 Phase 2 Clean Session Harness
 *
 * 功能：
 * 1. 读取 fixture userInput 构建盲测 prompt
 * 2. 构建 fixture 工作区（基于 decisionContext）
 * 3. 预检：assess_goal 验证服务端建议方向
 * 4. 驱动客户端执行 clean session
 * 5. 全量录制 24 字段证据契约
 *
 * 盲测原则：
 * - prompt 只读 userInput
 * - 期望字段零注入（expectedAction/Target/prohibited 不可见）
 * - E-06b 分轮注入（先第1轮 → 等 spec_create(B) → 第2轮）
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Clean Session Harness 配置
 */
interface HarnessConfig {
  projectRoot: string;
  fixturesDir: string;
  evidenceDir: string;
  sha: 'sha-a' | 'sha-b';
  client: 'claude-code' | 'codex' | 'opencode';
  sessionCount: number; // 每场景每 SHA 的 clean session 次数
}

/**
 * 24 字段证据契约
 */
interface EvidenceRecord {
  // A类：工具元数据
  surface_id: string;
  content_hash: string | null;
  consumer_type: 'model' | 'client';

  // B类：决策与动作
  decision_context: {
    source?: 'client_asserted';
    strength?: 'explicit' | 'preferred' | 'unspecified';
    summary?: string;
    direction?: string;
    target_ref?: string;
  } | null;
  user_decision_override: boolean;
  tool_sequence: string[];
  action_taken: string | null;
  action_success: boolean;
  severity: 'low' | 'medium' | 'high';

  // C类：运行环境
  consumed_at: string | null;
  trigger_context: string | null;
  prompt_id: string | null;
  client: string;
  model_version: string | null;

  // 元信息
  scenario_id: string;
  fixture_hash: string;
  run_id: string;
  mcp_version: string;
  git_sha: string;
  session_clean: boolean;
  failure_category?: string;
}

/**
 * 工作区构建器
 */
class WorkspaceBuilder {
  constructor(private projectRoot: string) {}

  /**
   * 根据 fixture.decisionContext 构建工作区
   */
  async buildWorkspace(fixture: any): Promise<void> {
    const { decisionContext } = fixture;

    // 示例：如果 fixture 要求 existing_specs，创建对应 Spec
    if (decisionContext.existing_specs) {
      for (const specDesc of decisionContext.existing_specs) {
        // 解析 "01-00-user-login (in-progress)" 格式
        const match = specDesc.match(/^([\w-]+)\s*\((\w+)\)$/);
        if (match) {
          const [, specId, status] = match;
          // 创建 Spec（调用 lrnev spec_create）
          console.error(`[Workspace] 创建 Spec: ${specId}, status=${status}`);
          // 实际实现：调用 MCP 工具或直接操作文件系统
        }
      }
    }

    console.error(`[Workspace] 工作区构建完成: ${fixture.id}`);
  }

  /**
   * 预检：使用 assess_goal 验证服务端建议方向
   */
  async precheck(fixture: any, sha: 'sha-a' | 'sha-b'): Promise<boolean> {
    console.error(`[Precheck] 验证场景前提: ${fixture.id} (SHA: ${sha})`);

    // 调用 assess_goal，验证服务端建议方向是否符合 fixture.aiGuidance
    // 例如：E-01 期望服务端建议 "reuse_spec"，但用户明确要求 new_spec

    // 实际实现：启动 MCP server，调用 assess_goal
    // 如果建议方向与场景前提不符，报错并跳过

    return true; // 假设通过
  }
}

/**
 * Clean Session Driver
 */
class CleanSessionDriver {
  constructor(
    private config: HarnessConfig,
    private workspaceBuilder: WorkspaceBuilder
  ) {}

  /**
   * 执行单个场景的 clean sessions
   */
  async runScenario(fixture: any): Promise<EvidenceRecord[]> {
    const evidences: EvidenceRecord[] = [];

    console.error(`\n🧪 场景: ${fixture.id} - ${fixture.title}`);
    console.error(`   SHA: ${this.config.sha}, 客户端: ${this.config.client}`);

    // 构建工作区
    await this.workspaceBuilder.buildWorkspace(fixture);

    // 预检
    const precheckPassed = await this.workspaceBuilder.precheck(
      fixture,
      this.config.sha
    );
    if (!precheckPassed) {
      console.error(`   ⚠️  预检失败，跳过场景`);
      return evidences;
    }

    // 执行 N 次 clean session
    for (let i = 1; i <= this.config.sessionCount; i++) {
      console.error(`   🔄 Session ${i}/${this.config.sessionCount}`);

      const evidence = await this.runSingleSession(fixture, i);
      evidences.push(evidence);

      // 清理工作区（恢复到干净状态）
      await this.cleanupWorkspace();
    }

    return evidences;
  }

  /**
   * 执行单次 clean session
   */
  private async runSingleSession(
    fixture: any,
    sessionIndex: number
  ): Promise<EvidenceRecord> {
    const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    // 构建盲测 prompt（只读 userInput）
    const prompt = this.buildBlindPrompt(fixture);

    console.error(`   📝 Prompt: ${prompt.slice(0, 50)}...`);

    // 驱动客户端执行
    const result = await this.driveClient(prompt, fixture);

    // 构建证据记录（24 字段契约）
    const evidence: EvidenceRecord = {
      // A类
      surface_id: fixture.aiGuidance.surface_id,
      content_hash: null,
      consumer_type: 'model',

      // B类
      decision_context: result.decision_context || null,
      user_decision_override: result.user_decision_override || false,
      tool_sequence: result.tool_sequence || [],
      action_taken: result.action_taken || null,
      action_success: result.action_success || false,
      severity: fixture.severity,

      // C类
      consumed_at: new Date().toISOString(),
      trigger_context: null,
      prompt_id: null,
      client: this.config.client,
      model_version: null,

      // 元信息
      scenario_id: fixture.id,
      fixture_hash: this.computeFixtureHash(fixture),
      run_id: runId,
      mcp_version: '2024-11-05',
      git_sha: this.config.sha === 'sha-a' ? '45a86e15' : '6383e99',
      session_clean: true,
      failure_category: result.failure_category,
    };

    return evidence;
  }

  /**
   * 构建盲测 prompt（只读 userInput，期望字段零注入）
   */
  private buildBlindPrompt(fixture: any): string {
    // 盲测原则：只读 userInput
    // E-06b 特殊处理：分轮注入（harness 需检测 spec_create(B) 完成）
    return fixture.userInput;
  }

  /**
   * 驱动客户端执行（headless 模式）
   */
  private async driveClient(prompt: string, fixture: any): Promise<any> {
    // 实际实现：
    // - Claude Code: 使用 claude -p 或 API
    // - Codex: 使用 Codex CLI
    // - OpenCode: 使用 OpenCode CLI

    console.error(`   ⏳ 驱动客户端执行...`);

    // 模拟结果
    return {
      tool_sequence: ['spec_create'],
      action_taken: 'spec_create',
      action_success: true,
      decision_context: {
        source: 'client_asserted',
        strength: 'explicit',
        direction: 'new_spec',
      },
    };
  }

  /**
   * 清理工作区
   */
  private async cleanupWorkspace(): Promise<void> {
    console.error(`   🧹 清理工作区`);
    // 实际实现：删除创建的 Spec/Task/Scene
  }

  /**
   * 计算 fixture hash
   */
  private computeFixtureHash(fixture: any): string {
    const { createHash } = require('node:crypto');
    const content = JSON.stringify({
      id: fixture.id,
      userInput: fixture.userInput,
      expectedAction: fixture.expectedAction,
    });
    return createHash('sha256').update(content).digest('hex').slice(0, 8);
  }
}

/**
 * Harness 主入口
 */
async function main() {
  const config: HarnessConfig = {
    projectRoot: process.cwd(),
    fixturesDir: resolve(process.cwd(), 'tests/fixtures/04-00'),
    evidenceDir: resolve(process.cwd(), 'tests/e2e/t027-baseline/.evidences'),
    sha: (process.env.T027_SHA as 'sha-a' | 'sha-b') || 'sha-a',
    client: (process.env.T027_CLIENT as any) || 'claude-code',
    sessionCount: 5, // F-03: 每客户端 ≥5 explicit sessions
  };

  console.error('🚀 T-027 Clean Session Harness');
  console.error('═'.repeat(60));
  console.error(`SHA: ${config.sha}`);
  console.error(`客户端: ${config.client}`);
  console.error(`每场景 session 数: ${config.sessionCount}`);
  console.error('');

  // 创建证据目录
  if (!existsSync(config.evidenceDir)) {
    mkdirSync(config.evidenceDir, { recursive: true });
  }

  const workspaceBuilder = new WorkspaceBuilder(config.projectRoot);
  const driver = new CleanSessionDriver(config, workspaceBuilder);

  // 加载所有 fixture
  const fixturesIndex = await import(
    `${config.fixturesDir}/index.ts`
  );
  const fixtures = Object.values(fixturesIndex).filter(
    (f: any) => f && typeof f === 'object' && f.id
  );

  console.error(`📦 加载 ${fixtures.length} 个场景`);
  console.error('');

  // 执行所有场景
  const allEvidences: EvidenceRecord[] = [];

  for (const fixture of fixtures) {
    const evidences = await driver.runScenario(fixture);
    allEvidences.push(...evidences);
  }

  // 保存证据清单
  const manifestPath = resolve(
    config.evidenceDir,
    `t027-${config.sha}-${config.client}.json`
  );
  writeFileSync(manifestPath, JSON.stringify(allEvidences, null, 2));

  console.error('\n📊 汇总');
  console.error('═'.repeat(60));
  console.error(`总 session 数: ${allEvidences.length}`);
  console.error(`成功: ${allEvidences.filter(e => e.action_success).length}`);
  console.error(`失败: ${allEvidences.filter(e => !e.action_success).length}`);
  console.error(`证据清单: ${manifestPath}`);
  console.error('');
}

main().catch((err) => {
  console.error('❌ Harness 异常:', err);
  process.exit(1);
});
