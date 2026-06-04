/**
 * ErrorbookManager —— 错误手册管理。
 *
 * 错误先进入 incidents 暂存区；验证过修复后再 promote 到 promoted。
 * 同一 symptom + root_cause 会生成相同指纹，重复 record 时自动合并出现次数。
 */

import { createHash } from 'node:crypto';

import { FileStorage } from '../storage/FileStorage.js';
import { parseDocument } from '../storage/MarkdownParser.js';
import { serializeFrontmatter } from '../storage/FrontmatterCodec.js';
import { DEFAULT_CONFIG, loadConfig } from '../shared/config.js';
import { LrnevError, ErrorCode } from '../shared/errors.js';
import { SceneManager } from './SceneManager.js';
import { appendHookWarnings, getHookManager } from './HookManager.js';
import type {
  ErrorEntry,
  ErrorFrontmatter,
  PromoteErrorInput,
  RecordErrorInput,
  SearchErrorInput,
} from '../types/errorbook.js';
import type { AiFollowupResponse, Scope } from '../types/response.js';

export class ErrorbookManager {
  constructor(
    private readonly fs: FileStorage,
    private readonly scenes: SceneManager,
  ) {}

  async record(input: RecordErrorInput): Promise<AiFollowupResponse<ErrorEntry>> {
    this.validateRecordInput(input);
    const scope = await this.resolveScope(input.scope);
    const fingerprint = this.computeFingerprint(input.symptom, input.root_cause);
    const existingPath = await this.findByFingerprint(scope, fingerprint);
    const now = new Date().toISOString();

    let entry: ErrorEntry;
    if (existingPath) {
      entry = await this.mergeExisting(existingPath, input, now);
    } else {
      entry = await this.createIncident(scope, fingerprint, input, now);
    }
    await this.updateIndex(scope);

    const hookResult = await getHookManager(this.fs.root).trigger('error.record', {
      scope,
      id: entry.id,
      fingerprint: entry.fingerprint,
      status: entry.status,
      occurrence_count: entry.occurrence_count,
      existing: Boolean(existingPath),
    });

    return appendHookWarnings({
      ok: true,
      data: entry,
      ai_followup: {
        instructions: [
          existingPath
            ? `错误指纹 ${fingerprint} 已存在，已合并 occurrence_count。`
            : `错误已记录到 incidents：${entry.id}`,
          '修复被验证后，请调用 error_promote，并提供 verification 证据。',
          'promote 前必须补充调试/验证证据。',
        ],
        suggested_tools: [
          {
            name: 'error_promote',
            args_template: {
              id: entry.id,
              scope,
              verification: '<验证证据：测试、日志、复现步骤或提交>',
            },
            reason: '验证修复后提升为正式错误知识',
          },
        ],
      },
    }, hookResult.warnings);
  }

  async search(input: SearchErrorInput): Promise<ErrorEntry[]> {
    // 按空白/常见标点切 token，做"重叠匹配"而非整段子串：
    // 多词自然语言查询(如 "ready gate headings")才能召回；指纹/ID 是单 token，仍精确命中。
    const tokens = input.query.toLowerCase().split(/[\s,，、.。;；:：/]+/).filter(Boolean);
    if (tokens.length === 0) {
      throw new LrnevError(ErrorCode.INVALID_INPUT, 'query 不能为空', { field: 'query' });
    }
    const scope = await this.resolveScope(input.scope ?? 'global');
    const files = await this.listEntryFiles(scope);
    const scored: { entry: ErrorEntry; hits: number }[] = [];
    for (const file of files) {
      const text = (await this.fs.read(file)).toLowerCase();
      const hits = tokens.filter((token) => text.includes(token)).length;
      if (hits > 0) {
        scored.push({ entry: await this.readEntry(file), hits });
      }
    }
    // 命中 token 多的更相关；同分按最近出现时间。
    return scored
      .sort((a, b) => b.hits - a.hits || b.entry.last_seen.localeCompare(a.entry.last_seen))
      .map((item) => item.entry);
  }

  async promote(input: PromoteErrorInput): Promise<AiFollowupResponse<ErrorEntry>> {
    const scope = await this.resolveScope(input.scope ?? 'global');
    const currentPath = await this.resolveEntryPath(scope, input.id);
    const current = await this.readEntry(currentPath);
    const verification = input.verification?.trim() || current.body.verification?.trim();

    if (!verification) {
      throw new LrnevError(ErrorCode.INVALID_INPUT, 'promote 需要 verification 证据', {
        field: 'verification',
        hint: '请提供测试结果、日志、复现步骤或提交引用',
      });
    }
    const promotedPath = `${this.dirForScope(scope)}/promoted/${current.id}.md`;
    const promoted: ErrorEntry = {
      ...current,
      status: 'promoted',
      promoted_at: new Date().toISOString(),
      body: {
        ...current.body,
        verification,
      },
      path: this.fs.abs(promotedPath),
    };
    await this.fs.write(promotedPath, renderEntry(promoted));
    if (currentPath.includes('/incidents/')) {
      await this.fs.rm(currentPath);
    }
    await this.updateIndex(scope);

    return {
      ok: true,
      data: promoted,
      ai_followup: {
        instructions: [
          `错误 ${promoted.id} 已提升到 promoted。`,
          '后续遇到类似症状时，请先调用 error_search 检索错误手册。',
        ],
      },
    };
  }

  private async createIncident(
    scope: Scope,
    fingerprint: string,
    input: RecordErrorInput,
    now: string,
  ): Promise<ErrorEntry> {
    const id = fingerprint;
    const path = `${this.dirForScope(scope)}/incidents/${id}.md`;
    const entry: ErrorEntry = {
      id,
      fingerprint,
      status: 'incident',
      scope,
      occurrence_count: 1,
      first_seen: now,
      last_seen: now,
      ...(input.tags && { tags: input.tags }),
      path: this.fs.abs(path),
      body: {
        symptom: input.symptom.trim(),
        root_cause: input.root_cause.trim(),
        fix_action: input.fix_action.trim(),
        ...(input.verification && { verification: input.verification.trim() }),
        ...(input.references && { references: input.references }),
      },
    };
    await this.fs.write(path, renderEntry(entry));
    return entry;
  }

  private async mergeExisting(
    path: string,
    input: RecordErrorInput,
    now: string,
  ): Promise<ErrorEntry> {
    const existing = await this.readEntry(path);
    const merged: ErrorEntry = {
      ...existing,
      occurrence_count: existing.occurrence_count + 1,
      last_seen: now,
      tags: unique([...(existing.tags ?? []), ...(input.tags ?? [])]),
      body: {
        ...existing.body,
        fix_action: input.fix_action.trim() || existing.body.fix_action,
        verification: input.verification?.trim() || existing.body.verification,
        references: unique([...(existing.body.references ?? []), ...(input.references ?? [])]),
      },
    };
    await this.fs.write(path, renderEntry(merged));
    return await this.readEntry(path);
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
    if (scope === 'global') return '.lrnev/errorbook';
    return `.lrnev/scenes/${scope.slice('scene:'.length)}/errorbook`;
  }

  private async listEntryFiles(scope: Scope): Promise<string[]> {
    const dir = this.dirForScope(scope);
    const incidents = await this.fs.list(`${dir}/incidents/*.md`);
    const promoted = await this.fs.list(`${dir}/promoted/*.md`);
    return [...incidents, ...promoted].sort();
  }

  private async findByFingerprint(scope: Scope, fingerprint: string): Promise<string | null> {
    const files = await this.listEntryFiles(scope);
    for (const file of files) {
      const entry = await this.readEntry(file);
      if (entry.fingerprint === fingerprint) return file;
    }
    return null;
  }

  private async resolveEntryPath(scope: Scope, id: string): Promise<string> {
    const dir = this.dirForScope(scope);
    const candidates = [`${dir}/incidents/${id}.md`, `${dir}/promoted/${id}.md`];
    const found = candidates.find((path) => this.fs.exists(path));
    if (found) return found;
    throw new LrnevError(ErrorCode.FILE_NOT_FOUND, `错误条目不存在：${id}`, {
      field: 'id',
      hint: '先调用 error_search 查找现有错误条目；若这是新问题，请调用 error_record 记录。',
    });
  }

  private async readEntry(path: string): Promise<ErrorEntry> {
    const content = await this.fs.read(path);
    const parsed = parseDocument<ErrorFrontmatter>(content);
    const fm = parsed.frontmatter;
    return {
      id: fm.id,
      fingerprint: fm.fingerprint,
      status: fm.status,
      scope: fm.scope,
      occurrence_count: fm.occurrence_count ?? 1,
      first_seen: fm.first_seen,
      last_seen: fm.last_seen,
      ...(fm.promoted_at && { promoted_at: fm.promoted_at }),
      ...(fm.tags && { tags: fm.tags }),
      path: this.fs.abs(path),
      body: {
        symptom: section(parsed, '症状'),
        root_cause: section(parsed, '根因'),
        fix_action: section(parsed, '修复动作'),
        verification: optionalSection(parsed, '验证证据'),
        references: optionalSection(parsed, '参考')
          ?.split(/\r?\n/)
          .map((line) => line.replace(/^-\s*/, '').trim())
          .filter(Boolean),
      },
    };
  }

  private async updateIndex(scope: Scope): Promise<void> {
    const entries = await Promise.all((await this.listEntryFiles(scope)).map((file) => this.readEntry(file)));
    const lines = [
      `# ${scope === 'global' ? '全局' : scope} Errorbook`,
      '',
      `更新时间：${new Date().toISOString()}`,
      '',
    ];
    if (entries.length === 0) {
      lines.push('暂无错误记录。');
    } else {
      for (const entry of entries.sort((a, b) => b.last_seen.localeCompare(a.last_seen))) {
        lines.push(`- ${entry.id} [${entry.status}] x${entry.occurrence_count}：${entry.body.symptom}`);
      }
    }
    await this.fs.write(`${this.dirForScope(scope)}/README.md`, lines.join('\n') + '\n');
  }

  private validateRecordInput(input: RecordErrorInput): void {
    for (const field of ['symptom', 'root_cause', 'fix_action'] as const) {
      if (!input[field]?.trim()) {
        throw new LrnevError(ErrorCode.INVALID_INPUT, `${field} 不能为空`, { field });
      }
    }
  }

  private computeFingerprint(symptom: string, rootCause: string): string {
    return computeFingerprint(symptom, rootCause, loadConfig(this.fs.root).errorbook.fingerprint_length);
  }
}

export function computeFingerprint(
  symptom: string,
  rootCause: string,
  length = DEFAULT_CONFIG.errorbook.fingerprint_length,
): string {
  const normalized = `${normalize(symptom)}|${normalize(rootCause)}`;
  return createHash('sha256')
    .update(normalized)
    .digest('hex')
    .slice(0, length);
}

function renderEntry(entry: ErrorEntry): string {
  const frontmatter: ErrorFrontmatter = {
    id: entry.id,
    fingerprint: entry.fingerprint,
    status: entry.status,
    scope: entry.scope,
    occurrence_count: entry.occurrence_count,
    first_seen: entry.first_seen,
    last_seen: entry.last_seen,
    ...(entry.promoted_at && { promoted_at: entry.promoted_at }),
    ...(entry.tags && { tags: entry.tags }),
  };
  const body = [
    `# ${entry.id}`,
    '',
    '## 症状',
    '',
    entry.body.symptom,
    '',
    '## 根因',
    '',
    entry.body.root_cause,
    '',
    '## 修复动作',
    '',
    entry.body.fix_action,
    '',
    '## 验证证据',
    '',
    entry.body.verification ?? '',
    '',
    '## 参考',
    '',
    ...(entry.body.references?.length ? entry.body.references.map((ref) => `- ${ref}`) : ['']),
  ].join('\n');
  return serializeFrontmatter(frontmatter as unknown as Record<string, unknown>, body);
}

function section<T>(doc: ReturnType<typeof parseDocument<T>>, title: string): string {
  return doc.sections.find((item) => item.title === title)?.content ?? '';
}

function optionalSection<T>(doc: ReturnType<typeof parseDocument<T>>, title: string): string | undefined {
  const value = section(doc, title).trim();
  return value.length > 0 ? value : undefined;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
