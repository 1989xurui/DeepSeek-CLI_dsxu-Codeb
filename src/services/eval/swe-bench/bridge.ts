import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { join, resolve } from 'path';
import type { SWEBridgeConfig, SWEReport, SWEResult, SWETask } from './contract';

const DEFAULT_CONFIG: Required<Omit<SWEBridgeConfig, 'mockRunner' | 'mockTaskLoader'>> = {
  pythonPath: 'python',
  evalDir: 'evals/swe-bench',
  workDir: '.swe-bench-work',
  taskTimeoutMs: 300_000,
  concurrency: 1,
};

export async function loadSubset(
  subsetPath: string,
  config?: Partial<SWEBridgeConfig>,
): Promise<SWETask[]> {
  if (config?.mockTaskLoader) {
    return config.mockTaskLoader(subsetPath);
  }

  const raw = await readFile(subsetPath, 'utf-8');
  const data = JSON.parse(raw);
  return Array.isArray(data) ? data : data.tasks ?? [];
}

export async function runTask(
  task: SWETask,
  config?: Partial<SWEBridgeConfig>,
): Promise<SWEResult> {
  if (config?.mockRunner) {
    return config.mockRunner(task);
  }

  const cfg = { ...DEFAULT_CONFIG, ...config };
  const runnerScript = resolve(cfg.evalDir, 'runner.py');
  const workDir = resolve(cfg.workDir);

  if (!existsSync(workDir)) {
    return envNotReadyResult(task.id, `missing workDir: ${workDir}`);
  }
  if (!existsSync(runnerScript)) {
    return envNotReadyResult(task.id, `missing runner script: ${runnerScript}`);
  }

  try {
    const { execFileSync } = await import('child_process');
    const taskJson = JSON.stringify(task);
    const output = execFileSync(cfg.pythonPath, [runnerScript, '--task', taskJson], {
      timeout: cfg.taskTimeoutMs,
      encoding: 'utf-8',
      cwd: workDir,
    });

    return JSON.parse(output.trim()) as SWEResult;
  } catch (err) {
    return {
      taskId: task.id,
      generatedPatch: '',
      testsPassed: false,
      passedTests: 0,
      totalTests: 0,
      durationMs: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function envNotReadyResult(taskId: string, reason: string): SWEResult {
  return {
    taskId,
    generatedPatch: '',
    testsPassed: false,
    passedTests: 0,
    totalTests: 0,
    durationMs: 0,
    error: `SWE_BENCH_ENV_NOT_READY: ${reason}`,
  };
}

export async function runBatch(
  tasks: SWETask[],
  config?: Partial<SWEBridgeConfig>,
): Promise<SWEResult[]> {
  const results: SWEResult[] = [];

  for (const task of tasks) {
    const result = await runTask(task, config);
    results.push(result);
  }

  return results;
}

export function generateReport(results: SWEResult[]): SWEReport {
  const total = results.length;
  const passed = results.filter(result => result.testsPassed).length;
  const totalDuration = results.reduce((sum, result) => sum + result.durationMs, 0);

  return {
    totalTasks: total,
    passedTasks: passed,
    passAt1: total > 0 ? passed / total : 0,
    byDifficulty: {
      easy: { total: 0, passed: 0, rate: 0 },
      medium: { total: 0, passed: 0, rate: 0 },
      hard: { total: 0, passed: 0, rate: 0 },
    },
    byLanguage: {},
    totalDurationMs: totalDuration,
    generatedAt: new Date().toISOString(),
  };
}

export function generateDetailedReport(tasks: SWETask[], results: SWEResult[]): SWEReport {
  const resultMap = new Map(results.map(result => [result.taskId, result]));
  const byDifficulty = {
    easy: { total: 0, passed: 0, rate: 0 },
    medium: { total: 0, passed: 0, rate: 0 },
    hard: { total: 0, passed: 0, rate: 0 },
  };
  const byLanguage: Record<string, { total: number; passed: number; rate: number }> = {};

  for (const task of tasks) {
    const result = resultMap.get(task.id);
    const didPass = result?.testsPassed ?? false;

    byDifficulty[task.difficulty].total += 1;
    if (didPass) byDifficulty[task.difficulty].passed += 1;

    for (const language of task.languages) {
      byLanguage[language] ??= { total: 0, passed: 0, rate: 0 };
      byLanguage[language].total += 1;
      if (didPass) byLanguage[language].passed += 1;
    }
  }

  for (const bucket of Object.values(byDifficulty)) {
    bucket.rate = bucket.total > 0 ? bucket.passed / bucket.total : 0;
  }
  for (const bucket of Object.values(byLanguage)) {
    bucket.rate = bucket.total > 0 ? bucket.passed / bucket.total : 0;
  }

  const total = tasks.length;
  const passed = results.filter(result => result.testsPassed).length;
  const totalDuration = results.reduce((sum, result) => sum + result.durationMs, 0);

  return {
    totalTasks: total,
    passedTasks: passed,
    passAt1: total > 0 ? passed / total : 0,
    byDifficulty,
    byLanguage,
    totalDurationMs: totalDuration,
    generatedAt: new Date().toISOString(),
  };
}
