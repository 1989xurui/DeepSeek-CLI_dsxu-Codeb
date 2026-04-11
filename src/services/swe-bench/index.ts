/**
 * R5-28: SWE-bench runner 主入口
 *
 * 导出所有类型和类，提供便捷的API
 */

export * from './types.js';
export * from './runner.js';

import { SWEBenchRunner } from './runner.js';

/**
 * 创建SWE-bench runner实例
 */
export function createSWEBenchRunner(config?: Partial<import('./types.js').SWEBenchRunnerConfig>): SWEBenchRunner {
  return new SWEBenchRunner(config);
}

/**
 * 默认runner实例
 */
export const sweBenchRunner = createSWEBenchRunner();

/**
 * 运行单个SWE-bench任务
 */
export async function runSWEBenchTask(
  task: string | import('./types.js').SWEBenchTask,
  options?: Partial<import('./types.js').SWEBenchRunOptions>
): Promise<import('./types.js').SWEBenchResult> {
  return sweBenchRunner.run({ task, ...options });
}

/**
 * 批量运行SWE-bench任务
 */
export async function runSWEBenchBatch(
  tasks: (string | import('./types.js').SWEBenchTask)[],
  options?: Partial<import('./types.js').SWEBenchRunOptions>
): Promise<import('./types.js').SWEBenchResult[]> {
  return sweBenchRunner.runBatch(tasks, options);
}

/**
 * 生成SWE-bench报告
 */
export function generateSWEBenchReport(results: import('./types.js').SWEBenchResult[]): string {
  return sweBenchRunner.generateReport(results);
}

/**
 * 工具函数：创建示例任务
 */
export function createExampleTask(id: string = 'swe-bench-example-001'): import('./types.js').SWEBenchTask {
  return {
    id,
    title: '修复边界条件检查错误',
    description: '在calculate_average函数中，当输入为空列表时应该返回0而不是抛出异常。',
    repository: {
      url: 'https://github.com/example/repo',
      commit: 'abc123',
      branch: 'main',
    },
    testSuite: {
      command: 'pytest tests/test_average.py',
      timeout: 30000,
      env: {
        PYTHONPATH: '.',
      },
    },
    evaluation: {
      requireAllTestsPass: true,
      metrics: {
        correctness: 100,
        performance: 80,
      },
    },
    metadata: {
      difficulty: 'easy',
      type: 'bug-fix',
      language: 'python',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };
}

/**
 * 工具函数：验证任务配置
 */
export function validateTask(task: import('./types.js').SWEBenchTask): string[] {
  const errors: string[] = [];

  if (!task.id) errors.push('任务ID不能为空');
  if (!task.title) errors.push('任务标题不能为空');
  if (!task.description) errors.push('任务描述不能为空');
  if (!task.repository.url) errors.push('仓库URL不能为空');
  if (!task.testSuite.command) errors.push('测试命令不能为空');
  if (task.testSuite.timeout <= 0) errors.push('测试超时时间必须大于0');

  return errors;
}

/**
 * 工具函数：加载任务配置文件
 */
export async function loadTasksFromFile(filePath: string): Promise<import('./types.js').SWEBenchTask[]> {
  const fs = await import('fs/promises');
  const content = await fs.readFile(filePath, 'utf-8');
  const data = JSON.parse(content);

  if (Array.isArray(data)) {
    return data as import('./types.js').SWEBenchTask[];
  } else if (data.tasks && Array.isArray(data.tasks)) {
    return data.tasks as import('./types.js').SWEBenchTask[];
  } else {
    throw new Error('任务文件格式不正确，应为数组或包含tasks字段的对象');
  }
}

/**
 * 工具函数：保存结果到文件
 */
export async function saveResultsToFile(
  results: import('./types.js').SWEBenchResult[],
  filePath: string
): Promise<void> {
  const fs = await import('fs/promises');
  const content = JSON.stringify({
    timestamp: new Date().toISOString(),
    total: results.length,
    passed: results.filter(r => r.evaluation.passed).length,
    failed: results.filter(r => !r.evaluation.passed).length,
    results,
  }, null, 2);
  await fs.writeFile(filePath, content, 'utf-8');
}