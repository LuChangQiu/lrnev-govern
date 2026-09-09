/** 去掉 UTF-8 BOM，兼容 Windows 工具写出的 JSON/文本文件。 */
export function stripUtf8Bom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * 把任意字符串消毒成可安全用作路径段（lock 路径 / claim 文件名段）的片段：
 * 非 [a-zA-Z0-9._-] 字符统一替换为 `_`。
 */
export function sanitizePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '_');
}
