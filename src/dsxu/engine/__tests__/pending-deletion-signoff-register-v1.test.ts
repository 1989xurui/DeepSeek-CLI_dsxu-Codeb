import { existsSync } from 'fs'
import { describe, expect, test } from 'bun:test'
import { buildOwnerGitClosureBoard } from '../owner-git-closure-board-v1'
import {
  buildPendingDeletionSignoffRegister,
  validatePendingDeletionReviewManifest,
} from '../pending-deletion-signoff-register-v1'
import { runPendingDeletionSignoffRegisterHarness } from '../../integration/harness/pending-deletion-signoff-register-v1-harness'

const baseInput = {
  dirtyTotal: 0,
  trackedDirtyCount: 0,
  untrackedCount: 0,
  deletedCount: 2,
  unknownDirtyCount: 0,
  mainlineDirtyStatus: 'PASS',
  mainlineDirtyNextAction: 'mainline-gate-closed',
  mainlineKeepOwnerSliceCount: 0,
  mainlineReviewBeforeKeepCount: 0,
  replaceDeleteCandidateCount: 0,
  replaceDeleteEvidenceVerifiedCount: 0,
  replaceDeleteMissingEvidenceCount: 0,
  pendingDeletionCount: 2,
  pendingDeletionStatus: 'PARTIAL',
  pendingDeletionSubSliceCount: 2,
  pendingDeletionVerifiedSubSliceCount: 2,
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
  signoffItems: [
    {
      id: 'PDR-01.01',
      laneId: 'OGC-02',
      owner: 'Control Plane Replacement Owner',
      targetOwner: 'DSXU Control Plane and direct-connect lifecycle tests',
      decision: 'mainline-replacement-delete',
      count: 8,
      requiredAction: 'verify DSXU control-plane replacement evidence, then close deletion through normal git review',
      evidence: ['control-plane-v1.test.ts'],
      samplePaths: ['src/bridge/bridgeApi.ts'],
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
      evidence: ['network-facade-v1.test.ts'],
      samplePaths: ['deepseek-proxy.ts'],
      status: 'PARTIAL',
      redlines: [],
    },
    {
      id: 'MDR-08.04',
      laneId: 'OGC-01',
      owner: 'MSA Experiment Owner',
      targetOwner: 'deleted MSA experiment source',
      decision: 'replace-delete-candidate',
      count: 6,
      requiredAction: 'do not restore it as a second memory/context runtime',
      evidence: ['context-owner-rule-contract-v1.test.ts'],
      samplePaths: ['src/dsxu/msa/index.ts'],
      status: 'PARTIAL',
      redlines: [],
    },
  ],
  evidencePaths: ['.dsxu/trace/pending-deletion-signoff-register-v1/input.json'],
}

const baseBoard = buildOwnerGitClosureBoard(baseInput)

describe('OGC-02 - Pending Deletion Signoff Register V1', () => {
  test('keeps pending deletion partial when replacement evidence is verified but Git review remains', () => {
    const register = buildPendingDeletionSignoffRegister(baseBoard)

    expect(register.schemaVersion).toBe('dsxu.pending-deletion-signoff-register.v1')
    expect(register.status).toBe('PARTIAL')
    expect(register.entryCount).toBe(2)
    expect(register.mainlineReplacementDeleteEntryCount).toBe(1)
    expect(register.oldRootShimDeleteEntryCount).toBe(1)
    expect(register.releaseExcludedDeleteEntryCount).toBe(0)
    expect(register.replacementEvidenceVerifiedEntryCount).toBe(2)
    expect(register.missingReplacementEvidenceEntryCount).toBe(0)
    expect(register.gitReviewRequiredCount).toBe(2)
    expect(register.boardAuthorizesMutation).toBe(false)
    expect(register.mustNotStageDeleteRestoreReset).toBe(true)
    expect(register.canReduceGitStatusNow).toBe(false)
    expect(register.reviewPackets.map(packet => packet.disposition)).toEqual([
      'ready-mainline-replacement-delete-review',
      'ready-old-root-shim-delete-review',
    ])
    expect(register.reviewPackets.find(packet => packet.disposition === 'ready-old-root-shim-delete-review')).toMatchObject({
      entryCount: 1,
      pathCount: 2,
      canReduceGitStatusAfterReview: true,
    })
    expect(register.reviewPackets.find(packet => packet.disposition === 'ready-mainline-replacement-delete-review')?.duplicateResolutionPolicy).toContain('named current mainline replacement')
    expect(register.reviewPackets.find(packet => packet.disposition === 'ready-old-root-shim-delete-review')?.oldPathPolicy).toContain('must not return')
    expect(register.gitReviewExitCriteria.join('\n')).toContain('old root shims')
    expect(register.nextAction).toBe('pending-deletion-git-review-required')
    expect(register.entries.find(entry => entry.id === 'PDR-03.02')?.restorePolicy).toBe('do-not-restore-old-root-shim')
    expect(register.entries.find(entry => entry.id === 'PDR-03.02')?.forbiddenActions.join('\n')).toContain('do not keep old root shims')
  })

  test('blocks pending deletion signoff when replacement evidence is missing', () => {
    const board = buildOwnerGitClosureBoard({
      ...baseInput,
      signoffItems: [
        {
          id: 'PDR-03.03',
          laneId: 'OGC-02',
          owner: 'Verification Tooling Owner',
          targetOwner: 'current Bun/focused verification harnesses',
          decision: 'old-root-shim-delete',
          count: 3,
          requiredAction: 'verify DSXU launcher/tooling replacement evidence, then close deletion through normal git review',
          evidence: [],
          samplePaths: ['test-infra-tasks.js'],
          status: 'BLOCKED',
          redlines: ['missing replacement evidence: release-closure-board-v1.test.ts'],
        },
      ],
    })
    const register = buildPendingDeletionSignoffRegister(board)

    expect(register.status).toBe('BLOCKED')
    expect(register.missingReplacementEvidenceEntryCount).toBe(1)
    expect(register.blockers).toContain('pending deletion entries have missing replacement evidence')
    expect(register.nextAction).toBe('fix-missing-pending-deletion-evidence')
  })

  test('ignores OGC-01 owner dirty entries', () => {
    const register = buildPendingDeletionSignoffRegister(baseBoard)

    expect(register.entries.map(entry => entry.id)).not.toContain('MDR-08.04')
    expect(register.entryCount).toBe(2)
  })

  test('closes OGC-02 only when an explicit Git review manifest signs current packets', () => {
    const unsigned = buildPendingDeletionSignoffRegister(baseBoard)
    const reviewManifest = validatePendingDeletionReviewManifest({
      schemaVersion: 'dsxu.pending-deletion-review-manifest.v1',
      laneId: 'OGC-02',
      decisions: unsigned.reviewPackets.map(packet => ({
        disposition: packet.disposition,
        decision: 'sign',
        entryCount: packet.entryCount,
        pathCount: packet.pathCount,
        ids: packet.ids,
        reviewer: 'release-git-review',
        reviewedAt: '2026-05-13T00:00:00.000Z',
        notes: `signed ${packet.disposition}; old paths stay closed through normal Git review`,
      })),
    })
    const signed = buildPendingDeletionSignoffRegister(baseBoard, { reviewManifest })

    expect(reviewManifest.status).toBe('PASS')
    expect(signed.status).toBe('PASS')
    expect(signed.reviewManifestStatus).toBe('PASS')
    expect(signed.signedReviewPacketCount).toBe(2)
    expect(signed.unsignedReviewPacketCount).toBe(0)
    expect(signed.gitReviewRequiredCount).toBe(0)
    expect(signed.canReduceGitStatusNow).toBe(true)
    expect(signed.boardAuthorizesMutation).toBe(false)
    expect(signed.nextAction).toBe('pending-deletion-signoff-closed')
  })

  test('blocks stale or adjust-requested pending deletion review manifests', () => {
    const unsigned = buildPendingDeletionSignoffRegister(baseBoard)
    const staleManifest = validatePendingDeletionReviewManifest({
      schemaVersion: 'dsxu.pending-deletion-review-manifest.v1',
      laneId: 'OGC-02',
      decisions: unsigned.reviewPackets.map((packet, index) => ({
        disposition: packet.disposition,
        decision: index === 0 ? 'sign' : 'adjust',
        entryCount: packet.entryCount,
        pathCount: index === 0 ? packet.pathCount + 1 : packet.pathCount,
        ids: packet.ids,
        reviewer: 'release-git-review',
        reviewedAt: '2026-05-13T00:00:00.000Z',
        notes: `reviewed ${packet.disposition}`,
      })),
    })
    const register = buildPendingDeletionSignoffRegister(baseBoard, { reviewManifest: staleManifest })

    expect(register.status).toBe('BLOCKED')
    expect(register.signedReviewPacketCount).toBe(0)
    expect(register.adjustRequestedReviewPacketCount).toBe(1)
    expect(register.staleReviewPacketCount).toBe(1)
    expect(register.blockers.join('\n')).toContain('signed pathCount')
    expect(register.blockers.join('\n')).toContain('requested adjustment')
    expect(register.canReduceGitStatusNow).toBe(false)
    expect(register.nextAction).toBe('fix-missing-pending-deletion-evidence')
  })

  test('writes current pending deletion signoff register without deleting files', async () => {
    const register = await runPendingDeletionSignoffRegisterHarness()

    expect(register.evidencePath).toContain('pending-deletion-signoff-register.evidence.json')
    expect(register.tracePath).toContain('pending-deletion-signoff-register.trace.json')
    expect(existsSync(register.evidencePath)).toBe(true)
    expect(existsSync(register.tracePath)).toBe(true)
    expect(register.status).toBe('PARTIAL')
    expect(register.entryCount).toBe(11)
    expect(register.mainlineReplacementDeleteEntryCount).toBe(4)
    expect(register.releaseExcludedDeleteEntryCount).toBe(4)
    expect(register.oldRootShimDeleteEntryCount).toBe(3)
    expect(register.replacementEvidenceVerifiedEntryCount).toBe(11)
    expect(register.missingReplacementEvidenceEntryCount).toBe(0)
    expect(register.gitReviewRequiredCount).toBe(11)
    expect(register.boardAuthorizesMutation).toBe(false)
    expect(register.mustNotStageDeleteRestoreReset).toBe(true)
    expect(register.canReduceGitStatusNow).toBe(false)
    expect(register.reviewPackets.length).toBe(3)
    expect(register.reviewPackets.reduce((sum, packet) => sum + packet.entryCount, 0)).toBe(register.entryCount)
    expect(register.reviewPackets.find(packet => packet.disposition === 'ready-old-root-shim-delete-review')?.ids).toContain('PDR-03.02')
    expect(register.reviewPackets.find(packet => packet.disposition === 'ready-release-excluded-delete-review')?.reviewDecision).toContain('release-excluded evidence is verified')
    expect(register.reviewPackets.find(packet => packet.disposition === 'ready-release-excluded-delete-review')?.oldPathPolicy).toContain('must not be restored')
    expect(register.entries.map(entry => entry.id)).toContain('PDR-03.02')
    expect(register.entries.find(entry => entry.id === 'PDR-03.02')?.requiredAction).toContain('normal git review')
  }, 120_000)
})
