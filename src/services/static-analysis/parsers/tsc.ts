/**
 * tsc 输出解析器
 * 解析 tsc --noEmit --pretty false 的输出
 */

import { StaticIssue } from '../runner';

/**
 * 解析 tsc 输出
 * tsc 输出格式示例：
 * src/file.ts(2,5): error TS2322: Type 'string' is not assignable to type 'number'.
 */
export function parseTscOutput(output: string, cwd: string): StaticIssue[] {
  const issues: StaticIssue[] = [];
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
      if (severity.toLowerCase() === 'error') issueSeverity = 'error';
      else if (severity.toLowerCase() === 'warning') issueSeverity = 'warning';

      issues.push({
        tool: 'tsc',
        severity: issueSeverity,
        file: normalizePath(file, cwd),
        line: parseInt(lineStr, 10),
        col: parseInt(colStr, 10),
        ruleId,
        message: message.trim(),
      });
    }
  }

  return issues;
}

/**
 * 规范化文件路径（相对路径）
 */
function normalizePath(filePath: string, cwd: string): string {
  // 如果已经是相对路径，直接返回
  if (filePath.startsWith('./') || filePath.startsWith('../')) {
    return filePath;
  }

  // 尝试转换为相对路径
  try {
    const path = require('path');
    return path.relative(cwd, filePath);
  } catch {
    return filePath;
  }
}