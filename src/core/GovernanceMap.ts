/**
 * GovernanceMap —— 治理地图（02-00 F-01）。
 *
 * 聚合 scene/spec frontmatter + 锚点标题，输出 scene→spec(状态/L0)→锚点标题 的压缩全景。
 * repo-map 思路：读文件扫标题与 L0，但输出只含标题级（不放正文），让 AI 看图用 URI 直接跳转，
 * 把定位从 O(搜索质量) 变 O(1)。纯只读、无写副作用。
 */

import { FileStorage } from '../storage/FileStorage.js';
import { parseFrontmatter } from '../storage/FrontmatterCodec.js';
import { DEFAULT_SCENE_ID, SceneManager } from './SceneManager.js';
import { tryParseSpecParts } from './SpecManager.js';
import { readSpecSummary } from './Summarizer.js';
import type { AiFollowupResponse } from '../types/response.js';
import type { SpecFrontmatter } from '../types/spec.js';
import type {
  GovernanceMapResult,
  GovernanceMapScene,
  GovernanceMapSpec,
} from '../types/governance-map.js';

/** L0 行截断上限（地图是目录，L0 只给一句话提示）。 */
const L0_MAX = 120;

export class GovernanceMap {
  constructor(
    private readonly fs: FileStorage,
    private readonly scenes: SceneManager,
  ) {}

  async build(): Promise<AiFollowupResponse<GovernanceMapResult>> {
    const sceneList = (await this.scenes.list()).filter(
      (scene) => !(scene.id === DEFAULT_SCENE_ID && scene.spec_count === 0 && !scene.broken),
    );
    const scenes: GovernanceMapScene[] = [];
    for (const scene of sceneList) {
      scenes.push({
        scene: scene.id,
        name: scene.name,
        status: scene.status,
        ...(scene.intent && { intent: scene.intent }),
        specs: await this.buildSpecs(scene.id),
      });
    }

    return {
      ok: true,
      data: { generated_at: new Date().toISOString(), scenes },
      ai_followup: {
        instructions: [
          '这是治理全景（scene→spec→锚点标题）。按需用 context://spec/<scene>/<spec> 或 context_search 跳到具体段落，别全文通读。',
          '地图只含标题级信息；要某锚点的正文时用 context_search 命中该 #### F-xx/#### D-xx 段。',
        ],
      },
    };
  }

  private async buildSpecs(sceneId: string): Promise<GovernanceMapSpec[]> {
    const files = await this.fs.list(`.lrnev/scenes/${sceneId}/specs/*/requirements.md`);
    files.sort();
    const specs: GovernanceMapSpec[] = [];
    for (const file of files) {
      const match = /^\.lrnev\/scenes\/[^/]+\/specs\/([^/]+)\/requirements\.md$/.exec(file);
      if (!match) continue;
      const specId = match[1]!;
      const parts = tryParseSpecParts(specId);
      if (!parts) continue;

      const reqContent = await this.fs.read(file);
      const { frontmatter } = parseFrontmatter<Partial<SpecFrontmatter>>(reqContent);
      const designPath = `.lrnev/scenes/${sceneId}/specs/${specId}/design.md`;
      const designContent = this.fs.exists(designPath) ? await this.fs.read(designPath) : '';
      // L0 走统一摘要读取契约：sidecar 优先、requirements 内联兜底。地图只取 L0 一句话。
      const summary = await readSpecSummary(this.fs, sceneId, specId);
      const l0 = summary.l0?.slice(0, L0_MAX);

      specs.push({
        spec: specId,
        name: parts.name,
        status: frontmatter.status ?? 'draft',
        ...(frontmatter.priority && { priority: frontmatter.priority }),
        ...(l0 && { l0 }),
        anchors: [...anchorHeadings(reqContent, 'F'), ...anchorHeadings(designContent, 'D')],
      });
    }
    return specs;
  }
}

/** 只取 `#### F-xx` / `#### D-xx` 标题行（不读正文段落）；排除未填的模板哨兵标题（`<!-- FILL: -->`）。 */
function anchorHeadings(content: string, prefix: 'F' | 'D'): string[] {
  const regex = new RegExp(`^####\\s+${prefix}-\\d+\\b.*$`, 'gm');
  return (content.match(regex) ?? [])
    .map((line) => line.trim())
    .filter((line) => !line.includes('<!-- FILL:'));
}
