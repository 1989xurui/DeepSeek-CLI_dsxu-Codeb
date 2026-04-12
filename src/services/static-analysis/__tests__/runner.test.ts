/**
 * 静态分析 runner 测试
 */

import { runStaticAnalysis, formatForCriticPrompt, getCriticalIssueCount } from '../runner';

describe('Static Analysis Runner', () => {
  // 模拟文件路径
  const mockFiles = ['src/test.ts', 'src/utils.js'];

  test('runStaticAnalysis 应该返回正确结构', async () => {
    // 由于实际运行需要工具，这里主要测试函数签名和错误处理
    const result = await runStaticAnalysis(mockFiles);

    expect(result).toHaveProperty('issues');
    expect(result).toHaveProperty('durationMs');
    expect(result).toHaveProperty('toolsRun');
    expect(result).toHaveProperty('failed');

    expect(Array.isArray(result.issues)).toBe(true);
    expect(typeof result.durationMs).toBe('number');
    expect(Array.isArray(result.toolsRun)).toBe(true);
    expect(Array.isArray(result.failed)).toBe(true);
  });

  test('formatForCriticPrompt 应该格式化输出', () => {
    const mockResult = {
      issues: [
        {
          tool: 'tsc' as const,
          severity: 'error' as const,
          file: 'src/test.ts',
          line: 10,
          col: 5,
          ruleId: 'TS2322',
          message: 'Type string is not assignable to type number',
        },
        {
          tool: 'eslint' as const,
          severity: 'warning' as const,
          file: 'src/utils.js',
          line: 20,
          col: 3,
          ruleId: 'no-console',
          message: 'Unexpected console statement',
        },
      ],
      durationMs: 1234,
      toolsRun: ['tsc', 'eslint'],
      failed: [],
    };

    const prompt = formatForCriticPrompt(mockResult);

    expect(prompt).toContain('# 静态分析报告');
    expect(prompt).toContain('## TSC');
    expect(prompt).toContain('## ESLINT');
    expect(prompt).toContain('❌ ERROR');
    expect(prompt).toContain('⚠️ WARNING');
    expect(prompt).toContain('统计信息');
    expect(prompt).toContain('修复建议');
  });

  test('formatForCriticPrompt 无问题时显示成功', () => {
    const mockResult = {
      issues: [],
      durationMs: 500,
      toolsRun: ['tsc', 'eslint'],
      failed: [],
    };

    const prompt = formatForCriticPrompt(mockResult);
    expect(prompt).toBe('静态分析: 未发现问题 ✅');
  });

  test('getCriticalIssueCount 应该计算严重问题', () => {
    const mockResult = {
      issues: [
        { tool: 'tsc', severity: 'error', file: 'a.ts', line: 1, col: 1, message: 'error' },
        { tool: 'eslint', severity: 'warning', file: 'b.js', line: 2, col: 2, message: 'warning' },
        { tool: 'semgrep', severity: 'warning', file: 'c.py', line: 3, col: 3, message: 'security warning' },
        { tool: 'tsc', severity: 'info', file: 'd.ts', line: 4, col: 4, message: 'info' },
      ],
      durationMs: 0,
      toolsRun: [],
      failed: [],
    };

    const count = getCriticalIssueCount(mockResult);
    // tsc error + semgrep warning = 2 个严重问题
    expect(count).toBe(2);
  });

  test('getCriticalIssueCount 应该处理空数组', () => {
    const mockResult = {
      issues: [],
      durationMs: 0,
      toolsRun: [],
      failed: [],
    };

    const count = getCriticalIssueCount(mockResult);
    expect(count).toBe(0);
  });
});