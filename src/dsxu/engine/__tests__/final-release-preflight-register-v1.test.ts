import { existsSync } from 'fs'
import { describe, expect, test } from 'bun:test'
import { buildCleanExportReadiness } from '../clean-export-readiness-v1'
import { buildFinalReleasePreflightRegister } from '../final-release-preflight-register-v1'
import { buildOwnerGitClosureBoard } from '../owner-git-closure-board-v1'
import { buildReleaseClosureBoard } from '../release-closure-board-v1'
import { runFinalReleasePreflightRegisterHarness } from '../../integration/harness/final-release-preflight-register-v1-harness'

const boardInput = {
  dirtyTotal: 0,
  trackedDirtyCount: 0,
  untrackedCount: 0,
  deletedCount: 0,
  unknownDirtyCount: 0,
  mainlineDirtyStatus: 'PASS',
  mainlineDirtyNextAction: 'review-owner-git-closure',
  mainlineKeepOwnerSliceCount: 0,
  mainlineReviewBeforeKeepCount: 0,
  replaceDeleteCandidateCount: 0,
  replaceDeleteEvidenceVerifiedCount: 0,
  replaceDeleteMissingEvidenceCount: 0,
  pendingDeletionCount: 0,
  pendingDeletionStatus: 'PASS',
  pendingDeletionSubSliceCount: 0,
  pendingDeletionVerifiedSubSliceCount: 0,
  pendingDeletionMissingEvidenceCount: 0,
  p12RawStatus: 'PASS',
  p12PairedRawLogCount: 14,
  p12MinimumPairedRawLogsForPass: 14,
  p12RawNextAction: 'ready-for-delta-review',
  deferredEvalIds: [],
  deferredProductIds: [],
  localArtifactPolicyKnown: true,
  permissionBlockedResidualCount: 0,
  cleanExportReady: true,
  releaseClosureStatus: 'PASS',
  canCreateCleanExport: true,
  destructiveActionRequested: false,
  evidencePaths: ['.dsxu/trace/final-release/input.json'],
}

const cleanExportInput = {
  releaseBlockerCount: 0,
  rewriteOrExcludeCount: 0,
  pendingDeletionCount: 0,
  pendingDeletionByRule: {},
  dirtyTotal: 0,
  unknownDirtyCount: 0,
  p12RawStatus: 'PASS' as const,
  p12PairedRawLogCount: 14,
  p12MinimumPairedRawLogsForPass: 14,
  cleanExportReady: true,
  destructiveActionRequested: false,
  evidencePaths: ['.dsxu/trace/final-release/input.json'],
}

const releaseClosureInput = {
  docsLedgerReady: true,
  traceEvidenceReferenced: true,
  pendingDeletionCount: 0,
  pendingDeletionHasClosureEntries: true,
  dirtyTotal: 0,
  unknownDirtyCount: 0,
  releaseSurfaceBlockerCount: 0,
  sourcePolicyReviewCount: 0,
  cleanExportReady: true,
  p12RawStatus: 'PASS' as const,
  p12PairedRawLogCount: 14,
  realReplayStatus: 'PASS' as const,
  mainlineContractsReady: true,
  destructiveActionRequested: false,
  evidencePaths: ['.dsxu/trace/final-release/input.json'],
}

describe('OGC-06 - Final Release Preflight Register V1', () => {
  test('allows final release tests only when every upstream gate is closed', () => {
    const register = buildFinalReleasePreflightRegister({
      board: buildOwnerGitClosureBoard(boardInput),
      cleanExport: buildCleanExportReadiness(cleanExportInput),
      releaseClosure: buildReleaseClosureBoard(releaseClosureInput),
    })

    expect(register.schemaVersion).toBe('dsxu.final-release-preflight-register.v1')
    expect(register.status).toBe('PASS')
    expect(register.planObjective).toContain('original-side owner closure')
    expect(register.executionMeaning.join('\n')).toContain('Git status reduction is a signed review outcome')
    expect(register.stageCount).toBe(6)
    expect(register.canRunFocusedVerification).toBe(true)
    expect(register.canRunFinalComprehensiveTests).toBe(true)
    expect(register.canCreateCleanExport).toBe(true)
    expect(register.mustNotStageDeleteRestoreResetExport).toBe(false)
    expect(register.gitStatusReductionGate.canReduceGitStatusNow).toBe(true)
    expect(register.gitStatusReductionGate.blockedBy).toEqual([])
    expect(register.closureSequence.map(step => step.stageId)).toEqual(['FRP-03', 'FRP-01', 'FRP-02', 'FRP-04', 'FRP-06'])
    expect(register.nextAction).toBe('prepare-final-release-tests')
  })

  test('keeps current unresolved workspace blocked while allowing focused verification', () => {
    const board = buildOwnerGitClosureBoard({
      ...boardInput,
      dirtyTotal: 2591,
      trackedDirtyCount: 2109,
      untrackedCount: 482,
      deletedCount: 182,
      mainlineDirtyStatus: 'PARTIAL',
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
      p12CollectionBacklogCount: 0,
      p12CollectionBacklogSlots: [],
      deferredEvalIds: ['R01', 'R02', 'S02', 'R04', 'R05', 'R06'],
      deferredProductIds: ['PZ01', 'PZ02', 'PZ04', 'PZ05', 'PZ06', 'PZ08'],
      permissionBlockedResidualCount: 5,
      cleanExportReady: false,
      releaseClosureStatus: 'BLOCKED',
      canCreateCleanExport: false,
    })
    const cleanExport = buildCleanExportReadiness({
      ...cleanExportInput,
      pendingDeletionCount: 69,
      pendingDeletionByRule: { deleted: 69 },
      dirtyTotal: 2591,
      p12RawStatus: 'PARTIAL',
      p12PairedRawLogCount: 0,
      p12ReplayFamilyGapCount: 14,
      cleanExportReady: false,
    })
    const releaseClosure = buildReleaseClosureBoard({
      ...releaseClosureInput,
      pendingDeletionCount: 69,
      pendingDeletionHasClosureEntries: true,
      dirtyTotal: 2591,
      sourcePolicyReviewCount: 1,
      cleanExportReady: false,
      p12RawStatus: 'PARTIAL',
      p12PairedRawLogCount: 0,
      p12ReplayFamilyGapCount: 14,
      realReplayStatus: 'PARTIAL',
    })
    const register = buildFinalReleasePreflightRegister({ board, cleanExport, releaseClosure })

    expect(register.status).toBe('BLOCKED')
    expect(register.canRunFocusedVerification).toBe(true)
    expect(register.canRunFinalComprehensiveTests).toBe(false)
    expect(register.canCreateCleanExport).toBe(false)
    expect(register.mustNotStageDeleteRestoreResetExport).toBe(true)
    expect(register.gitStatusReductionGate.currentDirtyTotal).toBe(2591)
    expect(register.gitStatusReductionGate.canReduceGitStatusNow).toBe(false)
    expect(register.gitStatusReductionGate.blockedBy.join('\n')).toContain('P12-19 raw evidence: target reference paired raw logs are missing')
    expect(register.gitStatusReductionGate.blockedBy.join('\n')).not.toContain('P12 target collection family backlog slots remain')
    expect(register.gitStatusReductionGate.blockedBy.join('\n')).toContain('owner/Git signoff')
    expect(register.gitStatusReductionGate.allowedReductionAfter.join('\n')).toContain('pending deletion Git review')
    expect(register.closureSequence[0]).toMatchObject({
      order: 1,
      stageId: 'FRP-03',
      name: 'P12-19 target raw logs',
      canReduceGitStatusAtThisStep: false,
    })
    expect(register.closureSequence[1]?.executionMeaning).toContain('replace/delete candidates')
    expect(register.stages.find(stage => stage.id === 'FRP-03')?.status).toBe('BLOCKED')
    expect(register.stages.find(stage => stage.id === 'FRP-03')?.evidence.join('\n')).toContain('p12CollectionBacklogCount=0')
    expect(register.stages.find(stage => stage.id === 'FRP-06')?.status).toBe('BLOCKED')
    expect(register.releaseBlockers.join('\n')).toContain('target reference paired raw logs are missing')
    expect(register.releaseBlockers.join('\n')).toContain('clean export')
    expect(register.nextAction).toBe('collect-target-reference-raw-logs')
  })

  test('writes current final release preflight evidence without exporting files', async () => {
    const register = await runFinalReleasePreflightRegisterHarness()

    expect(register.evidencePath).toContain('final-release-preflight-register.evidence.json')
    expect(register.tracePath).toContain('final-release-preflight-register.trace.json')
    expect(existsSync(register.evidencePath)).toBe(true)
    expect(existsSync(register.tracePath)).toBe(true)
    expect(register.status).toBe('BLOCKED')
    expect(register.sourceBoardStatus).toBe('BLOCKED')
    expect(register.cleanExportStatus).toBe('BLOCKED')
    expect(register.releaseClosureStatus).toBe('BLOCKED')
    expect(register.canRunFocusedVerification).toBe(true)
    expect(register.canRunFinalComprehensiveTests).toBe(false)
    expect(register.canCreateCleanExport).toBe(false)
    expect(register.mustNotStageDeleteRestoreResetExport).toBe(true)
    expect(register.planObjective).toBe('original-side owner closure before final tests and clean export')
    expect(register.closureSequence.map(step => step.name)).toEqual([
      'P12-19 target raw logs',
      'owner/Git signoff',
      'pending deletion Git review',
      'permission residue and workspace policy',
      'final tests and clean export',
    ])
    expect(register.gitStatusReductionGate.currentDirtyTotal).toBe(0)
    expect(register.gitStatusReductionGate.canReduceGitStatusNow).toBe(false)
    expect(register.gitStatusReductionGate.blockedBy.join('\n')).toContain('P12-19 raw evidence: target reference paired raw logs are missing')
    expect(register.gitStatusReductionGate.blockedBy.join('\n')).not.toContain('P12 target collection family backlog slots remain')
    expect(register.gitStatusReductionGate.blockedBy.join('\n')).not.toContain('owner/Git signoff')
    expect(register.gitStatusReductionGate.blockedBy.join('\n')).not.toContain('pending deletion Git review')
    expect(register.gitStatusReductionGate.blockedBy.join('\n')).toContain('workspace artifact policy or permission residues still require review')
    expect(register.stages.find(stage => stage.id === 'FRP-01')?.status).toBe('PASS')
    expect(register.stages.find(stage => stage.id === 'FRP-02')?.status).toBe('PASS')
    expect(register.stages.find(stage => stage.id === 'FRP-03')?.evidence.join('\n')).toContain('p12CollectionBacklogCount=0')
    expect(register.stages.map(stage => stage.id)).toEqual([
      'FRP-01',
      'FRP-02',
      'FRP-03',
      'FRP-04',
      'FRP-05',
      'FRP-06',
    ])
    expect(register.stages.find(stage => stage.id === 'FRP-05')?.status).toBe('PASS')
    expect(register.releaseBlockers.join('\n')).toContain('target reference paired raw logs are missing')
    expect(register.safeguards.join('\n')).toContain('final comprehensive tests stay last')
  }, 180_000)
})
