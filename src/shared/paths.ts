/**
 * 工作区路径常量
 *
 * 所有 lrnev 数据都存在用户项目根的 .lrnev/ 目录下，
 * 这里集中定义所有相对路径，避免硬编码字符串散落各处。
 *
 * 目录结构详见 design.md 第 3 节。
 */

import { join } from 'node:path';

/** 工作区根标识目录名 */
export const WORKSPACE_DIR = '.lrnev';

/** 环境变量名：用户可显式指定工作区根 */
export const ENV_WORKSPACE = 'LRNEV_WORKSPACE';

/**
 * 给定 workspace root，返回 .lrnev/ 内所有标准子路径。
 * 用法：
 *   const paths = workspacePaths('/repo');
 *   paths.scenes  // /repo/.lrnev/scenes
 */
export function workspacePaths(root: string): {
  /** .lrnev/ 自身 */
  root: string;
  /** .lrnev/PROJECT.md */
  projectMd: string;
  /** .lrnev/ARCHITECTURE.md */
  architectureMd: string;
  /** .lrnev/scenes/ */
  scenes: string;
  /** .lrnev/decisions/adr/ */
  adr: string;
  /** .lrnev/errorbook/ */
  errorbook: string;
  /** .lrnev/errorbook/incidents/ */
  errorbookIncidents: string;
  /** .lrnev/errorbook/promoted/ */
  errorbookPromoted: string;
  /** .lrnev/memory/ */
  memory: string;
  /** .lrnev/steering/ */
  steering: string;
  /** .lrnev/auto/ */
  auto: string;
  /** .lrnev/auto/codebase.json */
  codebaseJson: string;
  /** .lrnev/config/ */
  config: string;
  /** .lrnev/agents/ */
  agents: string;
  /** .lrnev/runtime/ */
  runtime: string;
  /** .lrnev/runtime/claims/ */
  claims: string;
  /** .lrnev/locks/ */
  locks: string;
  /** .lrnev/state/ */
  state: string;
} {
  const base = join(root, WORKSPACE_DIR);
  return {
    root: base,
    projectMd: join(base, 'PROJECT.md'),
    architectureMd: join(base, 'ARCHITECTURE.md'),
    scenes: join(base, 'scenes'),
    adr: join(base, 'decisions', 'adr'),
    errorbook: join(base, 'errorbook'),
    errorbookIncidents: join(base, 'errorbook', 'incidents'),
    errorbookPromoted: join(base, 'errorbook', 'promoted'),
    memory: join(base, 'memory'),
    steering: join(base, 'steering'),
    auto: join(base, 'auto'),
    codebaseJson: join(base, 'auto', 'codebase.json'),
    config: join(base, 'config'),
    agents: join(base, 'agents'),
    runtime: join(base, 'runtime'),
    claims: join(base, 'runtime', 'claims'),
    locks: join(base, 'locks'),
    state: join(base, 'state'),
  };
}

/** 五类记忆子目录名 */
export const MEMORY_CATEGORIES = [
  'preferences',
  'decisions',
  'patterns',
  'errors',
  'facts',
] as const;
