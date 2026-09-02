/**
 * Guidance Surface 数据模型
 *
 * 定义所有会影响客户端 AI 判断或 MCP 数据交付的 Guidance Surface 的数据契约。
 *
 * Spec: 02-00-guidance-surface-inventory
 * Design: D-01 清单字段
 */

/**
 * MCP 通道类型
 */
export type SurfaceChannel =
  | 'server_instructions'      // MCP server instructions
  | 'tool_metadata'             // Tool title/description
  | 'tool_input_schema'         // Tool input schema (Zod .describe())
  | 'tool_output_schema'        // Tool output schema
  | 'tool_result_content'       // Tool result content
  | 'tool_result_structured'    // Tool result structuredContent
  | 'tool_annotations'          // Tool annotations/execution metadata
  | 'mcp_resource'              // MCP resources
  | 'ai_followup'               // ai_followup/suggested_tools
  | 'error_message'             // Error responses
  | 'governance_doc'            // Scene/Spec guidance, AI-ADAPTATION.md
  | 'client_rule';              // Client-side rules

/**
 * 语义角色（来自 01-00 Semantic Authority Model v0.1）
 */
export type SemanticRole =
  | 'FACT'                      // 客观事实
  | 'RECOMMENDATION'            // 建议
  | 'DECISION_BOUNDARY'         // 决策边界
  | 'EXECUTION_CONSTRAINT'      // 执行约束
  | 'ACTION_HINT';              // 行动提示

/**
 * 来源（Provenance）
 */
export type Provenance =
  | 'workspace'                 // 工作区定义
  | 'lrnev'                     // lrnev 核心逻辑
  | 'client_asserted'           // 客户端声明
  | 'user_quote'                // 用户引用
  | 'unknown';                  // 未知

/**
 * 执行强度（Enforcement）
 */
export type Enforcement =
  | 'none'                      // 无强制
  | 'client_boundary'           // 客户端边界
  | 'server_enforced';          // 服务端强制

/**
 * 消费者类型
 */
export type Consumer =
  | 'client'                    // MCP 客户端
  | 'model'                     // LLM 模型
  | 'both'                      // 两者都有
  | 'human';                    // 人工阅读

/**
 * Guidance Surface 源码位置
 */
export interface SurfaceSource {
  file: string;                 // 文件路径（相对于项目根）
  symbol?: string;              // 函数/类/常量名
  field?: string;               // Schema 字段名
  line?: number;                // 行号
  section?: string;             // Markdown 章节（用于文档）
}

/**
 * 预算信息
 */
export interface SurfaceBudget {
  chars: number;                // 字符数
  tokens_estimate: number;      // Token 估算（chars / 4）
}

/**
 * Guidance Surface 完整数据模型
 */
export interface GuidanceSurface {
  // === 必填字段 ===

  /**
   * 稳定标识，格式：channel:category:name
   * 例如：tool_metadata:scene:scene_create
   */
  surface_id: string;

  /**
   * 源码/文档位置
   */
  source: SurfaceSource;

  /**
   * MCP 通道
   */
  channel: SurfaceChannel;

  /**
   * 触发条件（何时进入客户端上下文）
   */
  trigger: string;

  /**
   * 消费者
   */
  consumer: Consumer;

  /**
   * 原始内容
   */
  content: string;

  /**
   * 内容 hash（SHA256，用于变更检测）
   */
  content_hash: string;

  // === 可选字段 ===

  /**
   * 语义角色（01-00 五种角色）
   */
  role?: SemanticRole;

  /**
   * 来源
   */
  provenance?: Provenance;

  /**
   * 执行强度
   */
  enforcement?: Enforcement;

  /**
   * 维护人/模块
   */
  owner?: string;

  /**
   * 测试覆盖
   */
  tests?: string[];

  /**
   * 预算
   */
  budget?: SurfaceBudget;

  /**
   * 静态 capability 备注
   *
   * 注意：
   * - 只记录协议声明、客户端文档声明和静态可见性备注
   * - 不包含运行时消费结论（那是 04-00 的职责）
   * - 缺失时必须显式写 null，不能用推测值填充
   */
  capability_note?: string | null;
}

/**
 * Surface 清单（扫描结果）
 */
export interface SurfaceInventory {
  /**
   * 基线日期
   */
  baseline_date: string;

  /**
   * Spec 标识
   */
  spec: string;

  /**
   * 状态
   */
  status: 'draft' | 'frozen';

  /**
   * 所有 surfaces
   */
  surfaces: GuidanceSurface[];

  /**
   * 统计信息
   */
  statistics: {
    total_surfaces: number;
    by_channel: Record<SurfaceChannel, number>;
    by_role: Partial<Record<SemanticRole, number>>;
    by_consumer: Record<Consumer, number>;
    total_budget: {
      chars: number;
      tokens_estimate: number;
    };
  };
}

/**
 * 扫描错误
 */
export interface ScanError {
  surface_id?: string;
  source: SurfaceSource;
  field: string;
  message: string;
}

/**
 * 扫描结果
 */
export interface ScanResult {
  ok: boolean;
  inventory?: SurfaceInventory;
  errors?: ScanError[];
}
