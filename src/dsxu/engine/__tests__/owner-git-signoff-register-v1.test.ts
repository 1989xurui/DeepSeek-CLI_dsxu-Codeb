import { existsSync } from 'fs'
import { describe, expect, test } from 'bun:test'
import { buildOwnerGitClosureBoard } from '../owner-git-closure-board-v1'
import {
  buildOwnerGitSignoffRegister,
  validateOwnerGitSignoffReviewManifest,
} from '../owner-git-signoff-register-v1'
import { runOwnerGitSignoffRegisterHarness } from '../../integration/harness/owner-git-signoff-register-v1-harness'

const baseInput = {
  dirtyTotal: 2,
  trackedDirtyCount: 2,
  untrackedCount: 0,
  deletedCount: 0,
  unknownDirtyCount: 0,
  mainlineDirtyStatus: 'PARTIAL',
  mainlineDirtyNextAction: 'review-owner-git-closure',
  mainlineKeepOwnerSliceCount: 1,
  mainlineReviewBeforeKeepCount: 0,
  replaceDeleteCandidateCount: 1,
  replaceDeleteEvidenceVerifiedCount: 1,
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
  signoffItems: [
    {
      id: 'MDR-02.05',
      laneId: 'OGC-01',
      owner: 'Runtime Contract Owner',
      targetOwner: 'single runtime/tool lifecycle mainline',
      decision: 'map-to-mainline-owner',
      count: 65,
      requiredAction: 'map to named mainline owner and verify no duplicate runtime or owner path is introduced',
      evidence: ['tool-runtime-dirty-review-v1.test.ts'],
      samplePaths: ['src/dsxu/engine/runtime-core.ts'],
      status: 'PARTIAL',
      redlines: [],
    },
    {
      id: 'MDR-08.04',
      laneId: 'OGC-01',
      owner: 'MSA Experiment Owner',
      targetOwner: 'deleted MSA experiment source; current DSXU memory/context owners are the replacement path',
      decision: 'replace-delete-candidate',
      count: 6,
      requiredAction: 'close deleted MSA experiment source through normal git review; do not restore it as a second memory/context runtime',
      evidence: ['context-owner-rule-contract-v1.test.ts'],
      samplePaths: ['src/dsxu/msa/index.ts'],
      status: 'PARTIAL',
      redlines: ['replace-delete-candidate requires explicit owner review before keep'],
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
  ],
  evidencePaths: ['.dsxu/trace/owner-git-closure-board-v1/input.json'],
}

const baseBoard = buildOwnerGitClosureBoard(baseInput)

describe('OGC-01 - Owner Git Signoff Register V1', () => {
  test('keeps OGC-01 partial when evidence is verified but owner signoff is still required', () => {
    const register = buildOwnerGitSignoffRegister(baseBoard)

    expect(register.schemaVersion).toBe('dsxu.owner-git-signoff-register.v1')
    expect(register.status).toBe('PARTIAL')
    expect(register.entryCount).toBe(2)
    expect(register.mainlineKeepEntryCount).toBe(1)
    expect(register.replaceDeleteEntryCount).toBe(1)
    expect(register.evidenceVerifiedEntryCount).toBe(2)
    expect(register.missingEvidenceEntryCount).toBe(0)
    expect(register.ownerSignoffRequiredCount).toBe(2)
    expect(register.boardAuthorizesMutation).toBe(false)
    expect(register.mustNotStageDeleteRestoreReset).toBe(true)
    expect(register.canReduceGitStatusNow).toBe(false)
    expect(register.reviewPackets.map(packet => packet.disposition)).toEqual([
      'ready-mainline-owner-signoff',
      'ready-replace-delete-review',
    ])
    expect(register.reviewPackets.find(packet => packet.disposition === 'ready-mainline-owner-signoff')).toMatchObject({
      entryCount: 1,
      pathCount: 65,
      canReduceGitStatusAfterReview: true,
    })
    expect(register.reviewPackets.find(packet => packet.disposition === 'ready-mainline-owner-signoff')?.duplicateResolutionPolicy).toContain('equivalent behavior')
    expect(register.reviewPackets.find(packet => packet.disposition === 'ready-replace-delete-review')?.oldPathPolicy).toContain('do not restore')
    expect(register.gitReviewExitCriteria.join('\n')).toContain('no compatibility runtime path remains')
    expect(register.nextAction).toBe('owner-signoff-required')
    expect(register.entries.find(entry => entry.id === 'MDR-08.04')?.disposition).toBe('ready-replace-delete-review')
    expect(register.entries.find(entry => entry.id === 'MDR-08.04')?.forbiddenActions.join('\n')).toContain('do not restore old paths')
  })

  test('blocks OGC-01 signoff when a candidate has no replacement or owner evidence', () => {
    const board = buildOwnerGitClosureBoard({
      ...baseInput,
      signoffItems: [
        {
          id: 'MDR-03.02',
          laneId: 'OGC-01',
          owner: 'Verification Cleanup Owner',
          targetOwner: 'current focused verification files only',
          decision: 'replace-delete-candidate',
          count: 1,
          requiredAction: 'confirm current focused test replaces this backup before normal git review',
          evidence: [],
          samplePaths: ['src/dsxu/engine/__tests__/engine.test.ts.backup'],
          status: 'BLOCKED',
          redlines: ['missing replacement evidence: engine.test.ts'],
        },
      ],
    })
    const register = buildOwnerGitSignoffRegister(board)

    expect(register.status).toBe('BLOCKED')
    expect(register.missingEvidenceEntryCount).toBe(1)
    expect(register.blockers).toContain('owner signoff entries have missing evidence')
    expect(register.nextAction).toBe('fix-missing-signoff-evidence')
  })

  test('ignores non OGC-01 items because pending deletion has its own lane', () => {
    const register = buildOwnerGitSignoffRegister(baseBoard)

    expect(register.entries.map(entry => entry.id)).not.toContain('PDR-03.02')
    expect(register.entryCount).toBe(2)
  })

  test('closes OGC-01 only when an explicit owner review manifest signs current packets', () => {
    const unsigned = buildOwnerGitSignoffRegister(baseBoard)
    const reviewManifest = validateOwnerGitSignoffReviewManifest({
      schemaVersion: 'dsxu.owner-git-signoff-review-manifest.v1',
      laneId: 'OGC-01',
      decisions: unsigned.reviewPackets.map(packet => ({
        disposition: packet.disposition,
        decision: 'sign',
        entryCount: packet.entryCount,
        pathCount: packet.pathCount,
        ids: packet.ids,
        reviewer: 'owner-git-review',
        reviewedAt: '2026-05-13T00:00:00.000Z',
        notes: `signed ${packet.disposition}; equivalent behavior remains with the original owner`,
      })),
    })
    const signed = buildOwnerGitSignoffRegister(baseBoard, { reviewManifest })

    expect(reviewManifest.status).toBe('PASS')
    expect(signed.status).toBe('PASS')
    expect(signed.reviewManifestStatus).toBe('PASS')
    expect(signed.signedReviewPacketCount).toBe(2)
    expect(signed.unsignedReviewPacketCount).toBe(0)
    expect(signed.ownerSignoffRequiredCount).toBe(0)
    expect(signed.canReduceGitStatusNow).toBe(true)
    expect(signed.boardAuthorizesMutation).toBe(false)
    expect(signed.nextAction).toBe('mainline-owner-signoff-closed')
  })

  test('blocks stale or rejected owner review manifests instead of treating them as signoff', () => {
    const unsigned = buildOwnerGitSignoffRegister(baseBoard)
    const staleManifest = validateOwnerGitSignoffReviewManifest({
      schemaVersion: 'dsxu.owner-git-signoff-review-manifest.v1',
      laneId: 'OGC-01',
      decisions: unsigned.reviewPackets.map((packet, index) => ({
        disposition: packet.disposition,
        decision: index === 0 ? 'sign' : 'reject',
        entryCount: index === 0 ? packet.entryCount + 1 : packet.entryCount,
        pathCount: packet.pathCount,
        ids: packet.ids,
        reviewer: 'owner-git-review',
        reviewedAt: '2026-05-13T00:00:00.000Z',
        notes: `reviewed ${packet.disposition}`,
      })),
    })
    const register = buildOwnerGitSignoffRegister(baseBoard, { reviewManifest: staleManifest })

    expect(register.status).toBe('BLOCKED')
    expect(register.signedReviewPacketCount).toBe(0)
    expect(register.rejectedReviewPacketCount).toBe(1)
    expect(register.staleReviewPacketCount).toBe(1)
    expect(register.blockers.join('\n')).toContain('signed entryCount')
    expect(register.blockers.join('\n')).toContain('owner review rejected')
    expect(register.canReduceGitStatusNow).toBe(false)
    expect(register.nextAction).toBe('fix-missing-signoff-evidence')
  })

  test('writes current OGC-01 signoff register without changing git state', async () => {
    const register = await runOwnerGitSignoffRegisterHarness()

    expect(register.evidencePath).toContain('owner-git-signoff-register.evidence.json')
    expect(register.tracePath).toContain('owner-git-signoff-register.trace.json')
    expect(existsSync(register.evidencePath)).toBe(true)
    expect(existsSync(register.tracePath)).toBe(true)
    expect(register.status).toBe('PARTIAL')
    expect(register.entryCount).toBeGreaterThan(20)
    expect(register.mainlineKeepEntryCount).toBeGreaterThan(20)
    expect(register.replaceDeleteEntryCount).toBeGreaterThanOrEqual(2)
    expect(register.evidenceVerifiedEntryCount).toBe(register.entryCount)
    expect(register.missingEvidenceEntryCount).toBe(0)
    expect(register.ownerSignoffRequiredCount).toBe(register.entryCount)
    expect(register.reviewPackets.length).toBe(2)
    expect(register.reviewPackets.reduce((sum, packet) => sum + packet.entryCount, 0)).toBe(register.entryCount)
    expect(register.reviewPackets.find(packet => packet.disposition === 'ready-replace-delete-review')?.ids).toContain('MDR-08.04')
    expect(register.reviewPackets.find(packet => packet.disposition === 'ready-mainline-owner-signoff')?.reviewDecision).toContain('named mainline owner signoff')
    expect(register.reviewPackets.find(packet => packet.disposition === 'ready-replace-delete-review')?.duplicateResolutionPolicy).toContain('merge equivalent behavior into the original owner')
    expect(register.canReduceGitStatusNow).toBe(false)
    expect(register.boardAuthorizesMutation).toBe(false)
    expect(register.mustNotStageDeleteRestoreReset).toBe(true)
    expect(register.entries.map(entry => entry.id)).toContain('MDR-08.04')
    expect(register.entries.find(entry => entry.id === 'MDR-08.04')?.requiredAction).toContain('do not restore it')
  }, 120_000)
})
