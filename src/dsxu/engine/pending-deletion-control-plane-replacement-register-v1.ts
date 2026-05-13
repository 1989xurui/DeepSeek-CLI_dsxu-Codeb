import type {
  OwnerGitClosureStatus,
} from './owner-git-closure-board-v1'
import type {
  PendingDeletionReviewLaneEntry,
  PendingDeletionReviewLanesRegister,
} from './pending-deletion-review-lanes-register-v1'

export type PendingDeletionControlPlaneReplacementOwner =
  | 'control-plane-runtime-shell'
  | 'control-plane-permission-session'
  | 'remote-network-transport'
  | 'visible-state-diagnostics'
  | 'unknown-control-plane-replacement'

export type PendingDeletionControlPlaneReplacementEntry = {
  id: string
  sourceEntryId: string
  owner: string
  targetOwner: string
  replacementOwner: PendingDeletionControlPlaneReplacementOwner
  replacementBoundary: string
  status: OwnerGitClosureStatus
  pathCount: number
  replacementEvidence: readonly string[]
  samplePaths: readonly string[]
  requiredAction: string
  restorePolicy: string
  forbiddenActions: readonly string[]
  redlines: readonly string[]
}

export type PendingDeletionControlPlaneReplacementRegister = {
  schemaVersion: 'dsxu.pending-deletion-control-plane-replacement-register.v1'
  status: OwnerGitClosureStatus
  sourceLaneStatus: OwnerGitClosureStatus
  sourceLaneId: 'PDL-01'
  entryCount: number
  pathCount: number
  runtimeShellEntryCount: number
  permissionSessionEntryCount: number
  transportEntryCount: number
  visibleStateEntryCount: number
  missingReplacementEvidenceEntryCount: number
  unknownReplacementOwnerEntryCount: number
  standaloneRuntimeAllowed: false
  boardAuthorizesMutation: false
  mustNotStageDeleteRestoreReset: boolean
  entries: readonly PendingDeletionControlPlaneReplacementEntry[]
  blockers: readonly string[]
  safeguards: readonly string[]
  nextAction:
    | 'control-plane-replacement-git-review-required'
    | 'fix-control-plane-replacement-evidence'
    | 'control-plane-replacement-review-closed'
}

function replacementOwnerForEntry(entry: PendingDeletionReviewLaneEntry): PendingDeletionControlPlaneReplacementOwner {
  if (entry.id === 'PDR-01.01') return 'control-plane-runtime-shell'
  if (entry.id === 'PDR-01.02') return 'control-plane-permission-session'
  if (entry.id === 'PDR-01.03') return 'remote-network-transport'
  if (entry.id === 'PDR-01.04') return 'visible-state-diagnostics'
  return 'unknown-control-plane-replacement'
}

function replacementBoundaryForOwner(owner: PendingDeletionControlPlaneReplacementOwner): string {
  if (owner === 'control-plane-runtime-shell') {
    return 'mainline control-plane lifecycle plus direct-connect contract'
  }
  if (owner === 'control-plane-permission-session') {
    return 'Tool Gate permission/session lifecycle and control-plane permission bridge'
  }
  if (owner === 'remote-network-transport') {
    return 'remote network workflow and network facade adapter boundary'
  }
  if (owner === 'visible-state-diagnostics') {
    return 'query-loop visible-state projection and control-plane diagnostics'
  }
  return 'unknown replacement owner'
}

function ownerMissingEvidence(entry: PendingDeletionReviewLaneEntry): boolean {
  return entry.replacementEvidence.length === 0 || entry.redlines.some(redline => /missing/i.test(redline))
}

function buildEntry(entry: PendingDeletionReviewLaneEntry): PendingDeletionControlPlaneReplacementEntry {
  const replacementOwner = replacementOwnerForEntry(entry)
  const missingEvidence = ownerMissingEvidence(entry)
  const unknownOwner = replacementOwner === 'unknown-control-plane-replacement'
  const redlines = [
    ...entry.redlines,
    ...(missingEvidence ? ['control-plane replacement evidence is missing'] : []),
    ...(unknownOwner ? ['control-plane pending deletion entry has no replacement owner mapping'] : []),
  ]

  return {
    id: `PDL-01.${entry.id.split('.').at(-1) ?? entry.id}`,
    sourceEntryId: entry.id,
    owner: entry.owner,
    targetOwner: entry.targetOwner,
    replacementOwner,
    replacementBoundary: replacementBoundaryForOwner(replacementOwner),
    status: redlines.length > 0 ? 'BLOCKED' : 'PARTIAL',
    pathCount: entry.pathCount,
    replacementEvidence: entry.replacementEvidence,
    samplePaths: entry.samplePaths,
    requiredAction: entry.requiredAction,
    restorePolicy: entry.restorePolicy,
    forbiddenActions: [
      ...entry.forbiddenActions,
      'do not keep src/bridge as a standalone product runtime',
      'do not reintroduce bridge, remote, or upstreamproxy compatibility paths',
      'do not hide deleted bridge behavior behind a new adapter shortcut',
    ],
    redlines,
  }
}

export function buildPendingDeletionControlPlaneReplacementRegister(
  source: PendingDeletionReviewLanesRegister,
): PendingDeletionControlPlaneReplacementRegister {
  const sourceLane = source.lanes.find(lane => lane.id === 'PDL-01')
  const entries = (sourceLane?.entries ?? []).map(buildEntry)
  const missingReplacementEvidenceEntryCount = entries
    .filter(entry => entry.redlines.some(redline => /missing/i.test(redline))).length
  const unknownReplacementOwnerEntryCount = entries
    .filter(entry => entry.replacementOwner === 'unknown-control-plane-replacement').length
  const blockers = [
    ...(!sourceLane ? ['PDL-01 source lane is missing'] : []),
    ...(source.blockers.length > 0 ? ['source pending deletion review lanes register has blockers'] : []),
    ...(missingReplacementEvidenceEntryCount > 0 ? ['control-plane replacement entries have missing evidence'] : []),
    ...(unknownReplacementOwnerEntryCount > 0 ? ['control-plane replacement entries have unknown owner mapping'] : []),
  ]
  const status: OwnerGitClosureStatus = blockers.length > 0
    ? 'BLOCKED'
    : entries.length > 0
      ? 'PARTIAL'
      : 'PASS'

  return {
    schemaVersion: 'dsxu.pending-deletion-control-plane-replacement-register.v1',
    status,
    sourceLaneStatus: sourceLane?.status ?? 'BLOCKED',
    sourceLaneId: 'PDL-01',
    entryCount: entries.length,
    pathCount: entries.reduce((sum, entry) => sum + entry.pathCount, 0),
    runtimeShellEntryCount: entries.filter(entry => entry.replacementOwner === 'control-plane-runtime-shell').length,
    permissionSessionEntryCount: entries.filter(entry => entry.replacementOwner === 'control-plane-permission-session').length,
    transportEntryCount: entries.filter(entry => entry.replacementOwner === 'remote-network-transport').length,
    visibleStateEntryCount: entries.filter(entry => entry.replacementOwner === 'visible-state-diagnostics').length,
    missingReplacementEvidenceEntryCount,
    unknownReplacementOwnerEntryCount,
    standaloneRuntimeAllowed: false,
    boardAuthorizesMutation: false,
    mustNotStageDeleteRestoreReset: status !== 'PASS',
    entries,
    blockers,
    safeguards: [
      'register is evidence-only and does not stage, delete, restore, reset, move, commit, or export files',
      'PDL-01 closes only through normal Git review after replacement evidence is signed',
      'legacy src/bridge paths must not be restored as a standalone runtime or compatibility runtime',
      'permission/session behavior belongs to Tool Gate and the control-plane permission bridge',
      'transport behavior belongs to remote network workflow plus network facade adapter boundary',
      'debug/UI behavior belongs to query-loop visible-state projection and control-plane diagnostics',
    ],
    nextAction: blockers.length > 0
      ? 'fix-control-plane-replacement-evidence'
      : entries.length > 0
        ? 'control-plane-replacement-git-review-required'
        : 'control-plane-replacement-review-closed',
  }
}
