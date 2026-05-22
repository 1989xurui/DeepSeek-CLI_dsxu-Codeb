#!/usr/bin/env bun

import { mkdir, readdir, readFile, writeFile } from 'fs/promises';
import { basename, dirname, join } from 'path';
import {
  buildPublicComparableRawEvidenceReadiness,
  type PublicComparableBenchmarkManifest,
  type PublicComparableRawEvidenceManifest,
} from '../src/dsxu/engine/raw-evidence-readiness-register-v1';

type GateStatus = 'PASS' | 'FAIL' | 'BLOCKED' | 'CLAIM_BLOCKED' | 'NOT_RUN' | 'INFO';

interface EvidenceDashboard {
  generatedAt: string;
  scoreFloor: number | null;
  claimBoundary: string;
  trajectory: Array<{ date: string; metric: string; value: number }>;
  gateSummary: {
    total: number;
    pass: number;
    fail: number;
    blocked: number;
    claimBlocked: number;
    notRun: number;
    info: number;
  };
  gates: Array<{ name: string; status: GateStatus; lastRun: string; evidenceFile: string }>;
  failureAttributions: Array<{
    source: string;
    id: string;
    owner: string;
    rootCause: string;
    nextAction: string;
    timedOut: boolean;
    evidenceFile: string;
  }>;
  ownerFailureSummary: Array<{
    owner: string;
    failureCount: number;
    timedOutCount: number;
    rootCauses: string[];
    nextActions: string[];
    evidenceFiles: string[];
  }>;
  evidenceCoverage: {
    sourceTest: EvidenceCoverageArea;
    live: EvidenceCoverageArea;
    raw: EvidenceCoverageArea;
    cost: EvidenceCoverageArea;
    cache: EvidenceCoverageArea;
    missingAreas: string[];
  };
  workbench: {
    trustState: 'ready-for-release-review' | 'runtime-failing' | 'release-blocked' | 'evidence-incomplete';
    releaseClaimAllowed: boolean;
    blockingReasons: string[];
    nextActions: string[];
    failedOwnerCount: number;
    publicComparablePendingCount: number;
    externalComparisonPendingCount: number;
    actionItems: Array<{
      id: string;
      priority: 'P0' | 'P1' | 'P2';
      owner: string;
      reason: string;
      nextAction: string;
      command?: string;
      evidenceFiles: string[];
    }>;
  };
  commandCatalog?: {
    scriptCount: number;
    mainlineAliases: string[];
    categorySummary: Record<string, number>;
    evidenceFile: string;
  };
  v4Consolidation?: {
    status: GateStatus;
    completedStageCount: number;
    expectedStageCount: number;
    missingStages: string[];
    blockedStages: string[];
    launchAcceptanceStatus?: string;
    hardBlockerClosedCount?: number;
    hardBlockerTotal?: number;
    remainingLaunchBlockers?: string[];
    stageStatuses: Array<{
      stage: string;
      status: string;
      owner: string;
      evidenceFiles: string[];
    }>;
    releaseClaimBoundary: string;
    evidenceFile: string;
  };
  releaseTrustPanel: {
    status: 'ready-for-review' | 'blocked' | 'needs-evidence' | 'runtime-failing';
    scoreFloor: number | null;
    mainlineAliasesReady: boolean;
    v4ConsolidationReady: boolean;
    blockedGateNames: string[];
    claimBlockedGateNames: string[];
    notRunGateSample: string[];
    publicComparableMissingCases: number;
    externalComparisonPendingCount: number;
    recommendedCommands: string[];
    dataStillNeeded: string[];
  };
  benchmarkResults: Array<{ name: string; passRate: number; sampleCount: number; date: string }>;
  publicComparableReadiness: Array<{
    name: string;
    status: GateStatus;
    caseCount: number;
    readyCaseCount: number;
    missingCaseCount: number;
    publicBenchmarkClaimAllowed: boolean;
    externalComparisonClaimAllowed: boolean;
    nextAction: string;
    evidenceFile: string;
  }>;
  costMetrics: { beforeUsd: number; afterUsd: number; reduction: string };
  parseErrors: Array<{ evidenceFile: string; error: string }>;
}

type EvidenceCoverageArea = {
  ready: boolean;
  fileCount: number;
  sampleFiles: string[];
};

export async function aggregateEvidence(
  evidenceDir = join('docs', 'generated'),
  outputPath = createDashboardOutputPath(),
): Promise<EvidenceDashboard> {
  const files = await listJsonFiles(evidenceDir);
  const publicComparableRawEvidenceManifest = await findPublicComparableRawEvidenceManifest(files);
  const rawEvidenceReadiness = await findCurrentRawEvidenceReadiness(files, evidenceDir);
  const publicComparableSupersession = await findCurrentPublicComparableSupersession(files);
  const artifactRoot = inferArtifactRoot(evidenceDir);
  const dashboard: EvidenceDashboard = {
    generatedAt: new Date().toISOString(),
    scoreFloor: null,
    claimBoundary:
      'Evidence dashboard is a release-claim binder input. It aggregates explicit evidence only and never derives score from pass rate.',
    trajectory: [],
    gateSummary: { total: 0, pass: 0, fail: 0, blocked: 0, claimBlocked: 0, notRun: 0, info: 0 },
    gates: [],
    failureAttributions: [],
    ownerFailureSummary: [],
    evidenceCoverage: {
      sourceTest: createEvidenceCoverageArea(),
      live: createEvidenceCoverageArea(),
      raw: createEvidenceCoverageArea(),
      cost: createEvidenceCoverageArea(),
      cache: createEvidenceCoverageArea(),
      missingAreas: [],
    },
    workbench: {
      trustState: 'evidence-incomplete',
      releaseClaimAllowed: false,
      blockingReasons: [],
      nextActions: [],
      failedOwnerCount: 0,
      publicComparablePendingCount: 0,
      externalComparisonPendingCount: 0,
      actionItems: [],
    },
    releaseTrustPanel: {
      status: 'needs-evidence',
      scoreFloor: null,
      mainlineAliasesReady: false,
      v4ConsolidationReady: false,
      blockedGateNames: [],
      claimBlockedGateNames: [],
      notRunGateSample: [],
      publicComparableMissingCases: 0,
      externalComparisonPendingCount: 0,
      recommendedCommands: [],
      dataStillNeeded: [],
    },
    benchmarkResults: [],
    publicComparableReadiness: [],
    costMetrics: { beforeUsd: 0, afterUsd: 0, reduction: '0%' },
    parseErrors: [],
  };

  for (const file of files) {
    try {
      const raw = await readFile(file, 'utf-8');
      const json = JSON.parse(raw.replace(/^\uFEFF/, ''));
      collectEvidence(
        dashboard,
        file,
        json,
        publicComparableRawEvidenceManifest,
        rawEvidenceReadiness,
        publicComparableSupersession,
        artifactRoot,
      );
    } catch (error) {
      dashboard.parseErrors.push({
        evidenceFile: file,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  dashboard.costMetrics = inferCostMetrics(dashboard.costMetrics, files.length);
  dashboard.gateSummary = summarizeGates(dashboard.gates);
  dashboard.ownerFailureSummary = summarizeOwnerFailures(dashboard.failureAttributions);
  dashboard.evidenceCoverage = finalizeEvidenceCoverage(dashboard.evidenceCoverage);
  dashboard.workbench = buildEvidenceWorkbench(dashboard);
  dashboard.releaseTrustPanel = buildReleaseTrustPanel(dashboard);

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(dashboard, null, 2), 'utf-8');
  return dashboard;
}

function summarizeGates(gates: EvidenceDashboard['gates']): EvidenceDashboard['gateSummary'] {
  return {
    total: gates.length,
    pass: gates.filter(gate => gate.status === 'PASS').length,
    fail: gates.filter(gate => gate.status === 'FAIL').length,
    blocked: gates.filter(gate => gate.status === 'BLOCKED').length,
    claimBlocked: gates.filter(gate => gate.status === 'CLAIM_BLOCKED').length,
    notRun: gates.filter(gate => gate.status === 'NOT_RUN').length,
    info: gates.filter(gate => gate.status === 'INFO').length,
  };
}

function summarizeOwnerFailures(
  rows: EvidenceDashboard['failureAttributions'],
): EvidenceDashboard['ownerFailureSummary'] {
  const byOwner = new Map<string, EvidenceDashboard['failureAttributions']>();
  for (const row of rows) {
    const existing = byOwner.get(row.owner) ?? [];
    existing.push(row);
    byOwner.set(row.owner, existing);
  }

  return [...byOwner.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([owner, failures]) => ({
      owner,
      failureCount: failures.length,
      timedOutCount: failures.filter(row => row.timedOut).length,
      rootCauses: unique(failures.map(row => row.rootCause)),
      nextActions: unique(failures.map(row => row.nextAction)),
      evidenceFiles: unique(failures.map(row => row.evidenceFile)),
    }));
}

function createEvidenceCoverageArea(): EvidenceCoverageArea {
  return { ready: false, fileCount: 0, sampleFiles: [] };
}

function markEvidenceCoverage(area: EvidenceCoverageArea, file: string): void {
  area.fileCount += 1;
  if (area.sampleFiles.length < 5) area.sampleFiles.push(file);
}

function finalizeEvidenceCoverage(
  coverage: EvidenceDashboard['evidenceCoverage'],
): EvidenceDashboard['evidenceCoverage'] {
  const next = {
    sourceTest: { ...coverage.sourceTest, ready: coverage.sourceTest.fileCount > 0 },
    live: { ...coverage.live, ready: coverage.live.fileCount > 0 },
    raw: { ...coverage.raw, ready: coverage.raw.fileCount > 0 },
    cost: { ...coverage.cost, ready: coverage.cost.fileCount > 0 },
    cache: { ...coverage.cache, ready: coverage.cache.fileCount > 0 },
    missingAreas: [] as string[],
  };
  for (const [key, area] of Object.entries(next)) {
    if (key === 'missingAreas') continue;
    if (!(area as EvidenceCoverageArea).ready) next.missingAreas.push(key);
  }
  return next;
}

function collectEvidenceCoverage(
  dashboard: EvidenceDashboard,
  name: string,
  file: string,
  json: any,
): void {
  const text = `${name} ${String(json?.schemaVersion ?? '')} ${String(json?.status ?? '')}`.toLowerCase();
  if (
    /\b(test|six[-_]?stage|command[-_]?catalog|release[-_]?surface|open[-_]?source|gate|acceptance)\b/i.test(text) ||
    /\b(consolidation|owner[-_]?map|freeze[-_]?register|risk[-_]?register)\b/i.test(text) ||
    asArray(json?.failedCommandAttributions).length > 0
  ) {
    markEvidenceCoverage(dashboard.evidenceCoverage.sourceTest, file);
  }
  if (/\b(live|tui|senior[-_]?coding[-_]?window|doctor|health|real[-_]?tui)\b/i.test(text)) {
    markEvidenceCoverage(dashboard.evidenceCoverage.live, file);
  }
  if (
    isPublicComparableRawEvidenceManifest(json) ||
    /\b(raw|transcript|trace|trajectory)\b/i.test(text)
  ) {
    markEvidenceCoverage(dashboard.evidenceCoverage.raw, file);
  }
  if (
    numeric(json?.costUsd ?? json?.totalCostUsd ?? json?.beforeUsd ?? json?.afterUsd ?? json?.costBeforeUsd ?? json?.costAfterUsd) !== undefined ||
    hasNestedNumericKey(json, ['costUsd', 'totalCostUsd', 'beforeUsd', 'afterUsd', 'costBeforeUsd', 'costAfterUsd']) ||
    /\b(cost|route|trajectory)\b/i.test(text)
  ) {
    markEvidenceCoverage(dashboard.evidenceCoverage.cost, file);
  }
  if (
    numeric(json?.cacheHitRatePct ?? json?.cache_hit_rate_pct) !== undefined ||
    hasNestedNumericKey(json, ['cacheHitRatePct', 'cache_hit_rate_pct']) ||
    /\b(cache|prefix)\b/i.test(text)
  ) {
    markEvidenceCoverage(dashboard.evidenceCoverage.cache, file);
  }
}

function hasNestedNumericKey(value: unknown, keys: readonly string[], depth = 0): boolean {
  if (depth > 4 || value === null || typeof value !== 'object') return false;
  if (Array.isArray(value)) {
    return value.some(item => hasNestedNumericKey(item, keys, depth + 1));
  }
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    if (numeric(record[key]) !== undefined) return true;
  }
  return Object.values(record).some(item => hasNestedNumericKey(item, keys, depth + 1));
}

function buildEvidenceWorkbench(dashboard: EvidenceDashboard): EvidenceDashboard['workbench'] {
  const blockingReasons: string[] = [];
  const nextActions: string[] = [];
  const actionItems: EvidenceDashboard['workbench']['actionItems'] = [];

  if (dashboard.gateSummary.fail > 0) {
    blockingReasons.push('runtime-or-acceptance-gate-failing');
    nextActions.push('fix failing owner commands before release claim update');
    for (const owner of dashboard.ownerFailureSummary) {
      actionItems.push({
        id: `runtime-failure:${owner.owner}`,
        priority: 'P0',
        owner: owner.owner,
        reason: owner.rootCauses.join('; ') || 'runtime gate failed',
        nextAction: owner.nextActions[0] ?? 'fix failing owner command',
        command: 'bun run test:six-stage-final',
        evidenceFiles: owner.evidenceFiles,
      });
    }
  }
  if (dashboard.gateSummary.blocked > 0) {
    blockingReasons.push('runtime-or-release-gate-blocked');
    nextActions.push('resolve blocked runtime/release gates before release review');
    actionItems.push({
      id: 'runtime-release-gate-blocked',
      priority: 'P0',
      owner: 'Evidence / Runtime Release Gate',
      reason: 'runtime or release gate is blocked',
      nextAction: 'resolve blocked runtime/release gates before release review',
      command: 'bun run release:github-launch-pack',
      evidenceFiles: dashboard.gates
        .filter(gate => gate.status === 'BLOCKED')
        .map(gate => gate.evidenceFile),
    });
  }
  if (dashboard.gateSummary.claimBlocked > 0) {
    blockingReasons.push('public-claim-boundary-evidence-incomplete');
    nextActions.push('keep public 90/95 and external comparison claims disabled until paired raw evidence exists');
    actionItems.push({
      id: 'public-claim-boundary-blocked',
      priority: 'P1',
      owner: 'Evidence / Release Claim Binder',
      reason: `${dashboard.gateSummary.claimBlocked} gate(s) block public 90/95 or external comparison claims only`,
      nextAction: 'publish only the actual evidenced score; keep public 90/95 and external comparison claims disabled until paired raw evidence exists',
      command: 'bun run release:github-launch-pack',
      evidenceFiles: dashboard.gates
        .filter(gate => gate.status === 'CLAIM_BLOCKED')
        .map(gate => gate.evidenceFile),
    });
  }
  const publicComparablePendingCount = dashboard.publicComparableReadiness
    .filter(row => !row.publicBenchmarkClaimAllowed)
    .length;
  if (publicComparablePendingCount > 0) {
    blockingReasons.push('public-comparable-raw-evidence-incomplete');
    nextActions.push('collect DSXU public-comparable raw evidence before public benchmark charts');
    actionItems.push({
      id: 'public-comparable-raw-evidence',
      priority: 'P1',
      owner: 'Evidence / Benchmark / Public Comparable',
      reason: `${publicComparablePendingCount} public-comparable manifest(s) still lack DSXU raw evidence`,
      nextAction: 'collect DSXU public-comparable raw evidence before public benchmark charts',
      command: 'bun run benchmark:swe-bench -- --mode public-comparable',
      evidenceFiles: dashboard.publicComparableReadiness
        .filter(row => !row.publicBenchmarkClaimAllowed)
        .map(row => row.evidenceFile),
    });
  }
  const externalComparisonPendingCount = dashboard.publicComparableReadiness
    .filter(row => row.publicBenchmarkClaimAllowed && !row.externalComparisonClaimAllowed)
    .length;
  if (externalComparisonPendingCount > 0) {
    blockingReasons.push('external-target-raw-evidence-incomplete');
    nextActions.push('collect target reference raw evidence before external comparison claims');
    actionItems.push({
      id: 'external-comparison-target-raw-evidence',
      priority: 'P1',
      owner: 'Evidence / Benchmark / External Comparison',
      reason: `${externalComparisonPendingCount} public-comparable manifest(s) have DSXU raw evidence but lack target reference raw evidence`,
      nextAction: 'collect target reference raw evidence before external comparison claims',
      command: 'bun run evidence:public-comparable-raw',
      evidenceFiles: dashboard.publicComparableReadiness
        .filter(row => row.publicBenchmarkClaimAllowed && !row.externalComparisonClaimAllowed)
        .map(row => row.evidenceFile),
    });
  }
  if (dashboard.gateSummary.notRun > 0) {
    blockingReasons.push('not-run-evidence-present');
    nextActions.push('keep not-run evidence out of README claims or rerun the owner command');
    actionItems.push({
      id: 'not-run-evidence',
      priority: 'P2',
      owner: 'Evidence / Release Claim Binder',
      reason: `${dashboard.gateSummary.notRun} gate(s) are NOT_RUN and cannot be used as GitHub claims`,
      nextAction: 'keep not-run evidence out of README claims or rerun the owner command',
      evidenceFiles: dashboard.gates
        .filter(gate => gate.status === 'NOT_RUN')
        .slice(0, 12)
        .map(gate => gate.evidenceFile),
    });
  }
  if (dashboard.evidenceCoverage.missingAreas.length > 0) {
    blockingReasons.push('release-evidence-coverage-incomplete');
    nextActions.push('collect source/test/live/raw/cost/cache evidence before upgrading public claims');
    actionItems.push({
      id: 'release-evidence-coverage',
      priority: 'P1',
      owner: 'Evidence / Release Claim Binder',
      reason: `missing evidence coverage: ${dashboard.evidenceCoverage.missingAreas.join(', ')}`,
      nextAction: 'collect source/test/live/raw/cost/cache evidence before upgrading public claims',
      command: 'bun run evidence:dashboard',
      evidenceFiles: [
        ...dashboard.evidenceCoverage.sourceTest.sampleFiles,
        ...dashboard.evidenceCoverage.live.sampleFiles,
        ...dashboard.evidenceCoverage.raw.sampleFiles,
        ...dashboard.evidenceCoverage.cost.sampleFiles,
        ...dashboard.evidenceCoverage.cache.sampleFiles,
      ].slice(0, 12),
    });
  }
  if (dashboard.v4Consolidation && dashboard.v4Consolidation.status !== 'PASS') {
    blockingReasons.push('v4-consolidation-incomplete');
    nextActions.push('finish V4 P0-P8 owner-folded consolidation before release claim update');
    actionItems.push({
      id: 'v4-consolidation-incomplete',
      priority: 'P0',
      owner: 'V4 Product Core / Release Claim Binder',
      reason: `missing stages: ${dashboard.v4Consolidation.missingStages.join(', ') || 'none'}; blocked stages: ${dashboard.v4Consolidation.blockedStages.join(', ') || 'none'}`,
      nextAction: 'finish V4 P0-P8 owner-folded consolidation before release claim update',
      command: 'bun run evidence:dashboard',
      evidenceFiles: [dashboard.v4Consolidation.evidenceFile],
    });
  }

  const trustState =
    dashboard.gateSummary.fail > 0 ? 'runtime-failing'
      : dashboard.gateSummary.blocked > 0 ? 'release-blocked'
        : blockingReasons.length === 0 ? 'ready-for-release-review'
          : 'evidence-incomplete';

  return {
    trustState,
    releaseClaimAllowed: trustState === 'ready-for-release-review',
    blockingReasons: unique(blockingReasons),
    nextActions: unique(nextActions),
    failedOwnerCount: dashboard.ownerFailureSummary.length,
    publicComparablePendingCount,
    externalComparisonPendingCount,
    actionItems,
  };
}

function buildReleaseTrustPanel(dashboard: EvidenceDashboard): EvidenceDashboard['releaseTrustPanel'] {
  const blockedGateNames = dashboard.gates
    .filter(gate => gate.status === 'BLOCKED')
    .map(gate => gate.name)
    .slice(0, 12);
  const claimBlockedGateNames = dashboard.gates
    .filter(gate => gate.status === 'CLAIM_BLOCKED')
    .map(gate => gate.name)
    .slice(0, 12);
  const notRunGateSample = dashboard.gates
    .filter(gate => gate.status === 'NOT_RUN')
    .map(gate => gate.name)
    .slice(0, 12);
  const publicComparableMissingCases = dashboard.publicComparableReadiness
    .reduce((sum, row) => sum + row.missingCaseCount, 0);
  const externalComparisonPendingCount = dashboard.publicComparableReadiness
    .filter(row => row.publicBenchmarkClaimAllowed && !row.externalComparisonClaimAllowed)
    .length;
  const mainlineAliasesReady = Boolean(
    dashboard.commandCatalog &&
    ['evidence:dashboard', 'benchmark:swe-bench', 'health:runtime', 'cache:warm']
      .every(alias => dashboard.commandCatalog?.mainlineAliases.includes(alias)),
  );
  const v4ConsolidationReady = dashboard.v4Consolidation?.status === 'PASS';
  const dataStillNeeded: string[] = [];
  const recommendedCommands: string[] = [];
  if (!mainlineAliasesReady) {
    dataStillNeeded.push('command catalog with four mainline aliases');
    recommendedCommands.push('bun run scripts/dsxu-command-catalog.ts');
  }
  if (dashboard.v4Consolidation && !v4ConsolidationReady) {
    dataStillNeeded.push(`V4 consolidation stages: ${dashboard.v4Consolidation.missingStages.join(', ') || dashboard.v4Consolidation.blockedStages.join(', ')}`);
    recommendedCommands.push('bun run evidence:dashboard');
  }
  if (blockedGateNames.length > 0) {
    dataStillNeeded.push('runtime/release blocker resolution');
    recommendedCommands.push('bun run release:github-launch-pack');
  }
  if (claimBlockedGateNames.length > 0) {
    dataStillNeeded.push('public 90/95 or external comparison claim evidence');
    recommendedCommands.push('bun run release:github-launch-pack');
  }
  if (publicComparableMissingCases > 0) {
    dataStillNeeded.push(`public comparable raw evidence for ${publicComparableMissingCases} cases`);
    recommendedCommands.push('bun run benchmark:swe-bench -- --mode public-comparable');
  }
  if (externalComparisonPendingCount > 0) {
    dataStillNeeded.push(`target reference raw evidence for ${externalComparisonPendingCount} public comparable manifest(s)`);
    recommendedCommands.push('bun run evidence:public-comparable-raw');
  }
  if (dashboard.gateSummary.notRun > 0) {
    dataStillNeeded.push('not-run evidence cannot be used as GitHub claims');
  }
  if (dashboard.gateSummary.fail > 0) {
    recommendedCommands.push('bun run test:six-stage-final');
  }
  if (dashboard.evidenceCoverage.missingAreas.length > 0) {
    dataStillNeeded.push(`release evidence coverage: ${dashboard.evidenceCoverage.missingAreas.join(', ')}`);
    recommendedCommands.push('bun run evidence:dashboard');
  }

  const status =
    dashboard.gateSummary.fail > 0 ? 'runtime-failing'
      : dashboard.gateSummary.blocked > 0 ? 'blocked'
        : dataStillNeeded.length > 0 ? 'needs-evidence'
          : 'ready-for-review';

  return {
    status,
    scoreFloor: dashboard.scoreFloor,
    mainlineAliasesReady,
    v4ConsolidationReady,
    blockedGateNames,
    claimBlockedGateNames,
    notRunGateSample,
    publicComparableMissingCases,
    externalComparisonPendingCount,
    recommendedCommands: unique(recommendedCommands),
    dataStillNeeded: unique(dataStillNeeded),
  };
}

async function findPublicComparableRawEvidenceManifest(
  files: string[],
): Promise<PublicComparableRawEvidenceManifest | undefined> {
  let best: PublicComparableRawEvidenceManifest | undefined;
  for (const file of [...files].sort().reverse()) {
    try {
      const raw = await readFile(file, 'utf-8');
      const json = JSON.parse(raw.replace(/^\uFEFF/, ''));
      if (isPublicComparableRawEvidenceManifest(json) && isBetterRawEvidenceManifest(json, best)) {
        best = json;
      }
    } catch {
      // Main evidence parsing reports parse errors; this lookup only finds an optional intake manifest.
    }
  }
  return best;
}

function isBetterRawEvidenceManifest(
  candidate: PublicComparableRawEvidenceManifest,
  current: PublicComparableRawEvidenceManifest | undefined,
): boolean {
  if (!current) return true;
  const candidateCaseCount = Array.isArray(candidate.cases) ? candidate.cases.length : 0;
  const currentCaseCount = Array.isArray(current.cases) ? current.cases.length : 0;
  if (candidateCaseCount !== currentCaseCount) return candidateCaseCount > currentCaseCount;
  const candidateCollectedAt = Date.parse(String(candidate.source?.collectedAt ?? ''));
  const currentCollectedAt = Date.parse(String(current.source?.collectedAt ?? ''));
  return Number.isFinite(candidateCollectedAt) && (!Number.isFinite(currentCollectedAt) || candidateCollectedAt > currentCollectedAt);
}

type RawEvidenceReadinessContext = {
  p12Pass: boolean;
  evidenceFile?: string;
};

type PublicComparableSupersessionContext = {
  rawEvidenceReady: boolean;
  evidenceFile?: string;
  caseCount: number;
  readyCaseCount: number;
};

async function findCurrentPublicComparableSupersession(
  files: string[],
): Promise<PublicComparableSupersessionContext> {
  let best: PublicComparableSupersessionContext = {
    rawEvidenceReady: false,
    caseCount: 0,
    readyCaseCount: 0,
  };

  for (const file of [...files].sort().reverse()) {
    try {
      const raw = await readFile(file, 'utf-8');
      const json = JSON.parse(raw.replace(/^\uFEFF/, ''));
      if (!isPublicComparableRawEvidenceImportReport(json)) continue;
      const status = String(json.status ?? '').toUpperCase();
      const caseCount = numeric(json.caseCount) ?? 0;
      const readyCaseCount = numeric(json.readyCaseCount) ?? 0;
      const missingCaseCount = numeric(json.missingCaseCount) ?? 0;
      const isReady = status === 'PASS' &&
        caseCount > 0 &&
        readyCaseCount >= caseCount &&
        missingCaseCount === 0 &&
        json.publicBenchmarkClaimAllowed === true;
      if (!isReady) continue;
      if (!best.rawEvidenceReady || readyCaseCount > best.readyCaseCount) {
        best = {
          rawEvidenceReady: true,
          evidenceFile: file,
          caseCount,
          readyCaseCount,
        };
      }
    } catch {
      // Main evidence parsing reports parse errors; this lookup only finds a current superseding import report.
    }
  }

  return best;
}

async function findCurrentRawEvidenceReadiness(
  files: string[],
  evidenceDir: string,
): Promise<RawEvidenceReadinessContext> {
  for (const file of [...files].sort().reverse()) {
    try {
      const raw = await readFile(file, 'utf-8');
      const json = JSON.parse(raw.replace(/^\uFEFF/, ''));
      if (isCurrentRawEvidenceReadinessPass(json)) return { p12Pass: true, evidenceFile: file };
    } catch {
      // Main evidence parsing reports parse errors; this lookup only checks whether a newer raw-readiness proof exists.
    }
  }

  if (!isDefaultGeneratedEvidenceDir(evidenceDir)) return { p12Pass: false };
  const traceEvidenceFile = join(
    '.dsxu',
    'trace',
    'raw-evidence-readiness-register-v1',
    'raw-evidence-readiness-register.evidence.json',
  );
  try {
    const raw = await readFile(traceEvidenceFile, 'utf-8');
    const json = JSON.parse(raw.replace(/^\uFEFF/, ''));
    return isCurrentRawEvidenceReadinessPass(json)
      ? { p12Pass: true, evidenceFile: traceEvidenceFile }
      : { p12Pass: false, evidenceFile: traceEvidenceFile };
  } catch {
    return { p12Pass: false };
  }
}

function isDefaultGeneratedEvidenceDir(evidenceDir: string): boolean {
  const normalized = evidenceDir.replaceAll('\\', '/').replace(/^\.\//, '');
  return normalized === 'docs/generated' || normalized.endsWith('/docs/generated');
}

function isCurrentRawEvidenceReadinessPass(json: any): boolean {
  const status = String(json?.status ?? '').toUpperCase();
  const p12Status = String(json?.p12Status ?? json?.summary?.p12Status ?? '').toUpperCase();
  const deferredEvalStatus = String(json?.deferredEvalStatus ?? json?.summary?.deferredEvalStatus ?? '').toUpperCase();
  return status === 'PASS' && p12Status === 'PASS' && deferredEvalStatus === 'PASS';
}

function inferArtifactRoot(evidenceDir: string): string {
  const normalized = evidenceDir.replaceAll('\\', '/').replace(/\/+$/, '');
  if (normalized.endsWith('/docs/generated') || normalized === 'docs/generated') {
    return dirname(dirname(evidenceDir));
  }
  if (basename(evidenceDir) === 'generated') return dirname(evidenceDir);
  return process.cwd();
}

function collectEvidence(
  dashboard: EvidenceDashboard,
  file: string,
  json: any,
  publicComparableRawEvidenceManifest?: PublicComparableRawEvidenceManifest,
  rawEvidenceReadiness?: RawEvidenceReadinessContext,
  publicComparableSupersession?: PublicComparableSupersessionContext,
  artifactRoot?: string,
): void {
  const name = basename(file, '.json');
  if (name.startsWith('DSXU_EVIDENCE_DASHBOARD_')) return;
  const date = extractDate(name) ?? new Date().toISOString().slice(0, 10);
  const publicComparableManifest = isPublicComparableBenchmarkManifest(json);
  let publicComparableGateStatus: GateStatus | undefined;
  if (publicComparableManifest) {
    const readiness = buildPublicComparableRawEvidenceReadiness({
      manifest: json,
      rawEvidenceManifest: publicComparableRawEvidenceManifest,
      artifactRoot,
    });
    publicComparableGateStatus = readiness.publicBenchmarkClaimAllowed ? 'PASS' : 'INFO';
    dashboard.publicComparableReadiness.push({
      name,
      status: readiness.publicBenchmarkClaimAllowed ? 'PASS' : 'CLAIM_BLOCKED',
      caseCount: readiness.caseCount,
      readyCaseCount: readiness.readyCaseCount,
      missingCaseCount: readiness.missingCaseCount,
      publicBenchmarkClaimAllowed: readiness.publicBenchmarkClaimAllowed,
      externalComparisonClaimAllowed: readiness.externalComparisonClaimAllowed,
      nextAction: readiness.nextAction,
      evidenceFile: file,
    });
  }
  const inferredStatus = inferGateStatus(json);
  const legacySweBenchStatus: GateStatus = ['FAIL', 'BLOCKED', 'CLAIM_BLOCKED'].includes(inferredStatus)
    ? inferredStatus
    : 'INFO';
  const status = isSupersededTargetRawGap(name, json, rawEvidenceReadiness)
    ? 'INFO'
    : isSupersededPublicComparableRawImportReport(name, json, publicComparableSupersession)
      ? 'INFO'
    : isSupersededPublicComparableDsxuLane(name, json, publicComparableSupersession)
      ? 'INFO'
    : publicComparableGateStatus ?? (isLegacySweBenchClaim(name, json) ? legacySweBenchStatus : inferredStatus);

  dashboard.gates.push({
    name,
    status,
    lastRun: date,
    evidenceFile: file,
  });
  collectEvidenceCoverage(dashboard, name, file, json);
  collectFailureAttributions(dashboard, name, file, json);
  collectCommandCatalog(dashboard, file, json);
  collectV4ConsolidationStatus(dashboard, file, json);

  const passRate = isBenchmarkEvidenceAllowed(name, json) ? inferPassRate(json) : undefined;
  const sampleCount = inferSampleCount(json);
  if (passRate !== undefined) {
    dashboard.benchmarkResults.push({
      name,
      passRate,
      sampleCount,
      date,
    });
    dashboard.trajectory.push({ date, metric: `${name}.passRate`, value: passRate });
  }

  const scoreFloor = numeric(json.scoreFloor ?? json.score_floor);
  if (scoreFloor !== undefined) {
    dashboard.trajectory.push({ date, metric: `${name}.scoreFloor`, value: scoreFloor });
    dashboard.scoreFloor = dashboard.scoreFloor === null
      ? scoreFloor
      : Math.min(dashboard.scoreFloor, scoreFloor);
  }

  const beforeUsd = numeric(json.beforeUsd ?? json.before_usd ?? json.costBeforeUsd);
  const afterUsd = numeric(json.afterUsd ?? json.after_usd ?? json.costAfterUsd);
  if (beforeUsd !== undefined) dashboard.costMetrics.beforeUsd += beforeUsd;
  if (afterUsd !== undefined) dashboard.costMetrics.afterUsd += afterUsd;
}

function collectCommandCatalog(dashboard: EvidenceDashboard, file: string, json: any): void {
  if (json?.schemaVersion !== 'dsxu.command-catalog.v1') return;
  dashboard.commandCatalog = {
    scriptCount: numeric(json.scriptCount) ?? 0,
    mainlineAliases: asArray(json.mainlineAliases).map(String),
    categorySummary: typeof json.categorySummary === 'object' && json.categorySummary !== null
      ? Object.fromEntries(Object.entries(json.categorySummary).map(([key, value]) => [key, numeric(value) ?? 0]))
      : {},
    evidenceFile: file,
  };
}

function collectV4ConsolidationStatus(dashboard: EvidenceDashboard, file: string, json: any): void {
  if (json?.schemaVersion !== 'dsxu.v4.consolidation-status.v1') return;
  const expectedStages = asArray(json.expectedStages).map(String);
  const completedStages = new Set(asArray(json.completedStages).map(String));
  const hardBlockerClosure = json.v4HardBlockerClosure ?? {};
  const hardBlockerTotal = Number(hardBlockerClosure.total ?? 0);
  const hardBlockerClosedCount = Number(hardBlockerClosure.closed ?? 0);
  const remainingLaunchBlockers = asArray(hardBlockerClosure.remainingItems).map(String);
  const launchAcceptanceStatus = String(json.launchAcceptanceStatus ?? hardBlockerClosure.status ?? '');
  const launchAcceptanceBlocked =
    launchAcceptanceStatus.toUpperCase().includes('PARTIAL') ||
    (hardBlockerTotal > 0 && hardBlockerClosedCount < hardBlockerTotal) ||
    remainingLaunchBlockers.length > 0;
  const stageStatuses = asArray(json.stages).map(stage => ({
    stage: String(stage?.stage ?? 'unknown'),
    status: String(stage?.status ?? 'unknown'),
    owner: String(stage?.owner ?? 'unknown owner'),
    evidenceFiles: asArray(stage?.evidenceFiles).map(String),
  }));
  const blockedStages = stageStatuses
    .filter(stage => !['DONE', 'PASS'].includes(stage.status.toUpperCase()))
    .map(stage => stage.stage);
  const missingStages = expectedStages.filter(stage => !completedStages.has(stage));
  const effectiveBlockedStages = [
    ...blockedStages,
    ...(launchAcceptanceBlocked ? ['launch-acceptance'] : []),
  ];
  dashboard.v4Consolidation = {
    status: missingStages.length === 0 && effectiveBlockedStages.length === 0 ? 'PASS' : 'BLOCKED',
    completedStageCount: completedStages.size,
    expectedStageCount: expectedStages.length,
    missingStages,
    blockedStages: effectiveBlockedStages,
    launchAcceptanceStatus,
    hardBlockerClosedCount,
    hardBlockerTotal,
    remainingLaunchBlockers,
    stageStatuses,
    releaseClaimBoundary: String(
      json.releaseClaimBoundary ??
      json.publicReleaseClaimBoundary ??
      'V4 consolidation is owner-folded engineering evidence, not a public benchmark or score-floor claim.',
    ),
    evidenceFile: file,
  };
}

function collectFailureAttributions(dashboard: EvidenceDashboard, name: string, file: string, json: any): void {
  const rows = [
    ...asArray(json.failedCommandAttributions),
    ...asArray(json.failureAttribution),
  ];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    dashboard.failureAttributions.push({
      source: name,
      id: String(row.id ?? row.commandId ?? 'unknown'),
      owner: String(row.owner ?? 'unknown owner'),
      rootCause: String(row.rootCause ?? row.reason ?? 'unknown'),
      nextAction: String(row.nextAction ?? 'inspect source evidence'),
      timedOut: row.timedOut === true,
      evidenceFile: file,
    });
  }
}

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function inferGateStatus(json: any): GateStatus {
  const status = statusCandidates(json)
    .filter(value => typeof value === 'string' && value.trim().length > 0)
    .map(value => value.toUpperCase())
    .find(Boolean) ?? '';
  if (isPublicComparableRawEvidenceImportReport(json)) return status === 'PASS' ? 'PASS' : 'CLAIM_BLOCKED';
  if (isClaimBoundaryStatus(status)) return 'CLAIM_BLOCKED';
  if (status.includes('TARGET_RAW_STILL_EXTERNAL')) return 'CLAIM_BLOCKED';
  if (status.includes('LIVE_INPUT_REQUIRED')) return 'BLOCKED';
  if (status.includes('DELIVERY_PARTIAL') || status.includes('PARTIAL')) return 'BLOCKED';
  if (
    status === 'PASS' ||
    status === 'OK' ||
    status === 'SUCCESS' ||
    status.startsWith('DONE_') ||
    status.startsWith('PASS_') ||
    status.endsWith('_PASS')
  ) return 'PASS';
  if (status.startsWith('READY_') || status.startsWith('READY_FOR_') || status.endsWith('_READY')) return 'INFO';
  if (
    status === 'FAIL' ||
    status === 'FAILED' ||
    status === 'CRASH' ||
    status.startsWith('FAIL_') ||
    status.endsWith('_FAIL')
  ) return 'FAIL';
  if (status === 'BLOCKED' || status.startsWith('BLOCKED_')) return 'BLOCKED';
  if (json.passed === true || json.pass === true) return 'PASS';
  if (json.passed === false || json.pass === false) return 'FAIL';
  const hardGateStatus = inferHardGateStatus(json);
  if (hardGateStatus) return hardGateStatus;
  const commandRunStatus = inferCommandRunStatus(json);
  if (commandRunStatus) return commandRunStatus;
  const scenarioStatus = inferScenarioStatus(json);
  if (scenarioStatus) return scenarioStatus;
  if (
    numeric(json.expectedScoreMatchedCount) !== undefined &&
    numeric(json.expectedScoreMismatchedCount) === 0
  ) return 'PASS';

  const passRate = inferPassRate(json);
  if (passRate !== undefined) return passRate >= 0.8 ? 'PASS' : 'FAIL';
  if (isInformationalEvidence(json)) return 'INFO';
  return 'NOT_RUN';
}

function isClaimBoundaryStatus(status: string): boolean {
  return status.includes('BLOCKED_FOR_PUBLIC_95_RELEASE_CLAIM') ||
    status.includes('BLOCKED_PUBLIC_COMPARABLE_EVIDENCE') ||
    status.includes('PUBLIC_COMPARABLE_EVIDENCE_BLOCKED') ||
    status.includes('EXTERNAL_COMPARISON_CLAIM_BLOCKED');
}

function isSupersededTargetRawGap(
  name: string,
  json: any,
  rawEvidenceReadiness: RawEvidenceReadinessContext | undefined,
): boolean {
  if (!rawEvidenceReadiness?.p12Pass) return false;
  const status = statusCandidates(json)
    .filter(value => typeof value === 'string' && value.trim().length > 0)
    .map(value => value.toUpperCase())
    .find(Boolean) ?? '';
  return name.startsWith('DSXU_V20_REAL_GAP_ACCEPTANCE_SUMMARY_') &&
    status.includes('TARGET_RAW_STILL_EXTERNAL');
}

function isSupersededPublicComparableDsxuLane(
  name: string,
  json: any,
  publicComparableSupersession: PublicComparableSupersessionContext | undefined,
): boolean {
  if (!publicComparableSupersession?.rawEvidenceReady) return false;
  if (!name.startsWith('DSXU_PUBLIC_COMPARABLE_DSXU_LANE')) return false;
  const status = statusCandidates(json)
    .filter(value => typeof value === 'string' && value.trim().length > 0)
    .map(value => value.toUpperCase())
    .find(Boolean) ?? '';
  if (
    status === 'PASS' ||
    status === 'OK' ||
    status === 'SUCCESS' ||
    status.startsWith('PASS_') ||
    status.endsWith('_PASS')
  ) return false;
  return status.includes('PARTIAL') ||
    status.includes('BLOCKED') ||
    status === 'FAIL' ||
    status === 'FAILED' ||
    status.startsWith('FAIL_') ||
    status.endsWith('_FAIL');
}

function isSupersededPublicComparableRawImportReport(
  _name: string,
  json: any,
  publicComparableSupersession: PublicComparableSupersessionContext | undefined,
): boolean {
  if (!publicComparableSupersession?.rawEvidenceReady) return false;
  if (!isPublicComparableRawEvidenceImportReport(json)) return false;
  const status = String(json.status ?? '').toUpperCase();
  const caseCount = numeric(json.caseCount) ?? 0;
  const readyCaseCount = numeric(json.readyCaseCount) ?? 0;
  const missingCaseCount = numeric(json.missingCaseCount) ?? 0;
  const isCurrentReadyImport = status === 'PASS' &&
    caseCount > 0 &&
    readyCaseCount >= caseCount &&
    missingCaseCount === 0 &&
    json.publicBenchmarkClaimAllowed === true;
  if (isCurrentReadyImport) return false;
  return caseCount <= publicComparableSupersession.caseCount &&
    readyCaseCount < publicComparableSupersession.readyCaseCount;
}

function statusCandidates(json: any): unknown[] {
  return [
    json?.status,
    json?.verdict,
    json?.summary?.status,
    json?.review?.status,
    json?.validation?.status,
    json?.result?.status,
    json?.report?.status,
  ];
}

function inferHardGateStatus(json: any): GateStatus | undefined {
  if (!json?.hardGates || typeof json.hardGates !== 'object' || Array.isArray(json.hardGates)) return undefined;
  const values = Object.values(json.hardGates);
  if (values.length === 0 || !values.every(value => typeof value === 'boolean')) return undefined;
  return values.every(Boolean) ? 'PASS' : 'FAIL';
}

function inferCommandRunStatus(json: any): GateStatus | undefined {
  const commandRuns = Array.isArray(json?.commandRuns) ? json.commandRuns : [];
  if (commandRuns.length > 0 && commandRuns.every(run => numeric(run?.exitCode) === 0)) {
    const coverage = json.coverage;
    if (!coverage || numeric(coverage.openRows) === 0 || numeric(coverage.passedRows) === numeric(coverage.totalRows)) {
      return 'PASS';
    }
  }
  return undefined;
}

function inferScenarioStatus(json: any): GateStatus | undefined {
  const scenarios = Array.isArray(json?.scenarios) ? json.scenarios : [];
  if (scenarios.length === 0) return undefined;
  const hasFailure = scenarios.some(scenario =>
    scenario?.ok === false ||
    String(scenario?.status ?? '').toUpperCase().startsWith('FAIL') ||
    (Array.isArray(scenario?.blockers) && scenario.blockers.length > 0),
  );
  return hasFailure ? 'FAIL' : 'PASS';
}

function isInformationalEvidence(json: any): boolean {
  if (Array.isArray(json)) return true;
  if (!json || typeof json !== 'object') return false;
  if (typeof json.schemaVersion === 'string') return true;
  if (typeof json.schema === 'string') return true;
  if (typeof json.summary?.schemaVersion === 'string') return true;
  if (typeof json.review?.schemaVersion === 'string') return true;
  if (Object.entries(json).some(([key, value]) => key.endsWith('Summary') && Array.isArray(value))) return true;
  if (typeof json.generatedAt === 'string' && typeof json.nextAction === 'string') return true;
  if (typeof json.generatedAt === 'string' && (
    Array.isArray(json.rows) ||
    Array.isArray(json.items) ||
    Array.isArray(json.cases) ||
    Array.isArray(json.stages)
  )) return true;
  return false;
}

function isPublicComparableRawEvidenceImportReport(json: any): boolean {
  return json?.schemaVersion === 'dsxu.public-comparable-raw-evidence-import-report.v1';
}

function isBenchmarkEvidenceAllowed(name: string, json: any): boolean {
  if (isLegacySweBenchClaim(name, json)) return false;
  if (isPublicComparableBenchmarkManifest(json)) return false;
  if (!name.startsWith('DSXU_SWE_BENCH_RESULTS_')) return true;
  return json.publicBenchmarkClaimAllowed === true && json.mode === 'real-benchmark';
}

function isLegacySweBenchClaim(name: string, json: any): boolean {
  return name.startsWith('DSXU_SWE_BENCH_RESULTS_') &&
    !(json.publicBenchmarkClaimAllowed === true && json.mode === 'real-benchmark');
}

function isPublicComparableBenchmarkManifest(json: any): json is PublicComparableBenchmarkManifest {
  return json?.schemaVersion === 'dsxu.public-comparable-benchmark-manifest.v1';
}

function isPublicComparableRawEvidenceManifest(json: any): json is PublicComparableRawEvidenceManifest {
  return json?.schemaVersion === 'dsxu.public-comparable-raw-evidence.v1';
}

function inferPassRate(json: any): number | undefined {
  const raw = numeric(json.passRate ?? json.pass_at_1 ?? json.passAt1);
  if (raw !== undefined) return raw > 1 ? raw / 100 : raw;

  const total = numeric(json.total ?? json.totalTasks ?? json.sampleCount);
  const pass = numeric(json.pass ?? json.passedTasks ?? json.passed);
  if (total && pass !== undefined) return pass / total;
  return undefined;
}

function inferSampleCount(json: any): number {
  return numeric(json.total ?? json.totalTasks ?? json.sampleCount ?? json.records?.length) ?? 0;
}

function inferCostMetrics(
  current: EvidenceDashboard['costMetrics'],
  fileCount: number,
): EvidenceDashboard['costMetrics'] {
  if (current.beforeUsd > 0 && current.afterUsd > 0) {
    const reduction = 1 - current.afterUsd / current.beforeUsd;
    return { ...current, reduction: `${(reduction * 100).toFixed(1)}%` };
  }
  return {
    beforeUsd: current.beforeUsd,
    afterUsd: current.afterUsd,
    reduction: fileCount > 0 ? 'evidence-only' : '0%',
  };
}

async function listJsonFiles(evidenceDir: string): Promise<string[]> {
  try {
    const entries = await readdir(evidenceDir, { withFileTypes: true });
    return entries
      .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
      .map(entry => join(evidenceDir, entry.name));
  } catch {
    return [];
  }
}

function extractDate(name: string): string | undefined {
  const match = name.match(/(20\d{6})/);
  if (!match) return undefined;
  const raw = match[1];
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

function numeric(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function createDashboardOutputPath(date = new Date()): string {
  const stamp = date.toISOString().slice(0, 10).replaceAll('-', '');
  return join('docs', 'generated', `DSXU_EVIDENCE_DASHBOARD_${stamp}.json`);
}

if (import.meta.main) {
  const dashboard = await aggregateEvidence();
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(dashboard, null, 2));
  } else {
    console.log(formatDashboardCliSummary(dashboard));
  }
}

function formatDashboardCliSummary(dashboard: EvidenceDashboard): string {
  const actionLines = dashboard.workbench.actionItems
    .slice(0, 3)
    .map(item => `- ${item.priority} ${item.owner}: ${item.reason}${item.command ? ` (${item.command})` : ''}`);
  const dataLines = dashboard.releaseTrustPanel.dataStillNeeded
    .slice(0, 4)
    .map(item => `- ${item}`);
  return [
    'DSXU Evidence Workbench',
    `scoreFloor=${dashboard.scoreFloor ?? 'not-explicit'} trust=${dashboard.workbench.trustState} releaseClaimAllowed=${dashboard.workbench.releaseClaimAllowed}`,
    `gates: pass=${dashboard.gateSummary.pass} fail=${dashboard.gateSummary.fail} blocked=${dashboard.gateSummary.blocked} claimBlocked=${dashboard.gateSummary.claimBlocked} notRun=${dashboard.gateSummary.notRun} info=${dashboard.gateSummary.info} parseErrors=${dashboard.parseErrors.length}`,
    dashboard.v4Consolidation
      ? `v4Consolidation=${dashboard.v4Consolidation.status} completed=${dashboard.v4Consolidation.completedStageCount}/${dashboard.v4Consolidation.expectedStageCount} launch=${dashboard.v4Consolidation.hardBlockerClosedCount ?? 0}/${dashboard.v4Consolidation.hardBlockerTotal ?? 0} missing=${dashboard.v4Consolidation.missingStages.join(',') || 'none'} blocked=${dashboard.v4Consolidation.blockedStages.join(',') || 'none'}`
      : 'v4Consolidation=not-collected',
    `coverage: sourceTest=${dashboard.evidenceCoverage.sourceTest.ready} live=${dashboard.evidenceCoverage.live.ready} raw=${dashboard.evidenceCoverage.raw.ready} cost=${dashboard.evidenceCoverage.cost.ready} cache=${dashboard.evidenceCoverage.cache.ready}`,
    `publicComparableMissingCases=${dashboard.releaseTrustPanel.publicComparableMissingCases}`,
    actionLines.length > 0 ? 'actionItems:' : 'actionItems: none',
    ...actionLines,
    dataLines.length > 0 ? 'dataStillNeeded:' : 'dataStillNeeded: none',
    ...dataLines,
    `json: ${createDashboardOutputPath()}`,
    'Use --json to print the full dashboard.',
  ].join('\n');
}
