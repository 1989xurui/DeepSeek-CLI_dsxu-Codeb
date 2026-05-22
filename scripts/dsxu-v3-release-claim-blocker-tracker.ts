#!/usr/bin/env bun

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

type TrackerStatus = 'READY_RELEASE_CLAIM_BLOCKER_TRACKER'

type TrackerOptions = {
  root?: string
  dashboardPath?: string
  rawImportReportPath?: string
  p12ReadinessPath?: string
  launchPackPath?: string
  outputJsonPath?: string
  outputMdPath?: string
}

type MissingTargetCase = {
  id: string
  caseDir: string
  missingExternalTargetFields: readonly string[]
}

type ReleaseClaimBlockerTracker = {
  schemaVersion: 'dsxu.v3.release-claim-blocker-tracker.v1'
  generatedAt: string
  status: TrackerStatus
  dashboard: {
    trustState: string
    gateSummary: Record<string, unknown>
    publicComparableMissingCases: number
    externalComparisonPendingCount: number
    claimBlockedGateNames: readonly string[]
  }
  p12RawReadiness: {
    status: string
    p12Status: string
    deferredEvalStatus: string
    pairedRawLogCount: number
    minimumPairedRawLogsForPass: number
    note: string
  }
  publicComparableExternalComparison: {
    caseCount: number
    rawRoot: string
    rawManifestPath: string
    publicBenchmarkClaimAllowed: boolean
    externalComparisonClaimAllowed: boolean
    externalTargetReadyCount: number
    missingTargetReferenceCaseCount: number
    requiredPerCaseFileCandidates: readonly string[]
    missingTargetCases: readonly MissingTargetCase[]
  }
  public95ClaimBoundary: {
    actualScoreClaimAllowed: boolean
    actualScorePublicWording: string
    public95ClaimAllowed: boolean
    scoreFloor: number | null
    status: string
    blockedReason: string
  }
  nextActions: readonly string[]
  safeguards: readonly string[]
}

const DATE = '20260521'
const TARGET_REFERENCE_CANDIDATES = [
  'target-reference-transcript.jsonl',
  'target-reference.raw.jsonl',
  'target.raw.jsonl',
  'reference-transcript.jsonl',
] as const

export async function buildReleaseClaimBlockerTracker(
  options: TrackerOptions = {},
): Promise<ReleaseClaimBlockerTracker> {
  const root = resolve(options.root ?? process.cwd())
  const dashboardPath = resolve(root, options.dashboardPath ?? `docs/generated/DSXU_EVIDENCE_DASHBOARD_${DATE}.json`)
  const rawImportReportPath = resolve(root, options.rawImportReportPath ?? 'docs/generated/DSXU_PUBLIC_COMPARABLE_RAW_EVIDENCE_IMPORT_REPORT_20260520.json')
  const p12ReadinessPath = resolve(root, options.p12ReadinessPath ?? '.dsxu/trace/raw-evidence-readiness-register-v1/raw-evidence-readiness-register.evidence.json')
  const launchPackPath = resolve(root, options.launchPackPath ?? 'docs/generated/DSXU_V24_GITHUB_OPEN_SOURCE_LAUNCH_PACK_20260515.json')

  const dashboard = asRecord(await readJson(dashboardPath), 'dashboard')
  const rawReport = asRecord(await readJson(rawImportReportPath), 'raw import report')
  const p12 = asRecord(await readJson(p12ReadinessPath), 'p12 readiness')
  const launch = asRecord(await readJson(launchPackPath), 'launch pack')

  const rawCases = Array.isArray(rawReport.cases) ? rawReport.cases.filter(isRecord) : []
  const missingTargetCases: MissingTargetCase[] = rawCases
    .map(item => {
      const missing = Array.isArray(item.missingExternalTargetFields)
        ? item.missingExternalTargetFields.filter(value => typeof value === 'string')
        : []
      return {
        id: stringValue(item.id, 'unknown-case'),
        caseDir: stringValue(item.caseDir, ''),
        missingExternalTargetFields: missing,
      }
    })
    .filter(item => item.missingExternalTargetFields.length > 0)

  const gateSummary = isRecord(dashboard.gateSummary) ? dashboard.gateSummary : {}
  const gates = Array.isArray(dashboard.gates) ? dashboard.gates.filter(isRecord) : []
  const claimBlockedGateNames = gates
    .filter(gate => gate.status === 'CLAIM_BLOCKED')
    .map(gate => stringValue(gate.name, 'unknown-gate'))
    .sort()

  const launchMetrics = isRecord(launch.metrics) ? launch.metrics : {}
  const scoreFloor = typeof launchMetrics.scoreFloor === 'number' ? launchMetrics.scoreFloor : null

  return {
    schemaVersion: 'dsxu.v3.release-claim-blocker-tracker.v1',
    generatedAt: new Date().toISOString(),
    status: 'READY_RELEASE_CLAIM_BLOCKER_TRACKER',
    dashboard: {
      trustState: dashboardTrustState(dashboard),
      gateSummary,
      publicComparableMissingCases: numberValue(dashboard.publicComparableMissingCases),
      externalComparisonPendingCount: countExternalComparisonPending(dashboard),
      claimBlockedGateNames,
    },
    p12RawReadiness: {
      status: stringValue(p12.status, 'unknown'),
      p12Status: stringValue(p12.p12Status, 'unknown'),
      deferredEvalStatus: stringValue(p12.deferredEvalStatus, 'unknown'),
      pairedRawLogCount: numberValue(p12.p12PairedRawLogCount),
      minimumPairedRawLogsForPass: numberValue(p12.p12MinimumPairedRawLogsForPass),
      note: 'P12 target/reference readiness is closed only for the P12 raw-readiness lane; it is not a substitute for public-comparable same-case targetReferenceTranscriptPath evidence.',
    },
    publicComparableExternalComparison: {
      caseCount: numberValue(rawReport.caseCount),
      rawRoot: stringValue(rawReport.rawRoot, ''),
      rawManifestPath: stringValue(rawReport.rawManifestPath, ''),
      publicBenchmarkClaimAllowed: rawReport.publicBenchmarkClaimAllowed === true,
      externalComparisonClaimAllowed: rawReport.externalComparisonClaimAllowed === true,
      externalTargetReadyCount: numberValue(rawReport.externalTargetReadyCount),
      missingTargetReferenceCaseCount: missingTargetCases.length,
      requiredPerCaseFileCandidates: TARGET_REFERENCE_CANDIDATES,
      missingTargetCases,
    },
    public95ClaimBoundary: {
      actualScoreClaimAllowed: launch.actualScoreClaimAllowed === true,
      actualScorePublicWording: stringValue(launch.actualScorePublicWording, ''),
      public95ClaimAllowed: launch.public95ClaimAllowed === true,
      scoreFloor,
      status: stringValue(launch.status, 'unknown'),
      blockedReason: launch.public95ClaimAllowed === true
        ? ''
        : launch.actualScoreClaimAllowed === true
          ? 'actual score wording is allowed; keep 90/95/superiority claims disabled until the higher threshold and external evidence pass.'
          : 'scoreFloor remains below public 95 claim threshold; keep 90/95/superiority claims disabled.',
    },
    nextActions: [
      `Collect same-case external target/reference transcript files for ${missingTargetCases.length} public-comparable case(s).`,
      'Place each target/reference transcript in the matching caseDir using one of the requiredPerCaseFileCandidates names.',
      'Rerun: bun run evidence:public-comparable-raw',
      'Rerun: bun run release:github-launch-pack && bun run evidence:dashboard',
      'Do not fabricate target/reference logs and do not convert DSXU/raw-API evidence into target/reference evidence.',
    ],
    safeguards: [
      'This tracker is a release-claim blocker tracker, not runtime evidence and not a score source.',
      'P12 readiness can close P12 raw-readiness but cannot unlock public-comparable external comparison without same-case targetReferenceTranscriptPath evidence.',
      'A PASS public-comparable raw import permits DSXU/raw-API evidence claims only; external comparison requires target/reference evidence.',
      'Actual score wording is allowed only when actualScoreClaimAllowed=true; do not round scoreFloor upward.',
      'Public 90/95/superiority claims stay blocked while scoreFloor and external comparison boundaries are not satisfied.',
    ],
  }
}

export async function writeReleaseClaimBlockerTracker(
  options: TrackerOptions = {},
): Promise<ReleaseClaimBlockerTracker> {
  const root = resolve(options.root ?? process.cwd())
  const outputJsonPath = resolve(root, options.outputJsonPath ?? `docs/generated/DSXU_V3_RELEASE_CLAIM_BLOCKER_TRACKER_${DATE}.json`)
  const outputMdPath = resolve(root, options.outputMdPath ?? `docs/DSXU_V3_RELEASE_CLAIM_BLOCKER_TRACKER_${DATE}_CN.md`)
  const tracker = await buildReleaseClaimBlockerTracker({ ...options, root })
  await writeJson(outputJsonPath, tracker)
  await writeText(outputMdPath, renderMarkdown(tracker))
  return tracker
}

function renderMarkdown(tracker: ReleaseClaimBlockerTracker): string {
  const summary = tracker.dashboard.gateSummary as { pass?: unknown; fail?: unknown; blocked?: unknown; claimBlocked?: unknown; info?: unknown }
  const rows = tracker.publicComparableExternalComparison.missingTargetCases.map(item =>
    `| ${item.id} | \`${item.caseDir}\` | ${item.missingExternalTargetFields.join(', ')} |`,
  )
  return [
    '# DSXU V3 Release Claim Blocker Tracker - 2026-05-21',
    '',
    '## Status',
    '',
    `\`${tracker.status}\``,
    '',
    '## Current Dashboard',
    '',
    '| Metric | Value |',
    '| --- | --- |',
    `| trustState | ${tracker.dashboard.trustState} |`,
    `| pass/fail/blocked/claimBlocked/info | ${summary.pass ?? 0}/${summary.fail ?? 0}/${summary.blocked ?? 0}/${summary.claimBlocked ?? 0}/${summary.info ?? 0} |`,
    `| publicComparableMissingCases | ${tracker.dashboard.publicComparableMissingCases} |`,
    `| externalComparisonPendingCount | ${tracker.dashboard.externalComparisonPendingCount} |`,
    `| claimBlockedGateNames | ${tracker.dashboard.claimBlockedGateNames.join(', ') || 'none'} |`,
    '',
    '## Closed Evidence',
    '',
    `P12 target/reference readiness is ${tracker.p12RawReadiness.status}: p12Status=${tracker.p12RawReadiness.p12Status}, pairedRawLogCount=${tracker.p12RawReadiness.pairedRawLogCount}/${tracker.p12RawReadiness.minimumPairedRawLogsForPass}.`,
    '',
    tracker.p12RawReadiness.note,
    '',
    '## Remaining Public-Comparable External Target Evidence',
    '',
    `Current rawRoot: \`${tracker.publicComparableExternalComparison.rawRoot}\``,
    '',
    '| Case | Case Dir | Missing External Target Fields |',
    '| --- | --- | --- |',
    ...(rows.length > 0 ? rows : ['| none | none | none |']),
    '',
    '## Public 95 Claim Boundary',
    '',
    '| Field | Value |',
    '| --- | --- |',
    `| actualScoreClaimAllowed | ${tracker.public95ClaimBoundary.actualScoreClaimAllowed} |`,
    `| actualScorePublicWording | ${tracker.public95ClaimBoundary.actualScorePublicWording || 'none'} |`,
    `| public95ClaimAllowed | ${tracker.public95ClaimBoundary.public95ClaimAllowed} |`,
    `| scoreFloor | ${tracker.public95ClaimBoundary.scoreFloor ?? 'unknown'} |`,
    `| status | ${tracker.public95ClaimBoundary.status} |`,
    `| blockedReason | ${tracker.public95ClaimBoundary.blockedReason || 'none'} |`,
    '',
    '## Next Actions',
    '',
    ...tracker.nextActions.map(item => `- ${item}`),
    '',
    '## Safeguards',
    '',
    ...tracker.safeguards.map(item => `- ${item}`),
    '',
  ].join('\n')
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, ''))
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function writeText(path: string, value: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, value, 'utf8')
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${label} must be an object`)
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback
}

function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function countExternalComparisonPending(dashboard: Record<string, unknown>): number {
  const workbench = isRecord(dashboard.workbench) ? dashboard.workbench : {}
  const panel = isRecord(dashboard.releaseTrustPanel) ? dashboard.releaseTrustPanel : {}
  const direct = numberValue(panel.externalComparisonPendingCount)
  if (direct > 0) return direct
  const workbenchDirect = numberValue(workbench.externalComparisonPendingCount)
  if (workbenchDirect > 0) return workbenchDirect
  const actionItems = Array.isArray(panel.actionItems) ? panel.actionItems.filter(isRecord) : []
  return actionItems.filter(item => {
    const reason = stringValue(item.reason, '')
    const nextAction = stringValue(item.nextAction, '')
    return reason.includes('target reference raw evidence') || nextAction.includes('target reference raw evidence')
  }).length
}

function dashboardTrustState(dashboard: Record<string, unknown>): string {
  const workbench = isRecord(dashboard.workbench) ? dashboard.workbench : {}
  return stringValue(
    dashboard.trustState,
    stringValue(workbench.trustState, stringValue(dashboard.trust, 'unknown')),
  )
}

async function main(): Promise<void> {
  const tracker = await writeReleaseClaimBlockerTracker()
  console.log(JSON.stringify({
    status: tracker.status,
    blocked: tracker.dashboard.gateSummary.blocked ?? 0,
    claimBlocked: tracker.dashboard.gateSummary.claimBlocked ?? 0,
    missingTargetReferenceCaseCount: tracker.publicComparableExternalComparison.missingTargetReferenceCaseCount,
    public95ClaimAllowed: tracker.public95ClaimBoundary.public95ClaimAllowed,
    actualScoreClaimAllowed: tracker.public95ClaimBoundary.actualScoreClaimAllowed,
    scoreFloor: tracker.public95ClaimBoundary.scoreFloor,
  }, null, 2))
}

if (import.meta.main) {
  main().catch(error => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error))
    process.exitCode = 1
  })
}
