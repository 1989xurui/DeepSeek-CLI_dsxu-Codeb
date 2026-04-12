/**
 * TypeScript 编译器解析器测试（新版本）
 * 测试符合蒸馏协议的 parser
 */

import { parseTscOutput } from '../../parsers-new/tsc';

describe('TypeScript Compiler Parser (New)', () => {
  const cwd = '/project';

  test('应该解析 tsc 错误输出', () => {
    const tscOutput = `
src/test.ts(2,5): error TS2322: Type 'string' is not assignable to type 'number'.
src/test.ts(10,12): warning TS6133: 'unused' is declared but its value is never read.
    `.trim();

    const issues = parseTscOutput(tscOutput, cwd, ['src/test.ts']);

    expect(issues).toHaveLength(2);

    // 检查第一个问题（error）
    expect(issues[0]).toMatchObject({
      severity: 'error',
      source: 'tsc',
      file: 'src/test.ts',
      line: 2,
      column: 5,
      rule: 'TS2322',
      message: "Type 'string' is not assignable to type 'number'.",
    });
    expect(issues[0].suggestion).toBeDefined();
    expect(issues[0].suggestion).toContain('Type mismatch');

    // 检查第二个问题（warning）
    expect(issues[1]).toMatchObject({
      severity: 'warning',
      source: 'tsc',
      file: 'src/test.ts',
      line: 10,
      column: 12,
      rule: 'TS6133',
      message: "'unused' is declared but its value is never read.",
    });
    expect(issues[1].suggestion).toBeDefined();
  });

  test('应该处理多种严重性级别', () => {
    const tscOutput = `
file.ts(1,1): error TS2304: Cannot find name 'undefinedVar'.
file.ts(2,2): warning TS7027: Unreachable code detected.
file.ts(3,3): info TS80001: Some informational message.
    `.trim();

    const issues = parseTscOutput(tscOutput, cwd, ['file.ts']);

    expect(issues[0].severity).toBe('error');
    expect(issues[1].severity).toBe('warning');
    expect(issues[2].severity).toBe('info');
  });

  test('应该规范化文件路径', () => {
    const tscOutput = `/project/src/app.ts(1,1): error TS2304: Cannot find name 'x'.`;
    const issues = parseTscOutput(tscOutput, cwd, ['src/app.ts']);

    expect(issues[0].file).toBe('src/app.ts');
  });

  test('应该处理 Windows 路径', () => {
    const windowsCwd = 'C:\\project';
    const tscOutput = `C:\\project\\src\\app.ts(1,1): error TS2304: Cannot find name 'x'.`;
    const issues = parseTscOutput(tscOutput, windowsCwd, ['src/app.ts']);

    expect(issues[0].file).toBe('src/app.ts');
  });

  test('应该处理空输出', () => {
    const issues = parseTscOutput('', cwd, []);
    expect(issues).toHaveLength(0);
  });

  test('应该处理无效行（不匹配模式）', () => {
    const tscOutput = `
Some random text
Not a tsc error line
src/test.ts(1,1): error TS2304: Valid error
Another random line
    `.trim();

    const issues = parseTscOutput(tscOutput, cwd, ['src/test.ts']);
    expect(issues).toHaveLength(1);
    expect(issues[0].rule).toBe('TS2304');
  });

  test('应该生成特定规则的建议', () => {
    const testCases = [
      {
        output: 'file.ts(1,1): error TS2322: Type mismatch',
        expectedSuggestion: 'Type mismatch. Check the types on both sides of the assignment.',
      },
      {
        output: 'file.ts(1,1): error TS2304: Cannot find name',
        expectedSuggestion: 'Check if the variable is declared, imported, or has a typo.',
      },
      {
        output: 'file.ts(1,1): error TS2339: Property does not exist',
        expectedSuggestion: 'Check the type definition of the object or use type assertion if appropriate.',
      },
      {
        output: 'file.ts(1,1): error TS7006: Parameter implicitly has an "any" type',
        expectedSuggestion: 'Add explicit type annotation to the parameter or variable.',
      },
      {
        output: 'file.ts(1,1): error TS2532: Object is possibly undefined',
        expectedSuggestion: 'Add a null/undefined check before accessing the property.',
      },
    ];

    for (const testCase of testCases) {
      const issues = parseTscOutput(testCase.output, cwd, ['file.ts']);
      expect(issues[0].suggestion).toContain(testCase.expectedSuggestion);
    }
  });
});