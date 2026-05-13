import { relative } from 'path';
import type { StaticIssue, StaticIssueSource } from '../contract';

export function parseTscOutput(output: string, cwd: string, filePaths?: string[]): StaticIssue[] {
  const issues: StaticIssue[] = [];
  if (!output || !output.trim()) return issues;

  const lines = output.split('\n');
  const fullPattern = /^(.+?)\((\d+),(\d+)\):\s+(\w+)\s+(TS\d+):\s+(.+)$/;
  const noLocPattern = /^(.+?):\s+(\w+)\s+(TS\d+):\s+(.+)$/;

  let lastIssue: StaticIssue | undefined;

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();
    if (!trimmed) continue;

    const m1 = trimmed.match(fullPattern);
    if (m1) {
      const [, file, lineStr, colStr, sev, rule, message] = m1;
      const issue = makeIssue({
        file: normalizePath(file, cwd),
        line: Number.parseInt(lineStr, 10) || 0,
        column: Number.parseInt(colStr, 10) || 0,
        severity: normalizeSeverity(sev),
        rule,
        message: message.trim(),
      });
      issues.push(issue);
      lastIssue = issue;
      continue;
    }

    const m2 = trimmed.match(noLocPattern);
    if (m2) {
      const [, file, sev, rule, message] = m2;
      const issue = makeIssue({
        file: normalizePath(file, cwd),
        line: 0,
        column: 0,
        severity: normalizeSeverity(sev),
        rule,
        message: message.trim(),
      });
      issues.push(issue);
      lastIssue = issue;
      continue;
    }

    // Preserve multiline message continuation from tsc.
    if (lastIssue && /^\s+/.test(raw)) {
      lastIssue.message = `${lastIssue.message} ${trimmed}`;
    }
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
}): StaticIssue {
  const issue: StaticIssue = {
    source: 'tsc' as StaticIssueSource,
    severity: input.severity,
    file: input.file,
    line: input.line,
    column: input.column,
    rule: input.rule,
    message: input.message,
    suggestion: generateTscSuggestion(input.rule, input.message),
  };

  // Backward-compatible fields expected by some legacy tests.
  Object.defineProperty(issue, 'tool', { value: 'tsc', enumerable: false });
  Object.defineProperty(issue, 'col', { value: input.column, enumerable: false });
  Object.defineProperty(issue, 'ruleId', { value: input.rule, enumerable: false });
  return issue;
}

function normalizeSeverity(severity: string): 'error' | 'warning' | 'info' {
  const sev = severity.toLowerCase();
  if (sev === 'error') return 'error';
  if (sev === 'warning') return 'warning';
  if (sev === 'info') return 'info';
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

function generateTscSuggestion(ruleId: string, message: string): string | undefined {
  const suggestions: Record<string, string> = {
    TS2322: 'Type mismatch. Check the types on both sides of the assignment.',
    TS2304: 'Check if the variable is declared, imported, or has a typo.',
    TS2339: 'Check the object type definition or use a safe type guard.',
    TS2345: 'Argument type mismatch. Check function call arguments.',
    TS2532: 'Add a null/undefined check before property access.',
    TS7006: 'Add explicit type annotation.',
    TS6133: 'Remove the unused symbol or use it.',
  };

  if (suggestions[ruleId]) return suggestions[ruleId];
  if (message.includes('is not assignable to')) return suggestions.TS2322;
  if (message.includes('Cannot find name')) return suggestions.TS2304;
  return 'Check TypeScript documentation for this error code.';
}
