/**
 * FrontmatterCodec —— YAML frontmatter 编解码
 *
 * 设计目的：
 *   - 把 gray-matter 的 API 封装成项目内统一接口
 *   - 强类型：泛型 T 描述 frontmatter 字段
 *   - 序列化时控制 YAML 风格（避免 gray-matter 默认行为变化导致 diff 抖动）
 */

import matter from 'gray-matter';

/** 解析结果 */
export interface Parsed<T = Record<string, unknown>> {
  /** YAML frontmatter 对象（无 frontmatter 时为空对象） */
  frontmatter: T;
  /** Markdown 主体（frontmatter 之后的内容，去除前后空行） */
  body: string;
  /** 是否包含 frontmatter */
  hasFrontmatter: boolean;
}

/**
 * 解析含 YAML frontmatter 的 Markdown。
 *
 * 兼容情况：
 *   - 无 frontmatter（纯 Markdown）：frontmatter = {}，hasFrontmatter = false
 *   - frontmatter 为空（--- + --- 中间无内容）：frontmatter = {}
 *
 * @param content 原始 Markdown 文本
 */
export function parseFrontmatter<T = Record<string, unknown>>(
  content: string,
): Parsed<T> {
  const result = matter(content);
  return {
    frontmatter: (result.data ?? {}) as T,
    body: result.content.trim() + (result.content.endsWith('\n') ? '\n' : ''),
    hasFrontmatter: hasFrontmatterBlock(content),
  };
}

/** 检测原文是否以 frontmatter 块开头 */
function hasFrontmatterBlock(content: string): boolean {
  return /^---\r?\n/.test(content);
}

/**
 * 序列化 frontmatter + body 为 Markdown 文本。
 *
 * 风格约定：
 *   - frontmatter 用 ---  ---  分隔
 *   - 顶部 frontmatter 后空一行再写 body
 *   - 末尾保证一个换行
 *   - 空 frontmatter 不写 ---
 */
export function serializeFrontmatter<T extends Record<string, unknown>>(
  frontmatter: T,
  body: string,
): string {
  const hasFields = Object.keys(frontmatter).length > 0;
  const trimmedBody = body.replace(/^\s+/, '').replace(/\s+$/, '');

  if (!hasFields) {
    return trimmedBody + '\n';
  }

  // gray-matter 默认 stringify 用 js-yaml；
  // 这里手动构造一段 YAML 以更可控（避免数组缩进风格抖动）
  const yamlLines: string[] = [];
  for (const [key, value] of Object.entries(frontmatter)) {
    if (value === undefined) continue;
    yamlLines.push(`${key}: ${formatYamlValue(value)}`);
  }

  return ['---', ...yamlLines, '---', '', trimmedBody, ''].join('\n');
}

/**
 * 把 frontmatter 字段值格式化为 YAML 标量 / 流式数组。
 *
 * 简化策略（够 lrnev 使用，不追求 YAML 全功能）：
 *   - 字符串：引号包裹（如果含特殊字符则需要）
 *   - 数字 / 布尔 / null：直接输出
 *   - 数组：流式 [a, b, c]
 *   - 对象：JSON 风格内联（lrnev 内 frontmatter 不嵌套对象）
 */
function formatYamlValue(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return formatYamlString(value);
  if (Array.isArray(value)) {
    return '[' + value.map((v) => formatYamlValue(v)).join(', ') + ']';
  }
  if (typeof value === 'object') {
    // lrnev 内不应出现嵌套对象；万一有则用 JSON 内联
    return JSON.stringify(value);
  }
  return JSON.stringify(value);
}

/** YAML 字符串格式化：需要引号则加引号，否则裸字符串 */
function formatYamlString(s: string): string {
  // 包含以下字符之一需要引号：: # ' " | > & * ! % @ ` 换行
  // 或前后空格、或可能被解析成其他类型（true/false/null/数字/日期）
  const looksLikeDate =
    /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/.test(s);
  const needsQuote =
    /[:#'"|>&*!%@`\n]|^\s|\s$/.test(s) ||
    /^(true|false|null|\d+(\.\d+)?)$/i.test(s) ||
    looksLikeDate ||
    s === '';
  if (!needsQuote) return s;
  // 单引号转义：内部 ' → ''
  return `'${s.replace(/'/g, "''")}'`;
}
