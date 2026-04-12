/**
 * eslint 输出解析器
 * 解析 eslint --format json 的输出
 */

import { StaticIssue } from '../runner';

interface EslintMessage {
  ruleId: string;
  severity: number;  // 0=off, 1=warn, 2=error
  message: string;
  line: number;
  column: number;
  nodeType?: string;
  messageId?: string;
  endLine?: number;
  endColumn?: number;
  fix?: {
    range: [number, number];
    text: string;
  };
}

interface EslintFileResult {
  filePath: string;
  messages: EslintMessage[];
  errorCount: number;
  warningCount: number;
  fixableErrorCount: number;
  fixableWarningCount: number;
  source?: string;
  usedDeprecatedRules?: Array<{
    ruleId: string;
    replacedBy: string[];
  }>;
}

/**
 * 解析 eslint JSON 输出
 */
export function parseEslintOutput(output: string, cwd: string): StaticIssue[] {
  const issues: StaticIssue[] = [];

  try {
    // eslint 输出可能是 JSON 数组
    const results: EslintFileResult[] = JSON.parse(output);

    for (const result of results) {
      for (const message of result.messages) {
        // 转换 severity
        let severity: 'error' | 'warning' | 'info' = 'info';
        if (message.severity === 2) severity = 'error';
        else if (message.severity === 1) severity = 'warning';

        issues.push({
          tool: 'eslint',
          severity,
          file: normalizePath(result.filePath, cwd),
          line: message.line || 0,
          col: message.column || 0,
          ruleId: message.ruleId || 'unknown',
          message: message.message,
        });
      }
    }
  } catch (error) {
    // 如果不是 JSON 格式，尝试解析文本输出
    console.warn('[static-analysis] eslint 输出不是 JSON 格式，尝试解析文本:', error);
    return parseEslintTextOutput(output, cwd);
  }

  return issues;
}

/**
 * 解析 eslint 文本输出（fallback）
 */
function parseEslintTextOutput(output: string, cwd: string): StaticIssue[] {
  const issues: StaticIssue[] = [];
  const lines = output.split('\n');

  // eslint 文本格式示例: /path/to/file.js:10:5: error message (rule-name)
  const eslintPattern = /^(.+?):(\d+):(\d+):\s+(.+?)\s+\((.+?)\)$/;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = trimmed.match(eslintPattern);
    if (match) {
      const [, file, lineStr, colStr, message, ruleId] = match;

      // 从消息中提取严重性
      let severity: 'error' | 'warning' | 'info' = 'info';
      const lowerMessage = message.toLowerCase();
      if (lowerMessage.includes('error')) severity = 'error';
      else if (lowerMessage.includes('warning')) severity = 'warning';

      issues.push({
        tool: 'eslint',
        severity,
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
 * 规范化文件路径
 */
function normalizePath(filePath: string, cwd: string): string {
  // 移除可能的绝对路径前缀
  let normalized = filePath;
  if (filePath.startsWith(cwd)) {
    normalized = filePath.substring(cwd.length + 1); // +1 移除路径分隔符
  }

  // 统一使用正斜杠
  return normalized.replace(/\\/g, '/');
}