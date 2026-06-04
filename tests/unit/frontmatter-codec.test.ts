import { describe, expect, it } from 'vitest';

import {
  parseFrontmatter,
  serializeFrontmatter,
} from '../../src/storage/FrontmatterCodec.js';

describe('FrontmatterCodec', () => {
  it('F-01: YYYY-MM-DD round-trip 后仍是 string', () => {
    const markdown = serializeFrontmatter({ created: '2026-06-01' }, '# Spec\n');
    const parsed = parseFrontmatter<{ created: unknown }>(markdown);

    expect(parsed.frontmatter.created).toBe('2026-06-01');
    expect(typeof parsed.frontmatter.created).toBe('string');
  });

  it('F-01: ISO datetime round-trip 后仍是 string', () => {
    const markdown = serializeFrontmatter(
      { created: '2026-06-01T07:30:00.000Z' },
      '# Spec\n',
    );
    const parsed = parseFrontmatter<{ created: unknown }>(markdown);

    expect(parsed.frontmatter.created).toBe('2026-06-01T07:30:00.000Z');
    expect(typeof parsed.frontmatter.created).toBe('string');
  });
});
