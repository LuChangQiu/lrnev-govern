/**
 * GovernanceReport 类型（03-00 governance-report）。
 *
 * 零模型治理体检的结构化结果：链路完整度（收口缺口 + failed/blocked）+ validates 覆盖率
 * （孤儿/坏 validates/archived 口径）+ 每条欠债的可执行下一步 + 低优先 release notes。
 * core 只产出本数据对象，text/markdown 渲染在 CLI 层；MCP 直接返回本结构。
 */

import type { SpecStatus } from './spec.js';

/** 一个治理项的定位（人和 AI 都能跳过去）。 */
export interface ReportPaths {
  /** context://spec/<scene>/<spec> */
  uri: string;
  requirements_path: string;
  tasks_path: string;
}

/** "做完没收口"的 spec：task 全 completed 但 status 未推进。 */
export interface UnclosedSpec {
  scene: string;
  spec: string;
  name: string;
  /** 已完成 task 数 / 总 task 数（unclosed 时二者相等）。 */
  done: number;
  total: number;
  status: SpecStatus;
  /** 可执行下一步（T-004 填）。 */
  next_action?: string;
  /** 定位（T-002 填）。 */
  paths?: ReportPaths;
}

/** failed / blocked 任务明细。 */
export interface ReportTaskBrief {
  scene: string;
  spec: string;
  id: string;
  title: string;
  status: string;
  next_action?: string;
  paths?: ReportPaths;
}

/** 孤儿锚点分组（按所属 spec）。 */
export interface OrphanGroup {
  scene: string;
  spec: string;
  status: SpecStatus;
  /** 无任何 task validates 的 F-xx/D-xx。 */
  anchors: string[];
  /** 定位（在途/真欠债都带，便于跳转）。 */
  paths: ReportPaths;
  /** 真欠债（debt）带可执行下一步；在途孤儿正常态不带。 */
  next_action?: string;
}

/** 坏 validates：task 的 validates 指向不存在/废弃锚点；不计入 covered。 */
export interface BrokenValidatesItem {
  scene: string;
  spec: string;
  task: string;
  anchors: string[];
  paths: ReportPaths;
  /** 指向 doctor 的修复下一步。 */
  next_action: string;
}

/** 每个 scene 的链路汇总。 */
export interface ReportSceneStat {
  scene: string;
  name: string;
  spec_count: number;
  task_count: number;
  empty: boolean;
}

/** 链路完整度段。 */
export interface GovernanceReportChain {
  scene_count: number;
  spec_count: number;
  task_count: number;
  scenes: ReportSceneStat[];
  unclosed: UnclosedSpec[];
  failed_tasks: ReportTaskBrief[];
  blocked_tasks: ReportTaskBrief[];
}

/** validates 覆盖率段。 */
export interface GovernanceReportCoverage {
  anchor_total: number;
  anchor_covered: number;
  /** 0..1；空工作区按 1（100%）。 */
  coverage_ratio: number;
  in_flight_orphans: OrphanGroup[];
  debt_orphans: OrphanGroup[];
  /** 坏 validates 不计入 covered，单列并指向 doctor。 */
  broken_validates: BrokenValidatesItem[];
  /** 被排除统计的 archived spec 数。 */
  archived_excluded: number;
}

export interface ReleaseNotesSpec {
  spec: string;
  name: string;
  tasks: string[];
}

export interface ReleaseNotesScene {
  scene: string;
  name: string;
  specs: ReleaseNotesSpec[];
}

export interface GovernanceReportReleaseNotes {
  scenes: ReleaseNotesScene[];
}

/** report 的完整结果（CLI --json 与 MCP lrnev_report 同源）。 */
export interface GovernanceReportResult {
  generated_at: string;
  /** 'all' 或具体 scene id。 */
  scope: string;
  /** 确定性一句话总结。 */
  headline: string;
  chain: GovernanceReportChain;
  coverage: GovernanceReportCoverage;
  /** 仅 releaseNotes=true 时存在。 */
  release_notes?: GovernanceReportReleaseNotes;
  /** 如坏 validates 指向 doctor。 */
  warnings?: string[];
}

export interface GovernanceReportInput {
  /** 只体检指定 scene；不给则全量。 */
  scene?: string;
  /** 附 release notes 草稿段。 */
  releaseNotes?: boolean;
}
