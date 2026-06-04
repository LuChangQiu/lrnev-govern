/**
 * MarkdownParser —— Markdown 章节切分与组装
 *
 * 设计目的：
 *   1. 把 Markdown 按二级标题（## ）切成 sections，供 L0/L1/L2 分层加载使用
 *   2. 支持按章节名读写：getSection / setSection
 *   3. 与 FrontmatterCodec 配合，实现"frontmatter + 章节化 body"的双向处理
 *
 * 设计权威：design.md 第 4.6 节（?level= 查询参数）
 */

import {
  parseFrontmatter,
  serializeFrontmatter,
  type Parsed,
} from './FrontmatterCodec.js';

/** 单个章节 */
export interface Section {
  /** 标题文本（不含 ## 前缀） */
  title: string;
  /** 原始标题级别（## = 2、### = 3） */
  level: number;
  /** 章节内容（不含标题行，保留内部换行，trim 前后空白） */
  content: string;
}

/**
 * 完整文档结构：frontmatter + lead（首个标题前的内容）+ sections
 */
export interface ParsedDocument<T = Record<string, unknown>> extends Parsed<T> {
  /**
   * 首个 ## 标题之前的内容（通常是 H1 + 简介）。
   * 注意 H1（#）也算 lead 的一部分，本切分只识别 ##。
   */
  lead: string;
  /** 二级章节列表（按出现顺序） */
  sections: Section[];
}

export type MarkdownRange = [start: number, end: number];

export function extractCodeRanges(content: string): MarkdownRange[] {
  const ranges: MarkdownRange[] = [];
  const lines = content.split(/\r?\n/);
  const eols = content.match(/\r?\n/g) ?? [];
  let offset = 0;
  let fenceStart: number | null = null;
  let fenceMarker: '`' | '~' | null = null;
  let fenceLength = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const lineStart = offset;
    const lineEnd = lineStart + line.length + (eols[i]?.length ?? 0);
    const fence = /^\s*(`{3,}|~{3,})/.exec(line);

    if (fence) {
      const markerText = fence[1]!;
      const marker = markerText[0] as '`' | '~';
      if (fenceStart === null) {
        fenceStart = lineStart;
        fenceMarker = marker;
        fenceLength = markerText.length;
      } else if (marker === fenceMarker && markerText.length >= fenceLength) {
        ranges.push([fenceStart, lineEnd]);
        fenceStart = null;
        fenceMarker = null;
        fenceLength = 0;
      }
    } else if (fenceStart === null) {
      ranges.push(...extractInlineCodeRanges(line, lineStart));
    }

    offset = lineEnd;
  }

  if (fenceStart !== null) {
    ranges.push([fenceStart, content.length]);
  }

  return ranges;
}

export function inRanges(ranges: MarkdownRange[], start: number, end: number): boolean {
  return ranges.some(([rangeStart, rangeEnd]) => start < rangeEnd && end > rangeStart);
}

function extractInlineCodeRanges(line: string, lineStart: number): MarkdownRange[] {
  const ranges: MarkdownRange[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] !== '`') {
      i++;
      continue;
    }
    const openStart = i;
    while (i < line.length && line[i] === '`') i++;
    const tickCount = i - openStart;
    const closeStart = line.indexOf('`'.repeat(tickCount), i);
    if (closeStart === -1) {
      if (tickCount === 2) ranges.push([lineStart + openStart, lineStart + i]);
      continue;
    }
    ranges.push([lineStart + openStart, lineStart + closeStart + tickCount]);
    i = closeStart + tickCount;
  }
  return ranges;
}

/**
 * 解析完整 Markdown 文档（含 frontmatter + 章节）。
 *
 * 切分规则：
 *   - 遇到行首 "## " 即为新二级章节
 *   - 二级章节内可有 ###、####（不再细分）
 *   - frontmatter 之后到第一个 ## 之间的所有内容算 lead
 */
export function parseDocument<T = Record<string, unknown>>(
  content: string,
): ParsedDocument<T> {
  const parsed = parseFrontmatter<T>(content);
  const { lead, sections } = splitSections(parsed.body);
  return { ...parsed, lead, sections };
}

/** 按 ## 切分 body */
function splitSections(body: string): {
  lead: string;
  sections: Section[];
} {
  const lines = body.split(/\r?\n/);
  const sections: Section[] = [];
  let lead: string[] = [];
  let current: { title: string; level: number; buffer: string[] } | null = null;

  for (const line of lines) {
    const match = /^(#{2,})\s+(.+?)\s*$/.exec(line);
    if (match && match[1] !== undefined && match[2] !== undefined && match[1].length === 2) {
      // 遇到新二级章节，先把上一个 flush
      if (current) {
        sections.push({
          title: current.title,
          level: current.level,
          content: current.buffer.join('\n').trim(),
        });
      } else {
        // 进入第一个章节前，把 lead 锁定
      }
      current = { title: match[2], level: 2, buffer: [] };
      continue;
    }

    if (current) {
      current.buffer.push(line);
    } else {
      lead.push(line);
    }
  }

  if (current) {
    sections.push({
      title: current.title,
      level: current.level,
      content: current.buffer.join('\n').trim(),
    });
  }

  return {
    lead: lead.join('\n').trim(),
    sections,
  };
}

/**
 * 按章节标题查找内容（大小写敏感、完全匹配）。
 *
 * 用于 L0/L1 加载：
 *   getSection(doc, 'L0 摘要')
 *   getSection(doc, 'L1 概览')
 *
 * @returns 找到时返回 section.content，找不到返回 null
 */
export function getSection<T>(
  doc: ParsedDocument<T>,
  title: string,
): string | null {
  const section = doc.sections.find((s) => s.title === title);
  return section ? section.content : null;
}

/**
 * 模糊匹配章节标题（忽略大小写、忽略前后空白）。
 * 用于 L0/L1 这种用户可能写成 "L0" / "L0 摘要" / "L0 abstract" 的场景。
 */
export function findSection<T>(
  doc: ParsedDocument<T>,
  predicate: (title: string) => boolean,
): Section | null {
  return doc.sections.find((s) => predicate(s.title)) ?? null;
}

/**
 * 序列化完整文档：frontmatter + lead + sections。
 *
 * 章节按 sections 数组顺序输出，每个章节之间留一个空行。
 */
export function serializeDocument<T extends Record<string, unknown>>(
  frontmatter: T,
  lead: string,
  sections: Section[],
): string {
  const parts: string[] = [];

  const leadTrimmed = lead.trim();
  if (leadTrimmed.length > 0) {
    parts.push(leadTrimmed);
  }

  for (const sec of sections) {
    const hashes = '#'.repeat(sec.level);
    parts.push(`${hashes} ${sec.title}\n\n${sec.content.trim()}`);
  }

  const body = parts.join('\n\n');
  return serializeFrontmatter(frontmatter, body);
}
