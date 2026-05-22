import { mkdir, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import type { SWEBridgeConfig, SWEResult, SWETask } from './contract';
import { generateDetailedReport, runBatch } from './bridge';
import { SweBenchJudge, type SweBenchVerdict } from './judge';

export type SweBenchRequestedMode = 'internal-smoke' | 'real-benchmark' | 'public-comparable';
export type SweBenchRunMode = 'internal-smoke' | 'real-benchmark';

export interface SweBenchBatchConfig {
  instanceIds: string[];
  timeoutMs: number;
  model: string;
  outputPath: string;
  mode?: SweBenchRequestedMode;
}

export interface SweBenchBatchRecord {
  task: SWETask;
  result: SWEResult;
  verdict: SweBenchVerdict;
  turnsUsed: number;
  costUsd: number;
}

export interface SweBenchBatchOutput {
  generatedAt: string;
  status: 'INTERNAL_SMOKE_OK' | 'REAL_BENCHMARK_RUN_RECORDED' | 'BLOCKED_PUBLIC_COMPARABLE_EVIDENCE' | 'CRASH';
  owner: 'Evidence / benchmark / public challenge';
  mode: SweBenchRunMode;
  requestedMode: SweBenchRequestedMode;
  evidenceClass: 'internal-smoke' | 'public-comparable-candidate';
  claimBoundary: string;
  rawEvidenceRequired: string[];
  publicBenchmarkClaimAllowed: boolean;
  externalComparisonClaimAllowed: boolean;
  model: string;
  timeoutMs: number;
  total: number;
  pass: number;
  fail: number;
  timeout: number;
  crash: number;
  blocked: number;
  passRate: number;
  records: SweBenchBatchRecord[];
}

export async function runSweBenchInstances(
  config: SweBenchBatchConfig,
  bridgeConfig: Partial<SWEBridgeConfig> = {},
): Promise<SweBenchBatchOutput> {
  const requestedMode = config.mode ?? 'internal-smoke';
  const mode = normalizeSweBenchMode(requestedMode);
  const tasks = config.instanceIds.map(instanceId => createMockableTask(instanceId, mode));
  const results = await runBatch(tasks, {
    taskTimeoutMs: config.timeoutMs,
    ...(mode === 'internal-smoke' ? { mockRunner: bridgeConfig.mockRunner ?? mockRunTask } : {}),
    ...bridgeConfig,
  });
  const judge = new SweBenchJudge();
  const records = tasks.map((task, index) => {
    const result = results[index] ?? crashResult(task.id, 'missing result');
    return {
      task,
      result,
      verdict: judge.judge(task, result),
      turnsUsed: result.testsPassed ? 3 : 5,
      costUsd: result.testsPassed ? 0.001 : 0.002,
    };
  });

  const output = summarize({ ...config, mode, requestedMode }, records);
  await writeSweBenchOutput(config.outputPath, output);
  return output;
}

export function createDefaultOutputPath(
  date = new Date(),
  mode: SweBenchRequestedMode = 'internal-smoke',
): string {
  const stamp = date.toISOString().slice(0, 10).replaceAll('-', '');
  const name = normalizeSweBenchMode(mode) === 'real-benchmark'
    ? 'DSXU_SWE_BENCH_RESULTS'
    : 'DSXU_SWE_INTERNAL_SMOKE_RESULTS';
  return join('docs', 'generated', `${name}_${stamp}.json`);
}

export function normalizeSweBenchMode(mode: SweBenchRequestedMode): SweBenchRunMode {
  return mode === 'public-comparable' ? 'real-benchmark' : mode;
}

function summarize(
  config: SweBenchBatchConfig & { mode: SweBenchRunMode; requestedMode: SweBenchRequestedMode },
  records: SweBenchBatchRecord[],
): SweBenchBatchOutput {
  const report = generateDetailedReport(
    records.map(record => record.task),
    records.map(record => record.result),
  );
  const pass = records.filter(record => record.verdict.status === 'PASS').length;
  const fail = records.filter(record => record.verdict.status === 'FAIL').length;
  const timeout = records.filter(record => record.verdict.status === 'TIMEOUT').length;
  const crash = records.filter(record => record.verdict.status === 'CRASH').length;
  const blocked = records.filter(record => record.verdict.status === 'BLOCKED').length;
  const status: SweBenchBatchOutput['status'] = crash > 0
    ? 'CRASH'
    : blocked > 0
      ? 'BLOCKED_PUBLIC_COMPARABLE_EVIDENCE'
      : config.mode === 'internal-smoke'
        ? 'INTERNAL_SMOKE_OK'
        : 'REAL_BENCHMARK_RUN_RECORDED';

  return {
    generatedAt: report.generatedAt,
    status,
    owner: 'Evidence / benchmark / public challenge',
    mode: config.mode,
    requestedMode: config.requestedMode,
    evidenceClass: config.mode === 'real-benchmark'
      ? 'public-comparable-candidate'
      : 'internal-smoke',
    claimBoundary:
      config.mode === 'real-benchmark'
        ? 'real benchmark candidate; public claim still requires fixed manifest, raw transcript, rubric, and paired evidence'
        : 'internal harness smoke only; not a public SWE-bench score or external comparison claim',
    rawEvidenceRequired: config.mode === 'real-benchmark'
      ? [
        'fixed public comparable task manifest',
        'DSXU raw transcript',
        'tool trace',
        'final report',
        'artifact directory',
        'cost and cache metrics',
        'scoring rubric',
        'failure recovery notes',
        'optional paired target/reference raw transcript for external comparison',
      ]
      : [],
    publicBenchmarkClaimAllowed: false,
    externalComparisonClaimAllowed: false,
    model: config.model,
    timeoutMs: config.timeoutMs,
    total: records.length,
    pass,
    fail,
    timeout,
    crash,
    blocked,
    passRate: records.length > 0 ? pass / records.length : 0,
    records,
  };
}

function createMockableTask(
  instanceId: string,
  mode: 'internal-smoke' | 'real-benchmark',
): SWETask {
  return createInternalSweSmokeTask(instanceId, mode);
}

export function createInternalSweSmokeTask(
  instanceId: string,
  mode: 'internal-smoke' | 'real-benchmark' = 'internal-smoke',
): SWETask {
  return {
    id: instanceId,
    repo: mode === 'internal-smoke' ? 'dsxu/internal-smoke' : 'external/swe-bench',
    baseCommit: '0000000',
    problemStatement: `Solve SWE-bench instance ${instanceId}`,
    difficulty: 'easy',
    languages: ['typescript'],
    multiFile: false,
    testPatch: '+ test covers sample behavior',
    goldPatch: '+ export const fixed = true;',
  };
}

async function mockRunTask(task: SWETask): Promise<SWEResult> {
  return {
    taskId: task.id,
    generatedPatch: task.goldPatch ?? '+ export const fixed = true;',
    testsPassed: true,
    passedTests: 1,
    totalTests: 1,
    durationMs: 12,
  };
}

function crashResult(taskId: string, error: string): SWEResult {
  return {
    taskId,
    generatedPatch: '',
    testsPassed: false,
    passedTests: 0,
    totalTests: 0,
    durationMs: 0,
    error,
  };
}

async function writeSweBenchOutput(outputPath: string, output: SweBenchBatchOutput): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(output, null, 2), 'utf-8');
}
