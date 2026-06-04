import type { Scope } from './response.js';

/** 错误条目状态。 */
export type ErrorStatus = 'incident' | 'promoted' | 'archived';

/** 错误条目 frontmatter。 */
export interface ErrorFrontmatter {
  id: string;
  /** symptom + root_cause 的 sha256 前缀，长度由配置控制。 */
  fingerprint: string;
  status: ErrorStatus;
  scope: Scope;
  occurrence_count: number;
  first_seen: string;
  last_seen: string;
  promoted_at?: string;
  tags?: string[];
}

/** 错误条目主体。 */
export interface ErrorBody {
  symptom: string;
  root_cause: string;
  fix_action: string;
  /** promote 时必须提供的验证证据。 */
  verification?: string;
  references?: string[];
}

/** 错误条目完整对象。 */
export interface ErrorEntry extends ErrorFrontmatter {
  path: string;
  body: ErrorBody;
}

/** 记录错误的输入。 */
export interface RecordErrorInput {
  symptom: string;
  root_cause: string;
  fix_action: string;
  scope: Scope;
  verification?: string;
  references?: string[];
  tags?: string[];
}

/** 提升错误条目的输入。 */
export interface PromoteErrorInput {
  id: string;
  scope?: Scope;
  verification?: string;
}

/** 搜索错误条目的输入。 */
export interface SearchErrorInput {
  query: string;
  scope?: Scope;
}
