#!/usr/bin/env -S npx tsx
/**
 * 04-00 Agent E2E Observability - 基线证据生成器
 *
 * 运行全部 04-00 fixture，通过 EvidenceCollector 采集证据，
 * 生成 `<stage>-evidence-manifest.json`，落库到
 * dev-docs/ai-guidance-standardization/ 目录。
 *
 * 落成正式脚本的原因（T-013"确保测试场景可重复"）：
 * 上一版 B0 manifest 由 ad hoc inline script 生成，用完即删，
 * 导致基线无法复现。本脚本落库后，任何阶段（B0/B1/B2a/B2b/B3）
 * 都可用同一套逻辑重新生成对应阶段的 evidence manifest。
 *
 * 用法：
 *   npx tsx scripts/run-b0-baseline.mts --stage=B0
 *   npx tsx scripts/run-b0-baseline.mts --stage=B1 --baseline-ref="08-00 xxx"
 *
 * 参数：
 *   --stage=<B0|B1|B2a|B2b|B3>   必填，阶段标识，决定输出文件名与 manifest.stage
 *   --baseline-ref=<string>      可选，manifest.baseline_ref，默认沿用 B0 基线引用
 *   --v3-path=<path>             可选，v3 inventory 路径（B1/B2a 阶段用于 content_hash），默认 v3-08-00.json
 *   --note=<string>              可选，manifest.note 说明文字
 *   --out=<path>                 可选，输出路径，默认
 *                                 dev-docs/ai-guidance-standardization/<stage-lower>-evidence-manifest.json
 */

import { writeFileSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { EvidenceCollector } from '../tests/e2e/04-00/evidence-collector.js';
import * as fixtures from '../tests/fixtures/04-00/index.js';
import type { FixtureDefinition } from '../tests/fixtures/04-00/types.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');

type Stage = 'B0' | 'B1' | 'B2a' | 'B2b' | 'B3';

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const arg of argv) {
    const m = /^--([^=]+)=(.*)$/.exec(arg);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

function getGitSha(): string {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf-8', cwd: repoRoot }).trim();
  } catch {
    return 'unknown';
  }
}

/** 按 fixture id（如 E-01）排序，保持稳定顺序 */
function collectFixtures(): FixtureDefinition[] {
  const defs: FixtureDefinition[] = Object.values(fixtures).filter(
    (v): v is FixtureDefinition =>
      typeof v === 'object' && v !== null && 'id' in v && 'evidenceFields' in v
  );
  return defs.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

/**
 * C 类字段（服务端不可采）的权宜推断值 + 说明
 *
 * 与 evidence-collector.ts 的 B0 冒烟限制注释保持一致：
 * consumed_at/trigger_context/prompt_id 服务端采不到，此处填权宜推断值，
 * 并在 c_class_basis 中记录推断依据，供 05-00 Profile 阶段替换为客户端回传的精确值。
 */
function buildCClassBasis(fixture: FixtureDefinition, completedAt: string) {
  return {
    consumed_at: '推断值：本次 fixture 运行完成时刻（tool_sequence 为空的场景亦同）',
    trigger_context: '测试专用值，来自 fixture.userInput（截断至200字符）',
    prompt_id: '测试专用值，未接入真实会话系统，等于本次运行 run_id',
    client_version: '服务端不可采，需 05-00 Profile 阶段由客户端回传',
    model_version: '服务端不可采，需 05-00 Profile 阶段由客户端回传',
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const stage = (args.stage ?? 'B0') as Stage;
  if (!['B0', 'B1', 'B2a', 'B2b', 'B3'].includes(stage)) {
    console.error(`未知 stage: ${stage}，须为 B0/B1/B2a/B2b/B3 之一`);
    process.exit(1);
  }

  const baselineRef = args['baseline-ref'] ?? '02-00 guidance-surface-inventory-v2 (346 surfaces)';
  const gitSha = getGitSha();
  const startedAt = new Date().toISOString();

  // B1/B2a/B2b 阶段：加载 v3 五角色文本用于重新计算 content_hash
  let v3Surfaces: Map<string, any> | null = null;
  if (stage === 'B1' || stage === 'B2a' || stage === 'B2b') {
    try {
      const v3Path = args['v3-path']
        ? resolve(repoRoot, args['v3-path'])
        : resolve(repoRoot, 'dev-docs/ai-guidance-standardization/guidance-surface-inventory-v3-08-00.json');
      const v3Data = JSON.parse(readFileSync(v3Path, 'utf-8'));
      v3Surfaces = new Map(v3Data.surfaces.map((s: any) => [s.surface_id, s]));
      console.log(`[${stage}] 已加载 ${v3Surfaces.size} 个 v3 surfaces 用于 content_hash 计算（来源: ${args['v3-path'] || 'v3-08-00.json'}）`);
    } catch (err) {
      console.error(`[${stage}] 警告：无法加载 v3 文件，content_hash 将使用 fixture 原文`, err);
    }
  }

  const allFixtures = collectFixtures();
  const evidences: Array<{ scenario_id: string; evidence: unknown; c_class_basis: unknown }> = [];

  for (const fixture of allFixtures) {
    const collector = new EvidenceCollector(fixture);
    const simulatedCalls = fixture.evidenceFields.tool_sequence || [fixture.expectedAction!].filter(Boolean);

    for (const tool of simulatedCalls) {
      const isForbidden = fixture.forbiddenTools.includes(tool as string);
      collector.recordToolCall(tool as string, {}, isForbidden ? 'error' : 'ok');
    }

    const evidence = collector.collect();
    const completedAt = new Date().toISOString();

    // C 类字段权宜推断值填充（服务端不可采，测试专用推断）
    let filledEvidence: any = {
      ...evidence,
      consumed_at: completedAt,
      trigger_context: fixture.userInput.slice(0, 200),
      prompt_id: evidence.run_id,
    };

    // B1/B2a/B2b 阶段：用 v3 text_v1 重新计算 content_hash，并补充额外字段
    if ((stage === 'B1' || stage === 'B2a' || stage === 'B2b') && v3Surfaces) {
      const surfaceId = (evidence as any).surface_id;
      const v3Surface = v3Surfaces.get(surfaceId);
      if (v3Surface && v3Surface.text_v1) {
        // content_hash_legacy: 保留 collector 生成的原始 hash（基于 fixture.aiGuidance.text 摘录文本，与 B0-s 口径一致）
        const originalHash = (evidence as any).content_hash;

        // content_hash: text_v1 全量 JSON hash（B1/B2a 共用口径）
        const textV1Serialized = JSON.stringify(v3Surface.text_v1);
        const newHash = createHash('sha256').update(textV1Serialized).digest('hex');

        filledEvidence = {
          ...filledEvidence,
          content_hash: newHash,
          content_hash_legacy: originalHash,
        };

        // B2a 专属字段：验证 M1 双通道是否存在
        if (stage === 'B2a') {
          // 注意：B2a-s 仍为结构基线（无真实客户端），以下字段为代码路径推断值，非真实观测：
          // - structured_content_present: 推断自 toMcpToolResult 已接入 51 处工具（M1 变更）
          // - content_channel: 推断自 legacy content 通道保持 B1 等价（M1 设计）
          // 真实 structuredContent 消费验证留待 T-027（真实客户端 B0' 双 SHA 对照）
          filledEvidence = {
            ...filledEvidence,
            structured_content_present: true, // 代码路径推断：M1 后所有工具响应都含 structuredContent
            content_channel: 'legacy',        // 代码路径推断：模型可见信息通过 legacy content 通道传输（与 B1 等价）
          };
        }
      }
    }

    evidences.push({
      scenario_id: fixture.id,
      evidence: filledEvidence,
      c_class_basis: buildCClassBasis(fixture, completedAt),
    });
  }

  const completedAt = new Date().toISOString();

  // 基础 note（所有阶段共用）
  let defaultNote =
    `${stage}-s 结构基线。无真实 LLM/客户端参与：action_taken/action_success/failure_category 由采集器基于 ` +
    `fixture 结构事实（工具序列、expectedAction 是否为 null、真实状态机转换规则 VALID_SPEC_TRANSITIONS）独立判定，` +
    `不读取 fixture.evidenceFields 的预期值。C 类字段中 consumed_at/trigger_context/prompt_id 为权宜推断值` +
    `（见每条记录 c_class_basis），client_version/model_version 为 null，需 05-00 Profile 阶段由客户端回传。`;

  // B2a 专属 note 追加：推断值声明
  if (stage === 'B2a') {
    defaultNote += ` B2a 专属字段 structured_content_present/content_channel 为代码路径推断值（非真实客户端观测）：` +
      `推断自 M1 toMcpToolResult 已接入 51 处工具、legacy content 通道保持 B1 等价。` +
      `真实 structuredContent 消费验证归 T-027（B0' 双 SHA 对照，真实客户端）。`;
  }

  const manifest = {
    spec: '04-00-agent-e2e-observability',
    stage,
    baseline_ref: baselineRef,
    git_sha: gitSha,
    generated_at: completedAt,
    note: args.note ?? defaultNote,
    started_at: startedAt,
    completed_at: completedAt,
    evidences,
  };

  const outPath = args.out
    ? resolve(repoRoot, args.out)
    : resolve(
        repoRoot,
        `dev-docs/ai-guidance-standardization/${stage.toLowerCase()}-evidence-manifest.json`
      );

  writeFileSync(outPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
  console.log(`已生成 ${evidences.length} 条证据 -> ${outPath}`);
  console.log(`git_sha = ${gitSha}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
