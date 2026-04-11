/**
 * R5-28 SWE-bench runner 单元测试
 *
 * G1门禁要求：测试覆盖率 ≥85%
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { SWEBenchRunner, createExampleTask, validateTask } from '../swe-bench/index.js';
import type { SWEBenchTask, SWEBenchResult } from '../swe-bench/types.js';

// Mock文件系统操作
jest.mock('fs/promises', () => ({
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockResolvedValue('{}'),
  mkdir: jest.fn().mockResolvedValue(undefined),
}));

// Mock子进程
jest.mock('child_process', () => ({
  spawn: jest.fn().mockReturnValue({
    stdout: { on: jest.fn() },
    stderr: { on: jest.fn() },
    on: jest.fn((event, callback) => {
      if (event === 'close') {
        setTimeout(() => callback(0), 10);
      }
      return this;
    }),
  }),
}));

describe('SWEBenchRunner', () => {
  let runner: SWEBenchRunner;
  let exampleTask: SWEBenchTask;

  beforeEach(() => {
    runner = new SWEBenchRunner({
      execution: {
        workingDir: './test-workspace',
        timeout: 1000,
        maxRetries: 1,
        sandbox: false,
      },
      evaluation: {
        verbose: false,
        passThreshold: 80,
        outputDir: './test-results',
      },
    });

    exampleTask = createExampleTask('test-task-001');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('构造函数', () => {
    it('应该使用默认配置创建实例', () => {
      const defaultRunner = new SWEBenchRunner();
      expect(defaultRunner).toBeInstanceOf(SWEBenchRunner);
    });

    it('应该允许自定义配置', () => {
      const customConfig = {
        model: {
          name: 'custom-model',
          endpoint: 'http://custom.endpoint',
          temperature: 0.5,
          maxTokens: 4096,
        },
      };

      const customRunner = new SWEBenchRunner(customConfig);
      expect(customRunner).toBeInstanceOf(SWEBenchRunner);
    });
  });

  describe('任务验证', () => {
    it('应该验证有效的任务', () => {
      const errors = validateTask(exampleTask);
      expect(errors).toHaveLength(0);
    });

    it('应该检测缺少ID的任务', () => {
      const invalidTask = { ...exampleTask, id: '' };
      const errors = validateTask(invalidTask as SWEBenchTask);
      expect(errors).toContain('任务ID不能为空');
    });

    it('应该检测缺少标题的任务', () => {
      const invalidTask = { ...exampleTask, title: '' };
      const errors = validateTask(invalidTask as SWEBenchTask);
      expect(errors).toContain('任务标题不能为空');
    });

    it('应该检测无效的超时时间', () => {
      const invalidTask = { ...exampleTask, testSuite: { ...exampleTask.testSuite, timeout: 0 } };
      const errors = validateTask(invalidTask as SWEBenchTask);
      expect(errors).toContain('测试超时时间必须大于0');
    });
  });

  describe('环境准备', () => {
    it('应该创建工作目录结构', async () => {
      const { mkdir } = await import('fs/promises');

      await (runner as any).prepareEnvironment(exampleTask);

      expect(mkdir).toHaveBeenCalledWith('./test-workspace', { recursive: true });
      expect(mkdir).toHaveBeenCalledWith('./test-workspace/tasks', { recursive: true });
      expect(mkdir).toHaveBeenCalledWith('./test-workspace/results', { recursive: true });
      expect(mkdir).toHaveBeenCalledWith('./test-workspace/workspace', { recursive: true });
    });
  });

  describe('测试输出解析', () => {
    it('应该解析包含通过和失败测试的输出', () => {
      const output = `
Running tests...
test_calculate_average (tests.test_average.TestAverage) ... ok
test_empty_list (tests.test_average.TestAverage) ... FAIL
test_none_input (tests.test_average.TestAverage) ... skipped

======================================================================
FAIL: test_empty_list (tests.test_average.TestAverage)
----------------------------------------------------------------------
Ran 3 tests in 0.001s

FAILED (failures=1, skipped=1)
`;

      const result = (runner as any).parseTestOutput(output);

      expect(result.total).toBe(3);
      expect(result.passed).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.skipped).toBe(1);
      expect(result.errors).toBe(0);
    });

    it('应该解析包含错误的输出', () => {
      const output = `
Running tests...
test_calculate_average (tests.test_average.TestAverage) ... ERROR
test_empty_list (tests.test_average.TestAverage) ... ok

======================================================================
ERROR: test_calculate_average (tests.test_average.TestAverage)
----------------------------------------------------------------------
Ran 2 tests in 0.001s

FAILED (errors=1)
`;

      const result = (runner as any).parseTestOutput(output);

      expect(result.total).toBe(2);
      expect(result.passed).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.errors).toBe(1);
    });

    it('应该处理空输出', () => {
      const result = (runner as any).parseTestOutput('');

      expect(result.total).toBe(0);
      expect(result.passed).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.errors).toBe(0);
    });
  });

  describe('结果评估', () => {
    it('应该评估通过的结果', () => {
      const testResults = {
        total: 10,
        passed: 10,
        failed: 0,
        skipped: 0,
        errors: 0,
        output: '',
        duration: 1000,
      };

      const evaluation = (runner as any).evaluateResult(exampleTask, testResults);

      expect(evaluation.passed).toBe(true);
      expect(evaluation.score).toBe(100);
      expect(evaluation.failureReason).toBeUndefined();
    });

    it('应该评估失败的结果', () => {
      const testResults = {
        total: 10,
        passed: 7,
        failed: 3,
        skipped: 0,
        errors: 0,
        output: '',
        duration: 1000,
      };

      const evaluation = (runner as any).evaluateResult(exampleTask, testResults);

      expect(evaluation.passed).toBe(false);
      expect(evaluation.score).toBe(70);
      expect(evaluation.failureReason).toContain('低于阈值');
    });

    it('应该处理要求所有测试通过的任务', () => {
      const strictTask = {
        ...exampleTask,
        evaluation: { ...exampleTask.evaluation, requireAllTestsPass: true },
      };

      const testResults = {
        total: 10,
        passed: 9,
        failed: 1,
        skipped: 0,
        errors: 0,
        output: '',
        duration: 1000,
      };

      const evaluation = (runner as any).evaluateResult(strictTask, testResults);

      expect(evaluation.passed).toBe(false);
      expect(evaluation.score).toBe(90);
    });

    it('应该处理允许失败的任务', () => {
      const lenientTask = {
        ...exampleTask,
        evaluation: { ...exampleTask.evaluation, requireAllTestsPass: false, maxFailures: 2 },
      };

      const testResults = {
        total: 10,
        passed: 8,
        failed: 2,
        skipped: 0,
        errors: 0,
        output: '',
        duration: 1000,
      };

      const evaluation = (runner as any).evaluateResult(lenientTask, testResults);

      expect(evaluation.passed).toBe(true);
      expect(evaluation.score).toBe(80);
    });
  });

  describe('报告生成', () => {
    it('应该生成正确的报告', () => {
      const results: SWEBenchResult[] = [
        {
          taskId: 'task-001',
          status: 'completed',
          testResults: {
            total: 10,
            passed: 10,
            failed: 0,
            skipped: 0,
            errors: 0,
            output: '',
            duration: 1000,
          },
          evaluation: {
            passed: true,
            score: 100,
            metrics: {},
          },
          execution: {
            startTime: '2024-01-01T00:00:00Z',
            endTime: '2024-01-01T00:00:01Z',
            duration: 1000,
            model: 'deepseek-chat',
            config: {},
          },
        },
        {
          taskId: 'task-002',
          status: 'completed',
          testResults: {
            total: 10,
            passed: 8,
            failed: 2,
            skipped: 0,
            errors: 0,
            output: '',
            duration: 1500,
          },
          evaluation: {
            passed: false,
            score: 80,
            metrics: {},
            failureReason: '测试通过率 80.0% 低于阈值 80%',
          },
          execution: {
            startTime: '2024-01-01T00:00:00Z',
            endTime: '2024-01-01T00:00:01.5Z',
            duration: 1500,
            model: 'deepseek-chat',
            config: {},
          },
        },
      ];

      const report = runner.generateReport(results);

      expect(report).toContain('# SWE-bench 运行报告');
      expect(report).toContain('总任务数: 2');
      expect(report).toContain('通过数: 1');
      expect(report).toContain('失败数: 1');
      expect(report).toContain('通过率: 50.0%');
      expect(report).toContain('task-001');
      expect(report).toContain('task-002');
    });

    it('应该处理空结果列表', () => {
      const report = runner.generateReport([]);

      expect(report).toContain('总任务数: 0');
      expect(report).toContain('通过数: 0');
      expect(report).toContain('失败数: 0');
      expect(report).toContain('通过率: NaN%');
    });
  });

  describe('进度通知', () => {
    it('应该调用进度回调', async () => {
      const progressCallback = jest.fn();

      const mockRunner = {
        ...runner,
        prepareEnvironment: jest.fn().mockResolvedValue(undefined),
        analyzeAndSolve: jest.fn().mockResolvedValue('solution'),
        applySolution: jest.fn().mockResolvedValue(undefined),
        runTests: jest.fn().mockResolvedValue({
          total: 10,
          passed: 10,
          failed: 0,
          skipped: 0,
          errors: 0,
          output: '',
          duration: 1000,
        }),
        evaluateResult: jest.fn().mockReturnValue({
          passed: true,
          score: 100,
          metrics: {},
        }),
        saveResult: jest.fn().mockResolvedValue(undefined),
        loadTask: jest.fn().mockResolvedValue(exampleTask),
      };

      try {
        await (mockRunner as any).run({
          task: exampleTask,
          onProgress: progressCallback,
        });
      } catch (error) {
        // 忽略错误，因为我们mock了大部分方法
      }

      expect(progressCallback).toHaveBeenCalled();
    });
  });
});

describe('工具函数', () => {
  describe('createExampleTask', () => {
    it('应该创建有效的示例任务', () => {
      const task = createExampleTask();

      expect(task.id).toBe('swe-bench-example-001');
      expect(task.title).toBe('修复边界条件检查错误');
      expect(task.description).toContain('calculate_average');
      expect(task.repository.url).toBe('https://github.com/example/repo');
      expect(task.testSuite.command).toBe('pytest tests/test_average.py');
      expect(task.metadata.difficulty).toBe('easy');
      expect(task.metadata.type).toBe('bug-fix');
      expect(task.metadata.language).toBe('python');
    });

    it('应该允许自定义任务ID', () => {
      const task = createExampleTask('custom-id-123');

      expect(task.id).toBe('custom-id-123');
    });
  });
});