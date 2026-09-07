import type { Level, Scope } from './response.js';

export interface SearchInput {
  query: string;
  scope?: Scope;
  max_depth?: number;
}

export interface SearchResult {
  uri: string;
  path: string;
  matched_level: Level;
  score: number;
  snippet: string;

  /** F-02：命中落在某 `#### F-xx` / `#### D-xx` 锚点段内时，标明命中哪个锚点（段外命中无此字段）。 */
  anchor?: string;
}

export interface SearchResponse {
  query: string;
  scope: Scope;
  max_depth: number;
  results: SearchResult[];

  /**
   * F-04.2 查询级截断元数据（ADR-0001）：context_search 先全量召回排序、再按
   * config.search.top_k slice，候选总数在截断点总是可得——随 data 返回供客户端
   * 判断省略了多少（omitted 恒为 none/exact，无 unknown 分支）。
   */
  query_meta?: import('./truncation.js').QueryMeta;
}
