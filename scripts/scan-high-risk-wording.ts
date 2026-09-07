#!/usr/bin/env tsx
/**
 * High-Risk Wording Scanner for Guidance Surface Inventory
 *
 * ⚠️ 历史工具（scene04 研究期；3.0.0 起由 T-027 体系接替，勿随意重跑）：
 * 输出为归档冻结报告 dev-docs/archive/baseline-report.md——重跑会改写冻结产物
 * （报告头哈希一并漂移，破坏归档留档口径）。
 *
 * Scans guidance-surface-inventory-v2.json for:
 * 1. High-risk wording (force language in governance_doc, etc.)
 * 2. Conflicts (same trigger, different instructions)
 * 3. Duplicates (cross-channel redundancy)
 * 4. Budget and hash statistics
 *
 * Usage: npx tsx scripts/scan-high-risk-wording.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ========== Types ==========

interface Surface {
  surface_id: string;
  source: {
    file: string;
    symbol: string;
    line?: number;
  };
  channel: string;
  trigger: string;
  consumer: string;
  content: string;
  content_hash: string;
  budget: {
    chars: number;
    tokens_estimate: number;
  };
  role: 'FACT' | 'RECOMMENDATION' | 'ACTION_HINT';
  provenance: string;
  enforcement: string;
}

interface Inventory {
  baseline_date: string;
  spec: string;
  status: string;
  surfaces: Surface[];
}

interface HighRiskFinding {
  surface_id: string;
  channel: string;
  pattern: string;
  location: string;
  risk_type: string;
  severity: 'high' | 'medium' | 'low';
  recommendation: string;
  context?: string;
}

interface Conflict {
  trigger: string;
  surfaces: string[];
  issue: string;
  severity: 'high' | 'medium' | 'low';
}

interface Duplicate {
  content_hash: string;
  surfaces: string[];
  channels: string[];
  severity: 'high' | 'medium' | 'low';
}

// ========== Configuration ==========

const INVENTORY_PATH = path.resolve(__dirname, '../dev-docs/ai-guidance-standardization/guidance-surface-inventory-v2.json');
const OUTPUT_PATH = path.resolve(__dirname, '../dev-docs/archive/baseline-report.md');

// Patterns for force language (runtime constraints, not requirement contracts)
const FORCE_PATTERNS = [
  { pattern: /必须(?!.*(?:未来|将|应该|建议))/g, name: '必须', type: 'force_must' },
  { pattern: /不允许/g, name: '不允许', type: 'force_disallow' },
  { pattern: /禁止/g, name: '禁止', type: 'force_forbid' },
  { pattern: /只能/g, name: '只能', type: 'force_only' },
  { pattern: /不得/g, name: '不得', type: 'force_must_not' },
];

// Patterns for pseudo-commands (high risk)
const PSEUDO_COMMAND_PATTERNS = [
  { pattern: /必须复用/g, name: '必须复用', type: 'pseudo_must_reuse' },
  { pattern: /禁止创建/g, name: '禁止创建', type: 'pseudo_forbid_create' },
  { pattern: /不新开/g, name: '不新开', type: 'pseudo_no_new' },
  { pattern: /不要新建/g, name: '不要新建', type: 'pseudo_no_create' },
];

// ========== Scanner Functions ==========

/**
 * Scan governance_doc for force language
 */
function scanGovernanceDocForceLanguage(surfaces: Surface[]): HighRiskFinding[] {
  const findings: HighRiskFinding[] = [];
  const governanceSurfaces = surfaces.filter(s => s.channel === 'governance_doc');

  for (const surface of governanceSurfaces) {
    const content = surface.content;

    // Check for force language
    for (const { pattern, name, type } of FORCE_PATTERNS) {
      const matches = Array.from(content.matchAll(pattern));

      for (const match of matches) {
        const offset = match.index || 0;
        const context = content.substring(Math.max(0, offset - 100), Math.min(content.length, offset + 100));

        // Detect runtime constraint markers (服务端将拒绝/错误码/源码位置/校验/throw)
        const runtimeMarkers = [
          /服务端将拒绝/,
          /返回.*错误码/,
          /src\/.*\.ts.*校验/,
          /throw.*Error/,
          /validation.*failed/i,
          /将被阻止/,
          /MCP.*将.*拒绝/,
        ];

        const isRuntimeConstraint = runtimeMarkers.some(marker => marker.test(context));

        // Governance doc 强制词统一先按 contract_tone 登记
        // 仅当含运行时约束标志才升级 runtime_constraint
        const riskType = isRuntimeConstraint ? 'runtime_constraint' : 'contract_tone';
        const severity = isRuntimeConstraint ? 'high' : 'low';

        findings.push({
          surface_id: surface.surface_id,
          channel: surface.channel,
          pattern: name,
          location: `${surface.source.file}:${surface.source.line || 'unknown'} (offset ${offset})`,
          risk_type: riskType,
          severity: severity,
          recommendation: isRuntimeConstraint
            ? '改为建议语气或实现服务端校验'
            : '记录，不修正（契约措辞）',
          context: context.trim(),
        });
      }
    }

    // Check for pseudo-commands
    for (const { pattern, name, type } of PSEUDO_COMMAND_PATTERNS) {
      const matches = Array.from(content.matchAll(pattern));

      for (const match of matches) {
        const offset = match.index || 0;
        const context = content.substring(Math.max(0, offset - 30), Math.min(content.length, offset + 50));

        findings.push({
          surface_id: surface.surface_id,
          channel: surface.channel,
          pattern: name,
          location: `${surface.source.file}:${surface.source.line || 'unknown'} (offset ${offset})`,
          risk_type: 'pseudo_command',
          severity: 'high',
          recommendation: '删除伪命令，或改为 ACTION_HINT',
          context: context.trim(),
        });
      }
    }
  }

  return findings;
}

/**
 * Scan input_schema for consistency
 */
function scanInputSchemaConsistency(surfaces: Surface[]): HighRiskFinding[] {
  const findings: HighRiskFinding[] = [];
  const inputSchemaSurfaces = surfaces.filter(s => s.channel === 'tool_input_schema');

  for (const surface of inputSchemaSurfaces) {
    const content = surface.content;

    // Check for common Zod patterns
    const zodPatterns = [
      { pattern: /\.min\((\d+)\)/, constraint: 'minimum length', checkFor: ['最小', 'min', '至少'] },
      { pattern: /\.max\((\d+)\)/, constraint: 'maximum length', checkFor: ['最大', 'max', '最多'] },
      { pattern: /\.email\(\)/, constraint: 'email format', checkFor: ['邮箱', 'email', 'e-mail'] },
      { pattern: /\.optional\(\)/, constraint: 'optional', checkFor: ['可选', 'optional', '选填'] },
    ];

    for (const { pattern, constraint, checkFor } of zodPatterns) {
      const match = pattern.exec(content);
      if (match) {
        // Check if description mentions this constraint
        const hasDescription = checkFor.some(keyword => content.toLowerCase().includes(keyword.toLowerCase()));

        if (!hasDescription) {
          findings.push({
            surface_id: surface.surface_id,
            channel: surface.channel,
            pattern: constraint,
            location: `${surface.source.file}:${surface.source.symbol}`,
            risk_type: 'schema_description_mismatch',
            severity: 'medium',
            recommendation: `Description 未提及 ${constraint}，应补充说明`,
          });
        }
      }
    }
  }

  return findings;
}

/**
 * Scan tool_annotations for overpromise
 */
function scanAnnotationsOverpromise(surfaces: Surface[]): HighRiskFinding[] {
  const findings: HighRiskFinding[] = [];
  const annotationSurfaces = surfaces.filter(s => s.channel === 'tool_annotations');

  for (const surface of annotationSurfaces) {
    const content = surface.content;

    // Check for strong enforcement language
    const enforcementPatterns = [
      { pattern: /必填|required|必须提供/gi, type: 'claims_required' },
      { pattern: /禁止|不允许|不得/gi, type: 'claims_forbidden' },
    ];

    for (const { pattern, type } of enforcementPatterns) {
      if (pattern.test(content)) {
        findings.push({
          surface_id: surface.surface_id,
          channel: surface.channel,
          pattern: pattern.source,
          location: `${surface.source.file}:${surface.source.symbol}`,
          risk_type: type,
          severity: 'high',
          recommendation: '需验证源码是否有对应校验逻辑；若无，删除强制语气或实现校验',
        });
      }
    }
  }

  return findings;
}

/**
 * Scan mcp_resource descriptions (manual review needed)
 */
function scanMcpResourceDescriptions(surfaces: Surface[]): HighRiskFinding[] {
  const findings: HighRiskFinding[] = [];
  const resourceSurfaces = surfaces.filter(s => s.channel === 'mcp_resource');

  for (const surface of resourceSurfaces) {
    findings.push({
      surface_id: surface.surface_id,
      channel: surface.channel,
      pattern: 'N/A',
      location: `${surface.source.file}:${surface.source.symbol}`,
      risk_type: 'needs_manual_review',
      severity: 'low',
      recommendation: '需人工验证 description 与实际行为一致性',
    });
  }

  return findings;
}

/**
 * Detect trigger conflicts
 */
function detectTriggerConflicts(surfaces: Surface[]): Conflict[] {
  const conflicts: Conflict[] = [];
  const byTrigger = new Map<string, Surface[]>();

  // Group by trigger
  for (const surface of surfaces) {
    const key = surface.trigger;
    if (!byTrigger.has(key)) {
      byTrigger.set(key, []);
    }
    byTrigger.get(key)!.push(surface);
  }

  // Find conflicts (same trigger, different roles or conflicting content)
  for (const [trigger, group] of byTrigger.entries()) {
    if (group.length < 2) continue;

    // Check for role conflicts
    const roles = new Set(group.map(s => s.role));
    if (roles.size > 1 && roles.has('RECOMMENDATION') && roles.has('ACTION_HINT')) {
      conflicts.push({
        trigger,
        surfaces: group.map(s => s.surface_id),
        issue: 'RECOMMENDATION 与 ACTION_HINT 混用',
        severity: 'medium',
      });
    }

    // Check for content conflicts (different instructions for same trigger)
    const recommendations = group.filter(s => s.role === 'RECOMMENDATION');
    if (recommendations.length > 1) {
      const uniqueContent = new Set(recommendations.map(s => s.content));
      if (uniqueContent.size > 1) {
        // Detect true content conflict vs structural shared trigger
        const hasContentConflict = isContentConflicting(recommendations);

        if (hasContentConflict) {
          conflicts.push({
            trigger,
            surfaces: recommendations.map(s => s.surface_id),
            issue: '同触发条件有多个不同的 RECOMMENDATION（内容冲突）',
            severity: 'high',
          });
        } else {
          // Shared trigger but no content conflict (e.g., tool_annotations)
          conflicts.push({
            trigger,
            surfaces: recommendations.map(s => s.surface_id),
            issue: '共享触发条件（结构使然，非内容冲突）',
            severity: 'low',
          });
        }
      }
    }
  }

  return conflicts;
}

/**
 * Check if recommendations have true content conflicts
 */
function isContentConflicting(recommendations: Surface[]): boolean {
  // If all from tool_annotations with default trigger, not a real conflict
  const allAnnotations = recommendations.every(s => s.channel === 'tool_annotations');
  const allSameTrigger = new Set(recommendations.map(s => s.trigger)).size === 1;
  const trigger = recommendations[0]?.trigger || '';

  if (allAnnotations && allSameTrigger && trigger === 'Tool registration') {
    // Structure-induced shared trigger, not content conflict
    return false;
  }

  // Check for mutually exclusive instructions
  const contents = recommendations.map(s => s.content.toLowerCase());

  // Simple heuristic: if contents contain contradictory keywords
  const hasContradiction = contents.some((c1, i) =>
    contents.slice(i + 1).some(c2 => {
      // Check for obvious contradictions
      if (c1.includes('必须') && c2.includes('禁止')) return true;
      if (c1.includes('允许') && c2.includes('不允许')) return true;
      return false;
    })
  );

  return hasContradiction;
}

/**
 * Detect cross-channel duplicates
 */
function detectCrossChannelDuplicates(surfaces: Surface[]): Duplicate[] {
  const duplicates: Duplicate[] = [];
  const byHash = new Map<string, Surface[]>();

  // Group by content hash
  for (const surface of surfaces) {
    const key = surface.content_hash;
    if (!byHash.has(key)) {
      byHash.set(key, []);
    }
    byHash.get(key)!.push(surface);
  }

  // Find duplicates (same hash, different channels)
  for (const [hash, group] of byHash.entries()) {
    if (group.length < 2) continue;

    const channels = [...new Set(group.map(s => s.channel))];
    if (channels.length > 1) {
      duplicates.push({
        content_hash: hash,
        surfaces: group.map(s => s.surface_id),
        channels,
        severity: 'medium',
      });
    }
  }

  return duplicates;
}

/**
 * Calculate budget statistics
 */
function calculateBudgetStats(surfaces: Surface[]) {
  const byChannel = new Map<string, { chars: number; tokens: number; count: number }>();
  const byRole = new Map<string, { chars: number; tokens: number; count: number }>();

  for (const surface of surfaces) {
    // By channel
    if (!byChannel.has(surface.channel)) {
      byChannel.set(surface.channel, { chars: 0, tokens: 0, count: 0 });
    }
    const channelStats = byChannel.get(surface.channel)!;
    channelStats.chars += surface.budget.chars;
    channelStats.tokens += surface.budget.tokens_estimate;
    channelStats.count += 1;

    // By role
    if (!byRole.has(surface.role)) {
      byRole.set(surface.role, { chars: 0, tokens: 0, count: 0 });
    }
    const roleStats = byRole.get(surface.role)!;
    roleStats.chars += surface.budget.chars;
    roleStats.tokens += surface.budget.tokens_estimate;
    roleStats.count += 1;
  }

  // Total
  const total = {
    chars: surfaces.reduce((sum, s) => sum + s.budget.chars, 0),
    tokens: surfaces.reduce((sum, s) => sum + s.budget.tokens_estimate, 0),
    count: surfaces.length,
  };

  return { byChannel, byRole, total };
}

/**
 * Calculate hash statistics
 */
function calculateHashStats(surfaces: Surface[]) {
  const hashes = surfaces.map(s => s.content_hash);
  const uniqueHashes = new Set(hashes);
  const duplicateCount = hashes.length - uniqueHashes.size;

  return {
    total: hashes.length,
    unique: uniqueHashes.size,
    duplicates: duplicateCount,
  };
}

// ========== Report Generation ==========

function generateReport(
  inventory: Inventory,
  findings: {
    governanceDoc: HighRiskFinding[];
    inputSchema: HighRiskFinding[];
    annotations: HighRiskFinding[];
    mcpResource: HighRiskFinding[];
  },
  conflicts: Conflict[],
  duplicates: Duplicate[],
  budgetStats: ReturnType<typeof calculateBudgetStats>,
  hashStats: ReturnType<typeof calculateHashStats>
): string {
  const lines: string[] = [];

  // Header
  lines.push('# Surface Baseline Report (Pre-Migration)');
  lines.push('');
  lines.push(`**Baseline Date**: ${inventory.baseline_date}`);
  lines.push(`**Inventory Version**: v2`);
  lines.push(`**Total Surfaces**: ${inventory.surfaces.length}`);
  lines.push(`**Spec**: ${inventory.spec}`);
  lines.push('');

  // 1. High-Risk Wording Findings
  lines.push('## 1. High-Risk Wording Findings');
  lines.push('');

  // 1.1 Governance Doc
  lines.push('### 1.1 Governance Doc Force Language');
  lines.push('');
  const governanceSurfaces = inventory.surfaces.filter(s => s.channel === 'governance_doc');
  lines.push(`**Total Scanned**: ${governanceSurfaces.length} surfaces`);
  lines.push('');

  if (findings.governanceDoc.length > 0) {
    lines.push('| Surface ID | Pattern | Risk Type | Severity | Recommendation |');
    lines.push('|------------|---------|-----------|----------|----------------|');

    for (const finding of findings.governanceDoc) {
      lines.push(`| ${finding.surface_id} | ${finding.pattern} | ${finding.risk_type} | ${finding.severity} | ${finding.recommendation} |`);
    }
    lines.push('');

    // Summary
    const contractTone = findings.governanceDoc.filter(f => f.risk_type === 'contract_tone').length;
    const runtimeConstraint = findings.governanceDoc.filter(f => f.risk_type === 'runtime_constraint').length;
    const pseudoCommand = findings.governanceDoc.filter(f => f.risk_type === 'pseudo_command').length;

    lines.push('**Summary**:');
    lines.push(`- 契约措辞 (contract_tone): ${contractTone} 个（记录，不修正）`);
    lines.push(`- 运行时约束违规 (runtime_constraint): ${runtimeConstraint} 个（需修正）`);
    lines.push(`- 伪命令 (pseudo_command): ${pseudoCommand} 个（需删除或改为 ACTION_HINT）`);
    lines.push('');
  } else {
    lines.push('✅ No force language detected in governance_doc.');
    lines.push('');
  }

  // 1.2 Input Schema
  lines.push('### 1.2 Input Schema Consistency');
  lines.push('');
  const inputSchemaSurfaces = inventory.surfaces.filter(s => s.channel === 'tool_input_schema');
  lines.push(`**Total Scanned**: ${inputSchemaSurfaces.length} surfaces`);
  lines.push('');

  if (findings.inputSchema.length > 0) {
    lines.push('| Surface ID | Issue | Severity | Recommendation |');
    lines.push('|------------|-------|----------|----------------|');

    for (const finding of findings.inputSchema) {
      lines.push(`| ${finding.surface_id} | ${finding.pattern} | ${finding.severity} | ${finding.recommendation} |`);
    }
    lines.push('');
  } else {
    lines.push('✅ No schema-description mismatches detected.');
    lines.push('');
  }

  // 1.3 Tool Annotations
  lines.push('### 1.3 Tool Annotations Overpromise');
  lines.push('');
  const annotationSurfaces = inventory.surfaces.filter(s => s.channel === 'tool_annotations');
  lines.push(`**Total Scanned**: ${annotationSurfaces.length} surfaces`);
  lines.push('');

  if (findings.annotations.length > 0) {
    lines.push('| Surface ID | Issue | Severity | Recommendation |');
    lines.push('|------------|-------|----------|----------------|');

    for (const finding of findings.annotations) {
      lines.push(`| ${finding.surface_id} | ${finding.risk_type} | ${finding.severity} | ${finding.recommendation} |`);
    }
    lines.push('');
  } else {
    lines.push('✅ No annotation overpromise detected.');
    lines.push('');
  }

  // 1.4 MCP Resource
  lines.push('### 1.4 MCP Resource Descriptions (Manual Review)');
  lines.push('');
  const mcpResourceSurfaces = inventory.surfaces.filter(s => s.channel === 'mcp_resource');
  lines.push(`**Total Scanned**: ${mcpResourceSurfaces.length} surfaces`);
  lines.push('');
  lines.push('⚠️ These require manual verification:');
  lines.push('');

  for (const surface of mcpResourceSurfaces) {
    lines.push(`- ${surface.surface_id} (${surface.source.file})`);
  }
  lines.push('');

  // Coverage Summary
  lines.push('### 1.5 Coverage Summary');
  lines.push('');
  const prefixCovered = inventory.surfaces.filter(s =>
    s.channel === 'server_instructions' || s.channel === 'tool_metadata' || s.channel === 'ai_followup'
  ).length;
  const newScanned = governanceSurfaces.length + inputSchemaSurfaces.length + annotationSurfaces.length + mcpResourceSurfaces.length;
  const totalSurfaces = inventory.surfaces.length;

  lines.push(`- 前缀规则覆盖: ${prefixCovered} surfaces (${((prefixCovered / totalSurfaces) * 100).toFixed(1)}%)`);
  lines.push(`- 新增扫描覆盖: ${newScanned} surfaces (${((newScanned / totalSurfaces) * 100).toFixed(1)}%)`);
  lines.push(`- **总覆盖率**: ${prefixCovered + newScanned} / ${totalSurfaces} (${(((prefixCovered + newScanned) / totalSurfaces) * 100).toFixed(1)}%)`);
  lines.push('');

  // 2. Conflicts & Duplicates
  lines.push('## 2. Conflicts & Duplicates');
  lines.push('');

  // 2.1 Trigger Conflicts
  lines.push('### 2.1 Trigger Conflicts');
  lines.push('');

  if (conflicts.length > 0) {
    lines.push('| Trigger | Surfaces | Issue | Severity |');
    lines.push('|---------|----------|-------|----------|');

    for (const conflict of conflicts) {
      lines.push(`| ${conflict.trigger} | ${conflict.surfaces.join(', ')} | ${conflict.issue} | ${conflict.severity} |`);
    }
    lines.push('');
  } else {
    lines.push('✅ No trigger conflicts detected.');
    lines.push('');
  }

  // 2.2 Cross-Channel Duplicates
  lines.push('### 2.2 Cross-Channel Duplicates');
  lines.push('');

  if (duplicates.length > 0) {
    lines.push('| Content Hash | Channels | Surfaces | Severity |');
    lines.push('|--------------|----------|----------|----------|');

    for (const duplicate of duplicates) {
      lines.push(`| ${duplicate.content_hash.substring(0, 12)}... | ${duplicate.channels.join(', ')} | ${duplicate.surfaces.join(', ')} | ${duplicate.severity} |`);
    }
    lines.push('');
  } else {
    lines.push('✅ No cross-channel duplicates detected.');
    lines.push('');
  }

  // 3. Budget & Hash Baseline
  lines.push('## 3. Budget & Hash Baseline');
  lines.push('');

  // 3.1 By Channel
  lines.push('### 3.1 Budget by Channel');
  lines.push('');
  lines.push('| Channel | Count | Chars | Tokens (Est.) |');
  lines.push('|---------|-------|-------|---------------|');

  const sortedChannels = Array.from(budgetStats.byChannel.entries()).sort((a, b) => b[1].tokens - a[1].tokens);
  for (const [channel, stats] of sortedChannels) {
    lines.push(`| ${channel} | ${stats.count} | ${stats.chars.toLocaleString()} | ${stats.tokens.toLocaleString()} |`);
  }
  lines.push(`| **Total** | **${budgetStats.total.count}** | **${budgetStats.total.chars.toLocaleString()}** | **${budgetStats.total.tokens.toLocaleString()}** |`);
  lines.push('');

  // 3.2 By Role
  lines.push('### 3.2 Budget by Role');
  lines.push('');
  lines.push('| Role | Count | Chars | Tokens (Est.) |');
  lines.push('|------|-------|-------|---------------|');

  const sortedRoles = Array.from(budgetStats.byRole.entries()).sort((a, b) => b[1].tokens - a[1].tokens);
  for (const [role, stats] of sortedRoles) {
    lines.push(`| ${role} | ${stats.count} | ${stats.chars.toLocaleString()} | ${stats.tokens.toLocaleString()} |`);
  }
  lines.push(`| **Total** | **${budgetStats.total.count}** | **${budgetStats.total.chars.toLocaleString()}** | **${budgetStats.total.tokens.toLocaleString()}** |`);
  lines.push('');

  // 3.3 Hash Statistics
  lines.push('### 3.3 Hash Statistics');
  lines.push('');
  lines.push(`- Total surfaces: ${hashStats.total}`);
  lines.push(`- Unique hashes: ${hashStats.unique}`);
  lines.push(`- Duplicate content: ${hashStats.duplicates}`);
  lines.push('');

  // 4. Reproducibility
  lines.push('## 4. Reproducibility');
  lines.push('');
  lines.push('**Command**: `npx tsx scripts/scan-high-risk-wording.ts`');
  lines.push('');
  lines.push('**Input**:');
  lines.push(`- File: \`guidance-surface-inventory-v2.json\``);
  lines.push(`- Size: ${(fs.statSync(INVENTORY_PATH).size / 1024).toFixed(1)} KB`);
  lines.push(`- Surfaces: ${inventory.surfaces.length}`);
  lines.push('');

  // Calculate output hash
  const reportContent = lines.join('\n');
  const reportHash = crypto.createHash('sha256').update(reportContent).digest('hex');

  lines.push('**Output**:');
  lines.push(`- Report Hash: \`sha256:${reportHash}\``);
  lines.push('');

  return lines.join('\n');
}

// ========== Main ==========

function main() {
  console.log('🔍 Scanning guidance surface inventory v2...\n');

  // Load inventory
  console.log(`📂 Loading inventory: ${INVENTORY_PATH}`);
  const inventory: Inventory = JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf-8'));
  console.log(`   ✓ Loaded ${inventory.surfaces.length} surfaces\n`);

  // Scan
  console.log('🔎 Scanning for high-risk wording...');
  const findings = {
    governanceDoc: scanGovernanceDocForceLanguage(inventory.surfaces),
    inputSchema: scanInputSchemaConsistency(inventory.surfaces),
    annotations: scanAnnotationsOverpromise(inventory.surfaces),
    mcpResource: scanMcpResourceDescriptions(inventory.surfaces),
  };
  console.log(`   ✓ Governance doc: ${findings.governanceDoc.length} findings`);
  console.log(`   ✓ Input schema: ${findings.inputSchema.length} findings`);
  console.log(`   ✓ Annotations: ${findings.annotations.length} findings`);
  console.log(`   ✓ MCP resource: ${findings.mcpResource.length} (manual review)\n`);

  console.log('🔍 Detecting conflicts & duplicates...');
  const conflicts = detectTriggerConflicts(inventory.surfaces);
  const duplicates = detectCrossChannelDuplicates(inventory.surfaces);
  console.log(`   ✓ Trigger conflicts: ${conflicts.length}`);
  console.log(`   ✓ Cross-channel duplicates: ${duplicates.length}\n`);

  console.log('📊 Calculating budget & hash statistics...');
  const budgetStats = calculateBudgetStats(inventory.surfaces);
  const hashStats = calculateHashStats(inventory.surfaces);
  console.log(`   ✓ Total budget: ${budgetStats.total.chars.toLocaleString()} chars / ${budgetStats.total.tokens.toLocaleString()} tokens`);
  console.log(`   ✓ Unique hashes: ${hashStats.unique} / ${hashStats.total}\n`);

  // Generate report
  console.log('📝 Generating baseline report...');
  const report = generateReport(inventory, findings, conflicts, duplicates, budgetStats, hashStats);

  // Write report (force LF line endings for cross-platform consistency)
  const normalizedReport = report.replace(/\r\n/g, '\n');
  fs.writeFileSync(OUTPUT_PATH, normalizedReport, 'utf-8');
  const reportSize = (fs.statSync(OUTPUT_PATH).size / 1024).toFixed(1);

  // Calculate SHA256 hash
  const reportHash = crypto.createHash('sha256').update(normalizedReport, 'utf-8').digest('hex');
  console.log(`   ✓ Report written: ${OUTPUT_PATH}`);
  console.log(`   ✓ Size: ${reportSize} KB`);
  console.log(`   ✓ SHA256: ${reportHash}\n`);

  console.log('✅ Scan complete!\n');

  // Summary
  console.log('📋 Summary:');
  console.log(`   - Total findings: ${findings.governanceDoc.length + findings.inputSchema.length + findings.annotations.length}`);
  console.log(`   - Conflicts: ${conflicts.length}`);
  console.log(`   - Duplicates: ${duplicates.length}`);
  console.log(`   - Report: ${OUTPUT_PATH}`);
}

// Run if this is the main module
main();
