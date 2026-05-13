import { existsSync } from 'fs'
import { describe, expect, test } from 'bun:test'
import { buildPendingDeletionOwnerReviewRollupRegister } from '../pending-deletion-owner-review-rollup-register-v1'
import type { PendingDeletionControlPlaneReplacementRegister } from '../pending-deletion-control-plane-replacement-register-v1'
import type { PendingDeletionOldRootShimReplacementRegister } from '../pending-deletion-old-root-shim-replacement-register-v1'
import type { PendingDeletionReleaseExcludedArchiveRegister } from '../pending-deletion-release-excluded-archive-register-v1'
import type { PendingDeletionReviewLanesRegister } from '../pending-deletion-review-lanes-register-v1'
import { runPendingDeletionOwnerReviewRollupRegisterHarness } from '../../integration/harness/pending-deletion-owner-review-rollup-register-v1-harness'

const source: PendingDeletionReviewLanesRegister = {
  schemaVersion: 'dsxu.pending-deletion-review-lanes-register.v1',
  status: 'PARTIAL',
  sourceSignoffStatus: 'PARTIAL',
  laneCount: 3,
  entryCount: 11,
  mainlineReplacementDeleteEntryCount: 4,
  releaseExcludedDeleteEntryCount: 4,
  oldRootShimDeleteEntryCount: 3,
  missingReplacementEvidenceEntryCount: 0,
  boardAuthorizesMutation: false,
  mustNotStageDeleteRestoreReset: true,
  lanes: [
    {
      id: 'PDL-01',
      name: 'mainline replacement deletion review',
      status: 'PARTIAL',
      owner: 'Control Plane / Mainline Replacement Owners',
      entryCount: 4,
      pathCount: 37,
      replacementEvidenceVerifiedCount: 4,
      missingReplacementEvidenceCount: 0,
      requiredAction: 'close legacy control-plane shell deletions through normal Git review after replacement evidence is signed',
      entries: [],
      redlines: [],
    },
    {
      id: 'PDL-02',
      name: 'release-excluded deletion review',
      status: 'PARTIAL',
      owner: 'Release Evidence / Eval Archive Owners',
      entryCount: 4,
      pathCount: 24,
      replacementEvidenceVerifiedCount: 4,
      missingReplacementEvidenceCount: 0,
      requiredAction: 'close release-excluded private/history/eval deletions only after release/export exclusion evidence is signed',
      entries: [],
      redlines: [],
    },
    {
      id: 'PDL-03',
      name: 'old root shim deletion review',
      status: 'PARTIAL',
      owner: 'Entrypoint / Direct Connect / Verification Tooling Owners',
      entryCount: 3,
      pathCount: 8,
      replacementEvidenceVerifiedCount: 3,
      missingReplacementEvidenceCount: 0,
      requiredAction: 'close old root launchers, proxy shims, and root test scripts through normal Git review after replacement evidence is signed',
      entries: [],
      redlines: [],
    },
  ],
  blockers: [],
  safeguards: ['register is evidence-only'],
  nextAction: 'pending-deletion-lane-git-review-required',
}

const controlPlane: PendingDeletionControlPlaneReplacementRegister = {
  schemaVersion: 'dsxu.pending-deletion-control-plane-replacement-register.v1',
  status: 'PARTIAL',
  sourceLaneStatus: 'PARTIAL',
  sourceLaneId: 'PDL-01',
  entryCount: 4,
  pathCount: 37,
  runtimeShellEntryCount: 1,
  permissionSessionEntryCount: 1,
  transportEntryCount: 1,
  visibleStateEntryCount: 1,
  missingReplacementEvidenceEntryCount: 0,
  unknownReplacementOwnerEntryCount: 0,
  standaloneRuntimeAllowed: false,
  boardAuthorizesMutation: false,
  mustNotStageDeleteRestoreReset: true,
  entries: [],
  blockers: [],
  safeguards: [],
  nextAction: 'control-plane-replacement-git-review-required',
}

const releaseExcluded: PendingDeletionReleaseExcludedArchiveRegister = {
  schemaVersion: 'dsxu.pending-deletion-release-excluded-archive-register.v1',
  status: 'PARTIAL',
  sourceLaneStatus: 'PARTIAL',
  sourceLaneId: 'PDL-02',
  entryCount: 4,
  pathCount: 24,
  privateStateEntryCount: 1,
  historicalEvidenceEntryCount: 1,
  benchGoldenFixtureEntryCount: 1,
  evalBenchScriptEntryCount: 1,
  missingReplacementEvidenceEntryCount: 0,
  unknownArchiveOwnerEntryCount: 0,
  releasePayloadAllowed: false,
  boardAuthorizesMutation: false,
  mustNotStageDeleteRestoreReset: true,
  entries: [],
  blockers: [],
  safeguards: [],
  nextAction: 'release-excluded-archive-git-review-required',
}

const oldRootShim: PendingDeletionOldRootShimReplacementRegister = {
  schemaVersion: 'dsxu.pending-deletion-old-root-shim-replacement-register.v1',
  status: 'PARTIAL',
  sourceLaneStatus: 'PARTIAL',
  sourceLaneId: 'PDL-03',
  entryCount: 3,
  pathCount: 8,
  entrypointLauncherEntryCount: 1,
  directConnectProviderEntryCount: 1,
  verificationToolingEntryCount: 1,
  missingReplacementEvidenceEntryCount: 0,
  unknownReplacementOwnerEntryCount: 0,
  oldShimRuntimeAllowed: false,
  boardAuthorizesMutation: false,
  mustNotStageDeleteRestoreReset: true,
  entries: [],
  blockers: [],
  safeguards: [],
  nextAction: 'old-root-shim-replacement-git-review-required',
}

describe('OGC-02E - Pending Deletion Owner Review Rollup Register V1', () => {
  test('rolls up all pending deletion owner lanes without runtime or release-payload shortcuts', () => {
    const register = buildPendingDeletionOwnerReviewRollupRegister({
      source,
      controlPlane,
      releaseExcluded,
      oldRootShim,
    })

    expect(register.schemaVersion).toBe('dsxu.pending-deletion-owner-review-rollup-register.v1')
    expect(register.status).toBe('PARTIAL')
    expect(register.laneCount).toBe(3)
    expect(register.entryCount).toBe(11)
    expect(register.pathCount).toBe(69)
    expect(register.sourceEntryCount).toBe(11)
    expect(register.sourcePathCount).toBe(69)
    expect(register.missingEvidenceEntryCount).toBe(0)
    expect(register.unknownOwnerEntryCount).toBe(0)
    expect(register.standaloneRuntimeOrReleasePayloadAllowed).toBe(false)
    expect(register.boardAuthorizesMutation).toBe(false)
    expect(register.mustNotStageDeleteRestoreReset).toBe(true)
    expect(register.nextAction).toBe('pending-deletion-owner-git-review-required')
  })

  test('blocks count drift instead of hiding pending deletion in a generic bucket', () => {
    const register = buildPendingDeletionOwnerReviewRollupRegister({
      source,
      controlPlane: {
        ...controlPlane,
        pathCount: 36,
      },
      releaseExcluded,
      oldRootShim,
    })

    expect(register.status).toBe('BLOCKED')
    expect(register.blockers).toContain('owner rollup path count does not match source pending deletion path count')
    expect(register.nextAction).toBe('fix-pending-deletion-owner-rollup-evidence')
  })

  test('writes current owner rollup evidence without mutating git state', async () => {
    const register = await runPendingDeletionOwnerReviewRollupRegisterHarness()

    expect(register.evidencePath).toContain('pending-deletion-owner-review-rollup-register.evidence.json')
    expect(register.tracePath).toContain('pending-deletion-owner-review-rollup-register.trace.json')
    expect(existsSync(register.evidencePath)).toBe(true)
    expect(existsSync(register.tracePath)).toBe(true)
    expect(register.status).toBe('PARTIAL')
    expect(register.laneCount).toBe(3)
    expect(register.entryCount).toBe(11)
    expect(register.pathCount).toBe(69)
    expect(register.missingEvidenceEntryCount).toBe(0)
    expect(register.unknownOwnerEntryCount).toBe(0)
    expect(register.standaloneRuntimeOrReleasePayloadAllowed).toBe(false)
    expect(register.mustNotStageDeleteRestoreReset).toBe(true)
  }, 180_000)
})
