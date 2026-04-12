/**
 * semgrep 解析器测试
 */

import { parseSemgrepOutput } from '../../parsers/semgrep';

describe('Semgrep Parser', () => {
  const cwd = '/project';

  test('应该解析 JSON 格式输出', () => {
    const jsonOutput = JSON.stringify({
      results: [
        {
          check_id: 'javascript.console.log',
          path: '/project/src/test.js',
          start: { line: 10, col: 5 },
          end: { line: 10, col: 15 },
          extra: {
            message: 'Found console.log statement',
            severity: 'ERROR',
            metadata: { category: 'security' },
          },
        },
        {
          check_id: 'python.sql-injection',
          path: '/project/src/api.py',
          start: { line: 20, col: 12 },
          end: { line: 20, col: 25 },
          extra: {
            message: 'Potential SQL injection vulnerability',
            severity: 'WARNING',
            metadata: { category: 'security' },
          },
        },
      ],
    });

    const issues = parseSemgrepOutput(jsonOutput, cwd);

    expect(issues).toHaveLength(2);

    // 检查第一个问题
    expect(issues[0]).toEqual({
      tool: 'semgrep',
      severity: 'error',
      file: 'src/test.js',
      line: 10,
      col: 5,
      ruleId: 'javascript.console.log',
      message: 'Found console.log statement',
    });

    // 检查第二个问题
    expect(issues[1]).toEqual({
      tool: 'semgrep',
      severity: 'warning',
      file: 'src/api.py',
      line: 20,
      col: 12,
      ruleId: 'python.sql-injection',
      message: 'Potential SQL injection vulnerability',
    });
  });

  test('应该处理 severity 转换', () => {
    const jsonOutput = JSON.stringify({
      results: [
        {
          check_id: 'rule1',
          path: '/project/test.js',
          start: { line: 1, col: 1 },
          end: { line: 1, col: 10 },
          extra: {
            message: 'test',
            severity: 'ERROR',
          },
        },
        {
          check_id: 'rule2',
          path: '/project/test.js',
          start: { line: 2, col: 2 },
          end: { line: 2, col: 10 },
          extra: {
            message: 'test',
            severity: 'WARNING',
          },
        },
        {
          check_id: 'rule3',
          path: '/project/test.js',
          start: { line: 3, col: 3 },
          end: { line: 3, col: 10 },
          extra: {
            message: 'test',
            severity: 'INFO',
          },
        },
        {
          check_id: 'rule4',
          path: '/project/test.js',
          start: { line: 4, col: 4 },
          end: { line: 4, col: 10 },
          extra: {
            message: 'test',
            severity: 'UNKNOWN',
          },
        },
      ],
    });

    const issues = parseSemgrepOutput(jsonOutput, cwd);

    expect(issues[0].severity).toBe('error');
    expect(issues[1].severity).toBe('warning');
    expect(issues[2].severity).toBe('info');
    expect(issues[3].severity).toBe('info'); // 未知 -> info
  });

  test('应该规范化文件路径', () => {
    const jsonOutput = JSON.stringify({
      results: [
        {
          check_id: 'test',
          path: '/project/src/utils.js',
          start: { line: 1, col: 1 },
          end: { line: 1, col: 10 },
          extra: {
            message: 'test',
            severity: 'ERROR',
          },
        },
      ],
    });

    const issues = parseSemgrepOutput(jsonOutput, cwd);
    expect(issues[0].file).toBe('src/utils.js'); // 移除了 /project 前缀
  });

  test('应该处理 Windows 路径', () => {
    const windowsCwd = 'C:\\project';
    const jsonOutput = JSON.stringify({
      results: [
        {
          check_id: 'test',
          path: 'C:\\project\\src\\app.js',
          start: { line: 1, col: 1 },
          end: { line: 1, col: 10 },
          extra: {
            message: 'test',
            severity: 'ERROR',
          },
        },
      ],
    });

    const issues = parseSemgrepOutput(jsonOutput, windowsCwd);
    expect(issues[0].file).toBe('src/app.js'); // 统一为正斜杠
  });

  test('应该处理缺少 start 的情况', () => {
    const jsonOutput = JSON.stringify({
      results: [
        {
          check_id: 'test',
          path: '/project/test.js',
          extra: {
            message: 'test',
            severity: 'ERROR',
          },
        },
      ],
    });

    const issues = parseSemgrepOutput(jsonOutput, cwd);
    expect(issues[0].line).toBe(0);
    expect(issues[0].col).toBe(0);
  });

  test('应该处理无效 JSON', () => {
    const invalidOutput = 'Not a JSON string';
    const issues = parseSemgrepOutput(invalidOutput, cwd);

    expect(issues).toHaveLength(0);
  });

  test('应该处理空 results 数组', () => {
    const jsonOutput = JSON.stringify({
      results: [],
    });

    const issues = parseSemgrepOutput(jsonOutput, cwd);
    expect(issues).toHaveLength(0);
  });

  test('应该处理没有 results 字段', () => {
    const jsonOutput = JSON.stringify({});
    const issues = parseSemgrepOutput(jsonOutput, cwd);
    expect(issues).toHaveLength(0);
  });

  test('应该处理空输出', () => {
    const emptyOutput = '';
    const issues = parseSemgrepOutput(emptyOutput, cwd);
    expect(issues).toHaveLength(0);
  });

  test('应该处理文本格式输出（fallback）', () => {
    const textOutput = `
Running 1 rules...
src/test.js
rule:javascript.console.log
severity:ERROR
message:Found console.log statement
line:10
col:5
    `.trim();

    const issues = parseSemgrepOutput(textOutput, cwd);

    // 当前实现只支持 JSON 格式，文本格式会返回空数组
    expect(issues).toHaveLength(0);
  });
});