#!/usr/bin/env node
/**
 * Fix B1 migration invertibility - add separators to text_v1 fragments
 *
 * Problem: 167/346 surfaces cannot reconstruct text_legacy from text_v1
 * Root cause: Lost exact separators (newlines, punctuation, whitespace) between fragments
 *
 * Solution: Add "separator" field to each fragment in text_v1:
 * - Reconstruct text_legacy by: fragment.content + fragment.separator (for each fragment)
 * - Last fragment's separator is empty string
 * - Must achieve 346/346 byte-perfect invertibility
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const V3_PATH = path.resolve(__dirname, '../dev-docs/ai-guidance-standardization/guidance-surface-inventory-v3-08-00.json');

interface Fragment {
  role: string;
  content: string;
  separator?: string;
}

interface Surface {
  surface_id: string;
  text_legacy: string;
  text_v1: Fragment[];
  [key: string]: any;
}

interface Inventory {
  version: string;
  total_surfaces: number;
  surfaces: Surface[];
  [key: string]: any;
}

/**
 * Add separators to text_v1 by analyzing text_legacy
 *
 * Strategy:
 * 1. Find each fragment's position in text_legacy (handling truncated content)
 * 2. Handle leading whitespace (prepend to first fragment)
 * 3. Extract the full text from each position to next fragment's position
 * 4. Split into (content + separator) where separator is trailing whitespace/punctuation
 * 5. Handle trailing whitespace (append to last fragment's separator)
 *
 * This fixes 167/346 surfaces where text_v1 content was truncated during B1 migration.
 */
function addSeparators(surface: Surface): void {
  const { text_legacy, text_v1 } = surface;

  if (text_v1.length === 0) {
    return; // Empty surface, nothing to do
  }

  // First pass: find all fragment positions in text_legacy
  const positions: number[] = [];
  let searchStart = 0;

  for (let i = 0; i < text_v1.length; i++) {
    const fragment = text_v1[i];
    const truncatedContent = fragment.content;

    // Find this fragment in text_legacy
    let pos = text_legacy.indexOf(truncatedContent, searchStart);

    if (pos === -1) {
      // Content might be truncated, try first 30 chars
      const prefix = truncatedContent.substring(0, Math.min(30, truncatedContent.length));
      pos = text_legacy.indexOf(prefix, searchStart);

      if (pos === -1) {
        throw new Error(`Surface ${surface.surface_id}: Fragment ${i} not found\nContent: "${truncatedContent.substring(0, 100)}..."`);
      }
    }

    positions.push(pos);
    searchStart = pos + 1; // Move forward for next search
  }

  // Handle leading whitespace: prepend to first fragment
  const leadingWhitespace = text_legacy.substring(0, positions[0]);
  if (leadingWhitespace) {
    text_v1[0].content = leadingWhitespace + text_v1[0].content;
    positions[0] = 0; // Update position
  }

  // Second pass: extract complete content + separator for each fragment
  for (let i = 0; i < text_v1.length; i++) {
    const fragment = text_v1[i];
    const start = positions[i];
    const end = i < text_v1.length - 1 ? positions[i + 1] : text_legacy.length;

    // Extract full text for this fragment
    const fullText = text_legacy.substring(start, end);

    // Split into content + separator
    // Separator patterns: \n, \r\n, 。\n, .\n, ,\n, etc.
    const separatorMatch = fullText.match(/^(.*?)([\r\n]+|。\r?\n|。$|\.\r?\n|\.\s*$|'\r?\n|'\s*$|,\r?\n|,\s*$|\],?\s*\r?\n?|\]\s*$)$/s);

    if (separatorMatch && separatorMatch[2]) {
      fragment.content = separatorMatch[1];
      fragment.separator = separatorMatch[2];
    } else {
      // No clear separator, keep full text as content
      fragment.content = fullText;
      fragment.separator = '';
    }
  }

  // Handle trailing whitespace: append to last fragment's separator
  const lastFragment = text_v1[text_v1.length - 1];
  const lastPos = positions[text_v1.length - 1];
  const currentEnd = lastPos + lastFragment.content.length + (lastFragment.separator || '').length;

  if (currentEnd < text_legacy.length) {
    const trailingWhitespace = text_legacy.substring(currentEnd);
    lastFragment.separator = (lastFragment.separator || '') + trailingWhitespace;
  }
}

/**
 * Verify invertibility: reconstruct text_legacy from text_v1
 */
function verifyInvertibility(surface: Surface): boolean {
  const reconstructed = surface.text_v1
    .map(f => f.content + (f.separator || ''))
    .join('');

  return reconstructed === surface.text_legacy;
}

async function main() {
  console.log('Reading v3 inventory...');
  const data = fs.readFileSync(V3_PATH, 'utf-8');
  const inventory: Inventory = JSON.parse(data);

  console.log(`Total surfaces: ${inventory.total_surfaces}`);
  console.log('Adding separators to all surfaces...\n');

  let fixed = 0;
  let failed = 0;
  const failures: string[] = [];

  for (const surface of inventory.surfaces) {
    try {
      addSeparators(surface);

      // Verify invertibility
      if (!verifyInvertibility(surface)) {
        console.error(`❌ ${surface.surface_id}: Invertibility check FAILED after adding separators`);
        failed++;
        failures.push(surface.surface_id);
      } else {
        fixed++;
        if (fixed % 50 === 0) {
          console.log(`✓ Fixed ${fixed}/${inventory.total_surfaces} surfaces`);
        }
      }
    } catch (error) {
      console.error(`❌ ${surface.surface_id}: ${error instanceof Error ? error.message : String(error)}`);
      failed++;
      failures.push(surface.surface_id);
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Fixed: ${fixed}/${inventory.total_surfaces}`);
  console.log(`Failed: ${failed}`);

  if (failures.length > 0) {
    console.log(`\nFailed surfaces:`);
    failures.forEach(id => console.log(`  - ${id}`));
    process.exit(1);
  }

  // Write fixed inventory
  console.log('\nWriting fixed inventory...');
  fs.writeFileSync(V3_PATH, JSON.stringify(inventory, null, 2), 'utf-8');

  console.log('✅ All 346 surfaces fixed and verified!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
