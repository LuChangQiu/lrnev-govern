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
}

export interface SearchResponse {
  query: string;
  scope: Scope;
  max_depth: number;
  results: SearchResult[];
}
