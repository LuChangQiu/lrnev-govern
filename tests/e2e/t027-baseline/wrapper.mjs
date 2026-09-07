#!/usr/bin/env node
/**
 * T-027 多 SHA wrapper
 *
 * 功能：读取 current-sha.txt 指针，切换到对应 worktree 启动 MCP server
 * SHA 演进：sha-a = 45a86e15 (B0 基线)；sha-b = 6383e99 (M2 收尾，无 Profile)；
 *           sha-c = 918581e (B3 对照快照)；sha-d = 2b3c8fa (B4 发布内容快照)
 *
 * SHA 选择优先级（D4，放量编排）：
 * - 环境变量 T027_SHA=sha-a|sha-b|sha-c|sha-d 优先（每 session 锁定，避免共享指针文件竞态）
 * - 未设 env 时回退读 .claude/t027-worktrees/current-sha.txt（历史行为）
 *
 * 使用：
 * - 切换到 sha-a: echo "sha-a" > .claude/t027-worktrees/current-sha.txt
 * - 切换到 sha-d: echo "sha-d" > .claude/t027-worktrees/current-sha.txt
 * - 启动 server: node tests/e2e/t027-baseline/wrapper.mjs
 *
 * 代理录制模式（T-027 Q1-A，环境变量启用，默认关闭）：
 * - LRNEV_T027_PROXY=1  开启：wrapper 自身成为 stdio 端点（客户端 ↔ wrapper），
 *   server 以 pipe 连接，双向字节透传 JSON-RPC，旁路按行录制，不修改透传字节。
 * - LRNEV_T027_LOG=<path>  录制文件（JSONL 追加）。缺省时写到
 *   .claude/t027-proxy-recordings/proxy-<sha>-<epoch>.jsonl（gitignore 区）。
 *
 * 录制事件（每条 = 一个 JSON 行，字段 ts/dir/ev/method/id/tool + 载荷）：
 * - dir='c2s'：所有客户端请求（tools/call 附带 tool+args），notifications 简化记录
 * - dir='s2c'：initialize 结果（protocolVersion/serverInfo/instructions 全文）、
 *   tools/list 结果（42 工具 name+description 全文）、tools/call 结果
 *   （isError + structuredContentRaw —— msg.result.structuredContent 的原始 JSON 文本，保真）
 * - dir='sys'：会话开始/结束（session_start/session_end，含 sha/exitCode）
 *
 * 注意：
 * - 指针文件在 .claude/t027-worktrees/current-sha.txt（gitignore 区）
 * - worktrees 在 .claude/t027-worktrees/sha-{a,b}/
 * - wrapper 从项目根目录显式解析路径
 * - 所有日志走 stderr（stdout 是 JSON-RPC 通道）
 * - 默认（未设 LRNEV_T027_PROXY）行为与历史版本完全一致：stdio inherit 直通
 */

import { readFileSync, existsSync, mkdirSync, appendFileSync, copyFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 显式解析到项目根目录（向上查找 package.json）
function findProjectRoot(startDir) {
  let dir = startDir;
  while (dir !== resolve(dir, '..')) {
    if (existsSync(resolve(dir, 'package.json'))) {
      return dir;
    }
    dir = resolve(dir, '..');
  }
  throw new Error('未找到项目根目录（package.json）');
}

const projectRoot = findProjectRoot(__dirname);
const worktreeBaseDir = resolve(projectRoot, '.claude/t027-worktrees');
const currentShaPath = resolve(worktreeBaseDir, 'current-sha.txt');
const mcpEntryPath = resolve(worktreeBaseDir, 'mcp-entry.mjs');

// 如果 gitignore 区垫片不存在，从入库版本复制
const inRepoEntryPath = resolve(projectRoot, 'tests/e2e/t027-baseline/mcp-entry.mjs');
if (!existsSync(mcpEntryPath) && existsSync(inRepoEntryPath)) {
  console.error(`⚠️  垫片不存在，从入库版本复制：${mcpEntryPath}`);
  copyFileSync(inRepoEntryPath, mcpEntryPath);
}

// 读取当前 SHA
// 优先级：环境变量 T027_SHA（sha-a/sha-b）> 指针文件 current-sha.txt。
// 目的：放量多 session 并发时每个 session 用 env 锁定 SHA，避免共享指针文件竞态。
let currentSha;
let shaSource;

const envSha = (process.env.T027_SHA ?? '').trim();
// B3 对照（2026-09-04）新增 sha-c（主工作区修复后快照）；校验放宽为 /^sha-[a-z]+$/
if (/^sha-[a-z]+$/.test(envSha)) {
  currentSha = envSha;
  shaSource = 'env';
} else if (envSha !== '') {
  console.error(`❌ 无效的 T027_SHA：${envSha}（应为 sha-a/sha-b/sha-c 等 worktree 标签）`);
  process.exit(1);
} else {
  // 无 env → 读指针文件（历史行为）
  if (!existsSync(currentShaPath)) {
    console.error(`❌ 指针文件不存在：${currentShaPath}`);
    console.error(`提示：echo "sha-a" > ${currentShaPath}，或设置环境变量 T027_SHA=sha-a`);
    process.exit(1);
  }
  currentSha = readFileSync(currentShaPath, 'utf-8').trim();
  shaSource = 'pointer';

  if (!/^sha-[a-z]+$/.test(currentSha)) {
    console.error(`❌ 无效的 SHA 指针：${currentSha}（应为 sha-a/sha-b/sha-c 等 worktree 标签）`);
    process.exit(1);
  }
}

// 构建 worktree 路径（显式指向 .claude/t027-worktrees/）
const worktreePath = resolve(worktreeBaseDir, currentSha);

// 验证 worktree 存在
if (!existsSync(worktreePath)) {
  console.error(`❌ Worktree 不存在：${worktreePath}`);
  console.error(`提示：git worktree add ${worktreePath} <commit-sha>`);
  process.exit(1);
}

// 验证垫片入口存在
if (!existsSync(mcpEntryPath)) {
  console.error(`❌ MCP 垫片入口不存在：${mcpEntryPath}`);
  process.exit(1);
}

console.error(`🔀 T-027 双 SHA wrapper`);
console.error(`📍 当前 SHA：${currentSha}`);
if (shaSource === 'env') {
  console.error(`🌱 SHA 来源：环境变量 T027_SHA（优先于指针文件，会话级锁定）`);
}
console.error(`📂 Worktree：${worktreePath}`);
console.error(`🚀 启动 MCP server（通过垫片入口）`);
console.error('');

// 透传给 server 的环境：如果调用方设置了 LRNEV_WORKSPACE，优先使用；否则用 worktree 目录
const childEnv = {
  ...process.env,
  LRNEV_WORKSPACE: process.env.LRNEV_WORKSPACE || worktreePath,
};

// 代理录制开关
function proxyEnabled() {
  const raw = process.env.LRNEV_T027_PROXY;
  if (raw === undefined || raw === null) return false;
  const v = String(raw).trim().toLowerCase();
  return v !== '' && v !== '0' && v !== 'false' && v !== 'no' && v !== 'off';
}

// ---------------------------------------------------------------------------
// 默认模式（stdio inherit 直通，与历史行为完全一致）
// ---------------------------------------------------------------------------
function startPassthrough() {
  const child = spawn('node', ['--import', 'tsx', mcpEntryPath], {
    cwd: worktreePath,
    stdio: 'inherit',
    shell: false,
    env: childEnv,
  });

  child.on('error', (err) => {
    console.error(`❌ 启动失败：${err.message}`);
    process.exit(1);
  });

  child.on('exit', (code) => {
    process.exit(code || 0);
  });
}

// ---------------------------------------------------------------------------
// 代理录制模式
// ---------------------------------------------------------------------------

/**
 * 录制器：JSONL 追加。同步写保证在进程退出前落盘（无需额外 flush）。
 */
function createRecorder(logPath) {
  mkdirSync(dirname(logPath), { recursive: true });
  let ok = true;
  function log(record) {
    if (!ok) return;
    try {
      appendFileSync(logPath, JSON.stringify(record) + '\n', 'utf8');
    } catch (err) {
      ok = false;
      console.error(`❌ 录制写入失败（停止录制，继续透传）：${err.message}`);
    }
  }
  return { log, path: logPath };
}

function isJsonRpcMessage(text) {
  return text.trimStart().startsWith('{');
}

/**
 * 从原始响应行中抠出 "structuredContent": {...} 的原始 JSON 文本（值部分，含花括号）。
 * 逐字符扫描、识别字符串与转义，字节保真；失败返回 null（由调用方回退 JSON.stringify）。
 */
function extractRawStructuredContent(rawLine) {
  const key = '"structuredContent"';
  let ki = rawLine.indexOf(key);
  while (ki !== -1) {
    // 跳过转义串内的伪匹配（content text 若含 \"structuredContent\"，其前一个字符是 '\'）
    if (ki === 0 || rawLine[ki - 1] !== '\\') break;
    ki = rawLine.indexOf(key, ki + 1);
  }
  if (ki === -1) return null;
  let i = ki + key.length;
  // 跳过 : 与空白
  while (i < rawLine.length && (rawLine[i] === ':' || rawLine[i] === ' ' || rawLine[i] === '\t')) i++;
  if (rawLine[i] !== '{') return null;
  const start = i;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (; i < rawLine.length; i++) {
    const ch = rawLine[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return rawLine.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * 启动代理录制模式。
 *
 * 拓扑：客户端(stdin/stdout) ↔ wrapper ↔ server child(pipe)
 *  - 双向字节透传：原 chunk 原样转发（不改写、不重新编码）
 *  - 旁路按行解析 JSON-RPC 并录制
 *  - child stderr inherit（沿用默认模式的日志观感，不污染 stdout）
 */
function startProxy() {
  const logPath = process.env.LRNEV_T027_LOG || resolve(
    projectRoot,
    '.claude/t027-proxy-recordings',
    `proxy-${currentSha}-${Date.now()}.jsonl`,
  );
  const rec = createRecorder(logPath);
  const sessionStart = Date.now();

  rec.log({
    ts: new Date().toISOString(), dir: 'sys', ev: 'session_start',
    sha: currentSha, shaSource, worktree: worktreePath, proxy: true,
    log: logPath, workspace: childEnv.LRNEV_WORKSPACE,
  });

  console.error(`📼 代理录制模式：${logPath}`);

  const child = spawn('node', ['--import', 'tsx', mcpEntryPath], {
    cwd: worktreePath,
    stdio: ['pipe', 'pipe', 'inherit'],
    shell: false,
    env: childEnv,
  });

  // id -> { method, tool }（响应只带 id，靠请求登记还原 method/tool）
  const pending = new Map();

  let stdoutClosed = false;
  let finished = false;
  function finish(exitCode, signal) {
    if (finished) return;
    finished = true;
    rec.log({
      ts: new Date().toISOString(), dir: 'sys', ev: 'session_end',
      exitCode, signal,
      durationMs: Date.now() - sessionStart,
    });
    const code = typeof exitCode === 'number' ? exitCode : (signal ? 1 : 0);
    const out = process.stdout;
    let exited = false;
    const doExit = () => {
      if (exited) return;
      exited = true;
      process.exit(code);
    };
    if (stdoutClosed || out.destroyed || out.writableEnded) {
      // stdout 已结束：等在 close 之后退出；兜底定时器保证一定会退出并透传 exitCode
      out.once('close', doExit);
      setTimeout(doExit, 300);
    } else {
      try {
        out.end(doExit);
      } catch {
        doExit();
      }
    }
  }

  // 一条客户端→server 消息的录制
  function handleClientLine(text) {
    if (!isJsonRpcMessage(text)) return;
    let msg;
    try {
      msg = JSON.parse(text);
    } catch {
      return;
    }
    const isRequest = msg && typeof msg === 'object' && msg.method !== undefined && msg.id !== undefined;
    const isNotification = msg && typeof msg === 'object' && msg.method !== undefined && msg.id === undefined;
    if (isRequest) {
      pending.set(String(msg.id), {
        method: msg.method,
        tool: msg.method === 'tools/call' ? msg.params?.name : undefined,
      });
      const record = {
        ts: new Date().toISOString(), dir: 'c2s', ev: 'request',
        method: msg.method, id: msg.id,
      };
      if (msg.method === 'tools/call') {
        record.tool = msg.params?.name;
        record.args = msg.params?.arguments ?? {};
      }
      rec.log(record);
    } else if (isNotification) {
      rec.log({
        ts: new Date().toISOString(), dir: 'c2s', ev: 'notification',
        method: msg.method,
      });
    }
  }

  // 一条 server→客户端 消息的录制
  function handleServerLine(text) {
    if (!isJsonRpcMessage(text)) return;
    let msg;
    try {
      msg = JSON.parse(text);
    } catch {
      return;
    }
    if (msg === null || typeof msg !== 'object') return;
    // server 通知（无 id）简化记录
    if (msg.method !== undefined && msg.id === undefined) {
      rec.log({
        ts: new Date().toISOString(), dir: 's2c', ev: 'notification',
        method: msg.method,
      });
      return;
    }
    if (msg.id === undefined) return;
    const ctx = pending.get(String(msg.id)) || { method: undefined, tool: undefined };

    const base = {
      ts: new Date().toISOString(), dir: 's2c',
      method: ctx.method, id: msg.id, tool: ctx.tool,
    };

    // JSON-RPC 协议级错误
    if (msg.error !== undefined) {
      rec.log({ ...base, ev: 'response_error', error: msg.error });
      return;
    }

    const result = msg.result;
    if (result === undefined) return;

    const method = ctx.method || '';

    if (method === 'initialize') {
      // instructions：优先 result.instructions（当前 server 在此），兜底 serverInfo
      const instructions =
        typeof result.instructions === 'string'
          ? result.instructions
          : (result.serverInfo && typeof result.serverInfo.instructions === 'string'
              ? result.serverInfo.instructions
              : null);
      rec.log({
        ...base, ev: 'initialize_result',
        protocolVersion: result.protocolVersion,
        serverInfo: result.serverInfo ?? null,
        instructions,
        instructionsSource: typeof result.instructions === 'string'
          ? 'result.instructions'
          : (result.serverInfo && typeof result.serverInfo.instructions === 'string'
              ? 'serverInfo.instructions'
              : null),
      });
    } else if (method === 'tools/list') {
      const tools = Array.isArray(result.tools) ? result.tools : [];
      rec.log({
        ...base, ev: 'tools_list_result', toolCount: tools.length,
        tools: tools.map((t) => ({
          name: t.name,
          title: t.title ?? null,
          description: t.description ?? '',
        })),
      });
    } else if (method === 'tools/call') {
      let scRaw = extractRawStructuredContent(text);
      if (scRaw === null && result.structuredContent !== undefined) {
        // 保底：解析后再序列化（键序可能变化，但结构完整）
        scRaw = JSON.stringify(result.structuredContent);
      }
      rec.log({
        ...base, ev: 'call_result',
        isError: result.isError === true,
        structuredContentRaw: scRaw, // 原始 JSON 文本（字节保真优先）
      });
    } else {
      rec.log({ ...base, ev: 'response' });
    }
  }

  child.on('error', (err) => {
    console.error(`❌ 启动失败：${err.message}`);
    rec.log({ ts: new Date().toISOString(), dir: 'sys', ev: 'spawn_error', message: err.message });
    finish(1, null);
  });

  // 用 'close'：保证子进程 stdio 全部关闭后再收尾，避免丢 stdout 尾部字节
  child.on('close', (code, signal) => {
    finish(code, signal);
  });

  // 信号转发（默认模式里子进程与控制终端同组直接收信号；代理模式需手动转发）
  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.once(sig, () => {
      try {
        child.kill(sig);
      } catch { /* 已退出 */ }
    });
  }

  // ---------------- 双向透传 + 旁路行解析 ----------------

  /**
   * 建一条转发：source 字节原样写入 dest（含反压 pause/drain），
   * 同时按 '\n' 把字节流切成完整行（UTF-8 行，多字节字符跨 chunk 安全：
   * 只在完整行边界做 toString，避免半个字符被错误解码），逐行交给 handleLine 录制。
   */
  function relay(source, dest, handleLine) {
    let buf = Buffer.alloc(0);

    function pump(flushTail) {
      let idx;
      while ((idx = buf.indexOf(0x0a)) !== -1) {
        const lineBuf = buf.subarray(0, idx);
        buf = buf.subarray(idx + 1);
        let line = lineBuf.toString('utf8');
        if (line.endsWith('\r')) line = line.slice(0, -1);
        handleLine(line);
      }
      if (flushTail && buf.length > 0) {
        let line = buf.toString('utf8');
        if (line.endsWith('\r')) line = line.slice(0, -1);
        handleLine(line);
        buf = Buffer.alloc(0);
      }
    }

    source.on('data', (chunk) => {
      // 字节原样透传（不改写 chunk）
      if (!dest.write(chunk)) {
        source.pause();
        dest.once('drain', () => source.resume());
      }
      buf = Buffer.concat([buf, chunk]);
      pump(false);
    });

    source.on('end', () => {
      pump(true);
      try {
        dest.end();
      } catch { /* ignore */ }
    });

    source.on('error', (err) => {
      console.error(`⚠️ 透传源错误：${err.message}`);
      try {
        dest.end();
      } catch { /* ignore */ }
    });
  }

  // 客户端 → server：stdin 到 child.stdin；EOF 时让 server 侧感知（触发其优雅退出）
  relay(process.stdin, child.stdin, handleClientLine);

  // server → 客户端：child.stdout 到 stdout
  relay(child.stdout, process.stdout, handleServerLine);
  child.stdout.on('end', () => {
    stdoutClosed = true;
  });
  process.stdout.on('error', () => {
    stdoutClosed = true; // 客户端关闭读端（EPIPE 等）
  });
}

if (proxyEnabled()) {
  startProxy();
} else {
  startPassthrough();
}
