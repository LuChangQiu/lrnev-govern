#!/usr/bin/env node
/**
 * Evidence Contract Manifest Validator (v2)
 * ===========================================
 * 手写字段级 validator：对 evidence JSON（manifest 或单条 evidence 文件）做
 * required 字段存在性 / 类型 / 枚举 / pattern / null 允许 / 扩展字段可选 校验，
 * 并由 schema 文件（src/schemas/evidence-contract.schema.json）驱动 ——
 * schema 是唯一事实源，validator 不重复维护字段清单。
 *
 * 设计要点（裁决 2026-09-03 Q2/Q3/Q4/Q6/Q7/Q9）：
 *  - decision_context 为 required 但 present 可 null；
 *  - C 类字段（consumed_at/trigger_context/prompt_id/client_version/model_version）允许 null；
 *  - content_hash / fixture_hash / git_sha 为 64hex / 64hex / 40hex 收窄口径；
 *  - additionalProperties:false —— properties 已覆盖 B0~B2b 历史扩展字段
 *    （content_hash_legacy/structured_content_present/content_channel）与会话级扩展字段；
 *  - failure_category enum 补 'test_failure'。
 *
 * 用法：
 *   node scripts/validate-evidence-manifest.mjs <file-or-dir>... [--mode strict|tolerant] [--json]
 *   --mode strict   （默认）任何 ERROR 即 exit 1
 *   --mode tolerant （历史容忍）ERROR 仅标注（裁决 Q7：存量不合规仅标注，不回溯修数据），exit 0
 *   --json          仅向 stdout 输出结构化 JSON 结果
 *   --schema <path> 覆盖默认 schema 路径
 *
 * 输入形状自动识别：
 *   - { evidences: [...] }                         → manifest（逐条校验 evidences[i].evidence）
 *   - { evidence: {...}, scenario_id?, ... }       → 单 entry manifest
 *   - 其余 evidence 字段平铺                          → 单条 evidence
 *
 * 依赖：仅 node 内置模块，不引入 npm 依赖。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_SCHEMA = path.resolve(__dirname, '../src/schemas/evidence-contract.schema.json');

/* ------------------------------------------------------------------ */
/* CLI                                                                 */
/* ------------------------------------------------------------------ */

function usage() {
  console.log(`用法: node scripts/validate-evidence-manifest.mjs <file-or-dir>... [options]

options:
  --mode strict|tolerant   strict=默认，任何 ERROR 即 exit 1；tolerant=历史容忍，仅标注不阻断
  --json                   仅向 stdout 输出结构化 JSON（progress 走 stderr）
  --schema <path>          覆盖默认 schema 路径（默认 src/schemas/evidence-contract.schema.json）
  -h, --help               显示本帮助`);
}

function parseArgs(argv) {
  const opts = { mode: 'strict', json: false, schema: DEFAULT_SCHEMA, files: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') { usage(); process.exit(0); }
    else if (a === '--json') opts.json = true;
    else if (a === '--mode') opts.mode = argv[++i];
    else if (a.startsWith('--mode=')) opts.mode = a.slice('--mode='.length);
    else if (a === '--schema') opts.schema = argv[++i];
    else if (a.startsWith('--schema=')) opts.schema = a.slice('--schema='.length);
    else if (a.startsWith('-')) { console.error(`未知参数: ${a}`); usage(); process.exit(2); }
    else opts.files.push(a);
  }
  if (!['strict', 'tolerant'].includes(opts.mode)) {
    console.error(`--mode 必须是 strict 或 tolerant，收到: ${opts.mode}`);
    process.exit(2);
  }
  return opts;
}

/* ------------------------------------------------------------------ */
/* 通用日志（--json 时进度走 stderr，保证 stdout 纯净）                    */
/* ------------------------------------------------------------------ */

function makeLogger(jsonMode) {
  const out = jsonMode ? (m) => process.stderr.write(m + '\n') : (m) => console.log(m);
  return out;
}

/* ------------------------------------------------------------------ */
/* Schema 驱动的最小字段级校验器                                          */
/* 支持 v2 schema 用到的结构：type(type 数组)/enum/pattern/minLength/     */
/* format:date-time/required/properties/items/oneOf/additionalProperties */
/* ------------------------------------------------------------------ */

function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v; // string | number | boolean | object | undefined
}

function isValidDateTime(s) {
  if (typeof s !== 'string') return true;
  return !Number.isNaN(Date.parse(s));
}

/**
 * 递归校验。errs 为输出数组，元素 { path, category, message }。
 */
function checkNode(node, value, p, errs) {
  // oneOf: 任一分支通过即算通过
  if (node.oneOf && Array.isArray(node.oneOf)) {
    const branchErrsList = [];
    for (const branch of node.oneOf) {
      const be = [];
      checkNode(branch, value, p, be);
      branchErrsList.push(be);
      if (be.length === 0) return; // 有一分支通过
    }
    const detail = branchErrsList
      .map((be, i) => `  分支${i + 1}: ${be[0] ? be[0].message : '未匹配'}`)
      .join('\n');
    errs.push({ path: p, category: 'oneof', message: `值不满足任一分支约束:\n${detail}` });
    return;
  }

  if (node.type) {
    const allowed = Array.isArray(node.type) ? node.type : [node.type];
    const actual = typeOf(value);
    if (!allowed.includes(actual)) {
      errs.push({
        path: p,
        category: 'type',
        message: `类型错误：期望 ${allowed.join(' | ')}，实际 ${actual}`,
      });
      return; // 类型都不对，不再做 string/object 级检查
    }
    if (actual === 'null') return; // 允许 null → 结束
  } else if (value === null || value === undefined) {
    return; // 无 type 约束节点遇 null/undefined，交给上层 required 判定
  }

  const t = typeOf(value);

  if (t === 'string') {
    if (node.enum && !node.enum.includes(value)) {
      errs.push({
        path: p,
        category: 'enum',
        message: `枚举非法："${value}" 不在 [${node.enum.join(', ')}] 内`,
      });
    }
    if (node.pattern) {
      try {
        if (!new RegExp(node.pattern).test(value)) {
          errs.push({
            path: p,
            category: 'pattern',
            message: `格式非法："${value}" 不匹配 pattern ${node.pattern}`,
          });
        }
      } catch (e) {
        errs.push({ path: p, category: 'pattern', message: `schema pattern 非法: ${node.pattern}` });
      }
    }
    if (node.minLength !== undefined && value.length < node.minLength) {
      errs.push({
        path: p,
        category: 'min_length',
        message: `长度不足：期望 ≥${node.minLength} 字符，实际 ${value.length}`,
      });
    }
    if (node.format === 'date-time' && !isValidDateTime(value)) {
      errs.push({ path: p, category: 'format', message: `非 ISO 8601 日期时间："${value}"` });
    }
    return;
  }

  if (t === 'array') {
    if (node.items) {
      value.forEach((el, i) => checkNode(node.items, el, `${p}[${i}]`, errs));
    }
    return;
  }

  if (t === 'object') {
    if (node.required && Array.isArray(node.required)) {
      for (const k of node.required) {
        if (!Object.prototype.hasOwnProperty.call(value, k)) {
          errs.push({
            path: `${p}.${k}`,
            category: 'missing_required',
            message: `缺少 required 字段 "${k}"`,
          });
        }
      }
    }
    if (node.properties) {
      for (const k of Object.keys(value)) {
        const sub = node.properties[k];
        if (sub) checkNode(sub, value[k], `${p}.${k}`, errs);
      }
      if (node.additionalProperties === false) {
        for (const k of Object.keys(value)) {
          if (!node.properties[k]) {
            errs.push({
              path: `${p}.${k}`,
              category: 'unknown_key',
              message: `未知字段（schema additionalProperties:false，properties 未覆盖）"${k}"`,
            });
          }
        }
      }
    }
    return;
  }
  // number/boolean: 无额外约束
}

/* ------------------------------------------------------------------ */
/* 针对已知语义错位的提示（只加提示，不改变判定）                          */
/* ------------------------------------------------------------------ */

function knownMisalignmentHints(errs, ev) {
  for (const e of errs) {
    const f = e.path.split('.').pop();
    if (e.category === 'type' && f === 'content_hash' && ev.content_hash === null) {
      e.message += ' —— 服务端可采字段，恒 null 不合规（裁决 Q1：content_hash 应从目标 worktree server 源码字节计算）';
    } else if (e.category === 'pattern' && f === 'fixture_hash' && typeof ev.fixture_hash === 'string' && ev.fixture_hash.length === 8) {
      e.message += ' —— 8hex legacy（裁决 Q6：统一 64hex 收窄口径；存量历史 evidence 标注 legacy，不回溯）';
    } else if (e.category === 'unknown_key' && (f === 'client' || f === '_debug')) {
      e.message += ' —— 非契约键（裁决 Q5/Q8：字段名以契约为准，client 应改用 client_version；_debug 为 harness 调试元数据，不应进入 evidence 产物）';
    }
  }
}

/* ------------------------------------------------------------------ */
/* 语义级 advisory（warning，不阻断）                                    */
/* ------------------------------------------------------------------ */

function semanticAdvisories(ev, id) {
  const warns = [];
  // action_success=false 时应填 failure_category（契约语义）
  if (ev.action_success === false && ev.failure_category === undefined) {
    warns.push(`action_success=false 但缺 failure_category（契约语义：失败时应填工具级分类；schema 仅 enum 合法化，不强制 presence）`);
  }
  if (ev.action_success === true && ev.failure_category !== undefined) {
    warns.push(`action_success=true 却填了 failure_category="${ev.failure_category}"（契约语义：仅在失败时填写）`);
  }
  // decision_context 疑似误存工作区快照
  if (ev.decision_context && typeof ev.decision_context === 'object' && !('strength' in ev.decision_context) && !('direction' in ev.decision_context)) {
    const snapshotKeys = ['scene', 'existing_specs', 'spec_count', 'current_status'].filter((k) => k in ev.decision_context);
    if (snapshotKeys.length) {
      warns.push(`decision_context 疑似误存工作区快照（含键 ${snapshotKeys.join('/')}）——裁决 Q3：客户端未传语义时应置 null，快照移入独立字段 fixture_context`);
    }
  }
  // decision_context_sent 缺失但 decision_context 非 null（放量 phase1 不强制）
  if (ev.decision_context_sent === false && ev.decision_context !== null && ev.decision_context !== undefined) {
    warns.push(`decision_context_sent=false 但 decision_context 非 null（裁决 Q3：未传语义时应为 null）`);
  }
  if (ev.fixture_context !== undefined && ev.decision_context !== null && ev.decision_context !== undefined) {
    warns.push(`fixture_context 与 decision_context 同时非空（裁决 Q3：两者用途互斥——快照放 fixture_context，客户端意图放 decision_context）`);
  }
  return warns;
}

/* ------------------------------------------------------------------ */
/* 汇总级 advisory（跨记录，N≥3 才下结论，避免 2 样本过拟合）              */
/* ------------------------------------------------------------------ */

function aggregateAdvisories(records) {
  const warns = [];
  const n = records.length;
  if (n < 3) return warns;
  const surfaceSet = new Set(records.map((r) => r.ev.surface_id).filter((v) => v !== undefined && v !== null));
  if (surfaceSet.size === 1) {
    warns.push(`[N=${n}] surface_id 在全部证据中恒为 "${[...surfaceSet][0]}" —— 疑似硬编码（裁决 Q9：surface_id 应为场景主 surface 真实值；会话级全集记 guidance_surfaces[]）`);
  }
  if (records.every((r) => r.ev.user_decision_override === true)) {
    warns.push(`[N=${n}] user_decision_override 恒为 true —— 疑似硬编码（裁决语义：应来自真实用户意图判定，不得恒定）`);
  }
  if (records.every((r) => r.ev.content_hash === null)) {
    warns.push(`[N=${n}] content_hash 恒为 null —— 裁决 Q1：content_hash 为服务端可采字段（目标 worktree server 源码字节），不得恒 null`);
  }
  if (records.every((r) => typeof r.ev.fixture_hash === 'string' && r.ev.fixture_hash.length === 8)) {
    warns.push(`[N=${n}] fixture_hash 全部为 8hex —— 裁决 Q6 legacy（EvidenceCollector 收窄口径 64hex；存量仅标注不回溯）`);
  }
  const dcSnapshotCount = records.filter(
    (r) => r.ev.decision_context && typeof r.ev.decision_context === 'object'
      && !('strength' in r.ev.decision_context)
      && ['scene', 'existing_specs', 'spec_count', 'current_status'].some((k) => k in r.ev.decision_context)
  ).length;
  if (dcSnapshotCount === n) {
    warns.push(`[N=${n}] decision_context 全部为工作区快照形态（非 DecisionContext）——裁决 Q3：evidence.decision_context=null + decision_context_sent:false，快照存 fixture_context`);
  }
  return warns;
}

/* ------------------------------------------------------------------ */
/* 记录校验（一条 evidence）                                             */
/* ------------------------------------------------------------------ */

function validateRecord(ev, label, schema) {
  const errs = [];
  checkNode(schema, ev, '$', errs);
  knownMisalignmentHints(errs, ev);
  const warns = semanticAdvisories(ev, label);
  // 汇总级之外的文件级错误/警告需要路径；warns 转成标准形
  return { label, errs, warns: warns.map((m) => ({ path: '$', category: 'semantic', message: m })) };
}

/* ------------------------------------------------------------------ */
/* 文件解析与形状识别                                                    */
/* ------------------------------------------------------------------ */

function expandInputs(fileOrDir, log) {
  const out = [];
  for (const f of fileOrDir) {
    const abs = path.resolve(f);
    if (!fs.existsSync(abs)) {
      out.push({ file: abs, error: `文件不存在: ${f}` });
      continue;
    }
    const st = fs.statSync(abs);
    if (st.isDirectory()) {
      const jsons = fs.readdirSync(abs).filter((n) => n.endsWith('.json')).sort();
      for (const n of jsons) out.push({ file: path.join(abs, n) });
    } else if (st.isFile()) {
      out.push({ file: abs });
    }
  }
  return out;
}

function loadDocument(abs) {
  const raw = fs.readFileSync(abs, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch (e) {
    return { __parseError__: `JSON 解析失败: ${e.message}` };
  }
}

function detectShape(doc) {
  if (doc && typeof doc === 'object' && Array.isArray(doc.evidences)) return 'manifest';
  if (doc && typeof doc === 'object' && doc.evidence && typeof doc.evidence === 'object') return 'single-entry-manifest';
  return 'single';
}

function collectRecords(doc, shape) {
  const recs = []; // { id, ev }
  if (shape === 'manifest') {
    doc.evidences.forEach((entry, i) => {
      const ev = entry && typeof entry.evidence === 'object' && entry.evidence ? entry.evidence : entry;
      const id = (entry && entry.scenario_id) || `#${i + 1}`;
      recs.push({ id, ev, entryKeys: entry ? Object.keys(entry) : [] });
    });
  } else if (shape === 'single-entry-manifest') {
    recs.push({ id: doc.scenario_id || 'entry', ev: doc.evidence, entryKeys: Object.keys(doc) });
  } else {
    recs.push({ id: doc.scenario_id || doc.run_id || 'evidence', ev: doc, entryKeys: Object.keys(doc) });
  }
  return recs;
}

/* ------------------------------------------------------------------ */
/* main                                                                */
/* ------------------------------------------------------------------ */

function main() {
  const argv = process.argv.slice(2);
  const opts = parseArgs(argv);
  const log = makeLogger(opts.json);

  if (opts.files.length === 0) {
    console.error('错误：至少需要一个 evidence/manifest 文件或目录路径');
    usage();
    process.exit(2);
  }

  let schema;
  try {
    schema = JSON.parse(fs.readFileSync(opts.schema, 'utf-8'));
  } catch (e) {
    console.error(`错误：无法读取 schema ${opts.schema}: ${e.message}`);
    process.exit(2);
  }

  const files = expandInputs(opts.files, log);
  const fileResults = [];
  let totalRecords = 0;
  let totalErrors = 0;
  let totalWarnings = 0;
  const allRecords = [];

  for (const f of files) {
    const fr = { file: f.file, ok: true, errors: 0, warnings: 0, records: 0, issues: [] };
    if (f.error) {
      fr.ok = false;
      fr.issues.push({ id: '-', category: 'io', severity: 'ERROR', path: '$', message: f.error });
      fileResults.push(fr);
      continue;
    }
    const doc = loadDocument(f.file);
    if (doc.__parseError__) {
      fr.ok = false;
      fr.issues.push({ id: '-', category: 'parse', severity: 'ERROR', path: '$', message: doc.__parseError__ });
      fileResults.push(fr);
      continue;
    }
    const shape = detectShape(doc);
    const recs = collectRecords(doc, shape);
    fr.shape = shape;
    fr.records = recs.length;
    totalRecords += recs.length;

    for (const rec of recs) {
      const r = validateRecord(rec.ev, rec.id, schema);
      allRecords.push({ id: rec.id, file: f.file, ev: rec.ev });
      for (const e of r.errs) {
        const severity = opts.mode === 'tolerant' ? 'WARN(历史容忍)' : 'ERROR';
        const cat = opts.mode === 'tolerant' ? `历史容忍-${e.category}` : e.category;
        fr.issues.push({ id: rec.id, category: cat, severity, path: e.path, message: e.message });
        if (opts.mode === 'strict') { fr.errors++; totalErrors++; } else { fr.warnings++; totalWarnings++; }
      }
      for (const w of r.warns) {
        fr.issues.push({ id: rec.id, category: w.category, severity: 'WARN', path: w.path, message: w.message });
        fr.warnings++;
        totalWarnings++;
      }
    }
    if (fr.errors > 0) fr.ok = false;
    fileResults.push(fr);
  }

  const advisories = aggregateAdvisories(allRecords);
  totalWarnings += advisories.length;

  // ---- 输出 ----
  if (opts.json) {
    const out = {
      schema: opts.schema,
      schemaVersion: schema.version || 'unknown',
      mode: opts.mode,
      files: fileResults.map((f) => ({
        file: f.file,
        shape: f.shape,
        records: f.records,
        ok: f.ok,
        errorCount: f.errors,
        warningCount: f.warnings,
        issues: f.issues,
      })),
      aggregateAdvisories: advisories.map((m) => ({ category: 'semantic', message: m })),
      totals: { files: fileResults.length, records: totalRecords, errors: totalErrors, warnings: totalWarnings },
      ok: opts.mode === 'tolerant' ? true : totalErrors === 0,
    };
    process.stdout.write(JSON.stringify(out, null, 2) + '\n');
    process.exit(out.ok ? 0 : 1);
  }

  const line = '─'.repeat(72);
  log('');
  log('=== Evidence Contract Validator ===');
  log(`schema : ${path.relative(process.cwd(), opts.schema) || opts.schema} (v${schema.version || '?'}, ${schema.$schema || 'draft-07'})`);
  log(`mode   : ${opts.mode}${opts.mode === 'tolerant' ? '  （历史容忍：存量不合规仅标注，不回溯修数据，裁决 Q7）' : ''}`);
  log(`inputs : ${files.length} 个文件 / ${fileResults.filter((f) => !f.ok).length} 个有问题`);
  log(line);

  for (const fr of fileResults) {
    log(`\n[${fr.file}]`);
    log(`  形状: ${fr.shape || '-'} | evidence 记录: ${fr.records} | errors: ${fr.errors} | warnings: ${fr.warnings}`);
    for (const it of fr.issues) {
      log(`  ${it.severity === 'ERROR' ? '❌ ERROR' : '⚠️  WARN'} [${it.category}] ${it.path} (${it.id})`);
      log(`       ${it.message.split('\n').join('\n       ')}`);
    }
  }

  if (advisories.length) {
    log(`\n${line}\n=== 汇总级 advisory（跨 ${totalRecords} 条记录，N≥3 才判定） ===`);
    for (const a of advisories) log(`  ⚠️  ${a}`);
  }

  log(`\n${line}\n=== 总结 ===`);
  log(`文件: ${files.length} | evidence 记录: ${totalRecords} | errors: ${totalErrors} | warnings: ${totalWarnings}`);
  if (opts.mode === 'tolerant') {
    log('结果: ✅ PASS（历史容忍模式：所有差异仅标注，exit 0）');
    process.exit(0);
  }
  if (totalErrors === 0) {
    log('结果: ✅ PASS（所有 evidence 均符合契约 v2）');
    process.exit(0);
  }
  log(`结果: ❌ FAIL（${totalErrors} 个错误 —— 供 harness 改造参照，见上方逐条输出）`);
  process.exit(1);
}

main();
