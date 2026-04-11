/**
 * R5-28: SWE-bench runner 核心实现
 *
 * 功能：
 * 1. 加载SWE-bench任务
 * 2. 执行代码修复/实现
 * 3. 运行测试套件
 * 4. 评估结果
 * 5. 生成报告
 */

import { SWEBenchTask, SWEBenchResult, SWEBenchRunnerConfig, SWEBenchRunOptions } from './types.js';
import { spawn } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';

const sleep = promisify(setTimeout);

export class SWEBenchRunner {
  private config: SWEBenchRunnerConfig;

  constructor(config?: Partial<SWEBenchRunnerConfig>) {
    this.config = {
      model: {
        name: 'deepseek-chat',
        endpoint: 'https://api.deepseek.com/v1',
        apiKey: process.env.DEEPSEEK_API_KEY || '',
        temperature: 0.3,
        maxTokens: 8192,
      },
      execution: {
        timeout: 300000, // 5分钟
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
  }

  /**
   * 运行SWE-bench任务
   */
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
      // 通知进度
      this.notifyProgress(options, '开始执行任务', 0, result);

      // 1. 准备环境
      await this.prepareEnvironment(task);
      this.notifyProgress(options, '环境准备完成', 20, result);

      // 2. 分析问题并生成解决方案
      const solution = await this.analyzeAndSolve(task);
      this.notifyProgress(options, '问题分析完成', 40, result);

      // 3. 应用解决方案
      await this.applySolution(task, solution);
      this.notifyProgress(options, '解决方案应用完成', 60, result);

      // 4. 运行测试
      const testResult = await this.runTests(task);
      result.testResults = testResult;
      this.notifyProgress(options, '测试运行完成', 80, result);

      // 5. 评估结果
      const evaluation = this.evaluateResult(task, testResult);
      result.evaluation = evaluation;
      result.status = 'completed';

      const endTime = new Date().toISOString();
      result.execution.endTime = endTime;
      result.execution.duration = new Date(endTime).getTime() - new Date(startTime).getTime();

      this.notifyProgress(options, '任务完成', 100, result);

      // 6. 保存结果
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

      this.notifyProgress(options, `任务失败: ${result.error.message}`, 100, result);
      await this.saveResult(result);

      throw error;
    }
  }

  /**
   * 加载任务
   */
  private async loadTask(task: string | SWEBenchTask): Promise<SWEBenchTask> {
    if (typeof task === 'string') {
      // 从文件加载任务
      const taskPath = join(this.config.execution.workingDir, 'tasks', `${task}.json`);
      if (!existsSync(taskPath)) {
        throw new Error(`任务文件不存在: ${taskPath}`);
      }
      const content = await readFile(taskPath, 'utf-8');
      return JSON.parse(content) as SWEBenchTask;
    }
    return task;
  }

  /**
   * 准备执行环境
   */
  private async prepareEnvironment(task: SWEBenchTask): Promise<void> {
    const { workingDir } = this.config.execution;

    // 创建工作目录
    await mkdir(workingDir, { recursive: true });
    await mkdir(join(workingDir, 'tasks'), { recursive: true });
    await mkdir(join(workingDir, 'results'), { recursive: true });
    await mkdir(join(workingDir, 'workspace'), { recursive: true });

    // 克隆代码库（简化版本，实际需要git clone）
    const workspacePath = join(workingDir, 'workspace', task.id);
    await mkdir(workspacePath, { recursive: true });

    // 保存任务配置
    const taskPath = join(workingDir, 'tasks', `${task.id}.json`);
    await writeFile(taskPath, JSON.stringify(task, null, 2), 'utf-8');

    // 创建测试运行脚本
    const testScript = this.createTestScript(task);
    const testScriptPath = join(workspacePath, 'run_tests.sh');
    await writeFile(testScriptPath, testScript, 'utf-8');
  }

  /**
   * 分析问题并生成解决方案
   */
  private async analyzeAndSolve(task: SWEBenchTask): Promise<string> {
    // 这里应该调用AI模型来分析问题和生成解决方案
    // 简化版本：返回一个占位解决方案
    const prompt = this.createAnalysisPrompt(task);

    // 实际应该调用API，这里返回模拟响应
    return `# 解决方案 for ${task.id}

## 问题分析
${task.description.substring(0, 500)}...

## 修改方案
1. 修复文件: main.py
2. 修改内容: 修复边界条件检查
3. 添加测试: 确保修复正确

## 代码修改
\`\`\`python
def fixed_function(input_value):
    if input_value is None:
        return default_value
    # 原有逻辑...
\`\`\``;
  }

  /**
   * 应用解决方案
   */
  private async applySolution(task: SWEBenchTask, solution: string): Promise<void> {
    // 在实际实现中，这里应该：
    // 1. 解析解决方案中的代码修改
    // 2. 应用到代码库中
    // 3. 验证修改的语法正确性

    const workspacePath = join(this.config.execution.workingDir, 'workspace', task.id);
    const solutionPath = join(workspacePath, 'solution.md');
    await writeFile(solutionPath, solution, 'utf-8');

    // 模拟应用修改
    console.log(`[SWEBench] 应用解决方案到 ${workspacePath}`);
  }

  /**
   * 运行测试
   */
  private async runTests(task: SWEBenchTask): Promise<SWEBenchResult['testResults']> {
    const workspacePath = join(this.config.execution.workingDir, 'workspace', task.id);
    const testScriptPath = join(workspacePath, 'run_tests.sh');

    const startTime = Date.now();

    try {
      // 执行测试脚本
      const { stdout, stderr } = await this.executeCommand(
        `bash ${testScriptPath}`,
        workspacePath,
        task.testSuite.env
      );

      const duration = Date.now() - startTime;
      const output = stdout + '\n' + stderr;

      // 解析测试结果（简化版本）
      // 实际应该解析测试框架的输出
      const testResults = this.parseTestOutput(output);

      return {
        ...testResults,
        output,
        duration,
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorOutput = error instanceof Error ? error.message : String(error);

      return {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        errors: 1,
        output: errorOutput,
        duration,
      };
    }
  }

  /**
   * 评估结果
   */
  private evaluateResult(task: SWEBenchTask, testResults: SWEBenchResult['testResults']): SWEBenchResult['evaluation'] {
    const { requireAllTestsPass, maxFailures = 0 } = task.evaluation;

    // 计算得分
    let score = 0;
    if (testResults.total > 0) {
      score = (testResults.passed / testResults.total) * 100;
    }

    // 检查是否通过
    let passed = false;
    if (requireAllTestsPass) {
      passed = testResults.failed === 0 && testResults.errors === 0;
    } else {
      passed = testResults.failed <= (maxFailures || 0) && testResults.errors === 0;
    }

    // 检查阈值
    passed = passed && score >= this.config.evaluation.passThreshold;

    const metrics: Record<string, number> = {
      testPassRate: score,
      testCoverage: testResults.total > 0 ? (testResults.passed + testResults.failed) / testResults.total * 100 : 0,
      errorRate: testResults.total > 0 ? testResults.errors / testResults.total * 100 : 0,
    };

    return {
      passed,
      score,
      metrics,
      failureReason: !passed ? `测试通过率 ${score.toFixed(1)}% 低于阈值 ${this.config.evaluation.passThreshold}%` : undefined,
    };
  }

  /**
   * 创建测试脚本
   */
  private createTestScript(task: SWEBenchTask): string {
    return `#!/bin/bash
set -e

echo "开始运行测试..."
echo "测试命令: ${task.testSuite.command}"
echo "超时时间: ${task.testSuite.timeout}ms"

# 设置环境变量
${Object.entries(task.testSuite.env || {}).map(([key, value]) => `export ${key}="${value}"`).join('\n')}

# 运行测试
timeout ${Math.ceil(task.testSuite.timeout / 1000)}s ${task.testSuite.command}

echo "测试完成"
`;
  }

  /**
   * 创建分析提示
   */
  private createAnalysisPrompt(task: SWEBenchTask): string {
    return `你是一个专业的软件工程师。请分析以下问题并提供解决方案。

任务ID: ${task.id}
标题: ${task.title}
难度: ${task.metadata.difficulty}
类型: ${task.metadata.type}
语言: ${task.metadata.language}

问题描述:
${task.description}

代码库信息:
- 仓库: ${task.repository.url}
- 提交: ${task.repository.commit}
- 分支: ${task.repository.branch}

测试命令: ${task.testSuite.command}

请提供：
1. 问题分析
2. 解决方案概述
3. 具体的代码修改
4. 测试策略

确保解决方案能够通过所有测试。`;
  }

  /**
   * 执行命令
   */
  private async executeCommand(
    command: string,
    cwd: string,
    env?: Record<string, string>
  ): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, {
        shell: true,
        cwd,
        env: { ...process.env, ...env },
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`命令执行失败，退出码: ${code}\n${stderr}`));
        }
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * 解析测试输出（简化版本）
   */
  private parseTestOutput(output: string): {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    errors: number;
  } {
    // 简化解析逻辑
    // 实际应该根据测试框架的输出进行解析
    const lines = output.split('\n');
    let total = 0;
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    let errors = 0;

    for (const line of lines) {
      if (line.includes('test') && line.includes('passed')) {
        const match = line.match(/(\d+) passed/);
        if (match) passed = parseInt(match[1], 10);
      }
      if (line.includes('test') && line.includes('failed')) {
        const match = line.match(/(\d+) failed/);
        if (match) failed = parseInt(match[1], 10);
      }
      if (line.includes('test') && line.includes('skipped')) {
        const match = line.match(/(\d+) skipped/);
        if (match) skipped = parseInt(match[1], 10);
      }
      if (line.includes('test') && line.includes('error')) {
        const match = line.match(/(\d+) error/);
        if (match) errors = parseInt(match[1], 10);
      }
    }

    total = passed + failed + skipped + errors;

    return { total, passed, failed, skipped, errors };
  }

  /**
   * 通知进度
   */
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

  /**
   * 保存结果
   */
  private async saveResult(result: SWEBenchResult): Promise<void> {
    const outputDir = this.config.evaluation.outputDir;
    await mkdir(outputDir, { recursive: true });

    const resultPath = join(outputDir, `${result.taskId}_${Date.now()}.json`);
    await writeFile(resultPath, JSON.stringify(result, null, 2), 'utf-8');

    if (this.config.evaluation.verbose) {
      console.log(`[SWEBench] 结果保存到: ${resultPath}`);
    }
  }

  /**
   * 批量运行任务
   */
  async runBatch(
    tasks: (string | SWEBenchTask)[],
    options?: Partial<SWEBenchRunOptions>
  ): Promise<SWEBenchResult[]> {
    const results: SWEBenchResult[] = [];

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      console.log(`[SWEBench] 运行任务 ${i + 1}/${tasks.length}: ${typeof task === 'string' ? task : task.id}`);

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
      } catch (error) {
        console.error(`[SWEBench] 任务失败: ${error}`);
        // 继续运行其他任务
      }
    }

    return results;
  }

  /**
   * 生成报告
   */
  generateReport(results: SWEBenchResult[]): string {
    const total = results.length;
    const passed = results.filter(r => r.evaluation.passed).length;
    const failed = total - passed;
    const avgScore = results.reduce((sum, r) => sum + r.evaluation.score, 0) / total;

    let report = `# SWE-bench 运行报告\n\n`;
    report += `## 概要\n`;
    report += `- 总任务数: ${total}\n`;
    report += `- 通过数: ${passed}\n`;
    report += `- 失败数: ${failed}\n`;
    report += `- 通过率: ${((passed / total) * 100).toFixed(1)}%\n`;
    report += `- 平均得分: ${avgScore.toFixed(1)}%\n\n`;

    report += `## 详细结果\n\n`;
    report += `| 任务ID | 状态 | 得分 | 测试通过 | 耗时 |\n`;
    report += `|--------|------|------|----------|------|\n`;

    for (const result of results) {
      const duration = result.execution.duration
        ? `${(result.execution.duration / 1000).toFixed(1)}s`
        : 'N/A';

      report += `| ${result.taskId} | ${result.status} | ${result.evaluation.score.toFixed(1)}% | ${result.testResults.passed}/${result.testResults.total} | ${duration} |\n`;
    }

    report += `\n## 失败分析\n\n`;
    const failedResults = results.filter(r => !r.evaluation.passed);
    if (failedResults.length > 0) {
      for (const result of failedResults) {
        report += `### ${result.taskId}\n`;
        report += `- 失败原因: ${result.evaluation.failureReason || '未知'}\n`;
        report += `- 错误: ${result.error?.message || '无'}\n`;
        report += `- 测试输出: ${result.testResults.output.substring(0, 200)}...\n\n`;
      }
    } else {
      report += `所有任务都通过了！🎉\n`;
    }

    return report;
  }
}