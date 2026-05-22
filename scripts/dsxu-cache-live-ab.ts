#!/usr/bin/env bun

import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { collectCacheLiveAb } from '../src/services/cache-live-ab';
import { getSystemPrompt } from '../src/constants/prompts';
import { buildCacheWarmPrefixExport } from '../src/services/cache-warmer';

interface CliArgs {
  model: string;
  baseUrl?: string;
  prefix?: string;
  prefixFile?: string;
  out: string;
  rounds: number;
  timeoutMs: number;
  executeLive: boolean;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const prefix = await resolveStablePrefix(args);
  const report = await collectCacheLiveAb({
    prefix,
    model: args.model,
    baseUrl: args.baseUrl,
    executeLive: args.executeLive,
    rounds: args.rounds,
    timeoutMs: args.timeoutMs,
  });

  mkdirSync(dirname(args.out), { recursive: true });
  writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({
    status: report.status,
    mode: report.mode,
    didCallProvider: report.didCallProvider,
    prefixHash: report.prefixHash,
    firstHitRatePct: report.firstHitRatePct,
    lastHitRatePct: report.lastHitRatePct,
    hitRateDeltaPct: report.hitRateDeltaPct,
    blockers: report.blockers,
    outputJson: args.out,
  }, null, 2));

  if (report.status === 'PARTIAL_CACHE_LIVE_AB' || report.status === 'BLOCKED_CACHE_LIVE_AB') {
    process.exitCode = args.executeLive ? 1 : 0;
  }
}

async function resolveStablePrefix(args: CliArgs): Promise<string> {
  if (args.prefix !== undefined) return args.prefix;
  if (args.prefixFile) return readPrefixFile(args.prefixFile);

  const previousDsxuCodeMode = process.env.DSXU_CODE_MODE;
  process.env.DSXU_CODE_MODE ??= '1';
  try {
    const systemPromptSections = await getSystemPrompt([], args.model);
    const exportPack = buildCacheWarmPrefixExport({
      model: args.model,
      systemPromptSections,
    });
    return exportPack.prefixes[0] ?? '';
  } finally {
    if (previousDsxuCodeMode === undefined) delete process.env.DSXU_CODE_MODE;
    else process.env.DSXU_CODE_MODE = previousDsxuCodeMode;
  }
}

function parseArgs(argv: string[]): CliArgs {
  const values = new Map<string, string>();
  const flags = new Set<string>();
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

  return {
    model: values.get('model') ?? 'deepseek-v4-flash',
    baseUrl: values.get('base-url'),
    prefix: values.get('prefix'),
    prefixFile: values.get('prefix-file'),
    out: values.get('out') ?? join(process.cwd(), 'docs', 'generated', 'DSXU_CACHE_LIVE_AB.json'),
    rounds: Number.parseInt(values.get('rounds') ?? '2', 10),
    timeoutMs: Number.parseInt(values.get('timeout-ms') ?? '45000', 10),
    executeLive: flags.has('execute-live') || values.get('execute-live') === 'true',
  };
}

function readPrefixFile(filePath: string): string {
  const raw = readFileSync(filePath, 'utf8').trim();
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    const prefixes = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === 'object' && Array.isArray(parsed.prefixes)
        ? parsed.prefixes
        : null;
    if (prefixes?.length) {
      return String(prefixes[0] ?? '').trim();
    }
  } catch {
    // Plain-text prefix file.
  }
  return raw;
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
