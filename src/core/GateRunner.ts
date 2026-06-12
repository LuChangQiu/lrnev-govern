/**
 * GateRunner 执行确定性的 Spec 流程门禁。
 *
 * creation / ready / completion 只核对文件结构、模板哨兵和 Task 状态；
 * 需求质量和实现判断仍交给 AI 与用户，不在这里调用 LLM 或读取源码。
 */

import { FileStorage } from '../storage/FileStorage.js';
import { parseFrontmatter } from '../storage/FrontmatterCodec.js';
import { extractCodeRanges, inRanges } from '../storage/MarkdownParser.js';
import { LrnevError, ErrorCode } from '../shared/errors.js';
import { findLegacyTodoPlaceholders } from './LegacyTodoMigration.js';
import { SceneManager } from './SceneManager.js';
import { SpecManager } from './SpecManager.js';
import { TaskManager } from './TaskManager.js';
import { getHookManager } from './HookManager.js';
import type { GateCheck, GateCheckInput, GateResult, GateType, LocatedLine } from '../types/gate.js';
import type { SpecFrontmatter } from '../types/spec.js';
import type { Task } from '../types/task.js';

const REQUIRED_REQUIREMENTS_SECTIONS = [
  'L0 摘要',
  'L1 概览',
  'L2 详情',
  '范围',
  '详细需求',
  '验收标准',
];

export class GateRunner {
  constructor(
    private readonly fs: FileStorage,
    private readonly sceneManager: SceneManager,
    private readonly specManager: SpecManager,
    private readonly taskManager: TaskManager,
  ) {}

  async check(gate: GateType, input: GateCheckInput): Promise<GateResult> {
    switch (gate) {
      case 'creation':
        return this.checkCreation(input);
      case 'ready':
        return this.checkReady(input);
      case 'completion':
        return this.checkCompletion(input);
    }
  }

  async checkCreation(input: GateCheckInput): Promise<GateResult> {
    return (await this.checkCreationDetails(input)).result;
  }

  async checkReady(input: GateCheckInput): Promise<GateResult> {
    const creation = await this.checkCreationDetails(input);
    const checks = [...creation.result.checks];

    if (creation.content !== undefined) {
      // ready gate 只检查结构契约；正文里的业务判断不在 lrnev 内裁决。
      const missingSections = findMissingSections(creation.content, REQUIRED_REQUIREMENTS_SECTIONS);
      checks.push({
        name: 'requirements_sections_present',
        passed: missingSections.length === 0,
        hard_fail: true,
        ...(missingSections.length > 0 && {
          message: `requirements.md 缺少必填章节：${missingSections.join(', ')}`,
          hint: '章节标题必须与模板完全一致（中文原文：L0 摘要 / L1 概览 / L2 详情 / 范围 / 详细需求 / 验收标准），不要翻译或改名——缺失或被改名都会判失败。',
        }),
      });

      const sentinels = findFillSentinels(creation.content);
      checks.push({
        name: 'requirements_no_fill_sentinels',
        passed: sentinels.length === 0,
        hard_fail: true,
        ...(sentinels.length > 0 && {
          message: `requirements.md 仍有未填哨兵：${sentinels
            .slice(0, 5)
            .map((item) => `L${item.line}`)
            .join(', ')}`,
          hint: '把 <!-- FILL: ... --> 替换为具体内容；旧 TODO 占位可先运行 lrnev doctor --migrate-todos',
        }),
      });

      const legacyTodos = findLegacyTodoPlaceholders(creation.content);
      checks.push({
        name: 'requirements_no_legacy_todo_placeholders',
        passed: legacyTodos.length === 0,
        hard_fail: true,
        ...(legacyTodos.length > 0 && {
          message: `requirements.md 仍有旧 TODO 模板占位：${legacyTodos
            .slice(0, 5)
            .map((item) => `L${item.line}`)
            .join(', ')}`,
          hint: '先运行 lrnev doctor --migrate-todos 把旧模板 TODO 占位迁移为 <!-- FILL: ... -->',
        }),
      });

      const unchecked = findUncheckedItems(creation.content);
      checks.push({
        name: 'requirements_acceptance_checked',
        passed: unchecked.length === 0,
        hard_fail: false,
        ...(unchecked.length > 0 && {
          message: `requirements.md 仍有未勾选清单项：${unchecked
            .slice(0, 5)
            .map((item) => `L${item.line}`)
            .join(', ')}`,
          hint: '确认验收清单已完成后，把 - [ ] 改为 - [x]',
        }),
      });
    }

    const result = buildResult('ready', checks);
    if (result.passed) {
      const hookResult = await getHookManager(this.fs.root).trigger('spec.gate_passed.ready', {
        scene: creation.sceneId,
        spec: creation.specId,
        gate: 'ready',
      });
      appendHookWarningCheck(result.checks, hookResult.warnings);
    }
    return result;
  }

  async checkCompletion(input: GateCheckInput): Promise<GateResult> {
    const creationDetails = await this.checkCreationDetails(input);
    const checks = [...creationDetails.result.checks];

    let tasks: Task[];
    try {
      tasks = await this.taskManager.list(input.scene, input.spec);
      checks.push({
        name: 'tasks_readable',
        passed: true,
        hard_fail: true,
      });
    } catch (err) {
      checks.push({
        name: 'tasks_readable',
        passed: false,
        hard_fail: true,
        message: `tasks.md 读取或解析失败：${err instanceof Error ? err.message : String(err)}`,
        hint: '检查 tasks.md 结构，必要时运行 lrnev doctor',
      });
      return buildResult('completion', checks);
    }

    checks.push({
      name: 'tasks_exist',
      passed: tasks.length > 0,
      hard_fail: true,
      ...(tasks.length === 0 && {
        message: 'Spec 内没有任何 Task',
        hint: '先调用 task_create 或补齐 tasks.md',
      }),
    });

    const incomplete = tasks.filter((task) => task.status !== 'completed');
    checks.push({
      name: 'all_tasks_completed',
      passed: tasks.length > 0 && incomplete.length === 0,
      hard_fail: true,
      ...(incomplete.length > 0 && {
        message: `仍有未完成 Task：${incomplete.map((task) => `${task.id}:${task.status}`).join(', ')}`,
        hint: '完成所有 Task 后再检查 completion gate',
      }),
    });

    // I-4: completion 硬拦 requirements/design 残留 FILL 哨兵。
    // FILL 是确定性结构事实（非语义判断），用精确的 findFillSentinels（已排除代码块/正文里的 FILL 词）。
    // 不查 tasks.md：其模板自带 FILL（task_create 只追加任务、不替换占位）。
    if (creationDetails.content !== undefined) {
      const reqFill = findFillSentinels(creationDetails.content);
      checks.push({
        name: 'requirements_no_fill',
        passed: reqFill.length === 0,
        hard_fail: true,
        ...(reqFill.length > 0 && {
          message: `requirements.md 仍有未填哨兵：${reqFill.slice(0, 5).map((s) => `L${s.line}`).join(', ')}`,
          hint: '把 <!-- FILL: ... --> 替换为具体内容后再检查 completion',
        }),
      });
    }

    const designPath = `.lrnev/scenes/${creationDetails.sceneId}/specs/${creationDetails.specId}/design.md`;
    if (this.fs.exists(designPath)) {
      const designFill = findFillSentinels(await this.fs.read(designPath));
      checks.push({
        name: 'design_no_fill',
        passed: designFill.length === 0,
        hard_fail: true,
        ...(designFill.length > 0 && {
          message: `design.md 仍有未填哨兵：${designFill.slice(0, 5).map((s) => `L${s.line}`).join(', ')}`,
          hint: '把 design.md 的 <!-- FILL: ... --> 替换为具体内容后再检查 completion',
        }),
      });
    }

    const result = buildResult('completion', checks);
    if (result.passed) {
      const { sceneId, specId } = await this.resolveSpecPaths(input);
      const hookResult = await getHookManager(this.fs.root).trigger('spec.gate_passed.completion', {
        scene: sceneId,
        spec: specId,
        gate: 'completion',
      });
      appendHookWarningCheck(result.checks, hookResult.warnings);
    }
    return result;
  }

  private async checkCreationDetails(input: GateCheckInput): Promise<{
    result: GateResult;
    sceneId: string;
    specId: string;
    reqPath: string;
    content?: string;
  }> {
    const checks: GateCheck[] = [];
    const { sceneId, specId, reqPath } = await this.resolveSpecPaths(input);
    const exists = this.fs.exists(reqPath);

    checks.push({
      name: 'requirements_exists',
      passed: exists,
      hard_fail: true,
      ...(!exists && {
        message: `requirements.md 不存在：${reqPath}`,
        hint: '先调用 spec_create 创建 Spec 骨架',
      }),
    });

    let content: string | undefined;
    if (exists) {
      content = await this.fs.read(reqPath);
      const parsed = parseFrontmatter<Partial<SpecFrontmatter>>(content);
      const fm = parsed.frontmatter;
      checks.push(this.checkRequiredField('frontmatter_spec', fm.spec === specId, 'spec'));
      checks.push(this.checkRequiredField('frontmatter_scene', fm.scene === sceneId, 'scene'));
      checks.push(this.checkRequiredField('frontmatter_status', typeof fm.status === 'string', 'status'));
      checks.push(this.checkRequiredField('frontmatter_created', typeof fm.created === 'string', 'created'));
    }

    return {
      result: buildResult('creation', checks),
      sceneId,
      specId,
      reqPath,
      ...(content !== undefined && { content }),
    };
  }

  private async resolveSpecPaths(input: GateCheckInput): Promise<{
    sceneId: string;
    specId: string;
    reqPath: string;
  }> {
    const sceneId = await this.sceneManager.resolveId(input.scene);
    let specId: string;
    try {
      specId = await this.specManager.resolveId(sceneId, input.spec);
    } catch (err) {
      if (err instanceof LrnevError && err.code === ErrorCode.SPEC_NOT_FOUND && /^\d+-\d+-/.test(input.spec)) {
        specId = input.spec;
      } else {
        throw err;
      }
    }
    return {
      sceneId,
      specId,
      reqPath: `.lrnev/scenes/${sceneId}/specs/${specId}/requirements.md`,
    };
  }

  private checkRequiredField(name: string, passed: boolean, field: string): GateCheck {
    return {
      name,
      passed,
      hard_fail: true,
      ...(!passed && {
        message: `requirements.md frontmatter 缺少或不匹配字段：${field}`,
        hint: `修正 requirements.md 顶部 frontmatter 的 ${field} 字段`,
      }),
    };
  }
}

function buildResult(gate: GateType, checks: GateCheck[]): GateResult {
  return {
    gate,
    passed: checks.every((check) => check.passed || !check.hard_fail),
    checks,
  };
}

function appendHookWarningCheck(checks: GateCheck[], warnings: string[]): void {
  if (warnings.length === 0) return;
  checks.push({
    name: 'hook_warnings',
    passed: false,
    hard_fail: false,
    message: warnings.join('\n'),
    hint: 'Hook 以 warn 策略失败，主流程继续；请查看 .lrnev/state/hook-log.jsonl 排查。',
  });
}

export function findFillSentinels(content: string): LocatedLine[] {
  const matches: LocatedLine[] = [];
  const codeRanges = extractCodeRanges(content);
  for (const line of iterateLines(content)) {
    const regex = /<!--\s*FILL(?::.*?)?\s*-->/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(line.text)) !== null) {
      const start = line.start + match.index;
      const end = start + match[0]!.length;
      if (inRanges(codeRanges, start, end)) continue;
      matches.push({ line: line.number, text: line.text.trim() });
      break;
    }
  }
  return matches;
}

export function findMissingSections(content: string, requiredTitles: string[]): string[] {
  const existing = collectMarkdownHeadings(content);
  return requiredTitles.filter((title) => !existing.has(title));
}

function collectMarkdownHeadings(content: string): Set<string> {
  const headings = new Set<string>();
  const codeRanges = extractCodeRanges(content);
  for (const line of iterateLines(content)) {
    if (inRanges(codeRanges, line.start, line.end)) continue;
    const match = /^(#{2,6})\s+(.+?)\s*$/.exec(line.text);
    if (match) headings.add(match[2]!.trim());
  }
  return headings;
}

export function findUncheckedItems(content: string): LocatedLine[] {
  const matches: LocatedLine[] = [];
  const codeRanges = extractCodeRanges(content);
  for (const line of iterateLines(content)) {
    const match = /^\s*[-*]\s+\[\s\]\s+/.exec(line.text);
    if (!match) continue;
    if (inRanges(codeRanges, line.start + match.index, line.start + match.index + match[0].length)) continue;
    matches.push({ line: line.number, text: line.text.trim() });
  }
  return matches;
}

function iterateLines(content: string): Array<{ number: number; text: string; start: number; end: number }> {
  const lines = content.split(/\r?\n/);
  const eols = content.match(/\r?\n/g) ?? [];
  const result: Array<{ number: number; text: string; start: number; end: number }> = [];
  let offset = 0;
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i]!;
    const start = offset;
    const end = start + text.length;
    result.push({ number: i + 1, text, start, end });
    offset = end + (eols[i]?.length ?? 0);
  }
  return result;
}
