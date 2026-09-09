/**
 * WorkspaceManager 负责工作区初始化和项目骨架维护。
 *
 * 这一层面向 MCP/CLI 的 lrnev_init，把存储层的惰性初始化补成用户可读的
 * PROJECT、ARCHITECTURE 与 steering 骨架。PROJECT/ARCHITECTURE 由模板直接
 * 写入静态 FILL 哨兵（lrnev 不做自动代码库探测），由 AI 读构建/清单文件与
 * 源码后自行补全。
 */

import { basename, resolve } from 'node:path';

import { FileStorage } from '../storage/FileStorage.js';
import { ensureWorkspace, resolveWorkspaceRoot } from '../storage/WorkspaceLocator.js';
import { DEFAULT_SCENE_ID, SceneManager } from './SceneManager.js';
import { renderTemplate, today } from './Templates.js';
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
  'CONTEXT_DOCS_TRIGGERS.md',
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

    await this.writeIfMissing(
      fs,
      '.lrnev/ARCHITECTURE.md',
      await renderTemplate('project', 'ARCHITECTURE.md', {
        project_name: projectName,
        date: today(),
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

    // hooks 配置开箱即用：scaffold 一个空数组（缺该文件时 hook 操作不可用；对象形会 HOOK_CONFIG_INVALID）。
    await this.writeIfMissing(fs, '.lrnev/config/hooks.json', '[]\n', filesCreated, filesExisting);

    const defaultScenePath = `.lrnev/scenes/${DEFAULT_SCENE_ID}/scene.md`;
    const defaultSceneExisted = fs.exists(defaultScenePath);
    await new SceneManager(fs).ensureExists(DEFAULT_SCENE_ID);
    if (defaultSceneExisted) filesExisting.push(defaultScenePath);
    else filesCreated.push(defaultScenePath);

    // ADR 0003（2026-09）：可选生成项目根指针式 AGENTS.md（引用 .lrnev/steering）。
    // 只在用户明确同意（CLI 询问 y / --with-agents-md）时写入此唯一项目根文件；已存在则跳过不覆盖。
    let agentsMd: InitWorkspaceResult['agents_md'];
    if (input.with_agents_md) {
      const agentsPath = 'AGENTS.md';
      if (fs.exists(agentsPath)) {
        agentsMd = 'skipped-existing';
      } else {
        await fs.write(
          agentsPath,
          await renderTemplate('agents', 'AGENTS.md', {
            project_name: projectName,
          }),
        );
        agentsMd = 'created';
      }
    }

    // PROJECT/ARCHITECTURE 的 FILL 哨兵由模板静态写入（lrnev 不做自动探测）；
    // 只有本次真正新建了骨架文档时才在 ai_followup 引导补全，重复 init 不打扰已补全的工作区。
    const docsScaffolded = filesCreated.some(
      (file) => file === '.lrnev/PROJECT.md' || file === '.lrnev/ARCHITECTURE.md',
    );

    return {
      ok: true,
      data: {
        root,
        was_new: wasNew,
        files_created: filesCreated,
        files_existing: filesExisting,
        directories_ensured: STANDARD_DIRS,
        ...(agentsMd && { agents_md: agentsMd }),
      },
      ai_followup: {
        instructions: [
          ...(ancestorHit
            ? [`注意：工作区根定位到 ${root}（向上查找命中了已有的 .lrnev，而非当前目录）。若这不是你要的项目根，请设环境变量 LRNEV_WORKSPACE=<目标目录>，或在目标目录显式 lrnev_init。`]
            : []),
          ...(docsScaffolded
            ? [
              'PROJECT.md / ARCHITECTURE.md 是本次新建的 FILL 骨架：请读项目的构建/清单文件（如 package.json、go.mod、pom.xml 等，按实际为准且不限于这些）与核心源码，自行判断技术栈与架构并补全——ARCHITECTURE.md 的技术栈/主要模块/目录结构，以及 PROJECT.md 的项目目标/当前阶段。',
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
}
