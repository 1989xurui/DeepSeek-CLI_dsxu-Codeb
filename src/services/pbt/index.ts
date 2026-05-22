/**
 * R5-30 Property-based test main entry.
 */

export * from './contract';
export { generatePropertyTest, inferTemplates } from './templates';

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { PbtSuggestion, PbtResult, PbtConfig } from './contract';
import { inferTemplates, generatePropertyTest } from './templates';

export async function suggestProperties(
  filePath: string,
  config?: PbtConfig
): Promise<PbtSuggestion[]> {
  let source: string;
  if (config?.mockSourceReader) {
    source = await config.mockSourceReader(filePath);
  } else {
    const fs = await import('fs/promises');
    source = await fs.readFile(filePath, 'utf-8');
  }

  const funcPattern = /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g;
  const constFuncPattern = /(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s+)?\(/g;

  const functions: string[] = [];
  let m: RegExpExecArray | null;

  while ((m = funcPattern.exec(source)) !== null) functions.push(m[1]);
  while ((m = constFuncPattern.exec(source)) !== null) functions.push(m[1]);

  const suggestions: PbtSuggestion[] = [];
  const importPath = './' + filePath.replace(/\.\w+$/, '');

  for (const funcName of functions) {
    const isPure = config?.mockPurityCheck
      ? config.mockPurityCheck(funcName, source)
      : defaultPurityCheck(funcName, source);

    if (!isPure) continue;

    const templates = inferTemplates(funcName, source);
    if (templates.length === 0) continue;

    const code = templates.map(t => generatePropertyTest(funcName, t, importPath)).join('\n\n');

    suggestions.push({
      functionName: funcName,
      filePath,
      applicableTemplates: templates,
      generatedCode: code,
      confidence: Math.min(0.9, 0.3 + templates.length * 0.2),
    });
  }

  return suggestions;
}

export async function runPbt(
  testCode: string,
  config?: PbtConfig
): Promise<PbtResult> {
  const runs = config?.runs ?? 100;

  if (config?.mockRunner) {
    return config.mockRunner(testCode, runs);
  }

  const cwd = config?.cwd ?? process.cwd();
  const timeoutMs = config?.timeoutMs ?? 30_000;
  const tempDir = await mkdtemp(join(tmpdir(), 'dsxu-pbt-'));
  const testFile = join(tempDir, 'property.test.ts');

  try {
    await writeFile(testFile, testCode, 'utf-8');
    const run = await runBunTest(testFile, cwd, timeoutMs, {
      DSXU_PBT_RUNS: String(runs),
    });

    return {
      passed: run.passed,
      runs,
      error: run.passed ? undefined : run.output,
    };
  } catch (err) {
    return {
      passed: false,
      runs,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function runBunTest(
  testFile: string,
  cwd: string,
  timeoutMs: number,
  env: Record<string, string>
): Promise<{ passed: boolean; output: string }> {
  const proc = Bun.spawn(['bun', 'test', testFile], {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, ...env },
  });

  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      proc.kill();
      reject(new Error(`PBT runner timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const exitCode = await Promise.race([proc.exited, timeoutPromise]);
    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    return {
      passed: exitCode === 0,
      output: [stdout, stderr].filter(Boolean).join('\n').trim(),
    };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function defaultPurityCheck(funcName: string, source: string): boolean {
  const pattern = new RegExp(`function\\s+${funcName}[^{]*\\{([\\s\\S]*?)\\n\\}`, 'm');
  const m = source.match(pattern);
  if (!m) return true;

  const body = m[1];
  const impureSignals = ['console.', 'this.', 'process.', 'fs.', 'fetch(', 'Math.random', 'Date.now'];
  return !impureSignals.some(s => body.includes(s));
}
