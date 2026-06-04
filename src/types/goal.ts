export type GoalAssessmentKind = 'single-spec' | 'multi-spec-program' | 'research-program';

export interface GoalAssessment {
  kind: GoalAssessmentKind;
  confidence: 'low' | 'medium' | 'high';
  score: number;
  reasons: string[];
  suggested_next_step: string;
}
