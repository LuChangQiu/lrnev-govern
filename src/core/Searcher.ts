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
    const results: SearchResult[] = [];

    for (const file of candidates) {
      const text = await this.fs.read(file).catch(() => '');
      const textScore = scoreText(text, terms);
      if (textScore <= 0) continue;
      const score = textScore + (config.search.use_l0_ranking ? levelBoost(file) : 0);
      const uri = filePathToURI(file) ?? filePathToURI(this.stripSummaryFile(file));
      if (!uri) continue;
      results.push({
        uri,
        path: file,
        score,
        matched_level: matchedLevel(file),
        snippet: makeSnippet(text, terms, config.search.snippet_length),
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
    if (!file.endsWith('/.abstract.md') && !file.endsWith('/.overview.md')) return file;
    const dir = file.slice(0, file.lastIndexOf('/'));
    if (this.fs.exists(`${dir}/requirements.md`)) return `${dir}/requirements.md`;
    const adr = file.match(/^(.*\/adr)\/\d{4}-.+\/\.(abstract|overview)\.md$/);
    if (adr) return dir;
    if (this.fs.exists(`${dir}/scene.md`)) return `${dir}/scene.md`;
    if (this.fs.exists(`${dir}/README.md`)) return `${dir}/README.md`;
    return file;
  }
}

function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[\s,，。.;；:：/\\|()[\]{}"'`]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function scoreText(text: string, terms: string[]): number {
  const lower = text.toLowerCase();
  let score = 0;
  for (const term of terms) {
    const matches = lower.matchAll(new RegExp(escapeRegExp(term), 'g'));
    score += [...matches].length;
  }
  return score;
}

function levelBoost(file: string): number {
  if (file.endsWith('/.abstract.md')) return 8;
  if (file.endsWith('/.overview.md')) return 4;
  return 0;
}

function matchedLevel(file: string): SearchResult['matched_level'] {
  if (file.endsWith('/.abstract.md')) return 'L0';
  if (file.endsWith('/.overview.md')) return 'L1';
  return 'L2';
}

function makeSnippet(text: string, terms: string[], maxLength: number): string {
  const lines = text.split(/\r?\n/);
  const found = lines.find((line) => terms.some((term) => line.toLowerCase().includes(term)));
  return (found ?? lines.find((line) => line.trim().length > 0) ?? '').trim().slice(0, maxLength);
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
