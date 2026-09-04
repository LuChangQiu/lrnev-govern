#!/usr/bin/env node
/**
 * T-027 harness 客户端驱动（独立文件，2026-09-03）
 *
 * 设计约束（DeepSeek 定）：客户端驱动逻辑全部收在本文件，harness-mvp.mjs 只做
 * 最小引用/分流（T027_CLIENT env: claude-code|codex|opencode，默认 claude-code；
 * claude 路径留在 harness 主文件，本文件只提供 codex / opencode 驱动）。
 *
 * 接入依据（权威）：tests/e2e/t027-baseline 调研实测报告
 *   - codex-t027-report.md  （Codex CLI 0.150.0：CODEX_HOME 隔离、config.toml、
 *     codex exec --json --skip-git-repo-check -C <cwd> <prompt>、item.completed
 *     mcp_tool_call server/tool 两字段、429 退避、推荐配置片段 §7）
 *   - opencode-t027-report.md（OpenCode 1.18.18：XDG 三重定向 + OPENCODE_CONFIG、
 *     opencode.json mcp map、opencode run --model deepseek/deepseek-v4-flash
 *     --format json --pure、tool_use part.tool=<server>_<tool>、permission allow、
 *     DEEPSEEK_API_KEY 走 env）
 *
 * 统一返回结构（与 harness driveClient(claude) 同构，供证据/判定零改动消费）：
 * {
 *   code,            // 客户端进程退出码（429 退避重试后仍失败为最终 code）
 *   stdout,          // 完整 stdout（JSONL 事件流 → evidence <run_id>-session.jsonl）
 *   stderr,
 *   toolCalls: [{ tool:'mcp__lrnev-t027__<tool>', input:{}, id }],   // 归一化
 *   toolResults: Map<id, { success, content:[{type:'text',text}], isPermissionDenied }>,
 *   initEvent: { // 供 extractInitFields/buildCBasis 消费（含驱动自报纯净口径）
 *     client, client_version, claude_code_version(别名,同值), model,
 *     session_id, tools, sessionClean, toolsTotal, t027Tools,
 *     releaseLrnevTools, purityNote, usage, ... },
 *   clientMeta: { client, version, model, usage, isolationDirs, retries }
 * }
 *
 * 纪律：~/.codex、~/.claude、全局 opencode 配置只读（隔离用复制）；隔离目录放
 * 系统 temp（os.tmpdir()），驱动 finally 清理，失败仅告警不阻断。
 */

import { spawn } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { resolve } from 'node:path';

function writeFileSyncSafe(path, content) {
  writeFileSync(path, content, 'utf8');
}

// ---------------------------------------------------------------------------
// 版本常量（来源注明：2026-09-03 本机实测 codex --version → codex-cli 0.150.0、
// opencode --version → 1.18.18；接入报告同值。可用 T027_CODEX_VERSION /
// T027_OPENCODE_VERSION 覆盖，避免未来版本漂移污染 evidence client_version）
// ---------------------------------------------------------------------------
export const CLIENT_VERSIONS = {
  codex: process.env.T027_CODEX_VERSION || '0.150.0',
  opencode: process.env.T027_OPENCODE_VERSION || '1.18.18',
};

export const SUPPORTED_CLIENTS = ['codex', 'opencode'];

// codex 模型目录常量（cc-switch-model-catalog.json 需随 auth.json 一起复制进隔离 home）
const CODEX_CATALOG_FILENAME = 'cc-switch-model-catalog.json';

// ---------------------------------------------------------------------------
// 小工具
// ---------------------------------------------------------------------------

/** Windows 下 node 绝对路径统一转正斜杠（TOML/JSON 配置最稳，报告 §坑） */
function toPosix(p) {
  return p.replace(/\\/g, '/');
}

/** 随机串（隔离目录名） */
function rand() {
  return Math.random().toString(36).slice(2, 10);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** 健壮删除（Windows 句柄释放重试；尽力而为，失败告警不抛） */
function removeDirRobust(target, label) {
  if (!target || !existsSync(target)) return;
  const MAX_ATTEMPTS = 8;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      rmSync(target, { recursive: true, force: true });
      return;
    } catch (err) {
      if (attempt >= MAX_ATTEMPTS) {
        console.error(`   ⚠️  ${label} 清理失败（已重试 ${MAX_ATTEMPTS} 次）: ${target} → ${err.message}`);
        return;
      }
      try {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500 * attempt);
      } catch { /* 忽略 */ }
    }
  }
}

/** 从 npm 全局 bin（PATH 目录下 node_modules 包）解析真实可执行入口 */
function findNpmBin(relPath) {
  const dirs = (process.env.PATH || '').split(';').map((d) => d.trim()).filter(Boolean);
  for (const d of dirs) {
    const p = resolve(d, relPath);
    if (existsSync(p)) return p;
  }
  return null;
}

let _codexJs = null;
function codexCliPath() {
  if (_codexJs) return _codexJs;
  _codexJs =
    findNpmBin('node_modules/@openai/codex/bin/codex.js') ||
    (process.env.APPDATA
      ? resolve(process.env.APPDATA, 'npm/node_modules/@openai/codex/bin/codex.js')
      : null);
  return _codexJs;
}

let _opencodeExe = null;
function opencodeExePath() {
  if (_opencodeExe) return _opencodeExe;
  _opencodeExe =
    findNpmBin('node_modules/opencode-ai/bin/opencode.exe') ||
    (process.env.APPDATA
      ? resolve(process.env.APPDATA, 'npm/node_modules/opencode-ai/bin/opencode.exe')
      : null);
  return _opencodeExe;
}

/**
 * 单次进程运行：spawn + 收 stdout/stderr + exit code（超时 kill）。
 * 不用 shell（shell:false + 真实可执行入口）→ argv 原样传递，规避 cmd 引号解析
 * 对含中文 prompt 的改写（claude 路径走 stdin 的原因在 codex/opencode 不适用：
 * 两者 prompt 必须经 argv，报告实测）。
 */
function runProcess({ cmd, args, cwd, env, label, timeoutMs }) {
  return new Promise((resolvePromise, reject) => {
    let child;
    try {
      child = spawn(cmd, args, {
        cwd,
        env,
        shell: false,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err) {
      reject(new Error(`${label} spawn 失败: ${err.message}`));
      return;
    }

    let stdout = '';
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { child.kill(); } catch { /* 已退出 */ }
      resolvePromise({ code: null, stdout, stderr, timedOut: true, label });
    }, timeoutMs);

    child.stdin?.end(); // prompt 已走 argv；stdin 立即 EOF，避免 codex/opencode 等待

    child.stdout?.on('data', (d) => { stdout += d.toString(); });
    child.stderr?.on('data', (d) => { stderr += d.toString(); });

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`${label} 进程错误: ${err.message}`));
    });

    child.on('exit', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolvePromise({ code, stdout, stderr, timedOut: false, label });
    });
  });
}

const RATE_LIMIT_RE = /429|too many requests|rate limit/i;

/** 环境变量里的 LRNEV 注入（wrapper → MCP server 继承）：每 session 锁 SHA + 工作区 */
function buildBaseEnv(sha, workspace) {
  return {
    ...process.env,
    T027_SHA: sha,
    LRNEV_WORKSPACE: workspace,
  };
}

/** MCP wrapper 绝对路径（入库 wrapper.mjs，config 里指向它启动 server） */
function wrapperPathFor(projectRoot) {
  return resolve(projectRoot, 'tests/e2e/t027-baseline/wrapper.mjs');
}

/** 从事件文本中提取 tool 文本（content 数组拼接 / text 字段兜底） */
function extractContentText(result) {
  if (!result) return '';
  if (Array.isArray(result.content)) {
    const parts = result.content
      .map((c) => (c && typeof c.text === 'string' ? c.text : ''))
      .filter(Boolean);
    if (parts.length > 0) return parts.join('\n');
  }
  if (typeof result.text === 'string') return result.text;
  return '';
}

/**
 * 构造与 claude 路径同构的结果对象（含驱动自报纯净口径）。
 * @param {object} p { code, stdout, stderr, toolCalls, toolResults, client,
 *   clientVersion, model, sessionId, purity: { sessionClean, serversObserved,
 *   normalizedTools, note }, usage, isolationDirs, retries }
 */
function buildResultShape(p) {
  const normalizedTools = p.purity.normalizedTools; // 归一化 mcp__<server>__<tool> 列表
  const releaseLrnevTools = normalizedTools.filter((t) => String(t).startsWith('mcp__lrnev__')).length;
  const t027Tools = normalizedTools.filter((t) => String(t).startsWith('mcp__lrnev-t027__')).length;

  const initEvent = {
    type: 'system',
    subtype: 'init',
    // extractInitFields 兼容字段：client_version 驱动自报版本（claude_code_version
    // 别名刻意不设——避免 c_class_basis 误措辞为 claude_code_version 来源）
    client_version: p.clientVersion,
    model: p.model ?? null,
    session_id: p.sessionId ?? null,
    tools: normalizedTools,
    // 驱动自报纯净字段（extractInitFields 检测到 sessionClean 即走该口径，不再按工具前缀算）
    sessionClean: p.purity.sessionClean,
    toolsTotal: t027Tools,
    t027Tools,
    releaseLrnevTools,
    purityNote: p.purity.note,
    usage: p.usage ?? null,
  };

  return {
    code: p.code,
    stdout: p.stdout,
    stderr: p.stderr,
    toolCalls: p.toolCalls,
    toolResults: p.toolResults,
    initEvent,
    clientMeta: {
      client: p.client,
      version: p.clientVersion,
      model: p.model ?? null,
      sessionId: p.sessionId ?? null,
      usage: p.usage ?? null,
      isolationDirs: p.isolationDirs,
      retries: p.retries ?? 0,
      purityNote: p.purity.note,
    },
  };
}

// ===========================================================================
// Codex 分支
// ===========================================================================

const CODEX_CONFIG_HEAD = (opts) => `model_provider = "OpenAI"
model = "${opts.model}"
model_reasoning_effort = "none"
disable_response_storage = true
model_catalog_json = "${CODEX_CATALOG_FILENAME}"

[model_providers.OpenAI]
name = "OpenAI"
base_url = "${opts.baseUrl}"
wire_api = "responses"
requires_openai_auth = true
`;

const CODEX_MCP_TABLE = (wrapperPosix, nodePosix) => `[mcp_servers.lrnev-t027]
type = "stdio"
command = "${nodePosix}"
args = ["${wrapperPosix}"]
`;

/**
 * codex exec 单轮：隔离 CODEX_HOME → config.toml（§7 推荐片段）→ 复制 auth 与
 * 模型目录 → spawn `codex exec --json --skip-git-repo-check --sandbox
 * workspace-write -C <workspace> <prompt>` → 解析 JSONL 事件。
 * 429 检测：≥60s 退避重试 ≤2 次。
 */
async function driveCodex(prompt, ctx) {
  const client = 'codex';
  const version = CLIENT_VERSIONS.codex;
  const model = process.env.T027_CODEX_MODEL || 'gpt-5.5'; // 目录内最省成本档（报告 §6.1）
  const baseUrl = process.env.T027_CODEX_BASE_URL || 'https://xuseny.online';

  const cliJs = codexCliPath();
  if (!cliJs) {
    throw new Error(
      'codex CLI 未找到：node_modules/@openai/codex/bin/codex.js 不在 PATH/npm 全局目录（Get-Command codex 检查）'
    );
  }

  // 1. 隔离 CODEX_HOME（系统 temp；报告实测该位置会打印无害 PATH-alias 警告）
  const codexHome = resolve(tmpdir(), `t027-codex-${Date.now()}-${rand()}`);
  mkdirSync(codexHome, { recursive: true });

  // 2. 复制认证 + 模型目录（只读复制，~/.codex 不改）
  const userCodexDir = resolve(homedir(), '.codex');
  const copied = [];
  for (const f of ['auth.json', CODEX_CATALOG_FILENAME]) {
    const src = resolve(userCodexDir, f);
    if (existsSync(src)) {
      copyFileSync(src, resolve(codexHome, f));
      copied.push(f);
    }
  }
  if (!copied.includes('auth.json')) {
    console.error('   ⚠️  ~/.codex/auth.json 不存在——codex 将 Not logged in（隔离 home 无凭据）');
  }
  if (!copied.includes(CODEX_CATALOG_FILENAME)) {
    console.error(`   ⚠️  ~/.codex/${CODEX_CATALOG_FILENAME} 不存在——模型目录缺失`);
  }

  // 3. config.toml（§7 推荐片段 + wrapper 绝对路径）
  const wrapperAbs = wrapperPathFor(ctx.projectRoot);
  const configToml =
    CODEX_CONFIG_HEAD({ model, baseUrl }) +
    CODEX_MCP_TABLE(toPosix(wrapperAbs), toPosix(process.execPath));
  writeFileSyncSafe(resolve(codexHome, 'config.toml'), configToml);

  console.error('   [codex] 隔离 CODEX_HOME: ' + codexHome);
  console.error(`   [codex] model=${model} base_url=${baseUrl}（T027_CODEX_MODEL/T027_CODEX_BASE_URL 可覆盖）`);
  console.error(`   [codex] 复制到隔离 home: ${copied.join(', ')}`);

  const env = {
    ...buildBaseEnv(ctx.sha, ctx.tempWorkspace),
    CODEX_HOME: codexHome,
  };
  // 环境变量若带其它 OPENAI key 会覆盖 auth.json——隔离口径以 auth.json 为准，剔除
  delete env.OPENAI_API_KEY;

  const args = [
    'exec',
    '--json',
    '--skip-git-repo-check',
    '--sandbox', 'workspace-write', // 工作区内写放行（对齐 claude 的 Edit/Write allowedTools）
    '-C', ctx.tempWorkspace,
    prompt, // prompt 经 argv（codex exec 实测形态）
  ];

  // 4. 执行 + 429 退避重试（≥60s × ≤2 次）
  const timeoutMs = Number(process.env.T027_CLIENT_TIMEOUT_MS || 600000);
  let lastRes = null;
  let attempts = 0;
  for (attempts = 1; attempts <= 3; attempts++) {
    if (attempts > 1) console.error(`   [codex] 第 ${attempts}/3 次尝试...`);
    const res = await runProcess({
      cmd: process.execPath,
      args: [cliJs, ...args],
      cwd: ctx.tempWorkspace,
      env,
      label: 'codex exec',
      timeoutMs,
    });
    lastRes = res;
    if (res.timedOut) {
      console.error('   [codex] ⚠️  超时被终止（T027_CLIENT_TIMEOUT_MS 可调，默认 600s）');
      break;
    }
    const combined = `${res.stdout}\n${res.stderr}`;
    const isRateLimited = res.code !== 0 && RATE_LIMIT_RE.test(combined);
    if (isRateLimited && attempts < 3) {
      console.error('   [codex] ⚠️  检测到 429/Too Many Requests（共享 gateway 限流）→ 退避 60s 后重试');
      await sleep(60000);
      continue;
    }
    break;
  }

  // 5. 解析 JSONL 事件
  const parsed = parseCodexEvents(lastRes.stdout);
  const serversObserved = parsed.serversObserved;
  const pollution = [...serversObserved].filter((s) => s !== 'lrnev-t027');
  const sessionClean = pollution.length === 0 && parsed.releaseNames === 0;
  const note =
    `codex（${version}）口径：CODEX_HOME 隔离仅注册 lrnev-t027（config.toml mcp_servers 仅一项）` +
    ` + exec 事件流 mcp_tool_call server 全集 ${JSON.stringify([...serversObserved])}` +
    (pollution.length ? `（⚠️ 非 lrnev-t027 server: ${pollution.join(', ')}）` : '（发布版 mcp__lrnev 未出现）') +
    `；tools 列表=会话观测到的 MCP 工具归一化名 ${parsed.tools.length} 个（codex 客户端不枚举全部工具，非完整清单）`;

  console.error(`   [codex] mcp_tool_call server 观测: ${JSON.stringify([...serversObserved])}`);
  console.error(`   [codex] 工具调用: ${parsed.toolCalls.map((t) => t.tool).join(', ') || '（无 MCP 工具调用）'}`);
  console.error(`   [codex] usage: ${JSON.stringify(parsed.usage)}`);
  if (parsed.errors.length) {
    console.error(`   [codex] 事件流错误: ${parsed.errors.join(' | ').slice(0, 500)}`);
  }

  try {
    return buildResultShape({
      code: lastRes.code,
      stdout: lastRes.stdout,
      stderr: lastRes.stderr,
      toolCalls: parsed.toolCalls,
      toolResults: parsed.toolResults,
      client,
      clientVersion: version,
      model,
      sessionId: null, // codex exec 无会话 id 事件（干净会话语义由每次全新调用保证）
      purity: { sessionClean, normalizedTools: parsed.tools, note },
      usage: parsed.usage,
      isolationDirs: [codexHome],
      retries: attempts - 1,
    });
  } finally {
    removeDirRobust(codexHome, 'codex 隔离 home');
  }
}

/** codex --json JSONL 事件解析（item.completed mcp_tool_call / agent_message / turn.completed / error） */
function parseCodexEvents(stdout) {
  const toolCalls = [];
  const toolResults = new Map();
  const agentTexts = [];
  const errors = [];
  const serversObserved = new Set();
  const normalizedTools = [];
  const toolsSeen = new Set();
  const usage = { input_tokens: 0, cached_input_tokens: 0, output_tokens: 0, reasoning_output_tokens: 0 };
  let releaseNames = 0;

  for (const rawLine of stdout.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    let e;
    try {
      e = JSON.parse(line);
    } catch {
      continue; // 忽略非 JSON 行（--json 事件全在 stdout，stderr 混入不影响）
    }
    if (!e || typeof e !== 'object') continue;

    if (e.type === 'item.completed') {
      const item = e.item ?? {};
      if (item.type === 'mcp_tool_call') {
        const server = String(item.server ?? '').trim();
        const tool = String(item.tool ?? '').trim();
        if (server) serversObserved.add(server);
        if (!tool) continue;
        // 归一化：server+tool 两字段 → 'mcp__<server>__<tool>'（与 claude 工具名同构）
        const normTool = `mcp__${server || 'unknown'}__${tool}`;
        if (!toolsSeen.has(normTool)) {
          toolsSeen.add(normTool);
          normalizedTools.push(normTool);
        }
        if (normTool.startsWith('mcp__lrnev__')) releaseNames++;
        const id = String(item.id ?? `codex-mcp-${toolCalls.length}`);
        const completed = item.status === 'completed' && item.result?.isError !== true;
        const denied =
          !completed &&
          /permission|not granted|approval|denied/i.test(JSON.stringify(item.result ?? item.error ?? ''));
        // content：structured_content 优先（含 data 的结构化载荷，供参数级对照 JSON.parse）；
        // 缺失时用文本内容兜底
        let contentText = '';
        try {
          const sc = item.result?.structured_content ?? item.result?.structuredContent;
          contentText = sc !== undefined ? JSON.stringify(sc) : extractContentText(item.result);
        } catch {
          contentText = extractContentText(item.result);
        }
        toolCalls.push({
          tool: normTool,
          input: (item.arguments ?? item.input ?? {}),
          id,
          client: 'codex',
          rawServer: server,
        });
        toolResults.set(id, {
          success: completed,
          content: [{ type: 'text', text: contentText }],
          isPermissionDenied: denied,
        });
      } else if (item.type === 'agent_message' && typeof item.text === 'string') {
        agentTexts.push(item.text);
      }
    } else if (e.type === 'turn.completed' && e.usage && typeof e.usage === 'object') {
      for (const k of ['input_tokens', 'cached_input_tokens', 'output_tokens', 'reasoning_output_tokens']) {
        const v = Number(e.usage[k]);
        if (Number.isFinite(v) && v > 0) usage[k] = (usage[k] || 0) + v;
      }
    } else if ((e.type === 'error' || e.type === 'turn.failed') && e.message) {
      errors.push(String(e.message));
    }
  }

  return { toolCalls, toolResults, agentTexts, errors, serversObserved, tools: normalizedTools, releaseNames, usage };
}

// ===========================================================================
// OpenCode 分支
// ===========================================================================

/**
 * opencode run 单轮：XDG_CONFIG/DATA/CACHE_HOME 三重定向 + OPENCODE_CONFIG 指向
 * 隔离 opencode.json（仅注册 lrnev-t027 wrapper）→ env 注入 DEEPSEEK_API_KEY
 * （优先 process.env，其次 .claude/t027-runtime-env.ps1）→ spawn
 * `opencode run --model deepseek/deepseek-v4-flash --format json --pure <prompt>`
 * （cwd=workspace）→ 解析 JSONL 事件。
 */
async function driveOpencode(prompt, ctx) {
  const client = 'opencode';
  const version = CLIENT_VERSIONS.opencode;
  const model = process.env.T027_OPENCODE_MODEL || 'deepseek/deepseek-v4-flash';

  const exe = opencodeExePath();
  if (!exe) {
    throw new Error(
      'opencode CLI 未找到：node_modules/opencode-ai/bin/opencode.exe 不在 PATH/npm 全局目录（Get-Command opencode 检查）'
    );
  }

  // 1. DEEPSEEK_API_KEY 来源：env 优先，其次 .claude/t027-runtime-env.ps1（gitignore 区）
  let apiKey = process.env.DEEPSEEK_API_KEY || null;
  if (!apiKey) {
    try {
      const ps1 = readFileSync(resolve(ctx.projectRoot, '.claude/t027-runtime-env.ps1'), 'utf8');
      const m = ps1.match(/DEEPSEEK_API_KEY\s*=\s*["']?([^"'\r\n]+)["']?/);
      apiKey = m ? m[1].trim() : null;
    } catch {
      apiKey = null;
    }
  }
  if (!apiKey) {
    throw new Error(
      'DEEPSEEK_API_KEY 缺失：未设置环境变量且 .claude/t027-runtime-env.ps1 无法读取。' +
      '（opencode 走 DeepSeek 官方 API，key 需经 env 注入，报告 §8 遗留点）'
    );
  }

  // 2. 隔离目录（XDG 三重定向；全局 ~/.config/opencode 不再加载）
  const ocRoot = resolve(tmpdir(), `t027-opencode-${Date.now()}-${rand()}`);
  const xdgConfig = resolve(ocRoot, 'config');
  const xdgData = resolve(ocRoot, 'data');
  const xdgCache = resolve(ocRoot, 'cache');
  for (const d of [xdgConfig, xdgData, xdgCache]) mkdirSync(d, { recursive: true });

  // 3. 隔离 opencode.json（对象式 mcp map + permission allow，报告 §8 推荐片段）
  const wrapperAbs = wrapperPathFor(ctx.projectRoot);
  const isolatedConfig = resolve(ocRoot, 'opencode-isolated.json');
  const opencodeJson = {
    $schema: 'https://opencode.ai/config.json',
    mcp: {
      'lrnev-t027': {
        type: 'local',
        command: [toPosix(process.execPath), toPosix(wrapperAbs)],
        enabled: true,
      },
    },
    // 仅隔离/一次性盲测环境；bash 显式 deny 收窄爆炸半径（工作区外写/执行）
    permission: { '*': 'allow', bash: 'deny' },
  };
  writeFileSyncSafe(isolatedConfig, JSON.stringify(opencodeJson, null, 2));

  console.error('   [opencode] 隔离根: ' + ocRoot);
  console.error(`   [opencode] model=${model}（T027_OPENCODE_MODEL 可覆盖）；key 来源: ${process.env.DEEPSEEK_API_KEY ? 'env' : '.claude/t027-runtime-env.ps1'}`);

  const env = {
    ...buildBaseEnv(ctx.sha, ctx.tempWorkspace),
    XDG_CONFIG_HOME: xdgConfig,
    XDG_DATA_HOME: xdgData,
    XDG_CACHE_HOME: xdgCache,
    OPENCODE_CONFIG: isolatedConfig,
    DEEPSEEK_API_KEY: apiKey,
  };

  const args = ['run', '--model', model, '--format', 'json', '--pure', prompt];

  const timeoutMs = Number(process.env.T027_CLIENT_TIMEOUT_MS || 600000);
  const res = await runProcess({
    cmd: exe,
    args,
    cwd: ctx.tempWorkspace,
    env,
    label: 'opencode run',
    timeoutMs,
  });
  if (res.timedOut) {
    console.error('   [opencode] ⚠️  超时被终止（T027_CLIENT_TIMEOUT_MS 可调，默认 600s）');
  }

  // 4. 解析 JSONL 事件
  const parsed = parseOpencodeEvents(res.stdout);
  const sessionId = parsed.sessionId || sniffSessionId(`${res.stdout}\n${res.stderr}`) || null;
  const pollution = parsed.foreignMcpTools; // 形如 <server>_<tool> 但 server≠lrnev-t027 的调用
  const sessionClean = pollution.length === 0 && parsed.releaseNames === 0;
  const note =
    `opencode（${version}）口径：XDG_CONFIG/DATA/CACHE 重定向 + OPENCODE_CONFIG 隔离，` +
    `仅注册 lrnev-t027（config 无全局/项目级合并）` +
    (parsed.observedTools.length
      ? `；会话观测 MCP 工具 ${parsed.observedTools.join(', ')}` +
        (parsed.builtinTools.length ? `；内置工具（非 MCP）${parsed.builtinTools.join(', ')}` : '')
      : '；会话无 MCP 工具调用') +
    (pollution.length ? `（⚠️ 疑似非 t027 MCP: ${pollution.join(', ')}）` : '（发布版 mcp__lrnev 未出现）') +
    `；tools 列表=观测到的 MCP 工具归一化名（非完整枚举）`;

  console.error(`   [opencode] session_id: ${sessionId ?? '（无）'}`);
  console.error(`   [opencode] 工具调用: ${parsed.toolCalls.map((t) => t.tool).join(', ') || '（无 MCP 工具调用）'}`);
  if (parsed.builtinTools.length) {
    console.error(`   [opencode] 内置工具调用（非 MCP，纯净检查不计）: ${parsed.builtinTools.join(', ')}`);
  }
  console.error(`   [opencode] tokens: ${JSON.stringify(parsed.tokens)} cost: ${parsed.cost ?? '（无）'}`);

  try {
    return buildResultShape({
      code: res.code,
      stdout: res.stdout,
      stderr: res.stderr,
      toolCalls: parsed.toolCalls,
      toolResults: parsed.toolResults,
      client,
      clientVersion: version,
      model,
      sessionId,
      purity: { sessionClean, normalizedTools: parsed.tools, note },
      usage: { ...parsed.tokens, cost_usd: parsed.cost },
      isolationDirs: [ocRoot],
      retries: 0,
    });
  } finally {
    removeDirRobust(ocRoot, 'opencode 隔离目录');
  }
}

/** 拆 <server>_<tool>：server 取首个 '_' 之前（server 名可含 '-'，如 lrnev-t027） */
function splitMcpToolName(name) {
  const idx = name.indexOf('_');
  if (idx <= 0 || idx === name.length - 1) return null;
  const server = name.slice(0, idx);
  const tool = name.slice(idx + 1);
  if (!/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(server)) return null;
  return { server, tool };
}

/** opencode --format json JSONL 事件解析（tool_use 的 tool/status、text、step_finish tokens/cost） */
function parseOpencodeEvents(stdout) {
  const toolCalls = [];
  const toolResults = new Map();
  const texts = [];
  const observedTools = [];
  const builtinTools = [];
  const foreignMcpTools = [];
  const normalizedTools = [];
  const toolsSeen = new Set();
  const tokens = { input: 0, output: 0, cache: { read: 0 } };
  let cost = null;
  let releaseNames = 0;
  let sessionId = null;

  for (const rawLine of stdout.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    let e;
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    if (!e || typeof e !== 'object') continue;

    if (e.type === 'tool_use' && e.part && typeof e.part === 'object') {
      const part = e.part;
      const rawName = String(part.tool ?? '');
      if (!rawName) continue;
      const split = splitMcpToolName(rawName);
      const state = part.state ?? {};
      const input = state.input ?? {};
      const output = typeof state.output === 'string' ? state.output : '';
      const status = state.status ?? 'completed';
      const isError = status === 'error' || status === 'failed' || (e.error !== undefined);
      const denied = !isError && /permission|not allowed|not granted|denied/i.test(
        `${output} ${JSON.stringify(state.error ?? '')}`
      );

      if (split) {
        const { server, tool } = split;
        const normTool = `mcp__${server}__${tool}`;
        if (!toolsSeen.has(normTool)) {
          toolsSeen.add(normTool);
          normalizedTools.push(normTool);
        }
        if (normTool.startsWith('mcp__lrnev__')) releaseNames++;
        if (server === 'lrnev-t027') observedTools.push(rawName);
        else foreignMcpTools.push(rawName);
        const id = String(part.callID ?? `oc-mcp-${toolCalls.length}`);
        toolCalls.push({ tool: normTool, input, id, client: 'opencode', rawTool: rawName });
        toolResults.set(id, {
          success: !isError && !denied,
          content: [{ type: 'text', text: output }],
          isPermissionDenied: denied,
        });
      } else {
        // 内置工具（bash/edit/read/...，非 MCP）：不入 tool_sequence/纯净检查
        builtinTools.push(rawName);
        if (isError || denied) {
          // 无 MCP 语义，仅记录
        }
      }
    } else if (e.type === 'text' && e.part && typeof e.part.text === 'string') {
      texts.push(e.part.text);
    } else if (e.type === 'step_finish' && e.part) {
      const p = e.part;
      if (p.tokens && typeof p.tokens === 'object') {
        tokens.total = (tokens.total || 0) + Number(p.tokens.total || 0);
        tokens.input = (tokens.input || 0) + Number(p.tokens.input || 0);
        tokens.output = (tokens.output || 0) + Number(p.tokens.output || 0);
        const cRead = Number(p.tokens.cache?.read ?? p.tokens.cache ?? 0);
        if (Number.isFinite(cRead)) tokens.cache.read = (tokens.cache.read || 0) + cRead;
      }
      if (typeof p.cost === 'number') cost = (cost || 0) + p.cost;
    }
    // session id：事件内嵌/顶层任意位置扫描
    if (!sessionId) sessionId = sniffSessionId(line);
  }

  return { toolCalls, toolResults, texts, observedTools, builtinTools, foreignMcpTools, tools: normalizedTools, releaseNames, tokens, cost, sessionId };
}

/** 从任意文本扫描 opencode session id（ses_... 形式） */
function sniffSessionId(text) {
  if (!text) return null;
  const m = String(text).match(/ses_[A-Za-z0-9]+/);
  return m ? m[0] : null;
}

// ===========================================================================
// 统一入口
// ===========================================================================

/**
 * harness driveClient 分流入口（claude-code 分支留在 harness 主文件内不动）。
 *
 * @param {object} p {
 *   client: 'codex'|'opencode'（其它抛错）
 *   prompt: string
 *   options: { persist?, resumeSessionId? }（多轮续接仅 claude 支持；非 claude 打警告忽略）
 *   ctx: { projectRoot, tempWorkspace, tempConfigDir, sha }
 * }
 * @returns 统一结果对象（见文件头注释）
 */
export async function driveClientFor({ client, prompt, options = {}, ctx }) {
  const normClient = String(client || '').trim().toLowerCase();
  if (normClient === 'claude-code' || normClient === 'claude') {
    throw new Error('driveClientFor 不处理 claude-code：claude 驱动保留在 harness-mvp.mjs（零改动纪律）');
  }
  if (!SUPPORTED_CLIENTS.includes(normClient)) {
    throw new Error(`未知客户端 T027_CLIENT=${client}（支持: claude-code / ${SUPPORTED_CLIENTS.join(' / ')}）`);
  }
  if (options?.persist === true || options?.resumeSessionId) {
    console.error(`   ⚠️ [${normClient}] persist/resumeSessionId（续接双轮）仅 claude-code 支持——本客户端按单次 clean 调用处理，续接选项忽略`);
  }
  if (normClient === 'codex') return driveCodex(prompt, ctx);
  return driveOpencode(prompt, ctx);
}
