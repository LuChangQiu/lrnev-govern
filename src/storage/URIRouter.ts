/**
 * URIRouter —— context:// URI 双向路由
 *
 * 职责：
 *   1. parse()：把 context:// URI 拆解为结构化信息
 *   2. toFilePath()：URI → workspace 相对文件路径
 *   3. fromFilePath()：workspace 相对路径 → URI
 *
 * 设计权威：design.md 第 4 节完整路由表
 *
 * URI 形态：
 *   context://{type}[/{id}[/{sub_id}...]]?level=L0|L1|L2&scope=global|scene:{id}
 *
 * 6 大类（详见 design.md 4.1 ~ 4.5）：
 *   project / scene / spec / adr / errorbook / memory + steering + auto
 *
 * 设计注意点：
 *   - URI 内的路径用 / 分隔，与文件系统的 sep 解耦
 *   - ADR 编号映射到 4 位补零的文件前缀 + glob 找 slug
 *   - Scene ADR / errorbook / memory 走 scene/{id}/... 子前缀
 */

import { LrnevError, ErrorCode } from '../shared/errors.js';
import type { Level, Scope } from '../types/response.js';

/** context:// 协议 scheme */
export const URI_SCHEME = 'context';

/** URI 顶级类型 */
export type URIKind =
  | 'project' // PROJECT.md / ARCHITECTURE.md
  | 'auto' // auto/codebase.json
  | 'steering' // steering/{name}.md
  | 'scene' // scenes/{id}/...
  | 'spec' // scenes/{scene}/specs/{spec}/...
  | 'adr' // 全局 ADR
  | 'errorbook' // 全局错误手册
  | 'memory'; // 全局记忆

/**
 * URI 解析结果。
 *
 * scope 字段：默认 'global'，若 URI 形如 context://scene/{id}/adr/... 则
 *   - kind 仍为 'adr' / 'errorbook' / 'memory'
 *   - scope 为 `scene:{id}`
 *   这样下游 handler 不用关心 URI 形态，直接看 kind + scope。
 */
export interface ParsedURI {
  /** 原始 URI 字符串 */
  raw: string;
  /** 类型 */
  kind: URIKind;
  /** 路径段（kind 之后的部分） */
  segments: string[];
  /** 范围（来自 URI 路径前缀或 ?scope= 参数） */
  scope: Scope;
  /** 加载层级（来自 ?level=，默认 L2） */
  level: Level;
  /** 其他查询参数（保留扩展） */
  query: Record<string, string>;
}

const VALID_LEVELS: readonly Level[] = ['L0', 'L1', 'L2'];

/**
 * 解析 context:// URI。
 *
 * @throws LrnevError(INVALID_URI) 格式错误
 */
export function parseURI(uri: string): ParsedURI {
  if (typeof uri !== 'string' || uri.length === 0) {
    throw new LrnevError(ErrorCode.INVALID_URI, 'URI 不能为空', { field: 'uri' });
  }

  const schemePrefix = `${URI_SCHEME}://`;
  if (!uri.startsWith(schemePrefix)) {
    throw new LrnevError(
      ErrorCode.INVALID_URI,
      `URI 必须以 ${schemePrefix} 开头："${uri}"`,
      { field: 'uri' },
    );
  }

  // 拆 path 与 query
  const rest = uri.slice(schemePrefix.length);
  const queryIdx = rest.indexOf('?');
  const pathPart = queryIdx === -1 ? rest : rest.slice(0, queryIdx);
  const queryPart = queryIdx === -1 ? '' : rest.slice(queryIdx + 1);

  // 解析查询参数（手写，避免 URLSearchParams 对路径形式 URI 的兼容性问题）
  const query: Record<string, string> = {};
  if (queryPart.length > 0) {
    for (const pair of queryPart.split('&')) {
      if (!pair) continue;
      const [k, v = ''] = pair.split('=');
      if (k) query[decodeURIComponent(k)] = decodeURIComponent(v);
    }
  }

  // 解析 level
  let level: Level = 'L2';
  if (query.level !== undefined) {
    const upper = query.level.toUpperCase() as Level;
    if (!VALID_LEVELS.includes(upper)) {
      throw new LrnevError(
        ErrorCode.INVALID_URI,
        `level 必须是 L0/L1/L2，得到 "${query.level}"`,
        { field: 'level' },
      );
    }
    level = upper;
  }

  // 拆 path 段
  const segments = pathPart.split('/').filter((s) => s.length > 0);
  if (segments.length === 0) {
    throw new LrnevError(ErrorCode.INVALID_URI, `URI 缺少类型："${uri}"`, { field: 'uri' });
  }

  const first = segments[0]!;

  // 处理 context://scene/{id}/... 的"分支":
  //   - scene/{id} → kind=scene
  //   - scene/{id}/architecture | roadmap → kind=scene
  //   - scene/{id}/adr | adr/{n} → kind=adr, scope=scene:{id}
  //   - scene/{id}/errorbook | errorbook/{id} → kind=errorbook, scope=scene:{id}
  //   - scene/{id}/memory/{category}/... → kind=memory, scope=scene:{id}
  //   - scene/{id}/specs/... 不存在，spec URI 形态见 spec.{scene}.{spec}
  if (first === 'scene' && segments.length >= 3) {
    const sceneId = segments[1]!;
    const sub = segments[2]!;
    if (sub === 'adr') {
      return finalizeScoped(uri, 'adr', segments.slice(3), `scene:${sceneId}`, level, query);
    }
    if (sub === 'errorbook') {
      return finalizeScoped(uri, 'errorbook', segments.slice(3), `scene:${sceneId}`, level, query);
    }
    if (sub === 'memory') {
      return finalizeScoped(uri, 'memory', segments.slice(3), `scene:${sceneId}`, level, query);
    }
    // 否则仍是 scene 的子文档（architecture/roadmap）
  }

  // 处理 spec URI: context://spec/{scene}/{spec}[/{doc}]
  if (first === 'spec') {
    if (segments.length < 3) {
      throw new LrnevError(
        ErrorCode.INVALID_URI,
        `spec URI 至少需要 scene 和 spec："${uri}"`,
        { field: 'uri' },
      );
    }
    return finalizeScoped(uri, 'spec', segments.slice(1), parseScopeQuery(query), level, query);
  }

  // 其余 kind：直接取 first
  const kind = first as URIKind;
  if (!isValidKind(kind)) {
    throw new LrnevError(
      ErrorCode.INVALID_URI,
      `未知 URI 类型："${first}"`,
      { field: 'uri' },
    );
  }
  return finalizeScoped(uri, kind, segments.slice(1), parseScopeQuery(query), level, query);
}

function finalizeScoped(
  raw: string,
  kind: URIKind,
  segments: string[],
  scope: Scope,
  level: Level,
  query: Record<string, string>,
): ParsedURI {
  return { raw, kind, segments, scope, level, query };
}

function parseScopeQuery(query: Record<string, string>): Scope {
  const s = query.scope;
  if (!s || s === 'global') return 'global';
  if (s.startsWith('scene:')) return s as Scope;
  // 任何不合法值视为 global（保守）
  return 'global';
}

function isValidKind(s: string): s is URIKind {
  return ['project', 'auto', 'steering', 'scene', 'spec', 'adr', 'errorbook', 'memory'].includes(s);
}

/**
 * URI → workspace 相对文件路径（POSIX 分隔符）。
 *
 * 注意：
 *   - 部分 URI（如 context://scene 列表、context://adr 索引）不对应单个文件，
 *     这种情况返回 null，由调用方判断是否需要列表逻辑
 *   - ADR URI 含编号但实际文件名带 slug（0001-xxx.md），本函数返回"编号前缀"
 *     即调用方应当 glob "decisions/adr/0001-*.md" 才能拿到具体文件
 *
 * @returns 相对路径或路径前缀；列表 URI 返回 null
 */
export function uriToFilePath(parsed: ParsedURI): string | null {
  switch (parsed.kind) {
    case 'project':
      return resolveProject(parsed);
    case 'auto':
      return resolveAuto(parsed);
    case 'steering':
      return resolveSteering(parsed);
    case 'scene':
      return resolveScene(parsed);
    case 'spec':
      return resolveSpec(parsed);
    case 'adr':
      return resolveAdr(parsed);
    case 'errorbook':
      return resolveErrorbook(parsed);
    case 'memory':
      return resolveMemory(parsed);
  }
}

/** context://project | context://project/architecture */
function resolveProject(p: ParsedURI): string {
  if (p.segments.length === 0) return '.lrnev/PROJECT.md';
  if (p.segments[0] === 'architecture') return '.lrnev/ARCHITECTURE.md';
  throw new LrnevError(ErrorCode.INVALID_URI, `未知 project 子路径："${p.raw}"`, { field: 'uri' });
}

/** context://auto/codebase | context://auto/tech-stack */
function resolveAuto(p: ParsedURI): string {
  const sub = p.segments[0];
  if (sub === 'codebase') return '.lrnev/auto/codebase.json';
  // tech-stack / coding-style 是 codebase.json 内字段，路径仍是 codebase.json，
  // 字段提取由 handler 解析 "#fragment"
  if (sub === 'tech-stack' || sub === 'coding-style') return '.lrnev/auto/codebase.json';
  throw new LrnevError(ErrorCode.INVALID_URI, `未知 auto 子路径："${p.raw}"`, { field: 'uri' });
}

/** context://steering/{name} */
function resolveSteering(p: ParsedURI): string {
  if (p.segments.length === 0) {
    throw new LrnevError(ErrorCode.INVALID_URI, 'steering URI 缺少名称', { field: 'uri' });
  }
  // 名称大写映射（"core" → CORE_PRINCIPLES, "scope" → SCOPE_RULES, 其它原样大写）
  const name = p.segments[0]!;
  const alias: Record<string, string> = {
    core: 'CORE_PRINCIPLES',
    scope: 'SCOPE_RULES',
    adr: 'ADR_TRIGGERS',
    memory: 'MEMORY_TRIGGERS',
  };
  const fileBase = alias[name] ?? name.toUpperCase();
  return `.lrnev/steering/${fileBase}.md`;
}

/**
 * context://scene             → null（列表 URI）
 * context://scene/{id}        → scenes/{id}/scene.md
 * context://scene/{id}/architecture → architecture.md
 * context://scene/{id}/roadmap → roadmap.md
 */
function resolveScene(p: ParsedURI): string | null {
  if (p.segments.length === 0) return null; // 列表
  const id = p.segments[0]!;
  const sub = p.segments[1];
  if (!sub) return `.lrnev/scenes/${id}/scene.md`;
  if (sub === 'architecture') return `.lrnev/scenes/${id}/architecture.md`;
  if (sub === 'roadmap') return `.lrnev/scenes/${id}/roadmap.md`;
  throw new LrnevError(ErrorCode.INVALID_URI, `未知 scene 子路径："${p.raw}"`, { field: 'uri' });
}

/**
 * context://spec/{scene}/{spec}[/{doc}]
 *   doc: design | tasks ；默认 requirements
 */
function resolveSpec(p: ParsedURI): string {
  const [scene, spec, doc] = p.segments;
  if (!scene || !spec) {
    throw new LrnevError(ErrorCode.INVALID_URI, 'spec URI 至少要有 scene/spec', { field: 'uri' });
  }
  const file =
    doc === 'design' ? 'design.md' :
      doc === 'tasks' ? 'tasks.md' :
        !doc ? 'requirements.md' :
          null;
  if (!file) {
    throw new LrnevError(ErrorCode.INVALID_URI, `未知 spec 子文档："${doc}"`, { field: 'uri' });
  }
  return `.lrnev/scenes/${scene}/specs/${spec}/${file}`;
}

/**
 * context://adr | context://adr/{n}
 * Scene ADR 时，scope 为 scene:{id}，文件位于 scenes/{id}/decisions/adr/
 *
 * ADR 编号映射到 4 位补零的"前缀"，调用方需 glob 找具体文件。
 */
function resolveAdr(p: ParsedURI): string | null {
  const dir = p.scope.startsWith('scene:')
    ? `.lrnev/scenes/${p.scope.slice('scene:'.length)}/decisions/adr`
    : '.lrnev/decisions/adr';

  if (p.segments.length === 0) {
    return `${dir}/README.md`;
  }
  const n = parseInt(p.segments[0]!, 10);
  if (!Number.isInteger(n) || n <= 0) {
    throw new LrnevError(ErrorCode.INVALID_URI, `ADR 编号必须是正整数："${p.segments[0]}"`, {
      field: 'uri',
    });
  }
  // 这里产出前缀路径；实际文件需要 glob "0001-*.md" 找。
  return `${dir}/${formatAdrNumber(n)}`;
}

/** 把 ADR 编号格式化为 4 位补零字符串 */
export function formatAdrNumber(n: number): string {
  return String(n).padStart(4, '0');
}

/**
 * context://errorbook            → 索引（README.md）
 * context://errorbook/{id}       → promoted/{id}.md
 * Scene errorbook 走 scenes/{id}/errorbook/...
 */
function resolveErrorbook(p: ParsedURI): string {
  const dir = p.scope.startsWith('scene:')
    ? `.lrnev/scenes/${p.scope.slice('scene:'.length)}/errorbook`
    : '.lrnev/errorbook';

  if (p.segments.length === 0) {
    return `${dir}/README.md`;
  }
  const id = p.segments[0]!;
  return `${dir}/promoted/${id}.md`;
}

/**
 * context://memory/{category}            → null（列表）
 * context://memory/{category}/{id}       → {id}.md
 * Scene memory 走 scenes/{id}/memory/...
 */
function resolveMemory(p: ParsedURI): string | null {
  const dir = p.scope.startsWith('scene:')
    ? `.lrnev/scenes/${p.scope.slice('scene:'.length)}/memory`
    : '.lrnev/memory';

  if (p.segments.length === 0) {
    // memory 顶层列表暂不支持（必须先指定 category）
    throw new LrnevError(
      ErrorCode.INVALID_URI,
      'memory URI 必须指定分类（preferences/decisions/patterns/errors/facts）',
      { field: 'uri' },
    );
  }
  const category = p.segments[0]!;
  if (p.segments.length === 1) return null; // 列表
  const id = p.segments[1]!;
  return `${dir}/${category}/${id}.md`;
}

/**
 * 从相对文件路径反推 URI（best effort）。
 *
 * 不要求完整覆盖所有路径，主要用于：
 *   - Searcher 返回结果时把文件路径转 URI 给客户端
 *   - Doctor 引用一致性检查
 *
 * @returns 找到匹配模式时返回 URI，否则返回 null
 */
export function filePathToURI(relPath: string): string | null {
  // 统一 POSIX 分隔符
  const p = relPath.split(/\\/g).join('/');
  const prefix = '.lrnev/';
  const path = p.startsWith(prefix) ? p.slice(prefix.length) : p;

  // 全局根文档
  if (path === 'PROJECT.md') return 'context://project';
  if (path === 'ARCHITECTURE.md') return 'context://project/architecture';
  if (path === 'auto/codebase.json') return 'context://auto/codebase';

  // steering
  const steeringMatch = /^steering\/(.+)\.md$/.exec(path);
  if (steeringMatch) {
    const name = steeringMatch[1]!;
    const reverseAlias: Record<string, string> = {
      CORE_PRINCIPLES: 'core',
      SCOPE_RULES: 'scope',
      ADR_TRIGGERS: 'adr',
      MEMORY_TRIGGERS: 'memory',
    };
    return `context://steering/${reverseAlias[name] ?? name.toLowerCase()}`;
  }

  // 全局 ADR
  const globalAdrMatch = /^decisions\/adr\/(\d{4})-.+\.md$/.exec(path);
  if (globalAdrMatch) {
    return `context://adr/${parseInt(globalAdrMatch[1]!, 10)}`;
  }
  if (path === 'decisions/adr/README.md') return 'context://adr';

  // 全局 errorbook（仅 promoted/*.md，incidents 不对外暴露 URI）
  const ebMatch = /^errorbook\/promoted\/(.+)\.md$/.exec(path);
  if (ebMatch) return `context://errorbook/${ebMatch[1]!}`;
  if (path === 'errorbook/README.md') return 'context://errorbook';

  // 全局 memory
  const memMatch = /^memory\/([^/]+)\/(.+)\.md$/.exec(path);
  if (memMatch) return `context://memory/${memMatch[1]!}/${memMatch[2]!}`;

  // Scene 子文档
  const sceneDocMatch = /^scenes\/([^/]+)\/(scene|architecture|roadmap)\.md$/.exec(path);
  if (sceneDocMatch) {
    const [, sceneId, doc] = sceneDocMatch;
    if (doc === 'scene') return `context://scene/${sceneId}`;
    return `context://scene/${sceneId}/${doc}`;
  }

  // Spec 三文档
  const specMatch = /^scenes\/([^/]+)\/specs\/([^/]+)\/(requirements|design|tasks)\.md$/.exec(path);
  if (specMatch) {
    const [, scene, spec, doc] = specMatch;
    if (doc === 'requirements') return `context://spec/${scene}/${spec}`;
    return `context://spec/${scene}/${spec}/${doc}`;
  }

  // Scene ADR
  const sceneAdrMatch = /^scenes\/([^/]+)\/decisions\/adr\/(\d{4})-.+\.md$/.exec(path);
  if (sceneAdrMatch) {
    return `context://scene/${sceneAdrMatch[1]!}/adr/${parseInt(sceneAdrMatch[2]!, 10)}`;
  }

  // Scene errorbook
  const sceneEbMatch = /^scenes\/([^/]+)\/errorbook\/promoted\/(.+)\.md$/.exec(path);
  if (sceneEbMatch) {
    return `context://scene/${sceneEbMatch[1]!}/errorbook/${sceneEbMatch[2]!}`;
  }

  // Scene memory
  const sceneMemMatch = /^scenes\/([^/]+)\/memory\/([^/]+)\/(.+)\.md$/.exec(path);
  if (sceneMemMatch) {
    const [, sceneId, cat, id] = sceneMemMatch;
    return `context://scene/${sceneId}/memory/${cat}/${id}`;
  }

  return null;
}
