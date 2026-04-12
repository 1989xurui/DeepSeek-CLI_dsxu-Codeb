/**
 * 静态分析集成测试
 */

import { StaticAnalysisBridge } from '../bridge';
import { runStaticGate } from '../index';

// 模拟解析器
jest.mock('../parsers/eslint', () => ({
  parseEslintOutput: jest.fn().mockReturnValue([
    { severity: 'warning', source: 'eslint', file: 'test.js', line: 1, column: 1, rule: 'no-console', message: 'test' },
  ]),
}));

jest.mock('../parsers/tsc', () => ({
  parseTscOutput: jest.fn().mockReturnValue([
    { severity: 'error', source: 'tsc', file: 'test.ts', line: 2, column: 2, rule: 'TS2322', message: 'type error' },
  ]),
}));

jest.mock('../parsers/ast-grep', () => ({
  parseAstGrepOutput: jest.fn().mockReturnValue([
    { severity: 'warning', source: 'ast-grep', file: 'test.py', line: 3, column: 3, rule: 'security', message: 'security issue' },
  ]),
}));

// 模拟子进程执行
jest.mock('child_process', () => ({
  spawn: jest.fn(() => ({
    on: jest.fn((event, callback) => {
      if (event === 'close') {
        setTimeout(() => callback(0), 10);
      }
      return this;
    }),
    stdout: { on: jest.fn((event, callback) => {
      if (event === 'data') {
        setTimeout(() => callback(Buffer.from('')), 5);
      }
    })},
    stderr: { on: jest.fn((event, callback) => {
      if (event === 'data') {
        setTimeout(() => callback(Buffer.from('')), 5);
      }
    })},
  })),
}));

describe('Static Analysis Integration', () => {
  let bridge: StaticAnalysisBridge;

  beforeEach(() => {
    bridge = new StaticAnalysisBridge({
      enabled: true,
      failOnCritical: true,
      maxCriticalIssues: 0,
    });
  });

  test('runStaticGate 应该返回正确格式的结果', async () => {
    const result = await runStaticGate(['test.ts'], {
      mockSpawn: async () => ({
        exitCode: 0,
        stdout: '',
        stderr: '',
        durationMs: 100,
      }),
    });

    expect(result).toHaveProperty('passed');
    expect(result).toHaveProperty('totalIssues');
    expect(result).toHaveProperty('errors');
    expect(result).toHaveProperty('warnings');
    expect(result).toHaveProperty('issues');
    expect(result).toHaveProperty('durationMs');
    expect(result).toHaveProperty('layers');
    expect(result.layers).toHaveProperty('astGrep');
    expect(result.layers).toHaveProperty('tsc');
    expect(result.layers).toHaveProperty('eslint');
  });

  test('bridge 应该集成 runStaticGate', async () => {
    const patchInfo = {
      filePaths: ['test.ts'],
      patchContent: 'test',
    };

    const result = await bridge.analyzeAfterPatch(patchInfo);

    expect(result).toHaveProperty('result');
    expect(result).toHaveProperty('criticPrompt');
    expect(result).toHaveProperty('shouldBlock');
    expect(result.criticPrompt).toContain('静态分析');
  });

  test('shouldScan 应该过滤文件', async () => {
    const { shouldScan } = await import('../index');

    expect(shouldScan('src/test.ts')).toBe(true);
    expect(shouldScan('src/test.js')).toBe(true);
    expect(shouldScan('src/test.tsx')).toBe(true);
    expect(shouldScan('src/test.jsx')).toBe(true);

    expect(shouldScan('node_modules/package/index.js')).toBe(false);
    expect(shouldScan('dist/bundle.js')).toBe(false);
    expect(shouldScan('.dsxu/config.ts')).toBe(false);
    expect(shouldScan('__tests__/test.test.ts')).toBe(false);
  });
});