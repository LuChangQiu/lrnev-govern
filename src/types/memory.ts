import type { Scope } from './response.js';

/** 记忆分类。 */
export const MemoryCategory = {
  PREFERENCES: 'preferences',
  DECISIONS: 'decisions',
  PATTERNS: 'patterns',
  ERRORS: 'errors',
  FACTS: 'facts',
} as const;

export type MemoryCategory = (typeof MemoryCategory)[keyof typeof MemoryCategory];

/** 记忆 frontmatter。 */
export interface MemoryFrontmatter {
  id: string;
  category: MemoryCategory;
  scope: Scope;
  source: string;
  created: string;
  last_referenced?: string;
  reference_count?: number;
  tentative?: boolean;
}

/** 记忆完整对象。 */
export interface Memory extends MemoryFrontmatter {
  path: string;
  content: string;
}

/** 保存记忆的输入。 */
export interface SaveMemoryInput {
  category: MemoryCategory;
  content: string;
  source: string;
  scope: Scope;
  tentative?: boolean;
}

/** session_commit 的候选记忆。 */
export interface MemoryCandidate {
  category: MemoryCategory;
  content: string;
  source: string;
}

export interface SessionCommitInput {
  summary: string;
  candidates: MemoryCandidate[];
  scope?: Scope;
}

export interface SessionCommitResult {
  saved: Memory[];
  skipped: SkippedMemory[];
}

export interface SkippedMemory {
  candidate: MemoryCandidate;
  reason: 'duplicate' | 'invalid' | 'rejected';
  similar_to?: string;
}

export interface SearchMemoryInput {
  query: string;
  scope?: Scope;
  category?: MemoryCategory;
}

export interface ForgetMemoryInput {
  id: string;
  scope?: Scope;
  category: MemoryCategory;
}
