/**
 * MCP resource 读取处理。
 *
 * 所有 context:// URI 先交给 URIRouter 映射到工作区相对路径；
 * `?level=L0/L1` 会优先读取同目录下按文档键控的 `.<doc>.abstract.md` / `.<doc>.overview.md`，
 * 不存在时回退到 L2 原文，并在内容开头标注回退原因。
 */

import { summaryPathFor } from '../../core/Summarizer.js';
import { FileStorage } from '../../storage/FileStorage.js';
import { parseURI, uriToFilePath } from '../../storage/URIRouter.js';
import { resolveWorkspaceRoot } from '../../storage/WorkspaceLocator.js';
import { LrnevError, ErrorCode } from '../../shared/errors.js';
import type { Level } from '../../types/response.js';

export interface ContextResourceRead {
  uri: string;
  text: string;
  mimeType: string;
}

export async function readContextResource(uri: string): Promise<ContextResourceRead> {
  const parsed = parseURI(uri);
  const root = resolveWorkspaceRoot().root;
  const fs = new FileStorage(root);
  const relPath = uriToFilePath(parsed);

  if (relPath === null) {
    return {
      uri,
      text: await renderListResource(fs, parsed.kind, parsed.segments),
      mimeType: 'application/json',
    };
  }

  const targetPath = await resolveConcretePath(fs, relPath);
  const readPath = await resolveLevelPath(fs, targetPath, parsed.level);
  const text = await fs.read(readPath.path);
  return {
    uri,
    text: readPath.fallback
      ? `<!-- lrnev: ${parsed.level} 摘要不存在，已回退到 L2 原文 -->\n\n${text}`
      : text,
    mimeType: readPath.path.endsWith('.json') ? 'application/json' : 'text/markdown',
  };
}

async function resolveConcretePath(fs: FileStorage, relPath: string): Promise<string> {
  if (!/\/\d{4}$/.test(relPath)) return relPath;
  const matches = await fs.list(`${relPath}-*.md`);
  if (matches.length === 1) return matches[0]!;
  if (matches.length > 1) {
    throw new LrnevError(ErrorCode.ADR_NUMBER_CONFLICT, `ADR 编号冲突：${relPath}`, {
      field: 'uri',
    });
  }
  return relPath;
}

async function resolveLevelPath(
  fs: FileStorage,
  relPath: string,
  level: Level,
): Promise<{ path: string; fallback: boolean }> {
  if (level === 'L2') return { path: relPath, fallback: false };

  const summaryPath = summaryPathFor(relPath, level);
  if (fs.exists(summaryPath)) return { path: summaryPath, fallback: false };
  return { path: relPath, fallback: true };
}

async function renderListResource(
  fs: FileStorage,
  kind: string,
  segments: string[],
): Promise<string> {
  if (kind === 'scene' && segments.length === 0) {
    const scenes = await fs.list('.lrnev/scenes/*/scene.md');
    return JSON.stringify({
      kind: 'scene',
      items: scenes.map((path) => path.replace(/^\.lrnev\/scenes\/([^/]+)\/scene\.md$/, '$1')),
    }, null, 2);
  }

  if (kind === 'memory' && segments.length === 1) {
    const category = segments[0]!;
    const items = await fs.list(`.lrnev/memory/${category}/*.md`);
    return JSON.stringify({
      kind: 'memory',
      category,
      items,
    }, null, 2);
  }

  if (kind === 'adr' && segments.length === 0) {
    const items = await fs.list('.lrnev/decisions/adr/*.md');
    return JSON.stringify({
      kind: 'adr',
      items: items.filter((path) => /\/\d{4}-.+\.md$/.test(path)),
    }, null, 2);
  }

  throw new LrnevError(
    ErrorCode.INVALID_URI,
    `该列表 URI 暂不支持读取：context://${kind}/${segments.join('/')}`,
    { field: 'uri' },
  );
}
