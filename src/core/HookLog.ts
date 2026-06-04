import { existsSync, createReadStream, createWriteStream } from 'node:fs';
import { appendFile, stat, truncate } from 'node:fs/promises';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';

import { loadConfig } from '../shared/config.js';
import { FileStorage } from '../storage/FileStorage.js';
import type { HookRecord } from '../types/hooks.js';

export const HOOK_LOG_REL = '.lrnev/state/hook-log.jsonl';

/** HookLog 管理 hook 执行记录的 JSONL 追加、尾读和按大小轮转。 */
export class HookLog {
  constructor(
    private readonly fs: FileStorage,
    private readonly rotateBytes = loadConfig(fs.root).hooks.log_rotate_bytes,
  ) {}

  async append(record: HookRecord): Promise<void> {
    await this.rotateIfNeeded();
    await appendFile(this.fs.abs(HOOK_LOG_REL), `${JSON.stringify(record)}\n`, 'utf-8');
  }

  async tail(limit?: number): Promise<HookRecord[]> {
    if (!this.fs.exists(HOOK_LOG_REL)) return [];
    const actualLimit = limit ?? loadConfig(this.fs.root).hooks.recent_list_limit;
    const content = await this.fs.read(HOOK_LOG_REL);
    return content
      .split(/\r?\n/)
      .filter(Boolean)
      .slice(-actualLimit)
      .map((line) => JSON.parse(line) as HookRecord);
  }

  private async rotateIfNeeded(): Promise<void> {
    const path = this.fs.abs(HOOK_LOG_REL);
    const current = await stat(path).catch(() => null);
    if (!current || current.size < this.rotateBytes) return;

    const target = this.nextRotatePath();
    await pipeline(createReadStream(path), createGzip(), createWriteStream(target));
    await truncate(path, 0);
  }

  private nextRotatePath(): string {
    const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const base = this.fs.abs(HOOK_LOG_REL).replace(/\.jsonl$/, `.${ymd}.jsonl.gz`);
    if (!existsSync(base)) return base;
    for (let i = 1; ; i++) {
      const candidate = base.replace(/\.jsonl\.gz$/, `.${i}.jsonl.gz`);
      if (!existsSync(candidate)) return candidate;
    }
  }
}
