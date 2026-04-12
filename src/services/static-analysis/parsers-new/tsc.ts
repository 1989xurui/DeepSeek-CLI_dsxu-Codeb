/**
 * TypeScript 编译器输出解析器（新版本）
 * 符合蒸馏协议 StaticIssue 接口
 */

import { StaticIssue, StaticIssueSource } from '../contract';
import { join, relative } from 'path';

/**
 * 解析 tsc 输出
 * tsc 输出格式示例：
 * src/file.ts(2,5): error TS2322: Type 'string' is not assignable to type 'number'.
 */
export function parseTscOutput(output: string, cwd: string, filePaths: string[]): StaticIssue[] {
  const issues: StaticIssue[] = [];

  // 处理空输出
  if (!output.trim()) {
    return issues;
  }

  const lines = output.split('\n');

  // tsc 错误模式: file.ts(line,col): severity TSxxxx: message
  const tscPattern = /^(.+?)\((\d+),(\d+)\):\s+(\w+)\s+(TS\d+):\s+(.+)$/;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = trimmed.match(tscPattern);
    if (match) {
      const [, file, lineStr, colStr, severity, ruleId, message] = match;

      // 转换 severity
      let issueSeverity: 'error' | 'warning' | 'info' = 'info';
      const lowerSeverity = severity.toLowerCase();
      if (lowerSeverity === 'error') issueSeverity = 'error';
      else if (lowerSeverity === 'warning') issueSeverity = 'warning';

      issues.push({
        severity: issueSeverity,
        source: 'tsc' as StaticIssueSource,
        file: normalizePath(file, cwd),
        line: parseInt(lineStr, 10) || 1,
        column: parseInt(colStr, 10) || 1,
        rule: ruleId,
        message: message.trim(),
        suggestion: generateTscSuggestion(ruleId, message),
      });
    }
  }

  return issues;
}

/**
 * 生成 TypeScript 错误建议
 */
function generateTscSuggestion(ruleId: string, message: string): string | undefined {
  const suggestions: Record<string, string> = {
    'TS2322': 'Type mismatch. Check the types on both sides of the assignment.',
    'TS2304': 'Check if the variable is declared, imported, or has a typo.',
    'TS2339': 'Check the type definition of the object or use type assertion if appropriate.',
    'TS2345': 'Argument type mismatch. Check function call arguments.',
    'TS2532': 'Add a null/undefined check before accessing the property.',
    'TS7006': 'Add explicit type annotation to the parameter or variable.',
    'TS7030': 'Not all code paths return a value. Ensure function always returns.',
    'TS2554': 'Expected N arguments but got M. Check function call signature.',
    'TS2740': 'Type is missing properties. Check object literal assignment.',
    'TS2769': 'No overload matches this call. Check function overloads.',
    'TS6133': 'Remove unused variable or use it.',
    'TS7027': 'Unreachable code detected. Remove or refactor the code.',
    'TS80001': 'Informational message from TypeScript.',
  };

  // 首先检查是否有特定规则的建议
  if (suggestions[ruleId]) {
    return suggestions[ruleId];
  }

  // 尝试从消息中提取更具体的建议
  if (message.includes('is not assignable to')) {
    return 'Type mismatch. Check the types on both sides of the assignment.';
  }

  if (message.includes('Cannot find name')) {
    return 'Check if the variable is declared, imported, or has a typo.';
  }

  if (message.includes('Property') && message.includes('does not exist')) {
    return 'Check the type definition of the object or use type assertion if appropriate.';
  }

  if (message.includes('implicitly has an "any" type')) {
    return 'Add explicit type annotation to the parameter or variable.';
  }

  if (message.includes('possibly undefined')) {
    return 'Add a null/undefined check before accessing the property.';
  }

  // 默认建议
  return 'Check TypeScript documentation for this error code.';
}

/**
 * 规范化文件路径
 */
function normalizePath(filePath: string, cwd: string): string {
  // 移除可能的绝对路径前缀
  let normalized = filePath;

  // 如果以 cwd 开头，转换为相对路径
  if (filePath.startsWith(cwd)) {
    try {
      normalized = relative(cwd, filePath);
    } catch {
      // 如果相对路径转换失败，保留原路径
    }
  }

  // 统一使用正斜杠
  normalized = normalized.replace(/\\/g, '/');

  // 移除开头的 ./
  if (normalized.startsWith('./')) {
    normalized = normalized.substring(2);
  }

  return normalized;
}