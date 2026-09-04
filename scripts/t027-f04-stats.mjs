#!/usr/bin/env node
/**
 * T-027 F-04 判定统计脚本（v1）
 * ===========================================
 * 对 T-027 放量 evidence（契约 v2，tests/e2e/t027-baseline/.evidences/e-<scenario>-<ts>-<rand>.json）
 * 做 F-04 门禁判定所需的统计：
 *   a. 每 场景 x sha_label x client 的 session 汇总（PASS/FAIL/ANOMALY/OBSERVE 计数）
 *   b. 消费率方差（布尔口径 action 成功率 mean / std / std-mean 比，<10% 门槛标记）
 *   c. FAIL session 的 F-04 A-E 候选分类提示（启发式，非最终 failure_class）
 *   d. 双 SHA 对照表（sha-a vs sha-b 同场景 action 分布差异）
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
 *     action_success=true 且 未调用 forbidden 工具（E-02/E-06a 的 task_create 语义为
 *     单条工具，task_create_many 不算 —— 参数级语义 harness 已落入 action_success）。
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
    ruleSource: 'fixtures/04-00/e01-suggest-reuse-explicit-new.ts (expectedAction=spec_create; forbidden task_create) + harness-mvp.mjs tool_result 判定; R1 报告 §1.1',
    passCondition: 'tool_sequence 含 spec_create 且 action_success=true 且未调用 forbidden(task_create)',
  },
  'E-02': {
    group: 'explicit',
    kind: 'expected',
    title: '建议新建+明确复用',
    expected: 'task_create',
    forbidden: ['spec_create'],
    ruleSource: 'fixtures/04-00/e02-suggest-new-explicit-reuse.ts (expectedAction=task_create(A); forbidden spec_create 新建 B) + R1 报告 §1.2（task_create_many 单条语义不符→FAIL）',
    passCondition: 'tool_sequence 含单条 task_create 且 action_success=true 且未调用 forbidden(spec_create)',
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
/* 判定（单 session）：返回 { verdict, detail, artifact, candidates }   */
/* candidates: [{ class:'A'|'B'|'C'|'D'|'E', reason, hint:true }]      */
/* 注意：A-E 候选仅在 explicit 门禁组给出（F-04 A-E 分类定义于六 explicit */
/* 场景）；观察组 FAIL 只给 advisory 文本，不给关键失败字母，避免把        */
/* preferred/unspecified 的观察偏差误标成门禁关键失败。                  */
/* ------------------------------------------------------------------ */

function judgeSession(ev, rule, sidecar, sid) {
  const seq = Array.isArray(ev.tool_sequence) ? ev.tool_sequence : [];
  const forbidden = Array.isArray(ev.forbidden_tools) && ev.forbidden_tools.length
    ? ev.forbidden_tools : (rule.forbidden || []);
  const forbiddenCalled = isForbiddenCalled(seq, forbidden);
  const success = ev.action_success === true;
  const candidates = [];
  let verdict; let detail; let artifact = null;
  const isGate = rule.group === 'explicit';

  const gateCand = (cls, reason) => { if (isGate) candidates.push({ class: cls, hint: true, reason }); };

  switch (rule.kind) {
    case 'expected': {
      const seen = hasExpectedTool(seq, rule.expected);
      if (seen && success && !forbiddenCalled) {
        verdict = 'PASS';
        detail = `期望工具 ${rule.expected} 已调用且成功`;
      } else {
        verdict = 'FAIL';
        if (forbiddenCalled) {
          detail = `forbidden 工具被调用（${forbidden.join('/')}）——explicit 场景越禁止`;
          gateCand('A', `explicit 场景调用禁止工具(${forbidden.join('/')})，覆盖用户明确目标/越约束`);
        } else if (!seen) {
          detail = `期望工具 ${rule.expected} 未出现在 tool_sequence`;
          const decisionTools = ['spec_create', 'scene_create', 'task_create', 'task_create_many', 'spec_update', 'assess_goal'];
          const anyDecisionTool = seq.some((t) => decisionTools.includes(baseTool(t)));
          if (anyDecisionTool) {
            gateCand('A', `explicit 场景调用了决策工具但非期望动作 ${rule.expected}（实际 ${baseTool(ev.action_taken) || '(none)'}），用户目标未达成；如 task_create_many≠单条 task_create 为参数/工具语义偏差`);
          } else {
            gateCand('A', `explicit 场景未调用任何决策工具且未执行期望动作 ${rule.expected}（action_taken=${ev.action_taken || 'null'}），用户目标未达成`);
            gateCand('D', '若客户端完全未调用治理工具（无 structuredContent 交付），可能为 capability 失败；需查 session 文本');
          }
          if (!isGate) detail += '（观察组：无 A-E 字母候选，仅记录）';
        } else {
          detail = `期望工具 ${rule.expected} 已调用但 action_success=false（结果失败/参数不符）`;
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
  return { verdict, detail, artifact, candidates };
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
      const judged = isV2Shape ? judgeSession(ev, rule, sidecar, sid) : {
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
      if (mainClientList.length >= 2) {
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

  const ctx = {
    inputs: files, sessionCount: allSessions.length, fileErrors: fileErrors.length, fileErrorMsgs: fileErrors,
    filters: { scenarios: (opts.scenarios || []).join(',') || 'all', sha: opts.sha || 'all', client: opts.client || 'all', clientFamily: opts.clientFamily || 'all' },
    scenariosSeen, perScenarioRows, varianceRows, failRows, dualShaRows, gateRows, notes,
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
