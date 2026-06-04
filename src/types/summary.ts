export interface SaveSummaryInput {
  uri: string;
  l0?: string;
  l1?: string;
}

export interface SaveSummaryResult {
  uri: string;
  saved: Array<{ level: 'L0' | 'L1'; path: string }>;
  skipped: Array<{ level: 'L0' | 'L1'; reason: string }>;
}
