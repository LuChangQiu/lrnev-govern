/**
 * Summarizer —— L0 / L1 摘要路径与写入管理。
 *
 * M1 不生成摘要内容，只接收 AI 传入的 l0 / l1 文本并保存。
 * 资源读取层会优先读取这些文件；不存在时回退 L2 全文。
 */

import { dirname } from 'node:path/posix';

import { FileStorage } from '../storage/FileStorage.js';
import { parseURI, uriToFilePath } from '../storage/URIRouter.js';
import { LrnevError, ErrorCode } from '../shared/errors.js';
import type { AiFollowupResponse, Level } from '../types/response.js';
import type { SaveSummaryInput, SaveSummaryResult } from '../types/summary.js';

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
    const dir = dirname(concretePath);
    return `${dir}/${level === 'L0' ? '.abstract.md' : '.overview.md'}`;
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
