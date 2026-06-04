/**
 * WorkspaceLocator —— 工作区根定位与懒初始化
 *
 * 职责：
 *   1. resolveWorkspaceRoot()：三段式查找工作区根
 *      env LRNEV_WORKSPACE  >  向上查找 .lrnev/PROJECT.md  >  当前 cwd
 *   2. ensureWorkspace()：不存在则创建完整目录骨架 + 默认文件
 *
 * 设计权威：design.md 第 1.1 节、第 3 节
 *
 * 为什么不接受 projectPath 入参（不像 SCE）：
 *   MCP 形态下客户端不主动传路径，需要服务端自己探测。
 *   "向上查找" 是 git / npm / cargo 等工具的标准做法，符合用户预期。
 */

import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, parse, resolve } from 'node:path';

import {
  ENV_WORKSPACE,
  MEMORY_CATEGORIES,
  WORKSPACE_DIR,
  workspacePaths,
} from '../shared/paths.js';

/** 工作区定位结果 */
export interface WorkspaceLocation {
  /** 工作区根（包含 .lrnev/ 的目录） */
  root: string;
  /** 定位方式 */
  source: 'env' | 'lookup' | 'cwd';
  /** .lrnev/ 是否已存在 */
  exists: boolean;
}

/**
 * 定位工作区根目录。
 *
 * 查找顺序（与 design.md 第 1.1 节一致）：
 *   1. 环境变量 LRNEV_WORKSPACE（最高优先级，用户显式指定）
 *   2. 从 startDir 向上逐层查找包含 .lrnev/PROJECT.md 的已初始化目录
 *   3. 兜底：startDir 本身（懒初始化时会就地创建）
 *
 * @param startDir 起始目录，默认 process.cwd()
 */
export function resolveWorkspaceRoot(
  startDir: string = process.cwd(),
): WorkspaceLocation {
  // 1. 环境变量优先
  const envRoot = process.env[ENV_WORKSPACE];
  if (envRoot && envRoot.trim().length > 0) {
    const abs = resolve(envRoot);
    return {
      root: abs,
      source: 'env',
      exists: existsSync(join(abs, WORKSPACE_DIR)),
    };
  }

  // 2. 向上查找
  const found = findWorkspaceUpwards(startDir);
  if (found) {
    return { root: found, source: 'lookup', exists: true };
  }

  // 3. 兜底：当前目录（懒初始化使用）
  const abs = resolve(startDir);
  return {
    root: abs,
    source: 'cwd',
    exists: existsSync(join(abs, WORKSPACE_DIR)),
  };
}

/**
 * 从 startDir 出发向上逐层查找已初始化的 .lrnev/ 目录。
 *
 * 终止条件：到达文件系统根（path.parse(dir).root）。
 *
 * @returns 找到时返回包含 .lrnev/PROJECT.md 的目录绝对路径，找不到返回 null
 */
function findWorkspaceUpwards(startDir: string): string | null {
  let current = resolve(startDir);
  const rootSentinel = parse(current).root;

  // 防御性上限：避免软链或异常路径导致死循环
  for (let i = 0; i < 256; i++) {
    if (isInitializedWorkspace(current)) {
      return current;
    }
    if (current === rootSentinel) return null;
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }

  return null;
}

function isInitializedWorkspace(root: string): boolean {
  return existsSync(join(root, WORKSPACE_DIR, 'PROJECT.md'));
}

/**
 * 懒初始化工作区。
 *
 * 行为：
 *   - 不存在 .lrnev/ → 创建完整目录骨架
 *   - 已存在 → 检查标准子目录，缺什么补什么（幂等）
 *
 * 注意：本函数只建目录与最小骨架文件，
 *   PROJECT.md / ARCHITECTURE.md / steering 文档 由 lrnev_init 工具
 *   在 T-204 阶段调用本函数后单独写入（避免本层依赖模板）。
 *
 * @param root 工作区根（包含 .lrnev/ 的父目录）
 * @returns 是否是首次初始化（true=新建，false=已存在）
 */
export async function ensureWorkspace(root: string): Promise<boolean> {
  const paths = workspacePaths(root);
  const wasNew = !existsSync(paths.root);

  // 顺序创建所有标准目录（mkdir recursive 幂等）
  const dirs = [
    paths.root,
    paths.scenes,
    paths.adr,
    paths.errorbook,
    paths.errorbookIncidents,
    paths.errorbookPromoted,
    paths.memory,
    paths.steering,
    paths.auto,
    paths.config,
    paths.agents,
    paths.runtime,
    paths.claims,
    paths.locks,
    paths.state,
  ];
  for (const dir of dirs) {
    await mkdir(dir, { recursive: true });
  }

  // 五类记忆分类目录
  for (const category of MEMORY_CATEGORIES) {
    await mkdir(join(paths.memory, category), { recursive: true });
  }

  // 写入版本标记文件（state/version.json）
  const versionPath = join(paths.state, 'version.json');
  if (!existsSync(versionPath)) {
    const versionInfo = {
      lrnev_schema_version: '1',
      created_at: new Date().toISOString(),
    };
    await writeFile(versionPath, JSON.stringify(versionInfo, null, 2), 'utf-8');
  }

  return wasNew;
}
