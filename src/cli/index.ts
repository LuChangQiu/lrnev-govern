/**
 * CLI 入口。
 *
 * CLI 是 core 层的薄包装：解析参数、调用 Manager、输出结构化结果。
 */

import { Command } from 'commander';
import { readFile, writeFile } from 'node:fs/promises';

import { VERSION } from '../shared/version.js';
import { FileStorage } from '../storage/FileStorage.js';
import { resolveWorkspaceRoot } from '../storage/WorkspaceLocator.js';
import { WorkspaceManager } from '../core/WorkspaceManager.js';
import { SceneManager } from '../core/SceneManager.js';
import { SpecManager } from '../core/SpecManager.js';
import { TaskManager } from '../core/TaskManager.js';
import { GateRunner } from '../core/GateRunner.js';
import { getSpecWithGuidance } from '../core/SpecGuidance.js';
import { ADRManager } from '../core/ADRManager.js';
import { GoalAssessor } from '../core/GoalAssessor.js';
import { Summarizer } from '../core/Summarizer.js';
import { Searcher } from '../core/Searcher.js';
import { ErrorbookManager } from '../core/ErrorbookManager.js';
import { MemoryManager } from '../core/MemoryManager.js';
import { SessionCommit } from '../core/SessionCommit.js';
import { Doctor } from '../core/Doctor.js';
import { HookManager } from '../core/HookManager.js';
import { ProjectStatus } from '../core/ProjectStatus.js';
import { GovernanceMap } from '../core/GovernanceMap.js';
import { GovernanceReport } from '../core/GovernanceReport.js';
import type { GovernanceReportResult } from '../types/governance-report.js';
import { buildGateFollowup } from '../core/GateGuidance.js';
import { AgentRegistry } from '../core/AgentRegistry.js';
import { MemoryCategory, type MemoryCandidate, type SessionCommitInput } from '../types/memory.js';
import { ErrorCode, LrnevError, isLrnevError } from '../shared/errors.js';
import { buildGuide, GUIDE_TOPIC_VALUES, type GuideTopic } from '../mcp/guidance.js';
import type { Scope } from '../types/response.js';
import type { GateType } from '../types/gate.js';
import type { SpecPriority, SpecStatus } from '../types/spec.js';
import type { TaskStatus } from '../types/task.js';

export interface BuildCliOptions {
  writeOut?: (text: string) => void;
  writeErr?: (text: string) => void;
}

interface CliGlobals {
  workspace?: string;
  json?: boolean;
  verbose?: boolean;
}

interface CliActionOptions extends CliGlobals {
  acceptance?: string[];
  agentId: string;
  alternatives?: string[];
  candidatesFile?: string;
  category: MemoryCategory;
  claimTtlSeconds?: number;
  client?: string;
  consequences?: string;
  content: string;
  context: string;
  decision: string;
  dependsOn?: string[];
  description?: string;
  fix?: boolean;
  fixAction: string;
  gate: GateType;
  gcAgents?: boolean;
  id: string;
  intent?: string;
  l0?: string;
  l1?: string;
  lines?: number;
  maxDepth?: number;
  md?: boolean;
  migrateSummaries?: boolean;
  migrateTodos?: boolean;
  out?: string;
  releaseNotes?: boolean;
  parent?: string;
  payload?: string;
  priority?: SpecPriority;
  projectName?: string;
  reason?: string;
  readable?: boolean;
  rootCause: string;
  scan?: boolean;
  scene: string;
  scope: string;
  source: string;
  spec: string;
  status: TaskStatus;
  summary: string;
  supersedes?: string[];
  symptom: string;
  tags?: string[];
  title: string;
  touchesFiles?: string[];
  ttlSeconds?: number;
  uri: string;
  validates?: string[];
  verification: string;
  version?: number;
}

export function buildCli(options: BuildCliOptions = {}): Command {
  const program = new Command();

  program
    .name('lrnev')
    .description('lrnev — AI 协作开发的项目治理服务（Scene → Spec → ADR（可选）→ Task）')
    .version(VERSION)
    .option('-w, --workspace <path>', '显式指定工作区根目录')
    .option('--json', '以 JSON 输出')
    .option('--verbose', '输出更多诊断信息');

  program.addCommand(buildInitCommand(program, options));
  program.addCommand(buildGuideCommand(program, options));
  program.addCommand(buildSceneCommand(program, options));
  program.addCommand(buildSpecCommand(program, options));
  program.addCommand(buildTaskCommand(program, options));
  program.addCommand(buildAdrCommand(program, options));
  program.addCommand(buildGoalCommand(program, options));
  program.addCommand(buildSummaryCommand(program, options));
  program.addCommand(buildSessionCommand(program, options));
  program.addCommand(buildHookCommand(program, options));
  program.addCommand(buildAgentCommand(program, options));
  program.addCommand(buildErrorCommand(program, options));
  program.addCommand(buildMemoryCommand(program, options));
  program.addCommand(buildGateCommand(program, options));
  program.addCommand(buildDoctorCommand(program, options));
  program.addCommand(buildSearchCommand(program, options));
  program.addCommand(buildStatusCommand(program, options));
  program.addCommand(buildMapCommand(program, options));
  program.addCommand(buildReportCommand(program, options));

  return program;
}

export async function runCli(argv: string[]): Promise<void> {
  const program = buildCli();
  await program.parseAsync(argv);
}

function buildGuideCommand(program: Command, options: BuildCliOptions): Command {
  return new Command('guide')
    .description('lrnev 使用手册')
    .argument('[topic]', '可选：workflow/tools/errors/concepts')
    .action(run(program, options, async (_opts, topic?: string) => {
      if (topic !== undefined && !isGuideTopic(topic)) {
        throw new LrnevError(ErrorCode.INVALID_INPUT, `guide topic 必须是：${GUIDE_TOPIC_VALUES.join(', ')}`, {
          field: 'topic',
          hint: '使用 workflow、tools、errors 或 concepts。',
        });
      }
      return buildGuide(topic);
    }));
}

function buildInitCommand(program: Command, options: BuildCliOptions): Command {
  return new Command('init')
    .description('初始化 .lrnev 工作区')
    .option('--project-name <name>', '项目名')
    .option('--scan', '占位 flag，M2 不做主动扫描；行为同默认 init')
    .action(run(program, options, async (opts) => {
      const result = await new WorkspaceManager().init({
        root: opts.workspace,
        project_name: opts.projectName,
        scan: opts.scan,
      });
      if (!opts.json && result.data.codebase_detected) {
        writeErr(options, '✓ 已初始化并检测到已有代码。auto/codebase.json 里的探测信号仅供参考；请读构建/清单文件和核心源码补全 PROJECT 与 ARCHITECTURE。\n');
      }
      return result;
    }));
}

function buildSceneCommand(program: Command, options: BuildCliOptions): Command {
  const scene = new Command('scene').description('Scene 管理');
  scene.command('create')
    .argument('<name>', 'Scene 名称')
    .option('--intent <intent>', '业务意图')
    .action(run(program, options, async (opts, name: string) => managers(opts).scenes.create({ name, intent: opts.intent })));
  scene.command('list')
    .action(run(program, options, async (opts) => managers(opts).scenes.list()));
  scene.command('get')
    .argument('<scene>', 'Scene 标识')
    .action(run(program, options, async (opts, sceneId: string) => managers(opts).scenes.get(sceneId)));
  return scene;
}

function buildSpecCommand(program: Command, options: BuildCliOptions): Command {
  const spec = new Command('spec').description('Spec 管理');
  spec.command('create')
    .option('--scene <scene>', 'Scene 标识，省略时使用 00-default')
    .argument('<name>', 'Spec 名称')
    .option('--version <version>', '版本号', parseInt)
    .option('--priority <priority>', '优先级 P0/P1/P2/P3')
    .action(run(program, options, async (opts, name: string) => managers(opts).specs.create({
      scene: opts.scene,
      name,
      version: opts.version,
      priority: opts.priority,
    })));
  spec.command('list')
    .requiredOption('--scene <scene>', 'Scene 标识')
    .action(run(program, options, async (opts) => managers(opts).specs.list(opts.scene)));
  spec.command('get')
    .requiredOption('--scene <scene>', 'Scene 标识')
    .argument('<spec>', 'Spec 标识')
    .action(run(program, options, async (opts, specId: string) => {
      const root = opts.workspace ?? resolveWorkspaceRoot().root;
      return getSpecWithGuidance(new FileStorage(root), managers(opts).specs, opts.scene, specId);
    }));
  spec.command('update')
    .requiredOption('--scene <scene>', 'Scene 标识')
    .requiredOption('--status <status>', '目标状态 draft/ready/in-progress/completed/archived')
    .option('--reason <reason>', '变更原因')
    .argument('<spec>', 'Spec 标识')
    .action(run(program, options, async (opts, specId: string) =>
      managers(opts).specs.updateStatus(opts.scene, specId, opts.status as SpecStatus, opts.reason)));
  return spec;
}

function buildTaskCommand(program: Command, options: BuildCliOptions): Command {
  const task = new Command('task').description('Task 管理');
  const create = task.command('create')
    .requiredOption('--scene <scene>', 'Scene 标识')
    .requiredOption('--spec <spec>', 'Spec 标识')
    .argument('<title>', '任务标题')
    .option('--description <description>', '任务描述')
    .option('--acceptance <items...>', '验收标准')
    .option('--parent <task_id>', '父 Task ID；把大执行项拆成可分别认领/验收的子任务时使用，例如 T-003')
    .option('--validates <anchors...>', '需求/设计锚点，例如 F-01 或 D-02')
    .option('--depends-on <task_ids...>', '依赖的前置 Task ID 列表，例如 T-001 T-002')
    .allowUnknownOption()
    .action(run(program, options, async (opts, title: string) => managers(opts).tasks.create({
      scene: opts.scene,
      spec: opts.spec,
      title: normalizeTaskTitle(title, create.args),
      description: opts.description,
      acceptance: opts.acceptance,
      parent: opts.parent,
      validates: opts.validates,
      depends_on: opts.dependsOn,
    })));
  task.command('update')
    .requiredOption('--scene <scene>', 'Scene 标识')
    .requiredOption('--spec <spec>', 'Spec 标识')
    .requiredOption('--status <status>', '目标状态')
    .argument('<task_id>', 'Task ID')
    .option('--reason <reason>', '状态变更原因')
    .option('--agent-id <agent_id>', '可选：当前 Agent ID；传入后自动登记/释放 task claim')
    .option('--claim-ttl-seconds <seconds>', '可选：task claim 租约秒数', parseInt)
    .option('--touches-files <files...>', '可选：多窗口并行时建议声明本 Task 预计修改的文件路径，用于重叠提示')
    .action(run(program, options, async (opts, taskId: string) => managers(opts).tasks.update({
      scene: opts.scene,
      spec: opts.spec,
      task_id: taskId,
      status: opts.status,
      reason: opts.reason,
      agent_id: opts.agentId,
      claim_ttl_seconds: opts.claimTtlSeconds,
      touches_files: opts.touchesFiles,
    })));
  task.command('claim')
    .requiredOption('--scene <scene>', 'Scene 标识')
    .requiredOption('--spec <spec>', 'Spec 标识')
    .requiredOption('--agent-id <agent_id>', '当前 Agent ID')
    .argument('<task_id>', 'Task ID')
    .option('--ttl-seconds <seconds>', '可选：task claim 租约秒数', parseInt)
    .option('--touches-files <files...>', '可选：多窗口并行时建议声明预计修改的文件路径，用于重叠提示')
    .action(run(program, options, async (opts, taskId: string) => managers(opts).tasks.claim({
      scene: opts.scene,
      spec: opts.spec,
      task: taskId,
      agent_id: opts.agentId,
      ttl_seconds: opts.ttlSeconds,
      touches_files: opts.touchesFiles,
    })));
  task.command('release')
    .requiredOption('--scene <scene>', 'Scene 标识')
    .requiredOption('--spec <spec>', 'Spec 标识')
    .requiredOption('--agent-id <agent_id>', '当前 Agent ID')
    .argument('<task_id>', 'Task ID')
    .action(run(program, options, async (opts, taskId: string) => managers(opts).tasks.releaseClaim({
      scene: opts.scene,
      spec: opts.spec,
      task: taskId,
      agent_id: opts.agentId,
    })));
  task.command('list')
    .requiredOption('--scene <scene>', 'Scene 标识')
    .requiredOption('--spec <spec>', 'Spec 标识')
    .option('--readable', '返回人读投影视图，隐藏 history/meta 等治理细节')
    .action(run(program, options, async (opts) => (
      opts.readable
        ? managers(opts).tasks.list(opts.scene, opts.spec, { view: 'readable' }).then(withTaskListFollowup)
        : managers(opts).tasks.list(opts.scene, opts.spec).then(withTaskListFollowup)
    )));
  return task;
}

function buildAdrCommand(program: Command, options: BuildCliOptions): Command {
  const adr = new Command('adr').description('ADR 管理');
  adr.command('create')
    .requiredOption('--title <title>', '标题')
    .requiredOption('--context <context>', '背景')
    .requiredOption('--decision <decision>', '决策')
    .option('--scope <scope>', 'global 或 scene:{id}', 'global')
    .option('--consequences <text>', '影响')
    .option('--alternatives <items...>', '备选方案')
    .option('--supersedes <numbers...>', '替代的 ADR 编号，例如 1 2')
    .action(run(program, options, async (opts) => managers(opts).adrs.create({
      title: opts.title,
      scope: normalizeScope(opts.scope),
      context: opts.context,
      decision: opts.decision,
      alternatives: opts.alternatives,
      consequences: opts.consequences,
      supersedes: opts.supersedes,
    })));
  adr.command('list')
    .option('--scope <scope>', 'global 或 scene:{id}', 'global')
    .action(run(program, options, async (opts) => managers(opts).adrs.list(normalizeScope(opts.scope))));
  adr.command('get')
    .argument('<number>', 'ADR 编号')
    .option('--scope <scope>', 'global 或 scene:{id}', 'global')
    .action(run(program, options, async (opts, number: string) => managers(opts).adrs.get(normalizeScope(opts.scope), number)));
  return adr;
}

function buildGoalCommand(program: Command, options: BuildCliOptions): Command {
  const goal = new Command('goal').description('Goal 评估');
  goal.command('assess')
    .argument('<goal>', '目标描述')
    .action(run(program, options, async (_opts, goalText: string) => new GoalAssessor().assess(goalText)));
  return goal;
}

function buildSummaryCommand(program: Command, options: BuildCliOptions): Command {
  const summary = new Command('summary').description('摘要管理');
  summary.command('save')
    .requiredOption('--uri <uri>', 'context:// URI')
    .option('--l0 <text>', 'L0 一句话摘要')
    .option('--l1 <text>', 'L1 概览摘要')
    .action(run(program, options, async (opts) => managers(opts).summaries.saveSummary({
      uri: opts.uri,
      l0: opts.l0,
      l1: opts.l1,
    })));
  return summary;
}

function buildSessionCommand(program: Command, options: BuildCliOptions): Command {
  const session = new Command('session').description('Session 记忆提交');
  session.command('commit')
    .requiredOption('--summary <summary>', '会话摘要')
    .option('--candidates-file <path>', '候选记忆 JSON 文件；未传时从 stdin 读取 candidates JSON')
    .option('--scope <scope>', 'global 或 scene:{id}', 'global')
    .action(run(program, options, async (opts) => managers(opts).sessionCommit.commit({
      summary: opts.summary,
      candidates: await readMemoryCandidates(opts.candidatesFile),
      scope: normalizeScope(opts.scope),
    })));
  return session;
}

function buildHookCommand(program: Command, options: BuildCliOptions): Command {
  const hook = new Command('hook').description('Hook 管理');
  hook.command('list')
    .action(run(program, options, async (opts) => managers(opts).hooks.list()));
  hook.command('trigger')
    .argument('<event>', '事件名，例如 task.update.completed')
    .option('--payload <json>', '可选 JSON payload')
    .action(run(program, options, async (opts, event: string) => managers(opts).hooks.triggerResponse(
      event,
      opts.payload ? JSON.parse(opts.payload) as Record<string, unknown> : {},
    )));
  hook.command('enable')
    .argument('<name>', 'Hook 名称')
    .action(run(program, options, async (opts, name: string) => managers(opts).hooks.setEnabled(name, true)));
  hook.command('disable')
    .argument('<name>', 'Hook 名称')
    .action(run(program, options, async (opts, name: string) => managers(opts).hooks.setEnabled(name, false)));
  hook.command('tail-log')
    .option('-n, --lines <n>', '读取最近 N 行', parseInt)
    .action(run(program, options, async (opts) => managers(opts).hooks.tailLog(opts.lines)));
  return hook;
}

function buildAgentCommand(program: Command, options: BuildCliOptions): Command {
  const agent = new Command('agent').description('Agent 心跳管理');
  agent.command('register')
    .option('--id <agent_id>', 'Agent ID；省略时自动生成')
    .option('--client <client>', '客户端名称，例如 codex/claude-code/cursor')
    .action(run(program, options, async (opts) => managers(opts).agents.register({
      agent_id: opts.id,
      client: opts.client,
    })));
  agent.command('heartbeat')
    .requiredOption('--id <agent_id>', 'Agent ID')
    .action(run(program, options, async (opts) => managers(opts).agents.heartbeat(opts.id)));
  agent.command('list')
    .action(run(program, options, async (opts) => managers(opts).agents.list()));
  agent.command('unregister')
    .requiredOption('--id <agent_id>', 'Agent ID')
    .action(run(program, options, async (opts) => managers(opts).agents.unregister({ agent_id: opts.id })));
  return agent;
}

function buildErrorCommand(program: Command, options: BuildCliOptions): Command {
  const error = new Command('error').description('Errorbook 管理');
  error.command('record')
    .requiredOption('--symptom <text>', '症状')
    .requiredOption('--root-cause <text>', '根因')
    .requiredOption('--fix-action <text>', '修复动作')
    .option('--scope <scope>', 'global 或 scene:{id}', 'global')
    .option('--verification <text>', '验证证据')
    .option('--tags <tags...>', '可选：标签（与 MCP error_record 对等）')
    .action(run(program, options, async (opts) => managers(opts).errors.record({
      symptom: opts.symptom,
      root_cause: opts.rootCause,
      fix_action: opts.fixAction,
      scope: normalizeScope(opts.scope),
      verification: opts.verification,
      tags: opts.tags,
    })));
  error.command('search')
    .argument('<query>', '关键词')
    .option('--scope <scope>', 'global 或 scene:{id}', 'global')
    .action(run(program, options, async (opts, query: string) => managers(opts).errors.search({ query, scope: normalizeScope(opts.scope) })));
  error.command('promote')
    .argument('<id>', '错误 ID')
    .option('--scope <scope>', 'global 或 scene:{id}', 'global')
    .requiredOption('--verification <text>', '验证证据')
    .action(run(program, options, async (opts, id: string) => managers(opts).errors.promote({ id, scope: normalizeScope(opts.scope), verification: opts.verification })));
  return error;
}

function buildMemoryCommand(program: Command, options: BuildCliOptions): Command {
  const memory = new Command('memory').description('Memory 管理');
  memory.command('save')
    .requiredOption('--category <category>', '分类')
    .requiredOption('--content <content>', '内容')
    .requiredOption('--source <source>', '来源')
    .option('--scope <scope>', 'global 或 scene:{id}', 'global')
    .action(run(program, options, async (opts) => managers(opts).memories.save({
      category: opts.category,
      content: opts.content,
      source: opts.source,
      scope: normalizeScope(opts.scope),
    })));
  memory.command('search')
    .argument('<query>', '关键词')
    .option('--category <category>', '分类')
    .option('--scope <scope>', 'global 或 scene:{id}', 'global')
    .action(run(program, options, async (opts, query: string) => managers(opts).memories.search({
      query,
      category: opts.category,
      scope: normalizeScope(opts.scope),
    })));
  memory.command('forget')
    .argument('<id>', '记忆 ID')
    .requiredOption('--category <category>', '分类')
    .option('--scope <scope>', 'global 或 scene:{id}', 'global')
    .action(run(program, options, async (opts, id: string) => managers(opts).memories.forget({
      id,
      category: opts.category,
      scope: normalizeScope(opts.scope),
    })));
  return memory;
}

function buildGateCommand(program: Command, options: BuildCliOptions): Command {
  const gate = new Command('gate').description('Gate 检查');
  gate.command('check')
    .requiredOption('--scene <scene>', 'Scene 标识')
    .requiredOption('--spec <spec>', 'Spec 标识')
    .requiredOption('--gate <gate>', 'creation|ready|completion')
    .action(run(program, options, async (opts) => {
      const result = await managers(opts).gates.check(opts.gate, { scene: opts.scene, spec: opts.spec });
      // CLI/MCP 对等：gate followup（含 ready 的需求审核门）走共享 GateGuidance，CLI 也显示。
      return { ok: true, data: result, ai_followup: buildGateFollowup(result, opts.gate, opts.scene, opts.spec) };
    }));
  return gate;
}

function buildDoctorCommand(program: Command, options: BuildCliOptions): Command {
  return new Command('doctor')
    .description('工作区自检')
    .option('--fix', 'M1 不自动修复，只输出建议')
    .option('--migrate-todos', '把旧模板 TODO 占位精确迁移为 <!-- FILL: ... --> 哨兵')
    .option('--migrate-summaries', '删除旧式目录级摘要文件 .abstract.md / .overview.md')
    .option('--gc-agents', '显式清理已判 dead 且名下无未过期 claim 的 agent 记录')
    .action(run(program, options, async (opts) => {
      const doctor = managers(opts).doctor;
      const actions = [opts.migrateTodos, opts.migrateSummaries, opts.gcAgents].filter(Boolean).length;
      if (actions > 1) {
        throw new LrnevError(ErrorCode.INVALID_INPUT, 'doctor 维护动作一次只能选择一种', {
          field: 'migrate',
          hint: '分别运行 --migrate-todos、--migrate-summaries 或 --gc-agents。',
        });
      }
      if (opts.migrateTodos) return doctor.migrateTodosToSentinels();
      if (opts.migrateSummaries) return doctor.migrateLegacySummaries();
      if (opts.gcAgents) return doctor.gcAgents();
      return doctor.diagnose();
    }));
}

function buildSearchCommand(program: Command, options: BuildCliOptions): Command {
  return new Command('search')
    .description('context 搜索')
    .argument('<query>', '关键词')
    .option('--scope <scope>', 'global 或 scene:{id}', 'global')
    .option('--max-depth <n>', '最大深度', parseInt)
    .action(run(program, options, async (opts, query: string) => managers(opts).searcher.search({
      query,
      scope: normalizeScope(opts.scope),
      max_depth: opts.maxDepth,
    })));
}

function buildStatusCommand(program: Command, options: BuildCliOptions): Command {
  return new Command('status')
    .description('综合状态视图')
    .option('--scene <scene>', '可选：只返回指定 Scene 的状态')
    .action(run(program, options, async (opts) => managers(opts).projectStatus.get({ scene: opts.scene })));
}

function buildMapCommand(program: Command, options: BuildCliOptions): Command {
  return new Command('map')
    .description('治理地图：scene→spec(状态/L0)→锚点标题 的压缩全景')
    .action(run(program, options, async (opts) => managers(opts).governanceMap.build()));
}

function buildReportCommand(program: Command, options: BuildCliOptions): Command {
  return new Command('report')
    .description('治理体检：链路完整度 + validates 覆盖率 + 可执行下一步（默认 text，给人看）')
    .option('--scene <scene>', '只体检指定 scene')
    .option('--release-notes', '输出已完成工作的 release notes 草稿')
    .option('--md', '以 markdown 输出到 stdout')
    .option('--out <path>', '把当前格式落盘到指定路径（不给则打印到 stdout）')
    .action(async (...args: unknown[]) => {
      const tail = args.at(-1);
      const localOpts = isCommandActionTail(tail) ? tail.opts() : tail;
      const opts = { ...program.opts<CliGlobals>(), ...(isRecord(localOpts) ? localOpts : {}) } as CliActionOptions;
      try {
        if (opts.md && opts.json) {
          throw new LrnevError(ErrorCode.INVALID_INPUT, '--md 与 --json 互斥，只能选一种输出格式', {
            field: 'md',
            hint: '去掉 --md 或 --json 其中之一。',
          });
        }
        const res = await managers(opts).governanceReport.build({
          scene: opts.scene,
          releaseNotes: opts.releaseNotes,
        });
        const rendered = opts.json
          ? format(res)
          : opts.md
            ? renderReportMarkdown(res.data)
            : renderReportText(res.data);
        if (opts.out) {
          await writeFile(opts.out, rendered, 'utf-8');
          write(options, `已写入 ${opts.out}\n`);
        } else {
          write(options, rendered.endsWith('\n') ? rendered : `${rendered}\n`);
        }
        // report 是"给人看的分红"，不是 gate：有债也 exit 0，只有真错误（如 --out 写入失败）才非零。
      } catch (err) {
        writeErr(options, formatError(err));
        process.exitCode = 1;
      }
    });
}

/** 人类可读的 text 体检单（CLI 首个非 JSON 输出）。 */
export function renderReportText(data: GovernanceReportResult): string {
  const L: string[] = [];
  const sub = (title: string): string => `━━ ${title} ${'━'.repeat(Math.max(4, 46 - title.length))}`;
  const date = data.generated_at.slice(0, 10);
  const scope = data.scope === 'all' ? '全部 scene' : data.scope;
  L.push(`lrnev 治理体检 · ${scope}    ${date}`);
  L.push('');

  // ① 链路完整度
  L.push(sub('① 链路完整度'));
  L.push(`  Scene ${data.chain.scene_count}   Spec ${data.chain.spec_count}   Task ${data.chain.task_count}`);
  if (data.chain.scenes.length > 0) {
    L.push('');
    for (const s of data.chain.scenes) {
      L.push(`  ${s.name}    spec ${s.spec_count}  task ${s.task_count}${s.empty ? '  (空)' : ''}`);
    }
  }
  if (data.chain.unclosed.length > 0) {
    L.push('');
    L.push(`  做完没收口 (${data.chain.unclosed.length}):`);
    for (const u of data.chain.unclosed) {
      L.push(`      · ${u.scene}/${u.spec}  (${u.done}/${u.total} done, status=${u.status})`);
      if (u.next_action) L.push(`        → ${u.next_action}`);
    }
  }
  if (data.chain.failed_tasks.length > 0) {
    L.push('');
    L.push(`  失败任务 (${data.chain.failed_tasks.length}):`);
    for (const t of data.chain.failed_tasks) {
      L.push(`      · ${t.scene}/${t.spec} ${t.id} ${t.title}`);
      if (t.next_action) L.push(`        → ${t.next_action}`);
    }
  }
  if (data.chain.blocked_tasks.length > 0) {
    L.push('');
    L.push(`  阻塞任务 (${data.chain.blocked_tasks.length}):`);
    for (const t of data.chain.blocked_tasks) {
      L.push(`      · ${t.scene}/${t.spec} ${t.id} ${t.title}`);
      if (t.next_action) L.push(`        → ${t.next_action}`);
    }
  }
  L.push('');

  // ② validates 覆盖率
  L.push(sub('② validates 覆盖率'));
  const pct = (data.coverage.coverage_ratio * 100).toFixed(1);
  L.push(`  锚点 ${data.coverage.anchor_total}   已验证 ${data.coverage.anchor_covered}   覆盖率 ${pct}%`);
  if (data.coverage.debt_orphans.length > 0) {
    L.push('');
    L.push(`  孤儿锚点·真欠债 (${data.coverage.debt_orphans.length}，已收口 spec 却没人验证):`);
    for (const g of data.coverage.debt_orphans) {
      L.push(`      · ${g.scene}/${g.spec}  ${g.anchors.join('、')}`);
      if (g.next_action) L.push(`        → ${g.next_action}`);
    }
  }
  if (data.coverage.in_flight_orphans.length > 0) {
    const n = data.coverage.in_flight_orphans.reduce((sum, g) => sum + g.anchors.length, 0);
    L.push('');
    L.push(`  孤儿锚点·在途 (${n}，正常，待拆 task)`);
  }
  if (data.coverage.broken_validates.length > 0) {
    L.push('');
    L.push(`  坏 validates (${data.coverage.broken_validates.length})：指向不存在/废弃锚点，不计覆盖率`);
    for (const b of data.coverage.broken_validates) {
      L.push(`      · ${b.scene}/${b.spec} ${b.task}  ${b.anchors.join('、')}`);
    }
  }
  if (data.coverage.archived_excluded > 0) {
    L.push('');
    L.push(`  (已排除 ${data.coverage.archived_excluded} 个 archived spec)`);
  }

  // release notes（可选段）
  if (data.release_notes) {
    L.push('');
    L.push(sub('③ release notes 草稿'));
    if (data.release_notes.scenes.length === 0) {
      L.push('  （暂无已完成的 spec/task）');
    } else {
      for (const scene of data.release_notes.scenes) {
        for (const spec of scene.specs) {
          L.push(`  ${scene.name} / ${spec.name}`);
          for (const t of spec.tasks) L.push(`      - ${t}`);
        }
      }
    }
  }

  // 收口
  L.push('');
  L.push('━'.repeat(50));
  L.push(`  ${data.headline}`);
  for (const w of data.warnings ?? []) L.push(`  注意：${w}`);
  return L.join('\n');
}

/** markdown 体检单（供 --md，贴 PR / release notes 用）。 */
export function renderReportMarkdown(data: GovernanceReportResult): string {
  const L: string[] = [];
  const scope = data.scope === 'all' ? '全部 scene' : data.scope;
  L.push(`# lrnev 治理体检 · ${scope}`);
  L.push('');
  L.push(`> ${data.generated_at.slice(0, 10)} · ${data.headline}`);
  for (const w of data.warnings ?? []) L.push(`>`, `> 注意：${w}`);
  L.push('');

  L.push('## ① 链路完整度');
  L.push('');
  L.push(`- Scene ${data.chain.scene_count} · Spec ${data.chain.spec_count} · Task ${data.chain.task_count}`);
  if (data.chain.unclosed.length > 0) {
    L.push('');
    L.push(`### 做完没收口 (${data.chain.unclosed.length})`);
    for (const u of data.chain.unclosed) {
      L.push(`- **${u.scene}/${u.spec}** (${u.done}/${u.total} done, status=${u.status})`);
      if (u.next_action) L.push(`  - → ${u.next_action}`);
    }
  }
  if (data.chain.failed_tasks.length > 0) {
    L.push('');
    L.push(`### 失败任务 (${data.chain.failed_tasks.length})`);
    for (const t of data.chain.failed_tasks) {
      L.push(`- ${t.scene}/${t.spec} \`${t.id}\` ${t.title}`);
      if (t.next_action) L.push(`  - → ${t.next_action}`);
    }
  }
  if (data.chain.blocked_tasks.length > 0) {
    L.push('');
    L.push(`### 阻塞任务 (${data.chain.blocked_tasks.length})`);
    for (const t of data.chain.blocked_tasks) {
      L.push(`- ${t.scene}/${t.spec} \`${t.id}\` ${t.title}`);
    }
  }
  L.push('');

  L.push('## ② validates 覆盖率');
  L.push('');
  const pct = (data.coverage.coverage_ratio * 100).toFixed(1);
  L.push(`- 锚点 ${data.coverage.anchor_total} · 已验证 ${data.coverage.anchor_covered} · 覆盖率 **${pct}%**`);
  if (data.coverage.debt_orphans.length > 0) {
    L.push('');
    L.push(`### 孤儿锚点·真欠债 (${data.coverage.debt_orphans.length})`);
    for (const g of data.coverage.debt_orphans) {
      L.push(`- ${g.scene}/${g.spec}: ${g.anchors.join('、')}`);
      if (g.next_action) L.push(`  - → ${g.next_action}`);
    }
  }
  if (data.coverage.broken_validates.length > 0) {
    L.push('');
    L.push(`### 坏 validates (${data.coverage.broken_validates.length})`);
    for (const b of data.coverage.broken_validates) {
      L.push(`- ${b.scene}/${b.spec} \`${b.task}\`: ${b.anchors.join('、')}`);
    }
  }

  if (data.release_notes) {
    L.push('');
    L.push('## ③ release notes 草稿');
    if (data.release_notes.scenes.length === 0) {
      L.push('');
      L.push('_（暂无已完成的 spec/task）_');
    } else {
      for (const scene of data.release_notes.scenes) {
        for (const spec of scene.specs) {
          L.push('');
          L.push(`### ${scene.name} / ${spec.name}`);
          for (const t of spec.tasks) L.push(`- ${t}`);
        }
      }
    }
  }
  return L.join('\n');
}

function run<Args extends unknown[]>(
  program: Command,
  options: BuildCliOptions,
  fn: (opts: CliActionOptions, ...args: Args) => Promise<unknown>,
): (...args: unknown[]) => Promise<void> {
  return async (...args: unknown[]) => {
    const tail = args.at(-1);
    const localOpts = isCommandActionTail(tail) ? tail.opts() : tail;
    const opts = { ...program.opts<CliGlobals>(), ...(isRecord(localOpts) ? localOpts : {}) } as CliActionOptions;
    try {
      const positional = isCommandActionTail(tail) || isRecord(tail) ? args.slice(0, -1) : args;
      const result = await fn(opts, ...(positional as Args));
      write(options, format(result));
    } catch (err) {
      writeErr(options, formatError(err));
      process.exitCode = 1;
    }
  };
}

function managers(opts: CliGlobals): ReturnType<typeof createManagers> {
  const root = opts.workspace ?? resolveWorkspaceRoot().root;
  return createManagers(root);
}

function createManagers(root: string) {
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

function withTaskListFollowup<T>(tasks: T[]): { ok: true; data: T[]; ai_followup: { instructions: string[] } } {
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

function normalizeTaskTitle(title: string | undefined, parsedArgs: string[]): string {
  const argTitle = parsedArgs.at(0);
  return argTitle ?? title ?? '';
}

async function readMemoryCandidates(filePath?: string): Promise<MemoryCandidate[]> {
  const raw = filePath && filePath.trim().length > 0
    ? await readFile(filePath, 'utf-8')
    : await readStdin();
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed)) return parsed as MemoryCandidate[];
  if (Array.isArray((parsed as Partial<SessionCommitInput>).candidates)) {
    return (parsed as Partial<SessionCommitInput>).candidates as MemoryCandidate[];
  }
  throw new LrnevError(ErrorCode.INVALID_INPUT, 'session commit candidates 必须是数组，或包含 candidates 数组字段的 JSON 对象', {
    field: 'candidates',
    hint: '传入 JSON 数组，或形如 {"candidates":[...]} 的 JSON 对象。',
  });
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf-8');
}

function normalizeScope(scope: string | undefined): Scope {
  if (!scope || scope === 'global') return 'global';
  return scope as Scope;
}

function format(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function formatError(err: unknown): string {
  const payload = isLrnevError(err)
    ? { ok: false, errors: [err.toErrorInfo()] }
    : { ok: false, errors: [{ code: 'INTERNAL_ERROR', message: err instanceof Error ? err.message : String(err) }] };
  return format(payload);
}

function write(options: BuildCliOptions, text: string): void {
  if (options.writeOut) options.writeOut(text);
  else process.stdout.write(text);
}

function writeErr(options: BuildCliOptions, text: string): void {
  if (options.writeErr) options.writeErr(text);
  else process.stderr.write(text);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isCommandActionTail(value: unknown): value is { opts: () => Record<string, unknown> } {
  return isRecord(value) && typeof value.opts === 'function';
}

function isGuideTopic(value: string): value is GuideTopic {
  return (GUIDE_TOPIC_VALUES as readonly string[]).includes(value);
}

void MemoryCategory;
