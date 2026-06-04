/** Gate 类型。 */
export type GateType = 'creation' | 'ready' | 'completion';

/** 单项 gate 检查结果。 */
export interface GateCheck {
  name: string;
  passed: boolean;
  /** hard_fail=true 且未通过时，整体 gate 不通过。 */
  hard_fail: boolean;
  message?: string;
  hint?: string;
}

/** Gate 整体结果。 */
export interface GateResult {
  gate: GateType;
  passed: boolean;
  checks: GateCheck[];
}

/** Gate 检查输入。 */
export interface GateCheckInput {
  scene: string;
  spec: string;
}

/** 带行号的文本定位。 */
export interface LocatedLine {
  line: number;
  text: string;
}
