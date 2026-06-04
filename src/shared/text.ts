/** 去掉 UTF-8 BOM，兼容 Windows 工具写出的 JSON/文本文件。 */
export function stripUtf8Bom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}
