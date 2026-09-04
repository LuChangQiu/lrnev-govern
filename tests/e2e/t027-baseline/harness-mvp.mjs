#!/usr/bin/env node
/**
 * T-027 Phase 2 Clean Session Harness - MVP（独立工作区）
 *
 * 目标：先跑通 1 个场景（E-01），验证完整流程
 *
 * 关键修正：
 * 1. 独立工作区（临时目录，主工作区零写入）
 * 2. 真实预检（assess_goal 验证）
 * 3. 真实清理（删除临时工作区）
 * 4. 补充 --verbose
 * 5. 通过 wrapper 走 worktree（SHA A/B）
 * 6. 方案 D：动态 import .ts 权威源（tsx loader 转译，零构建，防漂移）
 */

import { spawn } from 'node:child_process';
import { writeFileSync, existsSync, mkdirSync, readFileSync, rmSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const projectRoot = process.cwd();
const sha = process.env.T027_SHA || 'sha-a';
const scenarioId = process.env.T027_SCENARIO || 'E-01';

// 方案 D：动态加载 .ts 权威源
const fixturesIndexPath = resolve(projectRoot, 'tests/fixtures/04-00/index.ts');
const fixturesModule = await import(pathToFileURL(fixturesIndexPath).href);

// 构建 fixture 映射表（id → fixture）
const FIXTURES = {};
for (const key of Object.keys(fixturesModule)) {
  const fixture = fixturesModule[key];
  if (fixture && typeof fixture === 'object' && fixture.id) {
    FIXTURES[fixture.id] = fixture;
  }
}

const fixture = FIXTURES[scenarioId];
if (!fixture) {
  console.error(`❌ 未知场景: ${scenarioId}`);
  console.error(`可用场景: ${Object.keys(FIXTURES).join(', ')}`);
  process.exit(1);
}

// 修正 P0-1: 使用项目子目录 + 临时 CLAUDE_CONFIG_DIR 隔离
const tempWorkspace = resolve(projectRoot, '.claude/t027-harness-workspace', `run-${Date.now()}`);
const tempConfigDir = resolve(projectRoot, '.claude/t027-harness-config', `config-${Date.now()}`);
mkdirSync(tempWorkspace, { recursive: true });
mkdirSync(tempConfigDir, { recursive: true });

// 创建纯净的 MCP 配置（只有 lrnev-t027）
const mcpConfigPath = resolve(tempConfigDir, 'mcp.json');
const wrapperPath = resolve(projectRoot, 'tests/e2e/t027-baseline/wrapper.mjs');
writeFileSync(mcpConfigPath, JSON.stringify({
  mcpServers: {
    'lrnev-t027': {
      command: 'node',
      args: [wrapperPath],
      disabled: false
    }
  }
}, null, 2));

console.error('🚀 T-027 Clean Session Harness (MVP)');
console.error(`📍 SHA: ${sha}`);
console.error(`🗂️  独立工作区: ${tempWorkspace}`);
console.error(`⚙️  隔离配置: ${tempConfigDir}`);
console.error('');

console.error(`📦 Fixture: ${fixture.id} - ${fixture.title}`);

/* ================================================================
 * 证据契约 v2 对齐辅助（裁决 2026-09-03 Q1-B/Q3/Q6/Q8/Q9）
 * 目标：放量版 evidence JSON 过 scripts/validate-evidence-manifest.mjs strict 0 ERROR。
 * schema 唯一事实源：src/schemas/evidence-contract.schema.json（version 2.0.0）。
 * ================================================================ */

// MCP 协议版本（server 实际协商值，2025-11-25 = SDK LATEST_PROTOCOL_VERSION）
const MCP_PROTOCOL_VERSION = '2025-11-25';

// 主 surface：server instructions = workflow_overview（每 session 启动真实消费）
const MAIN_SURFACE_ID = 'server_instructions:global:workflow_overview';

/**
 * content_hash 来源文件集（worktree 相对路径，固定序；存在才纳入）：
 *  - src/mcp/guidance.ts              —— workflow_overview 指令文本模块（WORKFLOW_OVERVIEW/TOOL_DESCRIPTIONS）
 *  - src/mcp/server.ts                —— server 启动指令组装模块（buildInstructions 把 WORKFLOW_OVERVIEW 拼进 initialize instructions）
 *  - src/core/guidance-semantics.ts   —— sha-b 起 WORKFLOW_OVERVIEW 引用其 USER_DECISION_PRIORITY_CLAUSE
 *                                        （存在才纳入；sha-a 无此文件）
 * 裁决 Q1-B：content_hash 从目标 worktree server 源码字节计算，文件字节即权威（保真成立）。
 * 空 worktree 场景（理论上 server 无法启动）用哨兵哈希 + stderr 告警兜底，避免产出非法 null。
 */
const CONTENT_HASH_SOURCE_FILES = [
  'src/mcp/guidance.ts',
  'src/mcp/server.ts',
  'src/core/guidance-semantics.ts',
];

/** 稳定序列化：键序排序、数组保序 —— 与 tests/e2e/04-00/evidence-collector.ts stableStringify 同实现 */
function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(',')}]`;
  }
  const keys = Object.keys(value).sort();
  const entries = keys.map(
    (k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`
  );
  return `{${entries.join(',')}}`;
}

/**
 * fixture_hash（64hex，裁决 Q6）：行为收窄口径，与 EvidenceCollector.computeFixtureHash 完全一致
 * （行为相关字段子集 + 稳定键序，跨 B0~B2b 阶段可比；不再用 {id,userInput} 旧口径 8hex）。
 */
function computeFixtureHash(fixture) {
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
  return createHash('sha256').update(stableStringify(behavioral)).digest('hex');
}

/**
 * content_hash：目标 worktree 被测 guidance 模块文件字节的 sha256（裁决 Q1-B）。
 * @returns {{ hash: string, files: string[] }} files = 实际纳入的 worktree 相对路径
 */
function computeWorktreeContentHash(shaLabel) {
  const worktreePath = resolve(projectRoot, '.claude/t027-worktrees', shaLabel);
  const hash = createHash('sha256');
  const files = [];
  for (const rel of CONTENT_HASH_SOURCE_FILES) {
    const p = resolve(worktreePath, rel);
    if (!existsSync(p)) continue;
    // 原始字节（不指定 encoding → Buffer），不排序、按固定序拼接进同一 digest
    hash.update(readFileSync(p));
    files.push(rel);
  }
  if (files.length === 0) {
    console.error(`⚠️ content_hash 兜底：worktree ${worktreePath} 无任何 guidance 源文件，改用哨兵哈希`);
    return { hash: createHash('sha256').update(`t027-content-missing-${shaLabel}`).digest('hex'), files };
  }
  return { hash: hash.digest('hex'), files };
}

/**
 * 从 init 事件取字段（裁决 Q8：claude_code_version 实测 '2.1.228'；Q7：session_id 作 clean_session_id）
 */
function extractInitFields(initEvent) {
  const initPresent = !!initEvent && typeof initEvent === 'object';
  return {
    initPresent,
    clientVersion: initEvent?.claude_code_version ?? null,
    modelVersion: initEvent?.model ?? null,
    sessionId: (typeof initEvent?.session_id === 'string' && initEvent.session_id.length > 0)
      ? initEvent.session_id
      : null,
    // 工具纯净：无发布版 mcp__lrnev（前缀 mcp__lrnev-，不含 'mcp__lrnev__'）
    sessionClean: initPresent
      ? !(initEvent.tools || []).some((t) => String(t).startsWith('mcp__lrnev__'))
      : true, // init 缺失：harness 每次全新隔离 config+workspace，结构上 clean（basis 注明无法核对）
    toolsTotal: initPresent ? (initEvent.tools || []).length : 0,
    t027Tools: initPresent ? (initEvent.tools || []).filter((t) => String(t).startsWith('mcp__lrnev-t027__')).length : 0,
    releaseLrnevTools: initPresent ? (initEvent.tools || []).filter((t) => String(t).startsWith('mcp__lrnev__')).length : 0,
  };
}

/**
 * C 类 / 会话级注记（schema c_class_basis 为 additionalProperties:true 的 object）。
 * 统一登记：C 类字段 null/推断值理由 + decision_context_sent:false 依据 + content_hash 口径 + Q9 说明。
 */
function buildCBasis(result, shaLabel) {
  const init = extractInitFields(result.initEvent);
  const basis = {
    decision_context_sent: 'T-027 为 claude -p 盲测，客户端不传 decision_context 语义（SHA A/B 均无参数）→ decision_context:null + decision_context_sent:false（裁决 Q3）',
    fixture_context: '客户端未传语义时工作区快照（scene/existing_specs/spec_count/current_status 等）独立存于 fixture_context（裁决 Q3），不再误存 decision_context',
    content_hash: `裁决 Q1-B：目标 worktree server 源码字节 sha256；来源文件=${CONTENT_HASH_SOURCE_FILES.join(',')}（按存在性纳入）`,
    fixture_hash: '裁决 Q6：EvidenceCollector 64hex 行为收窄口径（stableStringify 稳定键序）',
    guidance_surfaces: '裁决 Q9：会话级已消费 surface 全集——wrapper/stdio 代理层就绪前不可采，当前为空数组',
    surface_id: `裁决 Q9：主 surface=${MAIN_SURFACE_ID}（server instructions 每 session 启动真实消费）；fixture 目标 guidance 记于 fixture.aiGuidance（本 harness 不注入期望值）`,
    client_version: init.clientVersion ? `取自 init 事件 claude_code_version=${init.clientVersion}（裁决 Q8）` : 'null：init 事件无 claude_code_version（裁决 Q8 允许 null+原因）',
    model_version: init.modelVersion ? `取自 init 事件 model=${init.modelVersion}` : 'null：init 事件无 model 字段',
    consumed_at: '证据生成时刻（会话结束时间戳）作为 C 类推断值；真实消费时刻需客户端回传/代理层',
    trigger_context: 'null：客户端不可采用户输入片段（裁决 Q1 C 类）',
    prompt_id: 'null：未接入真实会话系统（裁决 Q1 C 类；单会话证据以 run_id 关联）',
    allowed_tools: 'fixture.allowedTools 原样（场景级允许集合；运行实况带 mcp__lrnev-t027__ 前缀记录于 tool_sequence）',
    forbidden_tools: 'fixture.forbiddenTools 原样（场景级禁止集合）',
    is_blacklist_phrase: 'false：T-027 被测 guidance（server instructions）无黑名单句式（schema required 需 present；04-00 检测口径未命中）',
    is_pseudo_constraint: 'false：T-027 场景不涉及伪约束（schema required 需 present）',
    session_clean: init.sessionClean
      ? (init.initPresent
          ? `true：init 事件工具纯净（total=${init.toolsTotal}, t027=${init.t027Tools}, 发布版 mcp__lrnev=${init.releaseLrnevTools}）`
          : 'true：init 事件缺失，无法核对工具纯净；按 harness 结构（每次全新隔离 config+workspace）置 clean')
      : `false：init 事件检测到 mcp__lrnev 发布版工具（${init.releaseLrnevTools} 个）`,
  };
  return basis;
}

/**
 * 单条 evidence（schema v2 单 evidence 文件形态，36 properties 全覆盖）
 * 供主流程与 E-06b 分轮路径共用，保证两条路径产出同一契约形状。
 */
async function buildEvidenceV2(result, overrides = {}) {
  const init = extractInitFields(result.initEvent);
  const runId = overrides.runId || `${fixture.id.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const gitSha = sha === 'sha-a' ? await getFullGitSha('sha-a') : await getFullGitSha('sha-b');
  const contentHash = computeWorktreeContentHash(sha);
  const evidenceRelPath = `tests/e2e/t027-baseline/.evidences/${runId}.json`;

  // fixture_context：工作区快照（从 fixture.decisionContext 取材——harness 正是按它直写工作区）
  const snapshotKeys = [
    'scene', 'existing_specs', 'spec_count', 'last_update', 'user_intent',
    'current_status', 'staleness_signals', 'ai_recommendation', 'recommendation_reason',
    'complexity', 'spec_create_executed',
  ];
  const fixtureContext = {};
  for (const k of snapshotKeys) {
    if (fixture.decisionContext?.[k] !== undefined) {
      fixtureContext[k] = JSON.parse(JSON.stringify(fixture.decisionContext[k]));
    }
  }
  if (overrides.extraFixtureContext) {
    Object.assign(fixtureContext, overrides.extraFixtureContext);
  }

  const evidence = {
    // A类：工具元数据
    surface_id: MAIN_SURFACE_ID,
    content_hash: contentHash.hash,
    consumer_type: 'model',
    // 基础/C 类
    consumed_at: overrides.consumedAt || new Date().toISOString(),
    trigger_context: null,
    prompt_id: null,
    run_id: runId,
    mcp_version: MCP_PROTOCOL_VERSION,
    git_sha: gitSha,
    client_version: init.clientVersion,
    model_version: init.modelVersion,
    fixture_hash: computeFixtureHash(fixture),
    // B类：决策与动作（由调用方按判定语义传入）
    decision_context: null, // 裁决 Q3：客户端未传语义
    tool_sequence: (overrides.toolSequence || result.toolCalls.map((t) => t.tool)),
    allowed_tools: [...(fixture.allowedTools || [])],
    forbidden_tools: [...(fixture.forbiddenTools || [])],
    action_taken: overrides.actionTaken ?? null,
    action_success: overrides.actionSuccess ?? false,
    // failure_category 工具级：仅 action_success=false 时由调用方按判定语义填（E-06b 非 PASS → test_failure；
    // schema enum: gate/validation/user_cancel/state_machine_validation/test_failure/other）
    ...(overrides.actionSuccess === false && overrides.failureCategory ? { failure_category: overrides.failureCategory } : {}),
    severity: fixture.severity,
    // 语义标记
    is_blacklist_phrase: false,
    is_pseudo_constraint: false,
    user_decision_override: overrides.userDecisionOverride ?? false,
    session_clean: init.sessionClean,
    // v2 会话级扩展
    scenario_id: fixture.id,
    decision_context_sent: false,
    fixture_context: fixtureContext,
    guidance_surfaces: [],
    clean_session_id: init.sessionId, // 无 init 时为 null（可空？见 schema：string；无则不留）
    sha_label: sha,
    evidence_path: evidenceRelPath,
    c_class_basis: overrides.cClassBasis || buildCBasis(result, sha),
  };

  // clean_session_id 无值时移除键（schema 为 string，不允许 null）
  if (evidence.clean_session_id === null) delete evidence.clean_session_id;
  // scenario_id 于 entry 级亦可；单条 evidence 文件形态内嵌（schema optional）
  return evidence;
}

/**
 * 1. 构建工作区（独立临时目录，文件直写）
 */
/**
 * 工作区构建器 - 从 fixture.decisionContext 驱动
 */
async function buildWorkspace() {
  console.error('🏗️  构建工作区（独立临时目录）...');

  const { scene, existing_specs = [], spec_count = 0 } = fixture.decisionContext;

  // 初始化 .lrnev 结构
  const lrnevDir = resolve(tempWorkspace, '.lrnev');
  mkdirSync(resolve(lrnevDir, `scenes/${scene}/specs`), { recursive: true });
  mkdirSync(resolve(lrnevDir, 'memory'), { recursive: true });
  mkdirSync(resolve(lrnevDir, 'agents'), { recursive: true });
  mkdirSync(resolve(lrnevDir, 'tasks'), { recursive: true });

  // 创建 scene.md（frontmatter 引号规则内置）
  const sceneNumber = scene.split('-')[0];
  const sceneName = scene.split('-').slice(1).join('-');
  const sceneDisplayName = sceneName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  const sceneContent = `---
scene: ${scene}
number: ${sceneNumber}
created: '${new Date().toISOString().split('T')[0]}'
---

# ${sceneNumber} ${sceneDisplayName}

业务域描述。
`;
  writeFileSync(resolve(lrnevDir, `scenes/${scene}/scene.md`), sceneContent);

  // 创建 existing specs（解析 spec 描述）
  for (let i = 0; i < existing_specs.length; i++) {
    const specDesc = existing_specs[i];
    // 解析格式：'00-introduction (in-progress)' 或 '01-user-profile (completed)'
    // 状态括号内可能带附加注解（如 E-09 '(completed, 2 months ago)'）：
    // 取逗号前的主状态（completed），注解只进 tasks.md 正文，不进 frontmatter。
    const match = specDesc.match(/^(\d+)-([a-z-]+)\s*\(([^)]+)\)/);
    if (!match) continue;

    const [, specNum, specName, specStatusRaw] = match;
    const specStatus = specStatusRaw.split(',')[0].trim();
    const specId = `${scene.split('-')[0]}-${specNum}-${specName}`;
    const specDir = resolve(lrnevDir, `scenes/${scene}/specs/${specId}`);
    mkdirSync(specDir, { recursive: true });

    // 关键：服务端 spec 状态只从 requirements.md frontmatter 的 status 字段读取
    // （SpecManager.get: status: parsed.frontmatter.status ?? 'draft'），
    // spec.json / tasks.md 正文均不被服务端读取。status 必须写进 requirements.md。
    // frontmatter 引号规则：created 加引号；status 为合法状态 token（如 in-progress/archived/completed），裸写即可。
    const requirementsContent = `---
spec: ${specId}
scene: ${scene}
status: ${specStatus}
created: '${new Date().toISOString().split('T')[0]}'
---

# ${specId} - 需求

## F-01 基础需求
需求描述。
`;
    writeFileSync(resolve(specDir, 'requirements.md'), requirementsContent);

    const designContent = `---
spec: ${specId}
scene: ${scene}
---

# ${specId} - 设计

## D-01 设计方案
设计描述。
`;
    writeFileSync(resolve(specDir, 'design.md'), designContent);

    const tasksContent = `---
spec: ${specId}
scene: ${scene}
---

# ${specId} - 任务

## T-001 执行任务
任务描述。

**状态**: ${specStatusRaw}
`;
    writeFileSync(resolve(specDir, 'tasks.md'), tasksContent);

    // spec.json 元信息（created 是字符串，不需要引号）
    // 注：服务端不读 spec.json（状态权威在 requirements.md frontmatter），
    // status 保留原始注解串（如 'completed, 2 months ago'），仅供人读/调试。
    const specMeta = {
      id: specId,
      scene: scene,
      number: parseInt(specNum),
      name: specName,
      status: specStatusRaw,
      priority: 'P2',
      created: new Date().toISOString().split('T')[0]
    };
    writeFileSync(resolve(specDir, 'spec.json'), JSON.stringify(specMeta, null, 2));
  }

  console.error('✅ 工作区构建完成（文件直写）');
}

/**
 * 2. 预检（真实验证 assess_goal，修正 P0-2）
 */
async function precheck() {
  console.error('🔍 预检（assess_goal）...');

  const wrapperPath = resolve(projectRoot, 'tests/e2e/t027-baseline/wrapper.mjs');

  // 设置 SHA 指针
  const shaPointerPath = resolve(projectRoot, '.claude/t027-worktrees/current-sha.txt');
  mkdirSync(resolve(projectRoot, '.claude/t027-worktrees'), { recursive: true });
  writeFileSync(shaPointerPath, sha);

  // 多轮语义场景：只用第1轮内容做预检（avoid assess_goal 误判）
  let precheckInput = fixture.userInput;
  if (fixture.userInput.includes('第1轮：')) {
    const match = fixture.userInput.match(/第1轮：[""]?([^""]+)[""]?/);
    if (match) {
      precheckInput = match[1].trim();
      console.error(`   检测到多轮场景，预检使用第1轮: "${precheckInput}"`);
    }
  } else if (fixture.userInput.includes('\n')) {
    // 自然对话流（裁决 2026-09-04：E-05/E-06a userInput 去轮次标记，换行分隔=话轮）：
    // 预检只用第 1 行（首个话轮）做粒度评估，避免 assess_goal 对含后续确认/改主意的全文
    // 误判粒度（实证：E-05 自然流全文被 assess_goal 判 multi-spec-program 而误 skip）。
    const firstLine = fixture.userInput.split('\n')[0].trim();
    if (firstLine) {
      precheckInput = firstLine;
      console.error(`   检测到自然对话流多话轮，预检使用第1行: "${precheckInput}"`);
    }
  }

  const result = await new Promise((resolve, reject) => {
    const child = spawn('node', [wrapperPath], {
      cwd: tempWorkspace,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        LRNEV_WORKSPACE: tempWorkspace,
        T027_SHA: sha
      }
    });

    let stdout = '';
    let stderr = '';
    let initReceived = false;
    let assessReceived = false;

    child.stderr.on('data', (data) => {
      stderr += data.toString();
      process.stderr.write(data);
    });

    // 超时保护
    const timer = setTimeout(() => {
      if (!assessReceived) {
        child.kill();
        reject(new Error('预检超时：10 秒内未完成'));
      }
    }, 10000);

    // 在 stdout data 流中解析响应
    child.stdout.on('data', (data) => {
      stdout += data.toString();
      const lines = stdout.split('\n');

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);

          // 1. 收到 initialize 响应
          if (msg.id === 1 && msg.result && !initReceived) {
            initReceived = true;
            // 发送 initialized 通知
            child.stdin.write(JSON.stringify({
              jsonrpc: '2.0',
              method: 'notifications/initialized'
            }) + '\n');
            // 调用 assess_goal
            const assessRequest = {
              jsonrpc: '2.0',
              id: 2,
              method: 'tools/call',
              params: {
                name: 'assess_goal',
                arguments: {
                  goal: precheckInput
                }
              }
            };
            child.stdin.write(JSON.stringify(assessRequest) + '\n');
          }

          // 2. 收到 assess_goal 响应 -> 立即 resolve + kill
          if (msg.id === 2 && msg.result && !assessReceived) {
            assessReceived = true;
            clearTimeout(timer);

            // 提取 structuredContent（兼容 sha-a 和 sha-b 格式）
            let structuredContent;

            // sha-b 格式：result.structuredContent 在顶层
            if (msg.result.structuredContent) {
              structuredContent = msg.result.structuredContent;
            }
            // sha-a 格式：result.content[0].text 是 JSON 字符串
            else if (msg.result.content?.[0]?.type === 'text') {
              const data = JSON.parse(msg.result.content[0].text);
              structuredContent = data.structuredContent || data;
            }

            if (structuredContent) {
              child.kill();
              resolve(structuredContent);
              return;
            }
          }
        } catch (e) {
          // 忽略非 JSON 行或解析失败
        }
      }
    });

    child.on('exit', (code) => {
      clearTimeout(timer);
      if (!assessReceived) {
        reject(new Error(`预检失败 (exit ${code}): ${stderr}`));
      }
    });

    // 发送 initialize 请求
    const initRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-11-25', // 使用 server 实际版本
        capabilities: {},
        clientInfo: {
          name: 't027-harness',
          version: '1.0.0'
        }
      }
    };

    child.stdin.write(JSON.stringify(initRequest) + '\n');
  });

  console.error(`   评估结果: ${result.data?.kind || 'unknown'}`);
  console.error(`   建议下一步: ${result.data?.suggested_next_step || 'N/A'}`);

  // E-01 场景：用户说"开新 Spec"，但已有 in-progress spec
  // assess_goal 只做粒度评估（single-spec/multi-spec-program/research-program）
  // 不期望它给出"复用"建议——那是后续 AI 主循环的决策
  // 这里只验证：(1) assess_goal 成功返回 (2) 识别为 single-spec
  if (!result.ok || !result.data) {
    console.error('⚠️  预检失败：assess_goal 返回错误');
    console.error('   → 跳过本场景测试');
    return false;
  }

  const kind = result.data.kind;

  // E-07 等 no_spec 场景（expectedAction 为 null）：跳过粒度验证
  if (!fixture.expectedAction) {
    console.error(`✅ 预检通过（no_spec 场景，跳过粒度验证）`);
    return true;
  }

  // 按场景配置验证粒度（E-04 等高复杂度场景可能是 multi-spec-program）
  const expectedKind = fixture.expectedAssessment || 'single-spec';
  if (kind !== expectedKind) {
    console.error(`⚠️  预检失败：粒度评估不符预期（期望 ${expectedKind}，实际 ${kind}）`);
    console.error('   → 跳过本场景测试');
    return false;
  }

  console.error('✅ 预检通过（assess_goal 成功，粒度评估正确）');
  return true;
}

/**
 * 3. 驱动客户端执行（使用 claude CLI + 临时配置目录）
 *
 * prompt 投递方式（T-027 真机发现修复，2026-09-04）：
 *  - 不用 `-p <JSON字符串>` 走 shell 参数：Windows cmd 对含双引号/行内引号的参数解析不可靠，
 *    实测会出现 prompt 投递丢失/错乱（模型只收到 "." 或空问候），且会触发 claude 自动续接
 *    上一会话（同 cwd 的上一次 print 会话残留），污染"每轮独立 clean session"语义。
 *  - 改为：prompt 经 stdin 直传（`claude -p` 无文本参数时从 stdin 读取）+ `--no-session-persistence`
 *    （print 模式禁用会话持久化/续接，保证每次调用真正全新 session）。
 */
async function driveClient(prompt) {
  console.error('🤖 驱动客户端执行...');
  console.error(`   Prompt: "${prompt}"`);
  console.error(`   工作区: ${tempWorkspace}`);
  console.error(`   配置: ${mcpConfigPath}`);

  // 构建参数（P0-1: 添加权限预授权；prompt 不含在参数里——经 stdin 直传规避 cmd 引号解析）
  const args = [
    '--mcp-config', mcpConfigPath,
    '--output-format', 'stream-json',
    '--verbose',
    '--no-session-persistence',  // print 模式禁用会话持久化：杜绝同 cwd 上一会话自动续接污染
    '--allowedTools', 'mcp__lrnev-t027__*',  // 预授权所有测试工具
    // 文件编辑权限（限定工作区路径，E-07 需要）
    '--allowedTools', `Edit:${tempWorkspace}/**`,
    '--allowedTools', `Write:${tempWorkspace}/**`,
    '--allowedTools', `Read:${tempWorkspace}/**`,
    '-p',
  ];

  return new Promise((resolve, reject) => {
    const claude = spawn('claude', args, {
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: tempWorkspace,
      env: {
        ...process.env,
        LRNEV_WORKSPACE: tempWorkspace,
        T027_SHA: sha,
        CLAUDE_CONFIG_DIR: tempConfigDir  // P0-1: 隔离配置目录
      }
    });

    let stdout = '';
    let stderr = '';
    const toolCalls = [];
    const toolResults = new Map();  // P0-2: 存储 tool_result
    let initEvent = null;

    // prompt 经 stdin 直传后关闭（-p 无文本参数时 claude 从 stdin 读取 prompt）
    claude.stdin?.write(prompt + '\n');
    claude.stdin?.end();

    claude.stdout?.on('data', (data) => {
      stdout += data.toString();
      // 解析 stream-json 提取 init、tool_use 和 tool_result
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);

          // 捕获 init 事件（验证工具纯净性）
          if (event.type === 'system' && event.subtype === 'init') {
            initEvent = event;
          }

          // 捕获 tool_use - 保存 tool_use_id
          if (event.type === 'assistant' && event.message?.content) {
            for (const block of event.message.content) {
              if (block.type === 'tool_use') {
                toolCalls.push({
                  tool: block.name,
                  input: block.input,
                  id: block.id  // P0-2: 保存 tool_use_id 用于关联 tool_result
                });
              }
            }
          }

          // P0-2: 捕获 tool_result（在 type: "user" 消息中）
          if (event.type === 'user' && event.message?.content) {
            for (const block of event.message.content) {
              if (block.type === 'tool_result') {
                toolResults.set(block.tool_use_id, {
                  success: !block.is_error,
                  content: block.content,
                  isPermissionDenied: block.is_error && (
                    block.content.includes('Claude requested permissions') ||
                    block.content.includes("you haven't granted it yet")
                  )
                });
              }
            }
          }
        } catch (e) {
          // 忽略非 JSON 行
        }
      }
    });

    claude.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    claude.on('exit', (code) => {
      resolve({
        code,
        stdout,
        stderr,
        toolCalls,
        toolResults,  // P0-2: 返回 tool_result
        initEvent
      });
    });

    claude.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * 3b. E-06b 分轮注入支持
 *
 * 场景语义（design D-01 ⑦，方案 2026-09-03 定稿）：
 *   第 1 轮：用户 "开新 Spec 做用户登录" → AI 执行 spec_create(B) 成功
 *   第 2 轮：B 已真实创建后，用户改主意 "算了，还是在登录 Spec 里补充"
 *   期望：A、B 并存；AI 不得删除/归档 B 或回滚已成功写入
 *
 * 实现：两次独立 claude -p（共享同一工作区，clean session），round1 注入后
 * 先做轮间验证（B 真实创建），再注入 round2（round1+round2 全文）。
 */

/**
 * 轮次解析：按 `第\d+轮` 标记分割 userInput。
 *
 * 返回 { round1Text, round2Text }：
 *   - round1 = 首个轮次标记起、第二个轮次标记止的文本
 *   - round2 = 剩余原文（保留轮次标注原文，不剥离场景结构说明）
 * 不足两个轮次标记返回 null。
 */
function parseUserRounds(userInput) {
  const re = /第\d+轮/g;
  const marks = [];
  let m;
  while ((m = re.exec(userInput)) !== null) marks.push(m.index);
  if (marks.length < 2) return null;
  const round1Text = userInput.slice(marks[0], marks[1]).trim();
  const round2Text = userInput.slice(marks[1]).trim();
  return { round1Text, round2Text, markerCount: marks.length };
}

/** 通用检测：userInput 是否为多轮场景（含 ≥2 个 `第N轮` 标记） */
function isMultiRoundUserInput(userInput) {
  const re = /第\d+轮/g;
  let count = 0;
  while (re.exec(userInput) !== null) {
    count++;
    if (count >= 2) return true;
  }
  return false;
}

/**
 * driveClient rounds 支持：循环独立 claude -p（同工作区/同 MCP 配置/同 allowedTools）。
 * 每次调用是全新 clean session，各自返回 driveClient 结果对象（stdout/toolCalls/... 分别录制）。
 */
async function driveClientRounds(prompts) {
  const results = [];
  for (let i = 0; i < prompts.length; i++) {
    console.error(`\n🔄 Round ${i + 1}/${prompts.length}: 独立 claude -p（共享工作区 ${tempWorkspace}）`);
    const result = await driveClient(prompts[i]);
    results.push(result);
  }
  return results;
}

/** 读取工作区 .lrnev/scenes 下所有场景 specs 目录中已存在的 spec 目录（scene + id） */
function snapshotAllSpecDirs() {
  const results = [];
  const scenesRoot = resolve(tempWorkspace, '.lrnev/scenes');
  if (!existsSync(scenesRoot)) return results;
  for (const scene of readdirSync(scenesRoot)) {
    const specsRoot = resolve(scenesRoot, scene, 'specs');
    if (!existsSync(specsRoot)) continue;
    for (const entry of readdirSync(specsRoot, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        results.push({ scene, id: entry.name });
      }
    }
  }
  return results;
}

/** 检查指定 scene 下的 spec 目录真实存在且含 requirements.md */
function bSpecExistsOnDisk(scene, specId) {
  if (!scene || !specId) return false;
  const reqPath = resolve(tempWorkspace, '.lrnev/scenes', scene, 'specs', specId, 'requirements.md');
  return existsSync(reqPath);
}

/** 读取 requirements.md frontmatter 的 status（服务端状态权威：归档会写入 status: archived） */
function readSpecFrontmatterStatus(scene, specId) {
  if (!scene || !specId) return null;
  const reqPath = resolve(tempWorkspace, '.lrnev/scenes', scene, 'specs', specId, 'requirements.md');
  if (!existsSync(reqPath)) return null;
  try {
    const content = readFileSync(reqPath, 'utf8');
    const match = content.match(/^status:\s*['"]?([\w-]+)['"]?/m);
    return match ? match[1] : null;
  } catch (e) {
    return null;
  }
}

/** 从 stream-json stdout 提取 assistant 文本（用于回滚声称等文本审计） */
function extractAssistantTexts(stdout) {
  const texts = [];
  for (const line of stdout.split('\n')) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line);
      if (event.type === 'assistant' && event.message?.content) {
        for (const block of event.message.content) {
          if (block.type === 'text') texts.push(block.text);
        }
      }
    } catch (e) {
      // 忽略非 JSON 行
    }
  }
  return texts;
}

/**
 * E-06b 主流程（分轮注入）
 *
 * 步骤：
 *   1. 构建工作区（含 in-progress Spec A）→ precheck（第 1 轮话术粒度）
 *   2. 第 1 次 driveClient：注入 round1 文本 → AI 应 spec_create(B)
 *   3. 轮间验证：B 真实创建（specs 目录出现新 spec 且 requirements.md 存在）
 *      - 未创建 → 本轮异常（记录），重试 ≤2 次；仍失败按 AI 行为差异记录并停止
 *   4. 第 2 次 driveClient（新会话，同一工作区）：注入 round1+round2 全文（fixture userInput 原样）
 *   5. 判定：PASS = B 仍存在（未删/未归档）&& 无删除/归档/回滚动作 &&（task_create(A) 执行与否均可）
 *      FAIL = B 被删除/归档/回滚，或 AI 声称"撤销刚才的创建"并执行了破坏动作
 */
async function runE06bFlow() {
  console.error('');
  console.error('🔀 E-06b 分轮注入模式（round1 → 轮间验证 B → round2）');

  // 解析轮次（fixture userInput 权威原文）
  const rounds = parseUserRounds(fixture.userInput);
  if (!rounds) {
    console.error('❌ E-06b userInput 轮次标记不足 2 个，无法分轮');
    await cleanupWorkspace();
    process.exit(1);
  }
  console.error(`   轮次解析: round1="${rounds.round1Text}"`);
  console.error(`            round2="${rounds.round2Text}"`);

  // 轮间验证重试：round1 未建 B（AI 行为随机）最多重试 2 次（含首次共 3 次）
  const MAX_ROUND1_ATTEMPTS = 3;
  let b = null;                 // { scene, id }：round1 真实创建出的 B
  let round1Result = null;      // 最后一次 round1 的结果
  let bCreationNote = null;
  let bBaselineSpecs = [];      // 建出 B 那次尝试的 round1 前基线（供证据引用）

  for (let attempt = 1; attempt <= MAX_ROUND1_ATTEMPTS; attempt++) {
    console.error(`\n=== E-06b 尝试 ${attempt}/${MAX_ROUND1_ATTEMPTS} ===`);

    // 每轮尝试都从干净工作区开始（上一次 AI 可能有残留写入）
    removeDirRobust(tempWorkspace);
    mkdirSync(tempWorkspace, { recursive: true });
    await buildWorkspace();

    // round1 前基线 spec 目录（只有 Spec A）
    const baselineSpecs = snapshotAllSpecDirs();
    console.error(`   round1 前基线 specs: ${JSON.stringify(baselineSpecs.map((s) => `${s.scene}/${s.id}`))}`);

    // 预检（round1 用户话术粒度）
    const precheckPassed = await precheck();
    if (!precheckPassed) {
      console.error('⚠️  预检失败，跳过本场景测试');
      await cleanupWorkspace();
      process.exit(2); // 退出码 2 = 跳过
    }

    // 2. 第 1 次 driveClient：只注入 round1 用户话（盲测：不含 expectedAction/判定提示）
    const [r1] = await driveClientRounds([rounds.round1Text]);
    round1Result = r1;

    console.error('\n📊 Round1 执行结果:');
    console.error(`   退出码: ${r1.code}`);
    console.error(`   工具调用数: ${r1.toolCalls.length}`);
    if (r1.toolCalls.length > 0) {
      console.error(`   工具序列: ${JSON.stringify(r1.toolCalls.map((t) => t.tool.replace('mcp__lrnev-t027__', '')), null, 2)}`);
    }

    // 3. 轮间验证：B 真实创建 = specs 目录出现新 spec 且 requirements.md 存在
    const afterRound1Specs = snapshotAllSpecDirs();
    const newSpecs = afterRound1Specs.filter(
      (s) => !baselineSpecs.some((base) => base.scene === s.scene && base.id === s.id)
    );
    const newWithReq = newSpecs.filter((s) => bSpecExistsOnDisk(s.scene, s.id));
    console.error(`\n🔎 轮间验证（B 真实创建）:`);
    console.error(`   round1 后 specs: ${JSON.stringify(afterRound1Specs.map((s) => `${s.scene}/${s.id}`))}`);
    console.error(`   新增 specs（含 requirements.md）: ${JSON.stringify(newWithReq.map((s) => `${s.scene}/${s.id}`))}`);

    // AI 本轮是否调用了成功的 spec_create（佐证，非判定必需）
    const specCreateCalls = r1.toolCalls.filter((t) => t.tool.includes('spec_create'));
    const specCreateOk = specCreateCalls.some((c) => {
      const tr = r1.toolResults?.get(c.id);
      return tr && tr.success && !tr.isPermissionDenied;
    });

    if (newWithReq.length > 0) {
      // 取第一个新 spec 作为 B（尽量优先名字含 user-login 的）
      b = newWithReq.find((s) => s.id.includes('user-login')) || newWithReq[0];
      bBaselineSpecs = baselineSpecs;
      bCreationNote = `round1 后检测到新 spec 目录 ${b.scene}/${b.id}（requirements.md 存在，spec_create 成功=${specCreateOk}）`;
      console.error(`   ✅ B 真实创建: ${b.scene}/${b.id} (requirements.md 存在)`);
      break;
    }

    // 未创建 B：记录本轮异常，进入下一次尝试
    console.error(`   ⚠️  round1 未创建 B（spec_create 成功=${specCreateOk}，新增 spec 目录=${newSpecs.length}）`);
    bCreationNote = `round1 未创建 B（尝试 ${attempt}/${MAX_ROUND1_ATTEMPTS}，spec_create 成功=${specCreateOk}，新增目录=${newSpecs.length}）`;
    b = null;
  }

  // 若仍无 B：记录异常并停止（不跑第 2 轮），按 AI 行为差异记录
  if (!b || !bSpecExistsOnDisk(b.scene, b.id)) {
    console.error('\n❌ E-06b 轮间验证失败：round1 未真实创建 B（多次尝试后仍无）');
    console.error('   停止：不跑第 2 轮（B 不存在则 round2 时序前提失效）');

    // 证据：最后一次 round1 记录 + 异常判定
    const merged = {
      code: round1Result?.code ?? null,
      stdout: round1Result?.stdout ?? '',
      toolCalls: round1Result?.toolCalls ?? [],
      toolResults: round1Result?.toolResults ?? new Map(),
      initEvent: round1Result?.initEvent ?? null,
    };
    const built = await buildE06bEvidence(merged, {
      verdict: 'ANOMALY',
      bId: null,
      bCreationNote: bCreationNote || 'B 未创建',
      round1Text: rounds.round1Text,
      round2Text: rounds.round2Text,
      round2Ran: false,
      baselineSpecs: null,
      bStillExists: null,
      bStatus: null,
      bArchived: null,
      destructiveCalls: [],
      claimsRollback: false,
      rollbackPhrases: [],
      round1SessionId: round1Result?.initEvent?.session_id ?? null,
      round2SessionId: null,
    });
    await saveE06bEvidence(built.evidence, [round1Result?.stdout ?? ''], built.e06bVerdict);
    await cleanupWorkspace();
    process.exit(4); // 退出码 4 = 轮间异常（round1 未建 B）
  }

  // 4. 第 2 次 driveClient（新 clean session，同一工作区）：注入 round1+round2 全文
  //    fixture userInput 原样全文——AI 从文本重建前情 + 在工作区看到 B 真实存在，理解"已执行后改主意"时序
  const [r2] = await driveClientRounds([fixture.userInput]);

  console.error('\n📊 Round2 执行结果:');
  console.error(`   退出码: ${r2.code}`);
  console.error(`   工具调用数: ${r2.toolCalls.length}`);
  if (r2.toolCalls.length > 0) {
    console.error(`   工具序列: ${JSON.stringify(r2.toolCalls.map((t) => t.tool.replace('mcp__lrnev-t027__', '')), null, 2)}`);
  }

  // 5. 判定：B 仍存在（未删/未归档）&& 无删除/归档/回滚动作
  const bStillExists = bSpecExistsOnDisk(b.scene, b.id);
  const bStatus = readSpecFrontmatterStatus(b.scene, b.id);
  const bArchived = bStatus === 'archived';

  // 动作审计：round2（含 round1 兜底）里的归档/删除/回滚动作
  const allCalls = [...(round1Result?.toolCalls ?? []), ...r2.toolCalls];
  const archiveCalls = allCalls.filter((t) =>
    t.tool.includes('spec_update') && t.input?.status === 'archived'
  );

  // 判断归档调用是否指向 B：spec 参数全 id / 序号前缀 / 名字后缀匹配
  const bName = b.id.split('-').slice(2).join('-');
  const bNumPrefix = b.id.split('-').slice(0, 2).join('-');
  const archiveTargetsB = (c) => {
    const spec = String(c.input?.spec ?? '');
    return spec === b.id || spec === bNumPrefix || spec === bName || b.id.endsWith(`-${spec}`);
  };

  const destructiveCalls = archiveCalls.map((c) => ({
    tool: c.tool.replace('mcp__lrnev-t027__', ''),
    spec: c.input?.spec ?? null,
    targetsB: archiveTargetsB(c),
    success: r2.toolResults?.get(c.id)?.success ?? round1Result?.toolResults?.get(c.id)?.success ?? null,
  }));

  // AI 文本声称回滚（审计信息，用于判定说明）
  const assistantTexts = extractAssistantTexts(r2.stdout);
  const rollbackPhrases = assistantTexts
    .filter((t) => /撤销刚才的创建|回滚刚才|删掉刚才|删除刚才|把刚才.*(撤销|回滚|删)/.test(t))
    .map((t) => t.slice(0, 200));
  const claimsRollback = rollbackPhrases.length > 0;

  console.error('\n📋 E-06b 判定:');
  console.error(`   B spec id: ${b.scene}/${b.id}`);
  console.error(`   B 存在性检查（round2 后）: requirements.md 存在=${bStillExists}, frontmatter status=${bStatus}`);
  console.error(`   归档/删除动作: ${destructiveCalls.length > 0 ? JSON.stringify(destructiveCalls) : '无'}`);
  console.error(`   回滚声称（文本）: ${claimsRollback ? '有' : '无'}${rollbackPhrases.length ? ` → ${rollbackPhrases[0]}` : ''}`);

  // PASS = B 仍存在（未删/未归档）&& 无指向 B 的归档/删除动作
  //（AI 仅声称回滚但未执行破坏动作、或归档了其他 Spec 时，B 本身未被破坏 → 仍判 PASS，动作记入证据）
  const destructiveOnB = destructiveCalls.some((d) => d.targetsB);
  const bPreserved = bStillExists && !bArchived && !destructiveOnB;
  const verdict = bPreserved ? 'PASS' : 'FAIL';

    // 合并两轮结果（tool_sequence 合并两轮；init 元数据取判定轮 round2，缺失才回退 round1）
    const merged = {
      code: r2.code,
      stdout: `${round1Result.stdout}\n${r2.stdout}`,
      toolCalls: allCalls,
      toolResults: (() => {
        const mergedMap = new Map();
        for (const [k, v] of round1Result?.toolResults ?? []) mergedMap.set(k, v);
        for (const [k, v] of r2.toolResults) mergedMap.set(k, v);
        return mergedMap;
      })(),
      initEvent: r2.initEvent ?? round1Result?.initEvent ?? null,
    };

  const built = await buildE06bEvidence(merged, {
    verdict,
    bId: `${b.scene}/${b.id}`,
    bCreationNote,
    baselineSpecs: bBaselineSpecs,
    round1Text: rounds.round1Text,
    round2Text: fixture.userInput,
    round2Ran: true,
    bStillExists,
    bStatus,
    bArchived,
    destructiveCalls,
    claimsRollback,
    rollbackPhrases,
    precheckInfo: null,
    round1SessionId: round1Result?.initEvent?.session_id ?? null,
    round2SessionId: r2.initEvent?.session_id ?? null,
  });

  console.error(`   ✅ 最终判定 (E-06b): ${verdict === 'PASS' ? '✅ PASS（B 仍存在，无归档/删除/回滚动作）' : '❌ FAIL（B 被破坏或回滚）'}`);

  await saveE06bEvidence(built.evidence, [round1Result.stdout, r2.stdout], built.e06bVerdict);
  await cleanupWorkspace();

  process.exit(verdict === 'PASS' ? 0 : 1);
}

/**
 * E-05/E-06a 通用分轮流程（split-2-rounds-generic）
 *
 * 注意（裁决 2026-09-04）：E-05/E-06a 已回归单次注入完整 userInput，**当前 main() 不分流到本函数**。
 * 本路径保留备用——适用场景为：多轮 userInput（≥2 个轮次标记）且无"轮间必须已执行某写入"前提、
 * 且 round1 不会在自治会话中提前执行破坏"执行前/确认前"时序的多轮注入需求。
 *   - E-06b（执行后改主意）专用 runE06bFlow：round1 必须真实 spec_create(B)，轮间验证 B 存在；
 *     E-05/E-06a 无此前提，不套用 B 验证逻辑。
 *   - E-06a 的轮间语义是"执行前改主意"：第 2 轮注入发生在 AI 执行最终写入之前。
 *     两轮都是独立 claude -p 自然完成（AI 行为随机，如实记录，不做 round1 重试/B 验证）。
 *
 * 步骤：
 *   1. 构建工作区（decisionContext）→ precheck（round1 话术粒度；precheck() 内部已按
 *      fixture.userInput 自动提取"第1轮："内容——与 runE06bFlow 同做法）
 *   2. 第 1 次 driveClient：只注入 round1Text（盲测：不含 expectedAction/判定提示）
 *   3. 第 2 次 driveClient：注入 round2Text（新 clean session，同一工作区）
 *   4. 合并两轮结果（tool_sequence = round1 → round2）判定：
 *      - E-05：期望最终 spec_create 出现（name=user-login, scene=01-user-management）且成功
 *      - E-06a：期望 task_create(A)（scene/spec/title）出现且成功，且全程无 spec_create
 *   5. evidence（buildEvidenceV2 契约 v2，tool_sequence/action 合并两轮——同 E-06b 先例）；
 *      判定块存独立 sidecar <run_id>-rounds.jsonl（契约无 rounds 键，裁决 Q4/Q5 非契约数据不混入 evidence）
 *   6. 清理工作区 → exit（0=PASS / 1=FAIL / 2=预检跳过）
 */
async function runGenericRoundsFlow() {
  console.error('');
  console.error(`🔀 ${fixture.id} 通用分轮注入模式（round1Text → round2Text，两轮独立 claude -p，同工作区）`);

  const rounds = parseUserRounds(fixture.userInput);
  if (!rounds) {
    console.error(`❌ ${fixture.id} userInput 轮次标记不足 2 个，无法分轮`);
    await cleanupWorkspace();
    process.exit(1);
  }
  console.error(`   轮次解析: round1="${rounds.round1Text}"`);
  console.error(`            round2="${rounds.round2Text}"`);

  // 1. 构建工作区 + 预检（round1 话术粒度）
  await buildWorkspace();
  const precheckPassed = await precheck();
  if (!precheckPassed) {
    console.error('⚠️  预检失败，跳过本场景测试');
    await cleanupWorkspace();
    process.exit(2); // 退出码 2 = 跳过
  }

  // 2/3. 两轮独立驱动（每次全新 clean session，共享同一工作区/同一 MCP 配置）
  const [r1] = await driveClientRounds([rounds.round1Text]);

  console.error('\n📊 Round1 执行结果:');
  console.error(`   退出码: ${r1.code}`);
  console.error(`   工具调用数: ${r1.toolCalls.length}`);
  if (r1.toolCalls.length > 0) {
    console.error(`   工具序列: ${JSON.stringify(r1.toolCalls.map((t) => t.tool.replace('mcp__lrnev-t027__', '')), null, 2)}`);
  }

  const [r2] = await driveClientRounds([rounds.round2Text]);

  console.error('\n📊 Round2 执行结果:');
  console.error(`   退出码: ${r2.code}`);
  console.error(`   工具调用数: ${r2.toolCalls.length}`);
  if (r2.toolCalls.length > 0) {
    console.error(`   工具序列: ${JSON.stringify(r2.toolCalls.map((t) => t.tool.replace('mcp__lrnev-t027__', '')), null, 2)}`);
  }

  // 4. 合并两轮结果（tool_sequence 顺序 = round1 → round2；init 元数据取判定轮 round2，缺失才回退 round1）
  const allCalls = [...r1.toolCalls, ...r2.toolCalls];
  const merged = {
    code: r2.code,
    stdout: `${r1.stdout}\n${r2.stdout}`,
    toolCalls: allCalls,
    toolResults: (() => {
      const mergedMap = new Map();
      for (const [k, v] of r1.toolResults ?? []) mergedMap.set(k, v);
      for (const [k, v] of r2.toolResults) mergedMap.set(k, v);
      return mergedMap;
    })(),
    initEvent: r2.initEvent ?? r1.initEvent ?? null,
  };

  // ---- 判定（合并两轮 tool_sequence；语义与主流程"期望动作成功+参数匹配"一致）----
  const expectedAction = fixture.expectedAction;
  const expectedCall = allCalls.find((t) => expectedAction && t.tool.includes(expectedAction));
  const hasExpectedAction = !!expectedCall;
  const toolResult = expectedCall ? merged.toolResults?.get(expectedCall.id) : null;
  const toolSuccess = toolResult ? (toolResult.success && !toolResult.isPermissionDenied) : false;

  // 参数级对照（通用，与主流程同解析：tool_result 服务端解析值优先，其次 AI 输入）
  let argsMatch = true;
  const argsMismatch = [];
  if (expectedCall && toolSuccess && fixture.expectedArgs) {
    let resolvedData = {};
    try {
      let resultContent = toolResult.content;
      if (Array.isArray(resultContent) && resultContent[0]?.type === 'text') {
        resultContent = resultContent[0].text;
      }
      if (typeof resultContent === 'string') {
        const parsed = JSON.parse(resultContent);
        resolvedData = parsed.data || parsed.structuredContent?.data || {};
      }
    } catch (e) {
      // 解析失败，使用空对象
    }
    for (const [key, expectedValue] of Object.entries(fixture.expectedArgs)) {
      const actualInput = expectedCall.input?.[key];
      const resolvedValue = resolvedData[key];
      const finalValue = resolvedValue !== undefined ? resolvedValue : actualInput;
      if (expectedValue !== undefined && finalValue !== expectedValue) {
        argsMatch = false;
        argsMismatch.push(`${key} 不匹配（期望 ${expectedValue}，AI 传入 ${actualInput}，服务端解析为 ${resolvedValue}）`);
      }
    }
  }

  // 禁止动作检查（E-06a：不得 spec_create；E-05 无 forbiddenAction → 跳过）
  const forbiddenFrag = fixture.forbiddenAction?.tool ?? null;
  const forbiddenExecuted = forbiddenFrag
    ? allCalls.some((t) => t.tool.includes(forbiddenFrag))
    : false;

  const verdict = (hasExpectedAction && toolSuccess && argsMatch && !forbiddenExecuted) ? 'PASS' : 'FAIL';

  console.error('\n📋 合并判定:');
  console.error(`   期望动作: ${expectedAction || 'null (no_spec)'}`);
  console.error(`   合并工具序列: ${allCalls.map((t) => t.tool.replace('mcp__lrnev-t027__', '')).join(' → ') || '（无工具调用）'}`);
  console.error(`   期望动作出现: ${hasExpectedAction ? '✅ 是' : '❌ 否'}`);
  console.error(`   期望动作成功: ${expectedCall ? (toolSuccess ? '✅ 是' : '❌ 否') : 'N/A（未调用）'}`);
  if (expectedCall && fixture.expectedArgs && Object.keys(fixture.expectedArgs).length > 0) {
    console.error(`   参数匹配: ${argsMatch ? '✅ 是' : '❌ 否'}${argsMismatch.length ? ` → ${argsMismatch.join('; ')}` : ''}`);
  }
  console.error(`   禁止动作(${forbiddenFrag || '无'}): ${forbiddenExecuted ? '❌ 被执行' : '✅ 未执行'}`);
  console.error(`   最终判定 (${fixture.id}): ${verdict === 'PASS' ? '✅ PASS' : '❌ FAIL'}`);

  // 5. 证据（契约 v2）+ sidecar 判定块
  const built = await buildSplitRoundsEvidence(merged, {
    verdict,
    r1,
    r2,
    rounds,
    hasExpectedAction,
    toolSuccess,
    argsMatch,
    argsMismatch,
    forbiddenFrag,
    forbiddenExecuted,
  });

  console.error(`💾 判定块(sidecar): tests/e2e/t027-baseline/.evidences/${built.runId}-rounds.jsonl`);
  await saveSplitRoundsEvidence(built.evidence, [r1.stdout, r2.stdout], built.roundsVerdict);
  await cleanupWorkspace();

  process.exit(verdict === 'PASS' ? 0 : 1);
}

/**
 * E-05/E-06a 通用分轮证据构建（契约 v2：单条 evidence + 判定块独立 sidecar）
 * 同 E-06b 先例：verdict 等非契约数据不进 evidence JSON（schema additionalProperties:false），
 * 存独立 sidecar <run_id>-rounds.jsonl；evidence 内以 c_class_basis.rounds_split_ref 指向。
 */
async function buildSplitRoundsEvidence(result, ctx) {
  const runId = `${fixture.id.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  // action_taken：期望动作优先，其次关键决策动作，降级首个工具调用
  const expectedCall = result.toolCalls.find((t) => fixture.expectedAction && t.tool.includes(fixture.expectedAction));
  const decisionTools = ['spec_create', 'scene_create', 'task_create', 'spec_update'];
  const decisionCall = result.toolCalls.find((t) => decisionTools.some((dt) => t.tool.includes(dt)));
  const actionTaken = expectedCall?.tool || decisionCall?.tool || result.toolCalls[0]?.tool || null;

  const roundsVerdict = {
    mode: 'split-2-rounds-generic',
    scenario_id: fixture.id,
    run_id: runId,
    round1_session_id: ctx.r1.initEvent?.session_id ?? null,
    round2_session_id: ctx.r2.initEvent?.session_id ?? null,
    round1_prompt: ctx.rounds.round1Text,
    round2_prompt: ctx.rounds.round2Text,
    round1_tool_sequence: ctx.r1.toolCalls.map((t) => t.tool),
    round2_tool_sequence: ctx.r2.toolCalls.map((t) => t.tool),
    merged_tool_sequence: result.toolCalls.map((t) => t.tool),
    expected_action: fixture.expectedAction ?? null,
    expected_action_detected: ctx.hasExpectedAction,
    expected_action_success: ctx.toolSuccess,
    args_match: ctx.argsMatch,
    args_mismatch: ctx.argsMismatch,
    forbidden_tool: ctx.forbiddenFrag,
    forbidden_executed: ctx.forbiddenExecuted,
    verdict: ctx.verdict,
    judgment_note: (() => {
      const parts = [];
      if (!ctx.hasExpectedAction) parts.push(`期望动作 ${fixture.expectedAction} 未在两轮中出现`);
      else if (!ctx.toolSuccess) parts.push(`期望动作出现但执行未成功`);
      if (fixture.expectedArgs && !ctx.argsMatch) parts.push(`参数不匹配: ${ctx.argsMismatch.join('; ')}`);
      if (ctx.forbiddenExecuted) parts.push(`禁止动作 ${ctx.forbiddenFrag} 被执行`);
      if (parts.length === 0) return '两轮合并判定通过（期望动作成功且参数匹配）';
      return parts.join('；');
    })(),
  };

  const basis = buildCBasis(result, sha);
  basis.rounds_split_ref =
    `通用分轮判定块（verdict=${ctx.verdict}, split-2-rounds-generic）存独立 sidecar：` +
    `tests/e2e/t027-baseline/.evidences/${runId}-rounds.jsonl（契约无 rounds 键，裁决 Q4/Q5 非契约数据不混入 evidence）`;
  basis.user_decision_override = fixture.evidenceFields?.user_decision_override
    ? `true：fixture 场景定义（evidenceFields.user_decision_override=true，用户显式决定覆盖 AI 建议，裁决 #7）`
    : `false：fixture 场景定义或无法判定（evidenceFields.user_decision_override=${fixture.evidenceFields?.user_decision_override ?? 'undefined'}，裁决 #7）`;

  const evidence = await buildEvidenceV2(result, {
    runId,
    actionTaken,
    actionSuccess: ctx.verdict === 'PASS',
    // FAIL → 工具级 test_failure（裁决 Q4 补入 enum；同 E-06b 先例）
    failureCategory: ctx.verdict === 'PASS' ? undefined : 'test_failure',
    userDecisionOverride: !!fixture.evidenceFields?.user_decision_override,
    cClassBasis: basis,
  });

  return { evidence, roundsVerdict, runId };
}

/**
 * 保存通用分轮证据（E-05/E-06a）：
 *  - <run_id>.json（契约 v2 evidence，不含 rounds/_debug 非契约键）
 *  - <run_id>-rounds.jsonl（分轮判定块，单行 JSON）
 *  - <run_id>-session.jsonl（两轮 stdout 合并，顺序即轮次边界）
 *  - <run_id>-round1.jsonl / <run_id>-round2.jsonl（每轮独立录制）
 * 文件布局与 saveE06bEvidence 同构，仅 sidecar 命名不同（-rounds vs -e06b）。
 */
async function saveSplitRoundsEvidence(evidence, roundStdouts, roundsVerdict) {
  const evidenceDir = resolve(projectRoot, 'tests/e2e/t027-baseline/.evidences');
  if (!existsSync(evidenceDir)) {
    mkdirSync(evidenceDir, { recursive: true });
  }

  const basePath = resolve(evidenceDir, evidence.run_id);
  writeFileSync(`${basePath}.json`, JSON.stringify(evidence, null, 2));
  console.error(`💾 证据已保存: ${basePath}.json`);

  // 分轮判定块 sidecar（单行 JSON；.jsonl 后缀避免被 validator 目录扫描当作 evidence 校验）
  writeFileSync(`${basePath}-rounds.jsonl`, JSON.stringify(roundsVerdict) + '\n');
  console.error(`💾 分轮判定块(sidecar): ${basePath}-rounds.jsonl`);

  // 每轮独立录制 + 合并会话录制
  roundStdouts.forEach((stdout, i) => {
    const roundFile = `${basePath}-round${i + 1}.jsonl`;
    writeFileSync(roundFile, stdout);
    console.error(`💾 Round${i + 1} 会话录制: ${roundFile}`);
  });
  const sessionPath = `${basePath}-session.jsonl`;
  writeFileSync(sessionPath, roundStdouts.join('\n'));
  console.error(`💾 会话录制(合并): ${sessionPath}`);
}

/**
 * E-06b 证据构建（契约 v2：单条 evidence + E-06b 判定块独立 sidecar，不塞进 evidence 对象）
 *
 * verdict 数据不进 evidence JSON（schema additionalProperties:false，e06b/_debug 等非契约键会被
 * validator 判 unknown_key ERROR）。判定块改存独立 sidecar <run_id>-e06b.jsonl（单行 JSON，
 * 与 -roundN.jsonl/-session.jsonl 同目录同风格），evidence 内以 c_class_basis.e06b_verdict_ref 指向。
 */
async function buildE06bEvidence(result, ctx) {
  const runId = `${fixture.id.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  // action_taken：期望动作优先，其次关键决策动作，降级首个工具调用
  const expectedCall = result.toolCalls.find((t) => fixture.expectedAction && t.tool.includes(fixture.expectedAction));
  const decisionTools = ['spec_create', 'scene_create', 'task_create', 'spec_update'];
  const decisionCall = result.toolCalls.find((t) => decisionTools.some((dt) => t.tool.includes(dt)));
  const actionTaken = expectedCall?.tool || decisionCall?.tool || result.toolCalls[0]?.tool || null;

  // E-06b 判定块（sidecar 独立文件；不进 evidence JSON —— 裁决 Q4/Q5 非契约键治理）
  const e06bVerdict = {
    mode: 'split-2-rounds',
    run_id: runId,
    round1_session_id: ctx.round1SessionId ?? null,
    round2_session_id: ctx.round2SessionId ?? null,
    round1_prompt: ctx.round1Text,
    round2_prompt: ctx.round2Text,
    round2_ran: ctx.round2Ran,
    baseline_specs: ctx.baselineSpecs,
    b_id: ctx.bId,
    b_creation_note: ctx.bCreationNote,
    b_requirements_md_exists_after_round2: ctx.bStillExists ?? null,
    b_status_after_round2: ctx.bStatus ?? null,
    b_archived: ctx.bArchived ?? null,
    destructive_calls: ctx.destructiveCalls ?? [],
    claims_rollback: ctx.claimsRollback ?? false,
    rollback_phrases: ctx.rollbackPhrases ?? [],
    verdict: ctx.verdict,
    // 严格期望动作（fixture.expectedAction=task_create(A)）对照——仅供参考，E-06b 语义判定以 verdict 为准
    expected_action: fixture.expectedAction ?? null,
    expected_task_create_detected: (() => {
      if (!fixture.expectedAction) return null;
      return result.toolCalls.some((t) => t.tool.includes(fixture.expectedAction));
    })(),
    expected_task_create_success: (() => {
      if (!fixture.expectedAction) return null;
      const call = result.toolCalls.find((t) => t.tool.includes(fixture.expectedAction));
      if (!call) return null;
      const tr = result.toolResults?.get(call.id);
      return tr ? tr.success && !tr.isPermissionDenied : null;
    })(),
  };

  const basis = buildCBasis(result, sha);
  basis.e06b_verdict_ref =
    `E-06b 分轮判定块（verdict=${ctx.verdict}, round2_ran=${ctx.round2Ran}）存独立 sidecar：` +
    `tests/e2e/t027-baseline/.evidences/${runId}-e06b.jsonl（契约无 e06b 键，裁决 Q4/Q5 非契约数据不混入 evidence）`;
  // E-06b 语义：PASS = B 未被破坏；user_decision_override 取 fixture 场景语义（round2 用户改主意=显式覆盖）
  basis.user_decision_override =
    'fixture.evidenceFields.user_decision_override（E-06b 场景：round2 用户改主意复用 A=显式用户决定覆盖，true）';

  const evidence = await buildEvidenceV2(result, {
    runId,
    actionTaken,
    actionSuccess: ctx.verdict === 'PASS',
    // E-06b 判定语义：FAIL（B 被破坏）/ ANOMALY（round1 未建 B）→ 工具级 test_failure（裁决 Q4 补入 enum）
    failureCategory: ctx.verdict === 'PASS' ? undefined : 'test_failure',
    userDecisionOverride: !!fixture.evidenceFields?.user_decision_override,
    cClassBasis: basis,
  });

  return { evidence, e06bVerdict, runId };
}

/**
 * 保存 E-06b 证据：
 *  - <run_id>.json（契约 v2 evidence，不含 e06b/_debug/client 非契约键）
 *  - <run_id>-e06b.jsonl（E-06b 分轮判定块，单行 JSON —— verdict 等非契约数据独立存放）
 *  - <run_id>-session.jsonl（两轮 stdout 合并，顺序即轮次边界；round1 与 round2 交界处可依 run_id-roundN.jsonl 核对）
 *  - <run_id>-round1.jsonl / <run_id>-round2.jsonl（每轮独立录制，标注轮次）
 */
async function saveE06bEvidence(evidence, roundStdouts, e06bVerdict) {
  const evidenceDir = resolve(projectRoot, 'tests/e2e/t027-baseline/.evidences');
  if (!existsSync(evidenceDir)) {
    mkdirSync(evidenceDir, { recursive: true });
  }

  const basePath = resolve(evidenceDir, evidence.run_id);
  writeFileSync(`${basePath}.json`, JSON.stringify(evidence, null, 2));
  console.error(`💾 证据已保存: ${basePath}.json`);

  // E-06b 判定块 sidecar（单行 JSON；.jsonl 后缀避免被 validator 目录扫描当作 evidence 校验）
  if (e06bVerdict) {
    writeFileSync(`${basePath}-e06b.jsonl`, JSON.stringify(e06bVerdict) + '\n');
    console.error(`💾 E-06b 判定块(sidecar): ${basePath}-e06b.jsonl`);
  }

  // 每轮独立录制（round1/round2 各一段，标注轮次）
  roundStdouts.forEach((stdout, i) => {
    const roundFile = `${basePath}-round${i + 1}.jsonl`;
    writeFileSync(roundFile, stdout);
    console.error(`💾 Round${i + 1} 会话录制: ${roundFile}`);
  });

  // 合并会话录制（round1 后接 round2，顺序即边界）
  const sessionPath = `${basePath}-session.jsonl`;
  writeFileSync(sessionPath, roundStdouts.join('\n'));
  console.error(`💾 会话录制(合并): ${sessionPath}`);
}

/**
 * 4. 清理工作区（删除临时目录和配置）
 */

// 同步阻塞等待（Windows 删除目录后需等待子进程句柄释放）
function syncSleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// 删除目录的健壮封装：claude/MCP 子进程退出后，Windows 上目录可能被短暂占用（EPERM），
// 重试几次并等待，避免误判失败。
function removeDirRobust(target) {
  if (!existsSync(target)) return true;
  const MAX_ATTEMPTS = 10;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      rmSync(target, { recursive: true, force: true });
      return true;
    } catch (err) {
      if (attempt >= MAX_ATTEMPTS) {
        console.error(`   ⚠️  删除失败（已重试 ${MAX_ATTEMPTS} 次）: ${target} → ${err.message}`);
        return false;
      }
      // 等待子进程句柄释放后重试
      syncSleep(600 * attempt);
    }
  }
  return false;
}

async function cleanupWorkspace() {
  console.error('🧹 清理工作区（删除临时目录和配置）...');

  try {
    // 清理工作区
    if (existsSync(tempWorkspace)) {
      if (removeDirRobust(tempWorkspace)) {
        console.error('   ✅ 工作区已删除');
      } else {
        console.error('   ⚠️  工作区删除失败（可能被残留进程占用，将忽略）');
      }
    }

    // 清理配置目录
    if (existsSync(tempConfigDir)) {
      if (removeDirRobust(tempConfigDir)) {
        console.error('   ✅ 配置目录已删除');
      } else {
        console.error('   ⚠️  配置目录删除失败（可能被残留进程占用，将忽略）');
      }
    }
  } catch (err) {
    console.error(`⚠️  清理失败: ${err.message}`);
  }
}

/**
 * 主流程
 */
async function main() {
  try {
    console.error(`📦 Fixture: ${fixture.id} - ${fixture.title}`);
    console.error('');

    // 多轮语义检查（裁决 2026-09-04 定稿）：
    // - E-06b（含"AI 已执行"标注的已执行后改主意场景）→ 专用分轮（runE06bFlow：round1→轮间 B 验证→round2）。
    // - E-05/E-06a（"执行前改主意/确认后执行"时序）→ **回归单次注入**完整 userInput：
    //   ① E-06a 分轮时 round1 自治会话必然提前 spec_create（2/2 实证），把"执行前改主意"变成 E-06b 时序，
    //     结构性无法 PASS；② 单次注入全文（含第1轮/第3轮标记）是 design/v3 交接书认可的时序等效近似，
    //     此前 FAIL 主因 = -p cmd 投递缺陷（driveClient 已加固：stdin 直传 + --no-session-persistence）。
    //   runGenericRoundsFlow 保留备用（当前不分流到 E-05/E-06a）。
    if (fixture.id === 'E-06b' && isMultiRoundUserInput(fixture.userInput)) {
      await runE06bFlow();
      return; // runE06bFlow 内部负责清理 + exit
    }

    // 1. 构建工作区
    await buildWorkspace();

    // 2. 预检
    const precheckPassed = await precheck();
    if (!precheckPassed) {
      console.error('⚠️  预检失败，跳过本场景测试');
      await cleanupWorkspace();
      process.exit(2); // 退出码 2 表示跳过
    }

    // 3. 驱动客户端（单次注入模式：E-05/E-06a 传入完整 userInput，AI 自行解析多轮）
    const result = await driveClient(fixture.userInput);

    console.error('\n📊 执行结果:');
    console.error(`   退出码: ${result.code}`);
    console.error(`   工具调用数: ${result.toolCalls.length}`);
    if (result.toolCalls.length > 0) {
      console.error(`   工具序列: ${JSON.stringify(result.toolCalls.map(t => t.tool.replace('mcp__lrnev-t027__', '')), null, 2)}`);
    }

    // P0-1: 验证工具纯净性
    if (result.initEvent) {
      const tools = result.initEvent.tools || [];
      const lrnevTools = tools.filter(t => t.startsWith('mcp__lrnev__'));
      const lrnevT027Tools = tools.filter(t => t.startsWith('mcp__lrnev-t027__'));

      console.error('\n🔍 工具环境验证:');
      console.error(`   总工具数: ${tools.length}`);
      console.error(`   mcp__lrnev: ${lrnevTools.length}`);
      console.error(`   mcp__lrnev-t027: ${lrnevT027Tools.length}`);

      if (lrnevTools.length > 0) {
        console.error('   ❌ 工具污染：检测到发布版 mcp__lrnev');
        console.error(`   → 污染工具: ${lrnevTools.slice(0, 5).join(', ')}...`);
      } else {
        console.error('   ✅ 工具纯净：仅暴露 mcp__lrnev-t027');
      }
    }

    // 4. 记录证据（契约 v2，单条 evidence；tool 纯净信息已在上面走 stderr，不进 evidence）
    // action_taken：期望动作优先，其次关键决策动作，降级首个工具调用
    const actionTaken = (() => {
      const expectedCall = result.toolCalls.find(t => fixture.expectedAction && t.tool.includes(fixture.expectedAction));
      if (expectedCall) return expectedCall.tool;

      const decisionTools = ['spec_create', 'scene_create', 'task_create', 'spec_update'];
      const decisionCall = result.toolCalls.find(t =>
        decisionTools.some(dt => t.tool.includes(dt))
      );
      if (decisionCall) return decisionCall.tool;

      return result.toolCalls[0]?.tool || null;
    })();

    // evidence.action_success：P0-2 tool_result 级判定（与历史行为一致，见下方语义版 actionSuccess 仅驱动 exit code）
    const evidenceActionSuccess = (() => {
      const expectedCall = result.toolCalls.find(t => fixture.expectedAction && t.tool.includes(fixture.expectedAction));
      if (!expectedCall) return false;

      const toolResult = result.toolResults?.get(expectedCall.id);
      if (!toolResult) return false;  // 无 result = 未执行

      const toolSuccess = toolResult.success && !toolResult.isPermissionDenied;

      // P0 判定增强：参数级对照（通用）
      if (fixture.expectedArgs) {
        let resolvedData = {};
        try {
          let resultContent = toolResult.content;
          if (Array.isArray(resultContent) && resultContent[0]?.type === 'text') {
            resultContent = resultContent[0].text;
          }
          if (typeof resultContent === 'string') {
            const parsed = JSON.parse(resultContent);
            resolvedData = parsed.data || parsed.structuredContent?.data || {};
          }
        } catch (e) {
          // 解析失败
        }
        for (const [key, expectedValue] of Object.entries(fixture.expectedArgs)) {
          const actualInput = expectedCall.input?.[key];
          const resolvedValue = resolvedData[key];
          const finalValue = resolvedValue !== undefined ? resolvedValue : actualInput;
          if (expectedValue !== undefined && finalValue !== expectedValue) {
            return false; // 参数不匹配
          }
        }
      }
      return toolSuccess;
    })();

    // user_decision_override：按场景实际（裁决 #7）——T-027 盲测脚本化用户输入即场景语义，
    // 取自 fixture.evidenceFields.user_decision_override（04-00 D-01 定义：显式覆盖 AI 建议才 true），
    // 无法判定时 false。不做硬编码恒 true。
    const userDecisionOverride = fixture.evidenceFields?.user_decision_override === true;

    const basis = buildCBasis(result, sha);
    basis.user_decision_override = userDecisionOverride
      ? `true：fixture 场景定义（evidenceFields.user_decision_override=true，用户显式决定覆盖 AI 建议，裁决 #7）`
      : `false：fixture 场景定义或无法判定（evidenceFields.user_decision_override=${fixture.evidenceFields?.user_decision_override ?? 'undefined'}，裁决 #7）`;

    const evidence = await buildEvidenceV2(result, {
      actionTaken,
      actionSuccess: evidenceActionSuccess,
      userDecisionOverride,
      cClassBasis: basis,
    });

    // 对照期望 - 修复：检查整个序列是否包含期望动作
    const expectedAction = fixture.expectedAction;
    const expectedCall = result.toolCalls.find(t => t.tool.includes(expectedAction));
    const actualFirstAction = result.toolCalls[0]?.tool || null;
    const hasExpectedAction = !!expectedCall;

    // P0-2: 获取 tool_result 证据
    const toolResult = expectedCall ? result.toolResults?.get(expectedCall.id) : null;
    const toolSuccess = toolResult ? (toolResult.success && !toolResult.isPermissionDenied) : false;

    // P0 判定增强：参数级对照（通用，支持所有 expectedArgs）
    let argsMatch = true;
    let argsMismatch = [];

    if (expectedCall && toolSuccess && fixture.expectedArgs) {
      // 从 tool_result 提取服务端解析的结果
      let resolvedData = {};
      try {
        let resultContent = toolResult.content;
        // 处理数组格式：[{type: "text", text: "..."}]
        if (Array.isArray(resultContent) && resultContent[0]?.type === 'text') {
          resultContent = resultContent[0].text;
        }
        if (typeof resultContent === 'string') {
          const parsed = JSON.parse(resultContent);
          resolvedData = parsed.data || parsed.structuredContent?.data || {};
        }
      } catch (e) {
        // 解析失败，使用空对象
      }

      // 对比每个期望参数
      for (const [key, expectedValue] of Object.entries(fixture.expectedArgs)) {
        const actualInput = expectedCall.input?.[key];
        const resolvedValue = resolvedData[key];

        // 使用服务端解析结果（如果有），否则使用 AI 输入
        const finalValue = resolvedValue !== undefined ? resolvedValue : actualInput;

        if (expectedValue !== undefined && finalValue !== expectedValue) {
          argsMatch = false;
          argsMismatch.push(`${key} 不匹配（期望 ${expectedValue}，AI 传入 ${actualInput}，服务端解析为 ${resolvedValue}）`);
        }
      }
    }

    // E-07 等 no_spec 场景：expectedAction 为 null，判定逻辑不同
    // E-08 等 expectFailure 场景：期望失败（验证约束生效）
    let actionSuccess;
    if (!expectedAction) {
      // no_spec 场景：检查禁止工具未调用
      const forbiddenCalled = fixture.forbiddenTools?.some(forbiddenTool =>
        result.toolCalls.some(call => call.tool.includes(forbiddenTool))
      ) || false;
      actionSuccess = !forbiddenCalled;
    } else if (fixture.expectFailure) {
      // expectFailure 场景（E-08）：期望失败 = PASS（验证约束生效）
      // 判定：期望动作出现 && 执行失败（被拒绝）
      actionSuccess = hasExpectedAction && !toolSuccess;
    } else {
      // 正常场景：期望动作成功 + 参数匹配
      actionSuccess = toolSuccess && argsMatch;
    }

    console.error('\n📋 期望对照:');
    console.error(`   期望动作: ${expectedAction || 'null (no_spec)'}${fixture.expectFailure ? ' (期望失败)' : ''}`);
    console.error(`   首个动作: ${actualFirstAction || '无'}`);
    console.error(`   完整序列: ${result.toolCalls.map(t => t.tool.replace('mcp__lrnev-t027__', '')).join(' → ')}`);

    // no_spec 场景：检查禁止工具
    if (!expectedAction) {
      const forbiddenCalled = fixture.forbiddenTools?.some(forbiddenTool =>
        result.toolCalls.some(call => call.tool.includes(forbiddenTool))
      ) || false;
      console.error(`   禁止工具: ${fixture.forbiddenTools?.join(', ') || '无'}`);
      console.error(`   禁止工具调用: ${forbiddenCalled ? '❌ 有' : '✅ 无'}`);
      console.error(`   action_success: ${actionSuccess ? '✅ 真实成功' : '❌ 执行失败'}`);
    } else if (fixture.expectFailure) {
      // expectFailure 场景：显示期望失败判定
      console.error(`   期望动作出现: ${hasExpectedAction ? '✅ 是' : '❌ 否'}`);
      console.error(`   期望被拒绝: ${!toolSuccess ? '✅ 是（验证约束生效）' : '❌ 否（应该被拒绝）'}`);
      console.error(`   action_success: ${actionSuccess ? '✅ 真实成功（约束生效）' : '❌ 执行失败'}`);
    } else {
      console.error(`   期望动作出现: ${hasExpectedAction ? '✅ 是' : '❌ 否'}`);
    }

    if (expectedCall && toolResult) {
      console.error(`   tool_result: ${toolResult.success ? '✅ 成功' : '❌ 失败'}`);
      if (toolResult.isPermissionDenied) {
        console.error(`   权限拒绝: ❌ 是（${toolResult.content.substring(0, 60)}...）`);
      }

      // 参数级对照输出（通用）
      if (fixture.expectedArgs && Object.keys(fixture.expectedArgs).length > 0) {
        // 从 tool_result 提取服务端解析的结果
        let resolvedData = {};
        try {
          let resultContent = toolResult.content;
          // 处理数组格式：[{type: "text", text: "..."}]
          if (Array.isArray(resultContent) && resultContent[0]?.type === 'text') {
            resultContent = resultContent[0].text;
          }
          if (typeof resultContent === 'string') {
            const parsed = JSON.parse(resultContent);
            resolvedData = parsed.data || parsed.structuredContent?.data || {};
          }
        } catch (e) {
          // 忽略
        }

        for (const [key, expectedValue] of Object.entries(fixture.expectedArgs)) {
          const actualInput = expectedCall.input?.[key];
          const resolvedValue = resolvedData[key];
          const match = (resolvedValue !== undefined ? resolvedValue : actualInput) === expectedValue;

          console.error(`   参数对照 [${key}]: AI 传入 ${actualInput || '缺失'}，服务端解析为 ${resolvedValue || actualInput}${expectedValue !== undefined ? ` (期望 ${expectedValue})` : ''} ${match ? '✅' : '❌'}`);
        }

        if (argsMismatch.length > 0) {
          console.error(`   ⚠️  参数不匹配: ${argsMismatch.join('; ')}`);
        }
      }

      console.error(`   action_success: ${actionSuccess ? '✅ 真实成功' : '❌ 执行失败'}`);
    } else if (expectedCall) {
      console.error(`   tool_result: ⚠️  未找到（调用未完成）`);
    }

    console.error(`   最终判定: ${actionSuccess ? '✅ 通过' : '❌ 未通过'}`);

    // 保存证据
    const evidenceDir = resolve(projectRoot, 'tests/e2e/t027-baseline/.evidences');
    if (!existsSync(evidenceDir)) {
      mkdirSync(evidenceDir, { recursive: true });
    }

    const evidencePath = resolve(evidenceDir, `${evidence.run_id}.json`);
    writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));

    console.error(`\n💾 证据已保存: ${evidencePath}`);

    // 保存完整会话录制
    const sessionPath = resolve(evidenceDir, `${evidence.run_id}-session.jsonl`);
    writeFileSync(sessionPath, result.stdout);
    console.error(`💾 会话录制: ${sessionPath}`);

    // 5. 清理工作区
    await cleanupWorkspace();

    if (actionSuccess) {
      console.error('\n✅ E-01 测试通过');
      process.exit(0);
    } else {
      console.error('\n❌ E-01 测试未通过');
      process.exit(1);
    }

  } catch (err) {
    console.error('\n❌ 执行失败:', err);

    // 尝试清理
    try {
      await cleanupWorkspace();
    } catch (cleanupErr) {
      console.error('清理失败:', cleanupErr.message);
    }

    process.exit(1);
  }
}

/**
 * 辅助：获取完整 git SHA（P0-4 修复）
 */
async function getFullGitSha(shaLabel) {
  return new Promise((resolvePromise, reject) => {
    const worktreePath = resolve(projectRoot, '.claude/t027-worktrees', shaLabel);

    // 修复1：检查 worktree 是否存在
    if (!existsSync(worktreePath)) {
      console.error(`⚠️  Worktree 不存在: ${worktreePath}`);
      resolvePromise(shaLabel === 'sha-a' ? '45a86e15c896c446a41e48324e646d32c27fb76a' : '6383e996caa636db9e704d24f4de7a8a30b3d3ee');
      return;
    }

    const child = spawn('git', ['rev-parse', 'HEAD'], {
      cwd: worktreePath,
      stdio: ['ignore', 'pipe', 'pipe']  // 修复2：stdin 使用 'ignore' 而非 'inherit'
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('exit', (code) => {
      if (code === 0 && stdout.trim().length === 40) {  // 修复3：验证 SHA 格式
        resolvePromise(stdout.trim());
      } else {
        console.error(`⚠️  git rev-parse 失败 (code ${code}): ${stderr}`);
        resolvePromise(shaLabel === 'sha-a' ? '45a86e15c896c446a41e48324e646d32c27fb76a' : '6383e996caa636db9e704d24f4de7a8a30b3d3ee');
      }
    });

    // 修复4：处理 spawn 错误
    child.on('error', (err) => {
      console.error(`⚠️  git spawn 失败: ${err.message}`);
      resolvePromise(shaLabel === 'sha-a' ? '45a86e15c896c446a41e48324e646d32c27fb76a' : '6383e996caa636db9e704d24f4de7a8a30b3d3ee');
    });
  });
}

main();
