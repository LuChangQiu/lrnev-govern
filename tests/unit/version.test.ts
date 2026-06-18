import { describe, it, expect } from 'vitest';
import { VERSION, PACKAGE_NAME } from '../../src/shared/version.js';

describe('版本信息', () => {
  it('应导出版本号 2.2.0', () => {
    expect(VERSION).toBe('2.2.0');
  });

  it('F-10: 应导出包名 lrnev', () => {
    expect(PACKAGE_NAME).toBe('lrnev');
  });
});
