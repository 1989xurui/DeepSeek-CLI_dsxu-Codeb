import { existsSync } from 'fs'
import { describe, expect, test } from 'bun:test'
import { buildPendingDeletionReviewLanesRegister } from '../pending-deletion-review-lanes-register-v1'
import type { PendingDeletionSignoffRegister } from '../pending-deletion-signoff-register-v1'
import { runPendingDeletionReviewLanesRegisterHarness } from '../../integration/harness/pending-deletion-review-lanes-register-v1-harness'

const sourceRegister: PendingDeletionSignoffRegister = {
  schemaVersion: 'dsxu.pending-deletion-signoff-register.v1',
  status: 'PARTIAL',
  sourceBoardStatus: 'BLOCKED',
  sourcePendingDeletionSignoffItemCount: 3,
  entryCount: 3,
  mainlineReplacementDeleteEntryCount: 1,
  releaseExcludedDeleteEntryCount: 1,
  oldRootShimDeleteEntryCount: 1,
  replacementEvidenceVerifiedEntryCount: 3,
  missingReplacementEvidenceEntryCount: 0,
  gitReviewRequiredCount: 3,
  boardAuthorizesMutation: false,
  mustNotStageDeleteRestoreReset: true,
  entries: [
    {
      id: 'PDR-01.01',
      owner: 'Control Plane Replacement Owner',
      targetOwner: 'DSXU Control Plane and direct-connect lifecycle tests',
      closureDecision: 'mainline-replacement-delete',
      disposition: 'ready-mainline-replacement-delete-review',
      status: 'PARTIAL',
      pathCount: 8,
      replacementEvidenceStatus: 'VERIFIED_FOR_SIGNOFF',
      requiredAction: 'verify DSXU control-plane replacement evidence, then close deletion through normal git review',
      restorePolicy: 'do-not-restore-old-runtime-shell',
      forbiddenActions: ['do not stage this entry automatically'],
      replacementEvidence: ['control-plane-v1.test.ts'],
      samplePaths: ['src/bridge/bridgeApi.ts'],
      redlines: [],
    },
    {
      id: 'PDR-02.01',
      owner: 'Release Evidence Owner',
      targetOwner: 'release-excluded private config state',
      closureDecision: 'release-excluded-delete',
      disposition: 'ready-release-excluded-delete-review',
      status: 'PARTIAL',
      pathCount: 1,
      replacementEvidenceStatus: 'VERIFIED_FOR_SIGNOFF',
      requiredAction: 'confirm release-excluded state and close deletion through normal git review',
      restorePolicy: 'do-not-restore-release-excluded-state',
      forbiddenActions: ['do not stage this entry automatically'],
      replacementEvidence: ['clean-export-readiness.evidence.json'],
      samplePaths: ['.legacy-product/settings.json'],
      redlines: [],
    },
    {
      id: 'PDR-03.01',
      owner: 'Entrypoint Replacement Owner',
      targetOwner: 'Start-DSXU-Code launchers and CLI entrypoint',
      closureDecision: 'old-root-shim-delete',
      disposition: 'ready-old-root-shim-delete-review',
      status: 'PARTIAL',
      pathCount: 2,
      replacementEvidenceStatus: 'VERIFIED_FOR_SIGNOFF',
      requiredAction: 'verify DSXU launcher/tooling replacement evidence, then close deletion through normal git review',
      restorePolicy: 'do-not-restore-old-root-shim',
      forbiddenActions: ['do not stage this entry automatically'],
      replacementEvidence: ['Start-DSXU-Code.cmd'],
      samplePaths: ['start-dsxu-old.cmd'],
      redlines: [],
    },
  ],
  blockers: [],
  safeguards: ['register is evidence-only'],
  nextAction: 'pending-deletion-git-review-required',
}

describe('OGC-02A - Pending Deletion Review Lanes Register V1', () => {
  test('splits pending deletions into mainline, release-excluded, and old-root-shim review lanes', () => {
    const register = buildPendingDeletionReviewLanesRegister(sourceRegister)

    expect(register.schemaVersion).toBe('dsxu.pending-deletion-review-lanes-register.v1')
    expect(register.status).toBe('PARTIAL')
    expect(register.laneCount).toBe(3)
    expect(register.entryCount).toBe(3)
    expect(register.mainlineReplacementDeleteEntryCount).toBe(1)
    expect(register.releaseExcludedDeleteEntryCount).toBe(1)
    expect(register.oldRootShimDeleteEntryCount).toBe(1)
    expect(register.missingReplacementEvidenceEntryCount).toBe(0)
    expect(register.boardAuthorizesMutation).toBe(false)
    expect(register.mustNotStageDeleteRestoreReset).toBe(true)
    expect(register.nextAction).toBe('pending-deletion-lane-git-review-required')
    expect(register.lanes.map(lane => lane.id)).toEqual(['PDL-01', 'PDL-02', 'PDL-03'])
    expect(register.lanes.find(lane => lane.id === 'PDL-01')?.requiredAction).toContain('legacy control-plane shell')
  })

  test('blocks a lane when replacement evidence is missing', () => {
    const register = buildPendingDeletionReviewLanesRegister({
      ...sourceRegister,
      entries: [
        {
          ...sourceRegister.entries[0],
          replacementEvidence: [],
        },
      ],
    })

    expect(register.status).toBe('BLOCKED')
    expect(register.missingReplacementEvidenceEntryCount).toBe(1)
    expect(register.blockers).toContain('pending deletion lanes have missing replacement evidence')
    expect(register.nextAction).toBe('fix-pending-deletion-lane-evidence')
  })

  test('writes current pending deletion review lanes without mutating git state', async () => {
    const register = await runPendingDeletionReviewLanesRegisterHarness()

    expect(register.evidencePath).toContain('pending-deletion-review-lanes-register.evidence.json')
    expect(register.tracePath).toContain('pending-deletion-review-lanes-register.trace.json')
    expect(existsSync(register.evidencePath)).toBe(true)
    expect(existsSync(register.tracePath)).toBe(true)
    expect(register.status).toBe('PARTIAL')
    expect(register.laneCount).toBe(3)
    expect(register.entryCount).toBe(11)
    expect(register.mainlineReplacementDeleteEntryCount).toBe(4)
    expect(register.releaseExcludedDeleteEntryCount).toBe(4)
    expect(register.oldRootShimDeleteEntryCount).toBe(3)
    expect(register.missingReplacementEvidenceEntryCount).toBe(0)
    expect(register.lanes.find(lane => lane.id === 'PDL-01')?.pathCount).toBeGreaterThan(30)
    expect(register.lanes.find(lane => lane.id === 'PDL-02')?.pathCount).toBeGreaterThan(20)
    expect(register.lanes.find(lane => lane.id === 'PDL-03')?.pathCount).toBeGreaterThan(0)
    expect(register.mustNotStageDeleteRestoreReset).toBe(true)
  }, 180_000)
})
