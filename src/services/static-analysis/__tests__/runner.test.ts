/**
 * Runner 测试（新版本）
 * 测试符合蒸馏协议的 runner
 */

import { runStaticGate, formatGateReport, shouldScan } from '../index';

describe('Static Gate Runner (New)', () => {
  test('应该处理空文件列表', async () => {
    const result = await runStaticGate([]);

    expect(result.passed).toBe(true);
    expect(result.totalIssues).toBe(0);
    expect(result.errors).toBe(0);
    expect(result.warnings).toBe(0);
    expect(result.issues).toHaveLength(0);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);

    // 检查各层
    expect(result.layers.astGrep.passed).toBe(true);
    expect(result.layers.tsc.passed).toBe(true);
    expect(result.layers.eslint.passed).toBe(true);
  });

  test('应该跳过 node_modules 文件', async () => {
    const result = await runStaticGate(['node_modules/package/index.js']);

    // 由于 shouldScan 过滤，应该没有实际扫描
    expect(result.passed).toBe(true);
    expect(result.totalIssues).toBe(0);
  });

  test('应该生成报告', () => {
    const passedResult = {
      passed: true,
      totalIssues: 0,
      errors: 0,
      warnings: 0,
      issues: [],
      durationMs: 100,
      layers: {
        astGrep: { passed: true, issues: [], durationMs: 0 },
        tsc: { passed: true, issues: [], durationMs: 0 },
        eslint: { passed: true, issues: [], durationMs: 0 },
      },
    };

    const report = formatGateReport(passedResult);
    expect(report).toContain('PASSED');
    expect(report.length).toBeLessThan(5000);
  });

  test('应该生成失败报告', () => {
    const failedResult = {
      passed: false,
      totalIssues: 2,
      errors: 2,
      warnings: 0,
      issues: [
        {
          severity: 'error' as const,
          source: 'ast-grep' as const,
          file: 'src/test.ts',
          line: 1,
          column: 1,
          rule: 'no-any-cast',
          message: 'Avoid using any type',
          suggestion: 'Use proper type instead',
        },
        {
          severity: 'error' as const,
          source: 'tsc' as const,
          file: 'src/test2.ts',
          line: 2,
          column: 2,
          rule: 'TS2304',
          message: 'Cannot find name',
        },
      ],
      durationMs: 200,
      layers: {
        astGrep: { passed: false, issues: [], durationMs: 0 },
        tsc: { passed: false, issues: [], durationMs: 0 },
        eslint: { passed: true, issues: [], durationMs: 0 },
      },
    };

    const report = formatGateReport(failedResult);
    expect(report).toContain('FAILED');
    expect(report).toContain('no-any-cast');
    expect(report).toContain('TS2304');
    expect(report.length).toBeLessThan(5000);
  });

  test('shouldScan 应该正确过滤文件', () => {
    // 应该扫描的文件
    expect(shouldScan('src/test.ts')).toBe(true);
    expect(shouldScan('src/test.js')).toBe(true);
    expect(shouldScan('src/test.tsx')).toBe(true);
    expect(shouldScan('src/test.jsx')).toBe(true);
    expect(shouldScan('src/test.mjs')).toBe(true);
    expect(shouldScan('src/test.cjs')).toBe(true);

    // 不应该扫描的文件
    expect(shouldScan('node_modules/package/index.js')).toBe(false);
    expect(shouldScan('dist/app.js')).toBe(false);
    expect(shouldScan('.trash/file.ts')).toBe(false);
    expect(shouldScan('__tests__/test.ts')).toBe(false);
    expect(shouldScan('.dsxu/config.ts')).toBe(false);
    expect(shouldScan('非dsxu-code项目文件/log.ts')).toBe(false);
    expect(shouldScan('.git/config')).toBe(false);
    expect(shouldScan('README.md')).toBe(false); // 非代码文件
    expect(shouldScan('.env')).toBe(false); // 隐藏文件
    expect(shouldScan('src/.test.ts')).toBe(false); // 隐藏文件
  });

  test('应该处理 skipLayers 选项', async () => {
    // 创建一个临时的TypeScript文件用于测试（不在__tests__目录中）
    const tempFile = 'src/services/static-analysis/temp-skip-test.ts';
    const fs = require('fs');
    const path = require('path');

    // 确保目录存在
    const dir = path.dirname(tempFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(tempFile, 'const x: number = 1;');

    try {
      const result = await runStaticGate([tempFile], {
        skipLayers: ['tsc', 'eslint'],
      });

      expect(result.layers.tsc.skipped).toBe(true);
      expect(result.layers.eslint.skipped).toBe(true);
      expect(result.layers.astGrep.skipped).toBe(true); // ast-grep 默认禁用
    } finally {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  });

  test('应该处理 shortCircuitOnError 选项', async () => {
    // 这个测试需要实际有错误的文件，这里只是测试选项传递
    const result = await runStaticGate(['package.json'], {
      shortCircuitOnError: false,
    });

    // 确保函数没有抛出异常
    expect(result).toBeDefined();
  });
});
