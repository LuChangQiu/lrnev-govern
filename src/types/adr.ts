import type { Scope } from './response.js';

/** ADR 状态。 */
export type ADRStatus = 'proposed' | 'accepted' | 'deprecated' | 'superseded';

/** ADR frontmatter 字段。 */
export interface ADRFrontmatter {
  /** 四位补零编号。 */
  number: string;
  title: string;
  status: ADRStatus;
  scope: Scope;
  created: string;
  date: string;
  /** 被当前 ADR 替代的 ADR 编号。 */
  supersedes?: string[];
}

/** ADR 主体章节。 */
export interface ADRBody {
  context: string;
  decision: string;
  alternatives?: string[];
  consequences?: string;
}

/** ADR 完整对象。 */
export interface ADR extends ADRFrontmatter {
  path: string;
  body: ADRBody;
}

/** 创建 ADR 的输入。 */
export interface CreateADRInput {
  title: string;
  scope: Scope;
  context: string;
  decision: string;
  alternatives?: string[];
  consequences?: string;
  supersedes?: string[];
}
