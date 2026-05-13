import { existsSync, mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, test } from 'bun:test'
import { buildOwnerGitClosureBoard } from '../owner-git-closure-board-v1'
import type { P12RawLogManifest, P12RawTaskLog } from '../phase12-raw-comparison-v1'
import { runOwnerGitClosureBoardHarness } from '../../integration/harness/owner-git-closure-board-v1-harness'

const clearInput = {
  dirtyTotal: 0,
  trackedDirtyCount: 0,
  untrackedCount: 0,
  deletedCount: 0,
  unknownDirtyCount: 0,
  mainlineDirtyStatus: 'PASS' as const,
  mainlineDirtyNextAction: 'mainline-gate-closed',
  mainlineKeepOwnerSliceCount: 0,
  mainlineReviewBeforeKeepCount: 0,
  replaceDeleteCandidateCount: 0,
  replaceDeleteEvidenceVerifiedCount: 0,
  replaceDeleteMissingEvidenceCount: 0,
  pendingDeletionCount: 0,
  pendingDeletionStatus: 'PASS' as const,
  pendingDeletionSubSliceCount: 0,
  pendingDeletionVerifiedSubSliceCount: 0,
  pendingDeletionMissingEvidenceCount: 0,
  p12RawStatus: 'PASS' as const,
  p12PairedRawLogCount: 14,
  p12MinimumPairedRawLogsForPass: 14,
  p12RawNextAction: 'ready-for-delta-review',
  deferredEvalIds: [],
  deferredProductIds: [],
  localArtifactPolicyKnown: true,
  permissionBlockedResidualCount: 0,
  cleanExportReady: true,
  releaseClosureStatus: 'PASS' as const,
  canCreateCleanExport: true,
  destructiveActionRequested: false,
  evidencePaths: ['.dsxu/trace/owner-git-closure-board-v1/input.json'],
}

const replayTargets: readonly [string, string, string][] = [
  ['P12-19-RT-01', 'RT-01', 'baseline fail -> localization -> context pack -> patch repair -> verification -> final report'],
  ['P12-19-RT-01-additional-2', 'RT-01-additional-2', 'discounted total clamp bugfix -> failed baseline -> surgical patch -> focused regression verification -> final report'],
  ['P12-19-RT-01-additional-3', 'RT-01-additional-3', 'cart pricing regression repair -> localized source/test context -> patch repair -> two-test verification -> final report'],
  ['P12-19-RT-02-additional-1', 'RT-02-additional-1', 'implement hasTag normalized tag membership and verify with a new native Bun test'],
  ['P12-19-RT-02-additional-2', 'RT-02-additional-2', 'repair retryDelay behavior after failed verification and verify capped exponential delay with native tests'],
  ['P12-19-RT-03-additional-1', 'RT-03-additional-1', 'review normalizeLimit for a non-style runtime risk, patch the behavior, verify tests, and record review approval'],
  ['P12-19-RT-03-additional-2', 'RT-03-additional-2', 'review stableSlug for a non-style routing risk, patch the behavior, verify tests, and record review approval'],
  ['P12-19-RT-04', 'RT-04', 'shell state -> command plan -> artifact -> timeout/recovery -> verification pack'],
  ['P12-19-RT-04-additional-2', 'RT-04-additional-2', 'terminal reliability replay -> shell state capture -> artifact verification -> timeout guard -> result pack'],
  ['P12-19-RT-05-additional-1', 'RT-05-additional-1', 'dev-server browser proof with HTTP readiness, real screenshot artifact, timeout guard, and final report'],
  ['P12-19-RT-06-additional-1', 'RT-06-additional-1', 'package/build environment diagnosis with vendored tool checks, runtime probes, dependency boundaries, and final report'],
  ['P12-19-RT-07', 'RT-07', 'compact snapshot -> source reread -> edit -> focused verification without premature PASS'],
  ['P12-19-RT-07-additional-2', 'RT-07-additional-2', 'compact recovery replay -> source truth reread -> pending agent preservation -> focused verification -> honest final'],
  ['P12-19-RT-08', 'RT-08', 'worker evidence -> parent final gate -> honest partial handling'],
]

function makeTargetReferenceLog(
  [comparisonId, taskId, taskPrompt]: readonly [string, string, string],
): P12RawTaskLog {
  return {
    comparisonId,
    taskId,
    side: 'target-reference',
    taskPrompt,
    rawLogPath: `.dsxu/trace/p12-19/target-reference/${taskId}/raw.log`,
    artifactPaths: [`.dsxu/trace/p12-19/target-reference/${taskId}/final-report.md`],
    outcome: 'PASS',
    evidence: {
      baseline: true,
      context: true,
      execution: true,
      recovery: true,
      verification: true,
      cost: true,
      final: true,
    },
    integrity: {
      rawTranscript: true,
      toolTrace: true,
      finalReport: true,
    },
    metrics: {
      elapsedMs: 100,
      interventionCount: 0,
      toolCallCount: 4,
      evidenceCompletenessPct: 100,
      costUsd: 0.01,
      noEvidenceActionCount: 0,
    },
    risks: [],
  }
}

function writeTargetReferenceManifest(): string {
  const dir = mkdtempSync(join(tmpdir(), 'dsxu-ogc-target-manifest-'))
  const path = join(dir, 'target-reference-manifest.json')
  const manifest: P12RawLogManifest = {
    schemaVersion: 'dsxu.phase12-raw-log-manifest.v1',
    side: 'target-reference',
    source: {
      collectedAt: '2026-05-13T00:00:00.000Z',
      acquisitionMethod: 'manual-import',
      immutableRawDir: '.dsxu/trace/p12-19/target-reference',
    },
    logs: replayTargets.map(makeTargetReferenceLog),
  }
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  return path
}

describe('OGC - Owner Git Closure Board V1', () => {
  test('passes only after owner, deletion, raw evidence, workspace, and release lanes are closed', () => {
    const board = buildOwnerGitClosureBoard(clearInput)

    expect(board.schemaVersion).toBe('dsxu.owner-git-closure-board.v1')
    expect(board.status).toBe('PASS')
    expect(board.laneCount).toBe(6)
    expect(board.pass).toBe(6)
    expect(board.blocked).toBe(0)
    expect(board.signoffItemCount).toBe(0)
    expect(board.releaseBlockers).toEqual([])
    expect(board.boardAuthorizesMutation).toBe(false)
    expect(board.mustNotStageDeleteRestoreReset).toBe(false)
    expect(board.nextAction).toBe('run-final-release-tests')
  })

  test('keeps current closure blocked when dirty, pending deletion, target raw logs, and export blockers remain', () => {
    const board = buildOwnerGitClosureBoard({
      ...clearInput,
      dirtyTotal: 2579,
      trackedDirtyCount: 2109,
      untrackedCount: 470,
      deletedCount: 182,
      mainlineDirtyStatus: 'PARTIAL',
      mainlineDirtyNextAction: 'review-owner-git-closure',
      mainlineKeepOwnerSliceCount: 26,
      replaceDeleteCandidateCount: 2,
      replaceDeleteEvidenceVerifiedCount: 2,
      pendingDeletionCount: 69,
      pendingDeletionStatus: 'PARTIAL',
      pendingDeletionSubSliceCount: 11,
      pendingDeletionVerifiedSubSliceCount: 11,
      p12RawStatus: 'PARTIAL',
      p12PairedRawLogCount: 0,
      p12ReplayFamilyGapCount: 14,
      p12UnmappedPairedRawLogCount: 0,
      p12UnpairedTargetReferenceRawLogCount: 1,
      p12CollectionBacklogCount: 0,
      p12CollectionBacklogSlots: [],
      deferredEvalIds: ['R01', 'R02', 'S02', 'R04', 'R05', 'R06'],
      deferredProductIds: ['PZ01', 'PZ02', 'PZ04', 'PZ05', 'PZ06', 'PZ08'],
      permissionBlockedResidualCount: 5,
      cleanExportReady: false,
      releaseClosureStatus: 'BLOCKED',
      canCreateCleanExport: false,
      signoffItems: [
        {
          id: 'MDR-03.02',
          laneId: 'OGC-01',
          owner: 'Verification Cleanup Owner',
          targetOwner: 'current focused verification files only',
          decision: 'replace-delete-candidate',
          count: 1,
          requiredAction: 'confirm current focused test replaces this backup before normal git review',
          evidence: ['engine.test.ts'],
          samplePaths: ['src/dsxu/engine/__tests__/engine.test.ts.backup'],
          status: 'PARTIAL',
          redlines: [],
        },
        {
          id: 'PDR-03.02',
          laneId: 'OGC-02',
          owner: 'Direct Connect / Provider Runtime Owner',
          targetOwner: 'DSXU direct-connect/provider runtime replacement',
          decision: 'old-root-shim-delete',
          count: 2,
          requiredAction: 'verify DSXU launcher/tooling replacement evidence, then close deletion through normal git review',
          evidence: ['direct-connect-and-query-contract-v1.test.ts'],
          samplePaths: ['deepseek-proxy.ts'],
          status: 'PARTIAL',
          redlines: [],
        },
      ],
    })

    expect(board.status).toBe('BLOCKED')
    expect(board.boardAuthorizesMutation).toBe(false)
    expect(board.mustNotStageDeleteRestoreReset).toBe(true)
    expect(board.lanes.map(lane => lane.id)).toEqual([
      'OGC-01',
      'OGC-02',
      'OGC-03',
      'OGC-04',
      'OGC-05',
      'OGC-06',
    ])
    expect(board.lanes.find(lane => lane.id === 'OGC-01')?.status).toBe('PARTIAL')
    expect(board.lanes.find(lane => lane.id === 'OGC-02')?.status).toBe('PARTIAL')
    expect(board.lanes.find(lane => lane.id === 'OGC-03')?.status).toBe('BLOCKED')
    expect(board.lanes.find(lane => lane.id === 'OGC-04')?.status).toBe('PARTIAL')
    expect(board.lanes.find(lane => lane.id === 'OGC-05')?.status).toBe('PARTIAL')
    expect(board.lanes.find(lane => lane.id === 'OGC-06')?.status).toBe('BLOCKED')
    expect(board.releaseBlockers.join('\n')).toContain('target reference paired raw logs are missing')
    expect(board.releaseBlockers.join('\n')).toContain('P12 original-side replay family gaps remain: 14')
    expect(board.releaseBlockers.join('\n')).not.toContain('P12 target collection family backlog slots remain')
    expect(board.releaseBlockers.join('\n')).toContain('clean export is not ready')
    expect(board.lanes.find(lane => lane.id === 'OGC-03')?.currentEvidence).toContain('p12ReplayFamilyGapCount=14')
    expect(board.lanes.find(lane => lane.id === 'OGC-03')?.currentEvidence).toContain('p12UnpairedTargetReferenceRawLogCount=1')
    expect(board.lanes.find(lane => lane.id === 'OGC-03')?.currentEvidence).toContain('p12CollectionBacklogCount=0')
    expect(board.releaseBlockers.join('\n')).not.toContain('p12UnpairedTargetReferenceRawLogCount')
    expect(board.signoffItemCount).toBe(2)
    expect(board.replaceDeleteSignoffItemCount).toBe(1)
    expect(board.pendingDeletionSignoffItemCount).toBe(1)
    expect(board.nextAction).toBe('review-owner-git-signoff')
  })

  test('blocks duplicate cleanup shortcuts when replacement evidence is missing', () => {
    const board = buildOwnerGitClosureBoard({
      ...clearInput,
      dirtyTotal: 2,
      trackedDirtyCount: 2,
      mainlineDirtyStatus: 'PARTIAL',
      mainlineDirtyNextAction: 'review-owner-git-closure',
      replaceDeleteCandidateCount: 2,
      replaceDeleteEvidenceVerifiedCount: 1,
      replaceDeleteMissingEvidenceCount: 1,
    })

    expect(board.status).toBe('BLOCKED')
    expect(board.lanes.find(lane => lane.id === 'OGC-01')?.redlines).toContain('replace/delete candidates have missing replacement evidence')
    expect(board.safeguards.join('\n')).toContain('equivalent duplicate behavior')
  })

  test('writes current owner/git closure evidence without staging or deleting files', async () => {
    const board = await runOwnerGitClosureBoardHarness()

    expect(board.evidencePath).toContain('owner-git-closure-board.evidence.json')
    expect(board.tracePath).toContain('owner-git-closure-board.trace.json')
    expect(existsSync(board.evidencePath)).toBe(true)
    expect(existsSync(board.tracePath)).toBe(true)
    expect(board.status).toBe('BLOCKED')
    expect(board.laneCount).toBe(6)
    expect(board.dirtySummary.total).toBeGreaterThan(0)
    expect(board.dirtySummary.untrackedCount).toBeGreaterThan(0)
    expect(board.ownerReviewSummary.mainlineReviewBeforeKeepCount).toBe(0)
    expect(board.ownerReviewSummary.replaceDeleteCandidateCount).toBeGreaterThanOrEqual(2)
    expect(board.ownerReviewSummary.replaceDeleteMissingEvidenceCount).toBe(0)
    expect(board.ownerReviewSummary.pendingDeletionSubSliceCount).toBe(11)
    expect(board.ownerReviewSummary.pendingDeletionVerifiedSubSliceCount).toBe(11)
    expect(board.ownerReviewSummary.pendingDeletionMissingEvidenceCount).toBe(0)
    expect(board.signoffItemCount).toBeGreaterThan(30)
    expect(board.replaceDeleteSignoffItemCount).toBeGreaterThanOrEqual(2)
    expect(board.pendingDeletionSignoffItemCount).toBe(11)
    expect(board.signoffItems.map(item => item.id)).toContain('PDR-03.02')
    expect(board.lanes.find(lane => lane.id === 'OGC-03')?.redlines).toContain('target reference paired raw logs are missing')
    expect(board.lanes.find(lane => lane.id === 'OGC-03')?.redlines.join('\n')).toContain('P12 original-side replay family gaps remain')
    expect(board.lanes.find(lane => lane.id === 'OGC-03')?.redlines.join('\n')).not.toContain('P12 target collection family backlog slots remain')
    expect(board.lanes.find(lane => lane.id === 'OGC-03')?.currentEvidence.join('\n')).toContain('p12CollectionBacklogCount=0')
    expect(board.lanes.find(lane => lane.id === 'OGC-06')?.redlines).toContain('clean export is not ready')
    expect(board.boardAuthorizesMutation).toBe(false)
    expect(board.mustNotStageDeleteRestoreReset).toBe(true)
    expect(board.safeguards.join('\n')).toContain('does not stage')
  }, 120_000)

  test('routes a real target-reference manifest into the owner/git closure board without clearing owner review gates', async () => {
    const board = await runOwnerGitClosureBoardHarness({
      evidenceDir: mkdtempSync(join(tmpdir(), 'dsxu-ogc-target-intake-')),
      targetReferenceManifestPath: writeTargetReferenceManifest(),
    })

    const p12Lane = board.lanes.find(lane => lane.id === 'OGC-03')
    expect(p12Lane?.currentEvidence).toContain('p12RawStatus=PASS')
    expect(p12Lane?.currentEvidence).toContain('p12PairedRawLogCount=14')
    expect(p12Lane?.currentEvidence).toContain('p12ReplayFamilyGapCount=0')
    expect(p12Lane?.redlines).not.toContain('target reference paired raw logs are missing')
    expect(p12Lane?.redlines.join('\n')).not.toContain('P12 original-side replay family gaps remain')
    expect(board.releaseBlockers.join('\n')).not.toContain('target reference paired raw logs are missing')
    expect(board.releaseBlockers.join('\n')).not.toContain('P12 original-side replay family gaps remain')
    expect(board.status).toBe('BLOCKED')
    expect(board.nextAction).toBe('review-owner-git-signoff')
    expect(board.boardAuthorizesMutation).toBe(false)
  }, 120_000)
})
