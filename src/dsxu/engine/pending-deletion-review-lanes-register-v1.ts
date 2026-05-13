import type {
  PendingDeletionSignoffEntry,
  PendingDeletionSignoffRegister,
} from './pending-deletion-signoff-register-v1'
import type { OwnerGitClosureStatus } from './owner-git-closure-board-v1'

export type PendingDeletionReviewLaneId =
  | 'PDL-01'
  | 'PDL-02'
  | 'PDL-03'

export type PendingDeletionReviewLaneEntry = {
  id: string
  owner: string
  targetOwner: string
  closureDecision: string
  status: OwnerGitClosureStatus
  pathCount: number
  replacementEvidence: readonly string[]
  samplePaths: readonly string[]
  restorePolicy: string
  requiredAction: string
  forbiddenActions: readonly string[]
  redlines: readonly string[]
}

export type PendingDeletionReviewLane = {
  id: PendingDeletionReviewLaneId
  name: string
  status: OwnerGitClosureStatus
  owner: string
  entryCount: number
  pathCount: number
  replacementEvidenceVerifiedCount: number
  missingReplacementEvidenceCount: number
  requiredAction: string
  entries: readonly PendingDeletionReviewLaneEntry[]
  redlines: readonly string[]
}

export type PendingDeletionReviewLanesRegister = {
  schemaVersion: 'dsxu.pending-deletion-review-lanes-register.v1'
  status: OwnerGitClosureStatus
  sourceSignoffStatus: OwnerGitClosureStatus
  laneCount: number
  entryCount: number
  mainlineReplacementDeleteEntryCount: number
  releaseExcludedDeleteEntryCount: number
  oldRootShimDeleteEntryCount: number
  missingReplacementEvidenceEntryCount: number
  boardAuthorizesMutation: false
  mustNotStageDeleteRestoreReset: boolean
  lanes: readonly PendingDeletionReviewLane[]
  blockers: readonly string[]
  safeguards: readonly string[]
  nextAction:
    | 'pending-deletion-lane-git-review-required'
    | 'fix-pending-deletion-lane-evidence'
    | 'pending-deletion-lanes-closed'
}

function laneIdForDisposition(disposition: PendingDeletionSignoffEntry['disposition']): PendingDeletionReviewLaneId {
  if (disposition === 'ready-mainline-replacement-delete-review') return 'PDL-01'
  if (disposition === 'ready-release-excluded-delete-review') return 'PDL-02'
  return 'PDL-03'
}

function laneName(id: PendingDeletionReviewLaneId): string {
  if (id === 'PDL-01') return 'mainline replacement deletion review'
  if (id === 'PDL-02') return 'release-excluded deletion review'
  return 'old root shim deletion review'
}

function laneOwner(id: PendingDeletionReviewLaneId): string {
  if (id === 'PDL-01') return 'Control Plane / Mainline Replacement Owners'
  if (id === 'PDL-02') return 'Release Evidence / Eval Archive Owners'
  return 'Entrypoint / Direct Connect / Verification Tooling Owners'
}

function laneRequiredAction(id: PendingDeletionReviewLaneId): string {
  if (id === 'PDL-01') return 'close legacy control-plane shell deletions through normal Git review after replacement evidence is signed'
  if (id === 'PDL-02') return 'close release-excluded private/history/eval deletions only after release/export exclusion evidence is signed'
  return 'close old root launchers, proxy shims, and root test scripts through normal Git review after replacement evidence is signed'
}

function buildLaneEntry(entry: PendingDeletionSignoffEntry): PendingDeletionReviewLaneEntry {
  return {
    id: entry.id,
    owner: entry.owner,
    targetOwner: entry.targetOwner,
    closureDecision: entry.closureDecision,
    status: entry.status,
    pathCount: entry.pathCount,
    replacementEvidence: entry.replacementEvidence,
    samplePaths: entry.samplePaths,
    restorePolicy: entry.restorePolicy,
    requiredAction: entry.requiredAction,
    forbiddenActions: [
      ...entry.forbiddenActions,
      'do not use pending deletion review as permission to delete or stage files automatically',
      'do not keep deleted legacy paths as compatibility product runtime',
    ],
    redlines: entry.redlines,
  }
}

function buildLane(
  id: PendingDeletionReviewLaneId,
  entries: readonly PendingDeletionSignoffEntry[],
): PendingDeletionReviewLane {
  const laneEntries = entries.map(buildLaneEntry)
  const missingReplacementEvidenceCount = laneEntries
    .filter(entry => entry.replacementEvidence.length === 0 || entry.redlines.some(redline => /missing/i.test(redline))).length
  const redlines = [
    ...(missingReplacementEvidenceCount > 0 ? ['pending deletion lane has missing replacement evidence'] : []),
  ]
  const status: OwnerGitClosureStatus = redlines.length > 0
    ? 'BLOCKED'
    : laneEntries.length > 0
      ? 'PARTIAL'
      : 'PASS'

  return {
    id,
    name: laneName(id),
    status,
    owner: laneOwner(id),
    entryCount: laneEntries.length,
    pathCount: laneEntries.reduce((sum, entry) => sum + entry.pathCount, 0),
    replacementEvidenceVerifiedCount: laneEntries.length - missingReplacementEvidenceCount,
    missingReplacementEvidenceCount,
    requiredAction: laneRequiredAction(id),
    entries: laneEntries,
    redlines,
  }
}

export function buildPendingDeletionReviewLanesRegister(
  source: PendingDeletionSignoffRegister,
): PendingDeletionReviewLanesRegister {
  const laneIds: PendingDeletionReviewLaneId[] = ['PDL-01', 'PDL-02', 'PDL-03']
  const lanes = laneIds.map(id => buildLane(
    id,
    source.entries.filter(entry => laneIdForDisposition(entry.disposition) === id),
  ))
  const missingReplacementEvidenceEntryCount = lanes
    .reduce((sum, lane) => sum + lane.missingReplacementEvidenceCount, 0)
  const blockers = [
    ...(source.blockers.length > 0 ? ['source pending deletion signoff register has blockers'] : []),
    ...(missingReplacementEvidenceEntryCount > 0 ? ['pending deletion lanes have missing replacement evidence'] : []),
  ]
  const status: OwnerGitClosureStatus = blockers.length > 0
    ? 'BLOCKED'
    : source.entryCount > 0
      ? 'PARTIAL'
      : 'PASS'

  return {
    schemaVersion: 'dsxu.pending-deletion-review-lanes-register.v1',
    status,
    sourceSignoffStatus: source.status,
    laneCount: lanes.length,
    entryCount: source.entryCount,
    mainlineReplacementDeleteEntryCount: lanes.find(lane => lane.id === 'PDL-01')?.entryCount ?? 0,
    releaseExcludedDeleteEntryCount: lanes.find(lane => lane.id === 'PDL-02')?.entryCount ?? 0,
    oldRootShimDeleteEntryCount: lanes.find(lane => lane.id === 'PDL-03')?.entryCount ?? 0,
    missingReplacementEvidenceEntryCount,
    boardAuthorizesMutation: false,
    mustNotStageDeleteRestoreReset: status !== 'PASS',
    lanes,
    blockers,
    safeguards: [
      'register is evidence-only and does not stage, delete, restore, reset, move, commit, or export files',
      'pending deletion lanes require normal Git review even when replacement evidence is verified',
      'mainline replacement deletions must not be restored as control-plane or bridge compatibility runtimes',
      'release-excluded deletions must not be restored into release/export payloads',
      'old root shims must not be kept as launcher, proxy, or test compatibility paths',
    ],
    nextAction: blockers.length > 0
      ? 'fix-pending-deletion-lane-evidence'
      : source.entryCount > 0
        ? 'pending-deletion-lane-git-review-required'
        : 'pending-deletion-lanes-closed',
  }
}
