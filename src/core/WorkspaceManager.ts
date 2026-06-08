/**
 * WorkspaceManager 负责工作区初始化和项目骨架维护。
 *
 * 这一层面向 MCP/CLI 的 lrnev_init，把存储层的惰性初始化补成用户可读的
 * PROJECT、ARCHITECTURE、steering 和最小 codebase 探测结果。
 */

import { basename, resolve } from 'node:path';

import { FileStorage } from '../storage/FileStorage.js';
import { ensureWorkspace, resolveWorkspaceRoot } from '../storage/WorkspaceLocator.js';
import { AutoAnalyzer } from './AutoAnalyzer.js';
import { DEFAULT_SCENE_ID, SceneManager } from './SceneManager.js';
import { renderTemplate, today } from './Templates.js';
import type { CodebaseInfo } from '../types/auto-analyzer.js';
import type { AiFollowupResponse } from '../types/response.js';
import type { InitWorkspaceInput, InitWorkspaceResult } from '../types/workspace.js';

const STANDARD_DIRS = [
  '.lrnev',
  '.lrnev/scenes',
  '.lrnev/decisions/adr',
  '.lrnev/errorbook',
  '.lrnev/errorbook/incidents',
  '.lrnev/errorbook/promoted',
  '.lrnev/memory',
  '.lrnev/memory/preferences',
  '.lrnev/memory/decisions',
  '.lrnev/memory/patterns',
  '.lrnev/memory/errors',
  '.lrnev/memory/facts',
  '.lrnev/steering',
  '.lrnev/auto',
  '.lrnev/config',
  '.lrnev/agents',
  '.lrnev/runtime',
  '.lrnev/runtime/claims',
  '.lrnev/locks',
  '.lrnev/state',
  `.lrnev/scenes/${DEFAULT_SCENE_ID}`,
  `.lrnev/scenes/${DEFAULT_SCENE_ID}/specs`,
];

const STEERING_FILES = [
  'CORE_PRINCIPLES.md',
  'SCOPE_RULES.md',
  'ADR_TRIGGERS.md',
  'MEMORY_TRIGGERS.md',
];

export class WorkspaceManager {
  async init(input: InitWorkspaceInput = {}): Promise<AiFollowupResponse<InitWorkspaceResult>> {
    const location = input.root ? undefined : resolveWorkspaceRoot();
    const root = input.root ?? location!.root;
    // 护栏：向上查找命中了"祖先"的已有 .lrnev（root ≠ 当前目录），多半不是用户想要的项目根。
    const ancestorHit = !input.root
      && location!.source === 'lookup'
      && resolve(location!.root) !== resolve(process.cwd());
    const projectName = input.project_name ?? basename(root);
    const wasNew = await ensureWorkspace(root);
    const fs = new FileStorage(root);

    const filesCreated: string[] = [];
    const filesExisting: string[] = [];

    await this.writeIfMissing(
      fs,
      '.lrnev/PROJECT.md',
      await renderTemplate('project', 'PROJECT.md', {
        project_name: projectName,
        date: today(),
      }),
      filesCreated,
      filesExisting,
    );

    const analysis = await this.runAutoAnalyzer(fs, filesCreated, filesExisting);
    const codebaseDetected = hasExistingCodeProject(analysis);

    await this.writeIfMissing(
      fs,
      '.lrnev/ARCHITECTURE.md',
      await renderTemplate('project', 'ARCHITECTURE.md', {
        project_name: projectName,
        date: today(),
        tech_stack: formatTechStack(analysis),
        source_dirs: formatSourceDirs(analysis),
        directory_structure: formatDirectoryStructure(analysis),
      }),
      filesCreated,
      filesExisting,
    );

    for (const file of STEERING_FILES) {
      await this.writeIfMissing(
        fs,
        `.lrnev/steering/${file}`,
        await renderTemplate('steering', file),
        filesCreated,
        filesExisting,
      );
    }

    const defaultScenePath = `.lrnev/scenes/${DEFAULT_SCENE_ID}/scene.md`;
    const defaultSceneExisted = fs.exists(defaultScenePath);
    await new SceneManager(fs).ensureExists(DEFAULT_SCENE_ID);
    if (defaultSceneExisted) filesExisting.push(defaultScenePath);
    else filesCreated.push(defaultScenePath);

    return {
      ok: true,
      data: {
        root,
        was_new: wasNew,
        files_created: filesCreated,
        files_existing: filesExisting,
        directories_ensured: STANDARD_DIRS,
        codebase_detected: codebaseDetected,
      },
      ai_followup: {
        instructions: [
          ...(ancestorHit
            ? [`注意：工作区根定位到 ${root}（向上查找命中了已有的 .lrnev，而非当前目录）。若这不是你要的项目根，请设环境变量 LRNEV_WORKSPACE=<目标目录>，或在目标目录显式 lrnev_init。`]
            : []),
          ...(codebaseDetected
            ? [
              '检测到当前目录已有代码。请读项目的构建/清单文件（如 pom.xml、build.gradle、package.json、go.mod、pyproject.toml 等，按实际为准且不限于这些）与 3-5 个核心源码文件，自行判断技术栈与架构；auto/codebase.json 只是未经核实的探测信号，仅供参考。请补全 ARCHITECTURE.md 的技术栈/主要模块/架构理念，以及 PROJECT.md 的项目目标/当前阶段。',
            ]
            : []),
          '请先阅读 context://project 和 context://project/architecture，协助用户补全项目目标、范围和架构约束。',
          `可以直接调用 spec_create；不传 scene 时会挂到 ${DEFAULT_SCENE_ID}。`,
          '如果多个 Spec 需要共享边界和架构约束，再调用 scene_create 创建正式业务 Scene。',
        ],
        suggested_tools: [
          {
            name: 'spec_create',
            args_template: { name: '<feature-name>' },
            reason: `默认挂到 ${DEFAULT_SCENE_ID}，无需为小需求先创建 Scene`,
          },
        ],
      },
    };
  }

  private async writeIfMissing(
    fs: FileStorage,
    path: string,
    content: string,
    created: string[],
    existing: string[],
  ): Promise<void> {
    if (fs.exists(path)) {
      existing.push(path);
      return;
    }
    await fs.write(path, content);
    created.push(path);
  }

  private async runAutoAnalyzer(
    fs: FileStorage,
    created: string[],
    existing: string[],
  ): Promise<CodebaseInfo> {
    const path = '.lrnev/auto/codebase.json';
    if (fs.exists(path)) {
      existing.push(path);
      return fs.readJson<CodebaseInfo>(path);
    }
    const result = await new AutoAnalyzer(fs).analyze();
    created.push(path);
    return result.data;
  }
}

/**
 * 生态无关地判定"这是个已有代码项目"。
 *
 * 不靠识别特定 manifest（那会漏 Java/Gradle/PHP/Ruby/.NET…）：根下除 .lrnev 外
 * 只要有实质内容（任何非忽略目录或根级文件）即视为已有项目，再让 AI 去识别它是什么。
 */
function hasExistingCodeProject(analysis: CodebaseInfo): boolean {
  return analysis.tech_stack.length > 0
    || analysis.sample_files.length > 0
    || analysis.directories.length > 0
    || analysis.root_files.length > 0;
}

function formatTechStack(analysis: CodebaseInfo): string {
  if (analysis.tech_stack.length === 0) {
    return '- <!-- FILL: 技术栈；未探测到明确候选，请读构建/清单文件与源码核实 -->';
  }
  const candidates = analysis.tech_stack.map((item) => {
    const name = item.name ? ` ${item.name}` : '';
    const version = item.version ? ` ${item.version}` : '';
    return `${item.language} (${item.ecosystem})${name}${version} - ${item.manifest}`;
  });
  return `- <!-- FILL: 技术栈；自动探测疑似候选（待核实，可能不准）：${candidates.join('；')} -->`;
}

function formatSourceDirs(analysis: CodebaseInfo): string {
  const dirs = analysis.directories.filter((dir) => dir.kind === 'source' || dir.kind === 'test');
  if (dirs.length === 0) {
    return '- <!-- FILL: 主要模块/源码目录；未探测到明确候选，请读源码核实 -->';
  }
  const candidates = dirs.map((dir) => `${dir.path}/ (${dir.kind})`);
  return `- <!-- FILL: 主要模块/源码目录；自动探测疑似候选（待核实）：${candidates.join('；')} -->`;
}

function formatDirectoryStructure(analysis: CodebaseInfo): string {
  if (analysis.directories.length === 0) {
    return '<!-- FILL: 目录结构(未探测到，请补充) -->';
  }
  return analysis.directories.map((dir) => `- ${dir.path}/ (${dir.kind})`).join('\n');
}
