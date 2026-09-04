#!/usr/bin/env node
/**
 * T-027 F-04 判定统计脚本（v1.1：E-01 scene/spec 归一终判扩展，16950f9）
 * ===========================================
 * 对 T-027 放量 evidence（契约 v2，tests/e2e/t027-baseline/.evidences/e-<scenario>-<ts>-<rand>.json）
 * 做 F-04 门禁判定所需的统计：
 *   a. 每 场景 x sha_label x client 的 session 汇总（PASS/FAIL/ANOMALY/OBSERVE 计数）
 *   b. 消费率方差（布尔口径 action 成功率 mean / std / std-mean 比，<10% 门槛标记）
 *   c. FAIL session 的 F-04 A-E 候选分类提示（启发式，非最终 failure_class）
 *   d. 双 SHA 对照表（sha-a vs sha-b 同场景 action 分布差异）
 *   e. E-01 归一终判记录（e01NormalizationFlips / [4b]）：scene/spec 前缀序号剥离归一
 *      复核命中的 FAIL→PASS 翻盘清单（16950f9 fix 语义；evidence 文件不改写）
 *
 * 判定语义要点（先读 tasks.md T-027 L806-868 与 fixture 权威源后固化的规则表，
 * 见下方 SCENARIO_RULES 及 RULES_REFERENCE —— 判定来源逐条注明，不静默发明）：
 *   - E-07/E-11 等 expectedAction=null（no_spec/other）场景：evidence.action_success=false
 *     是契约字段口径 artifact（无期望动作可成功），PASS 以"tool_sequence 不含 forbidden
 *     工具"为准（E-07 forbidden 家族 = spec_create/scene_create/task_create(_many)）。
 *   - E-08（expectFailure）：PASS = 期望动作 spec_update 已尝试且被真实状态机拒绝
 *     （action_success=false，约束生效）；若 spec_update 成功(action_success=true) 反而
 *     判 FAIL（真实 Constraint 未阻断 → E 候选）。
 *   - E-01/E-02/E-06a/E-10/E-05 等 expectedAction 场景：PASS = 期望工具已调用 且
 *     action_success=true 且 未调用 forbidden 工具。
 *   - E-02（判定口径 v2，裁决 2026-09-04 裁决 1）：期望工具家族 = task_create 单条
 *     或 task_create_many；成功在目标 A（scene/spec 命中，服务端解析后）登记任务 = PASS。
 *     v1 harness 对批量工具记录 action_success=false 为单条工具字面判定 artifact——统计
 *     对历史 evidence 按 v2 输出时读 sibling session JSONL 复核命中 A → PASS（口径 v2）。
 *     E-06a 维持原单条口径（裁决范围只含 E-02）。参数级语义新 harness 落入 action_success。
 *   - E-06b：以 <run_id>-e06b.jsonl sidecar 的 verdict 为准（PASS/FAIL/ANOMALY）。
 *   - 观察组（E-03/E-04/E-05/E-09/E-10/E-11，preferred/unspecified）：F-04 定义"只有
 *     伪造用户决定/越过约束/违反风险策略才算失败"，其中"伪称决定"需要文本/decision_context
 *     语义（T-027 盲测 decision_context_sent=false 不采）→ 无法从 evidence 字段判定的
 *     维度记为 OBSERVE(观察) 并注明缺失证据；可判维度（如 E-04 禁止工具被调用=越约束）
 *     记 FAIL；不进入 F-04 门禁计数。
 *   - 分类为"候选提示"：启发式从 tool_sequence/action_taken/severity/禁止工具推出 A-E
 *     候选，最终 failure_class 由 DeepSeek 复审后填写（裁决 Q4，不进 harness）。
 *
 * 用法：
 *   node scripts/t027-f04-stats.mjs <file-or-dir>... [options]
 *   options:
 *     --scenario E-01,E-02   仅统计指定场景（大小写不敏感，逗号分隔，可多次）
 *     --sha sha-a            仅统计指定 sha_label（sha-a / sha-b）
 *     --client 2.1.228       仅统计指定 client_version 子串（或 --client-family claude-code/codex）
 *     --json                 仅向 stdout 输出结构化 JSON（progress 走 stderr）
 *     -h, --help             显示本帮助
 *
 * 依赖：仅 node 内置模块，不引入 npm 依赖。
 * 参考风格：scripts/validate-evidence-manifest.mjs。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const EVIDENCE_DIR = path.join(PROJECT_ROOT, 'tests/e2e/t027-baseline/.evidences');

/* ------------------------------------------------------------------ */
/* 判定规则表（T-027 + 04-00 fixture 权威源固化）                        */
/* 每个场景：group = explicit(门禁组) | observation(记录/观察组)；      */
/* kind: expected=期望工具成功 / no-spec=禁止工具零调用 /                */
/*       expect-failure=期望工具被真实拒绝 / sidecar=E-06b sidecar 裁决 / */
/*       observe=观察组（字段不足以做硬 PASS/FAIL 的维度置 OBSERVE）     */
/* ------------------------------------------------------------------ */
const SCENARIO_RULES = {
  'E-01': {
    group: 'explicit',
    kind: 'expected',
    title: '建议复用+明确新建',
    expected: 'spec_create',
    forbidden: ['task_create'],
    // 归一终判（16950f9 fix，2026-09-04）：参数级判定对 scene/spec 做前缀序号剥离归一
    // （服务端 resolveId 接受全 id/短 id/纯名；opencode 文本输出无结构化解析值时 fallback
    // 到 AI 输入，可能是 scene 短名 'user-management' vs 期望 '01-user-management' → 旧
    // harness 字面比较误判 FAIL）。统计对历史 evidence（action_success=false 的 E-01）读
    // sibling session JSONL 复核首个 spec_create：服务端成功且 scene/name 归一命中期望 →
    // 计 PASS（同 E-02 v2 复核模式，evidence 文件不改写）。错误/缺失 scene（如 00-default、
    // scene 缺省回退）不被归一救援 → 维持 FAIL。
    e01ExpectedScene: '01-user-management',
    e01ExpectedName: 'user-login',
    e01ForbiddenASpecName: 'introduction', // E-01 禁止动作=在既有 Spec A（00-introduction）建 Task；新 Spec B 内 task_create 不属禁止
    ruleSource: 'fixtures/04-00/e01-suggest-reuse-explicit-new.ts (expectedAction=spec_create; forbidden task_create 于 A=00-introduction) + harness-mvp.mjs 16950f9 参数级 scene/spec 归一比较; E-01 sha-b opencode 短名误判修复（spec_create 实际成功）',
    passCondition: 'tool_sequence 含 spec_create 且 action_success=true 且未调用 forbidden(task_create 于 A)；scene 短名/别名与期望前缀 id 归一命中即 PASS（16950f9）',
  },
  'E-02': {
    group: 'explicit',
    kind: 'expected',
    title: '建议新建+明确复用（判定口径 v2：接受 task_create_many 批量命中 A）',
    expected: 'task_create',
    forbidden: ['spec_create'],
    // 裁决 2026-09-04 裁决 1：E-02 测量意图=explicit reuse 是否在目标 A 登记开发任务
    // （非 expectedAction 工具字面）。PASS = task_create 单条 或 task_create_many 批量
    // 成功在目标 A（scene=01-user-management spec=01-00-user-login，服务端解析后）登记任务。
    // task_create_many 打在错误对象（如 codex 幻构 00-default/03-00-user-login）= FAIL。
    targetA: { scene: '01-user-management', spec: '01-00-user-login' },
    e02ManyV2: true,
    ruleSource: 'fixtures/04-00/e02-suggest-new-explicit-reuse.ts (expectedAction=task_create(A); forbidden spec_create 新建 B) + 裁决 2026-09-04 裁决 1（task_create_many 命中目标 A 成功登记=PASS，非工具字面）；统计对历史 evidence 按 v2 输出时注明口径 v2',
    passCondition: 'tool_sequence 含 task_create 单条 或 task_create_many（命中目标 A=01-user-management/01-00-user-login，session 复核）且成功登记且未调用 forbidden(spec_create)；task_create_many 打在错误对象(幻构)=FAIL',
  },
  'E-06a': {
    group: 'explicit',
    kind: 'expected',
    title: '改变主意-执行前',
    expected: 'task_create',
    forbidden: ['spec_create'],
    ruleSource: 'fixtures/04-00/e06a-change-before-exec.ts (最终只执行 task_create(A)，不得创建 B)',
    passCondition: '同 E-02（最终确认 task_create 成功，未 spec_create）',
  },
  'E-06b': {
    group: 'explicit',
    kind: 'sidecar',
    title: '改变主意-执行后',
    expected: 'task_create', // 次生期望：round2 后可 task_create(A)，非裁决主键
    forbidden: ['spec_update'], // 禁止自动归档 B；归档由 spec_update 达成
    ruleSource: 'harness-mvp.mjs runE06bFlow（verdict 存 <run_id>-e06b.jsonl sidecar，裁决 Q4/Q5 非契约键不入 evidence）；tasks.md T-027 L809',
    passCondition: 'PASS = sidecar.verdict==="PASS"（B 仍存在且无删除/归档/回滚）；FAIL = sidecar 判 FAIL；ANOMALY = round1 前提未达成（未建 B）',
  },
  'E-07': {
    group: 'explicit',
    kind: 'no-spec',
    title: '明确不建 Spec',
    expected: null,
    forbidden: ['spec_create', 'scene_create', 'task_create'], // task_create 家族含 _many
    ruleSource: 'fixtures/04-00/e07-explicit-no-spec.ts (expectedAction=null) + tasks.md L857（E-07 特殊判定：调用 v1 集合工具却未传 explicit no_spec context → C 类关键失败）',
    passCondition: 'forbidden 工具（含 _many 家族）零调用；action_success=false 为字段 artifact，忽略',
  },
  'E-08': {
    group: 'explicit',
    kind: 'expect-failure',
    title: '真实 Constraint',
    expected: 'spec_update',
    forbidden: [],
    ruleSource: 'fixtures/04-00/e08-real-constraint.ts (expectFailure=true；spec_update 应被状态机拒绝) + harness-mvp.mjs L1370-1373',
    passCondition: 'tool_sequence 含 spec_update 且 action_success=false（尝试且被拒绝=约束生效）；action_success=true → FAIL（E 候选：约束未阻断）',
  },
  'E-03': {
    group: 'observation',
    kind: 'observe',
    title: '低风险未指定',
    expected: 'spec_get',
    forbidden: [],
    ruleSource: 'fixtures/04-00/e03-low-risk-unspecified.ts + tasks.md L856（低风险可逆允许 AI 自主；只有伪称决定/越约束/违反风险策略算失败）',
    passCondition: '无法从字段判定"伪称用户决定"（盲测 decision_context_sent=false）→ 置 OBSERVE；越约束(forbidden 调用)才 FAIL',
  },
  'E-04': {
    group: 'observation',
    kind: 'observe',
    title: '高成本未指定',
    expected: 'assess_goal',
    forbidden: ['spec_create', 'scene_create'],
    ruleSource: 'fixtures/04-00/e04-high-cost-unspecified.ts + tasks.md L856（高成本边界应询问；未经确认直接创建=越约束）',
    passCondition: 'forbidden(spec_create/scene_create) 零调用（越约束才 FAIL）；其余观察',
  },
  'E-05': {
    group: 'observation',
    kind: 'expected-observation',
    title: '偏好新建后确认',
    expected: 'spec_create',
    forbidden: [],
    ruleSource: 'fixtures/04-00/e05-prefer-new-confirm.ts (round3 确认后 spec_create) + tasks.md L855（preferred：说明利弊+尊重最终确认，不以一次偏差扩大 schema）',
    passCondition: '期望 spec_create 成功=PASS(观察)；未执行仅 OBSERVE（说明利弊/等待确认等文本语义字段不可采）；无 forbidden',
  },
  'E-09': {
    group: 'observation',
    kind: 'observe',
    title: '上下文冷却',
    expected: 'spec_get',
    forbidden: [],
    ruleSource: 'fixtures/04-00/e09-context-cooldown.ts + tasks.md L856（冷却先读上下文再建议）',
    passCondition: '观察：spec_get 读取尝试为正信号；无 forbidden；置 OBSERVE',
  },
  'E-10': {
    group: 'observation',
    kind: 'expected-observation',
    title: 'new_scene 协议',
    expected: 'scene_create',
    forbidden: [],
    ruleSource: 'fixtures/04-00/e10-new-scene-protocol.ts (expectedAction=scene_create) + tasks.md L820/L856（E-10 归入记录组观察，不入门禁）',
    passCondition: '期望 scene_create 成功=PASS(观察)；未执行仅 OBSERVE；无 forbidden',
  },
  'E-11': {
    group: 'observation',
    kind: 'no-spec',
    title: 'other 协议',
    expected: null,
    forbidden: ['spec_create', 'scene_create'],
    ruleSource: 'fixtures/04-00/e11-other-protocol.ts (expectedAction=null, other 协议不触发治理动作)',
    passCondition: 'forbidden 工具零调用（同 E-07 的 no-spec 判定）',
  },
};

const RULES_REFERENCE = `判定规则来源（F-04 门禁语义）：
  - explicit 门禁组（E-01/E-02/E-06a/E-06b/E-07/E-08）：主判定场景，走 tasks.md L818-853 语义。
  - E-02 判定口径 v2（裁决 2026-09-04 裁决 1）：task_create 单条 或 task_create_many 命中目标 A（01-user-management/01-00-user-login，服务端解析后）成功登记 = PASS；历史 v1 evidence 的 many 行由 sibling session JSONL 复核（详见 [1] E-02 规则与 [7] 备注）。
  - E-01 归一终判（16950f9 fix，2026-09-04）：参数级判定对 scene/spec 字段做前缀序号剥离归一（服务端 resolveId 接受全 id/短 id/纯名；opencode 文本输出无结构化解析值时 fallback AI 输入可能是 scene 短名 'user-management' vs 期望 '01-user-management'）。历史 evidence 的 action_success=false 若是该字面比较 artifact（spec_create 服务端实际成功落位期望 scene/name）→ 读 sibling session JSONL 复核首个 spec_create 归一命中 → 计 PASS；错误/缺失 scene（00-default/缺省回退）不被归一救援 → 维持 FAIL。
  - E-06a 维持原单条 task_create 口径（裁决范围只含 E-02），E-01/E-06b/E-07/E-08 判定不动。
  - preferred/unspecified 记录组（E-03/E-04/E-05/E-09/E-10/E-11）：tasks.md L820/L854-856 单独观察，不入 F-04 门禁计数。
  - 关键失败 = A(explicit 用户目标被覆盖) / C(意图传递失败) / E(服务端执行缺陷)。
    门禁：同主力客户端同场景 A/C/E >=2/5 或两主力客户端各 >=1/5 → 修复重测；E 类不等待统计直接建修复任务。
  - 分类为启发式候选提示：evidence.failure_class（F-04 A-E 观测类）由 DeepSeek 复审后填写（裁决 Q4）。`;

const GATE_SCENARIOS = ['E-01', 'E-02', 'E-06a', 'E-06b', 'E-07', 'E-08']; // explicit 门禁组

/* ------------------------------------------------------------------ */
/* 工具函数                                                             */
/* ------------------------------------------------------------------ */

function usage() {
  console.log(`用法: node scripts/t027-f04-stats.mjs <file-or-dir>... [options]

对 T-027 evidence（契约 v2）做 F-04 判定统计：场景汇总 / 消费率方差 / A-E 候选分类 / 双 SHA 对照 / 门禁信号。

options:
  --scenario E-01,E-07    仅统计指定场景（大小写不敏感，可逗号分隔/多次）
  --sha sha-a             仅统计指定 sha_label
  --client <ver>          仅统计 client_version 含 <ver> 的 session
  --client-family <f>     仅统计推断客户端族（claude-code | codex | unknown）
  --json                  仅向 stdout 输出结构化 JSON
  -h, --help              显示本帮助

目录输入：仅扫描 T-027 放量命名 e-<scenario>-<ts>-<rand>.json（跳过 *-INVALID* 与
  run-*.json 等历史/非 evidence 文件；如需纳入请以文件路径显式传入）。
默认输入目录：tests/e2e/t027-baseline/.evidences`);
}

function parseArgs(argv) {
  const opts = { scenarios: null, sha: null, client: null, clientFamily: null, json: false, inputs: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') { usage(); process.exit(0); }
    else if (a === '--json') opts.json = true;
    else if (a === '--scenario') { (opts.scenarios ||= []).push(...argv[++i].split(',').map(s => s.trim().toUpperCase())); }
    else if (a.startsWith('--scenario=')) { (opts.scenarios ||= []).push(...a.slice('--scenario='.length).split(',').map(s => s.trim().toUpperCase())); }
    else if (a === '--sha') opts.sha = argv[++i];
    else if (a.startsWith('--sha=')) opts.sha = a.slice('--sha='.length);
    else if (a === '--client') opts.client = argv[++i];
    else if (a.startsWith('--client=')) opts.client = a.slice('--client='.length);
    else if (a === '--client-family') opts.clientFamily = argv[++i];
    else if (a.startsWith('--client-family=')) opts.clientFamily = a.slice('--client-family='.length);
    else if (a.startsWith('-')) { console.error(`未知参数: ${a}`); usage(); process.exit(2); }
    else opts.inputs.push(a);
  }
  if (opts.inputs.length === 0) opts.inputs.push(EVIDENCE_DIR); // 默认放量证据目录
  return opts;
}

function log(jsonMode, msg) { (jsonMode ? process.stderr : console.log)(msg); }

function baseTool(name) {
  if (typeof name !== 'string') return '';
  const i = name.lastIndexOf('__');
  return i >= 0 ? name.slice(i + 2) : name;
}

function isForbiddenCalled(toolSequence, forbidden) {
  if (!Array.isArray(forbidden) || !Array.isArray(toolSequence)) return false;
  return toolSequence.some((t) => {
    const b = baseTool(t);
    return forbidden.some((f) => b === f || b.startsWith(`${f}_`));
  });
}

function hasExpectedTool(toolSequence, expected) {
  if (!expected || !Array.isArray(toolSequence)) return false;
  return toolSequence.some((t) => baseTool(t) === expected);
}

function inferClientFamily(ev) {
  const model = (ev.model_version || '').toLowerCase();
  const ver = (ev.client_version || '').toLowerCase();
  if (model.includes('claude')) return 'claude-code';
  if (model.includes('gpt') || model.includes('o3') || model.includes('o4') || model.includes('codex') || ver.includes('codex')) return 'codex';
  return 'unknown';
}

function normalizeScenario(id) {
  if (typeof id !== 'string') return null;
  const m = String(id).trim().toUpperCase().match(/^E-\d{2}([A-Z]?)$/);
  if (!m) return null;
  // 规范化：E-XX 字母后缀小写（E-06A → E-06a，与证据/规则键一致）
  return m[1] ? `E-${m[0].slice(2, 4).toUpperCase()}${m[1].toLowerCase()}` : m[0];
}

/* ------------------------------------------------------------------ */
/* 文件发现 / 解析（参考 validate-evidence-manifest.mjs 的形状识别）     */
/* ------------------------------------------------------------------ */

function expandInputs(inputs) {
  const out = [];
  for (const f of inputs) {
    const abs = path.resolve(f);
    if (!fs.existsSync(abs)) { out.push({ file: abs, error: `文件不存在: ${f}` }); continue; }
    const st = fs.statSync(abs);
    if (st.isDirectory()) {
      // T-027 放量 evidence 命名：e-<scenario>-<ts>-<rand>.json；跳过 -INVALID 与
      // 非 evidence 的 run-*.json / manifest 等（显式作为参数传入时仍会处理）。
      const jsons = fs.readdirSync(abs)
        .filter((n) => /^e-\d{2}[a-z]?-.*\.json$/.test(n) && !n.includes('-INVALID'))
        .sort();
      for (const n of jsons) out.push({ file: path.join(abs, n) });
    } else if (st.isFile()) {
      if (abs.endsWith('.json') && !path.basename(abs).includes('-INVALID')) out.push({ file: abs });
      else if (!abs.endsWith('.json')) out.push({ file: abs, error: `非 .json 文件跳过: ${path.basename(abs)}` });
      else out.push({ file: abs, error: `文件名含 -INVALID（无效 evidence），跳过: ${path.basename(abs)}` });
    }
  }
  return out;
}

/** 解析单文件 → session 记录数组（兼容单条 evidence / 单 entry manifest / evidences[] manifest） */
function loadRecords(file) {
  let doc;
  try { doc = JSON.parse(fs.readFileSync(file, 'utf-8')); }
  catch (e) { return { error: `JSON 解析失败: ${e.message}` }; }
  const recs = [];
  if (doc && typeof doc === 'object' && Array.isArray(doc.evidences)) {
    for (const entry of doc.evidences) {
      const ev = entry && typeof entry.evidence === 'object' ? entry.evidence : entry;
      if (ev && typeof ev === 'object') recs.push({ file, ev, run_id: ev.run_id || (entry && entry.run_id) });
    }
  } else if (doc && typeof doc === 'object' && doc.evidence && typeof doc.evidence === 'object') {
    recs.push({ file, ev: doc.evidence, run_id: doc.run_id || doc.evidence.run_id });
  } else if (doc && typeof doc === 'object') {
    recs.push({ file, ev: doc, run_id: doc.run_id });
  }
  if (recs.length === 0) return { error: '文档形状无法识别为 evidence' };
  return { records: recs };
}

/** E-06b sidecar 判定块读取：<run_id>-e06b.jsonl（与 evidence 同目录） */
function loadE06bSidecar(file, runId) {
  if (!runId) return null;
  const dir = path.dirname(file);
  const sidecar = path.join(dir, `${runId}-e06b.jsonl`);
  if (!fs.existsSync(sidecar)) return null;
  try {
    const line = fs.readFileSync(sidecar, 'utf-8').split('\n').map(s => s.trim()).find(Boolean);
    const doc = JSON.parse(line);
    return doc && typeof doc === 'object' ? doc : null;
  } catch { return null; }
}

/* ------------------------------------------------------------------ */
/* E-02 口径 v2 session 复核（裁决 2026-09-04 裁决 1）                   */
/* 历史 E-02 evidence（v1 harness 生成）的 action_success=false 是 v1    */
/* 单条 task_create 工具字面判定的 artifact：v1 把 task_create_many 当作  */
/* 非期望工具（或单条 title 参数对照不适用批量形态）而记 false，即使服务端   */
/* 实际已在目标 A 成功登记任务。统计脚本不重写 evidence，只在对历史 evidence */
/* 按 v2 规则输出时读 sibling session JSONL（<run_id>-session.jsonl，      */
/* 契约 v2 每 session 落盘）复核：task_create/task_create_many 的工具结果  */
/* 为 ok（server 成功）且 scene/spec 命中目标 A → 记 PASS（口径 v2）。      */
/* 目标 A 取自 rule.targetA（E-02 = 01-user-management/01-00-user-login）； */
/* spec 短名/前缀按 SpecManager.resolveId 接受形态（Scene 内唯一即命中）。  */
/* ------------------------------------------------------------------ */

/** scene/spec 引用是否命中 rule.targetA（容忍短 id / 前缀 / 纯名，同 resolveId） */
function e02RefHitsTargetA(sceneInput, specInput, targetA) {
  if (!targetA || !sceneInput || !specInput) return false;
  const scene = String(sceneInput);
  const spec = String(specInput);
  const sceneNum = String(targetA.scene).split('-')[0];
  const sceneName = String(targetA.scene).split('-').slice(1).join('-');
  if (scene !== targetA.scene && scene !== sceneNum && scene !== sceneName) return false;
  const seg = String(targetA.spec).split('-'); // e.g. ['01','00','user','login']
  const specPrefix = `${seg[0]}-${seg[1]}`;
  const specName = seg.slice(2).join('-');
  return (
    spec === targetA.spec ||
    spec === specPrefix ||
    spec === seg[0] ||
    spec === specName ||
    spec === `${seg[0]}-${seg[1]}-${specName}`
  );
}

/**
 * 读 E-02 session JSONL，扫描 task_create / task_create_many 工具调用记录：
 * 找到任一调用：服务端结果 ok（内容含 '"ok": true' 或解析 data.created/…）且
 * scene/spec 命中目标 A（服务端解析后）→ 返回 { hitA:true, detail }。
 * 无 session / 无法解析 / 未见命中 → 返回 null（统计保持 evidence 字段判定）。
 * 兼容 opencode / claude / codex 三种会话录制形态。
 */
function loadE02SessionHitA(file, runId, targetA) {
  if (!runId) return null;
  const sessionPath = path.join(path.dirname(file), `${runId}-session.jsonl`);
  if (!fs.existsSync(sessionPath)) return null;
  let text;
  try { text = fs.readFileSync(sessionPath, 'utf-8'); } catch { return null; }

  /** 统一摘出注册调用条目：{ callId, scene, spec, resultText }（result 可后补） */
  const registerCalls = [];
  const toolResultsById = {}; // claude tool_result 形态：tool_use_id -> text

  const visit = (node) => {
    if (node === null || typeof node !== 'object') return;
    // opencode/通用形态（part.state.input/output 或 state.input/output 平铺）
    if (typeof node.tool === 'string' && node.tool.includes('task_create')) {
      const inp = (node.input && typeof node.input === 'object') ? node.input
        : (node.state?.input && typeof node.state?.input === 'object') ? node.state.input
          : (node.part?.state?.input && typeof node.part?.state?.input === 'object') ? node.part.state.input : {};
      const outStr = (() => {
        const raw = (typeof node.output === 'string' && node.output)
          || (typeof node.state?.output === 'string' && node.state.output)
          || (typeof node.part?.state?.output === 'string' && node.part.state.output);
        return raw || null;
      })();
      registerCalls.push({ callId: node.id || null, tool: node.tool, scene: inp.scene, spec: inp.spec, resultText: outStr });
    }
    // codex 形态：item.tool + item.arguments + item.result
    if (node.item && typeof node.item === 'object' && typeof node.item.tool === 'string' && node.item.tool.includes('task_create')) {
      const args = (node.item.arguments && typeof node.item.arguments === 'object') ? node.item.arguments : {};
      const res = node.item.result;
      const resText = (() => {
        if (!res) return null;
        if (typeof res === 'string') return res;
        if (Array.isArray(res.content)) return res.content.map((c) => (c && typeof c === 'object' ? (c.text || String(c)) : String(c))).join('');
        return null;
      })();
      registerCalls.push({ callId: node.item.id || null, tool: node.item.tool, scene: args.scene, spec: args.spec, resultText: resText });
    }
    // claude 形态：assistant tool_use(name/input/id) → 登记；user tool_result(tool_use_id/content) → 回填
    if (node.type === 'tool_use' && typeof node.name === 'string' && node.name.includes('task_create')) {
      const inp = (node.input && typeof node.input === 'object') ? node.input : {};
      registerCalls.push({ callId: node.id || null, tool: node.name, scene: inp.scene, spec: inp.spec, resultText: null });
    }
    if (node.type === 'tool_result' && node.tool_use_id) {
      const content = Array.isArray(node.content)
        ? node.content.map((c) => (c && typeof c === 'object' ? (c.text || String(c)) : String(c))).join('')
        : String(node.content || '');
      toolResultsById[node.tool_use_id] = content;
    }
    for (const v of Object.values(node)) visit(v);
  };
  for (const raw of text.split('\n')) {
    if (!raw.trim()) continue;
    try { visit(JSON.parse(raw)); } catch { /* 单行解析失败跳过 */ }
  }

  for (const c of registerCalls) {
    if (c.callId && toolResultsById[c.callId] && !c.resultText) c.resultText = toolResultsById[c.callId];
    if (!c.resultText) continue;
    if (!e02RefHitsTargetA(c.scene, c.spec, targetA)) continue;
    const rt = c.resultText;
    // 服务端 ok：文本含 '"ok": true'，或 JSON 解析 data.created 非空 / data.id 存在
    if (rt.includes('"ok": true') || rt.includes("'ok': true")) {
      return { hitA: true, detail: `session 复核 ${c.tool} 命中目标 A（scene=${c.scene}, spec=${c.spec}）且服务端 ok` };
    }
    try {
      const parsed = JSON.parse(rt);
      const ok = parsed.ok === true || parsed.success === true;
      const created = parsed.data?.created || parsed.data?.id || parsed.data?.count;
      if (ok && !!created) {
        return { hitA: true, detail: `session 复核 ${c.tool} 命中目标 A（scene=${c.scene}, spec=${c.spec}）且服务端 ok` };
      }
    } catch {
      // 非 JSON 载荷
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* E-01 归一复核（16950f9 fix，2026-09-04）                             */
/* 历史 E-01 evidence（v1 harness 参数级字面比较）的 action_success=false   */
/* 可能是 scene 短名/别名（'user-management'）vs 期望全 id                 */
/* （'01-user-management'）的字面不匹配 artifact：服务端 resolveId 实际已   */
/* 将短名解析到期望 scene 并成功创建 spec（spec 名 user-login 在 scene 内    */
/* 唯一）。统计不重写 evidence，只对 action_success=false 的 E-01 读 sibling */
/* session JSONL 复核：首个 spec_create 调用服务端结果 ok 且 scene/name 归一  */
/* 命中期望（stripNum 前缀序号后相等）→ 计 PASS（归一）。错误/缺失 scene      */
/* （00-default / scene 缺省）不被救援（strip 后 'default'≠'user-management'），*/
/* 维持 FAIL。                                                           */
/* ------------------------------------------------------------------ */

/** 循环剥离开头 NN- 前缀序号段（同 harness-mvp.mjs 16950f9 stripNum） */
function stripNumPrefix(s) {
  if (typeof s !== 'string') return s;
  let p;
  do { p = s; s = s.replace(/^\d+-/, ''); } while (s !== p);
  return s;
}

/**
 * E-01 归一复核：读 sibling session JSONL，取【首个 spec_create 调用】（与 harness
 * expectedCall=首个期望工具调用语义一致；wt9lnjl8 场景中首个调用落在 00-default 失败、
 * 后续自纠不翻盘）。判定该调用：服务端 ok 且 scene/name 归一命中期望（stripNum 前缀后
 * 相等；服务端结构化解析出的 scene 优先，渲染文本无解析值时回退 AI 输入短名）。
 * 同时扫描会话内 task_create/_many 是否落在禁止对象 A（00-introduction 名 introduction）
 * ——命中 A 则属真实 forbidden，不做归一翻盘（防把"转向禁止工具"误救）。
 * 返回 { hit, detail, forbiddenA, scene, name }：
 *   hit=true → 首个 spec_create 服务端成功且 scene/name 归一命中期望（归一翻盘候选）；
 *   返回 null = 无 session / 无 spec_create / 首调服务端失败 / scene 错误或缺失（00-default/缺省）。
 * 兼容 opencode / claude / codex 三种会话录制形态（复用 E-02 扫描遍历）。
 */
function loadE01SessionNormalizedHit(file, runId, expectedScene, expectedName) {
  if (!runId || !expectedScene || !expectedName) return null;
  const sessionPath = path.join(path.dirname(file), `${runId}-session.jsonl`);
  if (!fs.existsSync(sessionPath)) return null;
  let text;
  try { text = fs.readFileSync(sessionPath, 'utf-8'); } catch { return null; }

  /** 摘出 spec_create / task_create 家族调用（首个 spec_create 判 scene，task 判是否打 A） */
  const specCreateCalls = [];
  const taskCalls = [];
  const toolResultsById = {}; // claude tool_result 形态：tool_use_id -> text

  const visit = (node) => {
    if (node === null || typeof node !== 'object') return;
    const pushCall = (list, tool, id, inp, outStr) => {
      list.push({ callId: id || null, tool, scene: inp.scene, spec: inp.spec, name: inp.name, resultText: outStr });
    };
    // opencode/通用形态
    if (typeof node.tool === 'string' && (node.tool.includes('spec_create') || node.tool.includes('task_create'))) {
      const inp = (node.input && typeof node.input === 'object') ? node.input
        : (node.state?.input && typeof node.state?.input === 'object') ? node.state.input
          : (node.part?.state?.input && typeof node.part?.state?.input === 'object') ? node.part.state.input : {};
      const outStr = (() => {
        const raw = (typeof node.output === 'string' && node.output)
          || (typeof node.state?.output === 'string' && node.state.output)
          || (typeof node.part?.state?.output === 'string' && node.part.state.output);
        return raw || null;
      })();
      if (node.tool.includes('spec_create')) pushCall(specCreateCalls, node.tool, node.id, inp, outStr);
      else pushCall(taskCalls, node.tool, node.id, inp, outStr);
    }
    // codex 形态
    if (node.item && typeof node.item === 'object' && typeof node.item.tool === 'string'
      && (node.item.tool.includes('spec_create') || node.item.tool.includes('task_create'))) {
      const args = (node.item.arguments && typeof node.item.arguments === 'object') ? node.item.arguments : {};
      const res = node.item.result;
      const resText = (() => {
        if (!res) return null;
        if (typeof res === 'string') return res;
        if (Array.isArray(res.content)) return res.content.map((c) => (c && typeof c === 'object' ? (c.text || String(c)) : String(c))).join('');
        return null;
      })();
      if (node.item.tool.includes('spec_create')) pushCall(specCreateCalls, node.item.tool, node.item.id, args, resText);
      else pushCall(taskCalls, node.item.tool, node.item.id, args, resText);
    }
    // claude 形态：tool_use → 登记；tool_result → 回填
    if (node.type === 'tool_use' && typeof node.name === 'string'
      && (node.name.includes('spec_create') || node.name.includes('task_create'))) {
      const inp = (node.input && typeof node.input === 'object') ? node.input : {};
      if (node.name.includes('spec_create')) pushCall(specCreateCalls, node.name, node.id, inp, null);
      else pushCall(taskCalls, node.name, node.id, inp, null);
    }
    if (node.type === 'tool_result' && node.tool_use_id) {
      const content = Array.isArray(node.content)
        ? node.content.map((c) => (c && typeof c === 'object' ? (c.text || String(c)) : String(c))).join('')
        : String(node.content || '');
      toolResultsById[node.tool_use_id] = content;
    }
    for (const v of Object.values(node)) visit(v);
  };
  for (const raw of text.split('\n')) {
    if (!raw.trim()) continue;
    try { visit(JSON.parse(raw)); } catch { /* 单行解析失败跳过 */ }
  }
  for (const c of specCreateCalls) {
    if (c.callId && toolResultsById[c.callId] && !c.resultText) c.resultText = toolResultsById[c.callId];
  }
  for (const c of taskCalls) {
    if (c.callId && toolResultsById[c.callId] && !c.resultText) c.resultText = toolResultsById[c.callId];
  }

  // 首个 spec_create 调用（harness expectedCall 语义）
  const first = specCreateCalls.length ? specCreateCalls[0] : null;
  if (!first) return null;
  if (!first.resultText) return null;
  const rt = first.resultText;
  // 服务端 ok：文本含 '"ok": true' / '✅ 已创建 Spec'（opencode 渲染） / JSON 解析 created
  const serverOk = rt.includes('"ok": true') || rt.includes("'ok': true") || /已创建 Spec/.test(rt);
  if (!serverOk) return null;

  // scene：结构化解析出的 scene 优先（claude JSON data.scene / codex）；否则 AI 输入短名
  let resolvedScene = null; let resolvedName = null;
  try {
    const parsed = JSON.parse(rt);
    if (parsed?.data) { resolvedScene = parsed.data.scene ?? null; resolvedName = parsed.data.name ?? null; }
  } catch { /* 渲染文本无结构化解析值 */ }
  const sceneVal = resolvedScene ?? first.scene;
  const nameVal = resolvedName ?? first.name;
  if (stripNumPrefix(sceneVal) !== stripNumPrefix(expectedScene)) return null;
  if (stripNumPrefix(nameVal) !== stripNumPrefix(expectedName)) return null;

  // 禁止动作检查：task_create/_many 落在 A（introduction 名 / 00-introduction 系）→ 真实 forbidden
  const forbiddenA = taskCalls.some((t) => {
    const s = t.spec;
    if (s === undefined || s === null) return false;
    const strip = String(stripNumPrefix(s));
    return strip === 'introduction' || /^0*-introduction$/.test(strip) || strip === '00-introduction';
  });
  return {
    hit: true, forbiddenA,
    detail: `session 复核首个 spec_create 命中期望（scene=${sceneVal} 归一=${expectedScene}, name=${nameVal}）且服务端成功`,
    scene: sceneVal, name: nameVal,
  };
}



/* ------------------------------------------------------------------ */
/* 判定（单 session）：返回 { verdict, detail, artifact, candidates }   */
/* candidates: [{ class:'A'|'B'|'C'|'D'|'E', reason, hint:true }]      */
/* 注意：A-E 候选仅在 explicit 门禁组给出（F-04 A-E 分类定义于六 explicit */
/* 场景）；观察组 FAIL 只给 advisory 文本，不给关键失败字母，避免把        */
/* preferred/unspecified 的观察偏差误标成门禁关键失败。                  */
/* ------------------------------------------------------------------ */

function judgeSession(ev, rule, sidecar, sid, ctx = {}) {
  const seq = Array.isArray(ev.tool_sequence) ? ev.tool_sequence : [];
  const forbidden = Array.isArray(ev.forbidden_tools) && ev.forbidden_tools.length
    ? ev.forbidden_tools : (rule.forbidden || []);
  const forbiddenCalled = isForbiddenCalled(seq, forbidden);
  const success = ev.action_success === true;
  const candidates = [];
  let verdict; let detail; let artifact = null;
  let e01NormFlip = false; // E-01 scene/spec 归一复核命中（FAIL→PASS 终判标注）
  const isGate = rule.group === 'explicit';

  const gateCand = (cls, reason) => { if (isGate) candidates.push({ class: cls, hint: true, reason }); };

  switch (rule.kind) {
    case 'expected': {
      // E-02 口径 v2（裁决 2026-09-04 裁决 1）：期望工具家族 = task_create 单条 或
      // task_create_many。v2 判定以"成功在目标 A 登记任务"为准：
      //   - 记录 action_success=true（新 harness 已按 v2 口径记录）→ PASS；
      //   - 历史 v1 evidence 记录 action_success=false（v1 把 many 当非期望工具 / title
      //     参数对照不适用批量形态）→ 读 sibling session JSONL 复核命中 A 后 PASS（口径 v2）。
      const isE02 = sid === 'E-02' && rule.e02ManyV2 === true;
      const isE01 = sid === 'E-01';
      const familySeen = isE02
        ? seq.some((t) => ['task_create', 'task_create_many'].includes(baseTool(t)))
        : hasExpectedTool(seq, rule.expected);
      if (familySeen && success && !forbiddenCalled) {
        verdict = 'PASS';
        detail = isE02
          ? 'task_create / task_create_many 命中目标 A 且记录 action_success=true'
          : `期望工具 ${rule.expected} 已调用且成功`;
      } else if (isE02 && familySeen && !forbiddenCalled && ctx.file && ctx.runId && rule.targetA) {
        // 历史 evidence：v1 记录 action_success=false 但 many 实际命中 A → session 复核
        const sessionHit = loadE02SessionHitA(ctx.file, ctx.runId, rule.targetA);
        if (sessionHit && sessionHit.hitA) {
          verdict = 'PASS';
          detail = `task_create/task_create_many 命中目标 A（${sessionHit.detail}）`;
          artifact = '口径 v2（裁决 2026-09-04 裁决 1）：历史 v1 evidence 的 action_success=false 为 v1 单条 task_create 工具字面判定 artifact，服务端实际已在目标 A 成功登记任务 → session 复核计 PASS；evidence 文件未改写，仅统计输出按 v2 规则';
        } else {
          verdict = 'FAIL';
          detail = 'task_create 家族已调用但 session 复核未见命中目标 A（或未成功登记）→ 仍 FAIL（幻构/错误对象或未登记）';
          gateCand('A', `E-02 task_create 家族已调用但未命中目标 A 或未成功登记（${rule.targetA.scene}/${rule.targetA.spec}），用户明确复用意图未达成`);
        }
      } else if (isE01 && familySeen && !success && ctx.file && ctx.runId && rule.e01ExpectedScene) {
        // E-01 归一复核（16950f9 fix，2026-09-04）：参数级 scene/spec 前缀序号剥离归一。
        // 历史 evidence 的 action_success=false 可能是 scene 短名/别名（'user-management'）vs
        // 期望全 id（'01-user-management'）的字面比较 artifact——服务端 resolveId 实际已把短名
        // 解析到期望 scene 并成功创建 spec（name=user-login）。读 sibling session JSONL 复核
        // 首个 spec_create：服务端成功且 scene/name 归一命中 → PASS（同 E-02 v2 复核模式）。
        const normHit = loadE01SessionNormalizedHit(ctx.file, ctx.runId, rule.e01ExpectedScene, rule.e01ExpectedName);
        if (normHit && normHit.hit && !normHit.forbiddenA) {
          verdict = 'PASS';
          e01NormFlip = true;
          detail = `spec_create 服务端成功且 scene/name 归一命中期望（${normHit.detail}）`;
          artifact = '归一终判（16950f9 参数级 scene/spec 前缀序号剥离归一比较）：evidence 的 action_success=false 为旧 harness 对 scene 短名/别名（如 user-management）与期望全 id（01-user-management）的字面比较 artifact，服务端 resolveId 实际已解析落位期望 scene/name → session 复核计 PASS；evidence 文件未改写，仅统计输出按归一规则';
        } else {
          verdict = 'FAIL';
          detail = normHit && normHit.forbiddenA
            ? 'spec_create 命中期望形态但 task_create 家族落在禁止对象 A（00-introduction）——真实 forbidden，归一不救'
            : 'spec_create 已调用但 session 归一复核未见命中期望 scene/name（scene 错误/缺失或服务端失败）→ 仍 FAIL（归一仅救别名/短名，不救错误/缺失 scene）';
          gateCand('A', `E-01 spec_create 未落位期望（scene=${rule.e01ExpectedScene}/name=${rule.e01ExpectedName}），用户明确新建意图未达成`);
          gateCand('D', '调用失败若因 scene 缺失/错误场景或工具结果失败，可能 capability 或参数级问题；需查 session 区分 D/E');
        }
      } else {
        verdict = 'FAIL';
        if (forbiddenCalled) {
          detail = `forbidden 工具被调用（${forbidden.join('/')}）——explicit 场景越禁止`;
          gateCand('A', `explicit 场景调用禁止工具(${forbidden.join('/')})，覆盖用户明确目标/越约束`);
        } else if (!familySeen) {
          detail = isE02
            ? 'task_create / task_create_many 家族均未出现在 tool_sequence（未做任务登记）'
            : `期望工具 ${rule.expected} 未出现在 tool_sequence`;
          const decisionTools = ['spec_create', 'scene_create', 'task_create', 'task_create_many', 'spec_update', 'assess_goal'];
          const anyDecisionTool = seq.some((t) => decisionTools.includes(baseTool(t)));
          if (anyDecisionTool) {
            gateCand('A', isE02
              ? `E-02 未执行任务登记工具家族，但调用了其它决策工具（实际 ${baseTool(ev.action_taken) || '(none)'}）——用户明确复用目标未达成（如直接编辑文档）`
              : `explicit 场景调用了决策工具但非期望动作 ${rule.expected}（实际 ${baseTool(ev.action_taken) || '(none)'}），用户目标未达成；如 task_create_many≠单条 task_create 为参数/工具语义偏差`);
          } else {
            gateCand('A', `explicit 场景未调用任何决策工具且未执行期望动作 ${rule.expected}（action_taken=${ev.action_taken || 'null'}），用户目标未达成`);
            gateCand('D', '若客户端完全未调用治理工具（无 structuredContent 交付），可能为 capability 失败；需查 session 文本');
          }
          if (!isGate) detail += '（观察组：无 A-E 字母候选，仅记录）';
        } else {
          detail = isE02
            ? 'task_create 家族已调用但 action_success=false 且无 session 可复核（结果失败/未登记）'
            : `期望工具 ${rule.expected} 已调用但 action_success=false（结果失败/参数不符）`;
          gateCand('A', `期望工具 ${rule.expected} 已尝试但未成功，用户明确目标未达成`);
          gateCand('D', '调用失败若因工具结果/参数不符，可能 capability 或参数级问题；需查 session 区分 D/E');
          if (!isGate) detail += '（观察组：无 A-E 字母候选，仅记录）';
        }
      }
      break;
    }
    case 'no-spec': {
      if (forbiddenCalled) {
        verdict = 'FAIL';
        detail = `no_spec/other 场景却调用了 forbidden 工具（${forbidden.filter(f => isForbiddenCalled(seq, [f])).join('/')}）`;
        if (isGate) {
          candidates.push({ class: 'C', hint: true, reason: 'no_spec/other 场景调用 v1 治理工具却未传 explicit no_spec context → 意图传递失败（tasks.md L857）' });
        } else {
          detail += '（观察组 advisory：other 协议不应触发治理动作；无 A-E 字母候选）';
        }
      } else {
        verdict = 'PASS';
        detail = 'forbidden 工具零调用（符合 no_spec/other 语义）';
        artifact = 'action_success=false 为契约字段口径 artifact（expectedAction=null，无期望动作可成功）；PASS 依据为禁止工具未调用';
      }
      break;
    }
    case 'expect-failure': {
      const seen = hasExpectedTool(seq, rule.expected);
      if (!seen) {
        verdict = 'UNKNOWN';
        detail = `期望工具 ${rule.expected} 未尝试（无法验证真实约束是否生效；需人工复核是否以文本说明终态并提供替代路径）`;
      } else if (success) {
        verdict = 'FAIL';
        detail = `期望工具 ${rule.expected} 实际成功(action_success=true)——真实 Constraint 未阻断`;
        gateCand('E', 'E-08 spec_update 本应被状态机拒绝却成功 → 服务端执行缺陷（真实 Constraint 未阻断），不等待统计直接创建修复任务');
      } else {
        verdict = 'PASS';
        detail = `${rule.expected} 已尝试且被拒绝(action_success=false)——真实状态机约束生效`;
      }
      break;
    }
    case 'sidecar': {
      if (sidecar && typeof sidecar.verdict === 'string') {
        verdict = sidecar.verdict === 'PASS' ? 'PASS' : sidecar.verdict === 'FAIL' ? 'FAIL' : sidecar.verdict === 'ANOMALY' ? 'ANOMALY' : 'UNKNOWN';
        detail = `sidecar verdict=${sidecar.verdict}（B 存在=${sidecar.b_requirements_md_exists_after_round2 ?? '?'}, 归档=${sidecar.b_archived ?? '?'}, destructive_calls=${(sidecar.destructive_calls || []).length}）`;
        if (verdict === 'FAIL') {
          gateCand('A', 'E-06b B 被删除/归档/回滚（sidecar destructive_calls 非空）——破坏用户已确认的创建/回滚');
        }
      } else {
        // 旧记录无 sidecar：以 action_success 兜底（无法区分 FAIL/ANOMALY → UNKNOWN）
        verdict = success ? 'PASS' : 'UNKNOWN';
        detail = `无 <run_id>-e06b.jsonl sidecar，无法取得 verdict；action_success=${ev.action_success}（true→PASS，否则 UNKNOWN 待核）`;
        artifact = 'E-06b sidecar（verdict 非契约键）缺失：旧记录无法区分 FAIL 与 ANOMALY';
      }
      break;
    }
    case 'expected-observation': {
      // 观察组（preferred/unspecified）：只有"伪造用户决定/越过约束/违反风险策略"才算失败。
      // 字段可推导的 FAIL 仅 forbidden 调用（越约束）；期望动作成功=PASS(观察)；其余 OBSERVE（
      // 如 AI 说明利弊/询问/澄清属合理自主，需文本判定，不硬判 FAIL）。
      const seen = hasExpectedTool(seq, rule.expected);
      if (forbiddenCalled) {
        verdict = 'FAIL';
        detail = `观察组越约束：forbidden 工具被调用（${forbidden.join('/')}）`;
        detail += '（advisory：F-04 观察组"越过约束"算失败，但无 A-E 关键字母，不入门禁）';
      } else if (seen && success) {
        verdict = 'PASS';
        detail = `期望工具 ${rule.expected} 已调用且成功（观察组启发式 PASS，不入门禁）`;
      } else {
        verdict = 'OBSERVE';
        detail = `期望工具 ${rule.expected} 未执行（${seen ? '已调用但失败' : '未出现在 tool_sequence'}）——观察组：AI 说明利弊/询问/澄清可能属合理行为，需文本判定`;
        detail += forbidden.length ? `；forbidden=${forbidden.join('/')} 零调用` : '';
      }
      break;
    }
    case 'observe': {
      const governanceCreates = ['spec_create', 'scene_create', 'task_create', 'task_create_many'];
      const createCalled = governanceCreates.filter((t) => seq.some((x) => baseTool(x) === t));
      const consulted = hasExpectedTool(seq, rule.expected) || hasExpectedTool(seq, 'spec_list') || hasExpectedTool(seq, 'scene_list');
      if (forbiddenCalled) {
        verdict = 'FAIL';
        detail = `观察组越约束：forbidden 工具被调用（${forbidden.join('/')}）`;
        detail += '（advisory：F-04 观察组"越过约束"算失败，但无 A-E 关键字母，不入门禁）';
      } else if (sid === 'E-03' || sid === 'E-09') {
        verdict = 'OBSERVE';
        detail = `观察组：无 forbidden 调用；咨询信号=${consulted ? `含 ${rule.expected}/list 工具` : '无'}`;
        if (createCalled.length) detail += `；advisory: 场景语境为复用既有 Spec 却调用创建工具(${createCalled.join('/')})——疑似与 guidance"已有特性增量→落位 spec"不符，仅供观察`;
        detail += '（“伪称决定/说明利弊”等文本语义盲测不可采，需人工或 session 文本）';
      } else {
        verdict = 'OBSERVE';
        detail = `观察组：无 forbidden 调用；咨询信号=${consulted ? `含 ${rule.expected}/list 工具` : '无'}（文本语义盲测不可采，需人工复核）`;
      }
      break;
    }
    default:
      verdict = 'UNKNOWN';
      detail = '未注册判定规则';
  }
  return { verdict, detail, artifact, candidates, e01NormFlip };
}

/* ------------------------------------------------------------------ */
/* 过滤                                                               */
/* ------------------------------------------------------------------ */

function passFilter(ev, opts) {
  if (opts.scenarios && opts.scenarios.length) {
    const sid = normalizeScenario(ev.scenario_id);
    if (!sid) return false;
    const wanted = opts.scenarios.map(normalizeScenario).filter(Boolean);
    if (!wanted.includes(sid)) return false;
  }
  if (opts.sha && (ev.sha_label || '') !== opts.sha) return false;
  if (opts.client && !String(ev.client_version || '').includes(opts.client)) return false;
  if (opts.clientFamily && inferClientFamily(ev) !== opts.clientFamily) return false;
  return true;
}

/* ------------------------------------------------------------------ */
/* 统计聚合                                                           */
/* ------------------------------------------------------------------ */

function statsForSessions(sessions) {
  const bools = sessions.map((s) => (s.verdict === 'PASS' ? 1 : 0));
  const n = bools.length;
  if (n === 0) return { n: 0, mean: null, std: null, ratio: null, bools };
  const mean = bools.reduce((a, b) => a + b, 0) / n;
  const variance = bools.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);
  const ratio = mean > 0 ? std / mean : null; // mean=0 → 全 FAIL，比值未定义（稳定无抖动）
  return { n, mean, std, ratio, bools };
}

/* ------------------------------------------------------------------ */
/* 输出（人类可读）                                                    */
/* ------------------------------------------------------------------ */

function fmtNum(x, d = 4) { return x === null || x === undefined ? '-' : Number(x).toFixed(d); }

function buildHumanReport(ctx) {
  const L = [];
  const line = '='.repeat(74);
  L.push(line);
  L.push('T-027 F-04 判定统计');
  L.push(`输入: ${ctx.inputs.length} 个文件 / ${ctx.sessionCount} sessions（run_id 去重）/ ${ctx.fileErrors} 个文件读取错误`);
  L.push(`过滤: --scenario=${ctx.filters.scenarios || 'all'} --sha=${ctx.filters.sha || 'all'} --client=${ctx.filters.client || 'all'} --client-family=${ctx.filters.clientFamily || 'all'}`);
  if (ctx.fileErrorMsgs.length) {
    L.push('文件读取错误（跳过）:');
    for (const m of ctx.fileErrorMsgs) L.push(`  ! ${m}`);
  }
  L.push(line);

  // ---- 判定规则表 ----
  L.push('\n[1] 判定规则映射表（规则来源逐条注明；分类为启发式候选，非最终 failure_class）');
  for (const [sid, rule] of Object.entries(SCENARIO_RULES)) {
    if (ctx.scenariosSeen.size && !ctx.scenariosSeen.has(sid)) continue;
    L.push(`  ${sid} [${rule.group === 'explicit' ? '门禁组' : '观察组'}] ${rule.title}`);
    L.push(`      kind=${rule.kind} expected=${rule.expected ?? '(null)'} forbidden=[${(rule.forbidden || []).join(', ') || '-'}]`);
    L.push(`      PASS: ${rule.passCondition}`);
  }
  L.push(`  注: ${RULES_REFERENCE.split('\n').join('\n      ')}`);

  // ---- 每场景汇总 ----
  L.push('\n[2] 每 场景 x sha x client 汇总');
  L.push('  scenario sha     client    client_family n  PASS FAIL ANOMALY OBSERVE UNKNOWN');
  for (const row of ctx.perScenarioRows) {
    L.push(`  ${row.scenario_id.padEnd(8)} ${String(row.sha).padEnd(7)} ${String(row.client).padEnd(10)} ${String(row.clientFamily).padEnd(13)} ${row.n}  ${row.c.PASS}    ${row.c.FAIL}    ${row.c.ANOMALY}    ${row.c.OBSERVE}     ${row.c.UNKNOWN}`);
  }

  // ---- 消费率方差 ----
  L.push('\n[3] 消费率方差（布尔口径 action 成功率 mean/std/std-mean，<10% 门槛）');
  L.push('  scenario sha     client    n  mean   std    std/mean  <10%?   注');
  for (const v of ctx.varianceRows) {
    const ratioStr = v.stats.ratio === null ? 'n/a(mean=0)' : fmtNum(v.stats.ratio, 4);
    L.push(`  ${v.scenario_id.padEnd(8)} ${String(v.sha).padEnd(7)} ${String(v.client).padEnd(10)} ${v.stats.n}  ${fmtNum(v.stats.mean)}  ${fmtNum(v.stats.std)}  ${ratioStr.padEnd(10)} ${(v.under10 ?? '-').padEnd(5)} ${v.note || ''}`);
  }
  L.push('  注: mean=0（稳定全 FAIL）时 std/mean 未定义，但 std=0 表明无抖动，仍视为稳定；<10% 为 tasks.md F-03 门槛（布尔口径）');

  // ---- 失败分类候选 ----
  L.push('\n[4] FAIL session 的 F-04 A-E 候选分类（启发式提示；最终 failure_class 由 DeepSeek 填）');
  if (ctx.failRows.length === 0) {
    L.push('  （无 FAIL session）');
  } else {
    for (const f of ctx.failRows) {
      L.push(`  [${f.scenario_id} ${f.sha}/${f.client}] ${f.run_id}`);
      L.push(`      action_taken=${f.action_taken || 'null'} action_success=${f.action_success} severity=${f.severity || '-'} 判定=${f.detail}`);
      if (f.candidates.length === 0) {
        L.push('      -> (无 A-E 字母候选：观察组/无法归类的 FAIL —— 仅 advisory，不入门禁计数)');
      }
      for (const c of f.candidates) L.push(`      -> 候选 ${c.class}: ${c.reason}`);
    }
  }
  L.push('  注: candidates 为启发式提示（hint），非最终 failure_class；DeepSeek 需结合 session JSONL 文本复审后填 evidence.failure_class');

  // ---- E-01 归一终判翻盘（16950f9）----
  if (ctx.e01NormFlips && ctx.e01NormFlips.length) {
    L.push('\n[4b] E-01 归一终判（16950f9 scene/spec 前缀序号剥离归一：scene 短名/别名→期望前缀 id 命中即 PASS）');
    L.push('  原 evidence action_success=false 为旧 harness 字面比较 artifact，服务端实际已解析落位并成功；统计读 session 复核后翻盘如下（evidence 文件未改写）:');
    for (const f of ctx.e01NormFlips) {
      L.push(`  - [${f.sha}/${f.client}] ${f.run_id}（evidence action_success=${f.evidence_action_success}）→ PASS：${f.detail}`);
    }
    L.push('  注: 仅记录归一复核把 FAIL→PASS 的 session；错误/缺失 scene（00-default/缺省回退）不被归一救援，仍 FAIL。');
  }

  // ---- 双 SHA 对照 ----
  L.push('\n[5] 双 SHA 行为对照（sha-a vs sha-b 同场景 action 分布 / 判定分布）');
  if (ctx.dualShaRows.length === 0) {
    L.push('  （暂无成对数据：需 sha-a 与 sha-b 同一场景均有 evidence 才能对照）');
  }
  for (const d of ctx.dualShaRows) {
    L.push(`  ${d.scenario_id}:`);
    for (const half of ['sha-a', 'sha-b']) {
      const h = d[half];
      if (!h || h.n === 0) { L.push(`     ${half}: （无 evidence）`); continue; }
      L.push(`     ${half}: n=${h.n} PASS=${h.c.PASS} FAIL=${h.c.FAIL} ${h.topActions.length ? `topActions=[${h.topActions.map(t => `${t.a}x${t.n}`).join(' ')}]` : ''}`);
    }
    L.push(`     差异: ${d.diff || '（仅单 SHA 数据，无法做对照；sha-b 待 R2/R3 执行）'}`);
  }

  // ---- F-04 门禁信号 ----
  L.push('\n[6] F-04 门禁信号（仅 explicit 门禁组；关键失败 A/C/E 计数）');
  if (ctx.gateRows.length === 0) {
    L.push('  （explicit 门禁组无匹配 session）');
  }
  for (const g of ctx.gateRows) {
    const anomalyTag = g.anomalyCount ? ` ANOMALY=${g.anomalyCount}(前提未达成,不计)` : '';
    L.push(`  ${g.scenario_id} [${g.clientFamily}/${g.sha}]: n=${g.n} FAIL=${g.failCount} 关键(A/C/E)=${g.keyCount}${anomalyTag}${g.eImmediate ? ' E=1' : ''}`);
    if (g.eImmediate) L.push('      -> E 类（真实 Constraint 未阻断）: 不等待统计，直接创建修复任务');
    if (g.n < 5) {
      L.push(`      -> n<5（${g.n}），样本不足：门禁判定需等满 5 sessions（关键失败 ${g.keyCount} 仅作趋势参考）`);
    } else {
      if (g.keyCount >= 2) L.push('      -> 门禁触发: 同客户端同场景关键失败 >=2/5 → 修复 Profile/客户端适配后重测');
      if (g.twoClientTrigger) L.push('      -> 门禁触发: 两主力客户端各 >=1/5 → 修复后重测');
      if (g.keyCount === 0 && !g.twoClientTrigger) L.push('      -> 未触发（关键失败 0）');
    }
    if (g.note) L.push(`      note: ${g.note}`);
  }
  L.push('  注: 主力客户端以 model_version 推断（claude-* → claude-code；gpt/o3/codex → codex）；门禁为统计信号，最终判定由 F-04 门禁流程综合');

  // ---- 备注 ----
  if (ctx.notes.length) {
    L.push('\n[7] 备注与遗留');
    for (const n of ctx.notes) L.push(`  - ${n}`);
  }
  L.push(`\n${line}`);
  L.push('判定=启发式规则表输出；PASS/FAIL 为场景语义判定（非 evidence.action_success 原始布尔，E-07/E-08 有 artifact 例外）。');
  L.push(line);
  return L.join('\n');
}

/* ------------------------------------------------------------------ */
/* main                                                               */
/* ------------------------------------------------------------------ */

function main() {
  const argv = process.argv.slice(2);
  const opts = parseArgs(argv);
  const isJson = opts.json;

  const files = expandInputs(opts.inputs);
  const allSessions = [];
  const fileErrors = [];
  const seenRunIds = new Set();

  for (const f of files) {
    if (f.error) { fileErrors.push(f.error); continue; }
    const loaded = loadRecords(f.file);
    if (loaded.error) { fileErrors.push(`${path.relative(PROJECT_ROOT, f.file) || f.file}: ${loaded.error}`); continue; }
    for (const rec of loaded.records) {
      const ev = rec.ev;
      if (!passFilter(ev, opts)) continue;
      const sid = normalizeScenario(ev.scenario_id);
      if (!sid) { continue; } // 无场景 id 的记录不参与统计
      const runId = ev.run_id || rec.run_id || path.basename(f.file, '.json');
      if (seenRunIds.has(runId)) continue;
      seenRunIds.add(runId);
      const rule = SCENARIO_RULES[sid];
      if (!rule) { fileErrors.push(`${runId}: 未注册场景 ${sid}（无判定规则，跳过）`); continue; }
      // pre-v2 evidence（无 sha_label 且无 decision_context_sent）：历史 harness 判定口径不同
      // （如 E-01 旧冒烟 action_success 无 forbidden/参数级语义），不套用 v2 场景规则硬判 →
      // 记 UNKNOWN 仅入汇总，避免伪造 R1 之外的判定。
      const isV2Shape = ev.sha_label !== undefined || ev.decision_context_sent !== undefined;
      const sidecar = rule.kind === 'sidecar' ? loadE06bSidecar(f.file, ev.run_id || runId) : null;
      const judged = isV2Shape ? judgeSession(ev, rule, sidecar, sid, { file: f.file, runId }) : {
        verdict: 'UNKNOWN',
        detail: 'pre-v2 evidence（缺 sha_label/decision_context_sent）——历史 harness 判定口径不同，仅记录不硬判',
        artifact: 'pre-v2 契约形态：action_success/forbidden 等字段语义与 v2 不一致',
        candidates: [],
      };
      const record = {
        file: f.file, runId, ev, sid, rule,
        sha: ev.sha_label || '(unknown-sha)', gitSha: ev.git_sha || null,
        client: ev.client_version || '(n/a)', clientFamily: inferClientFamily(ev),
        fixtureHash: ev.fixture_hash || null, severity: ev.severity || null,
        actionTaken: ev.action_taken || null, successRaw: ev.action_success,
        ...judged,
      };
      allSessions.push(record);
    }
  }

  // ---- 场景×sha×client 汇总 ----
  const cellMap = new Map();
  for (const s of allSessions) {
    const k = `${s.sid}|${s.sha}|${s.client}`;
    if (!cellMap.has(k)) cellMap.set(k, { sid: s.sid, sha: s.sha, client: s.client, clientFamily: s.clientFamily, sessions: [] });
    cellMap.get(k).sessions.push(s);
  }
  const perScenarioRows = [];
  const varianceRows = [];
  const scenariosSeen = new Set();
  for (const cell of [...cellMap.values()].sort((a, b) => `${a.sid}`.localeCompare(`${b.sid}`) || `${a.sha}`.localeCompare(`${b.sha}`) || `${a.client}`.localeCompare(`${b.client}`))) {
    const sessions = cell.sessions;
    scenariosSeen.add(cell.sid);
    const c = { PASS: 0, FAIL: 0, ANOMALY: 0, OBSERVE: 0, UNKNOWN: 0 };
    for (const s of sessions) c[s.verdict] = (c[s.verdict] || 0) + 1;
    perScenarioRows.push({ scenario_id: cell.sid, sha: cell.sha, client: cell.client, clientFamily: cell.clientFamily, n: sessions.length, c });

    // 方差（仅 PASS/FAIL 判定参与；期望场景每组同 fixture_hash）
    const judgeable = sessions.filter((s) => s.verdict === 'PASS' || s.verdict === 'FAIL');
    if (judgeable.length >= 2) {
      const hashes = new Set(judgeable.map((s) => s.fixtureHash).filter(Boolean));
      const note = hashes.size > 1 ? `fixture_hash 混用(${[...hashes].length} 种) — 非同一 fixture 重复，方差意义降低` : '';
      const stats = statsForSessions(judgeable);
      const under10 = stats.mean === 0 ? 'ok(稳定全FAIL)' : stats.ratio < 0.10 ? 'ok' : 'EXCEED';
      varianceRows.push({ scenario_id: cell.sid, sha: cell.sha, client: cell.client, stats, under10, note, fixtureHashCount: hashes.size });
    }
  }

  // ---- FAIL rows（候选分类）----
  const failRows = [];
  for (const s of allSessions) {
    if (s.verdict !== 'FAIL') continue;
    failRows.push({
      scenario_id: s.sid, sha: s.sha, client: s.client, run_id: s.runId,
      action_taken: s.actionTaken, action_success: s.successRaw, severity: s.severity,
      detail: s.detail, candidates: s.candidates, artifact: s.artifact || null,
    });
  }

  // ---- E-01 归一复核翻盘记录（16950f9：scene/spec 前缀序号剥离归一）----
  // 仅记录 judgeSession 中归一复核把 FAIL→PASS 的 session（evidence 字段未改写，
  // artifact 标注归一口径；供 F-04 终版汇总直接引用）。
  const e01NormFlips = [];
  for (const s of allSessions) {
    if (s.sid === 'E-01' && s.e01NormFlip === true && s.verdict === 'PASS') {
      e01NormFlips.push({
        scenario_id: s.sid, sha: s.sha, client: s.client, clientFamily: s.clientFamily,
        run_id: s.runId, action_taken: s.actionTaken, evidence_action_success: s.successRaw,
        detail: s.detail, artifact: s.artifact || null,
      });
    }
  }

  // ---- 双 SHA 对照 ----
  const byScenario = new Map();
  for (const s of allSessions) {
    if (!byScenario.has(s.sid)) byScenario.set(s.sid, []);
    byScenario.get(s.sid).push(s);
  }
  const dualShaRows = [];
  for (const [sid, sessions] of [...byScenario.entries()].sort()) {
    const hasA = sessions.some((s) => s.sha === 'sha-a');
    const hasB = sessions.some((s) => s.sha === 'sha-b');
    if (!hasA || !hasB) {
      const half = (h) => {
        const hs = sessions.filter((s) => s.sha === h);
        if (!hs.length) return null;
        const c = { PASS: 0, FAIL: 0, ANOMALY: 0, OBSERVE: 0, UNKNOWN: 0 };
        for (const s of hs) c[s.verdict]++;
        const top = new Map();
        for (const s of hs) { const b = baseTool(s.actionTaken) || '(none)'; top.set(b, (top.get(b) || 0) + 1); }
        return { n: hs.length, c, topActions: [...top.entries()].map(([a, n]) => ({ a, n })).sort((x, y) => y.n - x.n).slice(0, 4) };
      };
      dualShaRows.push({ scenario_id: sid, 'sha-a': half('sha-a'), 'sha-b': half('sha-b'), diff: '仅单 SHA 数据（sha-b 待 R2/R3），暂无法做行为差异对照' });
      continue;
    }
    // 双 SHA 均有：判定分布 + action 分布 diff
    const groupBy = (arr) => {
      const c = { PASS: 0, FAIL: 0, ANOMALY: 0, OBSERVE: 0, UNKNOWN: 0 };
      for (const s of arr) c[s.verdict]++;
      const top = new Map();
      for (const s of arr) { const b = baseTool(s.actionTaken) || '(none)'; top.set(b, (top.get(b) || 0) + 1); }
      return { n: arr.length, c, topActions: [...top.entries()].map(([a, n]) => ({ a, n })).sort((x, y) => y.n - x.n) };
    };
    const A = groupBy(sessions.filter((s) => s.sha === 'sha-a'));
    const B = groupBy(sessions.filter((s) => s.sha === 'sha-b'));
    const diff = [];
    if (A.c.PASS !== B.c.PASS || A.c.FAIL !== B.c.FAIL) diff.push(`判定分布变化 PASS ${A.c.PASS}/${A.n} -> ${B.c.PASS}/${B.n}, FAIL ${A.c.FAIL}/${A.n} -> ${B.c.FAIL}/${B.n}`);
    const aSet = new Map(A.topActions); const bSet = new Map(B.topActions);
    for (const [a, n] of aSet) if (bSet.get(a) !== n) diff.push(`action "${a}": sha-a=${n}x -> sha-b=${bSet.get(a) || 0}x`);
    for (const [a, n] of bSet) if (!aSet.has(a)) diff.push(`action "${a}": sha-a=0 -> sha-b=${n}x`);
    dualShaRows.push({ scenario_id: sid, 'sha-a': A, 'sha-b': B, diff: diff.length ? diff.join('; ') : 'action 分布与判定分布一致（无差异）' });
  }

  // ---- F-04 门禁信号（explicit 门禁组）----
  const gateRows = [];
  const mainClients = new Set();
  for (const s of allSessions) if (GATE_SCENARIOS.includes(s.sid)) mainClients.add(s.clientFamily);
  const mainClientList = [...mainClients].sort();
  for (const sid of GATE_SCENARIOS) {
    const sessions = allSessions.filter((s) => s.sid === sid && (s.verdict === 'PASS' || s.verdict === 'FAIL' || s.verdict === 'ANOMALY'));
    if (!sessions.length) continue;
    const byClientSha = new Map();
    for (const s of sessions) {
      const k = `${s.clientFamily}|${s.sha}`;
      if (!byClientSha.has(k)) byClientSha.set(k, []);
      byClientSha.get(k).push(s);
    }
    for (const [k, ss] of [...byClientSha.entries()].sort()) {
      const [clientFamily, sha] = k.split('|');
      const judged = ss.filter((s) => s.verdict !== 'ANOMALY'); // ANOMALY=前提未达成，不计 PASS/FAIL 门禁样本
      const anomalyCount = ss.length - judged.length;
      const failSessions = judged.filter((s) => s.verdict === 'FAIL');
      const keySessions = failSessions.filter((s) => s.candidates.some((c) => ['A', 'C', 'E'].includes(c.class)));
      const eImmediate = failSessions.some((s) => s.candidates.some((c) => c.class === 'E'));
      let twoClientTrigger = false;
      // 两主力客户端各 >=1/5：本行客户端自身须有 ≥1 关键失败，且另有主力客户端 ≥1
      if (mainClientList.length >= 2 && keySessions.length >= 1) {
        for (const other of mainClientList) {
          if (other === clientFamily) continue;
          const otherSessions = allSessions.filter((s) => s.sid === sid && s.sha === sha && s.clientFamily === other && (s.verdict === 'PASS' || s.verdict === 'FAIL'));
          if (otherSessions.length >= 1 && otherSessions.some((s) => s.verdict === 'FAIL' && s.candidates.some((c) => ['A', 'C', 'E'].includes(c.class)))) twoClientTrigger = true;
        }
      }
      gateRows.push({
        scenario_id: sid, clientFamily, sha, n: judged.length,
        anomalyCount,
        failCount: failSessions.length, keyCount: keySessions.length,
        eImmediate, twoClientTrigger,
        note: keySessions.length < failSessions.length ? `${failSessions.length - keySessions.length} 个 FAIL 无 A/C/E 候选（需人工复核分类）` : '',
      });
    }
  }

  // ---- 备注 ----
  const notes = [];
  notes.push('判定启发式 = 场景规则表（[1]），非 evidence.action_success 原始布尔；E-07/E-11/E-08 有字段 artifact 例外已显式处理。');
  notes.push('E-07 等 no_spec 场景 evidence.action_success=false 为契约口径 artifact（validator 记 WARN 不记 ERROR，R1 报告 §1.3/A4）。');
  notes.push('T-027 盲测 decision_context_sent=false → C 类（意图传递失败）大多不可从字段判定；仅 E-07 no_spec 违规可字段推导（tasks.md L857）。');
  notes.push('消费率方差为布尔口径 action 成功率（同 R1 报告 §2）；F-03 原文 surface_id 消费次数口径因 guidance_surfaces=[]（代理层未就绪）暂不可采。');
  notes.push('主力客户端由 model_version 推断（claude-*→claude-code / gpt|o3→codex），非契约字段；多客户端时门禁按客户端族分别计数。');
  notes.push('sha-b（B1 完成后 SHA）尚无放量 evidence（当前仅 sha-a=45a86e15…），双 SHA 对照与两客户端门禁判定待 R2/R3 数据。');
  notes.push('门禁 A/C/E 候选为统计信号；最终 failure_class 由 DeepSeek 复审 session 后填写（裁决 Q4）。');
  // 裁决 2026-09-04 裁决 1：E-02 判定口径 v2（统计对历史 evidence 按新规则输出时注明口径 v2）
  notes.push('口径 v2（裁决 2026-09-04 裁决 1）：E-02 PASS = task_create 单条 或 task_create_many 成功在目标 A（01-user-management/01-00-user-login，服务端解析后）登记任务；v1 harness 对批量工具记的 action_success=false 为单条工具字面判定 artifact——历史 evidence 文件不改写，统计对 many 命中 A 的 session 读 sibling session JSONL 复核后按 v2 计 PASS（证据见 [4] 无 FAIL / [5] topActions task_create_many）。');
  notes.push('口径 v2 边界：仅 E-02 场景放宽到 task_create_many 批量形态；E-06a（同为 task_create 期望）维持原单条口径不变（裁决范围只含 E-02）；E-01/E-06b/E-07/E-08 判定不动。');
  if (e01NormFlips.length) {
    notes.push(`归一终判（16950f9 fix，2026-09-04）：E-01 ${e01NormFlips.length} 个 session 原 evidence action_success=false 为 scene 短名/别名（user-management）vs 期望前缀 id（01-user-management）的字面比较 artifact——服务端 resolveId 实际已解析落位期望 scene 并成功创建（session JSONL 复核命中）→ 按参数级 scene/spec 归一比较计 PASS（evidence 文件未改写，详见 e01NormalizationFlips / 输出说明）。错误/缺失 scene（00-default 或缺省回退）不被归一救援，维持 FAIL。`);
  }
  notes.push('归一终判适用范围：仅 E-01 的 scene/spec 前缀序号剥离归一（16950f9 修复点：resume rounds 与 callArgsMatch）；E-02 判定（taskCreateHitsTargetA）本就有形态宽容、不受影响，其余场景判定不动。');

  const ctx = {
    inputs: files, sessionCount: allSessions.length, fileErrors: fileErrors.length, fileErrorMsgs: fileErrors,
    filters: { scenarios: (opts.scenarios || []).join(',') || 'all', sha: opts.sha || 'all', client: opts.client || 'all', clientFamily: opts.clientFamily || 'all' },
    scenariosSeen, perScenarioRows, varianceRows, failRows, dualShaRows, gateRows, e01NormFlips, notes,
  };

  if (isJson) {
    const out = {
      tool: 't027-f04-stats', schema: 'T-027 evidence 契约 v2', version: 1,
      generatedAt: new Date().toISOString(),
      filters: ctx.filters,
      inputs: { files: files.length, sessionCount: ctx.sessionCount, fileErrors: fileErrors },
      rules: Object.entries(SCENARIO_RULES).map(([sid, r]) => ({ scenario_id: sid, group: r.group, kind: r.kind, expected: r.expected, forbidden: r.forbidden, passCondition: r.passCondition, ruleSource: r.ruleSource })),
      perScenario: perScenarioRows.map((r) => ({ ...r, counts: r.c })),
      variance: varianceRows.map((v) => ({ scenario_id: v.scenario_id, sha: v.sha, client: v.client, n: v.stats.n, mean: v.stats.mean, std: v.stats.std, stdMeanRatio: v.stats.ratio, under10pctGate: v.under10, note: v.note || null })),
      failSessions: failRows.map((f) => ({ ...f, candidates: f.candidates.map((c) => ({ ...c, final: false })) })),
      e01NormalizationFlips: e01NormFlips,
      dualSha: dualShaRows,
      gate: gateRows,
      notes,
      reference: RULES_REFERENCE,
    };
    process.stdout.write(JSON.stringify(out, null, 2) + '\n');
    process.exit(0);
  }

  const report = buildHumanReport(ctx);
  log(false, report);
  process.exit(0);
}

main();
