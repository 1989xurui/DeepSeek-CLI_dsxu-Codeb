import { SWEBenchTask, SWEBenchResult, SWEBenchRunnerConfig, SWEBenchRunOptions } from './types.js';
import { spawn } from 'child_process';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

export class SWEBenchRunner {
  private config: SWEBenchRunnerConfig;

  constructor(config?: Partial<SWEBenchRunnerConfig>) {
    this.config = {
      model: {
        name: 'deepseek-v4-flash',
        endpoint: 'https://api.deepseek.com/v1',
        apiKey: process.env.DEEPSEEK_API_KEY || '',
        temperature: 0.3,
        maxTokens: 8192,
      },
      execution: {
        timeout: 300000,
        maxRetries: 3,
        workingDir: './.swe-bench',
        sandbox: true,
      },
      evaluation: {
        passThreshold: 80,
        verbose: false,
        outputDir: './.swe-bench/results',
      },
      ...config,
    };

    // Keep run as own property so object spread in tests preserves it.
    this.run = this.run.bind(this);
  }

  async run(options: SWEBenchRunOptions): Promise<SWEBenchResult> {
    const task = await this.loadTask(options.task);
    const startTime = new Date().toISOString();

    const result: SWEBenchResult = {
      taskId: task.id,
      status: 'running',
      testResults: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        errors: 0,
        output: '',
        duration: 0,
      },
      evaluation: {
        passed: false,
        score: 0,
        metrics: {},
      },
      execution: {
        startTime,
        model: this.config.model.name,
        config: this.config,
      },
    };

    try {
      this.notifyProgress(options, 'Start task execution', 0, result);

      await this.prepareEnvironment(task);
      this.notifyProgress(options, 'Environment ready', 20, result);

      const solution = await this.analyzeAndSolve(task);
      this.notifyProgress(options, 'Analysis complete', 40, result);

      await this.applySolution(task, solution);
      this.notifyProgress(options, 'Solution applied', 60, result);

      const testResult = await this.runTests(task);
      result.testResults = testResult;
      this.notifyProgress(options, 'Tests finished', 80, result);

      result.evaluation = this.evaluateResult(task, testResult);
      result.status = 'completed';

      const endTime = new Date().toISOString();
      result.execution.endTime = endTime;
      result.execution.duration = new Date(endTime).getTime() - new Date(startTime).getTime();

      this.notifyProgress(options, 'Task completed', 100, result);
      await this.saveResult(result);
      return result;
    } catch (error) {
      result.status = 'failed';
      result.error = {
        type: error instanceof Error ? error.constructor.name : 'UnknownError',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      };

      const endTime = new Date().toISOString();
      result.execution.endTime = endTime;
      result.execution.duration = new Date(endTime).getTime() - new Date(startTime).getTime();

      this.notifyProgress(options, `Task failed: ${result.error.message}`, 100, result);
      await this.saveResult(result);
      throw error;
    }
  }

  private async loadTask(task: string | SWEBenchTask): Promise<SWEBenchTask> {
    if (typeof task === 'string') {
      const taskPath = join(this.config.execution.workingDir, 'tasks', `${task}.json`);
      if (!existsSync(taskPath)) {
        throw new Error(`Task file not found: ${taskPath}`);
      }
      const content = await readFile(taskPath, 'utf-8');
      return JSON.parse(content) as SWEBenchTask;
    }
    return task;
  }

  private async prepareEnvironment(task: SWEBenchTask): Promise<void> {
    const { workingDir } = this.config.execution;

    await mkdir(workingDir, { recursive: true });
    await mkdir(`${workingDir}/tasks`, { recursive: true });
    await mkdir(`${workingDir}/results`, { recursive: true });
    await mkdir(`${workingDir}/workspace`, { recursive: true });

    const workspacePath = join(workingDir, 'workspace', task.id);
    await mkdir(workspacePath, { recursive: true });

    const taskPath = join(workingDir, 'tasks', `${task.id}.json`);
    await writeFile(taskPath, JSON.stringify(task, null, 2), 'utf-8');

    const testScriptPath = join(workspacePath, 'run_tests.sh');
    await writeFile(testScriptPath, this.createTestScript(task), 'utf-8');
  }

  private async analyzeAndSolve(task: SWEBenchTask): Promise<string> {
    return `# Solution for ${task.id}\n\n## Analysis\n${task.description}\n\n## Changes\n- Apply minimal fix\n- Re-run tests\n`;
  }

  private async applySolution(task: SWEBenchTask, solution: string): Promise<void> {
    const workspacePath = join(this.config.execution.workingDir, 'workspace', task.id);
    const solutionPath = join(workspacePath, 'solution.md');
    await writeFile(solutionPath, solution, 'utf-8');
  }

  private async runTests(task: SWEBenchTask): Promise<SWEBenchResult['testResults']> {
    const workspacePath = join(this.config.execution.workingDir, 'workspace', task.id);
    const testScriptPath = join(workspacePath, 'run_tests.sh');

    const startTime = Date.now();
    try {
      const { stdout, stderr } = await this.executeCommand(`bash ${testScriptPath}`, workspacePath, task.testSuite.env);
      const duration = Date.now() - startTime;
      const output = `${stdout}\n${stderr}`;
      return { ...this.parseTestOutput(output), output, duration };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        errors: 1,
        output: error instanceof Error ? error.message : String(error),
        duration,
      };
    }
  }

  private evaluateResult(task: SWEBenchTask, testResults: SWEBenchResult['testResults']): SWEBenchResult['evaluation'] {
    const { requireAllTestsPass, maxFailures = 0 } = task.evaluation;
    const score = testResults.total > 0 ? (testResults.passed / testResults.total) * 100 : 0;

    let passed = false;
    if (requireAllTestsPass) {
      passed = testResults.failed === 0 && testResults.errors === 0;
    } else {
      passed = testResults.failed <= maxFailures && testResults.errors === 0;
    }

    passed = passed && score >= this.config.evaluation.passThreshold;

    const metrics: Record<string, number> = {
      testPassRate: score,
      testCoverage: testResults.total > 0 ? ((testResults.passed + testResults.failed) / testResults.total) * 100 : 0,
      errorRate: testResults.total > 0 ? (testResults.errors / testResults.total) * 100 : 0,
    };

    return {
      passed,
      score,
      metrics,
      failureReason: !passed ? `测试通过率 ${score.toFixed(1)}% 低于阈值 ${this.config.evaluation.passThreshold}%` : undefined,
    };
  }

  private createTestScript(task: SWEBenchTask): string {
    return `#!/bin/bash\nset -e\n${Object.entries(task.testSuite.env || {})
      .map(([k, v]) => `export ${k}="${v}"`)
      .join('\n')}\ntimeout ${Math.ceil(task.testSuite.timeout / 1000)}s ${task.testSuite.command}\n`;
  }

  private async executeCommand(
    command: string,
    cwd: string,
    env?: Record<string, string>
  ): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, { shell: true, cwd, env: { ...process.env, ...env } });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) resolve({ stdout, stderr });
        else reject(new Error(`Command failed with code ${code}\n${stderr}`));
      });

      child.on('error', (error) => reject(error));
    });
  }

  private parseTestOutput(output: string): {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    errors: number;
  } {
    if (!output || !output.trim()) {
      return { total: 0, passed: 0, failed: 0, skipped: 0, errors: 0 };
    }

    const lines = output.split('\n');
    let total = 0;
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    let errors = 0;

    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;

      let m = line.match(/^Ran\s+(\d+)\s+tests?/i);
      if (m) {
        total = parseInt(m[1], 10) || total;
        continue;
      }

      m = line.match(/^FAILED\s*\((.+)\)/i);
      if (m) {
        const body = m[1];
        const fm = body.match(/failures=(\d+)/i);
        const sm = body.match(/skipped=(\d+)/i);
        const em = body.match(/errors=(\d+)/i);
        if (fm) failed = parseInt(fm[1], 10) || failed;
        if (sm) skipped = parseInt(sm[1], 10) || skipped;
        if (em) errors = parseInt(em[1], 10) || errors;
        continue;
      }

      m = line.match(/(\d+)\s+passed/i);
      if (m) passed = parseInt(m[1], 10) || passed;
      m = line.match(/(\d+)\s+failed/i);
      if (m) failed = parseInt(m[1], 10) || failed;
      m = line.match(/(\d+)\s+skipped/i);
      if (m) skipped = parseInt(m[1], 10) || skipped;
      m = line.match(/(\d+)\s+errors?/i);
      if (m) errors = parseInt(m[1], 10) || errors;

      if (/\.\.\.\s+ok$/i.test(line)) passed += 1;
      else if (/\.\.\.\s+fail$/i.test(line)) failed += 1;
      else if (/\.\.\.\s+error$/i.test(line)) errors += 1;
      else if (/\.\.\.\s+skipped$/i.test(line)) skipped += 1;
    }

    if (total === 0) {
      total = passed + failed + skipped + errors;
    } else if (passed === 0) {
      passed = Math.max(0, total - failed - skipped - errors);
    }

    return { total, passed, failed, skipped, errors };
  }

  private notifyProgress(
    options: SWEBenchRunOptions,
    message: string,
    progress: number,
    result: Partial<SWEBenchResult>
  ): void {
    if (options.onProgress) {
      options.onProgress({
        status: result.status || 'running',
        progress,
        message,
        result,
      });
    }

    if (this.config.evaluation.verbose) {
      console.log(`[SWEBench Progress] ${progress}% - ${message}`);
    }
  }

  private async saveResult(result: SWEBenchResult): Promise<void> {
    const outputDir = this.config.evaluation.outputDir;
    await mkdir(outputDir, { recursive: true });

    const resultPath = join(outputDir, `${result.taskId}_${Date.now()}.json`);
    await writeFile(resultPath, JSON.stringify(result, null, 2), 'utf-8');
  }

  async runBatch(
    tasks: (string | SWEBenchTask)[],
    options?: Partial<SWEBenchRunOptions>
  ): Promise<SWEBenchResult[]> {
    const results: SWEBenchResult[] = [];

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      try {
        const result = await this.run({
          task,
          ...options,
          onProgress: (progress) => {
            if (options?.onProgress) {
              options.onProgress({
                ...progress,
                message: `[${i + 1}/${tasks.length}] ${progress.message}`,
              });
            }
          },
        });
        results.push(result);
      } catch {
        // continue batch
      }
    }

    return results;
  }

  generateReport(results: SWEBenchResult[]): string {
    const total = results.length;
    const passed = results.filter((r) => r.evaluation.passed).length;
    const failed = total - passed;
    const avgScore = total > 0 ? results.reduce((sum, r) => sum + r.evaluation.score, 0) / total : 0;

    let report = '# SWE-bench 运行报告\n\n';
    report += '## 概要\n';
    report += `- 总任务数: ${total}\n`;
    report += `- 通过数: ${passed}\n`;
    report += `- 失败数: ${failed}\n`;
    report += `- 通过率: ${total > 0 ? ((passed / total) * 100).toFixed(1) : 'NaN'}%\n`;
    report += `- 平均得分: ${avgScore.toFixed(1)}%\n\n`;

    report += '## 详细结果\n\n';
    report += '| 任务ID | 状态 | 得分 | 测试通过 | 耗时 |\n';
    report += '|--------|------|------|----------|------|\n';

    for (const result of results) {
      const duration = result.execution.duration ? `${(result.execution.duration / 1000).toFixed(1)}s` : 'N/A';
      report += `| ${result.taskId} | ${result.status} | ${result.evaluation.score.toFixed(1)}% | ${result.testResults.passed}/${result.testResults.total} | ${duration} |\n`;
    }

    report += '\n## 失败分析\n\n';
    const failedResults = results.filter((r) => !r.evaluation.passed);
    if (failedResults.length > 0) {
      for (const result of failedResults) {
        report += `### ${result.taskId}\n`;
        report += `- 失败原因: ${result.evaluation.failureReason || '未知'}\n`;
        report += `- 错误: ${result.error?.message || '无'}\n`;
        report += `- 测试输出: ${result.testResults.output.substring(0, 200)}...\n\n`;
      }
    } else {
      report += '所有任务都通过了！\n';
    }

    return report;
  }
}
