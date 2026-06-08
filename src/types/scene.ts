/**
 * Scene 类型定义
 *
 * Scene 是业务边界容器（如"用户管理"、"订单履约"），
 * 一个 Scene 下可有多个 Spec。
 *
 * 物理位置：.lrnev/scenes/{NN-name}/
 * 文件：
 *   - scene.md           主文档（边界、意图、术语）
 *   - architecture.md    架构（共享设计）
 *   - roadmap.md         路线图
 *   - .<doc>.abstract.md L0 摘要（AI 生成，按源文档键控）
 *   - .<doc>.overview.md L1 概览（AI 生成，按源文档键控）
 *   - specs/             下属 Spec 目录
 *   - decisions/         Scene 局部 ADR（可选）
 *   - errorbook/         Scene 局部错误手册（可选）
 *   - memory/            Scene 局部记忆（可选）
 */

/** Scene 状态 */
export type SceneStatus = 'draft' | 'active' | 'archived';

/** Scene 主文档的 frontmatter 字段 */
export interface SceneFrontmatter {
  /** 完整 ID，例如 "01-user-management" */
  id: string;

  /** 序号（扫描现有目录 max+1 分配），例如 1 */
  number: number;

  /** 名称（kebab-case），例如 "user-management" */
  name: string;

  /** 状态 */
  status: SceneStatus;

  /** 创建时间（ISO 8601） */
  created: string;

  /** 最后更新时间（ISO 8601） */
  updated?: string;

  /** 业务意图描述（一句话） */
  intent?: string;
}

/** 损坏条目标记，用于 list() 降级返回 */
export interface BrokenSceneInfo {
  /** 损坏原因 */
  error: string;

  /** 相关文件绝对路径 */
  path: string;
}

/** Scene 完整对象（含路径与统计） */
export interface Scene extends SceneFrontmatter {
  /** 绝对路径（指向 .lrnev/scenes/{id}/ 目录） */
  path: string;

  /** Spec 数量统计 */
  spec_count: number;

  /** list() 降级条目标记；正常条目无此字段 */
  broken?: BrokenSceneInfo;
}

/** 创建 Scene 的输入参数 */
export interface CreateSceneInput {
  /** kebab-case 名称（不含序号） */
  name: string;

  /** 可选：手动指定序号 */
  number?: number;

  /** 可选：业务意图 */
  intent?: string;
}
