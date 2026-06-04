/**
 * FileStorage —— 文件系统抽象层
 *
 * 设计目的：
 *   1. 所有 core 层文件操作走这个抽象，避免直接 fs.* 调用散落各处
 *   2. 所有路径相对 workspace root 解析（避免硬拼绝对路径）
 *   3. 写操作原子化（防止 MCP 调用中断导致半写文件）
 *   4. 测试时易于 mock（之后如需 mock 只替换本模块）
 *
 * 设计权威：tasks.md T-102
 */

import { existsSync } from 'node:fs';
import {
  mkdir,
  open as openFile,
  readFile,
  rename,
  rm,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { dirname, isAbsolute, resolve, sep } from 'node:path';
import { randomBytes } from 'node:crypto';
import { glob } from 'glob';

import { loadConfig } from '../shared/config.js';
import { LrnevError, ErrorCode } from '../shared/errors.js';
import { stripUtf8Bom } from '../shared/text.js';

/**
 * FileStorage 实例化时锁定一个工作区根目录，
 * 之后所有方法接受**相对路径**，禁止使用绝对路径
 * （防止误操作 workspace 外的文件）。
 */
export class FileStorage {
  /** 工作区根目录的绝对路径 */
  public readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  /**
   * 把相对路径解析为绝对路径，并验证仍在 workspace root 内。
   *
   * 防御点：
   *   - 拒绝绝对路径输入（除非显式 allowAbsolute）
   *   - 解析后路径必须以 root 为前缀（防 ../../ 逃逸）
   *
   * @internal
   */
  resolveSafe(relPath: string, allowAbsolute = false): string {
    if (!relPath) {
      throw new LrnevError(ErrorCode.INVALID_INPUT, '路径不能为空', { field: 'path' });
    }
    if (!allowAbsolute && isAbsolute(relPath)) {
      throw new LrnevError(
        ErrorCode.INVALID_INPUT,
        `不允许使用绝对路径："${relPath}"`,
        { field: 'path', hint: '请传入相对 workspace root 的路径' },
      );
    }
    const abs = isAbsolute(relPath) ? resolve(relPath) : resolve(this.root, relPath);
    // 必须仍位于 root 内（用 sep 加成边界，防止 /repo-malicious 命中 /repo）
    if (abs !== this.root && !abs.startsWith(this.root + sep)) {
      throw new LrnevError(
        ErrorCode.INVALID_INPUT,
        `路径越界："${relPath}"`,
        { field: 'path', hint: '路径必须位于 workspace 内' },
      );
    }
    return abs;
  }

  /** 判断路径是否存在（同步）。相对路径。 */
  exists(relPath: string): boolean {
    return existsSync(this.resolveSafe(relPath));
  }

  /**
   * 读文本文件，默认 UTF-8。
   *
   * @throws LrnevError(FILE_NOT_FOUND) 文件不存在
   */
  async read(relPath: string): Promise<string> {
    const abs = this.resolveSafe(relPath);
    try {
      return await readFile(abs, 'utf-8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new LrnevError(ErrorCode.FILE_NOT_FOUND, `文件不存在："${relPath}"`, {
          field: 'path',
          cause: err,
        });
      }
      throw err;
    }
  }

  /** 读 JSON，类型由调用方负责。 */
  /** 只读取开头的 YAML frontmatter 块；大文件不需要整篇载入。 */
  async readFrontmatterBlock(relPath: string, maxBytes?: number): Promise<string> {
    const abs = this.resolveSafe(relPath);
    const byteLimit = maxBytes ?? loadConfig(this.root).storage.frontmatter_read_bytes;
    let handle: Awaited<ReturnType<typeof openFile>> | undefined;
    try {
      handle = await openFile(abs, 'r');
      const chunks: Buffer[] = [];
      let offset = 0;

      while (offset < byteLimit) {
        const buffer = Buffer.alloc(Math.min(4096, byteLimit - offset));
        const { bytesRead } = await handle.read(buffer, 0, buffer.length, offset);
        if (bytesRead === 0) break;
        chunks.push(buffer.subarray(0, bytesRead));
        offset += bytesRead;

        const text = Buffer.concat(chunks).toString('utf-8');
        if (!text.startsWith('---')) return text;
        const match = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.exec(text);
        if (match) return match[0]!;
      }

      return Buffer.concat(chunks).toString('utf-8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new LrnevError(ErrorCode.FILE_NOT_FOUND, `文件不存在："${relPath}"`, {
          field: 'path',
          cause: err,
        });
      }
      throw err;
    } finally {
      await handle?.close();
    }
  }

  async readJson<T = unknown>(relPath: string): Promise<T> {
    const text = await this.read(relPath);
    try {
      return JSON.parse(stripUtf8Bom(text)) as T;
    } catch (err) {
      throw new LrnevError(
        ErrorCode.INTERNAL_ERROR,
        `JSON 解析失败："${relPath}"`,
        { field: 'path', cause: err },
      );
    }
  }

  /**
   * 原子写文本文件。
   *
   * 实现：先写 `<dest>.<rand>.tmp`，写完后 rename 为目标文件。
   * rename 是 POSIX 原子操作，Windows 上也是事务性的。
   *
   * 同时确保父目录存在（recursive mkdir）。
   */
  async write(relPath: string, content: string): Promise<void> {
    const abs = this.resolveSafe(relPath);
    await mkdir(dirname(abs), { recursive: true });

    const tmpSuffix = randomBytes(6).toString('hex');
    const tmpPath = `${abs}.${tmpSuffix}.tmp`;

    try {
      await writeFile(tmpPath, content, 'utf-8');
      await rename(tmpPath, abs);
    } catch (err) {
      // 失败时清理临时文件（best effort）
      await unlink(tmpPath).catch(() => undefined);
      throw err;
    }
  }

  /** 原子写 JSON（自动 stringify + 缩进 2）。 */
  async writeJson(relPath: string, data: unknown): Promise<void> {
    await this.write(relPath, JSON.stringify(data, null, 2) + '\n');
  }

  /**
   * 创建目录（递归、幂等）。
   *
   * 注意：不会对 root 自身重复创建。
   */
  async mkdir(relPath: string): Promise<void> {
    const abs = this.resolveSafe(relPath);
    await mkdir(abs, { recursive: true });
  }

  /**
   * 独占创建目录。
   *
   * 返回 true 表示本次调用创建成功；目录已存在时返回 false。
   * 调用方可用它实现基于 mkdir 原子性的锁或编号占用。
   */
  async mkdirExclusive(relPath: string): Promise<boolean> {
    const abs = this.resolveSafe(relPath);
    await mkdir(dirname(abs), { recursive: true });
    try {
      await mkdir(abs);
      return true;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'EEXIST' || (code === 'EPERM' && existsSync(abs))) return false;
      throw err;
    }
  }

  /**
   * 用独占目录实现一个短临界区锁。
   *
   * 该锁只用于 lrnev 内部的小文件 read-modify-write / 编号分配临界区；
   * 不得用来锁用户源码文件或裁决源码冲突，锁目录会在 finally 中删除。
   */
  async withDirectoryLock<T>(
    relPath: string,
    fn: () => Promise<T>,
    opts: { retries?: number; delayMs?: number } = {},
  ): Promise<T> {
    const config = loadConfig(this.root).lock;
    const retries = opts.retries ?? config.directory_lock_retries;
    const delayMs = opts.delayMs ?? config.directory_lock_delay_ms;
    let acquired = false;

    for (let attempt = 0; attempt <= retries; attempt++) {
      if (await this.tryAcquireDirectoryLock(relPath)) {
        acquired = true;
        break;
      }
      if (attempt < retries) await sleep(delayMs);
    }

    if (!acquired) {
      throw new LrnevError(
        ErrorCode.LOCK_HELD_BY_OTHER,
        `锁被占用："${relPath}"`,
        { field: 'lock', hint: '稍后重试，或检查 .lrnev/locks 下是否有残留锁目录' },
      );
    }

    try {
      return await fn();
    } finally {
      await this.rm(relPath);
    }
  }

  private async tryAcquireDirectoryLock(relPath: string): Promise<boolean> {
    try {
      return await this.mkdirExclusive(relPath);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'EPERM') return false;
      throw err;
    }
  }

  /**
   * 移动文件或目录（rename）。
   *
   * 若目标父目录不存在会自动创建。
   * 跨磁盘的 rename 在某些平台会失败，本函数不做兜底（M1 不需要）。
   */
  async mv(srcRel: string, dstRel: string): Promise<void> {
    const srcAbs = this.resolveSafe(srcRel);
    const dstAbs = this.resolveSafe(dstRel);
    await mkdir(dirname(dstAbs), { recursive: true });
    await rename(srcAbs, dstAbs);
  }

  /**
   * 删除文件或目录（recursive、force）。
   *
   * 注意：危险操作，调用方需确认。
   */
  async rm(relPath: string): Promise<void> {
    const abs = this.resolveSafe(relPath);
    await rm(abs, { recursive: true, force: true });
  }

  /**
   * Glob 列出匹配的相对路径。
   *
   * 返回的路径**相对 root**（使用 POSIX 风格 / 分隔符，与 URI 一致）。
   *
   * @param pattern glob 模式，例如 "scenes/&#42;&#42;/scene.md"
   * @param opts.dot 是否包含 .开头的文件（默认 false）
   */
  async list(
    pattern: string,
    opts: { dot?: boolean } = {},
  ): Promise<string[]> {
    const matches = await glob(pattern, {
      cwd: this.root,
      dot: opts.dot ?? false,
      nodir: false,
      posix: true,
    });
    // 强制 POSIX 分隔符（Windows 上 glob 已经返回 /，但仍保险一下）
    return matches.map((p) => p.split(sep).join('/'));
  }

  /**
   * 获取文件元信息（mtime / size 等）。
   *
   * @throws LrnevError(FILE_NOT_FOUND) 文件不存在
   */
  async stat(relPath: string): Promise<{ size: number; mtime: Date; isFile: boolean; isDirectory: boolean }> {
    const abs = this.resolveSafe(relPath);
    try {
      const s = await stat(abs);
      return {
        size: s.size,
        mtime: s.mtime,
        isFile: s.isFile(),
        isDirectory: s.isDirectory(),
      };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new LrnevError(ErrorCode.FILE_NOT_FOUND, `文件不存在："${relPath}"`, {
          field: 'path',
          cause: err,
        });
      }
      throw err;
    }
  }

  /** 拼接 workspace 内的绝对路径（少数需要绝对路径的场景使用，如外部命令） */
  abs(relPath: string): string {
    return this.resolveSafe(relPath);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}
