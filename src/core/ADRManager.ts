/**
 * ADRManager —— 架构决策记录管理。
 *
 * ADR 是“需要用户确认的决策记录”，由 AI 判断是否需要，create 才真正写文件。
 * 全局 ADR 与 Scene ADR 的编号各自独立递增，文件系统仍是唯一事实来源。
 */

import { parseDocument } from '../storage/MarkdownParser.js';
import { parseFrontmatter, serializeFrontmatter } from '../storage/FrontmatterCodec.js';
import { FileStorage } from '../storage/FileStorage.js';
import { formatAdrNumber } from '../storage/URIRouter.js';
import { LrnevError, ErrorCode } from '../shared/errors.js';
import { renderTemplate, today } from './Templates.js';
import { SceneManager } from './SceneManager.js';
import { appendHookWarnings, getHookManager } from './HookManager.js';
import type {
  ADR,
  ADRBody,
  ADRFrontmatter,
  CreateADRInput,
} from '../types/adr.js';
import type { AiFollowupResponse, Scope } from '../types/response.js';
import type { ParsedDocument } from '../storage/MarkdownParser.js';

export class ADRManager {
  constructor(
    private readonly fs: FileStorage,
    private readonly scenes: SceneManager,
  ) {}

  async create(input: CreateADRInput): Promise<AiFollowupResponse<ADR>> {
    const title = input.title.trim();
    if (!title) {
      throw new LrnevError(ErrorCode.INVALID_INPUT, 'ADR title 不能为空', { field: 'title' });
    }
    // S5 复核修复: supersedes 写入前按正整数校验并归一化为四位编号，
    // 否则 'ADR-1'/空格等会静默落盘且 superseded_by 永远反算不到。
    const supersedes = input.supersedes?.map((raw) => {
      const trimmed = raw.trim();
      if (!/^\d+$/.test(trimmed) || parseInt(trimmed, 10) <= 0) {
        throw new LrnevError(ErrorCode.INVALID_INPUT, `supersedes 编号不合法：\"${raw}\"`, {
          field: 'supersedes',
          hint: '使用正整数 ADR 编号，例如 1 或 0001。',
        });
      }
      return formatAdrNumber(parseInt(trimmed, 10));
    });
    input = { ...input, ...(supersedes && { supersedes }) };
    const scope = await this.resolveScope(input.scope);
    const dir = this.dirForScope(scope);
    const number = await this.nextNumber(dir);
    const numberPadded = formatAdrNumber(number);
    const slug = slugify(title);
    const path = `${dir}/${numberPadded}-${slug}.md`;

    if (this.fs.exists(path)) {
      throw new LrnevError(ErrorCode.ADR_NUMBER_CONFLICT, `ADR 编号冲突：${numberPadded}`, {
        field: 'number',
      });
    }

    const content = await this.renderADR(input, scope, numberPadded);
    await this.fs.write(path, content);
    await this.updateIndex(scope);

    const adr = await this.get(scope, String(number));
    const hookResult = await getHookManager(this.fs.root).trigger('adr.create', {
      scope,
      number: adr.number,
      title: adr.title,
      path: adr.path,
    });

    return appendHookWarnings({
      ok: true,
      data: adr,
      ai_followup: {
        instructions: [
          `ADR ${numberPadded} 已创建：${path}`,
          '请检查 context / decision / alternatives / consequences 是否完整。',
          '如果这个决策影响 Scene 或 Spec，请在相关文档中引用该 ADR。',
        ],
        suggested_tools: [
          {
            name: 'summarize_save',
            args_template: {
              uri: this.uriForADR(scope, number),
              l0: '<一句话决策摘要>',
              l1: '<决策背景、结论、影响概览>',
            },
            reason: '生成 ADR 摘要后便于后续按 L0/L1 读取',
          },
        ],
      },
    }, hookResult.warnings);
  }

  async list(scope: Scope = 'global'): Promise<ADR[]> {
    const resolvedScope = await this.resolveScope(scope);
    return attachSupersededBy(await this.readAllInScope(resolvedScope));
  }

  async get(scope: Scope, input: string): Promise<ADR> {
    const resolvedScope = await this.resolveScope(scope);
    const file = await this.resolveADRPath(resolvedScope, input);
    const target = await this.readOne(file, resolvedScope);
    // I-17: superseded_by 是读时派生（需同 scope 全量 supersedes 的反向视角），不回写任何文件。
    const all = attachSupersededBy(await this.readAllInScope(resolvedScope));
    return all.find((adr) => adr.number === target.number) ?? target;
  }

  /** 读取 scope 下全部 ADR（不含派生字段）。 */
  private async readAllInScope(resolvedScope: Scope): Promise<ADR[]> {
    const dir = this.dirForScope(resolvedScope);
    const files = await this.fs.list(`${dir}/*.md`);
    const adrs: ADR[] = [];
    for (const file of files.filter((f) => /\/\d{4}-.+\.md$/.test(f)).sort()) {
      if (!/^.*\/(\d{4})-.+\.md$/.test(file)) continue;
      adrs.push(await this.readOne(file, resolvedScope));
    }
    return adrs;
  }

  /** 读取单个 ADR 文件（原 get 本体）。 */
  private async readOne(file: string, resolvedScope: Scope): Promise<ADR> {
    const content = await this.fs.read(file);
    const parsed = parseDocument<ADRFrontmatter>(content);
    const fm = parsed.frontmatter;
    const body: ADRBody = {
      context: section(parsed, '背景'),
      decision: section(parsed, '决策'),
      alternatives: section(parsed, '备选方案')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean),
      consequences: section(parsed, '后果'),
    };

    return {
      number: fm.number ?? /^.*\/(\d{4})-.+\.md$/.exec(file)?.[1] ?? '0000',
      title: fm.title ?? extractTitle(content),
      status: fm.status ?? 'proposed',
      scope: fm.scope ?? resolvedScope,
      created: fm.created ?? today(),
      date: fm.date ?? fm.created ?? today(),
      ...(fm.supersedes && { supersedes: fm.supersedes }),
      path: this.fs.abs(file),
      body,
    };
  }

  private async resolveScope(scope: Scope): Promise<Scope> {
    if (scope === 'global') return 'global';
    if (scope.startsWith('scene:')) {
      const sceneId = await this.scenes.resolveId(scope.slice('scene:'.length));
      return `scene:${sceneId}`;
    }
    throw new LrnevError(ErrorCode.INVALID_INPUT, `scope 不合法：${scope}`, { field: 'scope' });
  }

  private dirForScope(scope: Scope): string {
    if (scope === 'global') return '.lrnev/decisions/adr';
    return `.lrnev/scenes/${scope.slice('scene:'.length)}/decisions/adr`;
  }

  private async nextNumber(dir: string): Promise<number> {
    const files = await this.fs.list(`${dir}/*.md`);
    let max = 0;
    for (const file of files) {
      const n = /\/(\d{4})-.+\.md$/.exec(file)?.[1];
      if (n) max = Math.max(max, parseInt(n, 10));
    }
    return max + 1;
  }

  private async resolveADRPath(scope: Scope, input: string): Promise<string> {
    const dir = this.dirForScope(scope);
    const number = parseInt(input, 10);
    if (!Number.isInteger(number) || number <= 0) {
      throw new LrnevError(ErrorCode.INVALID_INPUT, `ADR 编号必须是正整数：${input}`, {
        field: 'number',
      });
    }
    const prefix = formatAdrNumber(number);
    const matches = await this.fs.list(`${dir}/${prefix}-*.md`);
    if (matches.length === 1) return matches[0]!;
    if (matches.length > 1) {
      throw new LrnevError(ErrorCode.ADR_NUMBER_CONFLICT, `ADR 编号冲突：${prefix}`, {
        field: 'number',
      });
    }
    throw new LrnevError(ErrorCode.FILE_NOT_FOUND, `ADR ${prefix} 不存在`, {
      field: 'number',
      hint: '先调用 adr_list 查看现有 ADR 编号；若需要记录新决策，请调用 adr_create。',
    });
  }

  private async renderADR(input: CreateADRInput, scope: Scope, numberPadded: string): Promise<string> {
    const date = today();
    const base = await renderTemplate('adr', 'adr.md', {
      number_padded: numberPadded,
      title: input.title.trim(),
      scope,
      date,
    });
    const parsed = parseFrontmatter<ADRFrontmatter>(base);
    const frontmatter: ADRFrontmatter = {
      ...parsed.frontmatter,
      number: numberPadded,
      title: input.title.trim(),
      status: 'proposed',
      scope,
      created: date,
      date,
      ...(input.supersedes && { supersedes: input.supersedes }),
    };
    const alternatives = input.alternatives?.length
      ? input.alternatives.map((item) => `- ${item}`).join('\n')
      : '- 无明确备选方案';
    const body = [
      `# ${numberPadded}. ${input.title.trim()}`,
      '',
      '## 状态',
      '',
      'proposed',
      '',
      '## 背景',
      '',
      input.context.trim(),
      '',
      '## 决策',
      '',
      input.decision.trim(),
      '',
      '## 备选方案',
      '',
      alternatives,
      '',
      '## 后果',
      '',
      input.consequences?.trim() || '待补充',
      '',
      '## 参考',
      '',
      '- 待补充',
    ].join('\n');
    return serializeFrontmatter(frontmatter as unknown as Record<string, unknown>, body);
  }

  private async updateIndex(scope: Scope): Promise<void> {
    const dir = this.dirForScope(scope);
    const items = await this.list(scope);
    const title = scope === 'global' ? '全局 ADR 索引' : `${scope} ADR 索引`;
    const lines = [`# ${title}`, '', `更新时间：${today()}`, ''];
    if (items.length === 0) {
      lines.push('暂无 ADR。');
    } else {
      for (const item of items) {
        const rel = `${item.number}-${slugify(item.title)}.md`;
        lines.push(`- [${item.number}. ${item.title}](${rel}) - ${item.status}`);
      }
    }
    await this.fs.write(`${dir}/README.md`, lines.join('\n') + '\n');
  }

  private uriForADR(scope: Scope, number: number): string {
    if (scope === 'global') return `context://adr/${number}`;
    return `context://scene/${scope.slice('scene:'.length)}/adr/${number}`;
  }
}

function section<T>(doc: ParsedDocument<T>, title: string): string {
  return doc.sections.find((s) => s.title === title)?.content ?? '';
}

/** I-17: 基于全量 supersedes 反向计算每条 ADR 的 superseded_by（读时派生，不改文件）。 */
function attachSupersededBy(adrs: ADR[]): ADR[] {
  const byNumber = new Map<string, string[]>();
  for (const adr of adrs) {
    for (const old of adr.supersedes ?? []) {
      const key = old.padStart(4, '0');
      byNumber.set(key, [...(byNumber.get(key) ?? []), adr.number]);
    }
  }
  return adrs.map((adr) => {
    const by = byNumber.get(adr.number);
    return by && by.length > 0 ? { ...adr, superseded_by: by } : adr;
  });
}

function slugify(title: string): string {
  const ascii = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return ascii || 'decision';
}

function extractTitle(content: string): string {
  return /^#\s+(?:\d{4}\.\s*)?(.+)$/m.exec(content)?.[1]?.trim() ?? 'Untitled ADR';
}
