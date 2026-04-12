/**
 * R5-28 SWE-bench TS ↔ Python 桥接
 *
 * TS 侧编排，Python 侧执行评估。
 * Mock 模式用于 G4 蒸馏测试。
 */

import { readFile } from 'fs/promises';
import { join } from 'path';
import type { SWETask, SWEResult, SWEReport, SWEBridgeConfig } from './contract';

const DEFAULT_CONFIG: Required<Omit<SWEBridgeConfig, 'mockRunner' | 'mockTaskLoader'>> = {
  pythonPath: 'python',
  evalDir: 'evals/swe-bench',
  workDir: '.swe-bench-work',
  taskTimeoutMs: 300_000,  // 5 min per task
  concurrency: 1,
};

/**
 * 加载 subset 任务列表
 */
export async function loadSubset(
  subsetPath: string,
  config?: Partial<SWEBridgeConfig>
): Promise<SWETask[]> {
  if (config?.mockTaskLoader) {
    return config.mockTaskLoader(subsetPath);
  }

  const raw = await readFile(subsetPath, 'utf-8');
  const data = JSON.parse(raw);
  return Array.isArray(data) ? data : data.tasks ?? [];
}

/**
 * 运行单个 SWE-bench 任务
 */
export async function runTask(
  task: SWETask,
  config?: Partial<SWEBridgeConfig>
): Promise<SWEResult> {
  if (config?.mockRunner) {
    return config.mockRunner(task);
  }

  // 真实执行：调用 Python runner.py
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const runnerScript = join(cfg.evalDir, 'runner.py');

  try {
    const { execSync } = await import('child_process');
    const taskJson = JSON.stringify(task);
    const cmd = `${cfg.pythonPath} "${runnerScript}" --task '${taskJson.replace(/'/g, "'\\''")}'`;

    const output = execSync(cmd, {
      timeout: cfg.taskTimeoutMs,
      encoding: 'utf-8',
      cwd: cfg.workDir,
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

/**
 * 批量运行任务
 */
export async function runBatch(
  tasks: SWETask[],
  config?: Partial<SWEBridgeConfig>
): Promise<SWEResult[]> {
  const results: SWEResult[] = [];

  // 顺序执行（并发版本留给 M3 优化）
  for (const task of tasks) {
    const result = await runTask(task, config);
    results.push(result);
  }

  return results;
}

/**
 * 从结果生成报告
 */
export function generateReport(results: SWEResult[]): SWEReport {
  const total = results.length;
  const passed = results.filter(r => r.testsPassed).length;

  // 按难度分组 — 需要原始 task 数据，这里用 taskId 推断
  // 实际使用时应传入 tasks + results
  const byDifficulty = {
    easy: { total: 0, passed: 0, rate: 0 },
    medium: { total: 0, passed: 0, rate: 0 },
    hard: { total: 0, passed: 0, rate: 0 },
  };

  const byLanguage: Record<string, { total: number; passed: number; rate: number }> = {};

  const totalDuration = results.reduce((sum, r) => sum + r.durationMs, 0);

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

/**
 * 从 tasks + results 生成详细报告
 */
export function generateDetailedReport(
  tasks: SWETask[],
  results: SWEResult[]
): SWEReport {
  const resultMap = new Map(results.map(r => [r.taskId, r]));

  const byDifficulty = {
    easy: { total: 0, passed: 0, rate: 0 },
    medium: { total: 0, passed: 0, rate: 0 },
    hard: { total: 0, passed: 0, rate: 0 },
  };

  const byLanguage: Record<string, { total: number; passed: number; rate: number }> = {};

  for (const task of tasks) {
    const result = resultMap.get(task.id);
    const didPass = result?.testsPassed ?? false;

    // 难度统计
    byDifficulty[task.difficulty].total++;
    if (didPass) byDifficulty[task.difficulty].passed++;

    // 语言统计
    for (const lang of task.languages) {
      if (!byLanguage[lang]) byLanguage[lang] = { total: 0, passed: 0, rate: 0 };
      byLanguage[lang].total++;
      if (didPass) byLanguage[lang].passed++;
    }
  }

  // 计算比率
  for (const d of Object.values(byDifficulty)) {
    d.rate = d.total > 0 ? d.passed / d.total : 0;
  }
  for (const l of Object.values(byLanguage)) {
    l.rate = l.total > 0 ? l.passed / l.total : 0;
  }

  const total = tasks.length;
  const passed = results.filter(r => r.testsPassed).length;
  const totalDuration = results.reduce((sum, r) => sum + r.durationMs, 0);

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
