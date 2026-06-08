/**
 * 统一运行时配置。
 *
 * 用户可在 `.lrnev/config/lrnev.json` 覆盖任意子集。
 * 可调阈值和限制以 `DEFAULT_CONFIG` 为唯一默认来源。
 * ID 格式、状态机、目录名、URI scheme、错误码、校验正则等协议契约写死在所属模块。
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { WORKSPACE_DIR } from './paths.js';
import { LrnevError, ErrorCode } from './errors.js';
import { stripUtf8Bom } from './text.js';

export interface LrnevConfig {
  lock: {
    /** 内部目录锁获取重试次数。 */
    directory_lock_retries: number;
    /** 内部目录锁重试间隔毫秒数。 */
    directory_lock_delay_ms: number;
  };

  doctor: {
    /** Task 处于 in_progress 超过多少天后报告为陈旧任务。 */
    stale_task_days: number;
    /** `.lrnev/locks` 下物理锁目录超过多少分钟后报告为陈旧锁。 */
    stale_lock_minutes: number;
  };

  search: {
    /** context_search 递归扫描的最大深度。 */
    max_depth: number;
    /** context_search 单次最多返回多少条结果。 */
    top_k: number;
    /** 单条搜索摘要片段最大字符数。 */
    snippet_length: number;
    /** 是否使用 L0/L1 摘要加权。 */
    use_l0_ranking: boolean;
  };

  auto_analyzer: {
    /** 从 workspace root 开始搜索 manifest 的最大目录深度。 */
    max_manifest_depth: number;
    /** 自动分析时最多抽样多少个源码文件。 */
    max_sample_files: number;
    /** 自动分析和搜索跳过的目录名。 */
    ignore_dirs: string[];
  };

  errorbook: {
    /** 错误指纹 hash 前缀长度。 */
    fingerprint_length: number;
  };

  memory: {
    /** 同类别记忆去重的关键词相似度阈值。 */
    dedup_similarity_threshold: number;
    /** 单次 session_commit 最多处理多少条候选记忆。 */
    max_candidates_per_commit: number;
  };

  spec: {
    /** Spec 文档超过多少 KB 后 doctor 给出警告。 */
    file_size_warning_kb: number;
    /** Spec 创建时遇到并发冲突后的最大重试次数。 */
    create_max_attempts: number;
  };

  scene: {
    /** Scene 创建时遇到并发冲突后的最大重试次数。 */
    create_max_attempts: number;
  };

  project_status: {
    /** project_status 返回最近 ADR / error 的最大条数。 */
    recent_limit: number;
    /** project_status 每个 Spec 预览的可领取任务数。 */
    claimable_preview: number;
  };

  claim: {
    /** 默认 task claim 租约秒数，agent_heartbeat 会续租。 */
    default_ttl_seconds: number;
    /** 最大 task claim 租约秒数，防止误传超长占用。 */
    max_ttl_seconds: number;
  };

  agent: {
    /**
     * 跨主机兜底阈值:last_heartbeat 超过该毫秒数未更新即判 dead。
     * 同主机存活以 pid 探活为准,不看心跳年龄;仅在无法探 pid(跨 host / pid 缺失)时回退到本阈值。
     */
    heartbeat_dead_ms: number;
  };

  hooks: {
    /** hook 未显式配置 timeout_ms 时使用的默认超时。 */
    default_timeout_ms: number;
    /** 单个 hook 允许配置的最大超时。 */
    max_timeout_ms: number;
    /** hook stdout/stderr 保留的尾部字节数。 */
    output_tail_bytes: number;
    /** hook 日志超过该字节数后轮转。 */
    log_rotate_bytes: number;
    /** hook list 默认读取的最近日志条数。 */
    recent_list_limit: number;
    /** doctor 扫描 hook 健康状态时读取的最近日志条数。 */
    health_scan_limit: number;
    /** 连续多少次 timeout 后 doctor 报告慢性超时。 */
    chronic_timeout_threshold: number;
    /** 连续多少次非 success 后 doctor 报告慢性失败。 */
    chronic_failure_threshold: number;
  };

  storage: {
    /** 只读 frontmatter 时最多预读多少字节。 */
    frontmatter_read_bytes: number;
  };
}

export const DEFAULT_CONFIG: LrnevConfig = {
  lock: {
    directory_lock_retries: 200,
    directory_lock_delay_ms: 5,
  },
  doctor: {
    stale_task_days: 7,
    stale_lock_minutes: 60,
  },
  search: {
    max_depth: 3,
    top_k: 10,
    snippet_length: 240,
    use_l0_ranking: true,
  },
  auto_analyzer: {
    max_manifest_depth: 3,
    max_sample_files: 20,
    ignore_dirs: [
      'node_modules', 'dist', 'build', '.git', 'coverage', '.next', 'target',
      '.idea', '.vscode', 'logs', '.gradle', 'vendor', '__pycache__', '.venv', 'venv', 'out', 'tmp',
    ],
  },
  errorbook: {
    fingerprint_length: 12,
  },
  memory: {
    dedup_similarity_threshold: 0.8,
    max_candidates_per_commit: 20,
  },
  spec: {
    file_size_warning_kb: 200,
    create_max_attempts: 10,
  },
  scene: {
    create_max_attempts: 10,
  },
  project_status: {
    recent_limit: 5,
    claimable_preview: 5,
  },
  claim: {
    default_ttl_seconds: 120,
    max_ttl_seconds: 86_400,
  },
  agent: {
    heartbeat_dead_ms: 90_000,
  },
  hooks: {
    default_timeout_ms: 30_000,
    max_timeout_ms: 600_000,
    output_tail_bytes: 2048,
    log_rotate_bytes: 10 * 1024 * 1024,
    recent_list_limit: 5,
    health_scan_limit: 100,
    chronic_timeout_threshold: 3,
    chronic_failure_threshold: 5,
  },
  storage: {
    frontmatter_read_bytes: 64 * 1024,
  },
};

export const CONFIG_FILE_REL = `${WORKSPACE_DIR}/config/lrnev.json`;

export function loadConfig(workspaceRoot: string): LrnevConfig {
  const configPath = join(workspaceRoot, CONFIG_FILE_REL);

  if (!existsSync(configPath)) {
    return deepClone(DEFAULT_CONFIG);
  }

  let userOverride: unknown;
  try {
    const raw = readFileSync(configPath, 'utf-8');
    userOverride = JSON.parse(stripUtf8Bom(raw));
  } catch (err) {
    throw new LrnevError(
      ErrorCode.INTERNAL_ERROR,
      `配置文件解析失败：${configPath}`,
      {
        field: 'config',
        hint: '检查 JSON 语法。',
        cause: err,
      },
    );
  }

  return mergeConfig(DEFAULT_CONFIG, userOverride);
}

export function mergeConfig(
  base: LrnevConfig,
  override: unknown,
): LrnevConfig {
  if (!isPlainObject(override)) {
    return deepClone(base);
  }
  return deepMerge(base, override) as LrnevConfig;
}

function deepMerge<T>(base: T, override: Record<string, unknown>): T {
  if (!isPlainObject(base)) return deepClone(base);
  const baseObj = base as unknown as Record<string, unknown>;
  const result: Record<string, unknown> = { ...baseObj };

  for (const [key, baseVal] of Object.entries(baseObj)) {
    if (!(key in override)) continue;
    const overrideVal = override[key];
    if (overrideVal === undefined || overrideVal === null) continue;

    if (isPlainObject(baseVal) && isPlainObject(overrideVal)) {
      result[key] = deepMerge(baseVal, overrideVal as Record<string, unknown>);
    } else if (Array.isArray(baseVal) && Array.isArray(overrideVal)) {
      result[key] = [...overrideVal];
    } else if (typeof baseVal === typeof overrideVal) {
      result[key] = overrideVal;
    } else {
      result[key] = baseVal;
    }
  }

  return result as unknown as T;
}

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function deepClone<T>(x: T): T {
  return structuredClone(x);
}

export function getConfigPathHint(): string {
  return CONFIG_FILE_REL;
}
