/**
 * Searcher —— 目录优先的轻量检索。
 *
 * M1 不使用向量和数据库：先用 L0/L1 摘要及目录层级做候选打分，
 * 再在候选文件中 grep 片段，返回 context:// URI。
 */

import { FileStorage } from '../storage/FileStorage.js';
import { filePathToURI } from '../storage/URIRouter.js';
import { loadConfig } from '../shared/config.js';
import { LrnevError, ErrorCode } from '../shared/errors.js';
import { extractAnchorSections, clampText, ANCHOR_CONTEXT_SECTION_CAP } from './TaskManager.js';
import type { AiFollowupResponse, Scope } from '../types/response.js';
import type { SearchInput, SearchResponse, SearchResult } from '../types/search.js';

export class Searcher {
  constructor(private readonly fs: FileStorage) {}

  async search(input: SearchInput): Promise<AiFollowupResponse<SearchResponse>> {
    const query = input.query.trim();
    if (!query) {
      throw new LrnevError(ErrorCode.INVALID_INPUT, 'query 不能为空', { field: 'query' });
    }
    const scope = input.scope ?? 'global';
    const config = loadConfig(this.fs.root);
    const maxDepth = input.max_depth ?? config.search.max_depth;
    const terms = tokenize(query);
    const candidates = await this.collectCandidates(scope, maxDepth);
    // Pass 1：读全部候选，统计每文档每词出现次数与文档长度——BM25 需 df / avgdl 这类跨文档量。
    const scanned: Array<{ file: string; text: string; counts: number[]; length: number }> = [];
    for (const file of candidates) {
      const text = await this.fs.read(file).catch(() => '');
      const lower = text.toLowerCase();
      scanned.push({ file, text, counts: terms.map((term) => countOccurrences(lower, term)), length: lower.length });
    }
    const docFreq = terms.map((_, i) => scanned.reduce((n, doc) => n + (doc.counts[i]! > 0 ? 1 : 0), 0));
    const avgdl = scanned.length > 0 ? scanned.reduce((sum, doc) => sum + doc.length, 0) / scanned.length : 0;

    // Pass 2：召回谓词（裸命中）独立于排序分——BM25 只算排序，不当召回门，避免负 IDF 误踢命中文档（召回集不缩小）。
    const results: SearchResult[] = [];
    for (const doc of scanned) {
      if (!doc.counts.some((count) => count > 0)) continue;
      const rank = bm25Score(doc.counts, doc.length, docFreq, avgdl, scanned.length)
        + (config.search.use_l0_ranking ? levelBoost(doc.file) : 0);
      const uri = filePathToURI(doc.file) ?? filePathToURI(this.stripSummaryFile(doc.file));
      if (!uri) continue;
      // F-02：命中落在 requirements/design 的 #### F-xx / #### D-xx 段内时，snippet 升级为该锚点段落 + anchor 字段；
      // 命中段外（L0 摘要/frontmatter）保持行级 snippet。
      const anchored = resolveAnchorSnippet(doc.file, doc.text, terms);
      results.push({
        uri,
        path: doc.file,
        score: rank,
        matched_level: matchedLevel(doc.file),
        snippet: anchored ? anchored.snippet : makeSnippet(doc.text, terms, config.search.snippet_length),
        ...(anchored && { anchor: anchored.anchor }),
      });
    }

    results.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
    const top = results.slice(0, config.search.top_k);
    return {
      ok: true,
      data: {
        query,
        scope,
        max_depth: maxDepth,
        results: top,
      },
      ai_followup: {
        instructions: top.length > 0
          ? ['请优先读取排名靠前的 URI，再决定是否需要读取 L2 全文。']
          : ['没有找到明显匹配项；请尝试换关键词，或先补充 L0/L1 摘要。'],
      },
    };
  }

  private async collectCandidates(scope: Scope, maxDepth: number): Promise<string[]> {
    const base = scope.startsWith('scene:')
      ? `.lrnev/scenes/${scope.slice('scene:'.length)}`
      : '.lrnev';
    const files = await this.fs.list(`${base}/**/*.{md,json}`, { dot: true });
    const ignoredDirs = loadConfig(this.fs.root).auto_analyzer.ignore_dirs;
    return files
      .filter((file) => !isIgnored(file, ignoredDirs))
      .filter((file) => depthFromBase(file, base) <= maxDepth + 2)
      .filter((file) => isSearchable(file));
  }

  private stripSummaryFile(file: string): string {
    const summary = parseSummarySidecar(file);
    if (!summary) return file;
    return summary.sourcePath;
  }
}

function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[\s,，。.;；:：/\\|()[\]{}"'`]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/** 统计 term 在已转小写文本中的出现次数（子串口径，与 tokenize 一致，对中文照常）。 */
function countOccurrences(haystackLower: string, termLower: string): number {
  if (termLower.length === 0) return 0;
  let count = 0;
  let idx = haystackLower.indexOf(termLower);
  while (idx !== -1) {
    count += 1;
    idx = haystackLower.indexOf(termLower, idx + termLower.length);
  }
  return count;
}

/**
 * BM25 排序分（k1/b 经典取值）：词频饱和（出现 10 次≠10 倍相关）+ 文档长度归一化（短而精准不被长文档高频词压过）。
 * IDF 取 ln(1 + (N-df+0.5)/(df+0.5))，恒非负；召回由裸命中谓词独立把关，BM25 只管排序，不影响召回集。
 */
function bm25Score(counts: number[], docLen: number, docFreq: number[], avgdl: number, n: number, k1 = 1.2, b = 0.75): number {
  let score = 0;
  for (let i = 0; i < counts.length; i += 1) {
    const f = counts[i]!;
    if (f <= 0) continue;
    const idf = Math.log(1 + (n - docFreq[i]! + 0.5) / (docFreq[i]! + 0.5));
    const norm = avgdl > 0 ? docLen / avgdl : 1;
    score += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * norm));
  }
  return score;
}

function levelBoost(file: string): number {
  const summary = parseSummarySidecar(file);
  if (summary?.level === 'L0') return 8;
  if (summary?.level === 'L1') return 4;
  return 0;
}

function matchedLevel(file: string): SearchResult['matched_level'] {
  const summary = parseSummarySidecar(file);
  if (summary) return summary.level;
  return 'L2';
}

function parseSummarySidecar(file: string): { sourcePath: string; level: 'L0' | 'L1' } | null {
  const match = /^(?:(.*)\/)?\.([^/]+)\.(abstract|overview)\.md$/.exec(file);
  if (!match) return null;
  const dir = match[1];
  const name = match[2]!;
  const suffix = match[3]!;
  const sourcePath = dir ? `${dir}/${name}.md` : `${name}.md`;
  return {
    sourcePath,
    level: suffix === 'abstract' ? 'L0' : 'L1',
  };
}

function makeSnippet(text: string, terms: string[], maxLength: number): string {
  const lines = text.split(/\r?\n/);
  const found = lines.find((line) => terms.some((term) => line.toLowerCase().includes(term)));
  return (found ?? lines.find((line) => line.trim().length > 0) ?? '').trim().slice(0, maxLength);
}

/** requirements.md→F 锚点，design.md→D 锚点，其余文件无锚点。 */
function anchorPrefixForFile(file: string): 'F' | 'D' | null {
  if (file.endsWith('/requirements.md')) return 'F';
  if (file.endsWith('/design.md')) return 'D';
  return null;
}

/**
 * F-02：若命中落在 requirements/design 的某个 `#### F-xx`/`#### D-xx` 锚点段内，
 * 返回该段（受 01-00 同款截断）+ 锚点 ID；多段命中取词频最高的一段；命中段外返回 null（退回行级 snippet）。
 * 复用 01-00 沉淀的 extractAnchorSections（定位逻辑），不复用其 IO。
 */
function resolveAnchorSnippet(
  file: string,
  text: string,
  terms: string[],
): { anchor: string; snippet: string } | null {
  const prefix = anchorPrefixForFile(file);
  if (!prefix) return null;
  let best: { anchor: string; section: string; score: number } | null = null;
  for (const [anchor, section] of extractAnchorSections(text, prefix)) {
    const lower = section.toLowerCase();
    const score = terms.reduce((sum, term) => sum + countOccurrences(lower, term), 0);
    if (score > 0 && (!best || score > best.score)) best = { anchor, section, score };
  }
  if (!best) return null;
  return { anchor: best.anchor, snippet: clampText(best.section, ANCHOR_CONTEXT_SECTION_CAP).text };
}

function depthFromBase(file: string, base: string): number {
  const rel = file.startsWith(`${base}/`) ? file.slice(base.length + 1) : file;
  return rel.split('/').length;
}

function isSearchable(file: string): boolean {
  return (
    file.endsWith('.md') ||
    file.endsWith('.json')
  ) && !/\/state\//.test(file) && !/\/locks\//.test(file);
}

function isIgnored(file: string, ignoredDirs: string[]): boolean {
  return ignoredDirs.some((dir) => file.includes(`/${dir}/`));
}
