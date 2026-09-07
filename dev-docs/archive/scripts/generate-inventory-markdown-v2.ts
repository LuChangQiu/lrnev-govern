/**
 * Generate v2 Markdown from v2 JSON inventory
 *
 * Usage: npx tsx scripts/generate-inventory-markdown-v2.ts
 */

import { resolve, dirname } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..');

interface GuidanceSurface {
  surface_id: string;
  source: {
    file: string;
    symbol?: string;
    field?: string;
    line?: number;
  };
  channel: string;
  trigger: string;
  consumer: string;
  content: string;
  content_hash: string;
  budget?: {
    chars: number;
    tokens_estimate: number;
  };
  capability_note?: string | null;
  role?: string;
  provenance?: string;
  enforcement?: string;
  owner?: string;
}

interface SurfaceInventory {
  baseline_date: string;
  spec: string;
  status: string;
  surfaces: GuidanceSurface[];
  statistics?: any;
}

/**
 * Generate Markdown report from inventory
 */
function generateMarkdownReport(inventory: SurfaceInventory): string {
  const lines: string[] = [];

  lines.push('# lrnev Guidance Surface Inventory (v2)');
  lines.push('');
  lines.push(`**Baseline Date**: ${inventory.baseline_date}`);
  lines.push(`**Spec**: ${inventory.spec}`);
  lines.push(`**Status**: ${inventory.status}`);
  lines.push('');

  // Calculate statistics
  const stats = calculateStatistics(inventory.surfaces);

  // Summary Statistics
  lines.push('## Summary Statistics');
  lines.push('');
  lines.push(`- **Total Surfaces**: ${stats.total_surfaces}`);
  lines.push('');

  lines.push('### By Channel');
  lines.push('');
  for (const [channel, count] of Object.entries(stats.by_channel)) {
    if (count > 0) {
      lines.push(`- ${channel}: ${count}`);
    }
  }
  lines.push('');

  lines.push('### By Consumer');
  lines.push('');
  for (const [consumer, count] of Object.entries(stats.by_consumer)) {
    if (count > 0) {
      lines.push(`- ${consumer}: ${count}`);
    }
  }
  lines.push('');

  if (Object.keys(stats.by_role).length > 0) {
    lines.push('### By Role');
    lines.push('');
    for (const [role, count] of Object.entries(stats.by_role)) {
      lines.push(`- ${role}: ${count}`);
    }
    lines.push('');
  }

  lines.push('### Total Budget');
  lines.push('');
  lines.push(`- Characters: ${stats.total_budget.chars.toLocaleString()}`);
  lines.push(`- Tokens (estimate): ${stats.total_budget.tokens_estimate.toLocaleString()}`);
  lines.push('');

  // Surface Catalog
  lines.push('## Surface Catalog');
  lines.push('');

  const surfacesByChannel = new Map<string, GuidanceSurface[]>();
  for (const surface of inventory.surfaces) {
    if (!surfacesByChannel.has(surface.channel)) {
      surfacesByChannel.set(surface.channel, []);
    }
    surfacesByChannel.get(surface.channel)!.push(surface);
  }

  for (const [channel, surfaces] of surfacesByChannel) {
    lines.push(`### ${channel}`);
    lines.push('');

    for (const surface of surfaces) {
      lines.push(`#### \`${surface.surface_id}\``);
      lines.push('');
      lines.push(`- **Source**: \`${surface.source.file}\``);
      if (surface.source.symbol) lines.push(`  - Symbol: \`${surface.source.symbol}\``);
      if (surface.source.field) lines.push(`  - Field: \`${surface.source.field}\``);
      if (surface.source.line) lines.push(`  - Line: ${surface.source.line}`);
      lines.push(`- **Trigger**: ${surface.trigger}`);
      lines.push(`- **Consumer**: ${surface.consumer}`);
      lines.push(`- **Content Hash**: \`${surface.content_hash.substring(0, 16)}...\``);
      if (surface.budget) {
        lines.push(`- **Budget**: ${surface.budget.chars} chars / ~${surface.budget.tokens_estimate} tokens`);
      }
      if (surface.role) lines.push(`- **Role**: ${surface.role}`);
      if (surface.provenance) lines.push(`- **Provenance**: ${surface.provenance}`);
      if (surface.enforcement) lines.push(`- **Enforcement**: ${surface.enforcement}`);
      if (surface.owner) lines.push(`- **Owner**: ${surface.owner}`);
      if (surface.capability_note !== undefined) {
        lines.push(`- **Capability Note**: ${surface.capability_note || 'null'}`);
      }
      lines.push('');
      lines.push('<details>');
      lines.push('<summary>Content Preview</summary>');
      lines.push('');
      lines.push('```');
      lines.push(surface.content.substring(0, 500) + (surface.content.length > 500 ? '...' : ''));
      lines.push('```');
      lines.push('</details>');
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Calculate statistics from surfaces
 */
function calculateStatistics(surfaces: GuidanceSurface[]) {
  const by_channel: Record<string, number> = {};
  const by_role: Record<string, number> = {};
  const by_consumer: Record<string, number> = {};
  let total_chars = 0;
  let total_tokens = 0;

  for (const surface of surfaces) {
    by_channel[surface.channel] = (by_channel[surface.channel] || 0) + 1;

    if (surface.role) {
      by_role[surface.role] = (by_role[surface.role] || 0) + 1;
    }

    by_consumer[surface.consumer] = (by_consumer[surface.consumer] || 0) + 1;

    if (surface.budget) {
      total_chars += surface.budget.chars;
      total_tokens += surface.budget.tokens_estimate;
    }
  }

  return {
    total_surfaces: surfaces.length,
    by_channel,
    by_role,
    by_consumer,
    total_budget: {
      chars: total_chars,
      tokens_estimate: total_tokens,
    },
  };
}

/**
 * Main entry point
 */
function main(): void {
  console.log('Generating v2 Markdown from v2 JSON...');

  const jsonPath = resolve(PROJECT_ROOT, 'dev-docs/ai-guidance-standardization/guidance-surface-inventory-v2.json');
  const inventory: SurfaceInventory = JSON.parse(readFileSync(jsonPath, 'utf-8'));

  console.log(`Loaded ${inventory.surfaces.length} surfaces from v2 JSON`);

  const markdown = generateMarkdownReport(inventory);
  const outputPath = resolve(PROJECT_ROOT, 'dev-docs/ai-guidance-standardization/guidance-surface-inventory-v2.md');

  writeFileSync(outputPath, markdown, 'utf-8');
  console.log(`✓ Generated v2 Markdown: ${outputPath}`);

  const stats = calculateStatistics(inventory.surfaces);
  console.log(`\nStatistics:`);
  console.log(`  Total surfaces: ${stats.total_surfaces}`);
  console.log(`  By role:`);
  for (const [role, count] of Object.entries(stats.by_role)) {
    console.log(`    ${role}: ${count}`);
  }
}

main();
