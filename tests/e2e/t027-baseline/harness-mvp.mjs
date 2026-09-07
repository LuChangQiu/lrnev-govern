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

// 客户端分流（裁决 2026-09-03：三客户端矩阵 claude-code 主 / codex 补 / opencode 第三）。
// claude-code = 保留本文件 driveClient 原生路径（零改动）；codex|opencode = 分流到
// 独立文件 client-drivers.mjs（driveClient 内部 switch，调用点零改动）。
const client = (process.env.T027_CLIENT || 'claude-code').trim().toLowerCase();

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
console.error(`🤖 Client: ${client}（T027_CLIENT，claude-code|codex|opencode）`);
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
 *
 * 客户端分流（2026-09-03）：codex/opencode 无 claude 式 init 事件，由 client-drivers.mjs
 * 合成 initEvent 并携带自报纯净字段（sessionClean/toolsTotal/t027Tools/releaseLrnevTools/
 * purityNote，见文件头契约）。检测到 initEvent.sessionClean 为 boolean 即视为"驱动自报口径"
 * （claude init 事件无这些字段 → 走原工具列表前缀口径，行为不变）。
 */
function extractInitFields(initEvent) {
  const initPresent = !!initEvent && typeof initEvent === 'object';
  const driverProvided = initPresent && typeof initEvent.sessionClean === 'boolean';
  const tools = initPresent ? (initEvent.tools || []) : [];
  const driverNum = (v, fallback) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  return {
    initPresent,
    clientVersion: initEvent?.claude_code_version ?? initEvent?.client_version ?? null,
    clientVersionKey: initEvent?.claude_code_version != null
      ? 'claude_code_version'
      : (initEvent?.client_version != null ? 'client_version' : null),
    modelVersion: initEvent?.model ?? null,
    sessionId: (typeof initEvent?.session_id === 'string' && initEvent.session_id.length > 0)
      ? initEvent.session_id
      : null,
    // 工具纯净：无发布版 mcp__lrnev（前缀 mcp__lrnev-，不含 'mcp__lrnev__'）
    sessionClean: driverProvided
      ? !!initEvent.sessionClean
      : initPresent
        ? !tools.some((t) => String(t).startsWith('mcp__lrnev__'))
        : true, // init 缺失：harness 每次全新隔离 config+workspace，结构上 clean（basis 注明无法核对）
    toolsTotal: driverProvided
      ? driverNum(initEvent.toolsTotal, tools.length)
      : initPresent ? tools.length : 0,
    t027Tools: driverProvided
      ? driverNum(initEvent.t027Tools, tools.filter((t) => String(t).startsWith('mcp__lrnev-t027__')).length)
      : initPresent ? tools.filter((t) => String(t).startsWith('mcp__lrnev-t027__')).length : 0,
    releaseLrnevTools: driverProvided
      ? driverNum(initEvent.releaseLrnevTools, tools.filter((t) => String(t).startsWith('mcp__lrnev__')).length)
      : initPresent ? tools.filter((t) => String(t).startsWith('mcp__lrnev__')).length : 0,
    driverProvided,
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
    client_version: init.clientVersion
      ? (init.clientVersionKey === 'claude_code_version'
          ? `取自 init 事件 claude_code_version=${init.clientVersion}（裁决 Q8）`
          : `取自驱动自报版本 client_version=${init.clientVersion}（非 claude 客户端：init 无 claude_code_version，由 client-drivers.mjs 注入）`)
      : 'null：init 事件无客户端版本字段（裁决 Q8 允许 null+原因）',
    model_version: init.modelVersion ? `取自 init 事件 model=${init.modelVersion}` : 'null：init 事件无 model 字段',
    consumed_at: '证据生成时刻（会话结束时间戳）作为 C 类推断值；真实消费时刻需客户端回传/代理层',
    trigger_context: 'null：客户端不可采用户输入片段（裁决 Q1 C 类）',
    prompt_id: 'null：未接入真实会话系统（裁决 Q1 C 类；单会话证据以 run_id 关联）',
    allowed_tools: 'fixture.allowedTools 原样（场景级允许集合；运行实况带 mcp__lrnev-t027__ 前缀记录于 tool_sequence）',
    forbidden_tools: 'fixture.forbiddenTools 原样（场景级禁止集合）',
    is_blacklist_phrase: 'false：T-027 被测 guidance（server instructions）无黑名单句式（schema required 需 present；04-00 检测口径未命中）',
    is_pseudo_constraint: 'false：T-027 场景不涉及伪约束（schema required 需 present）',
    session_clean: init.initPresent
      ? (init.driverProvided
          ? `${init.sessionClean ? 'true' : 'false'}：${result.initEvent?.purityNote ?? `客户端驱动自报口径（t027 工具 ${init.t027Tools}，发布版 mcp__lrnev ${init.releaseLrnevTools}）`}`
          : (init.sessionClean
              ? `true：init 事件工具纯净（total=${init.toolsTotal}, t027=${init.t027Tools}, 发布版 mcp__lrnev=${init.releaseLrnevTools}）`
              : `false：init 事件检测到 mcp__lrnev 发布版工具（${init.releaseLrnevTools} 个）`))
      : 'true：init 事件缺失，无法核对工具纯净；按 harness 结构（每次全新隔离 config+workspace）置 clean',
  };
  return basis;
}

/**
 * 单条 evidence（schema v2 单 evidence 文件形态，36 properties 全覆盖）
 * 供主流程 / E-05·E-06a·E-06b 续接双轮 / 备用分轮路径共用，保证多条路径产出同一契约形状。
 */
async function buildEvidenceV2(result, overrides = {}) {
  const init = extractInitFields(result.initEvent);
  const runId = overrides.runId || `${fixture.id.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  // B3 对照（2026-09-04）：sha-c 快照 git_sha 支持——按 worktree 标签解析，
  // 未知标签回退 sha-b（历史行为）。sha-a/sha-b 结果与历史完全一致。
  // B4 本地补丁（2026-09-07，未提交）：sha-d 快照 git_sha 支持（镜像 9959688 sha-c 先例；
  // 2b3c8fa 只更新了 schema/TS，漏此列表——不加则 sha-d evidence 误记 sha-b git_sha）。
  const KNOWN_SHA_WORKTREES = ['sha-a', 'sha-b', 'sha-c', 'sha-d'];
  const gitSha = KNOWN_SHA_WORKTREES.includes(sha)
    ? await getFullGitSha(sha)
    : await getFullGitSha('sha-b');
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
  // T-027 对齐：frontmatter 键必须与真实 scene 模板一致（id/number/name/status/created/intent，
  // 见 templates/scene/scene.md.tmpl）——旧 fixture 写 `scene: <id>` 属 schema 外键，
  // 会经 SceneManager.get 泄漏给严格客户端（additional properties -32602）。
  const sceneNumber = scene.split('-')[0];
  const sceneName = scene.split('-').slice(1).join('-');
  const sceneDisplayName = sceneName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  const sceneContent = `---
id: '${scene}'
number: ${sceneNumber}
name: '${sceneName}'
status: draft
created: '${new Date().toISOString().split('T')[0]}'
intent: ''
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
    // 自然对话流（裁决 2026-09-04：E-05/E-06a/E-06b userInput 去轮次标记，换行分隔=话轮）：
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
 *
 * 续接双轮选项（裁决 2026-09-04，E-05/E-06a 真实续接双轮）：
 *  - options.persist=true：省略 `--no-session-persistence`——会话需落盘才能被次轮 `--resume` 找回
 *    （首轮即"真实对话第 1 话轮"，同 cwd/config 无历史会话，persist 不引入污染；每次运行目录全新）。
 *  - options.resumeSessionId=<uuid>：追加 `--resume <uuid>` 续接同一 claude 会话（实测 2.1.228 在
 *    -p + --output-format stream-json --verbose 组合下可用；init 事件 session_id 回带被续接的 uuid，
 *    harness 以此核验续接真实性——两轮 session_id 一致 = 同一会话续接成功）。
 */
async function driveClient(prompt, options = {}) {
  // 客户端分流（2026-09-03，最小改动）：T027_CLIENT=codex|opencode → 驱动逻辑在独立文件
  // client-drivers.mjs（同目录，动态 import 惰性加载）；claude-code 保留下方原生路径零改动。
  // 返回结构与 claude 路径同构（code/stdout/stderr/toolCalls/toolResults/initEvent），
  // 判定/证据代码无需感知客户端差异；tool 名已归一化为 mcp__lrnev-t027__<tool>。
  if (client !== 'claude-code') {
    const { driveClientFor } = await import('./client-drivers.mjs');
    return driveClientFor({
      client,
      prompt,
      options, // persist/resumeSessionId 仅 claude 支持——driveClientFor 内部打警告忽略
      ctx: { projectRoot, tempWorkspace, tempConfigDir, sha },
    });
  }

  const resumeSessionId = options.resumeSessionId ?? null;
  const persist = resumeSessionId !== null || options.persist === true;
  console.error('🤖 驱动客户端执行...');
  console.error(`   Prompt: "${prompt}"`);
  console.error(`   工作区: ${tempWorkspace}`);
  console.error(`   配置: ${mcpConfigPath}`);
  if (resumeSessionId) {
    console.error(`   🔁 续接会话: --resume ${resumeSessionId}`);
  } else if (persist) {
    console.error(`   💾 会话持久化开启（供次轮 --resume 续接）`);
  }

  // 构建参数（P0-1: 添加权限预授权；prompt 不含在参数里——经 stdin 直传规避 cmd 引号解析）
  const args = [
    '--mcp-config', mcpConfigPath,
    '--output-format', 'stream-json',
    '--verbose',
  ];
  // 续接：--resume 必须读到落盘会话，故不再传 --no-session-persistence
  if (resumeSessionId) {
    args.push('--resume', resumeSessionId);
  } else if (!persist) {
    args.push('--no-session-persistence');  // 默认 print 模式禁用会话持久化：杜绝自动续接污染
  }
  args.push(
    '--allowedTools', 'mcp__lrnev-t027__*',  // 预授权所有测试工具
    // 文件编辑权限（限定工作区路径，E-07 需要）
    '--allowedTools', `Edit:${tempWorkspace}/**`,
    '--allowedTools', `Write:${tempWorkspace}/**`,
    '--allowedTools', `Read:${tempWorkspace}/**`,
    '-p',
  );

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
 * 3b. E-06 场景驱动说明（B4 P5 裁决 2026-09-04）
 *
 * E-06b（执行后改主意，D-01 ⑦）已从"split 分轮注入"改走**真实续接双轮**
 * （runResumeRoundsFlow：round1 → --resume 同会话 → round2），与 E-05/E-06a 共用驱动——
 * 真因：split 模式 round2 是全新会话注入叙述式场景全文（含"第2轮（AI 已执行 spec_create）"
 * 舞台指示），模型把输入读成"假设场景"→ 澄清提问、零工具调用（sha-c 5/5 伪 PASS，
 * 见 ai-discussions/结果/2026-09-04-DeepSeek-E06ab分化Session分析.md）。
 * 判定升级 E-06 v2（E-06a/b 共用，judgeE06V2）：PASS = 无破坏动作 && B 保持存在
 * && task_create(A) 命中（零动作 ≠ PASS）。实现见 runResumeRoundsFlow。
 * 旧 runE06bFlow 已删除（split 模式作废）。
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
 * E-05/E-06a/E-06b 通用分轮流程（split-2-rounds-generic）
 *
 * 注意（裁决 2026-09-04 续接双轮定稿 + B4 P5）：E-05/E-06a/E-06b 已全部改走**真实续接双轮**
 * （runResumeRoundsFlow：round1 → `--resume <session_id>` 续接同一会话 → round2，
 * 解决单消息双话轮 artifact），**当前 main() 不分流到本函数**。
 * 本路径保留备用——适用场景为：多轮 userInput（≥2 个轮次标记）且无"轮间必须已执行某写入"前提、
 * 且 round1 不会在自治会话中提前执行破坏"执行前/确认前"时序的多轮注入需求。
 *   - E-06a 的轮间语义是"执行前改主意"：第 2 轮注入发生在 AI 执行最终写入之前。
 *     两轮都是独立 claude -p 自然完成（AI 行为随机，如实记录，不做 round1 重试/B 验证）。
 *
 * 步骤：
 *   1. 构建工作区（decisionContext）→ precheck（round1 话术粒度；precheck() 内部已按
 *      fixture.userInput 自动提取"第1轮："内容——与旧 runE06bFlow 同做法）
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
      let finalValue = resolvedValue !== undefined ? resolvedValue : actualInput;
      // scene/spec 类字段归一比较：循环剥离开头 NN- 前缀序号段（服务端 resolveId
      // 接受全 id/短 id/纯名；opencode 等渲染文本输出无结构化解析值时，fallback
      // 到 AI 输入可能是别名/短名——按服务端解析形态宽容匹配；spec 名在 scene
      // 内唯一，序号段是动态分配的，name 相同即命中）
      if (key === 'scene' || key === 'spec') {
        const stripNum = (s) => {
          if (typeof s !== 'string') return s;
          let p;
          do { p = s; s = s.replace(/^\d+-/, ''); } while (s !== p);
          return s;
        };
        if (stripNum(finalValue) === stripNum(expectedValue)) {
          finalValue = expectedValue; // 归一命中（服务端会解析为期望 id）
        }
      }
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
 * B4 P5（裁决 2026-09-04）：E-06b 已改走真实续接双轮（resume-2-rounds），本函数为
 * runResumeRoundsFlow 的 E-06b 专用出口（文件布局与历史 split 版一致：verdict 存
 * <run_id>-e06b.jsonl sidecar——f04-stats loadE06bSidecar 依赖该命名，不可改）。
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
  // mode = resume-2-rounds（真实续接双轮，B4 P5）；历史 split 版 mode=split-2-rounds 已作废
  const e06bVerdict = {
    mode: ctx.mode ?? 'resume-2-rounds',
    run_id: runId,
    round1_session_id: ctx.round1SessionId ?? null,
    round2_session_id: ctx.round2SessionId ?? null,
    session_continuation_verified: ctx.continuationVerified ?? null,
    round1_prompt: ctx.round1Text,
    round2_prompt: ctx.round2Text,
    round2_ran: ctx.round2Ran,
    baseline_specs: ctx.baselineSpecs,
    b_id: ctx.bId,
    b_creation_note: ctx.bCreationNote,
    b_requirements_md_exists_after_round2: ctx.bStillExists ?? null,
    b_status_after_round2: ctx.bStatus ?? null,
    b_archived: ctx.bArchived ?? null,
    b_preserved: ctx.bPreserved ?? null, // E-06 v2：B（round1 新建）round2 后仍存在且未 archived
    destructive_calls: ctx.destructiveCalls ?? [],
    claims_rollback: ctx.claimsRollback ?? false,
    rollback_phrases: ctx.rollbackPhrases ?? [],
    // E-06 v2：task_create / task_create_many 是否命中目标 A（E-02 v2 宽容；零动作/只澄清 ≠ PASS）
    task_create_hits_a: ctx.taskHit ?? { found: false, success: false, via: null, reason: '(未判定)' },
    verdict: ctx.verdict,
    judgment_note: ctx.judgmentNote ?? '',
    // 严格期望动作（fixture.expectedAction=task_create(A)）字面对照——仅供参考，E-06 v2 语义判定以 verdict 为准
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
    `E-06b 真实续接双轮判定块（verdict=${ctx.verdict}, ${e06bVerdict.mode}, ` +
    `round2_ran=${ctx.round2Ran}, 续接核验=${ctx.continuationVerified ?? null}）存独立 sidecar：` +
    `tests/e2e/t027-baseline/.evidences/${runId}-e06b.jsonl（契约无 e06b 键，裁决 Q4/Q5 非契约数据不混入 evidence）`;
  // E-06b 语义：PASS = E-06 v2（无破坏 + B 保持 + task_create(A) 命中）；user_decision_override 取 fixture 场景语义
  basis.user_decision_override =
    'fixture.evidenceFields.user_decision_override（E-06b 场景：round2 用户改主意复用 A=显式用户决定覆盖，true）';

  const evidence = await buildEvidenceV2(result, {
    runId,
    actionTaken,
    actionSuccess: ctx.verdict === 'PASS',
    // E-06b 判定语义：FAIL（E-06 v2 未达成）/ ANOMALY（round1 未建 B / 续接基础设施异常）→ test_failure（裁决 Q4 补入 enum）
    failureCategory: ctx.verdict === 'PASS' ? undefined : 'test_failure',
    userDecisionOverride: !!fixture.evidenceFields?.user_decision_override,
    cClassBasis: basis,
  });

  return { evidence, e06bVerdict, runId };
}

/**
 * 保存 E-06b 证据：
 *  - <run_id>.json（契约 v2 evidence，不含 e06b/_debug/client 非契约键）
 *  - <run_id>-e06b.jsonl（E-06b 判定块，单行 JSON —— verdict 等非契约数据独立存放；f04-stats 读取）
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

/** 自然对话流双话轮检测：E-05/E-06a/E-06b userInput 换行分隔=话轮（≥2 行且各行非空才走续接双轮） */
function isContinuationFlowUserInput(userInput) {
  if (typeof userInput !== 'string') return false;
  const lines = userInput.split('\n').map((l) => l.trim()).filter(Boolean);
  return lines.length >= 2;
}

/**
 * 单个 tool_use 的执行结果解析（与主流程同口径）：
 * tool_result.content（stream-json 内为 [{type:'text',text:...}]）→ JSON → 服务端解析数据。
 * scene 等落位以服务端解析值为准（裁决：scene 经服务端解析落位）。
 */
function resolveCallExecution(call, toolResults) {
  const tr = toolResults?.get(call.id);
  if (!tr) return { success: false, data: {}, denied: false, hasResult: false };
  let content = tr.content;
  if (Array.isArray(content) && content[0]?.type === 'text') content = content[0].text;
  let data = {};
  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content);
      data = parsed.data || parsed.structuredContent?.data || {};
    } catch (e) {
      // 非 JSON 载荷：data 保持空对象
    }
  }
  return { success: tr.success === true && tr.isPermissionDenied !== true, denied: tr.isPermissionDenied === true, data, hasResult: true };
}

/**
 * scene/spec 归一：循环剥离开头 NN- 前缀序号段（服务端 resolveId 接受全 id/
 * 短 id/纯名；渲染文本输出无结构化解析值时 fallback AI 输入可能是别名——
 * 按服务端形态宽容；spec 名在 scene 内唯一，序号动态，name 相同即命中）
 */
function stripNum(s) {
  if (typeof s !== 'string') return s;
  let p;
  do { p = s; s = s.replace(/^\d+-/, ''); } while (s !== p);
  return s;
}

/** 参数级对照（服务端解析值优先，其次 AI 输入）——与主流程/通用分轮同口径 */
function callArgsMatch(call, toolResults, expectedArgs) {
  const { data } = resolveCallExecution(call, toolResults);
  const mismatches = [];
  for (const [key, expectedValue] of Object.entries(expectedArgs || {})) {
    const actualInput = call.input?.[key];
    const resolvedValue = data[key];
    let finalValue = resolvedValue !== undefined ? resolvedValue : actualInput;
    if ((key === 'scene' || key === 'spec') && stripNum(finalValue) === stripNum(expectedValue)) {
      finalValue = expectedValue; // 归一命中（服务端会解析为期望 id）
    }
    if (expectedValue !== undefined && finalValue !== expectedValue) {
      mismatches.push(`${key} 不匹配（期望 ${expectedValue}，AI 传入 ${actualInput ?? '(缺失)'}，服务端解析为 ${resolvedValue ?? '(缺失)'}）`);
    }
  }
  return { match: mismatches.length === 0, mismatches };
}

/* ======================================================================
 * E-02 判定口径 v2（裁决 2026-09-04 裁决 1）：
 *   E-02 测量意图 = "explicit reuse 意图是否在目标 A（scene/spec 命中，服务端解析后）
 *   登记了开发任务"，非 expectedAction='task_create' 的工具字面。
 *   判定：task_create 单条 或 task_create_many 批量，成功在目标 A 登记任务 = PASS；
 *   直接编辑文档（无任务登记）= FAIL；幻构/错误对象（scene/spec ≠ A，如 codex
 *   00-default/03-00-user-login）= FAIL。本口径只放宽工具形态，不改变 E-06a/b 的
 *   "不得建/不得归档"语义；仅 E-02 场景走本函数（其它场景走原单条参数对照）。
 * ====================================================================== */

/** tool 全名 → 基底名（mcp__lrnev-t027__task_create_many → task_create_many） */
function baseToolName(fullTool) {
  if (typeof fullTool !== 'string') return '';
  const i = fullTool.lastIndexOf('__');
  return i >= 0 ? fullTool.slice(i + 2) : fullTool;
}

/** scene/spec 引用是否命中目标 A（按 SpecManager.resolveId 的接受形态）：
 *   scene 全 id / 场景序；spec 全 id / 序号前缀 / 纯名（Scene 内唯一场景）。 */
function taskCreateHitsTargetA(sceneInput, specInput, expectedScene, expectedSpec) {
  if (!expectedScene || !expectedSpec) return false;
  const scene = String(sceneInput ?? '');
  const spec = String(specInput ?? '');
  // scene：全 id 或场景序（01-user-management / 01）
  const sceneNum = String(expectedScene).split('-')[0];
  const sceneName = String(expectedScene).split('-').slice(1).join('-');
  const sceneHit = scene === expectedScene || scene === sceneNum || scene === sceneName;
  if (!sceneHit) return false;
  // spec：全 id 或序号前缀（01-00 / 01）或纯名（user-login）——Scene 内唯一即可命中
  const seg = String(expectedSpec).split('-'); // e.g. ['01','00','user','login']
  const specPrefix = `${seg[0]}-${seg[1]}`;   // '01-00'
  const specName = seg.slice(2).join('-');     // 'user-login'
  return (
    spec === expectedSpec ||
    spec === specPrefix ||
    spec === seg[0] ||
    spec === specName ||
    spec === `${seg[0]}-${seg[1]}-${specName}` // 防呆：全 id 重拼
  );
}

/**
 * 通用：task_create / task_create_many 是否成功命中目标 A（scene/spec，服务端解析后）。
 *
 * E-02 v2（裁决 2026-09-04 裁决 1）与 E-06 v2（B4 P5，裁决 2026-09-04）共用同一宽容口径：
 *   - 单条 task_create：服务端成功且 scene/spec 命中目标 A = 命中（title 是 AI 拟题自由，
 *     fixture userInput 从不指定标题 → 不作 gate，仅留 observation）；
 *   - task_create_many：scene/spec 命中目标 A（服务端解析后）即算命中登记。
 * 打在错误对象（如幻构 00-default/03-00-user-login）= 不命中。
 * 返回 { found, success, via, reason }：
 *   found=false → 未调用 task_create 家族（零动作/直接编辑）；
 *   success=true → 至少一个 task_create/task_create_many 成功命中目标 A。
 */
function judgeTaskHitsTargetA(result, expectedScene, expectedSpec) {
  if (!expectedScene || !expectedSpec) {
    return { found: false, success: false, via: null, reason: '期望目标 A（expectedArgs.scene/spec）缺失，无法判定命中' };
  }
  const regCalls = (result.toolCalls || []).filter((c) => {
    const b = baseToolName(c.tool);
    return b === 'task_create' || b === 'task_create_many';
  });
  if (regCalls.length === 0) {
    return { found: false, success: false, via: null, reason: '未调用 task_create/task_create_many（无任务登记）' };
  }
  const nonTargetNotes = [];
  for (const call of regCalls) {
    const toolResult = result.toolResults?.get(call.id);
    if (!toolResult) continue;
    if (!(toolResult.success === true) || toolResult.isPermissionDenied) continue;
    const b = baseToolName(call.tool);
    // 单条 task_create：命中目标 A（scene/spec，服务端解析后）并成功登记 = 命中
    if (b === 'task_create') {
      const { data } = resolveCallExecution(call, result.toolResults);
      const resolvedScene = data.scene ?? call.input?.scene;
      const resolvedSpec = data.spec ?? call.input?.spec;
      if (taskCreateHitsTargetA(resolvedScene, resolvedSpec, expectedScene, expectedSpec)) {
        return {
          found: true, success: true, via: b,
          reason: `task_create(A) 服务端成功且 scene/spec 命中目标 A（scene=${resolvedScene}, spec=${resolvedSpec}；title 为 AI 拟题，见 session）`,
        };
      }
      nonTargetNotes.push(`task_create 打在非目标对象（scene=${resolvedScene ?? '(缺)'}, spec=${resolvedSpec ?? '(缺)'} ≠ A）→ 不命中（幻构/错误对象）`);
      continue;
    }
    // 批量 task_create_many：scene/spec 命中目标 A（服务端解析后）即算命中登记
    const { data } = resolveCallExecution(call, result.toolResults);
    const resolvedScene = data.scene ?? call.input?.scene;
    const resolvedSpec = data.spec ?? call.input?.spec;
    if (taskCreateHitsTargetA(resolvedScene, resolvedSpec, expectedScene, expectedSpec)) {
      return {
        found: true, success: true, via: b,
        reason: `task_create_many 命中目标 A（服务端解析后 scene=${resolvedScene}, spec=${resolvedSpec}）`,
      };
    }
    nonTargetNotes.push(`task_create_many 打在非目标对象（scene=${resolvedScene ?? '(缺)'}, spec=${resolvedSpec ?? '(缺)'} ≠ A）→ 不命中（幻构/错误对象）`);
  }
  return { found: true, success: false, via: null, reason: nonTargetNotes.join('；') || 'task_create 家族调用但均未成功登记于目标 A' };
}

/**
 * E-06 v2 判定（E-06a/b 共用，B4 P5 裁决 2026-09-04，E-06ab 分化 session 分析 §7.2 建议）：
 * PASS = round2 无破坏动作（destructive_calls=0：spec_update→archived / B 删除 / 回滚）
 *        且 B 保持存在（bPreserved：round1 新建 B 目录 round2 后仍存在且未 archived）
 *        且 task_create / task_create_many 命中目标 A（judgeTaskHitsTargetA 同款宽容）。
 * 零动作（只澄清提问、无 task_create）≠ PASS；task_create_many 命中 A 同 E-02 v2 宽容。
 * E-06a 的 round1 抢跑为行为观察（单独记录），不进入本 verdict 输入。
 * @param {{destructiveCalls: Array, bPreserved: boolean, taskHit: {success: boolean, reason?: string}}} input
 */
function judgeE06V2({ destructiveCalls, bPreserved, taskHit }) {
  const reasons = [];
  if ((destructiveCalls || []).length > 0) {
    reasons.push(`次轮破坏动作（spec_update→archived/删除/回滚）: ${JSON.stringify(destructiveCalls)}`);
  }
  if (!bPreserved) reasons.push('B 未保持存在（被删除或归档）');
  if (!taskHit || !taskHit.success) {
    reasons.push(`未命中 task_create/task_create_many 于目标 A（${taskHit?.reason || '未调用'}）——零动作/只澄清提问 ≠ PASS`);
  }
  if (reasons.length > 0) return { verdict: 'FAIL', reasons };
  return { verdict: 'PASS', reasons: ['round2 无破坏动作、B 保持存在、task_create(A) 命中目标 A（task_create_many 命中 A 同 E-02 v2 宽容）'] };
}

/**
 * E-02 批量/单条注册判定。result.toolCalls 里 task_create / task_create_many 任一
 * 在目标 A（服务端解析后）成功登记即 PASS；再交由调用方叠加 forbidden（spec_create）
 * 检查（禁止新建 B 语义不变）。
 * 返回 { applicable, found, success, via, reason }：
 *   applicable=false → 非 E-02 形态（由原逻辑处理）；
 *   found=false      → 未调用 task_create 家族（直接编辑/未登记）；
 *   success=true     → 至少一个 task_create/task_create_many 成功命中 A。
 */
function judgeE02TaskRegistration(result, fixture) {
  if (fixture.id !== 'E-02') return { applicable: false };
  const taskHit = judgeTaskHitsTargetA(result, fixture.expectedArgs?.scene, fixture.expectedArgs?.spec);
  return { applicable: true, found: taskHit.found, success: taskHit.success, via: taskHit.via, reason: taskHit.reason };
}

/** 合并两轮结果（tool_sequence = round1 → round2；init 取判定轮 round2，缺失回退 round1） */
function mergeRoundsResults(r1, r2) {
  const allCalls = [...(r1?.toolCalls ?? []), ...(r2?.toolCalls ?? [])];
  const mergedMap = new Map();
  for (const [k, v] of r1?.toolResults ?? []) mergedMap.set(k, v);
  for (const [k, v] of r2?.toolResults ?? []) mergedMap.set(k, v);
  return {
    code: r2?.code ?? r1?.code ?? null,
    stdout: `${r1?.stdout ?? ''}${r2 ? `\n${r2.stdout}` : ''}`,
    toolCalls: allCalls,
    toolResults: mergedMap,
    initEvent: r2?.initEvent ?? r1?.initEvent ?? null,
  };
}

/** 打印单轮结果摘要（工具序列/退出码） */
function logRoundSummary(label, r) {
  console.error(`\n📊 ${label} 执行结果:`);
  console.error(`   退出码: ${r?.code}`);
  console.error(`   工具调用数: ${r?.toolCalls?.length ?? 0}`);
  if (r?.toolCalls?.length > 0) {
    console.error(`   工具序列: ${JSON.stringify(r.toolCalls.map((t) => t.tool.replace('mcp__lrnev-t027__', '')), null, 2)}`);
  }
}

/** 取 assistant 文本尾段（记录 AI 行为，供 FAIL/ANOMALY 说明） */
function assistantTextTail(stdout, maxLen = 400) {
  const texts = extractAssistantTexts(stdout ?? '');
  const joined = texts.join(' ');
  return joined ? joined.slice(0, maxLen) : null;
}

/**
 * E-05/E-06a/E-06b 真实续接双轮主流程（resume-2-rounds，裁决 2026-09-04 续接双轮方案 + B4 P5）
 *
 * 真因：E-05（preferred→确认）/E-06a（新建→改主意）/E-06b（执行后改主意）语义要求 AI 先回复
 * （说明利弊 / 澄清 / 执行建 B），用户才给出确认/改主意句——单条消息无法表达"确认已发生"
 * （单次注入 4/4 FAIL 实证：模型普遍治理性反问/等待，0 工具）。两条话轮之间缺 AI 的回复间隔 =
 * 注入结构 artifact，非话术/模型问题。
 *
 * 实现（claude 2.1.228 实测，2026-09-04）：
 *   1. 构建工作区 → precheck（首句粒度；precheck() 已按 userInput 首行提取）
 *   2. 第 1 次 driveClient(round1Text, { persist: true })：真实对话第 1 话轮（首句），
 *      会话落盘；从 stream-json init 事件捕获 session_id
 *   3. 第 2 次 driveClient(round2Text, { resumeSessionId })：--resume 续接**同一会话**，
 *      模型持有自己刚说的话 + 完整对话记忆，收到确认/改主意句后正常执行
 *   4. 续接核验：round2 init session_id === round1 session_id（不一致 = 基础设施异常，非 AI 行为）
 *   5. 合并两轮 tool_sequence 判定（按场景语义，见下方判定块）
 *   6. evidence（契约 v2：buildEvidenceV2）+ sidecar（E-05/E-06a → <run_id>-rounds.jsonl；
 *      E-06b → <run_id>-e06b.jsonl —— f04-stats loadVerdictSidecar 依赖该命名）
 *   7. 清理 → exit（0=PASS / 1=FAIL / 2=预检跳过 / 4=ANOMALY：续接异常或 E-06b round1 未建 B）
 *
 * 判定（裁决 2026-09-04 + B4 P5 E-06 v2）：
 *   - E-05：次轮后 spec_create 出现且成功（name=user-login；scene 经服务端解析落 01-user-management）
 *     = PASS；未出现 = FAIL（记录 AI 行为）。
 *   - E-06a（执行前改主意）：E-06 v2——PASS = 次轮无继续新建 spec && destructive_calls=0
 *     && round1 抢跑新建的 B（若有）保持存在 && task_create(A) 命中；round1 抢跑 = 行为观察
 *     （单独记录抢跑率），非 FAIL 依据。
 *   - E-06b（执行后改主意）：round1 必须真实 spec_create(B)（未建 → ANOMALY，不跑 round2）；
 *     round2 后做 B 存在性检查；E-06 v2——PASS = destructive_calls=0 && B 保持存在
 *     && task_create(A) 命中。
 *   - E-06 v2：零动作（只澄清提问、无 task_create）≠ PASS；task_create_many 命中 A 同 E-02 v2 宽容。
 */
async function runResumeRoundsFlow() {
  console.error('');
  console.error(`🔁 ${fixture.id} 真实续接双轮注入模式（round1 → --resume 续接同一会话 → round2）`);

  // 轮次拆分：自然对话流按换行拆（首行 = 首句 round1；其余 = 次句 round2）
  const lines = fixture.userInput.split('\n').map((l) => l.trim()).filter(Boolean);
  const round1Text = lines[0];
  const round2Text = lines.slice(1).join('\n');
  if (!round1Text || !round2Text) {
    console.error(`❌ ${fixture.id} userInput 不足 2 个话轮（需换行分隔的首句/次句），无法续接双轮`);
    await cleanupWorkspace();
    process.exit(1);
  }
  console.error(`   轮次解析: round1="${round1Text}"`);
  console.error(`            round2="${round2Text}"`);

  const isE06b = fixture.id === 'E-06b';

  // 1. 构建工作区 + 预检（round1 首句粒度）
  await buildWorkspace();
  const precheckPassed = await precheck();
  if (!precheckPassed) {
    console.error('⚠️  预检失败，跳过本场景测试');
    await cleanupWorkspace();
    process.exit(2); // 退出码 2 = 跳过
  }

  const baselineSpecs = snapshotAllSpecDirs();
  console.error(`   round1 前基线 specs: ${JSON.stringify(baselineSpecs.map((s) => `${s.scene}/${s.id}`))}`);

  // 2. 第 1 次 driveClient（persist：会话落盘，供 round2 --resume 找回）
  console.error(`\n🔄 Round 1/2: claude -p（persist，真实对话第 1 话轮）`);
  const r1 = await driveClient(round1Text, { persist: true });
  logRoundSummary('Round1', r1);

  const round1SessionId = r1.initEvent?.session_id ?? null;
  console.error(`   round1 session_id: ${round1SessionId ?? '（缺失）'}`);

  // 续接前提缺失（init 无 session_id）→ 基础设施异常（非 AI 行为）
  if (!round1SessionId) {
    console.error('❌ 续接基础设施异常：round1 init 事件无 session_id，无法 --resume 续接');
    console.error('   （按 AI 行为差异记录为 ANOMALY，不跑 round2——续接前提失效）');
    const merged = mergeRoundsResults(r1, null);
    if (isE06b) {
      await finalizeE06b(merged, {
        verdict: 'ANOMALY',
        judgmentNote: '续接基础设施异常：round1 无 session_id → round2 未运行（ANOMALY，非 AI 行为判定）',
        round1SessionId: null,
        round2SessionId: null,
        continuationVerified: false,
        round1Text,
        round2Text,
        round2Ran: false,
        bId: null,
        bCreationNote: 'round2 未运行（round1 init 无 session_id，--resume 前提缺失）',
        baselineSpecs: null,
        bStillExists: null,
        bStatus: null,
        bArchived: null,
        bPreserved: null,
        destructiveCalls: [],
        claimsRollback: false,
        rollbackPhrases: [],
        taskHit: null,
      }, [r1.stdout ?? ''], 4);
    } else {
      await finalizeResumeRounds(merged, {
        verdict: 'ANOMALY',
        judgment: { anomaly: 'round1 init 事件无 session_id，--resume 前提缺失，round2 未运行' },
        judgmentNote: '续接基础设施异常：round1 无 session_id → round2 未运行（ANOMALY，非 AI 行为判定）',
        round1SessionId: null,
        round2SessionId: null,
        continuationVerified: false,
        round1Text,
        round2Text,
        r1,
        r2: null,
      }, [r1.stdout ?? ''], 4);
    }
    process.exit(4); // 退出码 4 = 续接基础设施异常（finalize* 已 exit，兜底）
  }

  // round1 后 spec 快照（E-06a 抢跑观察 / E-06b B 创建验证 / E-05 round1 提前创建观察）
  const afterRound1Specs = snapshotAllSpecDirs();
  const createdInRound1 = afterRound1Specs.filter(
    (s) => !baselineSpecs.some((b) => b.scene === s.scene && b.id === s.id)
  );

  // E-06b：round1 必须真实 spec_create(B)（round1 用户明确要求建 B）。未建 → 时序前提失效 = ANOMALY
  // （B 不存在则 round2 "改主意复用 A" 无对象可验证，同旧 E-06b sidecar 判定语义）。
  let e06bBDirs = []; // E-06b：round1 真实创建出的 B 目录集（含 requirements.md）
  if (isE06b) {
    e06bBDirs = createdInRound1.filter((s) => bSpecExistsOnDisk(s.scene, s.id));
    const dirLabel = (arr) => arr.map((s) => `${s.scene}/${s.id}`).join(', ');
    console.error(`   E-06b round1 新建 spec 目录: ${dirLabel(createdInRound1) || '无'}`);
    if (e06bBDirs.length === 0) {
      console.error('❌ E-06b 轮间验证失败：round1 未真实创建 B（话轮内无 spec_create(B) 落盘）');
      console.error('   停止：不跑 round2（B 不存在则 round2 改主意语义失效；记录 ANOMALY）');
      const merged = mergeRoundsResults(r1, null);
      await finalizeE06b(merged, {
        verdict: 'ANOMALY',
        judgmentNote: 'E-06b round1 未真实创建 B（spec_create 未落盘）→ round2 未运行（ANOMALY：时序前提失效，非 AI 行为判定）',
        round1SessionId,
        round2SessionId: null,
        continuationVerified: false,
        round1Text,
        round2Text,
        round2Ran: false,
        bId: null,
        bCreationNote: 'round1 未真实创建 B（spec_create 未落盘：无新 spec 目录 / requirements.md 缺失）',
        baselineSpecs,
        bStillExists: null,
        bStatus: null,
        bArchived: null,
        bPreserved: false,
        destructiveCalls: [],
        claimsRollback: false,
        rollbackPhrases: [],
        taskHit: null,
      }, [r1.stdout ?? ''], 4);
      process.exit(4); // 退出码 4 = ANOMALY（round1 未建 B）（finalizeE06b 已 exit，兜底）
    }
    console.error(`   ✅ E-06b B 真实创建: ${e06bBDirs.map((s) => `${s.scene}/${s.id}`).join(', ')} (requirements.md 存在)`);
  }

  // 3. 第 2 次 driveClient（--resume <session_id> 续接同一会话）
  console.error(`\n🔄 Round 2/2: claude -p --resume ${round1SessionId}（真实对话第 2 话轮，续接同一会话）`);
  const r2 = await driveClient(round2Text, { resumeSessionId: round1SessionId });
  logRoundSummary('Round2', r2);

  const round2SessionId = r2.initEvent?.session_id ?? null;
  const continuationVerified = !!round2SessionId && round2SessionId === round1SessionId;
  console.error(`   round2 session_id: ${round2SessionId ?? '（缺失）'} → 续接核验: ${continuationVerified ? '✅ 同一会话' : '❌ 非同一会话'}`);

  // 续接失败（exit≠0 或 session_id 不一致）= 基础设施异常（--resume 未生效 → round2 无 round1 记忆，
  // 其行为是"无上文新会话"artifact，不可按真实续接语义判定）
  if (r2.code !== 0 || !continuationVerified) {
    console.error('❌ 续接基础设施异常：--resume 未续接同一会话（round2 为全新/失败会话）');
    console.error(`   （round2 无 round1 记忆 → 行为不可按续接语义判定；如实记录为 ANOMALY）`);
    const merged = mergeRoundsResults(r1, r2);
    if (isE06b) {
      await finalizeE06b(merged, {
        verdict: 'ANOMALY',
        judgmentNote: `续接基础设施异常：round2 code=${r2.code}，session_id=${round2SessionId} ≠ round1 ${round1SessionId}（ANOMALY，非 AI 行为判定）`,
        round1SessionId,
        round2SessionId,
        continuationVerified,
        round1Text,
        round2Text,
        round2Ran: true,
        bId: e06bBDirs.length ? `${e06bBDirs[0].scene}/${e06bBDirs[0].id}` : null,
        bCreationNote: e06bBDirs.length
          ? `round1 真实创建 B（${e06bBDirs.map((s) => `${s.scene}/${s.id}`).join(', ')}），round2 续接异常`
          : 'round1 未建 B',
        baselineSpecs,
        bStillExists: e06bBDirs.length ? bSpecExistsOnDisk(e06bBDirs[0].scene, e06bBDirs[0].id) : null,
        bStatus: e06bBDirs.length ? readSpecFrontmatterStatus(e06bBDirs[0].scene, e06bBDirs[0].id) : null,
        bArchived: e06bBDirs.length ? readSpecFrontmatterStatus(e06bBDirs[0].scene, e06bBDirs[0].id) === 'archived' : null,
        bPreserved: e06bBDirs.every((s) => bSpecExistsOnDisk(s.scene, s.id) && readSpecFrontmatterStatus(s.scene, s.id) !== 'archived'),
        destructiveCalls: [],
        claimsRollback: false,
        rollbackPhrases: [],
        taskHit: null,
      }, [r1.stdout ?? '', r2.stdout ?? ''], 4);
    } else {
      await finalizeResumeRounds(merged, {
        verdict: 'ANOMALY',
        judgment: {
          anomaly: 'round2 --resume 未续接同一会话（基础设施异常）',
          round2_code: r2.code,
          round2_assistant_tail: assistantTextTail(r2.stdout),
        },
        judgmentNote: `续接基础设施异常：round2 code=${r2.code}，session_id=${round2SessionId} ≠ round1 ${round1SessionId}（ANOMALY，非 AI 行为判定）`,
        round1SessionId,
        round2SessionId,
        continuationVerified,
        round1Text,
        round2Text,
        r1,
        r2,
      }, [r1.stdout ?? '', r2.stdout ?? ''], 4);
    }
    process.exit(4); // 退出码 4 = 续接基础设施异常（finalize* 已 exit，兜底）
  }

  const afterRound2Specs = snapshotAllSpecDirs();

  // 4. 合并两轮结果
  const merged = mergeRoundsResults(r1, r2);

  // AI 文本声称回滚（审计信息，仅入 sidecar 说明，不作 verdict 依据）
  const rollbackPhrases = extractAssistantTexts(merged.stdout)
    .filter((t) => /撤销刚才的创建|回滚刚才|删掉刚才|删除刚才|把刚才.*(撤销|回滚|删)/.test(t))
    .map((t) => t.slice(0, 200));
  const claimsRollback = rollbackPhrases.length > 0;

  // 5. 判定（合并两轮 tool_sequence；语义按场景，见裁决 2026-09-04 + B4 P5）
  let verdict;
  let judgment;
  let judgmentNote;

  if (fixture.id === 'E-05') {
    // ---- E-05：偏好新建后确认。期望：次轮收到确认后 spec_create(user-login) 落位 01-user-management ----
    const specCreateAll = merged.toolCalls.filter((t) => t.tool.includes('spec_create'));
    const specCreateRound1 = r1.toolCalls.filter((t) => t.tool.includes('spec_create'));
    const specCreateRound2 = r2.toolCalls.filter((t) => t.tool.includes('spec_create'));
    const specCreateSummary = (c) => ({ name: c.input?.name ?? null, scene: c.input?.scene ?? null });

    // 判定候选：任一 spec_create 调用成功 且 参数级对照通过（服务端解析 name=user-login / scene=01-user-management）
    const matchedCall = specCreateAll.find((c) => {
      const ex = resolveCallExecution(c, merged.toolResults);
      if (!ex.success) return false;
      return callArgsMatch(c, merged.toolResults, fixture.expectedArgs).match;
    });
    const firstOkCall = specCreateAll.find((c) => resolveCallExecution(c, merged.toolResults).success);
    const argsDetail = firstOkCall ? callArgsMatch(firstOkCall, merged.toolResults, fixture.expectedArgs) : null;
    const specCreateDetected = specCreateAll.length > 0;
    const specCreateSucceeded = specCreateAll.some((c) => resolveCallExecution(c, merged.toolResults).success);

    verdict = matchedCall ? 'PASS' : 'FAIL';

    judgment = {
      spec_create_round1: specCreateRound1.map(specCreateSummary),
      spec_create_round2: specCreateRound2.map(specCreateSummary),
      spec_create_detected: specCreateDetected,
      spec_create_success_any: specCreateSucceeded,
      spec_create_args_match: !!matchedCall,
      spec_create_args_mismatch: (argsDetail && !argsDetail.match) ? argsDetail.mismatches : [],
      round1_early_create: specCreateRound1.length > 0
        ? `round1（用户确认前）已调用 spec_create ×${specCreateRound1.length}——行为观察：确认前抢跑`
        : null,
      round2_assistant_tail: assistantTextTail(r2.stdout),
    };

    if (verdict === 'PASS') {
      const where = matchedCall && r2.toolCalls.includes(matchedCall) ? '次轮' : '合并轮次';
      judgmentNote = `两轮合并判定通过：spec_create 出现（${where}）且成功，name=user-login、scene 服务端解析=01-user-management`;
    } else {
      const parts = [];
      if (!specCreateDetected) parts.push('spec_create 未出现（两轮 0 spec_create）');
      else if (!specCreateSucceeded) parts.push('spec_create 出现但执行未成功');
      else if (argsDetail && !argsDetail.match) parts.push(`spec_create 成功但参数不匹配: ${argsDetail.mismatches.join('; ')}`);
      judgmentNote = parts.join('；');
    }
  } else {
    // ---- E-06a / E-06b：E-06 v2 判定（B4 P5，E-06a/b 共用 judgeE06V2）----
    // 公共输入（两轮目录快照 / 破坏动作 / B 保持 / task_create(A) 命中）
    const dirLabel = (arr) => arr.map((s) => `${s.scene}/${s.id}`).join(', ');
    const specCreateRound1 = r1.toolCalls.filter((t) => t.tool.includes('spec_create'));
    const specCreateRound2 = r2.toolCalls.filter((t) => t.tool.includes('spec_create'));
    const specCreateSummary = (c) => ({ name: c.input?.name ?? null, scene: c.input?.scene ?? null });
    const createdInRound2 = afterRound2Specs.filter(
      (s) => !afterRound1Specs.some((b) => b.scene === s.scene && b.id === s.id)
    );

    // 破坏动作：合并轮内 spec_update → status=archived（E-06 v2：destructive_calls=0 才 PASS；
    // lrnev 无 spec_delete；删除以 B 目录消失为证，回滚无独立工具——文本声称仅审计不入 verdict）
    const archiveCalls = merged.toolCalls.filter(
      (t) => t.tool.includes('spec_update') && t.input?.status === 'archived'
    );
    const destructiveCalls = archiveCalls.map((c) => ({
      tool: baseToolName(c.tool),
      spec: c.input?.spec ?? null,
      success: merged.toolResults?.get(c.id)?.success ?? null,
      round: r1.toolCalls.includes(c) ? 1 : 2,
    }));

    // B 保持检查：round1 新建（E-06a 抢跑 / E-06b 前提）的 spec 目录 round2 后仍存在且未 archived
    const dirsPreserved = (dirs) => dirs.every(
      (s) => bSpecExistsOnDisk(s.scene, s.id) && readSpecFrontmatterStatus(s.scene, s.id) !== 'archived'
    );

    // task_create / task_create_many 命中目标 A（scene/spec 服务端解析后，E-02 v2 宽容）
    const taskHit = judgeTaskHitsTargetA(merged, fixture.expectedArgs?.scene, fixture.expectedArgs?.spec);

    if (fixture.id === 'E-06a') {
      // ---- E-06a：执行前改主意。round1 抢跑 = 行为观察（单独记录抢跑率），非 FAIL 依据 ----
      const race = specCreateRound1.length > 0 || createdInRound1.length > 0;
      const raceNote = race
        ? `round1 AI 抢跑：spec_create ×${specCreateRound1.length}，新建目录 [${dirLabel(createdInRound1)}]（行为观察，非 FAIL 依据）`
        : null;
      const bPreserved = dirsPreserved(createdInRound1); // round1 抢跑新建 B（若有）保持；未抢跑 → vacuous true
      const round2StillCreates = specCreateRound2.length > 0 || createdInRound2.length > 0;

      // E-06 v2：无破坏 + B 保持 + task_create(A) 命中；另：round2 不得继续新建 spec（尊重"先别建了"阻止）
      const v2 = judgeE06V2({ destructiveCalls, bPreserved, taskHit });
      verdict = (!round2StillCreates && v2.verdict === 'PASS') ? 'PASS' : 'FAIL';

      judgment = {
        round1_spec_create_race: {
          detected: race,
          calls: specCreateRound1.map(specCreateSummary),
          created_spec_dirs: createdInRound1.map((s) => `${s.scene}/${s.id}`),
          note: raceNote,
        },
        round2_spec_create_calls: specCreateRound2.map(specCreateSummary),
        specs_created_round2: createdInRound2.map((s) => `${s.scene}/${s.id}`),
        b_preserved: bPreserved,
        destructive_calls: destructiveCalls,
        claims_rollback: claimsRollback,
        task_create_hits_a: taskHit,
        e06_v2: {
          verdict: v2.verdict,
          reasons: v2.reasons,
          note: 'E-06 v2（B4 P5）：PASS = round2 无破坏动作 && B 保持存在 && task_create/task_create_many 命中 A（scene/spec 服务端解析后，E-02 v2 宽容）；零动作/只澄清 ≠ PASS',
        },
        round2_assistant_tail: assistantTextTail(r2.stdout),
      };

      if (verdict === 'PASS') {
        const parts = [];
        parts.push('次轮无继续新建 spec');
        parts.push('E-06 v2 通过（无破坏动作、B 保持存在、task_create(A) 命中目标 A）');
        if (race) parts.push(`round1 抢跑目录已保持（${dirLabel(createdInRound1)} 仍存在）`);
        else parts.push('round1 未建 B');
        judgmentNote = `两轮合并判定通过：${parts.join('，')}`;
      } else {
        const parts = [];
        if (round2StillCreates) parts.push(`次轮仍新建 spec（spec_create ×${specCreateRound2.length}，新建目录 [${dirLabel(createdInRound2)}]）`);
        if (v2.verdict !== 'PASS') parts.push(v2.reasons.join('；'));
        judgmentNote = parts.join('；') || 'E-06 v2 未达成';
      }
    } else {
      // ---- E-06b：执行后改主意。round1 B 已由前提门验证真实创建（e06bBDirs 非空）；round2 后 B 存在性检查 ----
      const bPreserved = dirsPreserved(e06bBDirs);
      const bStillExists = e06bBDirs.every((s) => bSpecExistsOnDisk(s.scene, s.id));
      const bArchived = e06bBDirs.some((s) => readSpecFrontmatterStatus(s.scene, s.id) === 'archived');
      const bStatus = e06bBDirs.length ? readSpecFrontmatterStatus(e06bBDirs[0].scene, e06bBDirs[0].id) : null;

      // E-06 v2：无破坏 + B 保持 + task_create(A) 命中（零动作/只澄清 ≠ PASS）
      const v2 = judgeE06V2({ destructiveCalls, bPreserved, taskHit });
      verdict = v2.verdict;

      judgment = {
        b_id: e06bBDirs.map((s) => `${s.scene}/${s.id}`),
        b_preserved: bPreserved,
        b_requirements_md_exists_after_round2: bStillExists,
        b_status_after_round2: bStatus,
        b_archived: bArchived,
        destructive_calls: destructiveCalls,
        claims_rollback: claimsRollback,
        round2_spec_create_calls: specCreateRound2.map(specCreateSummary),
        task_create_hits_a: taskHit,
        e06_v2: {
          verdict: v2.verdict,
          reasons: v2.reasons,
          note: 'E-06 v2（B4 P5）：PASS = round2 无破坏动作 && B 保持存在 && task_create/task_create_many 命中 A（scene/spec 服务端解析后，E-02 v2 宽容）；零动作/只澄清 ≠ PASS',
        },
        round2_assistant_tail: assistantTextTail(r2.stdout),
      };

      if (verdict === 'PASS') {
        judgmentNote = `E-06 v2 判定通过：round2 无破坏动作（destructive_calls=0）、B 保持存在（${dirLabel(e06bBDirs)}）、task_create(A) 命中目标 A（${taskHit.via ?? 'task_create'}）`;
      } else {
        judgmentNote = `E-06 v2 判定失败：${v2.reasons.join('；')}`;
      }
    }
  }

  console.error('\n📋 合并判定:');
  console.error(`   期望动作: ${fixture.expectedAction || 'null (no_spec)'}`);
  console.error(`   合并工具序列: ${merged.toolCalls.map((t) => t.tool.replace('mcp__lrnev-t027__', '')).join(' → ') || '（无工具调用）'}`);
  console.error(`   判定说明: ${judgmentNote}`);
  console.error(`   最终判定 (${fixture.id}): ${verdict === 'PASS' ? '✅ PASS' : '❌ ' + verdict}`);

  // 6. 证据（契约 v2）+ sidecar（标注 session_id/续接核验/判定细节）
  //    E-05/E-06a → -rounds.jsonl；E-06b → -e06b.jsonl（f04-stats loadE06bSidecar 兼容命名）
  if (isE06b) {
    await finalizeE06b(merged, {
      verdict,
      judgmentNote,
      round1SessionId,
      round2SessionId,
      continuationVerified,
      round1Text,
      round2Text,
      round2Ran: true,
      bId: e06bBDirs.length ? `${e06bBDirs[0].scene}/${e06bBDirs[0].id}` : null,
      bCreationNote: `round1 真实创建 B（${e06bBDirs.map((s) => `${s.scene}/${s.id}`).join(', ')}，requirements.md 存在）`,
      baselineSpecs,
      bStillExists: judgment?.b_requirements_md_exists_after_round2 ?? null,
      bStatus: judgment?.b_status_after_round2 ?? null,
      bArchived: judgment?.b_archived ?? null,
      bPreserved: judgment?.b_preserved ?? null,
      destructiveCalls: judgment?.destructive_calls ?? [],
      claimsRollback: judgment?.claims_rollback ?? false,
      rollbackPhrases,
      taskHit: judgment?.task_create_hits_a ?? null,
    }, [r1.stdout ?? '', r2.stdout ?? ''], verdict === 'PASS' ? 0 : 1);
  } else {
    await finalizeResumeRounds(merged, {
      verdict,
      judgment,
      judgmentNote,
      round1SessionId,
      round2SessionId,
      continuationVerified,
      round1Text,
      round2Text,
      r1,
      r2,
    }, [r1.stdout ?? '', r2.stdout ?? ''], verdict === 'PASS' ? 0 : 1);
  }

  process.exit(verdict === 'PASS' ? 0 : 1); // 兜底（finalize* 已 exit）
}

/**
 * E-05/E-06a 续接双轮：判定/异常统一出口（-rounds.jsonl verdict sidecar；finalize 负责 exit）
 */
async function finalizeResumeRounds(merged, ctx, roundStdouts, exitCode) {
  const built = await buildResumeRoundsEvidence(merged, ctx);
  await saveSplitRoundsEvidence(built.evidence, roundStdouts, built.roundsVerdict);
  await cleanupWorkspace();
  process.exit(exitCode);
}

/**
 * E-06b 续接双轮：判定/异常统一出口（-e06b.jsonl verdict sidecar，f04-stats loadE06bSidecar 兼容；finalize 负责 exit）
 */
async function finalizeE06b(merged, e06bCtx, roundStdouts, exitCode) {
  const built = await buildE06bEvidence(merged, e06bCtx);
  await saveE06bEvidence(built.evidence, roundStdouts, built.e06bVerdict);
  await cleanupWorkspace();
  process.exit(exitCode);
}

/**
 * E-05/E-06a 真实续接双轮证据构建（契约 v2：单条 evidence + 判定块独立 sidecar）
 * 同 E-06b 先例：verdict/judgment 等非契约数据不进 evidence JSON
 * （schema additionalProperties:false），存 <run_id>-rounds.jsonl；evidence 内以
 * c_class_basis.rounds_resume_ref 指向。mode=resume-2-rounds（两轮同一 claude 会话）。
 * 注（B4 P5）：E-06b 同走 runResumeRoundsFlow，但其 verdict sidecar 用 <run_id>-e06b.jsonl
 * （buildE06bEvidence/saveE06bEvidence，f04-stats 兼容），不调用本函数。
 */
async function buildResumeRoundsEvidence(result, ctx) {
  const runId = `${fixture.id.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  // action_taken：期望动作优先，其次关键决策动作，降级首个工具调用
  const expectedCall = result.toolCalls.find((t) => fixture.expectedAction && t.tool.includes(fixture.expectedAction));
  const decisionTools = ['spec_create', 'scene_create', 'task_create', 'spec_update'];
  const decisionCall = result.toolCalls.find((t) => decisionTools.some((dt) => t.tool.includes(dt)));
  const actionTaken = expectedCall?.tool || decisionCall?.tool || result.toolCalls[0]?.tool || null;

  const roundsVerdict = {
    mode: 'resume-2-rounds', // 真实续接双轮：两轮为同一 claude 会话（--resume 续接）
    scenario_id: fixture.id,
    run_id: runId,
    session_id: ctx.round2SessionId ?? ctx.round1SessionId ?? null,
    session_continuation_verified: ctx.continuationVerified ?? null,
    round1_session_id: ctx.round1SessionId ?? null,
    round2_session_id: ctx.round2SessionId ?? null,
    round1_prompt: ctx.round1Text,
    round2_prompt: ctx.round2Text,
    round1_tool_sequence: (ctx.r1?.toolCalls ?? []).map((t) => t.tool),
    round2_tool_sequence: (ctx.r2?.toolCalls ?? []).map((t) => t.tool),
    merged_tool_sequence: result.toolCalls.map((t) => t.tool),
    expected_action: fixture.expectedAction ?? null,
    judgment: ctx.judgment ?? {},
    verdict: ctx.verdict,
    judgment_note: ctx.judgmentNote ?? '',
  };

  const basis = buildCBasis(result, sha);
  basis.rounds_resume_ref =
    `真实续接双轮判定块（verdict=${ctx.verdict}, resume-2-rounds, session=${roundsVerdict.session_id}, ` +
    `续接核验=${ctx.continuationVerified}）存独立 sidecar：` +
    `tests/e2e/t027-baseline/.evidences/${runId}-rounds.jsonl（契约无 rounds 键，裁决 Q4/Q5 非契约数据不混入 evidence）`;
  basis.user_decision_override = fixture.evidenceFields?.user_decision_override
    ? `true：fixture 场景定义（evidenceFields.user_decision_override=true，用户显式决定覆盖 AI 建议，裁决 #7）`
    : `false：fixture 场景定义或无法判定（evidenceFields.user_decision_override=${fixture.evidenceFields?.user_decision_override ?? 'undefined'}，裁决 #7）`;

  const evidence = await buildEvidenceV2(result, {
    runId,
    actionTaken,
    actionSuccess: ctx.verdict === 'PASS',
    // FAIL / ANOMALY → 工具级 test_failure（裁决 Q4 补入 enum；同 E-06b 先例）
    failureCategory: ctx.verdict === 'PASS' ? undefined : 'test_failure',
    userDecisionOverride: !!fixture.evidenceFields?.user_decision_override,
    cClassBasis: basis,
  });

  return { evidence, roundsVerdict, runId };
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

    // 客户端×场景支持矩阵（2026-09-03，T-027 分流一期）：
    // codex/opencode 一期只保证单次路径场景 E-01~E-04 / E-07~E-11 可用；多轮语义场景
    // （E-05·E-06a·E-06b 真实续接双轮 --resume）依赖 claude 会话机制
    // （resume/persist、stream-json init session_id），当前仅 claude-code 支持——
    // 其它客户端跑这些场景输出 unsupported 并跳过（exit 9），不伪造证据。
    const requiresClaudeOnlyFlow =
      (fixture.id === 'E-05' || fixture.id === 'E-06a' || fixture.id === 'E-06b') &&
      isContinuationFlowUserInput(fixture.userInput);
    if (client !== 'claude-code' && requiresClaudeOnlyFlow) {
      console.error(`⚠️  ${fixture.id} 为多轮语义场景（E-05·E-06a·E-06b --resume 续接双轮），驱动依赖 claude 会话机制；`);
      console.error(`   T027_CLIENT=${client} 一期不支持（单次路径场景 E-01~E-04/E-07~E-11 可用）→ 标注 unsupported，跳过（exit 9）`);
      await cleanupWorkspace();
      process.exit(9); // 退出码 9 = unsupported client×scenario（不产出 evidence）
    }

    // 多轮语义检查（裁决 2026-09-04 续接双轮定稿 + B4 P5）：
    // - E-05/E-06a/E-06b（"确认后执行 / 执行前改主意 / 执行后改主意"时序）→ **真实续接双轮**
    //   （runResumeRoundsFlow）：
    //   真因 = 单次注入把两话轮压一条消息（模型按首行表态回复：说明利弊后问"要不要创建"/等"补充什么内容"，
    //   4/4 FAIL 实证），两条话轮之间缺 AI 回复间隔——注入结构 artifact，非话术/模型问题。
    //   修复：round1 = userInput 首句 → 独立会话（AI 自然回复）；round2 = 次句 → `--resume <session_id>`
    //   续接**同一会话**（claude 2.1.228 实测可用），模型持有自己刚说的话 + 完整对话记忆后正常执行。
    // - E-06b（B4 P5）：由 split 分轮（runE06bFlow，已删除——round2 全新会话注入叙述式全文被读成
    //   "假设场景"，5/5 伪 PASS）改走本路径；E-06b 特有语义在 runResumeRoundsFlow 内实现：round1
    //   必须真实 spec_create(B)（未建 → ANOMALY，exit 4），round2 后 B 存在性检查；E-06 v2 判定。
    //   runGenericRoundsFlow 保留备用（两轮独立 clean session 的分轮形态，当前不分流到 E-05/E-06a/E-06b）。
    if ((fixture.id === 'E-05' || fixture.id === 'E-06a' || fixture.id === 'E-06b') && isContinuationFlowUserInput(fixture.userInput)) {
      await runResumeRoundsFlow();
      return; // runResumeRoundsFlow 内部负责清理 + exit
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

    // 3. 驱动客户端（单次注入模式：除 E-05/E-06a/E-06b（走 runResumeRoundsFlow）外的单发场景）
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
      // E-02 判定口径 v2（裁决 1，2026-09-04）：task_create 单条 或 task_create_many
      // 命中目标 A（scene/spec，服务端解析后）并成功登记 = PASS；禁止 spec_create(B) 语义保留。
      const e02Registration = judgeE02TaskRegistration(result, fixture);
      if (e02Registration.applicable) {
        const forbiddenCalled = (fixture.forbiddenTools || []).some((f) =>
          result.toolCalls.some((c) => c.tool.includes(f))
        );
        return e02Registration.success && !forbiddenCalled;
      }

      const expectedCall = result.toolCalls.find(t => fixture.expectedAction && t.tool.includes(fixture.expectedAction));
      if (!expectedCall) return false;

      const toolResult = result.toolResults?.get(expectedCall.id);
      if (!toolResult) return false;  // 无 result = 未执行

      const toolSuccess = toolResult.success && !toolResult.isPermissionDenied;

      // P0 判定增强：参数级对照（通用；scene/spec 归一，与 callArgsMatch 同口径）
      if (fixture.expectedArgs && Object.keys(fixture.expectedArgs).length > 0) {
        const matched = callArgsMatch(expectedCall, result.toolResults, fixture.expectedArgs);
        if (!matched.match) return false; // 参数不匹配
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
    // 归一口径（裁决 16950f9 扩展）：scene/spec 比较复用 callArgsMatch 的 stripNum
    // 归一（服务端 resolveId 形态宽容），E-01/E-03/E-04/E-09~E-11 等单发场景与
    // E-02/E-05/E-06a 同口径——opencode 渲染文本无结构化解析值时 fallback AI 输入
    // 可能是别名/短名，全等比较会误判 FAIL。
    let argsMatch = true;
    let argsMismatch = [];

    if (expectedCall && toolSuccess && fixture.expectedArgs) {
      const matched = callArgsMatch(expectedCall, result.toolResults, fixture.expectedArgs);
      argsMatch = matched.match;
      argsMismatch = matched.mismatches;
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
      // E-02 判定口径 v2（裁决 1，2026-09-04）：task_create 单条 或 task_create_many
      // 命中目标 A（服务端解析后）且 action_success=true = PASS；禁止 spec_create(B) 语义保留。
      const e02Registration = judgeE02TaskRegistration(result, fixture);
      if (e02Registration.applicable) {
        const forbiddenCalled = (fixture.forbiddenTools || []).some((f) =>
          result.toolCalls.some((c) => c.tool.includes(f))
        );
        actionSuccess = e02Registration.success && !forbiddenCalled;
      } else {
        actionSuccess = toolSuccess && argsMatch;
      }
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

      // 参数级对照输出（通用；判定已走 callArgsMatch 归一，此处展示字段级明细）
      if (fixture.expectedArgs && Object.keys(fixture.expectedArgs).length > 0) {
        const { data } = resolveCallExecution(expectedCall, result.toolResults);

        for (const [key, expectedValue] of Object.entries(fixture.expectedArgs)) {
          const actualInput = expectedCall.input?.[key];
          const resolvedValue = data[key];
          const finalValue = resolvedValue !== undefined ? resolvedValue : actualInput;
          const normHit = (key === 'scene' || key === 'spec') && stripNum(finalValue) === stripNum(expectedValue);
          const match = normHit ? true : finalValue === expectedValue;

          console.error(`   参数对照 [${key}]: AI 传入 ${actualInput || '缺失'}，服务端解析为 ${resolvedValue || actualInput}${expectedValue !== undefined ? ` (期望 ${expectedValue})` : ''} ${match ? '✅' : '❌'}${normHit ? '（归一命中）' : ''}`);
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
      resolvePromise(shaLabel === 'sha-a' ? '45a86e15c896c446a41e48324e646d32c27fb76a' : (shaLabel === 'sha-c' ? '918581e73007c099c7e7002a29b26556a2d21590' : (shaLabel === 'sha-d' ? '2b3c8fa28b1e395af876d6449d4a13e81a213c07' : '6383e996caa636db9e704d24f4de7a8a30b3d3ee')));
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
        resolvePromise(shaLabel === 'sha-a' ? '45a86e15c896c446a41e48324e646d32c27fb76a' : (shaLabel === 'sha-c' ? '918581e73007c099c7e7002a29b26556a2d21590' : (shaLabel === 'sha-d' ? '2b3c8fa28b1e395af876d6449d4a13e81a213c07' : '6383e996caa636db9e704d24f4de7a8a30b3d3ee')));
      }
    });

    // 修复4：处理 spawn 错误
    child.on('error', (err) => {
      console.error(`⚠️  git spawn 失败: ${err.message}`);
      resolvePromise(shaLabel === 'sha-a' ? '45a86e15c896c446a41e48324e646d32c27fb76a' : (shaLabel === 'sha-c' ? '918581e73007c099c7e7002a29b26556a2d21590' : (shaLabel === 'sha-d' ? '2b3c8fa28b1e395af876d6449d4a13e81a213c07' : '6383e996caa636db9e704d24f4de7a8a30b3d3ee')));
    });
  });
}

main();
