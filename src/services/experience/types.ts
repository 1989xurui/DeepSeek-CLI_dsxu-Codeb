/**
 * R5-26 ExperienceStore — 类型定义
 */

export type TaskType = 'code-generation' | 'complex-reasoning' | 'tool-intensive'
  | 'creative-writing' | 'factual-qa' | 'debugging' | 'default';

export interface ExperienceRecord {
  id: string;
  ts: number;
  taskId: string;
  taskDescription: string;
  taskType: TaskType;
  plan: string;
  patches: { file: string; diff: string }[];
  testResults: { name: string; result: 'pass' | 'fail' }[];
  staticIssues: number;
  criticVerdict: 'pass' | 'reject' | 'needs-revision';
  criticReason?: string;
  finalScore: number;
  durationMs: number;
  tokensUsed: number;
  outcome: 'success' | 'failure' | 'partial';
  embedding: number[];
  helpfulness?: number;
}

export interface ExperienceStoreConfig {
  dbPath?: string;
  mockEmbed?: (texts: string[]) => Promise<number[][]>;
  mockMode?: boolean;
}
