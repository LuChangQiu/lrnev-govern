/**
 * T-003 Semantic Analysis Script
 *
 * ⚠️ 已归档（11064ad3 发布前终审 2026-09-07）：scene04 研究期一次性分析脚本。
 * 原输入 v1 清单（guidance-surface-inventory.json）已于 0464c2e 删除，
 * 且 L318 硬编码本机绝对路径——现状实跑必然 ENOENT，保留无维护价值，移入 archive/。
 * 如需复用请自改输入为现存 v2 清单
 * （dev-docs/ai-guidance-standardization/guidance-surface-inventory-v2.json）。
 * 原位置 scripts/semantic-analysis.ts 无代码/测试引用（仅两份历史报告提及，路径不改写）。
 *
 * 1. Run checkSemanticViolations on all 346 surfaces
 * 2. Review auto-annotations (especially input_schema and governance_doc)
 * 3. Identify unclassifiable items
 * 4. Generate migration decisions
 */

import * as fs from 'fs';
import * as path from 'path';

interface Surface {
  surface_id: string;
  source: {
    file: string;
    symbol?: string;
    field?: string;
    line?: number;
    section?: string;
  };
  channel: string;
  trigger: string;
  consumer: string;
  content: string;
  content_hash: string;
  budget: { chars: number; tokens_estimate: number };
  capability_note: string | null;
  role: string;
  provenance: string;
  enforcement: string;
}

interface Inventory {
  baseline_date: string;
  spec: string;
  status: string;
  surfaces: Surface[];
}

interface Violation {
  pattern: string;
  location: number;
  violation: string;
}

/**
 * Static semantic checker from semantic-authority-model.test.ts
 */
function checkSemanticViolations(text: string): Violation[] {
  const violations: Violation[] = [];

  // Check 1: RECOMMENDATION written as mandatory
  const mandatoryInRecommendation = /【建议】[^。！？]*?(只能|必须|不允许|拒绝)/g;
  let match;
  while ((match = mandatoryInRecommendation.exec(text)) !== null) {
    violations.push({
      pattern: match[0],
      location: match.index,
      violation: 'RECOMMENDATION contains mandatory language (只能/必须/不允许/拒绝)',
    });
  }

  // Check 2: USER_DECISION from non-user sources
  const fabricatedDecision = /(GoalAssessor|spec_list|gate check|tool result)[^。！？]*?【用户已决定|用户确认】/gi;
  while ((match = fabricatedDecision.exec(text)) !== null) {
    violations.push({
      pattern: match[0],
      location: match.index,
      violation: 'USER_DECISION fabricated from non-user source',
    });
  }

  // Check 3: Client boundary disguised as server rule
  const disguisedBoundary = /【执行约束】[^。！？]*?(客户端|前端|界面|显示)/g;
  while ((match = disguisedBoundary.exec(text)) !== null) {
    violations.push({
      pattern: match[0],
      location: match.index,
      violation: 'Client boundary disguised as EXECUTION_CONSTRAINT',
    });
  }

  // Check 4: Decision origin not traceable
  const untraceableDecision = /【用户已决定|用户确认】/g;
  while ((match = untraceableDecision.exec(text)) !== null) {
    const context = text.substring(Math.max(0, match.index - 100), Math.min(text.length, match.index + 100));
    if (!/user_quote|client_asserted|用户明确要求/.test(context)) {
      violations.push({
        pattern: match[0],
        location: match.index,
        violation: 'USER_DECISION without traceable provenance (missing user_quote/client_asserted)',
      });
    }
  }

  // Check 5: Decision boundary overreach
  const boundaryOverreach = /【决策边界】[^。！？]*?(服务端将拒绝|服务端强制|限制已绕过)/g;
  while ((match = boundaryOverreach.exec(text)) !== null) {
    violations.push({
      pattern: match[0],
      location: match.index,
      violation: 'DECISION_BOUNDARY claiming server enforcement power',
    });
  }

  // Check 6: Server constraint without source reference
  const constraintPattern = /【执行约束】[^。！？]+/g;
  while ((match = constraintPattern.exec(text)) !== null) {
    const constraintText = match[0];
    if (!/参考|源码|SpecManager|TaskManager|SceneManager|ClaimStore|实现于|见代码/.test(constraintText)) {
      violations.push({
        pattern: constraintText,
        location: match.index,
        violation: 'EXECUTION_CONSTRAINT without source code reference',
      });
    }
  }

  return violations;
}

/**
 * Check if role/enforcement combination is valid
 */
function checkRoleEnforcementMismatch(surface: Surface): string | null {
  const { role, enforcement } = surface;

  if (role === 'FACT' && enforcement === 'server_enforced') {
    // This is OK for input_schema (field descriptions with Zod validation)
    if (surface.channel === 'tool_input_schema') {
      return null;
    }
    return 'FACT should not have server_enforced unless it is input validation';
  }

  if (role === 'RECOMMENDATION' && enforcement === 'server_enforced') {
    return 'RECOMMENDATION cannot be server_enforced';
  }

  if (role === 'EXECUTION_CONSTRAINT' && enforcement !== 'server_enforced') {
    return 'EXECUTION_CONSTRAINT must be server_enforced';
  }

  return null;
}

/**
 * Suggest correct annotation for governance_doc based on file type and content
 */
function suggestGovernanceDocRole(surface: Surface): { role: string; enforcement: string; reason: string } | null {
  const filename = surface.source.file.split('/').pop() || '';
  const content = surface.content;

  // requirements.md - usually RECOMMENDATION
  if (filename === 'requirements.md') {
    if (content.includes('必须') || content.includes('不允许') || content.includes('只能')) {
      return {
        role: 'EXECUTION_CONSTRAINT',
        enforcement: 'server_enforced',
        reason: 'Contains mandatory language, may describe actual constraints'
      };
    }
    return {
      role: 'RECOMMENDATION',
      enforcement: 'none',
      reason: 'Requirements are typically recommendations, not server constraints'
    };
  }

  // design.md - usually RECOMMENDATION
  if (filename === 'design.md') {
    return {
      role: 'RECOMMENDATION',
      enforcement: 'none',
      reason: 'Design documents describe approaches, not constraints'
    };
  }

  // tasks.md - ACTION_HINT
  if (filename === 'tasks.md') {
    return {
      role: 'ACTION_HINT',
      enforcement: 'none',
      reason: 'Task lists are action hints for execution'
    };
  }

  // architecture.md, roadmap.md, scene.md - FACT
  if (filename.match(/^(architecture|roadmap|scene)\.md$/)) {
    return {
      role: 'FACT',
      enforcement: 'none',
      reason: 'Describes current state or structure'
    };
  }

  return null;
}

/**
 * Main analysis function
 */
function analyzeInventory(inventoryPath: string) {
  const inventory: Inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf-8'));
  const surfaces = inventory.surfaces;

  console.log('=== T-003 Semantic Analysis ===\n');
  console.log(`Total surfaces: ${surfaces.length}\n`);

  // 1. Run semantic violations check
  console.log('1. Scanning for semantic violations...\n');
  const surfacesWithViolations: Array<{ surface_id: string; violations: Violation[] }> = [];

  surfaces.forEach(surface => {
    const violations = checkSemanticViolations(surface.content);
    if (violations.length > 0) {
      surfacesWithViolations.push({
        surface_id: surface.surface_id,
        violations
      });
    }
  });

  console.log(`Found ${surfacesWithViolations.length} surfaces with violations\n`);

  // 2. Check role/enforcement mismatches
  console.log('2. Checking role/enforcement mismatches...\n');
  const mismatches: Array<{ surface_id: string; issue: string; current: any }> = [];

  surfaces.forEach(surface => {
    const issue = checkRoleEnforcementMismatch(surface);
    if (issue) {
      mismatches.push({
        surface_id: surface.surface_id,
        issue,
        current: { role: surface.role, enforcement: surface.enforcement, channel: surface.channel }
      });
    }
  });

  console.log(`Found ${mismatches.length} role/enforcement mismatches\n`);

  // 3. Review governance_doc annotations
  console.log('3. Reviewing governance_doc annotations...\n');
  const govDocs = surfaces.filter(s => s.channel === 'governance_doc');
  const govDocSuggestions: Array<{
    surface_id: string;
    current: any;
    suggested: any;
  }> = [];

  govDocs.forEach(surface => {
    const suggestion = suggestGovernanceDocRole(surface);
    if (suggestion && (suggestion.role !== surface.role || suggestion.enforcement !== surface.enforcement)) {
      govDocSuggestions.push({
        surface_id: surface.surface_id,
        current: { role: surface.role, enforcement: surface.enforcement },
        suggested: suggestion
      });
    }
  });

  console.log(`Found ${govDocSuggestions.length} governance_doc annotation suggestions\n`);

  // 4. Identify unclassifiable items
  console.log('4. Identifying unclassifiable items...\n');
  const unclassifiable: Array<{ surface_id: string; reason: string }> = [];

  surfaces.forEach(surface => {
    if (!surface.role || surface.role === 'unknown') {
      unclassifiable.push({
        surface_id: surface.surface_id,
        reason: 'role is unknown or missing'
      });
    }
    if (!surface.provenance || surface.provenance === 'unknown') {
      unclassifiable.push({
        surface_id: surface.surface_id,
        reason: 'provenance is unknown or missing'
      });
    }
  });

  console.log(`Found ${unclassifiable.length} unclassifiable items\n`);

  // Statistics
  const stats = {
    total: surfaces.length,
    byChannel: surfaces.reduce((acc, s) => {
      acc[s.channel] = (acc[s.channel] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    byRole: surfaces.reduce((acc, s) => {
      acc[s.role || 'null'] = (acc[s.role || 'null'] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    byEnforcement: surfaces.reduce((acc, s) => {
      acc[s.enforcement || 'null'] = (acc[s.enforcement || 'null'] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    violations: surfacesWithViolations.length,
    mismatches: mismatches.length,
    govDocSuggestions: govDocSuggestions.length,
    unclassifiable: unclassifiable.length
  };

  return {
    stats,
    surfacesWithViolations,
    mismatches,
    govDocSuggestions,
    unclassifiable
  };
}

// Run analysis
const inventoryPath = 'E:\\project\\.lrnev\\lrnev-cli\\product\\lrnev-govern\\dev-docs\\ai-guidance-standardization\\guidance-surface-inventory.json';
const results = analyzeInventory(inventoryPath);

// Output JSON for processing
console.log('\n=== Results (JSON) ===');
console.log(JSON.stringify(results, null, 2));
