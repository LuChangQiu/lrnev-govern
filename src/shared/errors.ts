/**
 * 统一错误码与 LrnevError。
 *
 * core / storage 层抛出的业务错误必须使用 LrnevError；MCP / CLI 层负责把
 * LrnevError 转成对应响应格式。
 */

export const ErrorCode = {
  /** Scene 不存在。 */
  SCENE_NOT_FOUND: 'SCENE_NOT_FOUND',

  /** Scene 目录或主文档损坏。 */
  SCENE_CORRUPTED: 'SCENE_CORRUPTED',

  /** Spec 不存在。 */
  SPEC_NOT_FOUND: 'SPEC_NOT_FOUND',

  /** Spec 目录或主文档损坏。 */
  SPEC_CORRUPTED: 'SPEC_CORRUPTED',

  /** 用户输入可解析为多个候选。 */
  AMBIGUOUS_REF: 'AMBIGUOUS_REF',

  /** Task 不存在。 */
  TASK_NOT_FOUND: 'TASK_NOT_FOUND',

  /** 任务状态转换不合法。 */
  INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',

  /** URI 格式错误。 */
  INVALID_URI: 'INVALID_URI',

  /** 文件不存在。 */
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',

  /** 目录锁被其他操作持有。 */
  LOCK_HELD_BY_OTHER: 'LOCK_HELD_BY_OTHER',

  /** Hook 执行失败。 */
  HOOK_FAILED: 'HOOK_FAILED',

  /** Hook 执行超时。 */
  HOOK_TIMEOUT: 'HOOK_TIMEOUT',

  /** Hook 配置无效。 */
  HOOK_CONFIG_INVALID: 'HOOK_CONFIG_INVALID',

  /** Agent 未注册。 */
  AGENT_NOT_REGISTERED: 'AGENT_NOT_REGISTERED',

  /** ADR 编号冲突。 */
  ADR_NUMBER_CONFLICT: 'ADR_NUMBER_CONFLICT',

  /** 输入参数不合法。 */
  INVALID_INPUT: 'INVALID_INPUT',

  /** 内部错误。 */
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

const DEFAULT_ERROR_HINTS: Record<ErrorCode, string> = {
  SCENE_NOT_FOUND: '先调用 scene list 确认 Scene ID，或调用 scene create 创建新的 Scene。',
  SCENE_CORRUPTED: '检查对应 Scene 的 scene.md frontmatter；必要时从备份恢复。',
  SPEC_NOT_FOUND: '先调用 spec list --scene <scene> 确认 Spec ID，再重试。',
  SPEC_CORRUPTED: '检查 Spec 目录下 requirements/design/tasks 文档和 frontmatter 是否完整。',
  AMBIGUOUS_REF: '使用返回的 candidates 中的完整 ID 重新调用。',
  TASK_NOT_FOUND: '先调用 task list --scene <scene> --spec <spec> 确认 Task ID。',
  INVALID_STATUS_TRANSITION: '按状态机更新：pending -> in_progress，in_progress -> completed/failed/blocked。',
  INVALID_URI: '使用 context:// 开头的合法 URI；可先运行 lrnev guide tools 查看格式。',
  FILE_NOT_FOUND: '确认路径存在且位于工作区内，再重新调用。',
  LOCK_HELD_BY_OTHER: '稍后重试；如果确认无进程占用，可运行 doctor 检查陈旧目录锁。',
  HOOK_FAILED: '查看 lrnev_hook_tail_log 或 CLI hook tail-log 的 stderr_tail，修正 hooks.json 或命令后重试。',
  HOOK_TIMEOUT: '查看 lrnev_hook_tail_log 或 CLI hook tail-log；调小 hook 工作量或增大 hooks timeout_ms 配置。',
  HOOK_CONFIG_INVALID: '运行 hook list 或 doctor 查看 issues，并修正 .lrnev/config/hooks.json。',
  AGENT_NOT_REGISTERED: '先调用 agent register 获取 agent_id，再发送 heartbeat 或声明 task claim。',
  ADR_NUMBER_CONFLICT: '使用 adr list 查看已有编号，选择未占用编号后重试。',
  INVALID_INPUT: '检查错误响应中的 field，并按命令或工具参数说明重新传入。',
  INTERNAL_ERROR: '保留错误输出和当前操作上下文，运行 doctor；若可复现请记录到 Errorbook。',
};

export class LrnevError extends Error {
  public readonly code: ErrorCode;
  public readonly field?: string;
  public readonly hint?: string;
  public readonly candidates?: string[];
  public override readonly cause?: unknown;

  constructor(
    code: ErrorCode,
    message: string,
    options?: {
      field?: string;
      hint?: string;
      candidates?: string[];
      cause?: unknown;
    },
  ) {
    super(message);
    this.name = 'LrnevError';
    this.code = code;
    this.field = options?.field;
    this.hint = options?.hint ?? DEFAULT_ERROR_HINTS[code];
    this.candidates = options?.candidates;
    this.cause = options?.cause;

    Object.setPrototypeOf(this, LrnevError.prototype);
  }

  toErrorInfo(): {
    code: string;
    message: string;
    field?: string;
    hint?: string;
    candidates?: string[];
  } {
    return {
      code: this.code,
      message: this.message,
      ...(this.field !== undefined && { field: this.field }),
      ...(this.hint !== undefined && { hint: this.hint }),
      ...(this.candidates !== undefined && { candidates: this.candidates }),
    };
  }
}

export function isLrnevError(err: unknown): err is LrnevError {
  return err instanceof LrnevError;
}
