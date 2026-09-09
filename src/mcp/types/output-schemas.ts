/**
 * 03-00-mcp-response-conformance T-001
 *
 * 严格输出 Schema 定义。
 *
 * 为各类工具定义明确的 outputSchema，禁止使用完全无约束的
 * `Record<string, unknown>` 或 `{}` 伪装成 schema。
 *
 * 每个 schema 必须：
 * 1. 明确定义 data 的结构（必填/可选字段）
 * 2. 包含 response_version、ok、errors 等信封字段
 * 3. 根据工具语义定义 ai_followup、anchor_context、summary_context 的可选性
 */

import * as z from 'zod/v4';

/**
 * 响应信封版本（固定为 '1'）
 */
const ResponseVersionSchema = z.literal('1');

/**
 * 错误信息 schema
 */
const ErrorInfoSchema = z.object({
  code: z.string(),
  message: z.string(),
  field: z.string().optional(),
  hint: z.string().optional(),
  candidates: z.array(z.string()).optional(),
});

/**
 * AI 后续指引 schema
 */
const AiFollowupSchema = z.object({
  instructions: z.array(z.string()),
  suggested_tools: z
    .array(
      z.object({
        name: z.string(),
        args_template: z.record(z.string(), z.unknown()),
        reason: z.string(),
      }),
    )
    .optional(),
});

/**
 * F-04.1 文本截断元数据 schema（ADR-0001）：TextStatus 三态 + 长度。
 */
const TextMetaSchema = z.object({
  text_status: z.enum(['complete', 'truncated_by_budget', 'incomplete_source']),
  /** text_status 非 complete 时提供：截断/残缺前原始长度。 */
  original_length: z.number().int().nonnegative().optional(),
  /** 实际随响应返回的文本长度。 */
  returned_length: z.number().int().nonnegative(),
});

/**
 * 锚点上下文 schema
 */
const AnchorContextSchema = z.object({
  anchor: z.string(),
  source: z.enum(['requirements', 'design']),
  text: z.string(),
  meta: TextMetaSchema,
});

/**
 * 摘要上下文 schema
 */
const SummaryContextSchema = z.object({
  source: z.enum(['sidecar', 'inline']),
  l0: z.string().optional(),
  l1: z.string().optional(),
  meta: TextMetaSchema,
});

/**
 * F-04.2 查询省略三态 schema（对齐 DSH RetainedItems 语义）。
 */
const OmittedSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none') }),
  z.object({ kind: z.literal('exact'), count: z.number().int().nonnegative() }),
  z.object({ kind: z.literal('unknown') }),
]);

/**
 * F-04.2 查询级截断元数据 schema（QueryMeta 四件套）。
 * total_count 不可为 null（lrnev 查询模式先全量收集再截断，总数总是可得）。
 */
export const QueryMetaSchema = z.object({
  returned_count: z.number().int().nonnegative(),
  total_count: z.number().int().nonnegative(),
  truncated: z.boolean(),
  omitted: OmittedSchema,
});

/**
 * 基础响应信封 schema（不含 data）
 */
const BaseEnvelopeSchema = z.object({
  response_version: ResponseVersionSchema,
  ok: z.boolean(),
  errors: z.array(ErrorInfoSchema).optional(),
  ai_followup: AiFollowupSchema.optional(),
  anchor_context: z.array(AnchorContextSchema).optional(),
  summary_context: SummaryContextSchema.optional(),
});

/**
 * 创建完整的工具响应 schema
 *
 * @param dataSchema 业务数据的 zod schema
 * @returns 包含完整信封的响应 schema
 */
export function createToolOutputSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    response_version: ResponseVersionSchema,
    ok: z.boolean(),
    data: dataSchema.optional(),
    errors: z.array(ErrorInfoSchema).optional(),
    ai_followup: AiFollowupSchema.optional(),
    anchor_context: z.array(AnchorContextSchema).optional(),
    summary_context: SummaryContextSchema.optional(),
  });
}

/**
 * 05-00-lrnev-guidance-profile T-006（O6，2026-09-07）：
 * 曾存在的 createGuidanceToolOutputSchema（标准信封 + 顶层可选 guidance 数组）已随
 * 运行时挂载回退一并移除——T-006 裁决：三客户端零消费 + 24.2%/响应纯重复税，schema
 * 不再对 MCP 响应声明 guidance 字段（避免空字段误导）；LrnevGuidanceItem 契约类型与
 * zod（mcp/types/guidance-profile.ts）保留为纯函数库契约面。role 化四工具（assess_goal /
 * scene_create / spec_create / task_create）改回使用 createToolOutputSchema。
 */

/**
 * 纯确认类工具的 data schema（无业务数据或仅返回简单确认）
 */
export const SimpleConfirmationDataSchema = z.object({
  message: z.string().optional(),
});

/**
 * 写入/状态变更类工具的通用字段
 */
export const WriteOperationDataSchema = z.object({
  id: z.string(), // 资源标识
  status: z.string().optional(), // 当前状态
  path: z.string().optional(), // 文件路径
  message: z.string().optional(), // 操作结果描述
});

/**
 * 列表/搜索类工具的通用字段
 */
export const ListOperationDataSchema = z.object({
  items: z.array(z.unknown()), // 条目列表（具体结构由各工具定义）
  total_count: z.number().optional(), // 总数（如果已知）
  has_more: z.boolean().optional(), // 是否有更多数据
  truncated: z.boolean().optional(), // 是否被截断
  truncation_reason: z.string().optional(), // 截断原因
  next_query_hint: z.string().optional(), // 继续查询的提示
});

/**
 * Gate/Validation 类工具的通用字段
 */
export const ValidationDataSchema = z.object({
  passed: z.boolean(), // 验证是否通过
  checks: z.array(
    z.object({
      name: z.string(), // 检查项名称（匹配 GateCheck 接口）
      passed: z.boolean(),
      hard_fail: z.boolean(), // hard_fail=true 且未通过时，整体 gate 不通过
      message: z.string().optional(),
      hint: z.string().optional(),
    }),
  ),
  gate: z.string().optional(), // gate 类型（creation/ready/completion）
  can_proceed: z.boolean().optional(), // 是否可以继续操作
});

/**
 * 选择/歧义类工具的通用字段
 */
export const AmbiguityDataSchema = z.object({
  candidates: z.array(
    z.object({
      id: z.string(),
      display: z.string(),
      context: z.string().optional(),
    }),
  ),
  retry_hint: z.string(),
});

/**
 * 错误响应的 schema（ok=false 时）
 *
 * 注意：errors 必填且至少包含一个错误
 */
export const ErrorResponseSchema = z.object({
  response_version: ResponseVersionSchema,
  ok: z.literal(false),
  errors: z.array(ErrorInfoSchema).min(1),
  data: z.unknown().optional(),
  ai_followup: AiFollowupSchema.optional(),
  anchor_context: z.array(AnchorContextSchema).optional(),
  summary_context: SummaryContextSchema.optional(),
});

/**
 * 成功响应的 schema 工厂（ok=true 时）
 *
 * @param dataSchema 业务数据的 zod schema
 */
export function createSuccessResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    response_version: ResponseVersionSchema,
    ok: z.literal(true),
    data: dataSchema,
    errors: z.never().optional(), // 成功时不应有 errors
    ai_followup: AiFollowupSchema.optional(),
    anchor_context: z.array(AnchorContextSchema).optional(),
    summary_context: SummaryContextSchema.optional(),
  });
}

/**
 * 通用响应 schema（成功或失败）
 *
 * @param dataSchema 业务数据的 zod schema
 */
export function createResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.union([createSuccessResponseSchema(dataSchema), ErrorResponseSchema]);
}

/**
 * Scene data schema
 */
export const SceneDataSchema = z.object({
  id: z.string(),
  name: z.string(),
  number: z.number(),
  status: z.string(), // SceneStatus: 'draft' | 'active' | 'archived'
  created: z.string(),
  updated: z.string().optional(), // Added: matches SceneFrontmatter
  path: z.string(),
  spec_count: z.number(),
  intent: z.string().optional(),
  broken: z.object({
    error: z.string(),
    path: z.string(),
  }).optional(),
});

/**
 * Spec data schema
 */
export const SpecDataSchema = z.object({
  spec: z.string(),
  scene: z.string(),
  status: z.string(),
  priority: z.string().optional(),
  created: z.string(),
  updated: z.string().optional(), // Already present - matches SpecFrontmatter
  path: z.string(),
  number: z.number(),
  version: z.number(),
  name: z.string(),
  documents: z.object({
    requirements: z.boolean(),
    design: z.boolean(),
    tasks: z.boolean(),
  }),
  broken: z.object({
    error: z.string(),
    path: z.string(),
  }).optional(),
});

/**
 * Task data schema
 */
export const TaskDataSchema = z.object({
  id: z.string(),
  spec: z.string(), // Added: matches Task interface
  scene: z.string(), // Added: matches Task interface
  title: z.string(),
  description: z.string().optional(),
  status: z.string(),
  created: z.string(),
  updated: z.string().optional(),
  acceptance: z.array(z.string()).optional(),
  depends_on: z.array(z.string()).optional(),
  validates: z.array(z.string()).optional(),
  parent: z.string().optional(),
  children: z.array(z.unknown()).optional(),
  history: z.array(z.unknown()).optional(),
  claim: z.object({
    agent_id: z.string(),
    claimed_at: z.string(),
    expires_at: z.string(),
    touches_files: z.array(z.string()).optional(),
  }).optional(),
});

/**
 * Readable task schema (人读投影视图，不包含治理 meta/时间戳)
 */
export const ReadableTaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  acceptance: z.array(z.string()),
  parent: z.string().optional(),
  validates: z.array(z.string()),
});

/**
 * Task claim result schema
 */
export const TaskClaimResultSchema = z.object({
  claim: z.object({
    scene: z.string(),
    spec: z.string(),
    task: z.string(),
    claimed_by: z.string(),
    claimed_at: z.string(),
    expires_at: z.string(),
    touches_files: z.array(z.string()).optional(),
  }),
  claimed: z.boolean(),
  conflict: z.object({
    scene: z.string(),
    spec: z.string(),
    task: z.string(),
    claimed_by: z.string(),
    claimed_at: z.string(),
    expires_at: z.string(),
    touches_files: z.array(z.string()).optional(),
  }).optional(),
  overlaps: z.array(z.object({
    scene: z.string(),
    spec: z.string(),
    task: z.string(),
    claimed_by: z.string(),
    touches_files: z.array(z.string()),
  })).optional(),
});

/**
 * Task claim release result schema（对齐 src/types/claim.ts TaskClaimReleaseResult）。
 * task_release 之前错误复用 SimpleConfirmationDataSchema，真实 data 的
 * scene/spec/task/released 四个键全部被判为 additional properties（T-027 修复）。
 */
export const TaskClaimReleaseResultSchema = z.object({
  scene: z.string(),
  spec: z.string(),
  task: z.string(),
  released: z.boolean(),
});

/**
 * 批量创建任务的压缩返回 schema（对齐 src/types/task.ts CreateManyTasksResult）。
 * task_create_many 之前错误注册成 z.array(TaskDataSchema)（数组），真实 data 是
 * { created, count } 对象——形态 B schema 错配（T-027 修复）。
 */
export const CreateManyTasksResultSchema = z.object({
  created: z.array(z.object({
    id: z.string(),
    title: z.string(),
  })),
  count: z.number(),
  // F-04.2：task_create_many 为原子 all-or-nothing（超 max_batch_create 直接报错不截断），
  // 成功时 query_meta 恒为「返回=请求」的核对信息（truncated 恒 false）。
  query_meta: QueryMetaSchema.optional(),
});

/**
 * ADR data schema
 *
 * 与 src/types/adr.ts 的 ADR 接口对齐（T-027 修复）：ADRManager.readOne 的返回
 * 形态是顶层 number/title/status/scope/created/date/(supersedes)/(superseded_by)/path
 * + 嵌套 body（context/decision/alternatives/consequences）——旧的平面字段版
 * （顶层 context/decision/...）从不匹配真实返回，导致 body 等键被判为
 * additional properties（严格客户端 -32602）。
 */
export const ADRDataSchema = z.object({
  number: z.string(),
  title: z.string(),
  status: z.string(),
  scope: z.string(),
  created: z.string(), // matches ADRFrontmatter
  date: z.string(),
  supersedes: z.array(z.string()).optional(), // matches ADRFrontmatter
  superseded_by: z.array(z.string()).optional(), // matches ADR interface (derived field)
  path: z.string(),
  body: z.object({
    context: z.string(),
    decision: z.string(),
    alternatives: z.array(z.string()).optional(),
    consequences: z.string().optional(),
  }),
});

/**
 * Agent data schema (basic AgentInfo)
 */
export const AgentDataSchema = z.object({
  agent_id: z.string(),
  pid: z.number(),
  host: z.string(),
  client: z.string().optional(),
  started_at: z.string(),
  last_heartbeat: z.string(),
  status: z.string(),
});

/**
 * Agent register result schema (AgentInfo + optional GC summary)
 */
export const AgentRegisterResultSchema = AgentDataSchema.extend({
  gc: z.object({
    removed_agents: z.number(),
    removed_claims: z.number(),
  }).optional(),
});

/**
 * Agent heartbeat result schema (AgentInfo + refreshed claims)
 */
export const AgentHeartbeatResultSchema = AgentDataSchema.extend({
  refreshed_claims: z.number().optional(),
});

/**
 * Agent list result schema
 */
export const AgentListResultSchema = z.object({
  agents: z.array(AgentDataSchema),
  registry_path: z.string(),
  issues: z.array(z.object({
    type: z.string(),
    message: z.string(),
    agent_id: z.string().optional(),
  })),
});

/**
 * Agent unregister result schema（对齐 AgentRegistry.unregister 的 { agent_id }）。
 * 之前错误复用 SimpleConfirmationDataSchema，真实 data.agent_id 被判为
 * additional properties（T-027 修复）。
 */
export const AgentUnregisterResultSchema = z.object({
  agent_id: z.string(),
});

/**
 * lrnev_init 返回 schema（对齐 src/types/workspace.ts InitWorkspaceResult）。
 * 之前错误复用 SimpleConfirmationDataSchema，真实 data 的多个键全部被判为
 * additional properties（T-027 修复）。
 */
export const InitWorkspaceResultSchema = z.object({
  root: z.string(),
  was_new: z.boolean(),
  files_created: z.array(z.string()),
  files_existing: z.array(z.string()),
  directories_ensured: z.array(z.string()),
  codebase_detected: z.boolean(),
  agents_md: z.enum(['created', 'skipped-existing']).optional(),
});

/**
 * Memory data schema
 */
export const MemoryDataSchema = z.object({
  id: z.string(),
  category: z.string(),
  content: z.string(),
  source: z.string(),
  scope: z.string(),
  created: z.string(),
  last_referenced: z.string().optional(), // Added: matches MemoryFrontmatter
  reference_count: z.number().optional(), // Added: matches MemoryFrontmatter
  tentative: z.boolean().optional(),
  path: z.string(), // Added: matches Memory interface
});

/**
 * memory_forget 返回 schema（对齐 MemoryManager.forget 的 { id, deleted }）。
 * 之前错误复用 SimpleConfirmationDataSchema，真实 data 的 id/deleted 被判为
 * additional properties（T-027 修复）。
 */
export const MemoryForgetResultSchema = z.object({
  id: z.string(),
  deleted: z.boolean(),
});

/**
 * Error entry data schema
 */
export const ErrorEntryDataSchema = z.object({
  id: z.string(),
  fingerprint: z.string(),
  status: z.string(),
  scope: z.string(),
  occurrence_count: z.number(),
  first_seen: z.string(),
  last_seen: z.string(),
  promoted_at: z.string().optional(),
  tags: z.array(z.string()).optional(),
  path: z.string(),
  body: z.object({
    symptom: z.string(),
    root_cause: z.string(),
    fix_action: z.string(),
    verification: z.string().optional(),
    references: z.array(z.string()).optional(),
  }),
});

/**
 * Hook data schema
 */
export const HookDataSchema = z.object({
  name: z.string(),
  event: z.string(),
  command: z.string(),
  enabled: z.boolean(),
  last_run: z.object({
    at: z.string(),
    status: z.string(),
    duration_ms: z.number().optional(),
  }).optional(),
});

/**
 * Hook 配置项 schema（对齐 src/types/hooks.ts HookConfig）。
 * lrnev_hook_enable / lrnev_hook_disable 之前错误复用 SimpleConfirmationDataSchema，
 * 真实 data 是完整 HookConfig（HookManager.setEnabled），多个键被判为
 * additional properties（T-027 修复）。
 */
export const HookConfigDataSchema = z.object({
  name: z.string(),
  event: z.string(),
  command: z.union([z.string(), z.array(z.string())]),
  timeout_ms: z.number(),
  mode: z.enum(['sync', 'async']),
  enabled: z.boolean(),
  env: z.record(z.string(), z.string()),
  cwd: z.string().optional(),
  on_failure: z.enum(['abort', 'warn', 'silent']),
});

/**
 * Hook list result schema
 * recent 条目与 HookLogEntrySchema 同步（ADR-0003：invoked/timed_out 状态、
 * exit_code optional），避免字段漂移。
 */
export const HookListResultSchema = z.object({
  implemented: z.literal(true),
  hooks: z.array(HookConfigDataSchema),
  recent: z.array(z.object({
    ts: z.string(),
    event: z.string(),
    hook: z.string(),
    mode: z.enum(['sync', 'async']),
    status: z.enum(['success', 'failed', 'timeout', 'invoked', 'timed_out']),
    duration_ms: z.number(),
    exit_code: z.number().optional(),
    stdout_tail: z.string().optional(),
    stderr_tail: z.string().optional(),
  })),
  config_path: z.string(),
  issues: z.array(z.object({
    index: z.number().optional(),
    name: z.string().optional(),
    code: z.literal('HOOK_CONFIG_INVALID'),
    message: z.string(),
    path: z.string(),
  })),
});

/**
 * Goal assessment data schema
 */
export const GoalAssessmentDataSchema = z.object({
  kind: z.enum(['single-spec', 'multi-spec-program', 'research-program']),
  confidence: z.enum(['low', 'medium', 'high']),
  score: z.number(),
  reasons: z.array(z.string()),
  suggested_next_step: z.string(),
});

/**
 * Context search result schema
 */
export const ContextSearchResultSchema = z.object({
  query: z.string(),
  scope: z.string(),
  max_depth: z.number(),
  results: z.array(z.object({
    uri: z.string(),
    path: z.string(),
    matched_level: z.string(),
    score: z.number(),
    snippet: z.string(),
    anchor: z.string().optional(),
  })),
  // F-04.2：先全量召回排序、再按 top_k 截断的查询级元数据（total_count 不可为 null）。
  query_meta: QueryMetaSchema.optional(),
});

/**
 * Project status data schema
 */
export const ProjectStatusDataSchema = z.object({
  generated_at: z.string(),
  scenes: z.array(z.object({
    id: z.string(),
    name: z.string(),
    status: z.string(),
    spec_count: z.number(),
  })),
  specs: z.array(z.object({
    scene: z.string(),
    spec: z.string(),
    name: z.string(),
    number: z.number(),
    version: z.number(),
    status: z.string(),
    priority: z.string().optional(),
    created: z.string().optional(),
    active_task_count: z.number(),
    task_counts: z.record(z.string(), z.number()),
    free_tasks_count: z.number(),
    claimable_next: z.array(z.object({
      id: z.string(),
      title: z.string(),
      depends_on: z.array(z.string()).optional(),
    })),
    // F-04.2：claimable_next 截断元数据（total_count=free_tasks_count，总是可得）。
    claimable_meta: QueryMetaSchema.optional(),
  })),
  active_agents: z.array(z.object({
    agent_id: z.string(),
    status: z.string(),
    active_claims: z.array(z.object({
      scene: z.string(),
      spec: z.string(),
      task: z.string(),
      touches_files: z.array(z.string()).optional(),
    })),
    client: z.string().optional(),
    last_heartbeat: z.string(),
    current_task_hint: z.string().optional(),
  })),
  active_tasks: z.array(z.object({
    scene: z.string(),
    spec: z.string(),
    id: z.string(),
    title: z.string(),
    status: z.string(),
    parent: z.string().optional(),
    children: z.array(z.any()).optional(),
    created: z.string(),
    updated: z.string().optional(),
  })),
  recent_adrs: z.array(z.object({
    scope: z.string(),
    number: z.string(),
    title: z.string(),
    status: z.string().optional(),
    created: z.string().optional(),
    path: z.string(),
  })),
  open_errors: z.array(z.object({
    scope: z.string(),
    id: z.string(),
    status: z.string().optional(),
    last_seen: z.string().optional(),
    path: z.string(),
  })),
});

/**
 * Governance map data schema
 */
export const GovernanceMapDataSchema = z.object({
  generated_at: z.string(),
  scenes: z.array(z.object({
    scene: z.string(),
    name: z.string(),
    status: z.string(),
    intent: z.string().optional(),
    specs: z.array(z.object({
      spec: z.string(),
      name: z.string(),
      status: z.string(),
      priority: z.string().optional(),
      l0: z.string().optional(),
      anchors: z.array(z.string()),
    })),
  })),
});

/**
 * Governance report data schema
 */
export const GovernanceReportDataSchema = z.object({
  generated_at: z.string(),
  scope: z.string(),
  headline: z.string(),
  chain: z.object({
    scene_count: z.number(),
    spec_count: z.number(),
    task_count: z.number(),
    scenes: z.array(z.object({
      scene: z.string(),
      name: z.string(),
      spec_count: z.number(),
      task_count: z.number(),
      empty: z.boolean(),
    })),
    unclosed: z.array(z.object({
      scene: z.string(),
      spec: z.string(),
      name: z.string(),
      done: z.number(),
      total: z.number(),
      status: z.string(),
      next_action: z.string().optional(),
      paths: z.object({
        uri: z.string(),
        requirements_path: z.string(),
        tasks_path: z.string(),
      }).optional(),
    })),
    failed_tasks: z.array(z.object({
      scene: z.string(),
      spec: z.string(),
      id: z.string(),
      title: z.string(),
      status: z.string(),
      next_action: z.string().optional(),
      paths: z.object({
        uri: z.string(),
        requirements_path: z.string(),
        tasks_path: z.string(),
      }).optional(),
    })),
    blocked_tasks: z.array(z.object({
      scene: z.string(),
      spec: z.string(),
      id: z.string(),
      title: z.string(),
      status: z.string(),
      next_action: z.string().optional(),
      paths: z.object({
        uri: z.string(),
        requirements_path: z.string(),
        tasks_path: z.string(),
      }).optional(),
    })),
  }),
  coverage: z.object({
    anchor_total: z.number(),
    anchor_covered: z.number(),
    coverage_ratio: z.number(),
    in_flight_orphans: z.array(z.object({
      scene: z.string(),
      spec: z.string(),
      status: z.string(),
      anchors: z.array(z.string()),
      paths: z.object({
        uri: z.string(),
        requirements_path: z.string(),
        tasks_path: z.string(),
      }),
      next_action: z.string().optional(),
    })),
    debt_orphans: z.array(z.object({
      scene: z.string(),
      spec: z.string(),
      status: z.string(),
      anchors: z.array(z.string()),
      paths: z.object({
        uri: z.string(),
        requirements_path: z.string(),
        tasks_path: z.string(),
      }),
      next_action: z.string().optional(),
    })),
    broken_validates: z.array(z.object({
      scene: z.string(),
      spec: z.string(),
      task: z.string(),
      anchors: z.array(z.string()),
      paths: z.object({
        uri: z.string(),
        requirements_path: z.string(),
        tasks_path: z.string(),
      }),
      next_action: z.string(),
    })),
    archived_excluded: z.number(),
  }),
  release_notes: z.object({
    scenes: z.array(z.object({
      scene: z.string(),
      name: z.string(),
      specs: z.array(z.object({
        spec: z.string(),
        name: z.string(),
        tasks: z.array(z.string()),
      })),
    })),
  }).optional(),
  warnings: z.array(z.string()).optional(),
});

/**
 * Guide data schema
 */
export const GuideDataSchema = z.object({
  topic: z.string(),
  content: z.string(),
});

/**
 * Doctor result schema (union of all possible return types)
 */
export const DoctorResultSchema = z.union([
  // DiagnosticReport
  z.object({
    ok: z.boolean(),
    checked_at: z.string(),
    summary: z.object({
      errors: z.number(),
      warnings: z.number(),
      info: z.number(),
    }),
    issues: z.array(z.object({
      code: z.string(),
      severity: z.enum(['error', 'warning', 'info']),
      message: z.string(),
      path: z.string().optional(),
      suggestion: z.string().optional(),
    })),
  }),
  // TodoMigrationReport
  z.object({
    ok: z.literal(true),
    migrated_at: z.string(),
    scanned_files: z.number(),
    changed_files: z.number(),
    replacements: z.number(),
    files: z.array(z.object({
      path: z.string(),
      replacements: z.array(z.unknown()),
    })),
  }),
  // SummaryMigrationReport
  z.object({
    ok: z.literal(true),
    migrated_at: z.string(),
    removed_count: z.number(),
    removed: z.array(z.string()),
  }),
  // AgentGcReport
  z.object({
    ok: z.literal(true),
    gc_at: z.string(),
    removed: z.array(z.string()),
    released_expired_claims: z.number(),
    kept_active: z.number(),
    kept_dead_with_claims: z.number(),
  }),
]);

/**
 * Session commit result schema
 */
export const SessionCommitResultSchema = z.object({
  saved: z.array(MemoryDataSchema),
  skipped: z.array(z.object({
    candidate: z.object({
      category: z.string(),
      content: z.string(),
      source: z.string(),
    }),
    reason: z.enum(['duplicate', 'invalid', 'rejected']),
    similar_to: z.string().optional(),
  })),
});

/**
 * Summarize save result schema
 */
export const SummarizeSaveResultSchema = z.object({
  uri: z.string(),
  saved: z.array(z.object({
    level: z.enum(['L0', 'L1']),
    path: z.string(),
  })),
  skipped: z.array(z.object({
    level: z.enum(['L0', 'L1']),
    reason: z.string(),
  })),
});

/**
 * Hook trigger result schema
 */
export const HookTriggerResultSchema = z.object({
  event: z.string(),
  matched: z.number(),
  warnings: z.array(z.string()),
});

/**
 * Hook log entry schema (对照 src/types/hooks.ts HookRecord)
 * ADR-0003：status 新增 invoked / timed_out，exit_code 改为 optional
 * （invoked / timed_out 记录无子进程退出码）。
 */
export const HookLogEntrySchema = z.object({
  ts: z.string(),
  event: z.string(),
  hook: z.string(),
  mode: z.enum(['sync', 'async']),
  status: z.enum(['success', 'failed', 'timeout', 'invoked', 'timed_out']),
  duration_ms: z.number(),
  exit_code: z.number().optional(),
  stdout_tail: z.string().optional(),
  stderr_tail: z.string().optional(),
});

// 导出常用的完整响应 schema
export const SimpleConfirmationResponseSchema = createResponseSchema(SimpleConfirmationDataSchema);
export const WriteOperationResponseSchema = createResponseSchema(WriteOperationDataSchema);
export const ListOperationResponseSchema = createResponseSchema(ListOperationDataSchema);
export const ValidationResponseSchema = createResponseSchema(ValidationDataSchema);
export const AmbiguityResponseSchema = createResponseSchema(AmbiguityDataSchema);

// 导出资源特定的响应 schema
export const SceneResponseSchema = createResponseSchema(SceneDataSchema);
export const SpecResponseSchema = createResponseSchema(SpecDataSchema);
export const TaskResponseSchema = createResponseSchema(TaskDataSchema);
export const ADRResponseSchema = createResponseSchema(ADRDataSchema);
export const AgentResponseSchema = createResponseSchema(AgentDataSchema);
export const MemoryResponseSchema = createResponseSchema(MemoryDataSchema);
export const ErrorEntryResponseSchema = createResponseSchema(ErrorEntryDataSchema);
export const HookResponseSchema = createResponseSchema(HookDataSchema);
export const GoalAssessmentResponseSchema = createResponseSchema(GoalAssessmentDataSchema);
export const ProjectStatusResponseSchema = createResponseSchema(ProjectStatusDataSchema);
export const GovernanceMapResponseSchema = createResponseSchema(GovernanceMapDataSchema);
export const GovernanceReportResponseSchema = createResponseSchema(GovernanceReportDataSchema);
export const GuideResponseSchema = createResponseSchema(GuideDataSchema);
export const DoctorResponseSchema = createResponseSchema(DoctorResultSchema);
