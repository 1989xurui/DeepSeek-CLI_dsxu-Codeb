/**
 * 静态分析集成测试
 */

import { StaticAnalysisBridge } from '../bridge';
import { runStaticAnalysis } from '../runner';

// 模拟解析器
jest.mock('../parsers/eslint', () => ({
  parseEslintOutput: jest.fn().mockReturnValue([
    { tool: 'eslint', severity: 'warning', file: 'test.js', line: 1, col: 1, ruleId: 'no-console', message: 'test' },
  ]),
}));

jest.mock('../parsers/tsc', () => ({
  parseTscOutput: jest.fn().mockReturnValue([
    { tool: 'tsc', severity: 'error', file: 'test.ts', line: 2, col: 2, ruleId: 'TS2322', message: 'type error' },
  ]),
}));

jest.mock('../parsers/semgrep', () => ({
  parseSemgrepOutput: jest.fn().mockReturnValue([
    { tool: 'semgrep', severity: 'warning', file: 'test.py', line: 3, col: 3, ruleId: 'security', message: 'security issue' },
  ]),
}));

// 模拟子进程执行
jest.mock('child_process', () => ({
  exec: jest.fn((command, callback) => {
    if (command.includes('eslint')) {
      callback(null, JSON.stringify([{ filePath: 'test.js', messages: [] }]), '');
    } else if (command.includes('tsc')) {
      callback(null, '', '');
    } else if (command.includes('semgrep')) {
      callback(null, JSON.stringify({ results: [] }), '');
    } else {
      callback(new Error('Unknown command'), '', '');
    }
  }),
}));

describe('Static Analysis Integration', () => {
  let bridge: StaticAnalysisBridge;

  beforeEach(() => {
    bridge = new StaticAnalysisBridge({
      enabled: true,
      failOnCritical: true,
      maxCriticalIssues: 0,
      tools: { tsc: true, eslint: true, semgrep: true },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('桥接器应该调用 runner 并处理结果', async () => {
    const mockFiles = ['src/test.ts', 'src/test.js'];
    const patchInfo = {
      filePaths: mockFiles,
      patchContent: 'test patch',
    };

    const result = await bridge.analyzeAfterPatch(patchInfo);

    // 验证结果结构
    expect(result).toHaveProperty('shouldBlock');
    expect(result).toHaveProperty('blockReason');
    expect(result).toHaveProperty('criticPrompt');
    expect(result).toHaveProperty('analysisResult');

    // 由于模拟了错误和警告，shouldBlock 应该为 true
    expect(result.shouldBlock).toBe(true);
    expect(result.blockReason).toContain('发现 2 个严重问题');
  });

  test('桥接器应该处理工具失败', async () => {
    // 修改模拟使 tsc 失败
    const child_process = require('child_process');
    child_process.exec.mockImplementation((command, callback) => {
      if (command.includes('tsc')) {
        callback(new Error('tsc failed'), '', 'error output');
      } else {
        callback(null, '', '');
      }
    });

    const patchInfo = {
      filePaths: ['src/test.ts'],
      patchContent: 'test',
    };

    const result = await bridge.analyzeAfterPatch(patchInfo);

    // tsc 是关键工具，失败应该导致阻塞
    expect(result.shouldBlock).toBe(true);
    expect(result.blockReason).toContain('关键工具失败');
  });

  test('桥接器应该处理空文件列表', async () => {
    const patchInfo = {
      filePaths: [],
      patchContent: 'test',
    };

    const result = await bridge.analyzeAfterPatch(patchInfo);

    // 没有文件时应该跳过分析
    expect(result.shouldBlock).toBe(false);
    expect(result.criticPrompt).toContain('没有需要分析的文件');
  });

  test('桥接器应该根据配置决定是否阻塞', async () => {
    // 配置为不阻塞
    const nonBlockingBridge = new StaticAnalysisBridge({
      enabled: true,
      failOnCritical: false,
      maxCriticalIssues: 5,
    });

    const patchInfo = {
      filePaths: ['src/test.ts'],
      patchContent: 'test',
    };

    const result = await nonBlockingBridge.analyzeAfterPatch(patchInfo);

    // 即使有严重问题，failOnCritical=false 也不应该阻塞
    expect(result.shouldBlock).toBe(false);
  });

  test('runner 应该处理工具执行错误', async () => {
    // 修改模拟使所有工具都失败
    const child_process = require('child_process');
    child_process.exec.mockImplementation((command, callback) => {
      callback(new Error('Tool failed'), '', 'error');
    });

    const mockFiles = ['src/test.ts'];
    const result = await runStaticAnalysis(mockFiles);

    // 所有工具都应该失败
    expect(result.failed).toContain('tsc');
    expect(result.failed).toContain('eslint');
    expect(result.failed).toContain('semgrep');
    expect(result.issues).toHaveLength(0);
  });

  test('runner 应该过滤不支持的文件类型', async () => {
    const mockFiles = [
      'src/test.ts',      // TypeScript
      'src/test.js',      // JavaScript
      'src/test.py',      // Python
      'src/test.txt',     // 不支持
      'src/test.md',      // 不支持
    ];

    const result = await runStaticAnalysis(mockFiles);

    // 应该只对支持的文件类型运行工具
    expect(result.toolsRun).toContain('tsc');    // 对 .ts 文件
    expect(result.toolsRun).toContain('eslint'); // 对 .js 文件
    expect(result.toolsRun).toContain('semgrep'); // 对 .py 文件
  });

  test('桥接器应该生成正确的 critic prompt', async () => {
    const patchInfo = {
      filePaths: ['src/test.ts'],
      patchContent: 'test',
    };

    const result = await bridge.analyzeAfterPatch(patchInfo);

    expect(result.criticPrompt).toContain('# 静态分析报告');
    expect(result.criticPrompt).toContain('## TSC');
    expect(result.criticPrompt).toContain('## ESLINT');
    expect(result.criticPrompt).toContain('## SEMGREP');
    expect(result.criticPrompt).toContain('统计信息');
    expect(result.criticPrompt).toContain('修复建议');
  });
});