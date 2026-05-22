/**
 * R5-21 red/green phase test runner.
 */

import { dirname, isAbsolute, resolve } from 'node:path';
import type { TestSpec, RedPhaseResult, GreenPhaseResult, TDDGateConfig } from './contract';

export async function runRedPhase(
  testSpec: TestSpec,
  config?: Partial<TDDGateConfig>
): Promise<RedPhaseResult> {
  const runResult = await executeTest(
    testSpec.filePath,
    config,
    config?.redTimeoutMs ?? 30_000
  );

  if (!runResult.passed) {
    return {
      success: true,
      testSpec,
      output: runResult.output,
    };
  }

  return {
    success: false,
    testSpec,
    output: runResult.output,
    error: 'Test passed in red phase; it should fail before implementation',
  };
}

export async function runGreenPhase(
  testSpec: TestSpec,
  config?: Partial<TDDGateConfig>
): Promise<GreenPhaseResult> {
  const runResult = await executeTest(
    testSpec.filePath,
    config,
    config?.greenTimeoutMs ?? 30_000
  );

  if (runResult.passed) {
    return {
      success: true,
      output: runResult.output,
    };
  }

  return {
    success: false,
    output: runResult.output,
    error: 'Test failed in green phase; implementation is incorrect',
  };
}

async function executeTest(
  testFilePath: string,
  config: Partial<TDDGateConfig> | undefined,
  timeoutMs: number
): Promise<{ passed: boolean; output: string }> {
  if (config?.mockTestRunner) {
    return config.mockTestRunner(testFilePath);
  }

  const absoluteTestFile = isAbsolute(testFilePath)
    ? testFilePath
    : resolve(config?.cwd ?? process.cwd(), testFilePath);
  const command = formatCommand(config?.testCommand ?? 'bun test {file}', {
    file: absoluteTestFile,
  });

  return runShellCommand(command, config?.cwd ?? dirname(absoluteTestFile), timeoutMs);
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
      reject(new Error(`TDD gate test runner timed out after ${timeoutMs}ms`));
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
