/**
 * R5-28 SWE-bench runner — 参考契约（G4 golden I/O 校验用）
 *
 * 此文件不参与编译，仅作为蒸馏参考。
 */

export interface SWETask {
  id: string;
  repo: string;
  baseCommit: string;
  problemStatement: string;
  difficulty: 'easy' | 'medium' | 'hard';
  languages: string[];
  multiFile: boolean;
  testPatch: string;
  goldPatch?: string;
}

export interface SWEResult {
  taskId: string;
  generatedPatch: string;
  testsPassed: boolean;
  passedTests: number;
  totalTests: number;
  durationMs: number;
  error?: string;
}

export interface SWEReport {
  totalTasks: number;
  passedTasks: number;
  passAt1: number;
  passAt5?: number;
  byDifficulty: {
    easy: { total: number; passed: number; rate: number };
    medium: { total: number; passed: number; rate: number };
    hard: { total: number; passed: number; rate: number };
  };
  byLanguage: Record<string, { total: number; passed: number; rate: number }>;
  totalDurationMs: number;
  generatedAt: string;
}

export interface SWEBridgeConfig {
  pythonPath?: string;
  evalDir?: string;
  workDir?: string;
  taskTimeoutMs?: number;
  concurrency?: number;
  mockRunner?: (task: SWETask) => Promise<SWEResult>;
  mockTaskLoader?: (subsetPath: string) => Promise<SWETask[]>;
}
