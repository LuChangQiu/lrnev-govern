/**
 * Guidance Surface 扫描器
 *
 * ⚠️ 历史工具（scene04 研究期；3.0.0 起由 T-027 体系接替，勿随意重跑）：
 * 02-00 guidance-surface-inventory 研究收尾产物，扫描口径随 3.0.0 源码已过时
 * （严格校验阈值/正则假定与现行 tools/index.ts 注册形态不保证对齐）。
 * 输出固定为 -v4 续版文件名，避免复活已被 0464c2e 删除的 v1 活档
 * （guidance-surface-inventory.md/.json）；重跑只新写 v4 文件，不覆盖现有档案。
 *
 * 扫描 lrnev-govern 代码库中所有会影响客户端 AI 判断或 MCP 数据交付的 Guidance Surface。
 *
 * Spec: 02-00-guidance-surface-inventory
 * Task: T-001 实现 Surface 扫描器与清单数据契约
 *
 * 使用方法：
 *   npx tsx scripts/scan-guidance-surfaces.ts
 *
 * 输出：
 *   - dev-docs/ai-guidance-standardization/guidance-surface-inventory-v4.md
 *   - dev-docs/ai-guidance-standardization/guidance-surface-inventory-v4.json
 */

import { createHash } from 'node:crypto';
import { resolve, relative, dirname } from 'node:path';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type {
  GuidanceSurface,
  SurfaceInventory,
  SurfaceChannel,
  SemanticRole,
  Consumer,
  ScanError,
  ScanResult,
} from '../tests/fixtures/guidance-surface/surface-schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..');

/**
 * 计数规则（避免 T-002 教训）：
 *
 * - Surface = 每个独立的 guidance 入口（一个 tool description = 1）
 * - 同一 tool 的 title + description + input schema fields = 多个 surfaces
 * - hash 冲突 = 内容完全相同的 surfaces
 * - 预算 = 字符数 / 4（token 估算）
 */

/**
 * 生成 stable surface_id
 *
 * 格式：channel:category:name
 * 例如：tool_metadata:scene:scene_create_title
 */
function generateSurfaceId(channel: SurfaceChannel, category: string, name: string): string {
  return `${channel}:${category}:${name}`;
}

/**
 * 计算内容 hash（SHA256）
 */
function calculateContentHash(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * 计算预算
 */
function calculateBudget(content: string): { chars: number; tokens_estimate: number } {
  const chars = content.length;
  const tokens_estimate = Math.ceil(chars / 4); // 简单估算：4 字符 ≈ 1 token
  return { chars, tokens_estimate };
}

/**
 * 规范化文件路径（相对于项目根）
 */
function normalizeFilePath(absolutePath: string): string {
  return relative(PROJECT_ROOT, absolutePath).replace(/\\/g, '/');
}

/**
 * 扫描器主类
 */
class SurfaceScanner {
  private surfaces: GuidanceSurface[] = [];
  private errors: ScanError[] = [];

  /**
   * 执行完整扫描
   */
  scan(): ScanResult {
    this.surfaces = [];
    this.errors = [];

    try {
      // 阶段 1：扫描 MCP server instructions
      this.scanServerInstructions();

      // 阶段 2：扫描 tool metadata（title + description）
      this.scanToolMetadata();

      // 阶段 3：扫描 tool input schemas (Zod .describe())
      this.scanToolInputSchemas();

      // 阶段 4：扫描 ai_followup 生成点
      this.scanAiFollowup();

      // 阶段 5：扫描错误消息
      this.scanErrorMessages();

      // 阶段 6：扫描 tool annotations
      this.scanToolAnnotations();

      // 阶段 7：扫描 MCP resources
      this.scanMcpResources();

      // 阶段 8：扫描 governance docs
      this.scanGovernanceDocs();

      // 如果有错误，返回失败
      if (this.errors.length > 0) {
        return {
          ok: false,
          errors: this.errors,
        };
      }

      // 生成清单
      const inventory = this.buildInventory();

      return {
        ok: true,
        inventory,
      };
    } catch (error) {
      this.errors.push({
        source: { file: 'scan-guidance-surfaces.ts' },
        field: 'scan',
        message: error instanceof Error ? error.message : String(error),
      });
      return {
        ok: false,
        errors: this.errors,
      };
    }
  }

  /**
   * 扫描 server instructions
   */
  private scanServerInstructions(): void {
    const guidanceFile = resolve(PROJECT_ROOT, 'src/mcp/guidance.ts');
    if (!existsSync(guidanceFile)) {
      this.errors.push({
        source: { file: 'src/mcp/guidance.ts' },
        field: 'file',
        message: 'guidance.ts not found',
      });
      return;
    }

    const content = readFileSync(guidanceFile, 'utf-8');

    // 提取 WORKFLOW_OVERVIEW (array format)
    const workflowMatch = content.match(/export const WORKFLOW_OVERVIEW = \[([\s\S]*?)\]\.join\('\\n'\);/);
    if (workflowMatch) {
      // Extract the array items
      const arrayContent = workflowMatch[1];
      const items = arrayContent.match(/'([^']+)'/g);
      if (items) {
        const workflowContent = items.map(item => item.slice(1, -1)).join('\n');
        this.addSurface({
          surface_id: generateSurfaceId('server_instructions', 'global', 'workflow_overview'),
          source: {
            file: normalizeFilePath(guidanceFile),
            symbol: 'WORKFLOW_OVERVIEW',
            line: this.findLineNumber(content, 'WORKFLOW_OVERVIEW'),
          },
          channel: 'server_instructions',
          trigger: 'MCP server initialization',
          consumer: 'model',
          content: workflowContent,
          content_hash: calculateContentHash(workflowContent),
          budget: calculateBudget(workflowContent),
          capability_note: null,
          role: 'RECOMMENDATION',
          provenance: 'lrnev',
          enforcement: 'none',
        });
      }
    } else {
      this.errors.push({
        source: { file: normalizeFilePath(guidanceFile), symbol: 'WORKFLOW_OVERVIEW' },
        field: 'content',
        message: 'WORKFLOW_OVERVIEW not found in guidance.ts',
      });
    }
  }

  /**
   * 扫描 tool metadata (title + description)
   */
  private scanToolMetadata(): void {
    const guidanceFile = resolve(PROJECT_ROOT, 'src/mcp/guidance.ts');
    if (!existsSync(guidanceFile)) {
      return; // Already reported error
    }

    const guidanceContent = readFileSync(guidanceFile, 'utf-8');

    // 提取 TOOL_DESCRIPTIONS 对象
    const toolDescMatch = guidanceContent.match(/export const TOOL_DESCRIPTIONS = \{([\s\S]*?)\} as const;/);
    if (!toolDescMatch) {
      this.errors.push({
        source: { file: normalizeFilePath(guidanceFile), symbol: 'TOOL_DESCRIPTIONS' },
        field: 'content',
        message: 'TOOL_DESCRIPTIONS not found in guidance.ts',
      });
      return;
    }

    // 解析 TOOL_DESCRIPTIONS 的每个条目（支持多行字符串）
    const descriptionsBlock = toolDescMatch[1];

    // 更健壮的解析：逐行匹配 key: 'value' 对
    const lines = descriptionsBlock.split('\n');
    const descriptions = new Map<string, string>();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const match = line.match(/^(\w+):\s*'(.*)$/);
      if (match) {
        const key = match[1];
        let value = match[2];

        // 检查是否是多行字符串（未闭合的引号）
        if (!value.endsWith("',") && !value.endsWith("'")) {
          // 继续读取直到找到闭合引号
          for (let j = i + 1; j < lines.length; j++) {
            value += '\n' + lines[j].trim();
            if (lines[j].includes("',") || lines[j].includes("'")) {
              i = j;
              break;
            }
          }
        }

        // 移除结尾的 ', 或 '
        value = value.replace(/[',]*$/, '');
        descriptions.set(key, value);
      }
    }

    // 扫描 tools/index.ts 中的工具注册
    const toolsFile = resolve(PROJECT_ROOT, 'src/mcp/tools/index.ts');
    if (!existsSync(toolsFile)) {
      this.errors.push({
        source: { file: 'src/mcp/tools/index.ts' },
        field: 'file',
        message: 'tools/index.ts not found',
      });
      return;
    }

    const toolsContent = readFileSync(toolsFile, 'utf-8');

    // 提取所有 registerTool 调用
    const registerToolPattern = /server\.registerTool\(\s*'([^']+)',\s*\{[^}]*title:\s*'([^']+)'[^}]*description:\s*TOOL_DESCRIPTIONS\.(\w+)/gs;
    let match;

    while ((match = registerToolPattern.exec(toolsContent)) !== null) {
      const toolName = match[1];
      const title = match[2];
      const descKey = match[3];

      // Title surface
      this.addSurface({
        surface_id: generateSurfaceId('tool_metadata', toolName, 'title'),
        source: {
          file: normalizeFilePath(toolsFile),
          symbol: toolName,
          line: this.findLineNumber(toolsContent, match[0]),
        },
        channel: 'tool_metadata',
        trigger: `Tool ${toolName} listing/invocation`,
        consumer: 'both',
        content: title,
        content_hash: calculateContentHash(title),
        budget: calculateBudget(title),
        capability_note: null,
        role: 'FACT',
        provenance: 'lrnev',
        enforcement: 'none',
      });

      // Description surface - 从 TOOL_DESCRIPTIONS 提取真实内容
      const description = descriptions.get(descKey);
      if (description) {
        this.addSurface({
          surface_id: generateSurfaceId('tool_metadata', toolName, 'description'),
          source: {
            file: normalizeFilePath(guidanceFile),
            symbol: `TOOL_DESCRIPTIONS.${descKey}`,
          },
          channel: 'tool_metadata',
          trigger: `Tool ${toolName} listing/invocation`,
          consumer: 'both',
          content: description,
          content_hash: calculateContentHash(description),
          budget: calculateBudget(description),
          capability_note: null,
          role: 'RECOMMENDATION',
          provenance: 'lrnev',
          enforcement: 'none',
        });
      } else {
        this.errors.push({
          source: { file: normalizeFilePath(guidanceFile), symbol: `TOOL_DESCRIPTIONS.${descKey}` },
          field: 'content',
          message: `Description for ${descKey} not found in TOOL_DESCRIPTIONS`,
        });
      }
    }
  }

  /**
   * 扫描 tool input schemas (Zod .describe() 调用)
   */
  private scanToolInputSchemas(): void {
    const toolsFile = resolve(PROJECT_ROOT, 'src/mcp/tools/index.ts');
    if (!existsSync(toolsFile)) {
      this.errors.push({
        source: { file: 'src/mcp/tools/index.ts' },
        field: 'file',
        message: 'tools/index.ts not found',
      });
      return;
    }

    const content = readFileSync(toolsFile, 'utf-8');
    const lines = content.split('\n');

    // 提取所有 .describe() 调用
    // 扫描每一行，查找 .describe('...') 或 .describe("...")
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const describeMatch = line.match(/\.describe\(\s*(['"])(.*?)\1\s*\)/);

      if (describeMatch) {
        const description = describeMatch[2];

        // 尝试提取字段名（向前查找 fieldName: 模式）
        let fieldName = 'unknown';
        const fieldMatch = line.match(/^\s*(\w+):\s*[^:]+\.describe\(/);
        if (fieldMatch) {
          fieldName = fieldMatch[1];
        } else {
          // 如果当前行没有字段名，可能是多行定义，向上查找
          for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
            const prevLine = lines[j];
            const prevFieldMatch = prevLine.match(/^\s*(\w+):\s*z\./);
            if (prevFieldMatch) {
              fieldName = prevFieldMatch[1];
              break;
            }
          }
        }

        this.addSurface({
          surface_id: generateSurfaceId('tool_input_schema', 'tools', `${fieldName}_line${i + 1}`),
          source: {
            file: normalizeFilePath(toolsFile),
            field: fieldName,
            line: i + 1,
          },
          channel: 'tool_input_schema',
          trigger: `Tool input validation`,
          consumer: 'both',
          content: description,
          content_hash: calculateContentHash(description),
          budget: calculateBudget(description),
          capability_note: 'Zod schema description for field validation',
          role: 'FACT',
          provenance: 'lrnev',
          enforcement: 'server_enforced',
        });
      }
    }
  }

  /**
   * 扫描 ai_followup 生成点
   */
  private scanAiFollowup(): void {
    const toolsFile = resolve(PROJECT_ROOT, 'src/mcp/tools/index.ts');
    if (!existsSync(toolsFile)) {
      return; // Already reported
    }

    const content = readFileSync(toolsFile, 'utf-8');

    // 查找 ai_followup 字段
    const followupPattern = /ai_followup:\s*\{([^}]+)\}/gs;
    let match;
    let count = 0;

    while ((match = followupPattern.exec(content)) !== null) {
      count++;
      const followupContent = match[1];

      this.addSurface({
        surface_id: generateSurfaceId('ai_followup', 'inline', `followup_${count}`),
        source: {
          file: normalizeFilePath(toolsFile),
          line: this.findLineNumber(content, match[0]),
        },
        channel: 'ai_followup',
        trigger: 'Tool result with ai_followup',
        consumer: 'model',
        content: followupContent,
        content_hash: calculateContentHash(followupContent),
        budget: calculateBudget(followupContent),
        capability_note: 'Inline ai_followup in tool result',
        role: 'ACTION_HINT',
        provenance: 'lrnev',
        enforcement: 'none',
      });
    }
  }

  /**
   * 扫描错误消息
   */
  private scanErrorMessages(): void {
    const errorsFile = resolve(PROJECT_ROOT, 'src/shared/errors.ts');
    if (!existsSync(errorsFile)) {
      this.errors.push({
        source: { file: 'src/shared/errors.ts' },
        field: 'file',
        message: 'errors.ts not found',
      });
      return;
    }

    const content = readFileSync(errorsFile, 'utf-8');

    // 查找 DEFAULT_ERROR_HINTS
    const hintsMatch = content.match(/export const DEFAULT_ERROR_HINTS: Record<ErrorCode, string> = \{([^}]+)\}/s);
    if (hintsMatch) {
      // 简单提取：实际应该更健壮
      const hintsContent = hintsMatch[1];
      const hintPattern = /\[ErrorCode\.([^\]]+)\]:\s*'([^']+)'/g;
      let match;

      while ((match = hintPattern.exec(hintsContent)) !== null) {
        const errorCode = match[1];
        const hint = match[2];

        this.addSurface({
          surface_id: generateSurfaceId('error_message', 'default_hint', errorCode.toLowerCase()),
          source: {
            file: normalizeFilePath(errorsFile),
            symbol: 'DEFAULT_ERROR_HINTS',
            field: errorCode,
          },
          channel: 'error_message',
          trigger: `Error with code ${errorCode}`,
          consumer: 'model',
          content: hint,
          content_hash: calculateContentHash(hint),
          budget: calculateBudget(hint),
          capability_note: null,
          role: 'EXECUTION_CONSTRAINT',
          provenance: 'lrnev',
          enforcement: 'server_enforced',
        });
      }
    }
  }

  /**
   * 扫描 tool annotations
   */
  private scanToolAnnotations(): void {
    const toolsFile = resolve(PROJECT_ROOT, 'src/mcp/tools/index.ts');
    if (!existsSync(toolsFile)) {
      return;
    }

    const content = readFileSync(toolsFile, 'utf-8');

    // 查找 annotations 对象
    const annotationsPattern = /annotations:\s*\{\s*([^}]+)\s*\}/gs;
    let match;
    let count = 0;

    while ((match = annotationsPattern.exec(content)) !== null) {
      count++;
      const annotationsContent = match[1];

      this.addSurface({
        surface_id: generateSurfaceId('tool_annotations', 'metadata', `annotations_${count}`),
        source: {
          file: normalizeFilePath(toolsFile),
          line: this.findLineNumber(content, match[0]),
        },
        channel: 'tool_annotations',
        trigger: 'Tool registration',
        consumer: 'client',
        content: annotationsContent,
        content_hash: calculateContentHash(annotationsContent),
        budget: calculateBudget(annotationsContent),
        capability_note: 'MCP annotations are hints, not enforcement',
        role: 'RECOMMENDATION',
        provenance: 'lrnev',
        enforcement: 'client_boundary',
      });
    }
  }

  /**
   * 扫描 MCP resources
   */
  private scanMcpResources(): void {
    const resourcesFile = resolve(PROJECT_ROOT, 'src/mcp/resources/index.ts');
    if (!existsSync(resourcesFile)) {
      this.errors.push({
        source: { file: 'src/mcp/resources/index.ts' },
        field: 'file',
        message: 'resources/index.ts not found',
      });
      return;
    }

    const content = readFileSync(resourcesFile, 'utf-8');

    // 匹配 registerFixed 和 registerTemplate 包装函数调用
    // registerFixed(server, 'name', 'uri', 'description')
    // registerTemplate(server, 'name', 'uriTemplate', 'description')
    const wrapperPattern = /register(?:Fixed|Template)\(\s*server,\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\)/gs;
    let match;

    while ((match = wrapperPattern.exec(content)) !== null) {
      const name = match[1];
      const uri = match[2];
      const description = match[3];

      this.addSurface({
        surface_id: generateSurfaceId('mcp_resource', 'definition', name.replace(/[^a-z0-9]/gi, '_').toLowerCase()),
        source: {
          file: normalizeFilePath(resourcesFile),
          line: this.findLineNumber(content, match[0]),
        },
        channel: 'mcp_resource',
        trigger: `MCP resource read: ${uri}`,
        consumer: 'both',
        content: description,
        content_hash: calculateContentHash(description),
        budget: calculateBudget(description),
        capability_note: `MCP resource at ${uri}`,
        role: 'FACT',
        provenance: 'workspace',
        enforcement: 'none',
      });
    }
  }

  /**
   * 扫描 governance docs
   */
  private scanGovernanceDocs(): void {
    // 扫描 Scene 和 Spec 的治理文档
    const scenesDir = resolve(PROJECT_ROOT, '.lrnev/scenes');
    if (!existsSync(scenesDir)) {
      return;
    }

    const scenes = readdirSync(scenesDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    for (const sceneId of scenes) {
      // Scene-level docs
      const sceneDocFiles = ['scene.md', 'architecture.md', 'roadmap.md'];
      for (const docFile of sceneDocFiles) {
        const docPath = resolve(scenesDir, sceneId, docFile);
        if (existsSync(docPath)) {
          const docContent = readFileSync(docPath, 'utf-8');
          const preview = docContent.substring(0, 200);

          this.addSurface({
            surface_id: generateSurfaceId('governance_doc', sceneId, docFile.replace('.md', '')),
            source: {
              file: normalizeFilePath(docPath),
            },
            channel: 'governance_doc',
            trigger: `Reading ${docFile} for scene ${sceneId}`,
            consumer: 'model',
            content: preview,
            content_hash: calculateContentHash(docContent),
            budget: calculateBudget(docContent),
            capability_note: `Scene governance document: ${docFile}`,
            role: 'FACT',
            provenance: 'workspace',
            enforcement: 'none',
          });
        }
      }

      // Spec-level docs
      const specsDir = resolve(scenesDir, sceneId, 'specs');
      if (existsSync(specsDir)) {
        const specs = readdirSync(specsDir, { withFileTypes: true })
          .filter((dirent) => dirent.isDirectory())
          .map((dirent) => dirent.name);

        for (const specId of specs) {
          const specDocFiles = ['requirements.md', 'design.md', 'tasks.md'];
          for (const docFile of specDocFiles) {
            const docPath = resolve(specsDir, specId, docFile);
            if (existsSync(docPath)) {
              const docContent = readFileSync(docPath, 'utf-8');
              const preview = docContent.substring(0, 200);

              this.addSurface({
                surface_id: generateSurfaceId('governance_doc', `${sceneId}_${specId}`, docFile.replace('.md', '')),
                source: {
                  file: normalizeFilePath(docPath),
                },
                channel: 'governance_doc',
                trigger: `Reading ${docFile} for spec ${sceneId}/${specId}`,
                consumer: 'model',
                content: preview,
                content_hash: calculateContentHash(docContent),
                budget: calculateBudget(docContent),
                capability_note: `Spec governance document: ${docFile}`,
                role: 'FACT',
                provenance: 'workspace',
                enforcement: 'none',
              });
            }
          }
        }
      }
    }
  }

  /**
   * 添加 surface（带必填字段校验）
   */
  private addSurface(surface: GuidanceSurface): void {
    // 校验必填字段
    const requiredFields: Array<keyof GuidanceSurface> = [
      'surface_id',
      'source',
      'channel',
      'trigger',
      'consumer',
      'content',
      'content_hash',
    ];

    for (const field of requiredFields) {
      if (surface[field] === undefined || surface[field] === null || surface[field] === '') {
        this.errors.push({
          surface_id: surface.surface_id,
          source: surface.source,
          field,
          message: `Required field '${field}' is missing or empty`,
        });
        return;
      }
    }

    this.surfaces.push(surface);
  }

  /**
   * 查找行号（简单实现）
   */
  private findLineNumber(content: string, searchText: string): number {
    const index = content.indexOf(searchText);
    if (index === -1) return 0;
    return content.substring(0, index).split('\n').length;
  }

  /**
   * 构建清单
   */
  private buildInventory(): SurfaceInventory {
    const statistics = this.calculateStatistics();

    return {
      baseline_date: new Date().toISOString().split('T')[0],
      spec: '02-00-guidance-surface-inventory',
      status: 'draft',
      surfaces: this.surfaces,
      statistics,
    };
  }

  /**
   * 计算统计信息
   */
  private calculateStatistics() {
    const by_channel: Record<SurfaceChannel, number> = {
      server_instructions: 0,
      tool_metadata: 0,
      tool_input_schema: 0,
      tool_output_schema: 0,
      tool_result_content: 0,
      tool_result_structured: 0,
      tool_annotations: 0,
      mcp_resource: 0,
      ai_followup: 0,
      error_message: 0,
      governance_doc: 0,
      client_rule: 0,
    };

    const by_role: Partial<Record<SemanticRole, number>> = {};
    const by_consumer: Record<Consumer, number> = {
      client: 0,
      model: 0,
      both: 0,
      human: 0,
    };

    let total_chars = 0;
    let total_tokens = 0;

    for (const surface of this.surfaces) {
      by_channel[surface.channel]++;

      if (surface.role) {
        by_role[surface.role] = (by_role[surface.role] || 0) + 1;
      }

      by_consumer[surface.consumer]++;

      if (surface.budget) {
        total_chars += surface.budget.chars;
        total_tokens += surface.budget.tokens_estimate;
      }
    }

    return {
      total_surfaces: this.surfaces.length,
      by_channel,
      by_role,
      by_consumer,
      total_budget: {
        chars: total_chars,
        tokens_estimate: total_tokens,
      },
    };
  }
}

/**
 * 生成 Markdown 清单报告
 */
function generateMarkdownReport(inventory: SurfaceInventory): string {
  const lines: string[] = [];

  lines.push('# lrnev Guidance Surface Inventory');
  lines.push('');
  lines.push(`**Baseline Date**: ${inventory.baseline_date}`);
  lines.push(`**Spec**: ${inventory.spec}`);
  lines.push(`**Status**: ${inventory.status}`);
  lines.push('');

  // 统计摘要
  lines.push('## Summary Statistics');
  lines.push('');
  lines.push(`- **Total Surfaces**: ${inventory.statistics.total_surfaces}`);
  lines.push('');

  lines.push('### By Channel');
  lines.push('');
  for (const [channel, count] of Object.entries(inventory.statistics.by_channel)) {
    if (count > 0) {
      lines.push(`- ${channel}: ${count}`);
    }
  }
  lines.push('');

  lines.push('### By Consumer');
  lines.push('');
  for (const [consumer, count] of Object.entries(inventory.statistics.by_consumer)) {
    if (count > 0) {
      lines.push(`- ${consumer}: ${count}`);
    }
  }
  lines.push('');

  if (Object.keys(inventory.statistics.by_role).length > 0) {
    lines.push('### By Role');
    lines.push('');
    for (const [role, count] of Object.entries(inventory.statistics.by_role)) {
      lines.push(`- ${role}: ${count}`);
    }
    lines.push('');
  }

  lines.push('### Total Budget');
  lines.push('');
  lines.push(`- Characters: ${inventory.statistics.total_budget.chars.toLocaleString()}`);
  lines.push(`- Tokens (estimate): ${inventory.statistics.total_budget.tokens_estimate.toLocaleString()}`);
  lines.push('');

  // Surface 目录
  lines.push('## Surface Catalog');
  lines.push('');

  const surfacesByChannel = new Map<SurfaceChannel, GuidanceSurface[]>();
  for (const surface of inventory.surfaces) {
    if (!surfacesByChannel.has(surface.channel)) {
      surfacesByChannel.set(surface.channel, []);
    }
    surfacesByChannel.get(surface.channel)!.push(surface);
  }

  for (const [channel, surfaces] of surfacesByChannel) {
    lines.push(`### ${channel}`);
    lines.push('');

    for (const surface of surfaces) {
      lines.push(`#### \`${surface.surface_id}\``);
      lines.push('');
      lines.push(`- **Source**: \`${surface.source.file}\``);
      if (surface.source.symbol) lines.push(`  - Symbol: \`${surface.source.symbol}\``);
      if (surface.source.field) lines.push(`  - Field: \`${surface.source.field}\``);
      if (surface.source.line) lines.push(`  - Line: ${surface.source.line}`);
      lines.push(`- **Trigger**: ${surface.trigger}`);
      lines.push(`- **Consumer**: ${surface.consumer}`);
      lines.push(`- **Content Hash**: \`${surface.content_hash.substring(0, 16)}...\``);
      if (surface.budget) {
        lines.push(`- **Budget**: ${surface.budget.chars} chars / ~${surface.budget.tokens_estimate} tokens`);
      }
      if (surface.role) lines.push(`- **Role**: ${surface.role}`);
      if (surface.provenance) lines.push(`- **Provenance**: ${surface.provenance}`);
      if (surface.enforcement) lines.push(`- **Enforcement**: ${surface.enforcement}`);
      if (surface.owner) lines.push(`- **Owner**: ${surface.owner}`);
      if (surface.capability_note !== undefined) {
        lines.push(`- **Capability Note**: ${surface.capability_note || 'null'}`);
      }
      lines.push('');
      lines.push('<details>');
      lines.push('<summary>Content Preview</summary>');
      lines.push('');
      lines.push('```');
      lines.push(surface.content.substring(0, 500) + (surface.content.length > 500 ? '...' : ''));
      lines.push('```');
      lines.push('</details>');
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * 主入口
 */
function main(): void {
  console.log('Scanning Guidance Surfaces...');

  const scanner = new SurfaceScanner();
  const result = scanner.scan();

  if (!result.ok) {
    console.error('Scan failed with errors:');
    for (const error of result.errors!) {
      console.error(`  - ${error.source.file}:${error.source.line || '?'} [${error.field}] ${error.message}`);
    }
    process.exit(1);
  }

  const inventory = result.inventory!;
  console.log(`Found ${inventory.statistics.total_surfaces} surfaces`);

  // 验证扫描结果
  const inputSchemaCount = inventory.surfaces.filter(s => s.channel === 'tool_input_schema').length;
  const resourceCount = inventory.surfaces.filter(s => s.channel === 'mcp_resource').length;

  console.log(`  - Input schemas: ${inputSchemaCount}`);
  console.log(`  - MCP resources: ${resourceCount}`);

  if (inputSchemaCount === 0) {
    console.warn(`⚠️ Warning: 0 input schemas found, expected ≥121`);
  }
  if (resourceCount === 0) {
    console.warn(`⚠️ Warning: 0 MCP resources found, expected ≥17`);
  }

  // 严格模式：验证预期目标
  if (inputSchemaCount < 121) {
    throw new Error(`Scan validation failed: inputSchemas=${inputSchemaCount} (expected ≥121)`);
  }
  if (resourceCount < 17) {
    throw new Error(`Scan validation failed: resources=${resourceCount} (expected ≥17)`);
  }

  // 生成 Markdown 报告（v4 续版名——v1 名已于 0464c2e 删除，勿改回以免复活活档）
  const markdown = generateMarkdownReport(inventory);
  const outputPath = resolve(PROJECT_ROOT, 'dev-docs/ai-guidance-standardization/guidance-surface-inventory-v4.md');

  writeFileSync(outputPath, markdown, 'utf-8');
  console.log(`Inventory written to: ${outputPath}`);

  // 同时输出 JSON（用于机器可读）
  const jsonPath = resolve(PROJECT_ROOT, 'dev-docs/ai-guidance-standardization/guidance-surface-inventory-v4.json');
  writeFileSync(jsonPath, JSON.stringify(inventory, null, 2), 'utf-8');
  console.log(`JSON inventory written to: ${jsonPath}`);

  console.log('\nScan completed successfully.');
}

// 直接运行时执行
main();
