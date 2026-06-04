/**
 * 版本信息读取模块
 *
 * 从 package.json 读取版本号和包名，避免在代码里硬编码版本字符串。
 * 编译后 dist/shared/version.js 相对 package.json 路径为 ../../package.json。
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const pkgPath = resolve(here, '..', '..', 'package.json');

interface PackageJson {
  version: string;
  name: string;
}

const pkg: PackageJson = JSON.parse(readFileSync(pkgPath, 'utf-8'));

/** 当前 lrnev 包版本号，例如 "1.0.0" */
export const VERSION = pkg.version;

/** npm 包名，固定为 "lrnev" */
export const PACKAGE_NAME = pkg.name;
