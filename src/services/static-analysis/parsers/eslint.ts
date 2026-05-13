import { relative } from 'path';
import type { StaticIssue, StaticIssueSource } from '../contract';

interface EslintMessage {
  ruleId?: string;
  severity: number;
  message: string;
  line?: number;
  column?: number;
  fix?: { range: [number, number]; text: string };
}

interface EslintFileResult {
  filePath: string;
  messages: EslintMessage[];
}

export function parseEslintOutput(output: string, cwd: string, filePaths?: string[]): StaticIssue[] {
  const issues: StaticIssue[] = [];
  if (!output || !output.trim()) return issues;

  try {
    const results = JSON.parse(output) as EslintFileResult[];
    if (!Array.isArray(results)) return issues;

    for (const result of results) {
      for (const msg of result.messages ?? []) {
        issues.push(makeIssue({
          file: normalizePath(result.filePath, cwd),
          line: msg.line ?? 0,
          column: msg.column ?? 0,
          severity: normalizeSeverity(msg.severity),
          rule: msg.ruleId || 'unknown',
          message: msg.message,
          suggestion: generateSuggestion(msg),
        }));
      }
    }

    return issues;
  } catch {
    return parseEslintTextOutput(output, cwd);
  }
}

function parseEslintTextOutput(output: string, cwd: string): StaticIssue[] {
  const issues: StaticIssue[] = [];
  const lines = output.split('\n');
  const pattern = /^(.+?):(\d+):(\d+):\s+(.+?)\s+\((.+?)\)$/;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const match = line.match(pattern);
    if (!match) continue;

    const [, file, lineStr, colStr, message, rule] = match;
    const lower = message.toLowerCase();
    const severity: 'error' | 'warning' | 'info' = lower.includes('error')
      ? 'error'
      : lower.includes('warn')
        ? 'warning'
        : 'info';

    issues.push(makeIssue({
      file: normalizePath(file, cwd),
      line: Number.parseInt(lineStr, 10) || 0,
      column: Number.parseInt(colStr, 10) || 0,
      severity,
      rule,
      message,
      suggestion: undefined,
    }));
  }

  return issues;
}

function makeIssue(input: {
  file: string;
  line: number;
  column: number;
  severity: 'error' | 'warning' | 'info';
  rule: string;
  message: string;
  suggestion?: string;
}): StaticIssue {
  const issue: StaticIssue = {
    source: 'eslint' as StaticIssueSource,
    severity: input.severity,
    file: input.file,
    line: input.line,
    column: input.column,
    rule: input.rule,
    message: input.message,
    suggestion: input.suggestion,
  };

  Object.defineProperty(issue, 'tool', { value: 'eslint', enumerable: false });
  Object.defineProperty(issue, 'col', { value: input.column, enumerable: false });
  Object.defineProperty(issue, 'ruleId', { value: input.rule, enumerable: false });
  return issue;
}

function normalizeSeverity(severity: number): 'error' | 'warning' | 'info' {
  if (severity === 2) return 'error';
  if (severity === 1) return 'warning';
  return 'info';
}

function normalizePath(filePath: string, cwd: string): string {
  let normalized = filePath;

  try {
    if (cwd && (filePath.startsWith(cwd) || filePath.toLowerCase().startsWith(cwd.toLowerCase()))) {
      normalized = relative(cwd, filePath);
    }
  } catch {
    normalized = filePath;
  }

  normalized = normalized.replace(/\\/g, '/');
  if (normalized.startsWith('./')) normalized = normalized.slice(2);
  return normalized;
}

function generateSuggestion(message: EslintMessage): string | undefined {
  if (message.fix) return 'ESLint can auto-fix this issue with eslint --fix.';
  const rule = message.ruleId || '';
  const map: Record<string, string> = {
    'no-console': 'Remove console statement or use a proper logger.',
    eqeqeq: 'Use strict equality (===).',
    'no-var': 'Use let/const instead of var.',
    'prefer-const': 'Use const for non-reassigned variables.',
  };
  return map[rule] || 'Check ESLint rule documentation.';
}
