/**
 * R5-24 mutation testing main entry.
 */

export * from './contract';
export { generateMutations, OPERATORS, resetIdCounter } from './operators';

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import type { Mutation, MutationReport, MutationResult, MutationBudget, MutationConfig } from './contract';
import { generateMutations, resetIdCounter } from './operators';

export async function runMutationTests(
  sourceCode: string,
  file: string,
  budget?: MutationBudget,
  config?: MutationConfig
): Promise<MutationReport> {
  resetIdCounter();

  const maxMutations = budget?.maxMutations ?? 50;
  const timeoutMs = budget?.timeoutMs ?? 10_000;
  const disabled = budget?.disabledOperators ?? [];

  let mutations: Mutation[];
  if (config?.mockMutationGenerator) {
    mutations = config.mockMutationGenerator(sourceCode, file);
  } else {
    mutations = generateMutations(sourceCode, file, disabled);
  }

  if (mutations.length > maxMutations) {
    mutations = mutations.slice(0, maxMutations);
  }

  const results: MutationResult[] = [];
  const absoluteFile = isAbsolute(file) ? file : resolve(config?.cwd ?? process.cwd(), file);

  for (const mut of mutations) {
    let result: MutationResult;

    try {
      if (config?.mockTestRunner) {
        const testResult = await config.mockTestRunner(file, mut);
        result = {
          mutation: mut,
          status: testResult.passed ? 'survived' : 'killed',
          testOutput: testResult.output,
        };
      } else {
        result = await runRealMutation(absoluteFile, sourceCode, mut, timeoutMs, config);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('timeout') || msg.includes('Timeout') || msg.includes('timed out')) {
        result = { mutation: mut, status: 'timeout', testOutput: msg };
      } else {
        result = { mutation: mut, status: 'error', testOutput: msg };
      }
    }

    results.push(result);
  }

  const killed = results.filter(r => r.status === 'killed').length;
  const survived = results.filter(r => r.status === 'survived').length;
  const timedOut = results.filter(r => r.status === 'timeout').length;
  const total = results.length;

  return {
    total,
    killed,
    survived,
    timedOut,
    killRate: total > 0 ? killed / total : 0,
    survivors: results.filter(r => r.status === 'survived').map(r => r.mutation),
    results,
  };
}

async function runRealMutation(
  absoluteFile: string,
  sourceCode: string,
  mutation: Mutation,
  timeoutMs: number,
  config?: MutationConfig
): Promise<MutationResult> {
  const original = await readFileOrFallback(absoluteFile, sourceCode);
  const mutated = applyMutation(original, mutation);

  await writeFile(absoluteFile, mutated, 'utf-8');
  try {
    const testCommand = formatCommand(config?.testCommand ?? 'bun test', {
      file: absoluteFile,
      mutationId: mutation.id,
    });
    const run = await runShellCommand(testCommand, config?.cwd ?? dirname(absoluteFile), timeoutMs);
    return {
      mutation,
      status: run.passed ? 'survived' : 'killed',
      testOutput: run.output,
    };
  } finally {
    await writeFile(absoluteFile, original, 'utf-8');
  }
}

async function readFileOrFallback(file: string, fallback: string): Promise<string> {
  try {
    return await readFile(file, 'utf-8');
  } catch {
    return fallback;
  }
}

function applyMutation(source: string, mutation: Mutation): string {
  const lines = source.split(/\r?\n/);
  const index = mutation.line - 1;
  if (index < 0 || index >= lines.length) {
    throw new Error(`Mutation ${mutation.id} points outside ${mutation.file}:${mutation.line}`);
  }

  const line = lines[index];
  if (!line.includes(mutation.before)) {
    throw new Error(`Mutation ${mutation.id} no longer matches ${mutation.file}:${mutation.line}`);
  }

  lines[index] = line.replace(mutation.before, mutation.after);
  return source.includes('\r\n') ? lines.join('\r\n') : lines.join('\n');
}

function formatCommand(command: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (acc, [key, value]) => acc.replaceAll(`{${key}}`, quoteForShell(value)),
    command
  );
}

function quoteForShell(value: string): string {
  return `"${value.replaceAll('"', '\\"')}"`;
}

async function runShellCommand(
  command: string,
  cwd: string,
  timeoutMs: number
): Promise<{ passed: boolean; output: string }> {
  const isWindows = process.platform === 'win32';
  const proc = Bun.spawn(
    isWindows
      ? ['powershell.exe', '-NoProfile', '-Command', command]
      : ['bash', '-lc', command],
    {
      cwd,
      stdout: 'pipe',
      stderr: 'pipe',
      env: process.env,
    }
  );

  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      proc.kill();
      reject(new Error(`mutation test runner timed out after ${timeoutMs}ms`));
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
