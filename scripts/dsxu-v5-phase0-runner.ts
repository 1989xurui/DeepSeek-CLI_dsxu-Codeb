#!/usr/bin/env bun

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { buildCommandCatalog, type CommandCatalog, type OwnerFocusedVerificationGroup } from './dsxu-command-catalog';

export type V5Phase0SuiteId =
  | 'mainline'
  | 'experience'
  | 'release-gates'
  | 'claim-boundary'
  | 'replay-regression'
  | 'phase0';

export type V5Phase0Status =
  | 'PASS_V5_PHASE0_SUITE'
  | 'FAIL_V5_PHASE0_SUITE'
  | 'BLOCKED_V5_PHASE0_SUITE';

export interface V5Phase0CommandSpec {
  id: string;
  suite: V5Phase0SuiteId;
  owner: string;
  command: string;
  timeoutMs: number;
  liveProvider: boolean;
  claimBoundary: 'source-test-evidence-only' | 'live-required' | 'release-only' | 'claim-boundary' | 'replay-regression';
}

export interface V5Phase0Suite {
  id: V5Phase0SuiteId;
  owner: string;
  purpose: string;
  commands: V5Phase0CommandSpec[];
  deferredFullReleaseCommands?: string[];
  maxDurationMs?: number;
}

export interface V5Phase0CommandResult extends V5Phase0CommandSpec {
  exitCode: number | null;
  passed: boolean;
  timedOut: boolean;
  durationMs: number;
  stdoutPath: string;
  stderrPath: string;
  stdoutTail: string;
  stderrTail: string;
}

export interface V5ClaimBoundaryAssessment {
  status: 'PASS_CLAIM_BOUNDARY_HELD' | 'PASS_RELEASE_READY' | 'FAIL_CLAIM_BOUNDARY_UNKNOWN';
  scoreFloor?: number;
  releaseClaimAllowed?: boolean;
  releaseTrustStatus?: string;
  publicComparableMissingCases?: number;
  blockedGateNames: string[];
  dataStillNeeded: string[];
}

export interface V5ReplayRegressionAssessment {
  status: 'PASS_REPLAY_REGRESSION' | 'BLOCKED_REPLAY_REGRESSION';
  caseCount: number;
  passCount: number;
  failedCaseIds: string[];
  acceptedCount?: number;
  nativeV5ReadyCount?: number;
  requiredSubsetReady?: boolean;
  fullReleaseReady?: boolean;
  cacheHitRatePct?: number;
  totalCostUsd?: number;
  claimBoundary?: string;
  blockers?: string[];
}

export interface V5Phase0RunResult {
  schemaVersion: 'dsxu.v5.phase0.runner.v1';
  generatedAt: string;
  suite: V5Phase0SuiteId;
  status: V5Phase0Status;
  purpose: string;
  owner: string;
  commandCount: number;
  passedCommandCount: number;
  failedCommandCount: number;
  timedOutCommandCount: number;
  durationMs: number;
  maxDurationMs?: number;
  withinDurationBudget?: boolean;
  results: V5Phase0CommandResult[];
  claimBoundaryAssessment?: V5ClaimBoundaryAssessment;
  replayRegressionAssessment?: V5ReplayRegressionAssessment;
  blockers: string[];
  deferredFullReleaseCommands: string[];
  outputJson: string;
  outputMd: string;
  traceDir: string;
  rule: string;
}

const ROOT = process.cwd();
const GENERATED_DIR = join(ROOT, 'docs', 'generated');
const TRACE_ROOT = join(ROOT, '.dsxu', 'trace', 'v5-phase0');

function todayStamp(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'command';
}

function uniqueCommands(commands: V5Phase0CommandSpec[]): V5Phase0CommandSpec[] {
  const seen = new Set<string>();
  return commands.filter(command => {
    const key = `${command.suite}:${command.command}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function fromGroup(group: OwnerFocusedVerificationGroup, suite: V5Phase0SuiteId): V5Phase0CommandSpec[] {
  return group.commands.map((command, index) => ({
    id: `${group.groupId}-${index + 1}`,
    suite,
    owner: group.owner,
    command,
    timeoutMs: group.timeoutBudgetMs,
    liveProvider: group.liveProvider,
    claimBoundary: group.claimBoundary,
  }));
}

export function buildV5Phase0Suites(catalog: CommandCatalog): Record<V5Phase0SuiteId, V5Phase0Suite> {
  const mainlineGroups = catalog.ownerFocusedVerificationGroups.filter(group => group.testTier === 'mainline');
  const experienceGroups = catalog.ownerFocusedVerificationGroups.filter(group => group.testTier === 'acceptance');
  const releaseGroups = catalog.ownerFocusedVerificationGroups.filter(group => group.testTier === 'release-only');

  const mainlineCommands = uniqueCommands(mainlineGroups.flatMap(group => fromGroup(group, 'mainline')));
  const experienceCommands = uniqueCommands(experienceGroups.flatMap(group => fromGroup(group, 'experience')));
  const releaseGateCommands = uniqueCommands(releaseGroups.flatMap(group => fromGroup(group, 'release-gates')));
  const claimBoundaryCommands: V5Phase0CommandSpec[] = [
    {
      id: 'evidence-dashboard-claim-boundary',
      suite: 'claim-boundary',
      owner: 'Evidence / Release Claim Binder',
      command: 'bun run evidence:dashboard',
      timeoutMs: 180_000,
      liveProvider: false,
      claimBoundary: 'claim-boundary',
    },
  ];
  const replayRegressionCommands: V5Phase0CommandSpec[] = [
    {
      id: 'v5-strict-replay-bank-intake',
      suite: 'replay-regression',
      owner: 'Replay Bank / Evidence owner',
      command: 'bun run scripts/dsxu-v5-replay-bank.ts',
      timeoutMs: 180_000,
      liveProvider: false,
      claimBoundary: 'replay-regression',
    },
  ];

  const suites: Record<V5Phase0SuiteId, V5Phase0Suite> = {
    mainline: {
      id: 'mainline',
      owner: 'V5 Phase 0 / mainline focused owners',
      purpose: 'Fast owner-focused tests for default runtime, tool, permission, verification, recovery, and agent mainline.',
      commands: mainlineCommands,
      maxDurationMs: 60_000,
    },
    experience: {
      id: 'experience',
      owner: 'V5 Phase 0 / Trust UI and senior experience owners',
      purpose: 'Focused TUI and experience slices; avoids full senior-coding-window during normal development.',
      commands: experienceCommands,
      maxDurationMs: 180_000,
    },
    'release-gates': {
      id: 'release-gates',
      owner: 'V5 Phase 0 / Release evidence owners',
      purpose: 'Stage-level release gates and evidence dashboard checks; full six-stage verification is deferred to release candidate runs.',
      commands: releaseGateCommands,
      deferredFullReleaseCommands: ['bun run test:six-stage-final'],
      maxDurationMs: 180_000,
    },
    'claim-boundary': {
      id: 'claim-boundary',
      owner: 'Evidence / Release Claim Binder',
      purpose: 'Prove release-blocked, NOT_RUN, public-comparable, and score-floor boundaries are explicit.',
      commands: claimBoundaryCommands,
      maxDurationMs: 180_000,
    },
    'replay-regression': {
      id: 'replay-regression',
      owner: 'Replay Bank / Evidence owner',
      purpose: 'Promote failed real-task cases into V5 replay regression blockers instead of hiding them behind average pass rate.',
      commands: replayRegressionCommands,
      maxDurationMs: 180_000,
    },
    phase0: {
      id: 'phase0',
      owner: 'V5 Phase 0 / Carry-over closure owners',
      purpose: 'All low-cost Phase 0 suites except the full external public comparable gate.',
      commands: uniqueCommands([
        ...mainlineCommands,
        ...experienceCommands,
        ...releaseGateCommands,
        ...claimBoundaryCommands,
        ...replayRegressionCommands,
      ]).map(command => ({ ...command, suite: 'phase0' })),
      deferredFullReleaseCommands: ['bun run test:six-stage-final'],
      maxDurationMs: 600_000,
    },
  };

  return suites;
}

export function assessClaimBoundary(dashboard: any): V5ClaimBoundaryAssessment {
  const releaseTrustPanel = dashboard?.releaseTrustPanel ?? {};
  const blockedGateNames = Array.isArray(releaseTrustPanel.blockedGateNames)
    ? releaseTrustPanel.blockedGateNames.map(String)
    : [];
  const dataStillNeeded = Array.isArray(releaseTrustPanel.dataStillNeeded)
    ? releaseTrustPanel.dataStillNeeded.map(String)
    : [];
  const releaseClaimAllowed = Boolean(dashboard?.workbench?.releaseClaimAllowed ?? releaseTrustPanel.releaseClaimAllowed);
  const releaseTrustStatus = typeof releaseTrustPanel.status === 'string' ? releaseTrustPanel.status : undefined;

  if (releaseClaimAllowed || releaseTrustStatus === 'ready-for-release-review') {
    return {
      status: 'PASS_RELEASE_READY',
      scoreFloor: typeof dashboard?.scoreFloor === 'number' ? dashboard.scoreFloor : undefined,
      releaseClaimAllowed,
      releaseTrustStatus,
      publicComparableMissingCases: typeof releaseTrustPanel.publicComparableMissingCases === 'number'
        ? releaseTrustPanel.publicComparableMissingCases
        : undefined,
      blockedGateNames,
      dataStillNeeded,
    };
  }

  if (releaseTrustStatus === 'blocked' || dataStillNeeded.length > 0 || blockedGateNames.length > 0) {
    return {
      status: 'PASS_CLAIM_BOUNDARY_HELD',
      scoreFloor: typeof dashboard?.scoreFloor === 'number' ? dashboard.scoreFloor : undefined,
      releaseClaimAllowed,
      releaseTrustStatus,
      publicComparableMissingCases: typeof releaseTrustPanel.publicComparableMissingCases === 'number'
        ? releaseTrustPanel.publicComparableMissingCases
        : undefined,
      blockedGateNames,
      dataStillNeeded,
    };
  }

  return {
    status: 'FAIL_CLAIM_BOUNDARY_UNKNOWN',
    scoreFloor: typeof dashboard?.scoreFloor === 'number' ? dashboard.scoreFloor : undefined,
    releaseClaimAllowed,
    releaseTrustStatus,
    publicComparableMissingCases: typeof releaseTrustPanel.publicComparableMissingCases === 'number'
      ? releaseTrustPanel.publicComparableMissingCases
      : undefined,
    blockedGateNames,
    dataStillNeeded,
  };
}

export function assessReplayPack(pack: any): V5ReplayRegressionAssessment {
  if (pack?.schemaVersion === 'dsxu.v5.replay-bank-intake.v1') {
    const audits = Array.isArray(pack?.audits) ? pack.audits : [];
    const bank = pack?.bank ?? {};
    const redlines = Array.isArray(bank?.redlines) ? bank.redlines.map(String) : [];
    const blockers = Array.isArray(pack?.blockers) ? pack.blockers.map(String) : [];
    const acceptedCount = typeof bank?.acceptedCount === 'number' ? bank.acceptedCount : 0;
    const caseCount = typeof bank?.caseCount === 'number'
      ? bank.caseCount
      : typeof pack?.sourceCaseCount === 'number'
        ? pack.sourceCaseCount
        : audits.length;
    const failedCaseIds = audits
      .filter((item: any) =>
        (Array.isArray(item?.missingStandardFields) && item.missingStandardFields.length > 0) ||
        (Array.isArray(item?.missingNativeFields) && item.missingNativeFields.length > 0)
      )
      .map((item: any) => String(item?.caseId ?? 'unknown-case'));
    const status =
      pack?.status === 'PASS_V5_REPLAY_BANK_REQUIRED_SUBSET' &&
      bank?.requiredSubsetReady === true &&
      blockers.length === 0 &&
      redlines.length === 0
        ? 'PASS_REPLAY_REGRESSION'
        : 'BLOCKED_REPLAY_REGRESSION';
    return {
      status,
      caseCount,
      passCount: acceptedCount,
      failedCaseIds,
      acceptedCount,
      nativeV5ReadyCount: typeof pack?.nativeV5ReadyCount === 'number'
        ? pack.nativeV5ReadyCount
        : undefined,
      requiredSubsetReady: Boolean(bank?.requiredSubsetReady),
      fullReleaseReady: Boolean(bank?.fullReleaseReady),
      claimBoundary: typeof pack?.claimBoundary === 'string' ? pack.claimBoundary : undefined,
      blockers: [...blockers, ...redlines],
    };
  }

  const cases = Array.isArray(pack?.cases) ? pack.cases : [];
  const failedCaseIds = cases
    .filter((item: any) => item?.finalPass !== true)
    .map((item: any) => String(item?.id ?? 'unknown-case'));

  return {
    status: failedCaseIds.length > 0 ? 'BLOCKED_REPLAY_REGRESSION' : 'PASS_REPLAY_REGRESSION',
    caseCount: typeof pack?.caseCount === 'number' ? pack.caseCount : cases.length,
    passCount: typeof pack?.passCount === 'number' ? pack.passCount : cases.length - failedCaseIds.length,
    failedCaseIds,
    cacheHitRatePct: typeof pack?.cacheHitRatePct === 'number' ? pack.cacheHitRatePct : undefined,
    totalCostUsd: typeof pack?.totalCostUsd === 'number' ? pack.totalCostUsd : undefined,
    claimBoundary: typeof pack?.claimBoundary === 'string' ? pack.claimBoundary : undefined,
  };
}

async function readJson(path: string): Promise<any> {
  return JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, ''));
}

async function latestGeneratedPath(prefix: string, fallbackFileName: string): Promise<string> {
  try {
    const files = await readdir(GENERATED_DIR);
    const matches = files
      .filter(file => file.startsWith(prefix) && file.endsWith('.json'))
      .sort();
    return join(GENERATED_DIR, matches.at(-1) ?? fallbackFileName);
  } catch {
    return join(GENERATED_DIR, fallbackFileName);
  }
}

async function runCommand(spec: V5Phase0CommandSpec, traceDir: string): Promise<V5Phase0CommandResult> {
  await mkdir(traceDir, { recursive: true });
  const startedAt = Date.now();
  const outBase = `${String(Date.now())}-${slug(spec.id)}-${slug(spec.command)}`;
  const stdoutPath = join(traceDir, `${outBase}.stdout.log`);
  const stderrPath = join(traceDir, `${outBase}.stderr.log`);
  const shellCommand = process.platform === 'win32'
    ? ['powershell', '-NoProfile', '-Command', spec.command]
    : ['bash', '-lc', spec.command];
  const proc = Bun.spawn(shellCommand, {
    cwd: ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
    env: process.env,
  });
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    proc.kill();
  }, spec.timeoutMs);
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]).finally(() => clearTimeout(timeout));
  const durationMs = Date.now() - startedAt;
  await writeFile(stdoutPath, stdout, 'utf8');
  await writeFile(stderrPath, stderr, 'utf8');

  return {
    ...spec,
    exitCode,
    passed: exitCode === 0 && !timedOut,
    timedOut,
    durationMs,
    stdoutPath: relativePath(stdoutPath),
    stderrPath: relativePath(stderrPath),
    stdoutTail: tail(stdout),
    stderrTail: tail(stderr),
  };
}

function tail(value: string, maxLines = 20): string {
  const lines = value.replace(/\r\n/g, '\n').split('\n');
  return lines.slice(Math.max(0, lines.length - maxLines)).join('\n').trim();
}

function relativePath(path: string): string {
  return path.startsWith(ROOT) ? path.slice(ROOT.length + 1).replace(/\\/g, '/') : path.replace(/\\/g, '/');
}

async function loadCatalog(): Promise<CommandCatalog> {
  const packageJson = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8')) as { scripts?: Record<string, string> };
  return buildCommandCatalog(packageJson.scripts ?? {});
}

async function runSuite(suiteId: V5Phase0SuiteId, generatedAt = new Date()): Promise<V5Phase0RunResult> {
  const catalog = await loadCatalog();
  const suites = buildV5Phase0Suites(catalog);
  const suite = suites[suiteId];
  if (!suite) throw new Error(`Unknown V5 Phase 0 suite: ${suiteId}`);

  const stamp = todayStamp(generatedAt);
  const traceDir = join(TRACE_ROOT, suite.id);
  const outputJson = join(GENERATED_DIR, `DSXU_V5_PHASE0_${suite.id.toUpperCase().replace(/-/g, '_')}_${stamp}.json`);
  const outputMd = join(ROOT, 'docs', `DSXU_V5_PHASE0_${suite.id.toUpperCase().replace(/-/g, '_')}_${stamp}.md`);
  await mkdir(dirname(outputJson), { recursive: true });
  await mkdir(dirname(outputMd), { recursive: true });

  const startedAt = Date.now();
  const results: V5Phase0CommandResult[] = [];
  for (const command of suite.commands) {
    results.push(await runCommand(command, traceDir));
  }

  let claimBoundaryAssessment: V5ClaimBoundaryAssessment | undefined;
  let replayRegressionAssessment: V5ReplayRegressionAssessment | undefined;
  const blockers: string[] = [];

  if (suite.id === 'claim-boundary' || suite.id === 'phase0') {
    try {
      const dashboard = await readJson(await latestGeneratedPath(
        'DSXU_EVIDENCE_DASHBOARD_',
        'DSXU_EVIDENCE_DASHBOARD_20260518.json',
      ));
      claimBoundaryAssessment = assessClaimBoundary(dashboard);
      if (claimBoundaryAssessment.status === 'FAIL_CLAIM_BOUNDARY_UNKNOWN') {
        blockers.push('claim-boundary dashboard state is ambiguous');
      }
    } catch (error) {
      blockers.push(`claim-boundary dashboard could not be read: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (suite.id === 'replay-regression' || suite.id === 'phase0') {
    try {
      const bank = await readJson(await latestGeneratedPath(
        'DSXU_V5_REPLAY_BANK_',
        'DSXU_V5_REPLAY_BANK_20260519.json',
      ));
      replayRegressionAssessment = assessReplayPack(bank);
      if (replayRegressionAssessment.status === 'BLOCKED_REPLAY_REGRESSION') {
        const details = replayRegressionAssessment.blockers?.slice(0, 3).join('; ') ||
          replayRegressionAssessment.failedCaseIds.slice(0, 6).join(', ');
        blockers.push(`V5 strict replay bank is blocked: ${details}`);
      }
    } catch (error) {
      blockers.push(`V5 strict replay bank could not be read: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const softBlockedReplayCommandIds = new Set(
    replayRegressionAssessment?.status === 'BLOCKED_REPLAY_REGRESSION'
      ? suite.commands
          .filter(command => command.claimBoundary === 'replay-regression')
          .map(command => command.id)
      : [],
  );
  const failedCommandCount = results.filter(result =>
    !result.passed &&
    !(softBlockedReplayCommandIds.has(result.id) && !result.timedOut)
  ).length;
  const timedOutCommandCount = results.filter(result => result.timedOut).length;
  const durationMs = Date.now() - startedAt;
  const withinDurationBudget = suite.maxDurationMs === undefined ? undefined : durationMs <= suite.maxDurationMs;
  if (withinDurationBudget === false) {
    blockers.push(`suite exceeded duration budget ${suite.maxDurationMs}ms with ${durationMs}ms`);
  }

  const status: V5Phase0Status = failedCommandCount > 0
    ? 'FAIL_V5_PHASE0_SUITE'
    : blockers.length > 0
      ? 'BLOCKED_V5_PHASE0_SUITE'
      : 'PASS_V5_PHASE0_SUITE';

  const output: V5Phase0RunResult = {
    schemaVersion: 'dsxu.v5.phase0.runner.v1',
    generatedAt: generatedAt.toISOString(),
    suite: suite.id,
    status,
    purpose: suite.purpose,
    owner: suite.owner,
    commandCount: results.length,
    passedCommandCount: results.filter(result => result.passed).length,
    failedCommandCount,
    timedOutCommandCount,
    durationMs,
    maxDurationMs: suite.maxDurationMs,
    withinDurationBudget,
    results,
    claimBoundaryAssessment,
    replayRegressionAssessment,
    blockers,
    deferredFullReleaseCommands: suite.deferredFullReleaseCommands ?? [],
    outputJson: relativePath(outputJson),
    outputMd: relativePath(outputMd),
    traceDir: relativePath(traceDir),
    rule: 'V5 Phase 0 only aggregates existing owner tests/evidence. It does not add a product runtime, provider, ToolBus, permission layer, agent layer, or public benchmark claim.',
  };

  await writeFile(outputJson, JSON.stringify(output, null, 2) + '\n', 'utf8');
  await writeFile(outputMd, renderMarkdown(output), 'utf8');
  return output;
}

function renderMarkdown(result: V5Phase0RunResult): string {
  return [
    `# DSXU V5 Phase 0 ${result.suite} - ${result.generatedAt.slice(0, 10)}`,
    '',
    `Status: ${result.status}`,
    '',
    `Owner: ${result.owner}`,
    '',
    `Purpose: ${result.purpose}`,
    '',
    '## Summary',
    '',
    `- commands: ${result.passedCommandCount}/${result.commandCount} passed`,
    `- timed out: ${result.timedOutCommandCount}`,
    `- durationMs: ${result.durationMs}`,
    `- withinDurationBudget: ${result.withinDurationBudget}`,
    '',
    '## Commands',
    '',
    '| id | owner | passed | timedOut | durationMs | command |',
    '| --- | --- | ---: | ---: | ---: | --- |',
    ...result.results.map(row =>
      `| ${row.id} | ${row.owner} | ${row.passed} | ${row.timedOut} | ${row.durationMs} | \`${row.command.replace(/\|/g, '/')} \` |`,
    ),
    '',
    '## Deferred Full Release Commands',
    '',
    ...(result.deferredFullReleaseCommands.length > 0
      ? result.deferredFullReleaseCommands.map(command => `- \`${command}\``)
      : ['- none']),
    '',
    '## Claim Boundary',
    '',
    result.claimBoundaryAssessment
      ? [
          `- status: ${result.claimBoundaryAssessment.status}`,
          `- scoreFloor: ${result.claimBoundaryAssessment.scoreFloor ?? 'unknown'}`,
          `- releaseClaimAllowed: ${result.claimBoundaryAssessment.releaseClaimAllowed}`,
          `- releaseTrustStatus: ${result.claimBoundaryAssessment.releaseTrustStatus ?? 'unknown'}`,
          `- publicComparableMissingCases: ${result.claimBoundaryAssessment.publicComparableMissingCases ?? 'unknown'}`,
          `- blockedGateNames: ${result.claimBoundaryAssessment.blockedGateNames.join(', ') || 'none'}`,
          `- dataStillNeeded: ${result.claimBoundaryAssessment.dataStillNeeded.join('; ') || 'none'}`,
        ].join('\n')
      : '- not assessed in this suite',
    '',
    '## Replay Regression',
    '',
    result.replayRegressionAssessment
      ? [
          `- status: ${result.replayRegressionAssessment.status}`,
          `- cases: ${result.replayRegressionAssessment.passCount}/${result.replayRegressionAssessment.caseCount} passed`,
          `- acceptedCount: ${result.replayRegressionAssessment.acceptedCount ?? 'unknown'}`,
          `- nativeV5ReadyCount: ${result.replayRegressionAssessment.nativeV5ReadyCount ?? 'unknown'}`,
          `- requiredSubsetReady: ${result.replayRegressionAssessment.requiredSubsetReady ?? 'unknown'}`,
          `- fullReleaseReady: ${result.replayRegressionAssessment.fullReleaseReady ?? 'unknown'}`,
          `- failedCaseIds: ${result.replayRegressionAssessment.failedCaseIds.join(', ') || 'none'}`,
          `- cacheHitRatePct: ${result.replayRegressionAssessment.cacheHitRatePct ?? 'unknown'}`,
          `- totalCostUsd: ${result.replayRegressionAssessment.totalCostUsd ?? 'unknown'}`,
          `- blockers: ${result.replayRegressionAssessment.blockers?.slice(0, 5).join('; ') || 'none'}`,
        ].join('\n')
      : '- not assessed in this suite',
    '',
    '## Blockers',
    '',
    ...(result.blockers.length > 0 ? result.blockers.map(blocker => `- ${blocker}`) : ['- none']),
    '',
    '## Rule',
    '',
    result.rule,
    '',
  ].join('\n');
}

function parseSuite(argv: string[]): V5Phase0SuiteId {
  const suiteIndex = argv.findIndex(arg => arg === '--suite');
  const value = suiteIndex >= 0 ? argv[suiteIndex + 1] : argv.find(arg => arg.startsWith('--suite='))?.split('=', 2)[1];
  const suite = (value ?? 'mainline') as V5Phase0SuiteId;
  const allowed: V5Phase0SuiteId[] = ['mainline', 'experience', 'release-gates', 'claim-boundary', 'replay-regression', 'phase0'];
  if (!allowed.includes(suite)) {
    throw new Error(`Unsupported --suite ${suite}. Expected one of: ${allowed.join(', ')}`);
  }
  return suite;
}

if (import.meta.main) {
  runSuite(parseSuite(process.argv.slice(2))).then(result => {
    console.log(JSON.stringify({
      status: result.status,
      suite: result.suite,
      passedCommandCount: result.passedCommandCount,
      commandCount: result.commandCount,
      blockers: result.blockers,
      outputJson: result.outputJson,
      outputMd: result.outputMd,
    }, null, 2));
    if (result.status !== 'PASS_V5_PHASE0_SUITE') process.exitCode = 1;
  }).catch(error => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  });
}
