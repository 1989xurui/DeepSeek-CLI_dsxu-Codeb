import { relative } from 'path';

type SemgrepIssue = {
  tool: 'semgrep';
  severity: 'error' | 'warning' | 'info';
  file: string;
  line: number;
  col: number;
  ruleId: string;
  message: string;
};

type SemgrepResult = {
  check_id?: string;
  path?: string;
  start?: { line?: number; col?: number };
  extra?: {
    message?: string;
    severity?: string;
  };
};

export function parseSemgrepOutput(output: string, cwd: string): SemgrepIssue[] {
  if (!output || !output.trim()) return [];

  try {
    const parsed = JSON.parse(output) as { results?: SemgrepResult[] };
    if (!Array.isArray(parsed.results)) return [];

    return parsed.results.map((item) => ({
      tool: 'semgrep',
      severity: normalizeSeverity(item.extra?.severity),
      file: normalizePath(item.path || '', cwd),
      line: item.start?.line ?? 0,
      col: item.start?.col ?? 0,
      ruleId: item.check_id || 'unknown',
      message: item.extra?.message || '',
    }));
  } catch {
    return [];
  }
}

function normalizeSeverity(severity?: string): 'error' | 'warning' | 'info' {
  const s = (severity || '').toLowerCase();
  if (s === 'error') return 'error';
  if (s === 'warning' || s === 'warn') return 'warning';
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
