/**
 * tsc 解析器测试
 */

import { parseTscOutput } from '../../parsers/tsc';

describe('TSC Parser', () => {
  const cwd = '/project';

  test('应该解析标准错误格式', () => {
    const output = `
src/test.ts(10,5): error TS2322: Type 'string' is not assignable to type 'number'.
src/utils.ts(20,12): warning TS6133: 'unused' is declared but its value is never read.
    `.trim();

    const issues = parseTscOutput(output, cwd, ['src/test.ts', 'src/utils.ts']);

    expect(issues).toHaveLength(2);

    // 检查第一个问题（error）
    expect(issues[0]).toEqual({
      source: 'tsc',
      severity: 'error',
      file: 'src/test.ts',
      line: 10,
      column: 5,
      rule: 'TS2322',
      message: "Type 'string' is not assignable to type 'number'.",
      suggestion: expect.any(String),
    });

    // 检查第二个问题（warning）
    expect(issues[1]).toEqual({
      source: 'tsc',
      severity: 'warning',
      file: 'src/utils.ts',
      line: 20,
      column: 12,
      rule: 'TS6133',
      message: "'unused' is declared but its value is never read.",
      suggestion: expect.any(String),
    });
  });

  test('应该处理 severity 转换', () => {
    const output = `
test.ts(1,1): error TS0001: error message
test.ts(2,2): warning TS0002: warning message
test.ts(3,3): info TS0003: info message
    `.trim();

    const issues = parseTscOutput(output, cwd, ['src/test.ts']);

    expect(issues[0].severity).toBe('error');
    expect(issues[1].severity).toBe('warning');
    expect(issues[2].severity).toBe('info');
  });

  test('应该处理未知 severity', () => {
    const output = 'test.ts(1,1): unknown TS0000: unknown message';
    const issues = parseTscOutput(output, cwd, ['src/test.ts']);

    expect(issues[0].severity).toBe('info'); // 默认
  });

  test('应该规范化文件路径', () => {
    const output = '/project/src/app.ts(1,1): error TS0000: test';
    const issues = parseTscOutput(output, cwd, ['src/test.ts']);

    expect(issues[0].file).toBe('src/app.ts'); // 移除了 /project 前缀
  });

  test('应该处理 Windows 路径', () => {
    const windowsCwd = 'C:\\project';
    const output = 'C:\\project\\src\\app.ts(1,1): error TS0000: test';
    const issues = parseTscOutput(output, windowsCwd);

    expect(issues[0].file).toBe('src/app.ts'); // 统一为正斜杠
  });

  test('应该处理相对路径', () => {
    const output = 'src/app.ts(1,1): error TS0000: test';
    const issues = parseTscOutput(output, cwd, ['src/test.ts']);

    expect(issues[0].file).toBe('src/app.ts'); // 保持不变
  });

  test('应该跳过空行', () => {
    const output = `
src/test.ts(1,1): error TS0000: test

src/test.ts(2,2): warning TS0001: test2
    `.trim();

    const issues = parseTscOutput(output, cwd, ['src/test.ts']);
    expect(issues).toHaveLength(2);
  });

  test('应该处理没有行号列号的情况', () => {
    const output = 'src/test.ts: error TS0000: test';
    const issues = parseTscOutput(output, cwd, ['src/test.ts']);

    expect(issues[0].line).toBe(0);
    expect(issues[0].col).toBe(0);
  });

  test('应该处理部分匹配的行', () => {
    const output = 'Some other text that does not match the pattern';
    const issues = parseTscOutput(output, cwd, ['src/test.ts']);

    expect(issues).toHaveLength(0);
  });

  test('应该处理空输出', () => {
    const emptyOutput = '';
    const issues = parseTscOutput(emptyOutput, cwd);
    expect(issues).toHaveLength(0);
  });

  test('应该处理多行消息', () => {
    const output = `
src/test.ts(10,5): error TS2322: Type 'string' is not assignable to type 'number'.
  The expected type comes from property 'value' which is declared here on type 'Props'
    `.trim();

    const issues = parseTscOutput(output, cwd, ['src/test.ts']);

    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("Type 'string' is not assignable to type 'number'.");
    // 注意：当前实现只捕获第一行消息
  });
});