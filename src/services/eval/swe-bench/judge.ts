import type { SWEResult, SWETask } from './contract';

export type SweBenchVerdictStatus = 'PASS' | 'FAIL' | 'TIMEOUT' | 'CRASH' | 'BLOCKED';

export interface SweBenchVerdict {
  instanceId: string;
  status: SweBenchVerdictStatus;
  testsPassed: boolean;
  patchMatch: number;
  passedTests: number;
  totalTests: number;
  testOutput: string;
  error?: string;
}

export class SweBenchJudge {
  judge(task: SWETask, result: SWEResult): SweBenchVerdict {
    const patchMatch = comparePatchSimilarity(result.generatedPatch, task.goldPatch ?? '');
    const status = classifyStatus(result, patchMatch);

    return {
      instanceId: task.id,
      status,
      testsPassed: result.testsPassed,
      patchMatch,
      passedTests: result.passedTests,
      totalTests: result.totalTests,
      testOutput: result.error ?? '',
      error: result.error,
    };
  }
}

export function comparePatchSimilarity(generatedPatch: string, goldPatch: string): number {
  const generated = normalizePatchLines(generatedPatch);
  const gold = normalizePatchLines(goldPatch);

  if (gold.length === 0) {
    return generated.length === 0 ? 1 : 0;
  }

  const generatedSet = new Set(generated);
  const overlap = gold.filter(line => generatedSet.has(line)).length;
  return Number((overlap / gold.length).toFixed(4));
}

function normalizePatchLines(patch: string): string[] {
  return patch
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => !line.startsWith('@@'))
    .filter(line => !line.startsWith('index '))
    .filter(line => !line.startsWith('diff --git'));
}

function classifyStatus(result: SWEResult, patchMatch: number): SweBenchVerdictStatus {
  if (result.error?.startsWith('SWE_BENCH_ENV_NOT_READY:')) {
    return 'BLOCKED';
  }
  if (result.error?.toLowerCase().includes('timeout')) {
    return 'TIMEOUT';
  }
  if (result.error && result.generatedPatch.length === 0 && result.totalTests === 0) {
    return 'CRASH';
  }
  if (result.testsPassed) {
    return 'PASS';
  }
  return 'FAIL';
}
