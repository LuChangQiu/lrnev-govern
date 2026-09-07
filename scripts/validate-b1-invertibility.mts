#!/usr/bin/env node
/**
 * B1 Invertibility Validation Script
 *
 * ⚠️ 历史工具（scene04 研究期；3.0.0 起由 T-027 体系接替，勿随意重跑）：
 * 纯只读校验（只读冻结清单 dev-docs/ai-guidance-standardization/evidence/guidance-surface-inventory-v3-08-00.json，无副作用），
 * 用途仅为 346/346 可逆性结论的复核留档。
 *
 * Validates that all 346 surfaces in v3 can be byte-perfectly reconstructed
 * from text_v1 fragments back to text_legacy.
 *
 * Requirements:
 * - 346/346 surfaces must be byte-perfect invertible
 * - Reconstruction: text_v1.map(f => f.content + (f.separator || '')).join('') === text_legacy
 * - Report any non-invertible surfaces with diff details
 *
 * ⚠️ CONSUMPTION CONTRACT (MUST FOLLOW):
 * text_v1 fragments MUST be consumed as `content + (separator || '')`.
 * DO NOT use fragment.content alone — 20.2% of fragments (209/1034) are truncated
 * at line-ending punctuation/quotes, with the truncated character stored in separator.
 * Using content alone will result in semantically incomplete text.
 *
 * Known limitation: 209 fragments have content lacking line-ending punctuation
 * (e.g., `spec: '01-00-task-create-many` + sep `'\n`). Concatenation is complete,
 * but content alone is truncated. Splitting is by character position, not semantic boundary.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const V3_PATH = path.resolve(__dirname, '../dev-docs/ai-guidance-standardization/evidence/guidance-surface-inventory-v3-08-00.json');

interface Fragment {
  role: string;
  content: string;
  separator?: string;
}

interface Surface {
  surface_id: string;
  text_legacy: string;
  text_v1: Fragment[];
}

interface Inventory {
  version: string;
  total_surfaces: number;
  surfaces: Surface[];
}

interface ValidationResult {
  surface_id: string;
  invertible: boolean;
  legacy_length: number;
  reconstructed_length: number;
  diff_chars: number;
  first_diff_position?: number;
  diff_context?: string;
}

function validateSurface(surface: Surface): ValidationResult {
  const reconstructed = surface.text_v1
    .map(f => f.content + (f.separator || ''))
    .join('');

  const invertible = reconstructed === surface.text_legacy;

  const result: ValidationResult = {
    surface_id: surface.surface_id,
    invertible,
    legacy_length: surface.text_legacy.length,
    reconstructed_length: reconstructed.length,
    diff_chars: surface.text_legacy.length - reconstructed.length,
  };

  if (!invertible) {
    // Find first difference
    for (let i = 0; i < Math.max(surface.text_legacy.length, reconstructed.length); i++) {
      if (surface.text_legacy[i] !== reconstructed[i]) {
        result.first_diff_position = i;
        const start = Math.max(0, i - 20);
        const end = Math.min(surface.text_legacy.length, i + 20);
        result.diff_context = `legacy: "${surface.text_legacy.substring(start, end)}" | reconstructed: "${reconstructed.substring(start, end)}"`;
        break;
      }
    }
  }

  return result;
}

async function main() {
  console.log('=== B1 Invertibility Validation ===\n');
  console.log(`Reading v3 inventory: ${V3_PATH}\n`);

  const data = fs.readFileSync(V3_PATH, 'utf-8');
  const inventory: Inventory = JSON.parse(data);

  console.log(`Total surfaces: ${inventory.total_surfaces}\n`);
  console.log('Validating invertibility...\n');

  const results: ValidationResult[] = [];
  let passed = 0;
  let failed = 0;

  for (const surface of inventory.surfaces) {
    const result = validateSurface(surface);
    results.push(result);

    if (result.invertible) {
      passed++;
    } else {
      failed++;
      console.error(`❌ ${result.surface_id}`);
      console.error(`   Legacy length: ${result.legacy_length}, Reconstructed: ${result.reconstructed_length}, Diff: ${result.diff_chars} chars`);
      if (result.first_diff_position !== undefined) {
        console.error(`   First diff at position ${result.first_diff_position}`);
        console.error(`   ${result.diff_context}`);
      }
      console.error('');
    }
  }

  console.log('=== Validation Summary ===\n');
  console.log(`Total surfaces: ${inventory.total_surfaces}`);
  console.log(`Passed: ${passed} (${(passed / inventory.total_surfaces * 100).toFixed(1)}%)`);
  console.log(`Failed: ${failed} (${(failed / inventory.total_surfaces * 100).toFixed(1)}%)`);

  if (failed > 0) {
    console.error(`\n❌ VALIDATION FAILED: ${failed} surfaces are not invertible`);
    process.exit(1);
  }

  console.log('\n✅ VALIDATION PASSED: All 346/346 surfaces are byte-perfect invertible!');

  // Additional statistics
  console.log('\n=== Fragment Statistics ===');
  const totalFragments = inventory.surfaces.reduce((sum, s) => sum + s.text_v1.length, 0);
  const fragmentsWithSeparator = inventory.surfaces.reduce(
    (sum, s) => sum + s.text_v1.filter(f => f.separator && f.separator.length > 0).length,
    0
  );

  console.log(`Total fragments: ${totalFragments}`);
  console.log(`Fragments with separator: ${fragmentsWithSeparator} (${(fragmentsWithSeparator / totalFragments * 100).toFixed(1)}%)`);
  console.log(`Fragments without separator: ${totalFragments - fragmentsWithSeparator} (${((totalFragments - fragmentsWithSeparator) / totalFragments * 100).toFixed(1)}%)`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
