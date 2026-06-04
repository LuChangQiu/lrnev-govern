import { extractCodeRanges, inRanges } from '../storage/MarkdownParser.js';
import type {
  LegacyTodoMigrationResult,
  LegacyTodoPlaceholder,
  LegacyTodoReplacement,
} from '../types/legacy-todo.js';

export function findLegacyTodoPlaceholders(content: string): LegacyTodoPlaceholder[] {
  return collectLegacyTodoReplacements(content).map(({ line, text }) => ({ line, text }));
}

export function migrateLegacyTodoPlaceholders(content: string): LegacyTodoMigrationResult {
  const replacements = collectLegacyTodoReplacements(content);
  if (replacements.length === 0) return { content, replacements };

  const eol = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = content.split(/\r?\n/);
  const byLine = new Map(replacements.map((replacement) => [replacement.line, replacement.replacement]));
  const migrated = lines.map((line, index) => {
    const replacement = byLine.get(index + 1);
    if (replacement === undefined) return line;
    const leading = /^\s*/.exec(line)?.[0] ?? '';
    const trailing = /\s*$/.exec(line)?.[0] ?? '';
    return `${leading}${replacement}${trailing}`;
  });

  return {
    content: migrated.join(eol),
    replacements,
  };
}

function collectLegacyTodoReplacements(content: string): LegacyTodoReplacement[] {
  const replacements: LegacyTodoReplacement[] = [];
  const codeRanges = extractCodeRanges(content);
  for (const lineInfo of iterateLines(content)) {
    const { line, number, start, end } = lineInfo;
    if (inRanges(codeRanges, start, end)) continue;
    const replacement = replacementForTrimmedLine(line.trim());
    if (replacement !== null) {
      replacements.push({
        line: number,
        text: line.trim(),
        replacement,
      });
    }
  }
  return replacements;
}

function iterateLines(content: string): Array<{ number: number; line: string; start: number; end: number }> {
  const lines = content.split(/\r?\n/);
  const eols = content.match(/\r?\n/g) ?? [];
  const result: Array<{ number: number; line: string; start: number; end: number }> = [];
  let offset = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const start = offset;
    const end = start + line.length;
    result.push({ number: i + 1, line, start, end });
    offset = end + (eols[i]?.length ?? 0);
  }
  return result;
}

function replacementForTrimmedLine(trimmed: string): string | null {
  if (trimmed === '- TODO') {
    return '- <!-- FILL: 旧 TODO 占位 -->';
  }
  if (trimmed === '- [ ] TODO') {
    return '- [ ] <!-- FILL: 待填写验收标准 -->';
  }
  const feature = /^#### (F-\d{2}) TODO$/.exec(trimmed);
  if (feature) {
    return `#### ${feature[1]!} <!-- FILL: 功能标题 -->`;
  }
  return null;
}
