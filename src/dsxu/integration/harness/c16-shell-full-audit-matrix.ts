import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

export type ShellAuditStatus = 'completed' | 'partial' | 'missing' | 'out-of-scope';

export interface ShellAuditEntry {
  id: string;
  sourceFile: string;
  relativeSourceFile: string;
  inScope: boolean;
  category: 'shell-runtime' | 'shell-task' | 'shell-command' | 'shell-ui';
  counterpartFiles: string[];
  requiredSymbols: string[];
  matchedSymbols: string[];
  status: ShellAuditStatus;
  evidence: {
    structural: boolean;
    runtime: boolean;
    lifecycle: boolean;
    mainline: boolean;
    cleanTest: boolean;
  };
  gap: string;
}

export interface ShellAuditMatrix {
  version: 'V10-3X-C16-shell-v1';
  totalSourceFiles: number;
  inScopeSourceFiles: number;
  entries: ShellAuditEntry[];
}

export interface ShellAuditSummary {
  totalSourceFiles: number;
  inScopeSourceFiles: number;
  outOfScopeSourceFiles: number;
  completed: number;
  partial: number;
  missing: number;
  conversionRate: number;
  is100: boolean;
}

const ENGINE_ROOT = path.resolve(process.cwd(), 'src/dsxu/engine');
const TEST_ROOT = path.resolve(process.cwd(), 'src/dsxu/engine/__tests__');

function listFilesRecursive(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  const walk = (current: string) => {
    const items = readdirSync(current, { withFileTypes: true });
    for (const item of items) {
      const full = path.join(current, item.name);
      if (item.isDirectory()) walk(full);
      else out.push(full);
    }
  };
  walk(dir);
  return out;
}

function safeRead(file: string): string {
  if (!existsSync(file)) return '';
  return readFileSync(file, 'utf8');
}

function normalizeSlashes(v: string): string {
  return v.replace(/\\/g, '/');
}

function findDSXURoot(): string {
  const candidates = [
    path.resolve(process.cwd(), '原代码dsxu'),
    path.resolve('D:/DSXU-code/原代码dsxu'),
    path.resolve('/mnt/d/DSXU-code/原代码dsxu'),
    path.resolve(process.cwd(), 'src'),
  ];
  for (const c of candidates) if (existsSync(c)) return c;
  throw new Error('Unable to locate DSXU source root for C16 audit');
}

function isC16ShellFile(absFile: string): boolean {
  const lower = normalizeSlashes(absFile).toLowerCase();
  const include = [
    '/utils/shell/',
    '/utils/bash/',
    '/utils/powershell/',
    '/utils/shell.ts',
    '/utils/shellcommand.ts',
    '/utils/shellconfig.ts',
    '/utils/promptshellexecution.ts',
    '/utils/slashcommandparsing.ts',
    '/utils/processuserinput/processbashcommand.tsx',
    '/utils/processuserinput/processslashcommand.tsx',
    '/tools/bashtool/',
    '/tools/powershelltool/',
    '/tasks/localshelltask/',
    '/components/shell/',
  ];
  return include.some((token) => lower.includes(token));
}

function detectCategory(relativeSourceFile: string): ShellAuditEntry['category'] {
  const lower = normalizeSlashes(relativeSourceFile).toLowerCase();
  if (lower.includes('/components/shell/') || lower.endsWith('/ui.tsx')) return 'shell-ui';
  if (lower.includes('/tasks/localshelltask/')) return 'shell-task';
  if (lower.includes('/utils/') && (lower.includes('slashcommand') || lower.includes('processslashcommand'))) return 'shell-command';
  return 'shell-runtime';
}

function categorySpec(category: ShellAuditEntry['category']): { counterparts: string[]; symbols: string[] } {
  const p = (...parts: string[]) => path.join(ENGINE_ROOT, ...parts);
  if (category === 'shell-runtime') {
    return {
      counterparts: [p('builtin-tools.ts'), p('permissions.ts'), p('tool-gate-v1.ts'), p('query-loop.ts')],
      symbols: ['BashTool', 'evaluateToolGate', 'tool_dispatch_started', 'isWriteLikeTool'],
    };
  }
  if (category === 'shell-task') {
    return {
      counterparts: [p('runtime-core.ts'), p('task-lifecycle-engine-v1.ts'), p('session.ts')],
      symbols: ['cascadeShutdownTasks', 'stopTask', 'registerMainSessionTask', 'applyTaskLifecycleToSession'],
    };
  }
  if (category === 'shell-command') {
    return {
      counterparts: [p('slash-commands.ts'), p('cli.ts'), p('query-loop.ts')],
      symbols: ['parseSlashCommand', 'isSlashCommand', 'getRegisteredCommands', 'selectToolSubsetForTurn'],
    };
  }
  return { counterparts: [], symbols: [] };
}

function hasCleanTest(category: ShellAuditEntry['category'], allTestFileNames: string): boolean {
  if (category === 'shell-runtime') return /bash-adapter-safety-v1|tool-mainline-v1-clean/i.test(allTestFileNames);
  if (category === 'shell-task') return /task-lifecycle-v1-clean|task-runtime-mainline-v1-clean/i.test(allTestFileNames);
  if (category === 'shell-command') return /c15-command-slash-clean|wave5-cli/i.test(allTestFileNames);
  return false;
}

export function getC16ShellAuditMatrix(): ShellAuditMatrix {
  const dsxuRoot = findDSXURoot();
  const sourceFiles = listFilesRecursive(dsxuRoot)
    .filter((f) => /\.(ts|tsx|js|jsx)$/i.test(f))
    .filter((f) => isC16ShellFile(f))
    .sort((a, b) => a.localeCompare(b));

  const allTestFileNames = listFilesRecursive(TEST_ROOT)
    .filter((file) => file.endsWith('.test.ts'))
    .map((file) => normalizeSlashes(path.relative(TEST_ROOT, file)).toLowerCase())
    .join('\n');

  const entries = sourceFiles.map((sourceFile, idx): ShellAuditEntry => {
    const relativeSourceFile = normalizeSlashes(path.relative(dsxuRoot, sourceFile));
    const category = detectCategory(relativeSourceFile);
    const inScope = category !== 'shell-ui';
    const spec = categorySpec(category);
    const content = spec.counterparts.map((f) => safeRead(f)).join('\n');
    const matchedSymbols = spec.symbols.filter((s) => content.includes(s));

    const evidence = {
      structural: inScope ? spec.counterparts.every((f) => existsSync(f)) : false,
      runtime: inScope ? matchedSymbols.length >= Math.max(1, Math.floor(spec.symbols.length / 2)) : false,
      lifecycle: inScope ? /(lifecycle|transition|state|apply|stop|cascade)/i.test(content) : false,
      mainline: inScope ? /(query-loop|session|runtime-core|mainline)/i.test(content) : false,
      cleanTest: inScope ? hasCleanTest(category, allTestFileNames) : false,
    };

    let status: ShellAuditStatus = 'out-of-scope';
    if (inScope) {
      const positives = Object.values(evidence).filter(Boolean).length;
      if (positives === 5 && matchedSymbols.length === spec.symbols.length) status = 'completed';
      else if (positives > 0) status = 'partial';
      else status = 'missing';
    }

    const gap = !inScope
      ? 'UI shell rendering file is tracked but out of current C16 scope.'
      : status === 'completed'
        ? 'All evidence dimensions are present.'
        : `Missing evidence: ${Object.entries(evidence).filter(([, v]) => !v).map(([k]) => k).join(', ') || 'symbol parity'}`;

    return {
      id: `S${String(idx + 1).padStart(3, '0')}`,
      sourceFile,
      relativeSourceFile,
      inScope,
      category,
      counterpartFiles: spec.counterparts.map(normalizeSlashes),
      requiredSymbols: spec.symbols,
      matchedSymbols,
      status,
      evidence,
      gap,
    };
  });

  return {
    version: 'V10-3X-C16-shell-v1',
    totalSourceFiles: entries.length,
    inScopeSourceFiles: entries.filter((e) => e.inScope).length,
    entries,
  };
}

export function summarizeC16ShellAudit(matrix = getC16ShellAuditMatrix()): ShellAuditSummary {
  const inScope = matrix.entries.filter((e) => e.inScope);
  const completed = inScope.filter((e) => e.status === 'completed').length;
  const partial = inScope.filter((e) => e.status === 'partial').length;
  const missing = inScope.filter((e) => e.status === 'missing').length;
  const conversionRate = inScope.length === 0 ? 0 : Number(((completed / inScope.length) * 100).toFixed(2));
  return {
    totalSourceFiles: matrix.totalSourceFiles,
    inScopeSourceFiles: inScope.length,
    outOfScopeSourceFiles: matrix.totalSourceFiles - inScope.length,
    completed,
    partial,
    missing,
    conversionRate,
    is100: inScope.length > 0 && completed === inScope.length,
  };
}
