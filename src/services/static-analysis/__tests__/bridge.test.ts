/**
 * 静态分析桥接器测试
 */

import { StaticAnalysisBridge, createStaticAnalysisBridge } from '../bridge';

describe('Static Analysis Bridge', () => {
  let bridge: StaticAnalysisBridge;

  beforeEach(() => {
    bridge = new StaticAnalysisBridge({ enabled: false });
  });

  test('应该使用默认配置', () => {
    const defaultBridge = new StaticAnalysisBridge();
    const options = defaultBridge.getOptions();

    expect(options.enabled).toBe(true);
    expect(options.failOnCritical).toBe(true);
    expect(options.maxCriticalIssues).toBe(0);
    expect(options.tools?.tsc).toBe(true);
    expect(options.tools?.eslint).toBe(true);
    expect(options.tools?.semgrep).toBe(true);
  });

  test('应该允许自定义配置', () => {
    const customBridge = new StaticAnalysisBridge({
      enabled: false,
      failOnCritical: false,
      maxCriticalIssues: 5,
      tools: { tsc: false, eslint: true, semgrep: false },
    });

    const options = customBridge.getOptions();
    expect(options.enabled).toBe(false);
    expect(options.failOnCritical).toBe(false);
    expect(options.maxCriticalIssues).toBe(5);
    expect(options.tools?.tsc).toBe(false);
    expect(options.tools?.eslint).toBe(true);
    expect(options.tools?.semgrep).toBe(false);
  });

  test('analyzeAfterPatch 禁用时应跳过', async () => {
    const disabledBridge = new StaticAnalysisBridge({ enabled: false });
    const patchInfo = {
      filePaths: ['src/test.ts'],
      patchContent: '',
    };

    const result = await disabledBridge.analyzeAfterPatch(patchInfo);

    expect(result.shouldBlock).toBe(false);
    expect(result.criticPrompt).toContain('已禁用');
  });

  test('checkShouldBlock 应该根据严重问题数决定', () => {
    const testBridge = new StaticAnalysisBridge({ failOnCritical: true, maxCriticalIssues: 2 });

    // 模拟结果：3个严重问题（超过阈值2）
    const mockResult = {
      issues: [
        { tool: 'tsc', severity: 'error', file: 'a.ts', line: 1, col: 1, ruleId: 'TS1', message: 'error' },
        { tool: 'semgrep', severity: 'warning', file: 'b.js', line: 2, col: 2, ruleId: 'SEC1', message: 'security' },
        { tool: 'semgrep', severity: 'warning', file: 'c.py', line: 3, col: 3, ruleId: 'SEC2', message: 'security' },
      ],
      durationMs: 0,
      toolsRun: ['tsc', 'semgrep'],
      failed: [],
    };

    // 使用私有方法测试（通过类型断言）
    const { shouldBlock, blockReason } = (testBridge as any).checkShouldBlock(mockResult);
    expect(shouldBlock).toBe(true);
    expect(blockReason).toContain('发现 3 个严重问题');
  });

  test('checkShouldBlock 不应该在 failOnCritical=false 时阻止', () => {
    const testBridge = new StaticAnalysisBridge({ failOnCritical: false });

    const mockResult = {
      issues: [
        { tool: 'tsc', severity: 'error', file: 'a.ts', line: 1, col: 1, ruleId: 'TS1', message: 'error' },
      ],
      durationMs: 0,
      toolsRun: ['tsc'],
      failed: [],
    };

    const { shouldBlock } = (testBridge as any).checkShouldBlock(mockResult);
    expect(shouldBlock).toBe(false);
  });

  test('checkShouldBlock 应该在关键工具失败时阻止', () => {
    const testBridge = new StaticAnalysisBridge({ failOnCritical: true });

    const mockResult = {
      issues: [],
      durationMs: 0,
      toolsRun: [],
      failed: ['tsc'], // tsc 是关键工具
    };

    const { shouldBlock, blockReason } = (testBridge as any).checkShouldBlock(mockResult);
    expect(shouldBlock).toBe(true);
    expect(blockReason).toContain('关键工具失败');
  });

  test('getAnalysisSummary 应该生成正确摘要', () => {
    const mockResult = {
      issues: [
        { tool: 'tsc', severity: 'error', file: 'a.ts', line: 1, col: 1, ruleId: 'TS1', message: 'error' },
        { tool: 'eslint', severity: 'warning', file: 'b.js', line: 2, col: 2, ruleId: 'no-console', message: 'warning' },
        { tool: 'eslint', severity: 'info', file: 'c.js', line: 3, col: 3, ruleId: 'prefer-const', message: 'info' },
      ],
      durationMs: 1234,
      toolsRun: ['tsc', 'eslint'],
      failed: ['semgrep'],
    };

    const summary = bridge.getAnalysisSummary(mockResult);
    expect(summary).toContain('工具: tsc, eslint');
    expect(summary).toContain('失败: semgrep');
    expect(summary).toContain('问题: 3 (❌1 ⚠️1 ℹ️1)');
    expect(summary).toContain('耗时: 1234ms');
  });

  test('updateOptions 应该合并配置', () => {
    bridge.updateOptions({ maxCriticalIssues: 10, failOnCritical: false });
    const options = bridge.getOptions();

    expect(options.maxCriticalIssues).toBe(10);
    expect(options.failOnCritical).toBe(false);
    // 其他选项应该保持不变
    expect(options.enabled).toBe(false);
    expect(options.tools?.tsc).toBe(true);
  });

  test('createStaticAnalysisBridge 应该创建实例', () => {
    const bridge = createStaticAnalysisBridge({ enabled: false });
    expect(bridge).toBeInstanceOf(StaticAnalysisBridge);
    expect(bridge.getOptions().enabled).toBe(false);
  });
});