/**
 * ESLint 输出解析器（新版本）
 * 符合蒸馏协议 StaticIssue 接口
 */

import { StaticIssue, StaticIssueSource } from '../contract';

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
 * 解析 ESLint JSON 输出
 */
export function parseEslintOutput(output: string, cwd: string, filePaths: string[]): StaticIssue[] {
  const issues: StaticIssue[] = [];

  // 处理空输出
  if (!output.trim()) {
    return issues;
  }

  try {
    // eslint 输出可能是 JSON 数组
    const results: EslintFileResult[] = JSON.parse(output);

    for (const result of results) {
      for (const message of result.messages) {
        // 转换 severity
        let severity: 'error' | 'warning' | 'info' = 'info';
        if (message.severity === 2) severity = 'error';
        else if (message.severity === 1) severity = 'warning';

        // 规范化文件路径
        const normalizedFile = normalizePath(result.filePath, cwd);

        issues.push({
          severity,
          source: 'eslint' as StaticIssueSource,
          file: normalizedFile,
          line: message.line || 1,
          column: message.column || 1,
          rule: message.ruleId || 'unknown',
          message: message.message,
          suggestion: generateSuggestion(message),
        });
      }
    }
  } catch (error) {
    // 如果不是 JSON 格式，尝试解析文本输出
    console.warn('[static-analysis] ESLint 输出不是 JSON 格式，尝试解析文本:', error);
    return parseEslintTextOutput(output, cwd, filePaths);
  }

  return issues;
}

/**
 * 解析 ESLint 文本输出（fallback）
 */
function parseEslintTextOutput(output: string, cwd: string, filePaths: string[]): StaticIssue[] {
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
        severity,
        source: 'eslint' as StaticIssueSource,
        file: normalizePath(file, cwd),
        line: parseInt(lineStr, 10) || 1,
        column: parseInt(colStr, 10) || 1,
        rule: ruleId || 'unknown',
        message: message.trim(),
      });
    }
  }

  return issues;
}

/**
 * 生成修复建议
 */
function generateSuggestion(message: EslintMessage): string | undefined {
  const ruleSuggestions: Record<string, string> = {
    'no-console': 'Remove console statement or use a proper logging library',
    'eqeqeq': 'Use === instead of == for strict equality comparison',
    'no-var': 'Use let or const instead of var',
    'prefer-const': 'Use const for variables that are not reassigned',
    'no-unused-vars': 'Remove unused variable or use it',
    '@typescript-eslint/no-explicit-any': 'Use proper type instead of any',
    '@typescript-eslint/no-unused-vars': 'Remove unused variable or use it',
    'semi': 'Add missing semicolon',
    'quotes': 'Use consistent quotes (single or double)',
    'indent': 'Fix indentation',
    'comma-dangle': 'Add or remove trailing comma',
    'space-before-function-paren': 'Add or remove space before function parentheses',
    'keyword-spacing': 'Add or remove spacing around keywords',
    'space-infix-ops': 'Add spacing around operators',
    'no-trailing-spaces': 'Remove trailing spaces',
    'eol-last': 'Add newline at end of file',
  };

  const suggestion = ruleSuggestions[message.ruleId];
  if (suggestion) {
    return suggestion;
  }

  // 通用建议
  if (message.fix) {
    return 'ESLint can automatically fix this issue. Run eslint --fix.';
  }

  return 'Check ESLint documentation for this rule.';
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
  normalized = normalized.replace(/\\/g, '/');

  // 移除开头的 ./
  if (normalized.startsWith('./')) {
    normalized = normalized.substring(2);
  }

  return normalized;
}