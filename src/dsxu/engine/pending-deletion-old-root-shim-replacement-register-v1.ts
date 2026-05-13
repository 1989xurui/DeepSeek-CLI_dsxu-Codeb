import type {
  OwnerGitClosureStatus,
} from './owner-git-closure-board-v1'
import type {
  PendingDeletionReviewLaneEntry,
  PendingDeletionReviewLanesRegister,
} from './pending-deletion-review-lanes-register-v1'

export type PendingDeletionOldRootShimReplacementOwner =
  | 'entrypoint-launcher'
  | 'direct-connect-provider-runtime'
  | 'verification-tooling'
  | 'unknown-old-root-shim'

export type PendingDeletionOldRootShimReplacementEntry = {
  id: string
  sourceEntryId: string
  owner: string
  targetOwner: string
  replacementOwner: PendingDeletionOldRootShimReplacementOwner
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

export type PendingDeletionOldRootShimReplacementRegister = {
  schemaVersion: 'dsxu.pending-deletion-old-root-shim-replacement-register.v1'
  status: OwnerGitClosureStatus
  sourceLaneStatus: OwnerGitClosureStatus
  sourceLaneId: 'PDL-03'
  entryCount: number
  pathCount: number
  entrypointLauncherEntryCount: number
  directConnectProviderEntryCount: number
  verificationToolingEntryCount: number
  missingReplacementEvidenceEntryCount: number
  unknownReplacementOwnerEntryCount: number
  oldShimRuntimeAllowed: false
  boardAuthorizesMutation: false
  mustNotStageDeleteRestoreReset: boolean
  entries: readonly PendingDeletionOldRootShimReplacementEntry[]
  blockers: readonly string[]
  safeguards: readonly string[]
  nextAction:
    | 'old-root-shim-replacement-git-review-required'
    | 'fix-old-root-shim-replacement-evidence'
    | 'old-root-shim-replacement-review-closed'
}

function replacementOwnerForEntry(entry: PendingDeletionReviewLaneEntry): PendingDeletionOldRootShimReplacementOwner {
  if (entry.id === 'PDR-03.01') return 'entrypoint-launcher'
  if (entry.id === 'PDR-03.02') return 'direct-connect-provider-runtime'
  if (entry.id === 'PDR-03.03') return 'verification-tooling'
  return 'unknown-old-root-shim'
}

function replacementBoundaryForOwner(owner: PendingDeletionOldRootShimReplacementOwner): string {
  if (owner === 'entrypoint-launcher') return 'Start-DSXU-Code launchers and current CLI entrypoint'
  if (owner === 'direct-connect-provider-runtime') return 'direct-connect/provider runtime contract and network facade'
  if (owner === 'verification-tooling') return 'current Bun/focused verification harnesses'
  return 'unknown old root shim replacement owner'
}

function entryMissingEvidence(entry: PendingDeletionReviewLaneEntry): boolean {
  return entry.replacementEvidence.length === 0 || entry.redlines.some(redline => /missing/i.test(redline))
}

function buildEntry(entry: PendingDeletionReviewLaneEntry): PendingDeletionOldRootShimReplacementEntry {
  const replacementOwner = replacementOwnerForEntry(entry)
  const missingEvidence = entryMissingEvidence(entry)
  const unknownOwner = replacementOwner === 'unknown-old-root-shim'
  const redlines = [
    ...entry.redlines,
    ...(missingEvidence ? ['old root shim replacement evidence is missing'] : []),
    ...(unknownOwner ? ['old root shim pending deletion entry has no replacement owner mapping'] : []),
  ]

  return {
    id: `PDL-03.${entry.id.split('.').at(-1) ?? entry.id}`,
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
      'do not restore old root launchers as alternate product entrypoints',
      'do not restore old proxy shims as a second provider runtime',
      'do not keep root test scripts as compatibility verification surfaces',
    ],
    redlines,
  }
}

export function buildPendingDeletionOldRootShimReplacementRegister(
  source: PendingDeletionReviewLanesRegister,
): PendingDeletionOldRootShimReplacementRegister {
  const sourceLane = source.lanes.find(lane => lane.id === 'PDL-03')
  const entries = (sourceLane?.entries ?? []).map(buildEntry)
  const missingReplacementEvidenceEntryCount = entries
    .filter(entry => entry.redlines.some(redline => /missing/i.test(redline))).length
  const unknownReplacementOwnerEntryCount = entries
    .filter(entry => entry.replacementOwner === 'unknown-old-root-shim').length
  const blockers = [
    ...(!sourceLane ? ['PDL-03 source lane is missing'] : []),
    ...(source.blockers.length > 0 ? ['source pending deletion review lanes register has blockers'] : []),
    ...(missingReplacementEvidenceEntryCount > 0 ? ['old root shim replacement entries have missing evidence'] : []),
    ...(unknownReplacementOwnerEntryCount > 0 ? ['old root shim replacement entries have unknown owner mapping'] : []),
  ]
  const status: OwnerGitClosureStatus = blockers.length > 0
    ? 'BLOCKED'
    : entries.length > 0
      ? 'PARTIAL'
      : 'PASS'

  return {
    schemaVersion: 'dsxu.pending-deletion-old-root-shim-replacement-register.v1',
    status,
    sourceLaneStatus: sourceLane?.status ?? 'BLOCKED',
    sourceLaneId: 'PDL-03',
    entryCount: entries.length,
    pathCount: entries.reduce((sum, entry) => sum + entry.pathCount, 0),
    entrypointLauncherEntryCount: entries.filter(entry => entry.replacementOwner === 'entrypoint-launcher').length,
    directConnectProviderEntryCount: entries.filter(entry => entry.replacementOwner === 'direct-connect-provider-runtime').length,
    verificationToolingEntryCount: entries.filter(entry => entry.replacementOwner === 'verification-tooling').length,
    missingReplacementEvidenceEntryCount,
    unknownReplacementOwnerEntryCount,
    oldShimRuntimeAllowed: false,
    boardAuthorizesMutation: false,
    mustNotStageDeleteRestoreReset: status !== 'PASS',
    entries,
    blockers,
    safeguards: [
      'register is evidence-only and does not stage, delete, restore, reset, move, commit, or export files',
      'PDL-03 closes only through normal Git review after replacement evidence is signed',
      'old launchers must not be restored as alternate product entrypoints',
      'old proxy shims must not be restored as a second provider runtime',
      'old root test scripts must not be restored as compatibility verification surfaces',
    ],
    nextAction: blockers.length > 0
      ? 'fix-old-root-shim-replacement-evidence'
      : entries.length > 0
        ? 'old-root-shim-replacement-git-review-required'
        : 'old-root-shim-replacement-review-closed',
  }
}
