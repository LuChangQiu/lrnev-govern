/**
 * MCP 工具注册中心。
 *
 * 当前阶段只注册 P0 核心 CRUD：workspace / scene / spec / task。
 * 后续 ADR、Errorbook、Memory、Gate 等工具在对应阶段继续追加。
 */

import * as z from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { FileStorage } from '../../storage/FileStorage.js';
import { resolveWorkspaceRoot } from '../../storage/WorkspaceLocator.js';
import { SceneManager } from '../../core/SceneManager.js';
import { SpecManager } from '../../core/SpecManager.js';
import { TaskManager } from '../../core/TaskManager.js';
import { getSpecWithGuidance } from '../../core/SpecGuidance.js';
import { WorkspaceManager } from '../../core/WorkspaceManager.js';
import { GateRunner } from '../../core/GateRunner.js';
import { ADRManager } from '../../core/ADRManager.js';
import { GoalAssessor } from '../../core/GoalAssessor.js';
import { Summarizer } from '../../core/Summarizer.js';
import { Searcher } from '../../core/Searcher.js';
import { ErrorbookManager } from '../../core/ErrorbookManager.js';
import { MemoryManager } from '../../core/MemoryManager.js';
import { SessionCommit } from '../../core/SessionCommit.js';
import { Doctor } from '../../core/Doctor.js';
import { HookManager } from '../../core/HookManager.js';
import { ProjectStatus } from '../../core/ProjectStatus.js';
import { GovernanceMap } from '../../core/GovernanceMap.js';
import { GovernanceReport } from '../../core/GovernanceReport.js';
import { buildGateFollowup } from '../../core/GateGuidance.js';
import { AgentRegistry } from '../../core/AgentRegistry.js';
import { MemoryCategory } from '../../types/memory.js';
import { ErrorCode, LrnevError, isLrnevError } from '../../shared/errors.js';
import type { AiFollowupResponse, Scope } from '../../types/response.js';
import { GUIDE_TOPIC_VALUES, TOOL_DESCRIPTIONS, buildGuide } from '../guidance.js';
import { toMcpToolResult, toMcpToolResultFromData } from '../helpers/tool-result-adapter.js';
import {
  createToolOutputSchema,
  SimpleConfirmationDataSchema,
  AgentDataSchema,
  AgentRegisterResultSchema,
  AgentHeartbeatResultSchema,
  AgentListResultSchema,
  SceneDataSchema,
  SpecDataSchema,
  TaskDataSchema,
  ReadableTaskSchema,
  TaskClaimResultSchema,
  ADRDataSchema,
  MemoryDataSchema,
  ErrorEntryDataSchema,
  HookDataSchema,
  HookListResultSchema,
  GoalAssessmentDataSchema,
  ContextSearchResultSchema,
  ProjectStatusDataSchema,
  GovernanceMapDataSchema,
  GovernanceReportDataSchema,
  GuideDataSchema,
  DoctorResultSchema,
  SessionCommitResultSchema,
  SummarizeSaveResultSchema,
  HookTriggerResultSchema,
  HookLogEntrySchema,
  ValidationDataSchema,
} from '../types/output-schemas.js';

type ToolResult = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

export function registerTools(server: McpServer): void {
  registerWorkspaceTools(server);
  registerGuideTools(server);
  registerProjectStatusTools(server);
  registerGovernanceMapTools(server);
  registerReportTools(server);
  registerSceneTools(server);
  registerSpecTools(server);
  registerTaskTools(server);
  registerGateTools(server);
  registerADRTools(server);
  registerGoalTools(server);
  registerSummaryTools(server);
  registerSearchTools(server);
  registerErrorTools(server);
  registerMemoryTools(server);
  registerAgentTools(server);
  registerDoctorTools(server);
  registerHookTools(server);
}

function registerGuideTools(server: McpServer): void {
  server.registerTool(
    'lrnev_guide',
    {
      title: 'lrnev 使用手册',
      description: TOOL_DESCRIPTIONS.lrnev_guide,
      inputSchema: {
        topic: z.enum(GUIDE_TOPIC_VALUES).optional().describe('可选：workflow/tools/errors/concepts；省略返回完整手册'),
      },
      outputSchema: createToolOutputSchema(GuideDataSchema),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ topic }) => toMcpToolResult(Promise.resolve(buildGuide(topic)), 'lrnev_guide'),
  );
}

function registerWorkspaceTools(server: McpServer): void {
  server.registerTool(
    'lrnev_init',
    {
      title: 'Init lrnev workspace',
      description: TOOL_DESCRIPTIONS.lrnev_init,
      inputSchema: {
        root: z.string().optional().describe('可选：显式指定项目根目录；默认按 LRNEV_WORKSPACE 或当前目录定位'),
        project_name: z.string().optional().describe('可选：项目名；默认使用目录名'),
        scan: z.boolean().optional().describe('占位 flag，M2 不做主动扫描；行为同默认 init'),
      },
      outputSchema: createToolOutputSchema(SimpleConfirmationDataSchema),
      annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args) => toMcpToolResult(new WorkspaceManager().init(args), 'lrnev_init'),
  );
}

function registerProjectStatusTools(server: McpServer): void {
  server.registerTool(
    'project_status',
    {
      title: 'Project Status',
      description: TOOL_DESCRIPTIONS.project_status,
      inputSchema: {
        scene: z.string().optional().describe('可选：只返回指定 Scene 的状态，缩小接手快照'),
      },
      outputSchema: createToolOutputSchema(ProjectStatusDataSchema),
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async ({ scene }) => toMcpToolResult(getManagers().projectStatus.get({ scene }).then(withProjectStatusFollowup), 'project_status'),
  );
}

function registerGovernanceMapTools(server: McpServer): void {
  server.registerTool(
    'governance_map',
    {
      title: 'Governance Map',
      description: TOOL_DESCRIPTIONS.governance_map,
      inputSchema: {},
      outputSchema: createToolOutputSchema(GovernanceMapDataSchema),
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async () => toMcpToolResult(getManagers().governanceMap.build(), 'governance_map'),
  );
}

function registerReportTools(server: McpServer): void {
  server.registerTool(
    'lrnev_report',
    {
      title: 'Governance Report',
      description: TOOL_DESCRIPTIONS.lrnev_report,
      inputSchema: {
        scene: z.string().optional().describe('只体检指定 scene；不给则全量'),
        release_notes: z.boolean().optional().describe('附已完成工作的 release notes 草稿'),
      },
      outputSchema: createToolOutputSchema(GovernanceReportDataSchema),
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async ({ scene, release_notes }) =>
      toMcpToolResult(getManagers().governanceReport.build({ scene, releaseNotes: release_notes }), 'lrnev_report'),
  );
}

function registerSceneTools(server: McpServer): void {
  server.registerTool(
    'scene_create',
    {
      title: 'Create Scene',
      description: TOOL_DESCRIPTIONS.scene_create,
      inputSchema: {
        name: z.string().describe('kebab-case 名称，例如 user-management'),
        number: z.number().int().positive().optional().describe('可选：手动指定 Scene 序号'),
        intent: z.string().optional().describe('可选：业务意图一句话说明'),
      },
      outputSchema: createToolOutputSchema(SceneDataSchema),
      annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (args) => toMcpToolResult(getManagers().scenes.create(args), 'scene_create'),
  );

  server.registerTool(
    'scene_list',
    {
      title: 'List Scenes',
      description: TOOL_DESCRIPTIONS.scene_list,
      inputSchema: {},
      outputSchema: createToolOutputSchema(z.array(SceneDataSchema)),
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async () => toMcpToolResult(getManagers().scenes.list().then(withBrokenFollowup('Scene')), 'scene_list', true),
  );

  server.registerTool(
    'scene_get',
    {
      title: 'Get Scene',
      description: TOOL_DESCRIPTIONS.scene_get,
      inputSchema: {
        scene: z.string().describe('Scene 标识：完整 id、序号或纯名称'),
      },
      outputSchema: createToolOutputSchema(SceneDataSchema),
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async ({ scene }) => toMcpToolResultFromData(getManagers().scenes.get(scene), 'scene_get'),
  );
}

function registerSpecTools(server: McpServer): void {
  server.registerTool(
    'spec_create',
    {
      title: 'Create Spec',
      description: TOOL_DESCRIPTIONS.spec_create,
      inputSchema: {
        scene: z.string().optional().describe('Scene 标识：完整 id、序号或纯名称；缺省时使用 00-default'),
        name: z.string().describe('kebab-case Spec 名称，例如 user-login'),
        version: z.number().int().min(0).max(99).optional().describe('可选：默认 0。小修小改直接编辑现有 requirements/design/tasks，不传 version；仅整体重写并想保留旧版对照时传 1/2/...'),
        priority: z.enum(['P0', 'P1', 'P2', 'P3']).optional().describe('可选：优先级'),
      },
      outputSchema: createToolOutputSchema(SpecDataSchema),
      annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (args) => toMcpToolResult(getManagers().specs.create(args), 'spec_create'),
  );

  server.registerTool(
    'spec_list',
    {
      title: 'List Specs',
      description: TOOL_DESCRIPTIONS.spec_list,
      inputSchema: {
        scene: z.string().describe('Scene 标识：完整 id、序号或纯名称'),
      },
      outputSchema: createToolOutputSchema(z.array(SpecDataSchema)),
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async ({ scene }) => toMcpToolResult(getManagers().specs.list(scene).then(withBrokenFollowup('Spec')), 'spec_list', true),
  );

  server.registerTool(
    'spec_get',
    {
      title: 'Get Spec',
      description: TOOL_DESCRIPTIONS.spec_get,
      inputSchema: {
        scene: z.string().describe('Scene 标识：完整 id、序号或纯名称'),
        spec: z.string().describe('Spec 标识：完整 id、序号前缀或纯名称'),
      },
      outputSchema: createToolOutputSchema(SpecDataSchema),
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async ({ scene, spec }) => {
      const fs = new FileStorage(resolveWorkspaceRoot().root);
      // getSpecWithGuidance 返回 Spec | AiFollowupResponse<Spec>（CLI 与 MCP 共用）；
      // MCP 侧统一包装为 AiFollowupResponse 再交给 toMcpToolResult。
      // 异常需在 toMcpToolResult 的 promise 链内抛出，以便被其 try/catch 捕获（如 AMBIGUOUS_REF）。
      const response = getSpecWithGuidance(fs, getManagers().specs, scene, spec).then(
        (result) => ('ok' in result ? result : { ok: true as const, data: result }),
      );
      return toMcpToolResult(response, 'spec_get');
    },
  );

  server.registerTool(
    'spec_update',
    {
      title: 'Update Spec Status',
      description: TOOL_DESCRIPTIONS.spec_update,
      inputSchema: {
        scene: z.string().describe('Scene 标识：完整 id、序号或纯名称'),
        spec: z.string().describe('Spec 标识：完整 id、序号前缀或纯名称'),
        status: z.enum(['draft', 'ready', 'in-progress', 'completed', 'archived']).describe('目标状态'),
        reason: z.string().optional().describe('可选：变更原因'),
      },
      outputSchema: createToolOutputSchema(SpecDataSchema),
      annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ scene, spec, status, reason }) => toMcpToolResult(getManagers().specs.updateStatus(scene, spec, status, reason), 'spec_update'),
  );
}

function registerGateTools(server: McpServer): void {
  server.registerTool(
    'spec_gate_check',
    {
      title: 'Check Spec Gate',
      description: TOOL_DESCRIPTIONS.spec_gate_check,
      inputSchema: {
        scene: z.string().describe('Scene 标识：完整 id、序号或纯名称'),
        spec: z.string().describe('Spec 标识：完整 id、序号前缀或纯名称'),
        gate: z.enum(['creation', 'ready', 'completion']).describe('Gate 类型'),
      },
      outputSchema: createToolOutputSchema(ValidationDataSchema),
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async ({ scene, spec, gate }) => {
      const managers = getManagers();
      return toMcpToolResult(
        managers.gates.check(gate, { scene, spec }).then((result) => ({
          ok: true,
          data: result,
          ai_followup: buildGateFollowup(result, gate, scene, spec),
        })),
        'spec_gate_check',
      );
    },
  );
}

function registerTaskTools(server: McpServer): void {
  server.registerTool(
    'task_create',
    {
      title: 'Create Task',
      description: TOOL_DESCRIPTIONS.task_create,
      inputSchema: {
        scene: z.string().describe('Scene 标识'),
        spec: z.string().describe('Spec 标识'),
        title: z.string().describe('任务标题'),
        description: z.string().optional().describe('可选：任务描述'),
        acceptance: z.array(z.string()).optional().describe('可选：验收标准列表'),
        depends_on: z.array(z.string()).optional().describe('可选：依赖 Task ID 列表'),
        parent: z.string().optional().describe('可选：父 Task ID；把大执行项拆成可分别认领/验收的子任务时使用，例如 T-003'),
        validates: z.array(z.string()).optional().describe('可选：需求/设计锚点，例如 F-01 或 D-02'),
      },
      outputSchema: createToolOutputSchema(TaskDataSchema),
      annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (args) => toMcpToolResult(getManagers().tasks.create(args), 'task_create'),
  );

  server.registerTool(
    'task_create_many',
    {
      title: 'Create Many Tasks',
      description: TOOL_DESCRIPTIONS.task_create_many,
      inputSchema: {
        scene: z.string().describe('Scene 标识'),
        spec: z.string().describe('Spec 标识'),
        tasks: z.array(z.object({
          title: z.string().describe('任务标题'),
          description: z.string().optional().describe('可选：任务描述'),
          acceptance: z.array(z.string()).optional().describe('可选：验收标准列表'),
          depends_on: z.array(z.string()).optional().describe('可选：依赖列表；每项可为批内其它条目的 key 或已存在的真实 Task ID'),
          parent: z.string().optional().describe('可选：父 Task ID；只接受已存在的真实 Task ID，不支持批内 key'),
          validates: z.array(z.string()).optional().describe('可选：需求/设计锚点，例如 F-01 或 D-02'),
          key: z.string().optional().describe('可选：批内临时键，供同批 depends_on 引用；不得使用 T-xxx 格式，不落盘'),
        })).describe('要创建的任务列表；按数组顺序分配 T-xxx，任一条校验失败整批不写'),
      },
      outputSchema: createToolOutputSchema(z.array(TaskDataSchema)),
      annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (args) => toMcpToolResult(getManagers().tasks.createMany(args), 'task_create_many'),
  );

  server.registerTool(
    'task_update',
    {
      title: 'Update Task',
      description: TOOL_DESCRIPTIONS.task_update,
      inputSchema: {
        scene: z.string().describe('Scene 标识'),
        spec: z.string().describe('Spec 标识'),
        task_id: z.string().describe('Task ID，例如 T-001'),
        status: z.enum(['pending', 'in_progress', 'blocked', 'completed', 'failed']).describe('目标状态'),
        reason: z.string().optional().describe('可选：状态变更原因'),
        agent_id: z.string().optional().describe('可选：当前 Agent ID；传入后 in_progress 自动登记 task claim，completed/failed 自动释放'),
        claim_ttl_seconds: z.number().int().positive().optional().describe('可选：task claim 租约秒数'),
        touches_files: z.array(z.string()).optional().describe('可选：多窗口并行时建议声明本 Task 预计修改的文件路径，用于重叠提示，不锁源码'),
      },
      outputSchema: createToolOutputSchema(TaskDataSchema),
      annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (args) => toMcpToolResult(getManagers().tasks.update(args), 'task_update'),
  );

  server.registerTool(
    'task_claim',
    {
      title: 'Claim Task',
      description: TOOL_DESCRIPTIONS.task_claim,
      inputSchema: {
        scene: z.string().describe('Scene 标识'),
        spec: z.string().describe('Spec 标识'),
        task: z.string().describe('Task ID，例如 T-001'),
        agent_id: z.string().describe('当前 Agent ID'),
        ttl_seconds: z.number().int().positive().optional().describe('可选：task claim 租约秒数'),
        touches_files: z.array(z.string()).optional().describe('可选：多窗口并行时建议声明预计修改的文件路径，用于重叠提示，不锁源码'),
      },
      outputSchema: createToolOutputSchema(TaskClaimResultSchema),
      annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args) => toMcpToolResult(getManagers().tasks.claim(args), 'task_claim'),
  );

  server.registerTool(
    'task_release',
    {
      title: 'Release Task Claim',
      description: TOOL_DESCRIPTIONS.task_release,
      inputSchema: {
        scene: z.string().describe('Scene 标识'),
        spec: z.string().describe('Spec 标识'),
        task: z.string().describe('Task ID，例如 T-001'),
        agent_id: z.string().describe('当前 Agent ID'),
      },
      outputSchema: createToolOutputSchema(SimpleConfirmationDataSchema),
      annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args) => toMcpToolResult(getManagers().tasks.releaseClaim(args), 'task_release'),
  );

  server.registerTool(
    'task_list',
    {
      title: 'List Tasks',
      description: TOOL_DESCRIPTIONS.task_list,
      inputSchema: {
        scene: z.string().describe('Scene 标识'),
        spec: z.string().describe('Spec 标识'),
        view: z.enum(['raw', 'readable']).optional().describe('可选：raw 返回完整 Task；readable 返回人读投影视图，隐藏 history/meta'),
      },
      outputSchema: createToolOutputSchema(z.union([z.array(TaskDataSchema), z.array(ReadableTaskSchema)])),
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async ({ scene, spec, view }) => toMcpToolResult(
      (view === 'readable'
        ? getManagers().tasks.list(scene, spec, { view: 'readable' })
        : getManagers().tasks.list(scene, spec)
      ).then(withTaskListFollowup),
      'task_list',
    ),
  );
}

function registerADRTools(server: McpServer): void {
  server.registerTool(
    'adr_create',
    {
      title: 'Create ADR',
      description: TOOL_DESCRIPTIONS.adr_create,
      inputSchema: {
        title: z.string().describe('ADR 标题'),
        scope: z.string().describe('global 或 scene:{id}'),
        context: z.string().describe('决策背景'),
        decision: z.string().describe('最终决策'),
        alternatives: z.array(z.string()).optional().describe('备选方案及拒绝理由'),
        consequences: z.string().optional().describe('后果与风险'),
        supersedes: z.array(z.string()).optional().describe('替代的 ADR 编号'),
      },
      outputSchema: createToolOutputSchema(ADRDataSchema),
      annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (args) => toMcpToolResult(getManagers().adrs.create({
      ...args,
      scope: normalizeScope(args.scope),
    }), 'adr_create'),
  );

  server.registerTool(
    'adr_list',
    {
      title: 'List ADRs',
      description: TOOL_DESCRIPTIONS.adr_list,
      inputSchema: {
        scope: z.string().optional().describe('global 或 scene:{id}'),
      },
      outputSchema: createToolOutputSchema(z.array(ADRDataSchema)),
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async ({ scope }) => toMcpToolResultFromData(getManagers().adrs.list(normalizeScope(scope)), 'adr_list', true),
  );

  server.registerTool(
    'adr_get',
    {
      title: 'Get ADR',
      description: TOOL_DESCRIPTIONS.adr_get,
      inputSchema: {
        scope: z.string().describe('global 或 scene:{id}'),
        number: z.string().describe('ADR 编号，例如 1 或 0001'),
      },
      outputSchema: createToolOutputSchema(ADRDataSchema),
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async ({ scope, number }) => toMcpToolResultFromData(getManagers().adrs.get(normalizeScope(scope), number), 'adr_get'),
  );
}

function registerGoalTools(server: McpServer): void {
  server.registerTool(
    'assess_goal',
    {
      title: 'Assess Goal',
      description: TOOL_DESCRIPTIONS.assess_goal,
      inputSchema: {
        goal: z.string().describe('用户目标描述'),
      },
      outputSchema: createToolOutputSchema(GoalAssessmentDataSchema),
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async ({ goal }) => toMcpToolResult(Promise.resolve(new GoalAssessor().assess(goal)), 'assess_goal'),
  );
}

function registerSummaryTools(server: McpServer): void {
  server.registerTool(
    'summarize_save',
    {
      title: 'Save Summary',
      description: TOOL_DESCRIPTIONS.summarize_save,
      inputSchema: {
        uri: z.string().describe('要保存摘要的 context:// URI'),
        l0: z.string().optional().describe('L0 一句话摘要'),
        l1: z.string().optional().describe('L1 概览摘要'),
      },
      outputSchema: createToolOutputSchema(SummarizeSaveResultSchema),
      annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args) => toMcpToolResult(getManagers().summaries.saveSummary(args), 'summarize_save'),
  );
}

function registerSearchTools(server: McpServer): void {
  server.registerTool(
    'context_search',
    {
      title: 'Search Context',
      description: TOOL_DESCRIPTIONS.context_search,
      inputSchema: {
        query: z.string().describe('搜索关键词'),
        scope: z.string().optional().describe('global 或 scene:{id}'),
        max_depth: z.number().int().positive().optional().describe('最大下钻深度，默认 3'),
      },
      outputSchema: createToolOutputSchema(ContextSearchResultSchema),
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async (args) => toMcpToolResult(getManagers().searcher.search({
      ...args,
      scope: normalizeScope(args.scope),
    }), 'context_search'),
  );
}

function registerErrorTools(server: McpServer): void {
  server.registerTool(
    'error_record',
    {
      title: 'Record Error',
      description: TOOL_DESCRIPTIONS.error_record,
      inputSchema: {
        symptom: z.string().describe('错误现象'),
        root_cause: z.string().describe('根因'),
        fix_action: z.string().describe('修复动作'),
        scope: z.string().optional().describe('global 或 scene:{id}，默认 global'),
        verification: z.string().optional().describe('可选：验证证据'),
        references: z.array(z.string()).optional().describe('可选：提交、PR、日志等引用'),
        tags: z.array(z.string()).optional().describe('可选：标签'),
      },
      outputSchema: createToolOutputSchema(ErrorEntryDataSchema),
      annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (args) => toMcpToolResult(getManagers().errors.record({
      ...args,
      scope: normalizeScope(args.scope),
    }), 'error_record'),
  );

  server.registerTool(
    'error_search',
    {
      title: 'Search Errors',
      description: TOOL_DESCRIPTIONS.error_search,
      inputSchema: {
        query: z.string().describe('搜索关键词'),
        scope: z.string().optional().describe('global 或 scene:{id}，默认 global'),
      },
      outputSchema: createToolOutputSchema(z.array(ErrorEntryDataSchema)),
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async (args) => toMcpToolResult(getManagers().errors.search({
      query: args.query,
      scope: normalizeScope(args.scope),
    }).then((entries) => (entries.length > 0 ? { ok: true, data: entries } : {
      ok: true,
      data: entries,
      ai_followup: {
        instructions: [
          'error_search 是零模型关键词检索、无语义召回：未命中时请换记录原文的关键词/错误码/文件名重试，不要用近义改述（I-14）。',
        ],
      },
    })), 'error_search', true),
  );

  server.registerTool(
    'error_promote',
    {
      title: 'Promote Error',
      description: TOOL_DESCRIPTIONS.error_promote,
      inputSchema: {
        id: z.string().describe('错误 ID / 指纹'),
        scope: z.string().optional().describe('global 或 scene:{id}，默认 global'),
        verification: z.string().optional().describe('验证证据'),
      },
      outputSchema: createToolOutputSchema(ErrorEntryDataSchema),
      annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (args) => toMcpToolResult(getManagers().errors.promote({
      id: args.id,
      scope: normalizeScope(args.scope),
      verification: args.verification,
    }), 'error_promote'),
  );
}

function registerMemoryTools(server: McpServer): void {
  const categorySchema = z.enum([
    MemoryCategory.PREFERENCES,
    MemoryCategory.DECISIONS,
    MemoryCategory.PATTERNS,
    MemoryCategory.ERRORS,
    MemoryCategory.FACTS,
  ]);

  server.registerTool(
    'memory_save',
    {
      title: 'Save Memory',
      description: TOOL_DESCRIPTIONS.memory_save,
      inputSchema: {
        category: categorySchema.describe('记忆分类'),
        content: z.string().describe('记忆内容'),
        source: z.string().describe('来源：对话、文件、提交等'),
        scope: z.string().optional().describe('global 或 scene:{id}，默认 global'),
        tentative: z.boolean().optional().describe('是否为不确定记忆'),
      },
      outputSchema: createToolOutputSchema(MemoryDataSchema),
      annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (args) => toMcpToolResult(getManagers().memories.save({
      ...args,
      scope: normalizeScope(args.scope),
    }), 'memory_save'),
  );

  server.registerTool(
    'memory_search',
    {
      title: 'Search Memory',
      description: TOOL_DESCRIPTIONS.memory_search,
      inputSchema: {
        query: z.string().describe('搜索关键词'),
        category: categorySchema.optional().describe('可选：记忆分类'),
        scope: z.string().optional().describe('global 或 scene:{id}，默认 global'),
      },
      outputSchema: createToolOutputSchema(z.array(MemoryDataSchema)),
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async (args) => toMcpToolResultFromData(getManagers().memories.search({
      query: args.query,
      category: args.category,
      scope: normalizeScope(args.scope),
    }), 'memory_search', true),
  );

  server.registerTool(
    'memory_forget',
    {
      title: 'Forget Memory',
      description: TOOL_DESCRIPTIONS.memory_forget,
      inputSchema: {
        id: z.string().describe('记忆 ID'),
        category: categorySchema.describe('记忆分类'),
        scope: z.string().optional().describe('global 或 scene:{id}，默认 global'),
      },
      outputSchema: createToolOutputSchema(SimpleConfirmationDataSchema),
      annotations: { destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (args) => toMcpToolResult(getManagers().memories.forget({
      id: args.id,
      category: args.category,
      scope: normalizeScope(args.scope),
    }), 'memory_forget'),
  );

  server.registerTool(
    'session_commit',
    {
      title: 'Commit Session',
      description: TOOL_DESCRIPTIONS.session_commit,
      inputSchema: {
        summary: z.string().describe('会话摘要'),
        candidates: z.array(z.object({
          category: categorySchema,
          content: z.string(),
          source: z.string(),
        })).describe('候选记忆列表'),
        scope: z.string().optional().describe('global 或 scene:{id}，默认 global'),
      },
      outputSchema: createToolOutputSchema(SessionCommitResultSchema),
      annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (args) => toMcpToolResult(getManagers().sessionCommit.commit({
      summary: args.summary,
      candidates: args.candidates,
      scope: normalizeScope(args.scope),
    }), 'session_commit'),
  );
}

function registerAgentTools(server: McpServer): void {
  server.registerTool(
    'agent_register',
    {
      title: 'Register Agent',
      description: TOOL_DESCRIPTIONS.agent_register,
      inputSchema: {
        agent_id: z.string().optional().describe('可选：客户端自带 Agent ID'),
        client: z.string().optional().describe('可选：客户端名称，例如 codex/claude-code/cursor'),
      },
      outputSchema: createToolOutputSchema(AgentRegisterResultSchema),
      annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args) => toMcpToolResult(getManagers().agents.register(args), 'agent_register'),
  );

  server.registerTool(
    'agent_heartbeat',
    {
      title: 'Heartbeat Agent',
      description: TOOL_DESCRIPTIONS.agent_heartbeat,
      inputSchema: {
        agent_id: z.string().describe('Agent ID'),
      },
      outputSchema: createToolOutputSchema(AgentHeartbeatResultSchema),
      annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ agent_id }) => toMcpToolResult(getManagers().agents.heartbeat(agent_id), 'agent_heartbeat'),
  );

  server.registerTool(
    'agent_list',
    {
      title: 'List Agents',
      description: TOOL_DESCRIPTIONS.agent_list,
      inputSchema: {},
      outputSchema: createToolOutputSchema(AgentListResultSchema),
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async () => toMcpToolResult(getManagers().agents.list(), 'agent_list'),
  );

  server.registerTool(
    'agent_unregister',
    {
      title: 'Unregister Agent',
      description: TOOL_DESCRIPTIONS.agent_unregister,
      inputSchema: {
        agent_id: z.string().describe('Agent ID'),
      },
      outputSchema: createToolOutputSchema(SimpleConfirmationDataSchema),
      annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ agent_id }) => toMcpToolResult(getManagers().agents.unregister({ agent_id }), 'agent_unregister'),
  );
}

function registerDoctorTools(server: McpServer): void {
  server.registerTool(
    'lrnev_doctor',
    {
      title: 'Diagnose lrnev workspace',
      description: TOOL_DESCRIPTIONS.lrnev_doctor,
      inputSchema: {
        verbose: z.boolean().optional().describe('M1 保留参数；当前总是返回结构化 issues'),
        fix: z.boolean().optional().describe('M1 不自动修复，只返回建议'),
        migrate_todos: z.boolean().optional().describe('可选：把旧模板 TODO 占位精确迁移为 <!-- FILL: ... --> 哨兵'),
        migrate_summaries: z.boolean().optional().describe('可选：删除旧式目录级摘要文件 .abstract.md / .overview.md'),
        gc_agents: z.boolean().optional().describe('可选：显式清理已判 dead 且名下无未过期 claim 的 agent 记录'),
      },
      outputSchema: createToolOutputSchema(DoctorResultSchema),
      annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ migrate_todos, migrate_summaries, gc_agents }) => {
      const doctor = getManagers().doctor;
      if ([migrate_todos, migrate_summaries, gc_agents].filter(Boolean).length > 1) {
        return toMcpToolResult(Promise.reject(new LrnevError(ErrorCode.INVALID_INPUT, 'lrnev_doctor 一次只能选择一种维护动作', {
          field: 'migrate',
          hint: '分别使用 migrate_todos、migrate_summaries 或 gc_agents。',
        })), 'lrnev_doctor');
      }
      if (migrate_todos) return toMcpToolResultFromData(doctor.migrateTodosToSentinels(), 'lrnev_doctor', true);
      if (migrate_summaries) return toMcpToolResultFromData(doctor.migrateLegacySummaries(), 'lrnev_doctor', true);
      if (gc_agents) return toMcpToolResultFromData(doctor.gcAgents(), 'lrnev_doctor', true);
      return toMcpToolResultFromData(doctor.diagnose(), 'lrnev_doctor', true);
    },
  );
}

function registerHookTools(server: McpServer): void {
  server.registerTool(
    'lrnev_hook_list',
    {
      title: 'List Hooks',
      description: TOOL_DESCRIPTIONS.lrnev_hook_list,
      inputSchema: {},
      outputSchema: createToolOutputSchema(HookListResultSchema),
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async () => toMcpToolResult(getManagers().hooks.list(), 'lrnev_hook_list'),
  );

  server.registerTool(
    'lrnev_hook_trigger',
    {
      title: 'Trigger Hook',
      description: TOOL_DESCRIPTIONS.lrnev_hook_trigger,
      inputSchema: {
        event: z.string().describe('事件名，例如 task.update.completed'),
        payload: z.record(z.string(), z.unknown()).optional().describe('可选 payload，会注入 LRNEV_PAYLOAD'),
      },
      outputSchema: createToolOutputSchema(HookTriggerResultSchema),
      annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ event, payload }) => toMcpToolResult(getManagers().hooks.triggerResponse(event, payload ?? {}), 'lrnev_hook_trigger'),
  );

  server.registerTool(
    'lrnev_hook_tail_log',
    {
      title: 'Tail Hook Log',
      description: TOOL_DESCRIPTIONS.lrnev_hook_tail_log,
      inputSchema: {
        lines: z.number().int().positive().optional().describe('可选：读取最近 N 条 hook 日志，默认使用配置 recent_list_limit'),
      },
      outputSchema: createToolOutputSchema(z.array(HookLogEntrySchema)),
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async ({ lines }) => toMcpToolResult(getManagers().hooks.tailLog(lines), 'lrnev_hook_tail_log'),
  );

  server.registerTool(
    'lrnev_hook_enable',
    {
      title: 'Enable Hook',
      description: TOOL_DESCRIPTIONS.lrnev_hook_enable,
      inputSchema: { name: z.string().describe('Hook 名称') },
      outputSchema: createToolOutputSchema(SimpleConfirmationDataSchema),
      annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ name }) => toMcpToolResult(getManagers().hooks.setEnabled(name, true), 'lrnev_hook_enable'),
  );

  server.registerTool(
    'lrnev_hook_disable',
    {
      title: 'Disable Hook',
      description: TOOL_DESCRIPTIONS.lrnev_hook_disable,
      inputSchema: { name: z.string().describe('Hook 名称') },
      outputSchema: createToolOutputSchema(SimpleConfirmationDataSchema),
      annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ name }) => toMcpToolResult(getManagers().hooks.setEnabled(name, false), 'lrnev_hook_disable'),
  );
}

function getManagers(): {
  scenes: SceneManager;
  specs: SpecManager;
  tasks: TaskManager;
  gates: GateRunner;
  adrs: ADRManager;
  summaries: Summarizer;
  searcher: Searcher;
  errors: ErrorbookManager;
  memories: MemoryManager;
  sessionCommit: SessionCommit;
  doctor: Doctor;
  hooks: HookManager;
  agents: AgentRegistry;
  projectStatus: ProjectStatus;
  governanceMap: GovernanceMap;
  governanceReport: GovernanceReport;
} {
  const root = resolveWorkspaceRoot().root;
  const fs = new FileStorage(root);
  const scenes = new SceneManager(fs);
  const specs = new SpecManager(fs, scenes);
  const tasks = new TaskManager(fs, scenes, specs);
  const gates = new GateRunner(fs, scenes, specs, tasks);
  const adrs = new ADRManager(fs, scenes);
  const summaries = new Summarizer(fs);
  const searcher = new Searcher(fs);
  const errors = new ErrorbookManager(fs, scenes);
  const memories = new MemoryManager(fs, scenes);
  const sessionCommit = new SessionCommit(memories);
  const doctor = new Doctor(fs);
  const hooks = new HookManager(fs);
  const agents = new AgentRegistry(fs);
  const projectStatus = new ProjectStatus(fs, scenes);
  const governanceMap = new GovernanceMap(fs, scenes);
  const governanceReport = new GovernanceReport(fs, scenes);
  return { scenes, specs, tasks, gates, adrs, summaries, searcher, errors, memories, sessionCommit, doctor, hooks, agents, projectStatus, governanceMap, governanceReport };
}

function normalizeScope(scope: string | undefined): Scope {
  if (!scope || scope === 'global') return 'global';
  return scope as Scope;
}

function withTaskListFollowup<T>(tasks: T[]): AiFollowupResponse<T[]> {
  return {
    ok: true,
    data: tasks,
    ai_followup: {
      instructions: [
        '返回数组是全量平铺：含 parent 字段的是子任务；顶层视图用 task.parent === undefined 过滤。',
        '父任务的 children 字段是冗余视图，便于直接渲染层级；不要把 children 内的项再算一次。',
      ],
    },
  };
}

function withProjectStatusFollowup<T extends AiFollowupResponse<unknown>>(response: T): T {
  return {
    ...response,
    ai_followup: {
      ...response.ai_followup,
      instructions: [
        ...(response.ai_followup?.instructions ?? []),
        'active_agents 里的 active_claims 显示谁正在做哪个 Task；free_tasks_count/claimable_next 给出当前可领的 pending task，claim 只做软占用，文件重叠需要你自己确认。',
      ],
    },
  };
}

function withBrokenFollowup<T extends { broken?: { error: string; path: string } }>(
  label: string,
): (items: T[]) => AiFollowupResponse<T[]> {
  return (items) => {
    const brokenItems = items.filter((item) => item.broken);
    if (brokenItems.length === 0) {
      return {
        ok: true,
        data: items,
      };
    }
    return {
      ok: true,
      data: items,
      ai_followup: {
        instructions: [
          `检测到 ${brokenItems.length} 个损坏 ${label} 条目，列表中已用 broken 标记。`,
          '请建议用户运行 lrnev_doctor 检查 .lrnev 数据，并优先修复 broken.path 指向的文件。',
        ],
        suggested_tools: [
          {
            name: 'lrnev_doctor',
            args_template: { verbose: true },
            reason: '定位并修复损坏的治理数据',
          },
        ],
      },
    };
  };
}

