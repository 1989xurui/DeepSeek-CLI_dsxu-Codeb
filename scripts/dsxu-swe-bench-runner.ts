#!/usr/bin/env bun

import {
  createDefaultOutputPath,
  normalizeSweBenchMode,
  runSweBenchInstances,
  type SweBenchRequestedMode,
} from '../src/services/eval/swe-bench/runner';

interface CliArgs {
  instances: string[];
  timeoutMs: number;
  model: string;
  mode: SweBenchRequestedMode;
  outputPath: string;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const output = await runSweBenchInstances({
    instanceIds: args.instances,
    timeoutMs: args.timeoutMs,
    model: args.model,
    mode: args.mode,
    outputPath: args.outputPath,
  });

  const summary = {
    status: output.status,
    mode: output.mode,
    requestedMode: output.requestedMode,
    evidenceClass: output.evidenceClass,
    claimBoundary: output.claimBoundary,
    rawEvidenceRequired: output.rawEvidenceRequired,
    publicBenchmarkClaimAllowed: output.publicBenchmarkClaimAllowed,
    externalComparisonClaimAllowed: output.externalComparisonClaimAllowed,
    outputPath: args.outputPath,
    total: output.total,
    pass: output.pass,
    fail: output.fail,
    timeout: output.timeout,
    crash: output.crash,
    blocked: output.blocked,
    passRate: output.passRate,
  };

  console.log(JSON.stringify(summary, null, 2));
  if (output.crash > 0) {
    process.exitCode = 1;
  }
}

function parseArgs(argv: string[]): CliArgs {
  const flags = new Set<string>();
  const values = new Map<string, string>();

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;

    const [key, inlineValue] = arg.slice(2).split('=', 2);
    if (inlineValue !== undefined) {
      values.set(key, inlineValue);
    } else if (argv[index + 1] && !argv[index + 1].startsWith('--')) {
      values.set(key, argv[index + 1]);
      index += 1;
    } else {
      flags.add(key);
    }
  }

  const instances = (values.get('instances') ?? 'mock-001')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);

  const mode = normalizeMode(values.get('mode') ?? (flags.has('real') ? 'real-benchmark' : 'internal-smoke'));

  return {
    instances,
    timeoutMs: Number.parseInt(values.get('timeout') ?? '60000', 10),
    model: values.get('model') ?? 'deepseek-v4-flash',
    mode,
    outputPath: values.get('output') ?? createDefaultOutputPath(new Date(), mode),
  };
}

function normalizeMode(value: string): SweBenchRequestedMode {
  if (value === 'real') return 'real-benchmark';
  if (value === 'real-benchmark' || value === 'public-comparable') return value;
  if (normalizeSweBenchMode(value as SweBenchRequestedMode) === 'real-benchmark') return value as SweBenchRequestedMode;
  return 'internal-smoke';
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
