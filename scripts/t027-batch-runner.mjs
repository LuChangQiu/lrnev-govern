#!/usr/bin/env node
/**
 * T-027 放量批次 runner（clean sessions 自动化批次编排）
 * ======================================================
 * 扩量执行：数十至上百个 clean session（每 session 独立 claude -p 调用）的编排器。
 * 零依赖：仅 node 内置模块。
 *
 * 单 session 等价命令（每 session 由本 runner spawn，仓库根运行）：
 *   T027_SCENARIO=<id> T027_SHA=sha-a|sha-b npx tsx tests/e2e/t027-baseline/harness-mvp.mjs
 *   exit 0=PASS | 1=FAIL(数据) | 2=预检跳过 | 4=E-06b ANOMALY 类
 *
 * 每 session 环境注入：读取 ~/.claude/settings.json 的 env 字段
 * （ANTHROPIC_AUTH_TOKEN / ANTHROPIC_BASE_URL / ANTHROPIC_MODEL 等）→ 进程 env
 * （隔离 CLAUDE_CONFIG_DIR 不继承 settings.json，漏了会 "Not logged in"）。
 *
 * 每 session 处理：
 *   - exit ∈ {0,1,4} → 数据（PASS/FAIL/ANOMALY），不重试；
 *   - exit = 2 → SKIP（预检跳过，读 stderr 记原因）；
 *   - 其他/环境失败（认证/429/崩溃/超时/无证据）→ 退避重试 ≤2 次，仍败 → ENV-FAIL，继续下一 session；
 *   - session 后跑 validator strict：0 ERROR → VALID；ERROR → VALIDATION-FAIL —— 停下报告
 *     （evidence 格式问题应修代码而非继续）。
 * 成本：从新产 session JSONL 的 result 事件提取 total_cost_usd（无则按 usage tokens 估算）；
 *       累计超 --budget-usd → 停止。
 * 产物：.claude/t027-batch/<label>/（gitignore 区）：run.log、summary.json、sessions/<...>.stdout|stderr.log
 *
 * 用法示例：
 *   node scripts/t027-batch-runner.mjs --all --sha sha-a --reps 5 --budget-usd 50 --label claude-sha-a-full
 *   node scripts/t027-batch-runner.mjs --scenarios E-01,E-07 --sha sha-a --reps 2 --dry-run
 *   node scripts/t027-batch-runner.mjs --scenarios E-07 --sha sha-a --reps 1 --label claude-sha-a-selftest --budget-usd 0.5
 */

import { spawn, spawnSync } from 'node:child_process';
import { writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync, statSync, rmSync, renameSync } from 'node:fs';
import { resolve, dirname, basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

const HARNESS_REL = 'tests/e2e/t027-baseline/harness-mvp.mjs';
const DEFAULT_EVIDENCE_DIR = resolve(PROJECT_ROOT, 'tests/e2e/t027-baseline/.evidences');
const VALIDATOR_REL = 'scripts/validate-evidence-manifest.mjs';
const BATCH_ROOT = resolve(PROJECT_ROOT, '.claude', 't027-batch');

const ALL_SCENARIOS = ['E-01', 'E-02', 'E-03', 'E-04', 'E-05', 'E-06a', 'E-06b', 'E-07', 'E-08', 'E-09', 'E-10', 'E-11'];
const EXPECTED_GIT_SHA = {
  'sha-a': '45a86e15c896c446a41e48324e646d32c27fb76a',
  'sha-b': '6383e996caa636db9e704d24f4de7a8a30b3d3ee',
};
const DATA_EXITS = new Set([0, 1, 4]);
const SKIP_EXIT = 2;
const RETRY_MAX_ATTEMPTS = 3;            // 首次 + ≤2 次退避重试
const RETRY_BASE_BACKOFF_MS = 60000;     // ≥60s
const ATTEMPT_TIMEOUT_MS = 900000;       // 15 min/attempt（E-01 s4 曾 ~5min API）
const STDIO_CAP = 8 * 1024 * 1024;       // 单流存档上限，防内存失控

const COST_RATES = { input: 3e-6, output: 15e-6, cacheRead: 0.3e-6, cacheWrite: 3.75e-6 }; // rough 兜底估算/token

/* ------------------------------------------------------------------ */
/* 小工具                                                                */
/* ------------------------------------------------------------------ */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function nowIso() {
  return new Date().toISOString();
}

function tsTag() {
  const d = new Date();
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function round4(x) {
  return typeof x === 'number' && Number.isFinite(x) ? Math.round(x * 10000) / 10000 : null;
}

function trunc(s, n) {
  if (s.length <= n) return s;
  return s.slice(0, n) + `\n…[truncated ${s.length - n} chars]`;
}

/** 原子写：先写 .tmp 再 rename（崩溃不留半个 JSON/log） */
function writeFileAtomic(file, data) {
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, data, 'utf8');
  renameSync(tmp, file);
}

/* ------------------------------------------------------------------ */
/* CLI 解析                                                             */
/* ------------------------------------------------------------------ */

function usage() {
  console.log(`T-027 放量批次 runner（node 内置模块，零依赖）

用法:
  node scripts/t027-batch-runner.mjs --scenarios E-01,E-02,... --sha sha-a|sha-b --reps N [options]
  node scripts/t027-batch-runner.mjs --all --sha sha-b --reps 5 --budget-usd 50 --label claude-sha-b-full

必选其一:
  --scenarios E-01,E-02,...   场景列表（逗号分隔；如 E-06a/E-06b 大小写不敏感）
  --all                       全部 12 场景 (E-01..E-11, 含 E-06a/E-06b)

选项:
  --sha sha-a|sha-b           被测 worktree label（默认 sha-a）
  --reps N                    每场景重复次数（默认 5）
  --budget-usd N              累计成本预算闸（USD，默认 50；超出即停并报告）
  --evidences-dir <path>       runner 监视的 evidence 目录（默认 tests/e2e/t027-baseline/.evidences，相对仓库根）
                               注：harness-mvp.mjs 固定把证据写到 tests/e2e/t027-baseline/.evidences/（相对仓库根）；
                               默认即该目录；自定义路径仅改变"快照比对/发现新证据/读成本"的监视点。
  --label <cell>              批次产物目录名 .claude/t027-batch/<label>/（如 claude-sha-a-full）
  --settings <path>           覆盖 ~/.claude/settings.json 路径（认证 env 来源）
  --attempt-timeout-ms N      单次 attempt 超时（默认 900000）
  --backoff-ms N              环境失败重试退避基数（默认 60000，≥60000 生效）
  --max-attempts N            含首次的最大尝试数（默认 3 = 首次 + ≤2 次重试）
  --overwrite                 允许清空已存在同名批次目录（默认拒绝，防覆盖数据）
  --dry-run                   只打印计划矩阵与环境检查，不执行任何 session
  -h, --help                  显示本帮助

判定映射:
  exit 0            → PASS            （数据，不重试）
  exit 1            → FAIL            （数据，不重试）
  exit 4            → ANOMALY         （E-06b 轮间异常类，数据，不重试）
  exit 2            → SKIP            （预检跳过，不重试）
  其他/崩溃/超时/认证错/429 → 退避重试 ≤2 次，仍败 → ENV-FAIL（继续下一 session）
  validator strict ERROR → VALIDATION-FAIL（终止本批并报告）

runner 自身退出码:
  0  批次完成（可含 SKIP/ENV-FAIL 计数，最终会打印汇总表）
  1  参数/用法错误
  2  预算闸触发提前停止
  3  VALIDATION-FAIL 提前停止（evidence 契约问题，需修代码）
  4  认证 env 导出失败（settings.json 缺失或无可导出 ANTHROPIC_* env），未运行任何 session
  5  批次完成但存在 ≥1 个 ENV-FAIL session`);
}

function parseArgs(argv) {
  const opts = {
    scenarios: null, sha: 'sha-a', reps: 5, budgetUsd: 50,
    evidenceDir: DEFAULT_EVIDENCE_DIR, label: null, settings: null,
    attemptTimeoutMs: ATTEMPT_TIMEOUT_MS, backoffMs: RETRY_BASE_BACKOFF_MS,
    maxAttempts: RETRY_MAX_ATTEMPTS, overwrite: false, dryRun: false, help: false,
  };
  // 取当前参数的值：优先 "--k=v" 内联值，否则取下一个 argv（由 takeNext 负责跳过）
  let skip = 0;
  for (let i = 0; i < argv.length; i++) {
    if (skip > 0) { skip--; continue; }
    const a = argv[i];
    let v = null;
    let key = a;
    if (a.startsWith('--') && a.includes('=')) {
      const eq = a.indexOf('=');
      key = a.slice(0, eq);
      v = a.slice(eq + 1);
    }
    const value = (fallback) => {
      if (v !== null) return v;
      const nxt = i + 1 < argv.length ? argv[i + 1] : null;
      // 不以 -- 开头的下一个 token 才当作值（避免吞掉后续 flag）
      if (nxt !== null && !nxt.startsWith('--')) { skip = 1; return nxt; }
      return fallback;
    };
    switch (key) {
      case '-h': case '--help': opts.help = true; break;
      case '--dry-run': opts.dryRun = true; break;
      case '--overwrite': opts.overwrite = true; break;
      case '--all': opts.scenarios = [...ALL_SCENARIOS]; break;
      case '--scenarios':
        opts.scenarios = String(value('')).split(',').map((s) => s.trim()).filter(Boolean);
        break;
      case '--sha': opts.sha = String(value('')).toLowerCase(); break;
      case '--reps': opts.reps = parseInt(value(''), 10); break;
      case '--budget-usd': opts.budgetUsd = parseFloat(value('')); break;
      case '--evidences-dir': opts.evidenceDir = resolve(PROJECT_ROOT, value('')); break;
      case '--label': opts.label = value(null); break;
      case '--settings': opts.settings = resolve(value('')); break;
      case '--attempt-timeout-ms': opts.attemptTimeoutMs = parseInt(value(''), 10); break;
      case '--backoff-ms': opts.backoffMs = parseInt(value(''), 10); break;
      case '--max-attempts': opts.maxAttempts = parseInt(value(''), 10); break;
      default:
        console.error(`未知参数: ${a}`);
        usage();
        process.exit(1);
    }
  }
  return opts;
}

/* ------------------------------------------------------------------ */
/* 场景发现与归一化                                                       */
/* ------------------------------------------------------------------ */

/** 场景 id 规范形：E-XX（XX≥10 不带前导 0 的也补 0；a/b 后缀小写） */
function canonScenarioId(s) {
  const m = String(s).trim().toUpperCase().match(/^E-?(\d+)([AB])?$/);
  if (!m) return String(s).trim();
  return `E-${String(parseInt(m[1], 10)).padStart(2, '0')}${(m[2] ?? '').toLowerCase()}`;
}

/** 从 fixtures/04-00/*.ts 扫出场景 id 全集（权威防漂移） */
function discoverScenarioIds() {
  const dir = resolve(PROJECT_ROOT, 'tests/fixtures/04-00');
  if (!existsSync(dir)) return new Set(ALL_SCENARIOS);
  const ids = new Set();
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.ts') || f === 'index.ts' || f === 'types.ts') continue;
    const text = readFileSync(join(dir, f), 'utf8');
    const m = text.match(/id:\s*['"]([^'"]+)['"]/i);
    if (m) ids.add(canonScenarioId(m[1]));
  }
  return ids;
}

function normalizeScenarios(raw, known) {
  const out = [];
  for (const s of raw) {
    const canon = canonScenarioId(s);
    if (!known.has(canon)) {
      console.error(`❌ 未知场景 "${s}"（已归一化为 "${canon}"，不在 fixtures 全集内）`);
      console.error(`   可用场景: ${[...known].sort().join(', ')}`);
      process.exit(1);
    }
    if (!out.includes(canon)) out.push(canon);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 认证 env 导出（settings.json env 字段 → 进程环境）                      */
/* ------------------------------------------------------------------ */

/**
 * 读取 settings.json 的 env 字段。返回 { ok, env, reason, sourcePath, keys }。
 * 不打印任何 token 值（安全性：密钥只进子进程 env，不进日志）。
 */
function loadAuthEnv(settingsPath) {
  const sourcePath = settingsPath || resolve(os.homedir(), '.claude', 'settings.json');
  if (!existsSync(sourcePath)) {
    return { ok: false, env: {}, reason: `settings.json 不存在: ${sourcePath}`, sourcePath, keys: [] };
  }
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(sourcePath, 'utf8'));
  } catch (e) {
    return { ok: false, env: {}, reason: `settings.json 解析失败: ${e.message}`, sourcePath, keys: [] };
  }
  const env = (parsed && typeof parsed.env === 'object' && parsed.env) || {};
  const keys = Object.keys(env).filter((k) => typeof env[k] === 'string' && env[k].length > 0);
  const required = ['ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL'];
  const missing = required.filter((k) => !(k in env) || !env[k]);
  if (missing.length > 0) {
    return { ok: false, env: {}, reason: `settings.json env 缺关键项: ${missing.join(', ')}`, sourcePath, keys };
  }
  const authKeys = keys.filter((k) => k.startsWith('ANTHROPIC_') || k.startsWith('CLAUDE_CODE_'));
  if (authKeys.length === 0) {
    return { ok: false, env: {}, reason: 'settings.json env 无任何 ANTHROPIC_*/CLAUDE_CODE_* 键（无可导出认证）', sourcePath, keys };
  }
  return { ok: true, env, reason: 'ok', sourcePath, keys: authKeys };
}

/* ------------------------------------------------------------------ */
/* harness 单次调用（spawn + 超时 + 进程树清理）                            */
/* ------------------------------------------------------------------ */

function killTree(child) {
  if (!child || child.pid === undefined) return;
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    } else {
      process.kill(-child.pid, 'SIGKILL');
    }
  } catch { /* best effort */ }
}

// 当前在跑的 harness 子进程（供 SIGINT 快速终止）
let currentChild = null;

/**
 * spawn 一次 harness（shell: true 以解析 npx.cmd）。
 * resolve: { code, signal, timedOut, spawnError, stdout, stderr, durationMs }
 */
function runHarnessOnce(env, { timeoutMs }) {
  return new Promise((resolvePromise) => {
    let settled = false;
    let stdout = '';
    let stderr = '';
    const started = Date.now();
    let child = null;
    // 暴露给外层 SIGINT handler：中断时杀掉当前子进程树，避免等满超时
    currentChild = null;
    const finish = (obj) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      currentChild = null;
      resolvePromise({ ...obj, stdout, stderr, durationMs: Date.now() - started });
    };
    const timer = setTimeout(() => {
      if (child) killTree(child);
      finish({ code: null, signal: null, timedOut: true, spawnError: null });
    }, timeoutMs);

    try {
      // shell:true 用单命令串（不传 args 数组，避免 node≥22 的 DEP0190 警告且无拼接注入面）
      child = spawn(`npx tsx ${HARNESS_REL}`, {
        cwd: PROJECT_ROOT,
        env,
        shell: true,
        windowsHide: true,
      });
      currentChild = child;
    } catch (e) {
      finish({ code: null, signal: null, timedOut: false, spawnError: `spawn 失败: ${e.message}` });
      return;
    }
    child.stdout?.on('data', (d) => { stdout += d.toString(); if (stdout.length > STDIO_CAP) stdout = stdout.slice(0, STDIO_CAP); });
    child.stderr?.on('data', (d) => { stderr += d.toString(); if (stderr.length > STDIO_CAP) stderr = stderr.slice(0, STDIO_CAP); });
    child.on('error', (e) => finish({ code: null, signal: null, timedOut: false, spawnError: `spawn error: ${e.message}` }));
    child.on('exit', (code, signal) => finish({ code, signal, timedOut: false, spawnError: null }));
  });
}

/** 从 stderr 判断是否命中已知环境失败信号（429/认证/网络/工具缺失） */
function envSignalFromStderr(stderr) {
  const sig = [];
  if (/429|rate\s*limit|too\s*many\s*requests|limit\s*exceeded/i.test(stderr)) sig.push('429/rate-limit');
  if (/not\s+logged\s*in|auth|401|403|unauthor|credential|token/i.test(stderr)) sig.push('auth');
  if (/ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|ECONNRESET|network|connect/i.test(stderr)) sig.push('network');
  if (/claude\s*:?\s*not\s*found|spawn\s+.*ENOENT|cannot\s+find|command\s+not\s+found/i.test(stderr)) sig.push('missing-cli');
  if (/EPERM|EACCES|EBUSY/i.test(stderr)) sig.push('fs-perm');
  return sig;
}

/* ------------------------------------------------------------------ */
/* evidence 目录快照 / 新文件发现                                          */
/* ------------------------------------------------------------------ */

function snapshotEvidenceFiles(dir) {
  if (!existsSync(dir)) return new Set();
  return new Set(readdirSync(dir));
}

/** 新证据 .json（harness 产物 <run_id>.json），按场景前缀过滤防串扰 */
function findNewEvidenceJsons(before, dir, scenarioLower) {
  if (!existsSync(dir)) return [];
  const now = new Set(readdirSync(dir));
  return [...now]
    .filter((n) => !before.has(n))
    .filter((n) => n.endsWith('.json'))
    .filter((n) => n.toLowerCase().startsWith(`${scenarioLower}-`))
    .filter((n) => !/-(session|rounds|round\d+|e06b)\.json$/i.test(n))
    .map((n) => join(dir, n));
}

/** 新 session 录制 JSONL（*.jsonl） */
function findNewJsonls(before, dir) {
  if (!existsSync(dir)) return [];
  const now = new Set(readdirSync(dir));
  return [...now]
    .filter((n) => !before.has(n))
    .filter((n) => n.endsWith('.jsonl'))
    .map((n) => join(dir, n));
}

/**
 * session 录制是否真的跑过模型：auth/网络失败时 claude 可能秒退，harness
 * 对 no_spec 场景仍会 exit 0 + 空录制（会被误判 PASS）。因此要求录制里至少
 * 有一个真实事件（result/assistant/user 等 claude stream-json 事件行）。
 */
function sessionHasActivity(jsonlFiles) {
  for (const f of jsonlFiles) {
    let raw;
    try { raw = readFileSync(f, 'utf8'); } catch { continue; }
    for (const line of raw.split('\n')) {
      const t = line.trim();
      if (!t) continue;
      try {
        const ev = JSON.parse(t);
        if (ev && typeof ev === 'object' && typeof ev.type === 'string' && ev.type.length > 0) return true;
      } catch { /* 忽略非 JSON 行 */ }
    }
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* 成本提取（JSONL result 事件）                                          */
/* ------------------------------------------------------------------ */

/** 从 usage 粗略估算成本（仅 total_cost_usd/modelUsage 缺失时兜底） */
function estimateCostFromUsage(usage) {
  if (!usage || typeof usage !== 'object') return null;
  const toks = {
    input: usage.input_tokens ?? 0,
    output: usage.output_tokens ?? 0,
    cacheRead: usage.cache_read_input_tokens ?? 0,
    cacheWrite: usage.cache_creation_input_tokens ?? 0,
  };
  const total = toks.input * COST_RATES.input + toks.output * COST_RATES.output
    + toks.cacheRead * COST_RATES.cacheRead + toks.cacheWrite * COST_RATES.cacheWrite;
  return total > 0 ? total : null;
}

/**
 * 解析一批新 .jsonl，抽取 claude stream-json 的 result 事件成本。
 * - 优先 total_cost_usd；
 * - 其次 modelUsage.*.costUSD 求和（result 事件自带精确分模型成本）；
 * - 再其次 usage tokens 估算（estimated=true）。
 * 以事件 uuid/session_id 去重（-session.jsonl 为 rounds 合并，避免与 -roundN.jsonl 重复计费）。
 */
function extractCostFromJsonls(files) {
  const seen = new Set();
  let cost = 0;
  let estimated = false;
  let resultEvents = 0;
  let fallbackNote = null;
  for (const f of files) {
    let raw;
    try { raw = readFileSync(f, 'utf8'); } catch { continue; }
    for (const line of raw.split('\n')) {
      const t = line.trim();
      if (!t) continue;
      let ev;
      try { ev = JSON.parse(t); } catch { continue; }
      if (!ev || ev.type !== 'result') continue;
      const key = ev.uuid ?? ev.session_id ?? `${f}:${line.length}`;
      if (seen.has(key)) continue;
      seen.add(key);
      resultEvents++;
      if (typeof ev.total_cost_usd === 'number' && Number.isFinite(ev.total_cost_usd)) {
        cost += ev.total_cost_usd;
        continue;
      }
      // modelUsage costUSD 汇总
      let mc = 0;
      if (ev.modelUsage && typeof ev.modelUsage === 'object') {
        for (const k of Object.keys(ev.modelUsage)) {
          const c = ev.modelUsage[k]?.costUSD;
          if (typeof c === 'number') mc += c;
        }
      }
      if (mc > 0) { cost += mc; continue; }
      const est = estimateCostFromUsage(ev.usage);
      if (est !== null) { cost += est; estimated = true; continue; }
      fallbackNote = 'result 事件无 total_cost_usd/usage，成本无法核算';
    }
  }
  return { cost: round4(cost), estimated, resultEvents, fallbackNote };
}

/* ------------------------------------------------------------------ */
/* validator strict 调用                                                 */
/* ------------------------------------------------------------------ */

/** 返回 { ok, exitCode, stdout, stderr }；ok = exit 0 且无 ERROR（strict） */
function runValidatorStrict(evidenceFile) {
  const res = spawnSync(process.execPath, [resolve(PROJECT_ROOT, VALIDATOR_REL), evidenceFile], {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });
  const stdout = (res.stdout ?? '').toString();
  const stderr = (res.stderr ?? '').toString();
  return { ok: res.status === 0, exitCode: res.status, stdout: trunc(stdout, 20000), stderr: trunc(stderr, 4000) };
}

/* ------------------------------------------------------------------ */
/* evidence 验收审计（规格 6 项；仅记录不 gating，硬闸只有 validator）       */
/* ------------------------------------------------------------------ */

function auditEvidence(evidence, { scenario, shaLabel, sessionJsonlPaths }) {
  const checks = {};
  checks.exit_data = true; // 由调用方在数据出口路径填（此处恒 true）
  checks.mcp_version = evidence.mcp_version === '2025-11-25';
  const gitSha = evidence.git_sha;
  checks.git_sha_40hex = typeof gitSha === 'string' && /^[0-9a-f]{40}$/.test(gitSha);
  checks.git_sha_matches = checks.git_sha_40hex && EXPECTED_GIT_SHA[shaLabel] === gitSha;
  checks.sha_label = evidence.sha_label === shaLabel;
  checks.session_clean = evidence.session_clean === true;
  checks.decision_context_null = evidence.decision_context === null;
  checks.decision_context_sent_false = evidence.decision_context_sent === false;
  checks.scenario_id = evidence.scenario_id === scenario;
  const sessionNonEmpty = sessionJsonlPaths.some((p) => existsSync(p) && statSync(p).size > 0);
  checks.jsonl_nonempty = sessionNonEmpty;
  const details = {
    mcp_version: evidence.mcp_version ?? null,
    git_sha: gitSha ?? null,
    expected_git_sha: EXPECTED_GIT_SHA[shaLabel] ?? null,
    sha_label: evidence.sha_label ?? null,
    session_clean: evidence.session_clean ?? null,
    decision_context: evidence.decision_context ?? null,
    decision_context_sent: evidence.decision_context_sent ?? null,
    scenario_id: evidence.scenario_id ?? null,
    jsonl_files: sessionJsonlPaths.map((p) => basename(p)),
  };
  const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);
  return { checks, details, ok: failed.length === 0, failed };
}

/* ------------------------------------------------------------------ */
/* 日志                                                                */
/* ------------------------------------------------------------------ */

function makeLogger(runLogPath, outDir) {
  const logLine = (line) => {
    const ts = nowIso();
    const full = `${ts} ${line}`;
    console.log(full);
    try {
      writeFileSync(runLogPath, full + '\n', { encoding: 'utf8', flag: 'a' });
    } catch { /* 日志写入失败不阻断执行 */ }
  };
  return { logLine };
}

function writeSessionArchive(outDir, key, stdout, stderr) {
  const dir = join(outDir, 'sessions');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${key}.stdout.log`), stdout || '(harness stdout 为空；会话录制见 evidence -session.jsonl)\n', 'utf8');
  writeFileSync(join(dir, `${key}.stderr.log`), stderr || '(empty)\n', 'utf8');
}

/* ------------------------------------------------------------------ */
/* 主流程                                                               */
/* ------------------------------------------------------------------ */

async function main() {
  const argv = process.argv.slice(2);
  const opts = parseArgs(argv);
  if (opts.help) { usage(); process.exit(0); }

  if (!opts.sha || !['sha-a', 'sha-b'].includes(opts.sha)) {
    console.error('❌ --sha 必须是 sha-a 或 sha-b');
    process.exit(1);
  }
  if (!opts.scenarios || opts.scenarios.length === 0) {
    console.error('❌ 需要 --scenarios E-01,... 或 --all');
    usage();
    process.exit(1);
  }
  if (!Number.isInteger(opts.reps) || opts.reps < 1) {
    console.error('❌ --reps 必须是 ≥1 的整数');
    process.exit(1);
  }
  if (!Number.isFinite(opts.budgetUsd) || opts.budgetUsd <= 0) {
    console.error('❌ --budget-usd 必须是正数');
    process.exit(1);
  }

  // 场景校验（对 fixtures 全集；--all 恒定 12 场景）
  const known = discoverScenarioIds();
  const scenarios = normalizeScenarios(opts.scenarios, known);
  const sha = opts.sha;

  // 认证 env 检查（dry-run 也检查，但只告警不退出）
  const auth = loadAuthEnv(opts.settings);
  const envSourceNote = auth.ok
    ? `settings.json env 导出 OK（${auth.keys.length} 键: ${auth.keys.join(', ')}；token 不落日志）`
    : `⚠️  认证 env 导出失败: ${auth.reason}`;

  // label / 产物目录
  const label = opts.label || `claude-${sha}-${scenarios.length}scen-x${opts.reps}-${tsTag()}`;
  if (!/^[A-Za-z0-9._-]+$/.test(label)) {
    console.error(`❌ --label 只允许 [A-Za-z0-9._-]：收到 "${label}"`);
    process.exit(1);
  }
  const outDir = resolve(BATCH_ROOT, label);
  const runLogPath = join(outDir, 'run.log');
  const summaryPath = join(outDir, 'summary.json');

  if (!opts.dryRun) {
    if (existsSync(outDir) && readdirSync(outDir).length > 0 && !opts.overwrite) {
      console.error(`❌ 批次目录已存在且有内容: ${outDir}`);
      console.error('   用 --overwrite 清空重来，或换 --label');
      process.exit(1);
    }
    if (!auth.ok) {
      console.error(`❌ 认证 env 导出失败: ${auth.reason.replace(/^⚠️\s*/, '')}`);
      console.error('   无法导出 claude 认证 env → 不运行任何 session（不硬试多次）。');
      console.error('   检查 ~/.claude/settings.json 的 env 字段（ANTHROPIC_AUTH_TOKEN/BASE_URL 等）。');
      process.exit(4);
    }
    mkdirSync(join(outDir, 'sessions'), { recursive: true });
    if (existsSync(outDir) && opts.overwrite) {
      for (const f of readdirSync(outDir)) rmSync(join(outDir, f), { recursive: true, force: true });
      mkdirSync(join(outDir, 'sessions'), { recursive: true });
    }
  }

  const evidenceDir = opts.evidenceDir;
  if (!opts.dryRun) mkdirSync(evidenceDir, { recursive: true });

  const log = makeLogger(runLogPath, outDir).logLine;

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 T-027 放量批次 runner');
  console.log(`   仓库根  : ${PROJECT_ROOT}`);
  console.log(`   SHA     : ${sha} (${EXPECTED_GIT_SHA[sha]})`);
  console.log(`   场景    : ${scenarios.join(', ')} (${scenarios.length})`);
  console.log(`   reps    : ${opts.reps} → 计划 ${scenarios.length * opts.reps} sessions`);
  console.log(`   预算闸  : $${opts.budgetUsd}`);
  console.log(`   evidence: ${evidenceDir}`);
  console.log(`   产物    : ${opts.dryRun ? '(dry-run，不写)' : outDir}`);
  console.log(`   ${envSourceNote}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // ---- dry-run：只打印计划矩阵 ----
  if (opts.dryRun) {
    console.log('\n📋 计划矩阵（dry-run，不执行）：');
    let idx = 0;
    for (const sc of scenarios) {
      for (let r = 1; r <= opts.reps; r++) {
        idx++;
        console.log(`   [${String(idx).padStart(3, ' ')}] ${sc} rep ${String(r).padStart(2, '0')}/${opts.reps}`);
        console.log(`       命令: T027_SCENARIO=${sc} T027_SHA=${sha} npx tsx tests/e2e/t027-baseline/harness-mvp.mjs`);
        console.log(`       env  : settings.json env 注入 (${auth.ok ? `${auth.keys.length} ANTHROPIC_*/CLAUDE_CODE_* 键` : '导出失败(将中止)'})`);
        console.log(`       证据 → ${evidenceDir}/  | 每 session 后 validator strict`);
      }
    }
    console.log(`\n   dry-run 结束：共 ${idx} sessions，未执行任何真实调用。`);
    process.exit(0);
  }

  log(`# T-027 batch start | sha=${sha} | scenarios=${scenarios.join(',')} | reps=${opts.reps} | budget=${opts.budgetUsd} | label=${label}`);
  log(`# env: ${envSourceNote}`);

  // summary 状态
  const verdictCounts = { PASS: 0, FAIL: 0, ANOMALY: 0, SKIP: 0, 'ENV-FAIL': 0, 'VALIDATION-FAIL': 0 };
  const sessions = [];
  let runningCost = 0;
  let stopReason = null;
  let overallExit = 0;
  let interrupted = false;

  const childEnv = { ...process.env, ...auth.env, T027_SCENARIO: '', T027_SHA: sha };

  const handleSigint = () => {
    interrupted = true;
    if (currentChild) killTree(currentChild); // 中断时立刻杀掉在跑 harness，不等超时
  };
  process.on('SIGINT', handleSigint);

  outer:
  for (const scenario of scenarios) {
    for (let rep = 1; rep <= opts.reps; rep++) {
      if (interrupted) { stopReason = 'interrupted(SIGINT)'; overallExit = 130; break outer; }
      if (runningCost >= opts.budgetUsd) {
        stopReason = `budget-exceeded (running $${runningCost} ≥ $${opts.budgetUsd})`;
        overallExit = 2;
        break outer;
      }

      const scenarioLower = scenario.toLowerCase();
      console.log(`\n━━━ ▶ ${scenario} rep ${rep}/${opts.reps} ━━━`);
      const before = snapshotEvidenceFiles(evidenceDir);
      let attemptLogs = [];
      let final = null; // {kind:'data'|'skip'|'env', verdict, code, ...}

      for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
        if (interrupted) { stopReason = 'interrupted(SIGINT)'; overallExit = 130; break outer; }
        if (attempt > 1) {
          const backoff = Math.max(RETRY_BASE_BACKOFF_MS, opts.backoffMs, 60000) * (attempt - 1);
          console.log(`   ⏳ attempt ${attempt} 退避 ${Math.round(backoff / 1000)}s ...`);
          await sleep(backoff);
        }

        console.log(`   ▶ attempt ${attempt}/${opts.maxAttempts}  (${scenario} sha=${sha})`);
        childEnv.T027_SCENARIO = scenario;
        const res = await runHarnessOnce(childEnv, { timeoutMs: opts.attemptTimeoutMs });
        const signals = envSignalFromStderr(res.stderr);
        const evidenceJsons = findNewEvidenceJsons(before, evidenceDir, scenarioLower);
        const newJsonls = findNewJsonls(before, evidenceDir);

        // 存档本次 attempt 输出
        const key = `${scenario}-r${String(rep).padStart(2, '0')}-a${attempt}-${tsTag()}`;
        writeSessionArchive(outDir, key, res.stdout, res.stderr);
        attemptLogs.push({
          attempt, key,
          timedOut: !!res.timedOut,
          spawnError: res.spawnError ?? null,
          exitCode: res.code,
          durationMs: res.durationMs,
          signals,
          evidenceFiles: evidenceJsons.map((p) => basename(p)),
          jsonlFiles: newJsonls.map((p) => basename(p)),
        });
        console.log(`       退出码: ${res.code ?? '-'}${res.timedOut ? ' (超时)' : ''}${res.spawnError ? ` (spawnError: ${res.spawnError})` : ''} | ${Math.round((res.durationMs ?? 0) / 1000)}s | signals=[${signals.join(',')}]`);
        if (res.stderr) console.log(`       环境信号: ${signals.length ? signals.join(', ') : '无'}（stderr 尾部见 sessions/${basename(key + '.stderr.log')}）`);

        // SKIP：exit 2（预检跳过）
        if (res.code === SKIP_EXIT) {
          const skipReason = extractSkipReason(res.stderr);
          final = { kind: 'skip', verdict: 'SKIP', code: 2, evidenceFiles: [], jsonlFiles: newJsonls.map((p) => basename(p)), skipReason, cost: 0, estimated: false, validator: null, acceptance: null };
          console.log(`   ⚠️  预检跳过（exit 2）: ${skipReason}`);
          break;
        }

        // 数据出口：exit ∈ {0,1,4} 且有 evidence
        if (DATA_EXITS.has(res.code)) {
          const activityOk = sessionHasActivity(newJsonls);
          if (evidenceJsons.length === 0 || !activityOk) {
            // exit 数据码但无 evidence / 无真实会话事件 → 视为环境/流程失败（如认证错被
            // harness 吞掉后 no_spec 场景仍 exit 0 + 空录制），重试
            const why = evidenceJsons.length === 0
              ? '未发现新 evidence JSON'
              : 'session 录制无真实事件（疑似认证/网络失败，harness 对 no_spec 仍 exit 0）';
            console.log(`   ⚠️  exit ${res.code} 但${why}（视为流程/环境异常，将重试）`);
            if (attempt < opts.maxAttempts) continue;
            final = {
              kind: 'env', verdict: 'ENV-FAIL', code: res.code,
              reason: `exit ${res.code}：${why}（${opts.maxAttempts} 次尝试均未产出有效数据）${signals.length ? ` [${signals.join(',')}]` : ''}`,
              evidenceFiles: [], jsonlFiles: [], cost: 0, estimated: false, validator: null,
            };
            break;
          }
          const verdictByExit = { 0: 'PASS', 1: 'FAIL', 4: 'ANOMALY' }[res.code];
          console.log(`   📦 数据出口 exit=${res.code} → ${verdictByExit}（不重试）`);
          console.log(`       evidence: ${evidenceJsons.map((p) => basename(p)).join(', ')}`);

          // 成本（从新 JSONL 提取）
          const costInfo = extractCostFromJsonls(newJsonls);

          // validator strict
          let validator = { ok: true, exitCode: null, stdout: null };
          const vResults = [];
          for (const evFile of evidenceJsons) {
            const v = runValidatorStrict(evFile);
            vResults.push({ file: basename(evFile), ok: v.ok, exitCode: v.exitCode });
            validator = v;
            console.log(`   🔍 validator strict ${basename(evFile)} → ${v.ok ? 'VALID (0 ERROR)' : `FAIL (exit ${v.exitCode})`}`);
          }
          const validatorOk = vResults.every((v) => v.ok);

          // 验收审计（读 evidence JSON）
          let evidenceObj = null;
          try { evidenceObj = JSON.parse(readFileSync(evidenceJsons[0], 'utf8')); } catch { /* 交由 validator 判 */ }
          const acceptance = evidenceObj
            ? auditEvidence(evidenceObj, { scenario, shaLabel: sha, sessionJsonlPaths: newJsonls })
            : null;

          if (!validatorOk) {
            final = {
              kind: 'validation-fail', verdict: 'VALIDATION-FAIL', code: res.code,
              evidenceFiles: evidenceJsons.map((p) => basename(p)),
              jsonlFiles: newJsonls.map((p) => basename(p)),
              cost: costInfo.cost, estimated: costInfo.estimated,
              validator: vResults, acceptance,
              reason: `evidence 未过 validator strict（见上方输出；需修 harness evidence 契约而非继续放量）`,
            };
            stopReason = `validation-fail: ${evidenceJsons.map((p) => basename(p)).join(', ')} 未过 validator strict`;
            overallExit = 3;
            break;
          }

          final = {
            kind: 'data', verdict: verdictByExit, code: res.code,
            evidenceFiles: evidenceJsons.map((p) => basename(p)),
            jsonlFiles: newJsonls.map((p) => basename(p)),
            cost: costInfo.cost, estimated: costInfo.estimated,
            costResultEvents: costInfo.resultEvents,
            costNote: costInfo.fallbackNote ?? null,
            validator: vResults, acceptance,
          };
          break;
        }

        // exit 非数据码（非 0/1/2/4）：环境失败 → 重试
        const reason = res.timedOut
          ? `超时（>${opts.attemptTimeoutMs}ms）`
          : (res.spawnError ?? `意外退出码 ${res.code}`);
        console.log(`   ⚠️  环境失败: ${reason}${signals.length ? ` [${signals.join(', ')}]` : ''}`);
        if (attempt < opts.maxAttempts) continue;
        final = { kind: 'env', verdict: 'ENV-FAIL', code: res.code, reason, evidenceFiles: [], jsonlFiles: [], cost: 0, estimated: false, validator: null };
        break;
      }

      if (!final) { // 理论不可达
        final = { kind: 'env', verdict: 'ENV-FAIL', code: null, reason: 'internal: no outcome', evidenceFiles: [], jsonlFiles: [], cost: 0, estimated: false, validator: null };
      }

      // ---- session 收尾 ----
      if (final.kind === 'data' || final.kind === 'validation-fail') {
        runningCost += final.cost ?? 0;
      }
      verdictCounts[final.verdict] = (verdictCounts[final.verdict] ?? 0) + 1;

      const sessionRec = {
        scenario, sha, rep, attempts: attemptLogs,
        verdict: final.verdict, exitCode: final.code ?? null,
        costUsd: final.cost ?? 0, costEstimated: !!final.estimated,
        evidenceFiles: final.evidenceFiles ?? [],
        jsonlFiles: final.jsonlFiles ?? [],
        skipReason: final.skipReason ?? null,
        reason: final.reason ?? null,
        validator: final.validator,
        acceptance: final.acceptance ? { ok: final.acceptance.ok, failed: final.acceptance.failed, details: final.acceptance.details } : null,
      };
      sessions.push(sessionRec);

      const costStr = final.cost === null ? '-' : `$${final.cost}${final.estimated ? '~' : ''}`;
      const valStr = final.validator
        ? (Array.isArray(final.validator) ? final.validator.map((v) => (v.ok ? 'VALID' : 'VALIDATION-FAIL')).join(';') : '')
        : (final.verdict === 'VALIDATION-FAIL' ? 'VALIDATION-FAIL' : '-');
      log(`${scenario} | sha=${sha} | rep ${rep}/${opts.reps} | attempts ${sessionRec.attempts.length}/${opts.maxAttempts} | exit ${final.code ?? '-'} | ${final.verdict} | cost ${costStr} | validator ${valStr} | evidence ${final.evidenceFiles?.join(',') ?? '-'} | jsonl ${final.jsonlFiles?.length ?? 0} 个${final.skipReason ? ` | skip: ${final.skipReason}` : ''}${final.reason ? ` | ${final.reason}` : ''}`);
      console.log(`   ✅ session 完成: ${final.verdict} | cost ${costStr} | 累计 $${round4(runningCost) ?? 0} / 预算 $${opts.budgetUsd}`);

      if (stopReason) break outer;

      // summary 每 session 落盘（崩溃/中断保进度）
      const summary = buildSummary({ verdictCounts, sessions, runningCost, sha, label, opts, stopReason, envSourceNote, authOk: auth.ok, authKeys: auth.keys, expectedGitSha: EXPECTED_GIT_SHA[sha] });
      writeFileAtomic(summaryPath, JSON.stringify(summary, null, 2));
    }
    if (stopReason) break;
  }

  if (!stopReason && runningCost >= opts.budgetUsd) {
    stopReason = `budget-exceeded (running $${round4(runningCost)} ≥ $${opts.budgetUsd})`;
    overallExit = 2;
  }
  if (interrupted && !stopReason) { stopReason = 'interrupted(SIGINT)'; overallExit = 130; }

  const summary = buildSummary({ verdictCounts, sessions, runningCost, sha, label, opts, stopReason, envSourceNote, authOk: auth.ok, authKeys: auth.keys, expectedGitSha: EXPECTED_GIT_SHA[sha] });
  writeFileAtomic(summaryPath, JSON.stringify(summary, null, 2));
  log(`# T-027 batch end | stop=${stopReason ?? 'completed'} | totalCost=$${round4(runningCost)} | sessions=${sessions.length}`);

  printFinalReport({ verdictCounts, runningCost, sessions, stopReason, overallExit, sha, label, outDir, summaryPath, budgetUsd: opts.budgetUsd });
  process.exit(overallExit);
}

function extractSkipReason(stderr) {
  // 找 stderr 里的跳过原因（预检失败说明行）
  const lines = stderr.split('\n').map((l) => l.trim()).filter(Boolean);
  const hit = lines.filter((l) => /预检失败|跳过本场景|粒度评估不符预期|assess_goal 返回错误/.test(l));
  return hit.length ? hit.join(' | ').slice(0, 500) : 'exit 2（预检跳过），stderr 未给出明细';
}

function buildSummary({ verdictCounts, sessions, runningCost, sha, label, opts, stopReason, envSourceNote, authOk, authKeys, expectedGitSha }) {
  const perScenario = {};
  for (const s of sessions) {
    perScenario[s.scenario] ??= { counts: {}, costs: [] };
    perScenario[s.scenario].counts[s.verdict] = (perScenario[s.scenario].counts[s.verdict] ?? 0) + 1;
    if (s.costUsd != null) perScenario[s.scenario].costs.push(s.costUsd);
  }
  return {
    tool: 't027-batch-runner',
    generated_at: nowIso(),
    label,
    sha,
    expected_git_sha: expectedGitSha,
    scenarios: Object.keys(perScenario),
    reps: opts.reps,
    budget_usd: opts.budgetUsd,
    auth_env: { ok: !!authOk, keys: authKeys, note: envSourceNote },
    verdict_counts: verdictCounts,
    total_cost_usd: round4(runningCost),
    stop_reason: stopReason,
    per_scenario: perScenario,
    env_fail_sessions: sessions.filter((s) => s.verdict === 'ENV-FAIL').map((s) => ({ scenario: s.scenario, rep: s.rep, reason: s.reason, attempts: s.attempts })),
    validation_fail_sessions: sessions.filter((s) => s.verdict === 'VALIDATION-FAIL').map((s) => ({ scenario: s.scenario, rep: s.rep, evidenceFiles: s.evidenceFiles, reason: s.reason })),
    sessions,
  };
}

function printFinalReport({ verdictCounts, runningCost, sessions, stopReason, overallExit, sha, label, outDir, summaryPath, budgetUsd }) {
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 批次汇总');
  console.log(`   判定表（exit → 判定）:`);
  console.log(`     exit 0      → PASS            : ${verdictCounts.PASS}`);
  console.log(`     exit 1      → FAIL            : ${verdictCounts.FAIL}`);
  console.log(`     exit 4      → ANOMALY         : ${verdictCounts.ANOMALY}`);
  console.log(`     exit 2      → SKIP            : ${verdictCounts.SKIP}`);
  console.log(`     环境失败重试耗尽 → ENV-FAIL    : ${verdictCounts['ENV-FAIL']}`);
  console.log(`     validator ERROR → VALIDATION-FAIL: ${verdictCounts['VALIDATION-FAIL']}`);
  console.log(`   总 sessions : ${sessions.length}`);
  console.log(`   累计成本    : $${round4(runningCost) ?? 0} / 预算 $${budgetUsd}`);
  console.log(`   停止原因    : ${stopReason ?? '全部完成'}`);
  if (overallExit !== 0) console.log(`   runner 退出码: ${overallExit}（见 --help 说明）`);
  console.log(`   产物目录    : ${outDir}`);
  console.log(`   summary.json: ${summaryPath}`);
  console.log(`   run.log     : ${join(outDir, 'run.log')}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main().catch((e) => {
  console.error('❌ runner 崩溃:', e);
  process.exit(1);
});
