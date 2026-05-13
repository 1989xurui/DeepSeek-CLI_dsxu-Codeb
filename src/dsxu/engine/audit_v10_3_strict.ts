import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

export type StrictAuditCategory = 'skill' | 'task' | 'prompt/queryContext';
export type StrictAuditStatus = 'fully-absorbed' | 'partially-absorbed' | 'not-absorbed';

export interface StrictAuditEntry {
  sourceFile: string;
  category: StrictAuditCategory;
  counterpartFiles: string[];
  requiredSymbols: string[];
  matchedSymbols: string[];
  status: StrictAuditStatus;
}

export interface StrictAuditReport {
  total: number;
  completed: number;
  partial: number;
  missing: number;
  perCategory: Record<StrictAuditCategory, { total: number; completed: number; partial: number; missing: number }>;
  verdict: 'Hard Audit Complete (100%)' | 'Hard Audit Incomplete';
  entries: StrictAuditEntry[];
}

function listFilesRecursive(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  const walk = (current: string) => {
    const entries = readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else out.push(full);
    }
  };
  walk(dir);
  return out;
}

function safeRead(absPath: string): string {
  if (!existsSync(absPath)) return '';
  return readFileSync(absPath, 'utf8');
}

function findDSXUBaseDir(): string {
  const roots = [process.cwd(), 'D:/DSXU-code', '/mnt/d/DSXU-code'];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    const entries = readdirSync(root, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.toLowerCase().includes('dsxu')) continue;
      const base = path.join(root, entry.name);
      if (
        existsSync(path.join(base, 'skills', 'bundled')) &&
        existsSync(path.join(base, 'tasks')) &&
        existsSync(path.join(base, 'utils'))
      ) {
        return base;
      }
    }
  }
  throw new Error('unable to locate DSXU source root');
}

function getCounterpartSpec(fileNameLower: string, category: StrictAuditCategory): {
  files: string[];
  symbols: string[];
} {
  const base = 'src/dsxu/engine';
  if (category === 'skill') {
    const common = [path.join(base, 'skills-registry-v1.ts')];
    if (fileNameLower === 'batch.ts') return { files: common, symbols: ['executeBatchSkill', 'resolveBatchExecutionOrder'] };
    if (fileNameLower === 'debug.ts') return { files: common, symbols: ['executeDebugSkill', 'detectStuckByActionHistory'] };
    if (fileNameLower === 'simplify.ts') return { files: common, symbols: ['executeSimplifySkill'] };
    if (fileNameLower === 'verify.ts') return { files: common, symbols: ['executeVerifySkill'] };
    if (fileNameLower === 'dsxuapi.ts') return { files: common, symbols: ['mapToolUseToDSXUAssistantMessage'] };
    if (fileNameLower === 'loop.ts') return { files: common, symbols: ['evaluateIterationGuard'] };
    if (fileNameLower === 'remember.ts') return { files: common, symbols: ['rememberSet', 'rememberGet'] };
    if (fileNameLower === 'verifycontent.ts') return { files: common, symbols: ['verifyContentConsistency'] };
    return { files: common, symbols: ['executeSkill'] };
  }

  if (category === 'task') {
    return {
      files: [path.join(base, 'task-lifecycle-engine-v1.ts'), path.join(base, 'runtime-core.ts')],
      symbols: ['registerMainSessionTask', 'stopTask', 'cascadeShutdownTasks'],
    };
  }

  const isPrompt = fileNameLower.includes('prompt') || fileNameLower.includes('systemprompt');
  const isContext = fileNameLower.includes('context') || fileNameLower.includes('query') || fileNameLower.includes('analyze');
  if (isPrompt) {
    return {
      files: [path.join(base, 'query-context-builder-v1.ts')],
      symbols: ['mergePromptStackLayers', 'resolveIntent'],
    };
  }
  if (isContext) {
    return {
      files: [path.join(base, 'query-context-builder-v1.ts')],
      symbols: ['analyzeContext', 'analyzeContextWeighted', 'queryGuard'],
    };
  }
  return {
    files: [path.join(base, 'query-context-builder-v1.ts')],
    symbols: ['queryHelpers'],
  };
}

function evaluateEntry(sourceFile: string, category: StrictAuditCategory): StrictAuditEntry {
  const fileNameLower = path.basename(sourceFile).toLowerCase();
  const spec = getCounterpartSpec(fileNameLower, category);
  const counterpartContents = spec.files.map((rel) => safeRead(path.resolve(process.cwd(), rel))).join('\n');
  const matchedSymbols = spec.symbols.filter((symbol) => counterpartContents.includes(symbol));

  let status: StrictAuditStatus = 'not-absorbed';
  if (matchedSymbols.length === spec.symbols.length) status = 'fully-absorbed';
  else if (matchedSymbols.length > 0) status = 'partially-absorbed';

  return {
    sourceFile,
    category,
    counterpartFiles: spec.files,
    requiredSymbols: spec.symbols,
    matchedSymbols,
    status,
  };
}

export function runAuditV103Strict(): StrictAuditReport {
  const dsxuBase = findDSXUBaseDir();
  const skills = listFilesRecursive(path.join(dsxuBase, 'skills', 'bundled'));
  const tasks = listFilesRecursive(path.join(dsxuBase, 'tasks'));
  const utilsAll = listFilesRecursive(path.join(dsxuBase, 'utils'));
  const utils = utilsAll.filter((file) => {
    const lower = file.toLowerCase();
    return (
      lower.includes('prompt') ||
      lower.includes('query') ||
      lower.includes('context') ||
      lower.includes('analyze') ||
      lower.includes('workload') ||
      lower.includes('teammate') ||
      lower.includes('agent') ||
      lower.includes('permission')
    );
  });

  const entries = [
    ...skills.map((file) => evaluateEntry(file, 'skill')),
    ...tasks.map((file) => evaluateEntry(file, 'task')),
    ...utils.map((file) => evaluateEntry(file, 'prompt/queryContext')),
  ];

  const completed = entries.filter((entry) => entry.status === 'fully-absorbed').length;
  const partial = entries.filter((entry) => entry.status === 'partially-absorbed').length;
  const missing = entries.filter((entry) => entry.status === 'not-absorbed').length;
  const total = entries.length;

  const perCategory: StrictAuditReport['perCategory'] = {
    skill: { total: 0, completed: 0, partial: 0, missing: 0 },
    task: { total: 0, completed: 0, partial: 0, missing: 0 },
    'prompt/queryContext': { total: 0, completed: 0, partial: 0, missing: 0 },
  };
  for (const entry of entries) {
    const cat = perCategory[entry.category];
    cat.total += 1;
    if (entry.status === 'fully-absorbed') cat.completed += 1;
    else if (entry.status === 'partially-absorbed') cat.partial += 1;
    else cat.missing += 1;
  }

  return {
    total,
    completed,
    partial,
    missing,
    perCategory,
    verdict: total > 0 && completed === total ? 'Hard Audit Complete (100%)' : 'Hard Audit Incomplete',
    entries,
  };
}

if (require.main === module) {
  const report = runAuditV103Strict();
  const pct = report.total > 0 ? ((report.completed / report.total) * 100).toFixed(2) : '0.00';
  console.log(`V10-3 Strict Audit: ${report.completed}/${report.total} (${pct}%)`);
  console.log(`partial=${report.partial}, missing=${report.missing}, verdict=${report.verdict}`);
}
