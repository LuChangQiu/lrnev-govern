/**
 * Summarizer —— L0 / L1 摘要路径与写入管理。
 *
 * M1 不生成摘要内容，只接收 AI 传入的 l0 / l1 文本并保存。
 * 资源读取层会优先读取这些文件；不存在时回退 L2 全文。
 */

import { basename, dirname } from 'node:path/posix';

import { FileStorage } from '../storage/FileStorage.js';
import { parseURI, uriToFilePath } from '../storage/URIRouter.js';
import { LrnevError, ErrorCode } from '../shared/errors.js';
import type { AiFollowupResponse, Level } from '../types/response.js';
import type { SaveSummaryInput, SaveSummaryResult } from '../types/summary.js';

/** 目标文档 -> 其 L0/L1 摘要文件相对路径。按文档 basename 键控，同目录多文档不冲突。 */
export function summaryPathFor(targetRelPath: string, level: Exclude<Level, 'L2'>): string {
  const dir = dirname(targetRelPath);
  const name = basename(targetRelPath).replace(/\.md$/i, '');
  const suffix = level === 'L0' ? 'abstract' : 'overview';
  const file = `.${name}.${suffix}.md`;
  return dir === '.' ? file : `${dir}/${file}`;
}

export class Summarizer {
  constructor(private readonly fs: FileStorage) {}

  async getSummaryPath(uri: string, level: Exclude<Level, 'L2'>): Promise<string> {
    const parsed = parseURI(uri);
    const relPath = uriToFilePath(parsed);
    if (relPath === null) {
      throw new LrnevError(ErrorCode.INVALID_URI, `列表 URI 不能保存摘要：${uri}`, {
        field: 'uri',
      });
    }
    const concretePath = await this.resolveConcretePath(relPath);
    // I-6: 写摘要前校验目标文档真实存在；否则会给不存在的 scene/spec 凭空建孤儿摘要文件。
    // 校验放在算路径阶段（写文件前），不存在即抛错、不创建任何目录/文件。
    if (!this.fs.exists(concretePath)) {
      throw new LrnevError(ErrorCode.FILE_NOT_FOUND, `摘要目标文档不存在：${concretePath}`, {
        field: 'uri',
        hint: '确认 URI 指向的 scene/spec/文档已存在，再保存摘要；不要为不存在的目标建摘要。',
      });
    }
    return summaryPathFor(concretePath, level);
  }

  async saveSummary(input: SaveSummaryInput): Promise<AiFollowupResponse<SaveSummaryResult>> {
    const saved: SaveSummaryResult['saved'] = [];
    const skipped: SaveSummaryResult['skipped'] = [];

    if (input.l0?.trim()) {
      const path = await this.getSummaryPath(input.uri, 'L0');
      await this.fs.write(path, normalizeSummary(input.l0));
      saved.push({ level: 'L0', path });
    } else {
      skipped.push({ level: 'L0', reason: '未提供 l0 内容' });
    }

    if (input.l1?.trim()) {
      const path = await this.getSummaryPath(input.uri, 'L1');
      await this.fs.write(path, normalizeSummary(input.l1));
      saved.push({ level: 'L1', path });
    } else {
      skipped.push({ level: 'L1', reason: '未提供 l1 内容' });
    }

    if (saved.length === 0) {
      throw new LrnevError(ErrorCode.INVALID_INPUT, '至少需要提供 l0 或 l1', {
        field: 'l0',
      });
    }

    return {
      ok: true,
      data: {
        uri: input.uri,
        saved,
        skipped,
      },
      ai_followup: {
        instructions: [
          '摘要已保存。后续读取同一 URI 时可使用 ?level=L0 或 ?level=L1。',
          '如果源文档发生较大变化，请重新调用 summarize_save 更新摘要。',
          '接手或检索时可调用 context_search，或直接读取该 URI 的 L0/L1 摘要。',
        ],
      },
    };
  }

  private async resolveConcretePath(relPath: string): Promise<string> {
    if (!/\/\d{4}$/.test(relPath)) return relPath;
    const matches = await this.fs.list(`${relPath}-*.md`);
    if (matches.length === 1) return matches[0]!;
    if (matches.length > 1) {
      throw new LrnevError(ErrorCode.ADR_NUMBER_CONFLICT, `ADR 编号冲突：${relPath}`, {
        field: 'uri',
      });
    }
    return relPath;
  }
}

function normalizeSummary(content: string): string {
  return content.trim() + '\n';
}

/**
 * 摘要读取契约（01-00 F-03 / 02-00 F-01 共用）：**sidecar 优先、requirements 内联兜底**。
 * 即 summarize_save 产出的 `.requirements.abstract.md` / `.overview.md` 是可更新摘要源；
 * 没有 sidecar 时，回退读 requirements.md 里的 `## L0 摘要` / `## L1 概览` 段。
 * 不做迁移、不假装单一物理存储——只把读取优先级定成系统契约。返回原始文本（不截断），由调用方按场景截断。
 */
export interface SpecSummary {
  l0?: string;
  l1?: string;
  /** 至少有一级来自 sidecar 时为 'sidecar'，否则（全部来自内联）为 'inline'；两级皆无时为 undefined。 */
  source?: 'sidecar' | 'inline';
}

export async function readSpecSummary(
  fs: FileStorage,
  sceneId: string,
  specId: string,
): Promise<SpecSummary> {
  const reqRel = `.lrnev/scenes/${sceneId}/specs/${specId}/requirements.md`;
  const l0 = await readSummaryLevel(fs, reqRel, 'L0');
  const l1 = await readSummaryLevel(fs, reqRel, 'L1');
  if (!l0 && !l1) return {};
  const source = l0?.source === 'sidecar' || l1?.source === 'sidecar' ? 'sidecar' : 'inline';
  return { ...(l0 && { l0: l0.text }), ...(l1 && { l1: l1.text }), source };
}

async function readSummaryLevel(
  fs: FileStorage,
  reqRel: string,
  level: 'L0' | 'L1',
): Promise<{ text: string; source: 'sidecar' | 'inline' } | undefined> {
  const sidecar = summaryPathFor(reqRel, level);
  if (fs.exists(sidecar)) {
    const text = (await fs.read(sidecar)).trim();
    if (text) return { text, source: 'sidecar' };
  }
  if (!fs.exists(reqRel)) return undefined;
  const inline = extractInlineSection(await fs.read(reqRel), level);
  return inline ? { text: inline, source: 'inline' } : undefined;
}

/**
 * 抽 requirements 内联 `## L0 摘要` / `## L1 概览` 段的真实正文（跳过空行与模板哨兵），到下一个标题为止。
 * 只按精确模板哨兵判占位（HTML 注释、整行全角括号占位）——不按"含 FILL 单词"过滤，避免误伤真实摘要。
 */
export function extractInlineSection(content: string, level: 'L0' | 'L1'): string | undefined {
  const lines = content.split(/\r?\n/);
  const headRe = new RegExp(`^##\\s*${level}\\b`);
  let inSection = false;
  const body: string[] = [];
  for (const raw of lines) {
    if (headRe.test(raw)) {
      inSection = true;
      continue;
    }
    if (!inSection) continue;
    if (/^#{1,6}\s/.test(raw)) break;
    const line = raw.trim();
    if (!line || isTemplatePlaceholder(line)) continue;
    body.push(line);
  }
  return body.length > 0 ? body.join(' ') : undefined;
}

/** 模板哨兵：HTML 注释 `<!-- ... -->`，或整行被全角括号包裹的占位「（...）」。 */
export function isTemplatePlaceholder(line: string): boolean {
  return line.startsWith('<!--') || /^（.*）$/.test(line);
}
