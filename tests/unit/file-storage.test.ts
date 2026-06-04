/**
 * FileStorage 单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { dir as tmpDir, type DirectoryResult } from 'tmp-promise';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { FileStorage } from '../../src/storage/FileStorage.js';
import { isLrnevError } from '../../src/shared/errors.js';

describe('FileStorage', () => {
  let workspace: DirectoryResult;
  let fs: FileStorage;

  beforeEach(async () => {
    workspace = await tmpDir({ unsafeCleanup: true });
    fs = new FileStorage(workspace.path);
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  describe('安全路径解析', () => {
    it('应拒绝空路径', () => {
      try {
        fs.resolveSafe('');
        expect.fail('应抛出异常');
      } catch (err) {
        expect(isLrnevError(err)).toBe(true);
      }
    });

    it('应拒绝绝对路径输入', () => {
      try {
        fs.resolveSafe('/etc/passwd');
        expect.fail('应抛出异常');
      } catch (err) {
        expect(isLrnevError(err)).toBe(true);
      }
    });

    it('应拒绝 ../../ 路径越界', () => {
      try {
        fs.resolveSafe('../../../etc/passwd');
        expect.fail('应抛出异常');
      } catch (err) {
        expect(isLrnevError(err)).toBe(true);
      }
    });

    it('合法相对路径应正确解析', () => {
      const abs = fs.resolveSafe('scenes/01-demo/scene.md');
      expect(abs.startsWith(resolve(workspace.path))).toBe(true);
      expect(abs.endsWith('scene.md')).toBe(true);
    });

    it('允许指向 root 自身', () => {
      const abs = fs.resolveSafe('.');
      expect(abs).toBe(resolve(workspace.path));
    });
  });

  describe('read / write', () => {
    it('write + read 应等价', async () => {
      await fs.write('a.txt', 'hello 你好');
      const content = await fs.read('a.txt');
      expect(content).toBe('hello 你好');
    });

    it('write 应自动创建父目录', async () => {
      await fs.write('deep/nested/file.txt', 'x');
      expect(fs.exists('deep/nested/file.txt')).toBe(true);
    });

    it('write 应是原子操作（不留 .tmp 文件）', async () => {
      await fs.write('a.txt', 'content');
      const files = await fs.list('*');
      expect(files).toContain('a.txt');
      // 不应有 .tmp 残留
      expect(files.every((f) => !f.endsWith('.tmp'))).toBe(true);
    });

    it('read 不存在的文件应抛 FILE_NOT_FOUND', async () => {
      try {
        await fs.read('missing.txt');
        expect.fail('应抛出异常');
      } catch (err) {
        expect(isLrnevError(err)).toBe(true);
        if (isLrnevError(err)) {
          expect(err.code).toBe('FILE_NOT_FOUND');
        }
      }
    });
  });

  describe('readJson / writeJson', () => {
    it('writeJson + readJson 应等价', async () => {
      const data = { name: 'test', value: 42, list: [1, 2, 3] };
      await fs.writeJson('data.json', data);
      const loaded = await fs.readJson<typeof data>('data.json');
      expect(loaded).toEqual(data);
    });

    it('writeJson 输出应缩进 2 + 末尾换行', async () => {
      await fs.writeJson('data.json', { a: 1 });
      const text = await fs.read('data.json');
      expect(text).toBe('{\n  "a": 1\n}\n');
    });

    it('readJson 应接受带 UTF-8 BOM 的 JSON', async () => {
      await writeFile(join(workspace.path, 'bom.json'), '\ufeff{"name":"dogfood"}', 'utf-8');

      const loaded = await fs.readJson<{ name: string }>('bom.json');

      expect(loaded).toEqual({ name: 'dogfood' });
    });

    it('readJson 损坏的 JSON 应抛错', async () => {
      await fs.write('bad.json', '{ not valid json');
      try {
        await fs.readJson('bad.json');
        expect.fail('应抛出异常');
      } catch (err) {
        expect(isLrnevError(err)).toBe(true);
      }
    });
  });

  describe('mkdir / exists', () => {
    it('mkdir 应支持递归创建', async () => {
      await fs.mkdir('a/b/c');
      expect(fs.exists('a/b/c')).toBe(true);
    });

    it('mkdir 应幂等', async () => {
      await fs.mkdir('a');
      await fs.mkdir('a');
      expect(fs.exists('a')).toBe(true);
    });
  });

  describe('mv', () => {
    it('应移动文件', async () => {
      await fs.write('src.txt', 'hello');
      await fs.mv('src.txt', 'dst.txt');
      expect(fs.exists('src.txt')).toBe(false);
      expect(fs.exists('dst.txt')).toBe(true);
      expect(await fs.read('dst.txt')).toBe('hello');
    });

    it('目标父目录不存在时应自动创建', async () => {
      await fs.write('src.txt', 'x');
      await fs.mv('src.txt', 'new/path/dst.txt');
      expect(fs.exists('new/path/dst.txt')).toBe(true);
    });
  });

  describe('rm', () => {
    it('应能删除文件', async () => {
      await fs.write('a.txt', 'x');
      await fs.rm('a.txt');
      expect(fs.exists('a.txt')).toBe(false);
    });

    it('应能递归删除目录', async () => {
      await fs.write('dir/a.txt', 'x');
      await fs.write('dir/b/c.txt', 'y');
      await fs.rm('dir');
      expect(fs.exists('dir')).toBe(false);
    });

    it('删除不存在的路径应不报错（force）', async () => {
      await expect(fs.rm('not-exist')).resolves.toBeUndefined();
    });
  });

  describe('list (glob)', () => {
    beforeEach(async () => {
      await fs.write('a.md', '');
      await fs.write('b.md', '');
      await fs.write('sub/c.md', '');
      await fs.write('sub/d.txt', '');
    });

    it('应匹配单层模式', async () => {
      const files = await fs.list('*.md');
      expect(files.sort()).toEqual(['a.md', 'b.md']);
    });

    it('应匹配递归模式 **', async () => {
      const files = await fs.list('**/*.md');
      expect(files.sort()).toEqual(['a.md', 'b.md', 'sub/c.md']);
    });

    it('返回的路径应使用 POSIX 分隔符', async () => {
      const files = await fs.list('sub/*');
      for (const f of files) {
        expect(f.includes('\\')).toBe(false);
      }
    });

    it('默认应不包含点开头的文件', async () => {
      await fs.write('.hidden.md', '');
      const files = await fs.list('*.md');
      expect(files).not.toContain('.hidden.md');
    });

    it('dot:true 应包含点开头的文件', async () => {
      await fs.write('.hidden.md', '');
      const files = await fs.list('*.md', { dot: true });
      expect(files).toContain('.hidden.md');
    });
  });

  describe('stat', () => {
    it('文件应返回 isFile=true', async () => {
      await fs.write('a.txt', 'hello');
      const s = await fs.stat('a.txt');
      expect(s.isFile).toBe(true);
      expect(s.isDirectory).toBe(false);
      expect(s.size).toBe(5);
      expect(s.mtime).toBeInstanceOf(Date);
    });

    it('目录应返回 isDirectory=true', async () => {
      await fs.mkdir('dir');
      const s = await fs.stat('dir');
      expect(s.isDirectory).toBe(true);
      expect(s.isFile).toBe(false);
    });

    it('不存在的路径应抛 FILE_NOT_FOUND', async () => {
      try {
        await fs.stat('not-exist');
        expect.fail('应抛出异常');
      } catch (err) {
        expect(isLrnevError(err)).toBe(true);
      }
    });
  });

  describe('readFrontmatterBlock', () => {
    it('F-02: storage.frontmatter_read_bytes 配置应控制 frontmatter 预读上限', async () => {
      await fs.writeJson('.lrnev/config/lrnev.json', {
        storage: { frontmatter_read_bytes: 8 },
      });
      await fs.write('doc.md', '---\ntitle: very-long-title\n---\nbody');

      const block = await fs.readFrontmatterBlock('doc.md');

      expect(Buffer.byteLength(block, 'utf-8')).toBeLessThanOrEqual(8);
    });
  });

  describe('abs', () => {
    it('应返回绝对路径', () => {
      const abs = fs.abs('a/b/c.txt');
      expect(abs.endsWith(join('a', 'b', 'c.txt'))).toBe(true);
    });
  });
});
