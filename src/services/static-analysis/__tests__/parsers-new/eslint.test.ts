/**
 * ESLint 解析器测试（新版本）
 * 测试符合蒸馏协议的 parser
 */

import { parseEslintOutput } from '../../parsers-new/eslint';

describe('ESLint Parser (New)', () => {
  const cwd = '/project';

  test('应该解析 JSON 格式输出', () => {
    const jsonOutput = JSON.stringify([
      {
        filePath: '/project/src/test.js',
        messages: [
          {
            ruleId: 'no-console',
            severity: 2,
            message: 'Unexpected console statement',
            line: 10,
            column: 5,
          },
          {
            ruleId: 'eqeqeq',
            severity: 1,
            message: 'Expected === and instead saw ==',
            line: 20,
            column: 12,
          },
        ],
        errorCount: 1,
        warningCount: 1,
        fixableErrorCount: 0,
        fixableWarningCount: 0,
      },
    ]);

    const issues = parseEslintOutput(jsonOutput, cwd, ['src/test.js']);

    expect(issues).toHaveLength(2);

    // 检查第一个问题（error）
    expect(issues[0]).toMatchObject({
      severity: 'error',
      source: 'eslint',
      file: 'src/test.js',
      line: 10,
      column: 5,
      rule: 'no-console',
      message: 'Unexpected console statement',
    });
    expect(issues[0].suggestion).toBeDefined();
    expect(issues[0].suggestion).toContain('Remove console statement');

    // 检查第二个问题（warning）
    expect(issues[1]).toMatchObject({
      severity: 'warning',
      source: 'eslint',
      file: 'src/test.js',
      line: 20,
      column: 12,
      rule: 'eqeqeq',
      message: 'Expected === and instead saw ==',
    });
    expect(issues[1].suggestion).toBeDefined();
    expect(issues[1].suggestion).toContain('Use === instead');
  });

  test('应该处理 severity 转换', () => {
    const jsonOutput = JSON.stringify([
      {
        filePath: '/project/test.js',
        messages: [
          { ruleId: 'rule1', severity: 0, message: 'off', line: 1, column: 1 },
          { ruleId: 'rule2', severity: 1, message: 'warning', line: 2, column: 2 },
          { ruleId: 'rule3', severity: 2, message: 'error', line: 3, column: 3 },
        ],
        errorCount: 1,
        warningCount: 1,
        fixableErrorCount: 0,
        fixableWarningCount: 0,
      },
    ]);

    const issues = parseEslintOutput(jsonOutput, cwd, ['test.js']);

    expect(issues[0].severity).toBe('info'); // severity 0 -> info
    expect(issues[1].severity).toBe('warning'); // severity 1 -> warning
    expect(issues[2].severity).toBe('error'); // severity 2 -> error
  });

  test('应该规范化文件路径', () => {
    const jsonOutput = JSON.stringify([
      {
        filePath: '/project/src/utils.js',
        messages: [
          { ruleId: 'test', severity: 1, message: 'test', line: 1, column: 1 },
        ],
        errorCount: 0,
        warningCount: 1,
        fixableErrorCount: 0,
        fixableWarningCount: 0,
      },
    ]);

    const issues = parseEslintOutput(jsonOutput, cwd, ['src/utils.js']);
    expect(issues[0].file).toBe('src/utils.js'); // 移除了 /project 前缀
  });

  test('应该处理 Windows 路径', () => {
    const windowsCwd = 'C:\\project';
    const jsonOutput = JSON.stringify([
      {
        filePath: 'C:\\project\\src\\app.js',
        messages: [
          { ruleId: 'test', severity: 1, message: 'test', line: 1, column: 1 },
        ],
        errorCount: 0,
        warningCount: 1,
        fixableErrorCount: 0,
        fixableWarningCount: 0,
      },
    ]);

    const issues = parseEslintOutput(jsonOutput, windowsCwd, ['src/app.js']);
    expect(issues[0].file).toBe('src/app.js'); // 统一为正斜杠
  });

  test('应该解析文本格式输出（fallback）', () => {
    const textOutput = `
/project/src/test.js:10:5: Unexpected console statement (no-console)
/project/src/test.js:20:12: Expected === and instead saw == (eqeqeq)
    `.trim();

    const issues = parseEslintOutput(textOutput, cwd, ['src/test.js']);

    expect(issues).toHaveLength(2);
    expect(issues[0].source).toBe('eslint');
    expect(issues[0].file).toBe('src/test.js');
    expect(issues[0].line).toBe(10);
    expect(issues[0].column).toBe(5);
    expect(issues[0].rule).toBe('no-console');
  });

  test('应该处理无效 JSON（fallback 到文本解析）', () => {
    const invalidOutput = 'Not a JSON string';
    const issues = parseEslintOutput(invalidOutput, cwd, []);

    // 应该返回空数组（因为没有匹配的文本格式）
    expect(issues).toHaveLength(0);
  });

  test('应该处理空输出', () => {
    const emptyOutput = '';
    const issues = parseEslintOutput(emptyOutput, cwd, []);
    expect(issues).toHaveLength(0);
  });

  test('应该生成建议', () => {
    const jsonOutput = JSON.stringify([
      {
        filePath: '/project/test.js',
        messages: [
          {
            ruleId: 'no-console',
            severity: 2,
            message: 'Unexpected console statement',
            line: 1,
            column: 1,
            fix: {
              range: [0, 10],
              text: '',
            },
          },
        ],
        errorCount: 1,
        warningCount: 0,
        fixableErrorCount: 1,
        fixableWarningCount: 0,
      },
    ]);

    const issues = parseEslintOutput(jsonOutput, cwd, ['test.js']);
    expect(issues[0].suggestion).toBeDefined();
    expect(issues[0].suggestion).toContain('Remove console statement');
  });
});