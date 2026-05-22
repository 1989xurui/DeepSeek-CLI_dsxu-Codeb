#!/usr/bin/env bun

import { CacheWarmer, defaultCacheWarmPrefixes } from '../src/services/cache-warmer';
import { getSystemPrompt } from '../src/constants/prompts';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';

interface CliArgs {
  dryRun: boolean;
  model: string;
  concurrency: number;
  prefixes: string[];
  prefixFile?: string;
  printFull: boolean;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const warmer = new CacheWarmer();
  const prefixes = args.prefixFile
    ? readPrefixFile(args.prefixFile)
    : args.prefixes;
  const systemPromptSections =
    prefixes.length === 0 ? await buildRuntimeSystemPromptSections(args.model) : undefined;
  const result = await warmer.warm({
    model: args.model,
    concurrency: args.concurrency,
    prefixes: prefixes.length > 0 ? prefixes : undefined,
    systemPromptSections,
    dryRun: args.dryRun,
  });

  console.log(JSON.stringify(args.printFull ? result : redactedWarmResult(result), null, 2));
  if (result.failedKeys > 0 && !result.dryRun) {
    process.exitCode = 1;
  }
}

async function buildRuntimeSystemPromptSections(model: string): Promise<readonly string[]> {
  const previousDsxuCodeMode = process.env.DSXU_CODE_MODE;
  process.env.DSXU_CODE_MODE ??= '1';
  try {
    return await getSystemPrompt([], model);
  } finally {
    if (previousDsxuCodeMode === undefined) delete process.env.DSXU_CODE_MODE;
    else process.env.DSXU_CODE_MODE = previousDsxuCodeMode;
  }
}

function parseArgs(argv: string[]): CliArgs {
  const flags = new Set(argv.filter(arg => arg.startsWith('--') && !arg.includes('=')));
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
    }
  }

  return {
    dryRun: flags.has('--execute')
      ? false
      : flags.has('--dry-run') || values.get('dry-run') !== 'false',
    model: values.get('model') ?? 'deepseek-v4-flash',
    concurrency: Number.parseInt(values.get('concurrency') ?? '2', 10),
    prefixFile: values.get('prefix-file'),
    printFull: flags.has('--print-full') || values.get('print-full') === 'true',
    prefixes: values.get('prefixes')?.split(',').map(value => value.trim()).filter(Boolean) ??
      defaultCacheWarmPrefixes(),
  };
}

function redactedWarmResult(result: Awaited<ReturnType<CacheWarmer['warm']>>) {
  return {
    owner: result.owner,
    mode: result.mode,
    claimBoundary: result.claimBoundary,
    warmedKeys: result.warmedKeys,
    failedKeys: result.failedKeys,
    estimatedSavingsUsd: result.estimatedSavingsUsd,
    durationMs: result.durationMs,
    dryRun: result.dryRun,
    warmedPrefixHashes: result.warmedPrefixes.map(prefix => ({
      hash: sha256Short(prefix),
      chars: prefix.length,
      approxTokens: Math.ceil(prefix.length / 4),
    })),
    failedPrefixHashes: result.failedPrefixes.map(item => ({
      hash: sha256Short(item.prefix),
      chars: item.prefix.length,
      approxTokens: Math.ceil(item.prefix.length / 4),
      error: item.error,
    })),
  };
}

function sha256Short(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 16);
}

function readPrefixFile(filePath: string): string[] {
  const raw = readFileSync(filePath, 'utf8').trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map(value => String(value).trim()).filter(Boolean);
    }
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.prefixes)) {
      return parsed.prefixes.map((value: unknown) => String(value).trim()).filter(Boolean);
    }
  } catch {
    // Plain-text prefix file.
  }
  return [raw];
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
