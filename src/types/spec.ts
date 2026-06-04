/**
 * Spec 类型定义
 *
 * Spec 是一次功能开发的完整交付包，挂在某个 Scene 下。
 * 包含三份核心文档：requirements.md / design.md / tasks.md
 *
 * 物理位置：.lrnev/scenes/{scene}/specs/{spec}/
 * 命名格式：{序号:02d}-{版本:02d}-{kebab-name}
 *   - 序号：在 Scene 内单调递增
 *   - 版本：重写时升级（默认 00）
 * 例如：01-00-user-registration、02-00-user-login、03-01-password-reset
 */

/** Spec 状态 */
export const SpecStatus = {
  DRAFT: 'draft',
  READY: 'ready',
  IN_PROGRESS: 'in-progress',
  COMPLETED: 'completed',
  ARCHIVED: 'archived',
} as const;

export type SpecStatus = (typeof SpecStatus)[keyof typeof SpecStatus];

export const VALID_SPEC_TRANSITIONS: Record<SpecStatus, readonly SpecStatus[]> = {
  draft: ['ready', 'archived'],
  ready: ['in-progress', 'draft', 'archived'],
  'in-progress': ['completed', 'ready', 'archived'],
  completed: ['archived', 'in-progress'],
  archived: [],
} as const;

/** Spec 优先级 */
export type SpecPriority = 'P0' | 'P1' | 'P2' | 'P3';

/** Spec 文档类型 */
export type SpecDocument = 'requirements' | 'design' | 'tasks';

/** Spec frontmatter 字段（出现在 requirements.md 顶部） */
export interface SpecFrontmatter {
  /** 完整 ID，例如 "01-00-user-registration" */
  spec: string;

  /** 所属 Scene ID，例如 "01-user-management" */
  scene: string;

  /** 状态 */
  status: SpecStatus;

  /** 优先级 */
  priority?: SpecPriority;

  /** 创建时间 */
  created: string;

  /** 最后更新时间 */
  updated?: string;
}

/** 损坏条目标记，用于 list() 降级返回 */
export interface BrokenSpecInfo {
  /** 损坏原因 */
  error: string;

  /** 相关文件绝对路径 */
  path: string;
}

/** Spec 完整对象 */
export interface Spec extends SpecFrontmatter {
  /** 绝对路径（指向 .lrnev/scenes/{scene}/specs/{spec}/ 目录） */
  path: string;

  /** Spec 内序号（前两位） */
  number: number;

  /** 版本号（中两位） */
  version: number;

  /** Spec 名称（最后部分，kebab-case） */
  name: string;

  /** 三文档存在性检查 */
  documents: Record<SpecDocument, boolean>;

  /** list() 降级条目标记；正常条目无此字段 */
  broken?: BrokenSpecInfo;
}

/** 创建 Spec 的输入 */
export interface CreateSpecInput {
  /** 所属 Scene */
  scene?: string;

  /** kebab-case 名称（不含序号和版本） */
  name: string;

  /** 可选：手动指定版本（默认 0） */
  version?: number;

  /** 可选：优先级 */
  priority?: SpecPriority;
}

export function isValidSpecTransition(from: SpecStatus, to: SpecStatus): boolean {
  return VALID_SPEC_TRANSITIONS[from].includes(to);
}
