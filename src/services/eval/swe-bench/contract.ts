/**
 * R5-28 SWE-bench runner — 类型契约
 *
 * TS 侧定义，Python 侧通过 JSON 通信。
 */

/** 单个 SWE-bench 任务描述 */
export interface SWETask {
  /** 任务 ID，如 "django__django-11099" */
  id: string;
  /** 来源仓库，如 "django/django" */
  repo: string;
  /** base commit hash */
  baseCommit: string;
  /** 问题描述（来自 GitHub issue） */
  problemStatement: string;
  /** 难度 */
  difficulty: 'easy' | 'medium' | 'hard';
  /** 涉及语言 */
  languages: string[];
  /** 是否多文件修改 */
  multiFile: boolean;
  /** 官方 test patch（用于评估） */
  testPatch: string;
  /** 官方 gold patch（ground truth，仅用于对比） */
  goldPatch?: string;
}

/** 单个任务执行结果 */
export interface SWEResult {
  taskId: string;
  /** 生成的 patch */
  generatedPatch: string;
  /** 测试是否通过 */
  testsPassed: boolean;
  /** 通过的测试数 / 总测试数 */
  passedTests: number;
  totalTests: number;
  /** 执行耗时 ms */
  durationMs: number;
  /** 错误信息 */
  error?: string;
}

/** 批量运行报告 */
export interface SWEReport {
  /** 任务总数 */
  totalTasks: number;
  /** 通过数 */
  passedTasks: number;
  /** pass@1 */
  passAt1: number;
  /** pass@5（需要多次采样） */
  passAt5?: number;
  /** 按难度分组 */
  byDifficulty: {
    easy: { total: number; passed: number; rate: number };
    medium: { total: number; passed: number; rate: number };
    hard: { total: number; passed: number; rate: number };
  };
  /** 按语言分组 */
  byLanguage: Record<string, { total: number; passed: number; rate: number }>;
  /** 总耗时 ms */
  totalDurationMs: number;
  /** 生成时间 */
  generatedAt: string;
}

/** Runner 配置 */
export interface SWEBridgeConfig {
  /** Python 解释器路径 */
  pythonPath?: string;
  /** eval 脚本目录 */
  evalDir?: string;
  /** 工作目录 */
  workDir?: string;
  /** 单任务超时 ms */
  taskTimeoutMs?: number;
  /** 并发数 */
  concurrency?: number;
  /** Mock runner：用于 G4 测试，跳过真实 Python 调用 */
  mockRunner?: (task: SWETask) => Promise<SWEResult>;
  /** Mock task loader：用于 G4 测试，跳过真实文件读取 */
  mockTaskLoader?: (subsetPath: string) => Promise<SWETask[]>;
}

export function validateSweTask(task: Partial<SWETask>): string[] {
  const errors: string[] = [];

  if (!task.id) errors.push('task id is required');
  if (!task.repo) errors.push('repo is required');
  if (!task.baseCommit) errors.push('base commit is required');
  if (!task.problemStatement) errors.push('problem statement is required');
  if (!task.difficulty || !['easy', 'medium', 'hard'].includes(task.difficulty)) {
    errors.push('difficulty must be easy, medium, or hard');
  }
  if (!Array.isArray(task.languages) || task.languages.length === 0) {
    errors.push('at least one language is required');
  }
  if (typeof task.multiFile !== 'boolean') errors.push('multiFile must be boolean');
  if (!task.testPatch) errors.push('test patch is required');

  return errors;
}
