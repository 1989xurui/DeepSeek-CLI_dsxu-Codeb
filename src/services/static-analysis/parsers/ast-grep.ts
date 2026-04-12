/**
 * ast-grep 输出解析器（新版本）
 * 符合蒸馏协议 StaticIssue 接口
 */

import { StaticIssue, StaticIssueSource } from '../contract';

interface AstGrepMatch {
  file: string;
  range: {
    start: {
      line: number;
      column: number;
    };
    end: {
      line: number;
      column: number;
    };
  };
  ruleId: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  suggestion?: string;
}

/**
 * 解析 ast-grep JSON 输出
 */
export function parseAstGrepOutput(output: string, cwd: string, filePaths: string[]): StaticIssue[] {
  const issues: StaticIssue[] = [];

  // 处理空输出
  if (!output.trim()) {
    return issues;
  }

  try {
    // 首先尝试解析为 NDJSON（每行一个 JSON 对象）- ast-grep v2 格式
    const lines = output.trim().split('\n');
    let hasValidLines = false;

    for (const line of lines) {
      if (line.trim()) {
        try {
          const match = JSON.parse(line.trim());
          issues.push(convertAstGrepMatch(match, cwd));
          hasValidLines = true;
        } catch (e) {
          // 忽略无法解析的行
        }
      }
    }

    // 如果没有有效的 NDJSON 行，尝试解析为完整的 JSON
    if (!hasValidLines) {
      const result = JSON.parse(output);

      // ast-grep 输出格式可能不同，这里处理两种常见格式
      if (Array.isArray(result)) {
        // 格式1: 数组格式
        for (const match of result) {
          issues.push(convertAstGrepMatch(match, cwd));
        }
      } else if (result.matches && Array.isArray(result.matches)) {
        // 格式2: 包含 matches 字段的对象
        for (const match of result.matches) {
          issues.push(convertAstGrepMatch(match, cwd));
        }
      } else if (result.results && Array.isArray(result.results)) {
        // 格式3: 包含 results 字段的对象
        for (const match of result.results) {
          issues.push(convertAstGrepMatch(match, cwd));
        }
      }
    }
  } catch (error) {
    console.warn('[static-analysis] Failed to parse ast-grep JSON output:', error);
    // 尝试解析文本输出
    return parseAstGrepTextOutput(output, cwd, filePaths);
  }

  return issues;
}

/**
 * 解析 ast-grep 文本输出（fallback）
 */
function parseAstGrepTextOutput(output: string, cwd: string, filePaths: string[]): StaticIssue[] {
  const issues: StaticIssue[] = [];
  const lines = output.split('\n');

  // ast-grep 文本格式示例: /path/to/file.js:10:5: [rule-id] message
  const astGrepPattern = /^(.+?):(\d+):(\d+):\s+\[(.+?)\]\s+(.+)$/;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = trimmed.match(astGrepPattern);
    if (match) {
      const [, file, lineStr, colStr, ruleId, message] = match;

      // 从规则ID推断严重性
      let severity: 'error' | 'warning' | 'info' = 'warning';
      if (ruleId.includes('error') || ruleId.includes('critical')) {
        severity = 'error';
      } else if (ruleId.includes('info') || ruleId.includes('hint')) {
        severity = 'info';
      }

      issues.push({
        severity,
        source: 'ast-grep' as StaticIssueSource,
        file: normalizePath(file, cwd),
        line: parseInt(lineStr, 10) || 1,
        column: parseInt(colStr, 10) || 1,
        rule: ruleId,
        message: message.trim(),
        suggestion: generateAstGrepSuggestion(ruleId),
      });
    }
  }

  return issues;
}

/**
 * 转换 ast-grep 匹配到 StaticIssue
 */
function convertAstGrepMatch(match: any, cwd: string): StaticIssue {
  // 提取基本信息
  const file = match.file || match.path || '';
  const ruleId = match.ruleId || match.id || match.rule || 'unknown';
  const message = match.message || match.detail || 'Code pattern detected';

  // 提取位置信息
  let line = 1;
  let column = 1;

  if (match.range) {
    line = match.range.start?.line || match.range.line || 1;
    column = match.range.start?.column || match.range.column || 1;
  } else if (match.position) {
    line = match.position.line || 1;
    column = match.position.column || 1;
  } else if (match.line !== undefined) {
    line = match.line;
    column = match.column || 1;
  }

  // 确定严重性
  let severity: 'error' | 'warning' | 'info' = 'warning';
  if (match.severity) {
    const sev = match.severity.toLowerCase();
    if (sev === 'error' || sev === 'critical') severity = 'error';
    else if (sev === 'info' || sev === 'hint') severity = 'info';
  } else {
    // 从规则ID推断
    if (ruleId.includes('error') || ruleId.includes('critical')) severity = 'error';
    else if (ruleId.includes('info') || ruleId.includes('hint')) severity = 'info';
  }

  return {
    severity,
    source: 'ast-grep' as StaticIssueSource,
    file: normalizePath(file, cwd),
    line,
    column,
    rule: ruleId,
    message,
    suggestion: match.suggestion || generateAstGrepSuggestion(ruleId),
  };
}

/**
 * 生成 ast-grep 规则建议
 */
function generateAstGrepSuggestion(ruleId: string): string | undefined {
  const suggestions: Record<string, string> = {
    'no-any-cast': 'Avoid using "as any". Use proper type annotations instead.',
    'no-non-null-assertion': 'Avoid non-null assertions (!.). Add proper null checks instead.',
    'no-floating-promise': 'Handle promises properly with await, .then(), or .catch().',
    'no-empty-catch': 'Add proper error handling in catch blocks.',
    'no-eval': 'Avoid eval(). Use safer alternatives like Function constructor or JSON.parse.',
    'no-hardcoded-secret': 'Move secrets to environment variables or configuration files.',
    'no-sql-concat': 'Use parameterized queries or ORM to prevent SQL injection.',
    'no-path-traversal': 'Validate and sanitize user input in file paths.',
    'no-console-in-production': 'Remove console statements or use a logging library.',
    'prefer-const': 'Use const for variables that are not reassigned.',
    'no-var': 'Use let or const instead of var.',
    'no-magic-numbers': 'Define constants with meaningful names instead of magic numbers.',
    'no-unused-import': 'Remove unused imports to keep code clean.',
    'no-circular-import': 'Refactor to avoid circular dependencies.',
    'no-return-await': 'Return promise directly instead of "return await".',
    'no-implicit-boolean': 'Use explicit null/undefined checks instead of implicit boolean conversion.',
    'no-duplicate-case': 'Remove duplicate case statements in switch.',
    'no-assign-in-condition': 'Avoid assignments in conditionals. Use separate assignment.',
    'no-unsafe-regex': 'Avoid potentially exponential-time regular expressions.',
    'no-process-exit': 'Avoid process.exit() in library code. Throw errors instead.',
    'prefer-nullish-coalescing': 'Use ?? instead of || for null/undefined checks.',
    'no-duplicate-imports': 'Combine duplicate imports from the same module.',
    'no-sync-in-async': 'Avoid synchronous operations in async functions.',
    'no-memo-without-deps': 'Add dependency array to useMemo hook.',
    'no-mutable-default': 'Avoid mutable default parameters. Use null or separate initialization.',
    'no-redundant-type-assertion': 'Remove redundant type assertions.',
    'prefer-readonly-interface': 'Mark interface properties as readonly when possible.',
    'no-god-function': 'Split large functions into smaller, focused functions.',
    'no-deep-nesting': 'Reduce nesting depth for better readability.',
  };

  return suggestions[ruleId];
}

/**
 * 规范化文件路径
 */
function normalizePath(filePath: string, cwd: string): string {
  if (!filePath) return '';

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