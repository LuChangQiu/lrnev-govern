/**
 * MemoryManager —— 五类项目记忆管理。
 *
 * M1 只做文件系统记忆：保存、搜索、遗忘。
 * 去重使用同类别内的轻量关键词重叠，不引入向量或外部模型。
 */

import { createHash } from 'node:crypto';

import { FileStorage } from '../storage/FileStorage.js';
import { parseFrontmatter, serializeFrontmatter } from '../storage/FrontmatterCodec.js';
import { loadConfig } from '../shared/config.js';
import { LrnevError, ErrorCode } from '../shared/errors.js';
import { SceneManager } from './SceneManager.js';
import {
  MemoryCategory,
  type ForgetMemoryInput,
  type Memory,
  type MemoryFrontmatter,
  type SaveMemoryInput,
  type SearchMemoryInput,
} from '../types/memory.js';
import type { AiFollowupResponse, Scope } from '../types/response.js';

export class MemoryManager {
  constructor(
    private readonly fs: FileStorage,
    private readonly scenes: SceneManager,
  ) {}

  get workspaceRoot(): string {
    return this.fs.root;
  }

  async save(input: SaveMemoryInput): Promise<AiFollowupResponse<Memory>> {
    await this.validateInput(input);
    const scope = await this.resolveScope(input.scope);
    await this.ensureCategoryDirs(scope);

    const duplicate = await this.findDuplicate(input.category, input.content, scope);
    if (duplicate) {
      return {
        ok: true,
        data: duplicate,
        warnings: ['检测到同类别相似记忆，已跳过写入并返回已有条目。'],
        ai_followup: {
          instructions: [
            `记忆与 ${duplicate.id} 相似，未重复保存。`,
            '如仍需确认上下文，请调用 memory_search 检索该记忆后再继续当前任务。',
          ],
        },
      };
    }

    const now = new Date().toISOString();
    const id = makeMemoryId(input.category, input.content, input.source);
    const path = `${this.categoryDir(scope, input.category)}/${id}.md`;
    const memory: Memory = {
      id,
      category: input.category,
      scope,
      source: input.source.trim(),
      created: now,
      reference_count: 0,
      ...(input.tentative !== undefined && { tentative: input.tentative }),
      path: this.fs.abs(path),
      content: input.content.trim(),
    };
    await this.fs.write(path, renderMemory(memory));

    return {
      ok: true,
      data: memory,
      ai_followup: {
        instructions: [
          `记忆 ${id} 已保存到 ${input.category}。`,
          '后续相关任务开始前，可调用 memory_search 检索偏好、事实和模式。',
        ],
      },
    };
  }

  async search(input: SearchMemoryInput): Promise<Memory[]> {
    const query = input.query.trim();
    if (!query) {
      throw new LrnevError(ErrorCode.INVALID_INPUT, 'query 不能为空', { field: 'query' });
    }
    const scope = await this.resolveScope(input.scope ?? 'global');
    const categories = input.category ? [input.category] : Object.values(MemoryCategory);
    const terms = keywords(query);
    const results: Array<{ memory: Memory; score: number }> = [];
    for (const category of categories) {
      this.validateCategory(category);
      for (const file of await this.fs.list(`${this.categoryDir(scope, category)}/*.md`)) {
        const memory = await this.readMemory(file);
        const score = overlapScore(terms, keywords(memory.content));
        if (score > 0 || memory.content.toLowerCase().includes(query.toLowerCase())) {
          results.push({ memory, score });
        }
      }
    }
    return results
      .sort((a, b) => b.score - a.score || b.memory.created.localeCompare(a.memory.created))
      .map((item) => item.memory);
  }

  async forget(input: ForgetMemoryInput): Promise<AiFollowupResponse<{ id: string; deleted: boolean }>> {
    const scope = await this.resolveScope(input.scope ?? 'global');
    this.validateCategory(input.category);
    const path = `${this.categoryDir(scope, input.category)}/${input.id}.md`;
    const existed = this.fs.exists(path);
    if (existed) {
      await this.fs.rm(path);
    }
    return {
      ok: true,
      data: { id: input.id, deleted: existed },
      ai_followup: {
        instructions: [
          existed ? `记忆 ${input.id} 已删除。` : `记忆 ${input.id} 不存在，无需删除。`,
          '如后续仍依赖这条知识，请调用 memory_search 确认是否有替代记忆。',
        ],
      },
    };
  }

  private async readMemory(path: string): Promise<Memory> {
    const content = await this.fs.read(path);
    const parsed = parseFrontmatter<MemoryFrontmatter>(content);
    return {
      ...parsed.frontmatter,
      reference_count: parsed.frontmatter.reference_count ?? 0,
      path: this.fs.abs(path),
      content: parsed.body.trim(),
    };
  }

  private async findDuplicate(
    category: MemoryCategory,
    content: string,
    scope: Scope,
  ): Promise<Memory | null> {
    const current = keywords(content);
    const files = await this.fs.list(`${this.categoryDir(scope, category)}/*.md`);
    for (const file of files) {
      const existing = await this.readMemory(file);
      if (overlapScore(current, keywords(existing.content)) >= loadConfig(this.fs.root).memory.dedup_similarity_threshold) {
        return existing;
      }
    }
    return null;
  }

  private async validateInput(input: SaveMemoryInput): Promise<void> {
    this.validateCategory(input.category);
    if (!input.content?.trim()) {
      throw new LrnevError(ErrorCode.INVALID_INPUT, 'content 不能为空', { field: 'content' });
    }
    if (!input.source?.trim()) {
      throw new LrnevError(ErrorCode.INVALID_INPUT, 'source 必填', {
        field: 'source',
        hint: '请说明这条记忆来自哪段对话、文件或提交',
      });
    }
    await this.resolveScope(input.scope);
  }

  private validateCategory(category: MemoryCategory): void {
    if (!Object.values(MemoryCategory).includes(category)) {
      throw new LrnevError(ErrorCode.INVALID_INPUT, `未知记忆分类：${category}`, {
        field: 'category',
      });
    }
  }

  private async resolveScope(scope: Scope): Promise<Scope> {
    if (scope === 'global') return 'global';
    if (scope.startsWith('scene:')) {
      const sceneId = await this.scenes.resolveId(scope.slice('scene:'.length));
      return `scene:${sceneId}`;
    }
    throw new LrnevError(ErrorCode.INVALID_INPUT, `scope 不合法：${scope}`, { field: 'scope' });
  }

  private async ensureCategoryDirs(scope: Scope): Promise<void> {
    for (const category of Object.values(MemoryCategory)) {
      await this.fs.mkdir(this.categoryDir(scope, category));
    }
  }

  private categoryDir(scope: Scope, category: MemoryCategory): string {
    if (scope === 'global') return `.lrnev/memory/${category}`;
    return `.lrnev/scenes/${scope.slice('scene:'.length)}/memory/${category}`;
  }
}

export function makeMemoryId(category: MemoryCategory, content: string, source: string): string {
  const hash = createHash('sha256')
    .update(`${category}|${content.trim()}|${source.trim()}`)
    .digest('hex')
    .slice(0, 12);
  return `${category}-${hash}`;
}

function renderMemory(memory: Memory): string {
  const frontmatter: MemoryFrontmatter = {
    id: memory.id,
    category: memory.category,
    scope: memory.scope,
    source: memory.source,
    created: memory.created,
    ...(memory.last_referenced && { last_referenced: memory.last_referenced }),
    ...(memory.reference_count !== undefined && { reference_count: memory.reference_count }),
    ...(memory.tentative !== undefined && { tentative: memory.tentative }),
  };
  return serializeFrontmatter(frontmatter as unknown as Record<string, unknown>, memory.content);
}

function keywords(text: string): string[] {
  return [
    ...new Set(
      text
        .toLowerCase()
        .split(/[\s,，。.;；:：/\\|()[\]{}"'`<>]+/)
        .map((part) => part.trim())
        .filter((part) => part.length >= 2),
    ),
  ];
}

function overlapScore(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const bSet = new Set(b);
  const hit = a.filter((item) => bSet.has(item)).length;
  return hit / Math.max(a.length, b.length);
}
