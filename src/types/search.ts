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
}
