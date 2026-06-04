/**
 * 模板渲染器
 *
 * 加载 templates/ 下的模板文件并替换占位符。
 *
 * 占位符语法：{{name}}（双花括号，无空格容忍单边空格）
 *
 * 模板分两类：
 *   1. .tmpl 文件：带占位符，渲染时填充（scene / spec / adr）
 *   2. .md 文件：静态文本，原样复制（steering 系列）
 *
 * 设计权威：tasks.md T-105
 */

import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { LrnevError, ErrorCode } from '../shared/errors.js';
import type { TemplateGroup } from '../types/templates.js';

/**
 * 模板目录绝对路径。
 *
 * 编译后 dist/core/Templates.js 相对 templates/ 路径为 ../../templates
 * （类似 shared/version.ts 的处理）。
 */
const here = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = resolve(here, '..', '..', 'templates');

/** 模板分类 */
/**
 * 渲染模板。
 *
 * @param group 模板分组
 * @param name  文件名（不含 .tmpl 或 .md 后缀）；带 .tmpl 时按模板渲染，否则静态读
 * @param vars  占位符变量字典
 * @returns 渲染后的字符串
 *
 * 示例：
 *   await renderTemplate('scene', 'scene.md', { id: '01-user', name: 'user-management', ... })
 *   await renderTemplate('steering', 'CORE_PRINCIPLES.md')  // 静态，无 vars
 */
export async function renderTemplate(
  group: TemplateGroup,
  name: string,
  vars: Record<string, string | number> = {},
): Promise<string> {
  // 先尝试 .tmpl，再回退到静态 .md
  const tmplPath = join(TEMPLATES_DIR, group, `${name}.tmpl`);
  const staticPath = join(TEMPLATES_DIR, group, name);

  const tryRead = async (p: string): Promise<string | null> => {
    try {
      return await readFile(p, 'utf-8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
  };

  let content = await tryRead(tmplPath);
  let isTemplate = true;
  if (content === null) {
    content = await tryRead(staticPath);
    isTemplate = false;
  }
  if (content === null) {
    throw new LrnevError(
      ErrorCode.FILE_NOT_FOUND,
      `模板不存在：${group}/${name}`,
      {
        field: 'template',
        hint: `检查 templates/${group}/${name}.tmpl 或 ${name}`,
      },
    );
  }

  if (!isTemplate) {
    // 静态文件原样返回（即便传了 vars 也忽略）
    return content;
  }

  return applyVars(content, vars, `${group}/${name}`);
}

/**
 * 把 {{key}} 占位符替换为 vars[key]。
 *
 * 行为：
 *   - 缺失的 key 抛错（避免静默残留占位符）
 *   - 容忍占位符内单边空白：{{ key }} / {{key }} / {{ key}}
 *   - 不支持表达式（KISS）
 */
function applyVars(content: string, vars: Record<string, string | number>, templateId: string): string {
  // 收集模板里出现的所有占位符
  const placeholderRegex = /\{\{\s*([a-zA-Z_][\w]*)\s*\}\}/g;
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = placeholderRegex.exec(content)) !== null) {
    found.add(m[1]!);
  }

  const missing = [...found].filter((k) => !(k in vars));
  if (missing.length > 0) {
    throw new LrnevError(
      ErrorCode.INVALID_INPUT,
      `模板 ${templateId} 占位符未提供：${missing.join(', ')}`,
      { field: 'vars', hint: `渲染模板 ${templateId} 时请提供占位符：${missing.join(', ')}` },
    );
  }

  return content.replace(placeholderRegex, (_, key: string) => String(vars[key]));
}

/**
 * 一个便捷函数：把 kebab-case 名字转成 Title Case（用于模板里的 name_title）。
 *
 * 例：user-management → User Management
 */
export function toTitleCase(kebab: string): string {
  return kebab
    .split('-')
    .map((w) => (w.length === 0 ? w : w[0]!.toUpperCase() + w.slice(1)))
    .join(' ');
}

/** 当前日期 YYYY-MM-DD（用于模板默认值） */
export function today(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
