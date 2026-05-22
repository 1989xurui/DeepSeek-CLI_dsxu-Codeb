#!/usr/bin/env bun

import { mkdirSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { getSystemPrompt } from '../src/constants/prompts';
import { buildCacheWarmPrefixExport } from '../src/services/cache-warmer';

interface CliArgs {
  model: string;
  out?: string;
  printFull: boolean;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  process.env.DSXU_CODE_MODE ??= '1';

  const systemPromptSections = await getSystemPrompt([], args.model);
  const exportPack = buildCacheWarmPrefixExport({
    model: args.model,
    systemPromptSections,
  });
  const output = JSON.stringify(exportPack, null, 2);

  if (args.out) {
    mkdirSync(dirname(args.out), { recursive: true });
    writeFileSync(args.out, `${output}\n`, 'utf8');
  }

  console.log(args.printFull ? output : JSON.stringify({
    owner: exportPack.owner,
    schemaVersion: exportPack.schemaVersion,
    model: exportPack.model,
    boundaryFound: exportPack.boundaryFound,
    stableBlockCount: exportPack.stableBlockCount,
    dynamicBlockCount: exportPack.dynamicBlockCount,
    stablePrefixHash: exportPack.prefixes[0]
      ? await sha256Short(exportPack.prefixes[0])
      : null,
    stablePrefixApproxTokens: exportPack.stablePrefixApproxTokens,
    dynamicTailApproxTokens: exportPack.dynamicTailApproxTokens,
    prefixWritten: Boolean(args.out),
    outputJson: args.out ?? null,
    claimBoundary: exportPack.claimBoundary,
  }, null, 2));
}

function parseArgs(argv: string[]): CliArgs {
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
    model: values.get('model') ?? 'deepseek-v4-flash',
    out: values.get('out'),
    printFull: argv.includes('--print-full'),
  };
}

async function sha256Short(text: string): Promise<string> {
  const { createHash } = await import('crypto');
  return createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 16);
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
