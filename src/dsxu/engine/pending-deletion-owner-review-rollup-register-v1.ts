import type {
  OwnerGitClosureStatus,
} from './owner-git-closure-board-v1'
import type {
  PendingDeletionControlPlaneReplacementRegister,
} from './pending-deletion-control-plane-replacement-register-v1'
import type {
  PendingDeletionOldRootShimReplacementRegister,
} from './pending-deletion-old-root-shim-replacement-register-v1'
import type {
  PendingDeletionReleaseExcludedArchiveRegister,
} from './pending-deletion-release-excluded-archive-register-v1'
import type {
  PendingDeletionReviewLanesRegister,
} from './pending-deletion-review-lanes-register-v1'

export type PendingDeletionOwnerReviewRollupLane = {
  id: 'PDL-01' | 'PDL-02' | 'PDL-03'
  status: OwnerGitClosureStatus
  entryCount: number
  pathCount: number
  missingEvidenceEntryCount: number
  unknownOwnerEntryCount: number
  runtimeOrPayloadAllowed: false
  nextAction: string
}

export type PendingDeletionOwnerReviewRollupRegister = {
  schemaVersion: 'dsxu.pending-deletion-owner-review-rollup-register.v1'
  status: OwnerGitClosureStatus
  sourceLaneStatus: OwnerGitClosureStatus
  laneCount: number
  entryCount: number
  pathCount: number
  sourceEntryCount: number
  sourcePathCount: number
  missingEvidenceEntryCount: number
  unknownOwnerEntryCount: number
  standaloneRuntimeOrReleasePayloadAllowed: false
  boardAuthorizesMutation: false
  mustNotStageDeleteRestoreReset: boolean
  lanes: readonly PendingDeletionOwnerReviewRollupLane[]
  blockers: readonly string[]
  safeguards: readonly string[]
  nextAction:
    | 'pending-deletion-owner-git-review-required'
    | 'fix-pending-deletion-owner-rollup-evidence'
    | 'pending-deletion-owner-review-rollup-closed'
}

function laneFromControlPlane(
  register: PendingDeletionControlPlaneReplacementRegister,
): PendingDeletionOwnerReviewRollupLane {
  return {
    id: 'PDL-01',
    status: register.status,
    entryCount: register.entryCount,
    pathCount: register.pathCount,
    missingEvidenceEntryCount: register.missingReplacementEvidenceEntryCount,
    unknownOwnerEntryCount: register.unknownReplacementOwnerEntryCount,
    runtimeOrPayloadAllowed: register.standaloneRuntimeAllowed,
    nextAction: register.nextAction,
  }
}

function laneFromReleaseExcluded(
  register: PendingDeletionReleaseExcludedArchiveRegister,
): PendingDeletionOwnerReviewRollupLane {
  return {
    id: 'PDL-02',
    status: register.status,
    entryCount: register.entryCount,
    pathCount: register.pathCount,
    missingEvidenceEntryCount: register.missingReplacementEvidenceEntryCount,
    unknownOwnerEntryCount: register.unknownArchiveOwnerEntryCount,
    runtimeOrPayloadAllowed: register.releasePayloadAllowed,
    nextAction: register.nextAction,
  }
}

function laneFromOldRootShim(
  register: PendingDeletionOldRootShimReplacementRegister,
): PendingDeletionOwnerReviewRollupLane {
  return {
    id: 'PDL-03',
    status: register.status,
    entryCount: register.entryCount,
    pathCount: register.pathCount,
    missingEvidenceEntryCount: register.missingReplacementEvidenceEntryCount,
    unknownOwnerEntryCount: register.unknownReplacementOwnerEntryCount,
    runtimeOrPayloadAllowed: register.oldShimRuntimeAllowed,
    nextAction: register.nextAction,
  }
}

export function buildPendingDeletionOwnerReviewRollupRegister(inputs: {
  source: PendingDeletionReviewLanesRegister
  controlPlane: PendingDeletionControlPlaneReplacementRegister
  releaseExcluded: PendingDeletionReleaseExcludedArchiveRegister
  oldRootShim: PendingDeletionOldRootShimReplacementRegister
}): PendingDeletionOwnerReviewRollupRegister {
  const lanes = [
    laneFromControlPlane(inputs.controlPlane),
    laneFromReleaseExcluded(inputs.releaseExcluded),
    laneFromOldRootShim(inputs.oldRootShim),
  ]
  const missingEvidenceEntryCount = lanes.reduce((sum, lane) => sum + lane.missingEvidenceEntryCount, 0)
  const unknownOwnerEntryCount = lanes.reduce((sum, lane) => sum + lane.unknownOwnerEntryCount, 0)
  const entryCount = lanes.reduce((sum, lane) => sum + lane.entryCount, 0)
  const pathCount = lanes.reduce((sum, lane) => sum + lane.pathCount, 0)
  const sourcePathCount = inputs.source.lanes.reduce((sum, lane) => sum + lane.pathCount, 0)
  const blockers = [
    ...(inputs.source.blockers.length > 0 ? ['source pending deletion review lanes register has blockers'] : []),
    ...(entryCount !== inputs.source.entryCount ? ['owner rollup entry count does not match source pending deletion entry count'] : []),
    ...(pathCount !== sourcePathCount ? ['owner rollup path count does not match source pending deletion path count'] : []),
    ...(missingEvidenceEntryCount > 0 ? ['pending deletion owner rollup has missing replacement evidence'] : []),
    ...(unknownOwnerEntryCount > 0 ? ['pending deletion owner rollup has unknown owner mapping'] : []),
  ]
  const status: OwnerGitClosureStatus = blockers.length > 0
    ? 'BLOCKED'
    : entryCount > 0
      ? 'PARTIAL'
      : 'PASS'

  return {
    schemaVersion: 'dsxu.pending-deletion-owner-review-rollup-register.v1',
    status,
    sourceLaneStatus: inputs.source.status,
    laneCount: lanes.length,
    entryCount,
    pathCount,
    sourceEntryCount: inputs.source.entryCount,
    sourcePathCount,
    missingEvidenceEntryCount,
    unknownOwnerEntryCount,
    standaloneRuntimeOrReleasePayloadAllowed: false,
    boardAuthorizesMutation: false,
    mustNotStageDeleteRestoreReset: status !== 'PASS',
    lanes,
    blockers,
    safeguards: [
      'register is evidence-only and does not stage, delete, restore, reset, move, commit, or export files',
      'all pending deletion owner slices must close through normal Git review',
      'control-plane bridge paths must not return as a standalone or compatibility runtime',
      'release-excluded private/history/eval material must not enter clean export or release payload',
      'old launchers, proxy shims, and root test scripts must not return as alternate runtime surfaces',
    ],
    nextAction: blockers.length > 0
      ? 'fix-pending-deletion-owner-rollup-evidence'
      : entryCount > 0
        ? 'pending-deletion-owner-git-review-required'
        : 'pending-deletion-owner-review-rollup-closed',
  }
}
