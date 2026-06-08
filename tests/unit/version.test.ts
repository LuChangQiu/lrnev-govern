import { describe, it, expect } from 'vitest';
import { VERSION, PACKAGE_NAME } from '../../src/shared/version.js';

describe('版本信息', () => {
  it('应导出版本号 1.3.1', () => {
    expect(VERSION).toBe('1.3.1');
  });

  it('F-10: 应导出包名 lrnev', () => {
    expect(PACKAGE_NAME).toBe('lrnev');
  });
});
