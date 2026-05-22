#!/usr/bin/env bun

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

type CacheClosureStatus =
  | 'PASS_CACHE_HIT_CLOSURE_INTERNAL'
  | 'PARTIAL_CACHE_HIT_CLOSURE'
  | 'BLOCKED_CACHE_HIT_CLOSURE'

type CacheHitClosureReport = {
  schemaVersion: 'dsxu.cache-hit-closure.v1';
  owner: 'DeepSeek route/cost/cache';
  generatedAt: string;
  status: CacheClosureStatus;
  internalCacheClaimAllowed: boolean;
  publicClaimAllowed: false;
  claimBoundary: string;
  liveAb: {
    path: string;
    status?: string;
    didCallProvider?: boolean;
    prefixHash?: string;
    firstHitRatePct?: number;
    lastHitRatePct?: number;
    hitRateDeltaPct?: number;
    roundsRequested?: number;
    observationCount: number;
  };
  realityRun: {
    path: string;
    status?: string;
    boundaryFound?: boolean;
    stablePrefixHash?: string | null;
    stablePrefixApproxTokens?: number;
    dynamicTailApproxTokens?: number;
    publicReportHashOnly?: boolean;
  };
  sourceSafety: {
    dryRunDefault: boolean;
    placeholderPrefixesOptInOnly: boolean;
    onCacheMissDryRunLedgerOnly: boolean;
    laneStatsAvailable: boolean;
  };
  acceptance: {
    liveRepeatedPrefixPassed: boolean;
    dryRunBoundaryPreserved: boolean;
    redactionPreserved: boolean;
    performanceSafetyPreserved: boolean;
  };
  blockers: string[];
  nextEvidenceNeeded: string[];
}

type CollectCacheHitClosureInput = {
  liveAbPath?: string;
  realityRunPath?: string;
  outPath?: string;
}

const DEFAULT_DATE = '20260521';

function readJsonIfPresent(path: string): any | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readTextIfPresent(path: string): string {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function collectCacheHitClosure(
  input: CollectCacheHitClosureInput = {},
): CacheHitClosureReport {
  const liveAbPath = input.liveAbPath ?? join(process.cwd(), 'docs', 'generated', `DSXU_CACHE_LIVE_AB_${DEFAULT_DATE}.json`);
  const realityRunPath = input.realityRunPath ?? join(process.cwd(), 'docs', 'generated', `DSXU_CACHE_REALITY_RUN_${DEFAULT_DATE}.json`);
  const outPath = input.outPath ?? join(process.cwd(), 'docs', 'generated', `DSXU_CACHE_HIT_CLOSURE_${DEFAULT_DATE}.json`);

  const liveAb = readJsonIfPresent(liveAbPath);
  const realityRun = readJsonIfPresent(realityRunPath);
  const cacheWarmerSource = readTextIfPresent(join(process.cwd(), 'src', 'services', 'cache-warmer.ts'));
  const cacheMonitorSource = readTextIfPresent(join(process.cwd(), 'src', 'dsxu', 'engine', 'cache-monitor.ts'));
  const registrySource = readTextIfPresent(join(process.cwd(), 'src', 'services', 'cache-prefix-registry.ts'));

  const liveRepeatedPrefixPassed =
    liveAb?.status === 'PASS_CACHE_LIVE_AB' &&
    liveAb?.didCallProvider === true &&
    isFiniteNumber(liveAb?.lastHitRatePct) &&
    liveAb.lastHitRatePct >= 80;
  const dryRunBoundaryPreserved =
    realityRun?.status === 'PASS_CACHE_REALITY_DRY_RUN' ||
    realityRun?.status === 'PASS_CACHE_REALITY_LIVE' ||
    realityRun?.prefix?.boundaryFound === true;
  const redactionPreserved =
    realityRun?.redaction?.publicReportHashOnly === true ||
    realityRun === null;
  const sourceSafety = {
    dryRunDefault: cacheWarmerSource.includes('const dryRun = config.dryRun ?? true'),
    placeholderPrefixesOptInOnly:
      cacheWarmerSource.includes('LEGACY_PLACEHOLDER_PREFIXES') &&
      cacheWarmerSource.includes('allowPlaceholderPrefixes ? LEGACY_PLACEHOLDER_PREFIXES : []') &&
      !cacheWarmerSource.includes('const DEFAULT_PREFIXES'),
    onCacheMissDryRunLedgerOnly:
      cacheMonitorSource.includes('dry-run cache miss ledger only') &&
      cacheMonitorSource.includes('observability-only event') &&
      cacheMonitorSource.includes('getCacheMissWarmupEvents'),
    laneStatsAvailable:
      registrySource.includes('getCachePrefixRegistryLaneStats') &&
      registrySource.includes('no forced querySource merge'),
  };
  const performanceSafetyPreserved = Object.values(sourceSafety).every(Boolean);

  const blockers = [
    !liveRepeatedPrefixPassed ? 'live repeated-prefix A/B did not prove >=80% last-round cache hit' : '',
    !dryRunBoundaryPreserved ? 'stable/dynamic boundary evidence missing or blocked' : '',
    !redactionPreserved ? 'public report redaction is not hash-only' : '',
    !performanceSafetyPreserved ? 'one or more cache performance safety boundaries are missing' : '',
  ].filter(Boolean);

  const report: CacheHitClosureReport = {
    schemaVersion: 'dsxu.cache-hit-closure.v1',
    owner: 'DeepSeek route/cost/cache',
    generatedAt: new Date().toISOString(),
    status: blockers.length === 0
      ? 'PASS_CACHE_HIT_CLOSURE_INTERNAL'
      : liveAb?.didCallProvider === true
        ? 'PARTIAL_CACHE_HIT_CLOSURE'
        : 'BLOCKED_CACHE_HIT_CLOSURE',
    internalCacheClaimAllowed: blockers.length === 0,
    publicClaimAllowed: false,
    claimBoundary:
      'Internal cache-hit closure proves one repeated runtime stable prefix only; public product-wide cache, cost, or coding-quality claims still require long-task live trajectory evidence.',
    liveAb: {
      path: liveAbPath,
      status: liveAb?.status,
      didCallProvider: liveAb?.didCallProvider,
      prefixHash: liveAb?.prefixHash,
      firstHitRatePct: liveAb?.firstHitRatePct,
      lastHitRatePct: liveAb?.lastHitRatePct,
      hitRateDeltaPct: liveAb?.hitRateDeltaPct,
      roundsRequested: liveAb?.roundsRequested,
      observationCount: Array.isArray(liveAb?.observations) ? liveAb.observations.length : 0,
    },
    realityRun: {
      path: realityRunPath,
      status: realityRun?.status,
      boundaryFound: realityRun?.prefix?.boundaryFound,
      stablePrefixHash: realityRun?.prefix?.stablePrefixHash,
      stablePrefixApproxTokens: realityRun?.prefix?.stablePrefixApproxTokens,
      dynamicTailApproxTokens: realityRun?.prefix?.dynamicTailApproxTokens,
      publicReportHashOnly: realityRun?.redaction?.publicReportHashOnly,
    },
    sourceSafety,
    acceptance: {
      liveRepeatedPrefixPassed,
      dryRunBoundaryPreserved,
      redactionPreserved,
      performanceSafetyPreserved,
    },
    blockers,
    nextEvidenceNeeded: [
      'Run 20+ minute or multi-case DSXU live trajectories and aggregate real task-level cache hit rate.',
      'Join cache closure with finalization 14 non-pass replay before public performance claims.',
      'Keep sticky model routing observe-by-default unless quality evidence proves enforced routing is safe for that lane.',
    ],
  };

  writeJson(outPath, report);
  return report;
}

function parseArgs(argv: string[]): CollectCacheHitClosureInput {
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
    liveAbPath: values.get('live-ab'),
    realityRunPath: values.get('reality-run'),
    outPath: values.get('out'),
  };
}

if (import.meta.main) {
  const report = collectCacheHitClosure(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify({
    status: report.status,
    internalCacheClaimAllowed: report.internalCacheClaimAllowed,
    publicClaimAllowed: report.publicClaimAllowed,
    liveStatus: report.liveAb.status,
    lastHitRatePct: report.liveAb.lastHitRatePct,
    blockers: report.blockers,
  }, null, 2));
  if (report.status === 'BLOCKED_CACHE_HIT_CLOSURE') process.exitCode = 1;
}
