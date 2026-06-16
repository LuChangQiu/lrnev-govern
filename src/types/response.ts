/**
 * ai_followup 协议响应类型
 *
 * 这是 lrnev 区别于其他 MCP 服务的关键设计：
 * 所有写入类工具不强依赖 MCP sampling 协议，而是在响应里附带
 * 一段"待办指令 + 工具建议"，由客户端 AI（Claude/Cursor 等）
 * 自然推进后续动作。
 *
 * 详见 design.md 第 5 节。
 */

/**
 * 标准 MCP 工具响应包装。
 *
 * @template T 业务数据类型
 */
export interface AiFollowupResponse<T = unknown> {
  /** 业务成功标记（非传输层成功） */
  ok: boolean;

  /** 业务数据 */
  data: T;

  /** 给客户端 AI 的后续指引（可选） */
  ai_followup?: AiFollowup;

  /**
   * F-03 任务启动上下文：task_update(in_progress) / task_claim 时按 task 的 validates 回填的
   * 锚点段落，作为结构化字段随返回送达 AI（顶层、与 data 同级——ai_followup 无 data 字段）。
   * 无 validates / 无可解析段落时不出现（不回空数组误导）。
   */
  anchor_context?: AnchorContext[];

  /** 错误列表（ok=false 时必填） */
  errors?: ErrorInfo[];

  /** 警告列表（非致命） */
  warnings?: string[];
}

/** F-03 回填的单个锚点段落 */
export interface AnchorContext {
  /** 锚点 ID，如 F-01 / D-02 */
  anchor: string;

  /** 段落来源文档 */
  source: 'requirements' | 'design';

  /** 段落正文（已按截断策略处理） */
  text: string;

  /** 是否被截断 */
  truncated: boolean;
}

/** AI 后续动作指引 */
export interface AiFollowup {
  /** 自然语言待办指令（按顺序执行） */
  instructions: string[];

  /** 建议调用的下一个工具列表 */
  suggested_tools?: ToolHint[];
}

/** 工具调用提示 */
export interface ToolHint {
  /** 工具名 */
  name: string;

  /** 参数模板（含必填项与示例值） */
  args_template: Record<string, unknown>;

  /** 为什么建议调用这个工具 */
  reason: string;
}

/** 错误信息 */
export interface ErrorInfo {
  /** 错误码（详见 shared/errors.ts） */
  code: string;

  /** 人类可读消息 */
  message: string;

  /** 出错的字段或路径（可选） */
  field?: string;

  /** 修复建议（可选） */
  hint?: string;

  /** 可供用户选择的候选项（歧义引用时使用） */
  candidates?: string[];
}

/** 范围标识 - 全局或 Scene 局部 */
export type Scope = 'global' | `scene:${string}`;

/** 资源加载层级 */
export type Level = 'L0' | 'L1' | 'L2';
