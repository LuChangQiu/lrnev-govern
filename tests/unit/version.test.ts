import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { VERSION, PACKAGE_NAME } from '../../src/shared/version.js';

const here = dirname(fileURLToPath(import.meta.url));
const pkgPath = resolve(here, '..', '..', 'package.json');

describe('版本信息', () => {
  it('应导出版本号（与 package.json 一致，防漂移）', () => {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version: string };
    expect(VERSION).toBe(pkg.version);
  });

  it('F-10: 应导出包名 lrnev', () => {
    expect(PACKAGE_NAME).toBe('lrnev');
  });
});
