#!/usr/bin/env bun

import { createHash } from 'crypto';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import {
  SYSTEM_PROMPT_DYNAMIC_BOUNDARY,
  getSystemPrompt,
} from '../src/constants/prompts';
import {
  CacheWarmer,
  buildCacheWarmPrefixExport,
  type CacheWarmPrefixExport,
} from '../src/services/cache-warmer';
import {
  collectCacheLiveAb,
  type CacheLiveAbReport,
} from '../src/services/cache-live-ab';

export type CacheRealityRunStatus =
  | 'PASS_CACHE_REALITY_DRY_RUN'
  | 'PASS_CACHE_REALITY_LIVE'
  | 'PARTIAL_CACHE_REALITY_LIVE'
  | 'BLOCKED_CACHE_REALITY_RUN'

export interface CacheRealityRunReport {
  schemaVersion: 'dsxu.cache-reality-run.v1';
  owner: 'DeepSeek route/cost/cache';
  generatedAt: string;
  status: CacheRealityRunStatus;
  publicClaimAllowed: false;
  claimBoundary: string;
  model: string;
  rawPrefixExportPath: string;
  publicReportPath: string;
  prefix: {
    boundaryFound: boolean;
    stableBlockCount: number;
    dynamicBlockCount: number;
    stablePrefixHash: string | null;
    stablePrefixChars: number;
    stablePrefixApproxTokens: number;
    dynamicTailApproxTokens: number;
  };
  warm: {
    dryRun: boolean;
    warmedKeys: number;
    failedKeys: number;
    warmedPrefixHashes: Array<{
      hash: string;
      chars: number;
      approxTokens: number;
    }>;
    claimBoundary: string;
  };
  liveAb: CacheLiveAbReport;
  redaction: {
    publicReportHashOnly: boolean;
    rawPrefixKeptLocalOnly: boolean;
    forbiddenTextMatches: string[];
  };
  blockers: string[];
}

export interface CollectCacheRealityRunInput {
  model?: string;
  rawPrefixExportPath?: string;
  publicReportPath?: string;
  executeLive?: boolean;
  rounds?: number;
  timeoutMs?: number;
  systemPromptSections?: readonly string[];
  fetchImpl?: typeof fetch;
}

const DEFAULT_DATE = '20260521';
const FORBIDDEN_PUBLIC_TEXT = [
  'You are an interactive agent',
  'DSXU Prompt Governance Contract',
  'Available tools in this turn',
  'DSXU DeepSeek Tool-Use Contract',
];

function sha256Short(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 16);
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function sanitizePrefixExport(exportPack: CacheWarmPrefixExport): CacheRealityRunReport['prefix'] {
  const stablePrefix = exportPack.prefixes[0] ?? '';
  return {
    boundaryFound: exportPack.boundaryFound,
    stableBlockCount: exportPack.stableBlockCount,
    dynamicBlockCount: exportPack.dynamicBlockCount,
    stablePrefixHash: stablePrefix ? sha256Short(stablePrefix) : null,
    stablePrefixChars: exportPack.stablePrefixChars,
    stablePrefixApproxTokens: exportPack.stablePrefixApproxTokens,
    dynamicTailApproxTokens: exportPack.dynamicTailApproxTokens,
  };
}

function publicReportHasForbiddenText(report: CacheRealityRunReport): string[] {
  const text = JSON.stringify(report);
  return FORBIDDEN_PUBLIC_TEXT.filter(marker => text.includes(marker));
}

export async function collectCacheRealityRun(
  input: CollectCacheRealityRunInput = {},
): Promise<CacheRealityRunReport> {
  const model = input.model ?? 'deepseek-v4-flash';
  const rawPrefixExportPath =
    input.rawPrefixExportPath ?? join(process.cwd(), '.dsxu', 'trace', 'cache-prefix-export.json');
  const publicReportPath =
    input.publicReportPath ?? join(process.cwd(), 'docs', 'generated', `DSXU_CACHE_REALITY_RUN_${DEFAULT_DATE}.json`);

  const previousDsxuCodeMode = process.env.DSXU_CODE_MODE;
  let systemPromptSections: readonly string[];
  if (input.systemPromptSections) {
    systemPromptSections = input.systemPromptSections;
  } else {
    process.env.DSXU_CODE_MODE ??= '1';
    try {
      systemPromptSections = await getSystemPrompt([], model);
    } finally {
      if (previousDsxuCodeMode === undefined) delete process.env.DSXU_CODE_MODE;
      else process.env.DSXU_CODE_MODE = previousDsxuCodeMode;
    }
  }
  const prefixExport = buildCacheWarmPrefixExport({
    model,
    systemPromptSections,
  });
  writeJson(rawPrefixExportPath, prefixExport);

  const stablePrefix = prefixExport.prefixes[0] ?? '';
  const warmResult = await new CacheWarmer().warm({
    model,
    concurrency: 1,
    prefixes: prefixExport.prefixes,
    dryRun: true,
  });
  const liveAb = await collectCacheLiveAb({
    prefix: stablePrefix,
    model,
    executeLive: input.executeLive,
    rounds: input.rounds ?? 2,
    timeoutMs: input.timeoutMs,
    fetchImpl: input.fetchImpl,
  });

  const blockers = [
    !prefixExport.boundaryFound ? 'SYSTEM_PROMPT_DYNAMIC_BOUNDARY missing' : '',
    stablePrefix.length === 0 ? 'stable prefix is empty' : '',
    warmResult.failedKeys > 0 ? `cache warm failedKeys=${warmResult.failedKeys}` : '',
    input.executeLive && liveAb.status !== 'PASS_CACHE_LIVE_AB'
      ? `live A/B did not pass: ${liveAb.status}`
      : '',
  ].filter(Boolean);

  const warm = {
    dryRun: warmResult.dryRun,
    warmedKeys: warmResult.warmedKeys,
    failedKeys: warmResult.failedKeys,
    warmedPrefixHashes: warmResult.warmedPrefixes.map(prefix => ({
      hash: sha256Short(prefix),
      chars: prefix.length,
      approxTokens: Math.ceil(prefix.length / 4),
    })),
    claimBoundary: warmResult.claimBoundary,
  };
  const preliminaryReport: CacheRealityRunReport = {
    schemaVersion: 'dsxu.cache-reality-run.v1',
    owner: 'DeepSeek route/cost/cache',
    generatedAt: new Date().toISOString(),
    status: 'BLOCKED_CACHE_REALITY_RUN',
    publicClaimAllowed: false,
    claimBoundary: 'public report is hash-only; raw prefix is local trace evidence; cache-hit claims require live repeated-prefix A/B',
    model,
    rawPrefixExportPath,
    publicReportPath,
    prefix: sanitizePrefixExport(prefixExport),
    warm,
    liveAb,
    redaction: {
      publicReportHashOnly: true,
      rawPrefixKeptLocalOnly: rawPrefixExportPath.includes(`${join('.dsxu', 'trace')}`) || rawPrefixExportPath.includes('.dsxu'),
      forbiddenTextMatches: [],
    },
    blockers,
  };
  const forbiddenTextMatches = publicReportHasForbiddenText(preliminaryReport);
  preliminaryReport.redaction.forbiddenTextMatches = forbiddenTextMatches;
  if (forbiddenTextMatches.length > 0) {
    preliminaryReport.redaction.publicReportHashOnly = false;
    preliminaryReport.blockers.push(`public report leaked forbidden prompt text: ${forbiddenTextMatches.join(', ')}`);
  }

  preliminaryReport.status =
    preliminaryReport.blockers.length > 0
      ? 'BLOCKED_CACHE_REALITY_RUN'
      : liveAb.status === 'PASS_CACHE_LIVE_AB'
        ? 'PASS_CACHE_REALITY_LIVE'
        : input.executeLive
          ? 'PARTIAL_CACHE_REALITY_LIVE'
          : 'PASS_CACHE_REALITY_DRY_RUN';

  writeJson(publicReportPath, preliminaryReport);
  return preliminaryReport;
}

function parseArgs(argv: string[]): CollectCacheRealityRunInput {
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
    model: values.get('model'),
    rawPrefixExportPath: values.get('raw-prefix-out'),
    publicReportPath: values.get('out'),
    executeLive: flags.has('execute-live') || values.get('execute-live') === 'true',
    rounds: values.has('rounds') ? Number.parseInt(values.get('rounds')!, 10) : undefined,
    timeoutMs: values.has('timeout-ms') ? Number.parseInt(values.get('timeout-ms')!, 10) : undefined,
  };
}

if (import.meta.main) {
  collectCacheRealityRun(parseArgs(process.argv.slice(2)))
    .then(report => {
      console.log(JSON.stringify({
        status: report.status,
        model: report.model,
        prefixHash: report.prefix.stablePrefixHash,
        stablePrefixApproxTokens: report.prefix.stablePrefixApproxTokens,
        dynamicTailApproxTokens: report.prefix.dynamicTailApproxTokens,
        warmWarmedKeys: report.warm.warmedKeys,
        liveStatus: report.liveAb.status,
        didCallProvider: report.liveAb.didCallProvider,
        publicReportHashOnly: report.redaction.publicReportHashOnly,
        blockers: report.blockers,
        outputJson: report.publicReportPath,
      }, null, 2));
      if (report.status === 'BLOCKED_CACHE_REALITY_RUN' || report.status === 'PARTIAL_CACHE_REALITY_LIVE') {
        process.exitCode = report.liveAb.mode === 'live' ? 1 : 0;
      }
    })
    .catch(error => {
      console.error(error instanceof Error ? error.stack ?? error.message : String(error));
      process.exitCode = 1;
    });
}
