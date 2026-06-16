import type { SceneStatus } from './scene.js';
import type { SpecStatus, SpecPriority } from './spec.js';

/** 治理地图里的单个 Spec：状态 + L0 + 锚点标题（不含正文）。 */
export interface GovernanceMapSpec {
  spec: string;
  name: string;
  status: SpecStatus;
  priority?: SpecPriority;
  l0?: string;
  /** requirements 的 `#### F-xx` 与 design 的 `#### D-xx` 标题行（文档序，仅标题不含正文）。 */
  anchors: string[];
}

/** 治理地图里的单个 Scene。 */
export interface GovernanceMapScene {
  scene: string;
  name: string;
  status: SceneStatus;
  intent?: string;
  specs: GovernanceMapSpec[];
}

/** 治理地图：scene → spec（状态/L0）→ 锚点标题 的压缩全景。 */
export interface GovernanceMapResult {
  generated_at: string;
  scenes: GovernanceMapScene[];
}
