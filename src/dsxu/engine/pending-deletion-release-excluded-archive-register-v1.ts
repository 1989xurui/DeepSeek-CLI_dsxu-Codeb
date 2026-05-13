import type {
  OwnerGitClosureStatus,
} from './owner-git-closure-board-v1'
import type {
  PendingDeletionReviewLaneEntry,
  PendingDeletionReviewLanesRegister,
} from './pending-deletion-review-lanes-register-v1'

export type PendingDeletionReleaseExcludedArchiveOwner =
  | 'release-private-state'
  | 'historical-milestone-evidence'
  | 'dsevo-bench-golden-fixtures'
  | 'eval-bench-scripts'
  | 'unknown-release-excluded-archive'

export type PendingDeletionReleaseExcludedArchiveEntry = {
  id: string
  sourceEntryId: string
  owner: string
  targetOwner: string
  archiveOwner: PendingDeletionReleaseExcludedArchiveOwner
  releaseBoundary: string
  status: OwnerGitClosureStatus
  pathCount: number
  replacementEvidence: readonly string[]
  samplePaths: readonly string[]
  requiredAction: string
  restorePolicy: string
  forbiddenActions: readonly string[]
  redlines: readonly string[]
}

export type PendingDeletionReleaseExcludedArchiveRegister = {
  schemaVersion: 'dsxu.pending-deletion-release-excluded-archive-register.v1'
  status: OwnerGitClosureStatus
  sourceLaneStatus: OwnerGitClosureStatus
  sourceLaneId: 'PDL-02'
  entryCount: number
  pathCount: number
  privateStateEntryCount: number
  historicalEvidenceEntryCount: number
  benchGoldenFixtureEntryCount: number
  evalBenchScriptEntryCount: number
  missingReplacementEvidenceEntryCount: number
  unknownArchiveOwnerEntryCount: number
  releasePayloadAllowed: false
  boardAuthorizesMutation: false
  mustNotStageDeleteRestoreReset: boolean
  entries: readonly PendingDeletionReleaseExcludedArchiveEntry[]
  blockers: readonly string[]
  safeguards: readonly string[]
  nextAction:
    | 'release-excluded-archive-git-review-required'
    | 'fix-release-excluded-archive-evidence'
    | 'release-excluded-archive-review-closed'
}

function archiveOwnerForEntry(entry: PendingDeletionReviewLaneEntry): PendingDeletionReleaseExcludedArchiveOwner {
  if (entry.id === 'PDR-02.01') return 'release-private-state'
  if (entry.id === 'PDR-02.02') return 'historical-milestone-evidence'
  if (entry.id === 'PDR-02.03') return 'dsevo-bench-golden-fixtures'
  if (entry.id === 'PDR-02.04') return 'eval-bench-scripts'
  return 'unknown-release-excluded-archive'
}

function releaseBoundaryForOwner(owner: PendingDeletionReleaseExcludedArchiveOwner): string {
  if (owner === 'release-private-state') return 'clean export excludes private config state'
  if (owner === 'historical-milestone-evidence') return 'historical milestone evidence stays outside release payload'
  if (owner === 'dsevo-bench-golden-fixtures') return 'P12/raw eval evidence or release-excluded benchmark archive'
  if (owner === 'eval-bench-scripts') return 'current P12/raw comparison evidence replaces old eval scripts'
  return 'unknown release-excluded archive owner'
}

function entryMissingEvidence(entry: PendingDeletionReviewLaneEntry): boolean {
  return entry.replacementEvidence.length === 0 || entry.redlines.some(redline => /missing/i.test(redline))
}

function buildEntry(entry: PendingDeletionReviewLaneEntry): PendingDeletionReleaseExcludedArchiveEntry {
  const archiveOwner = archiveOwnerForEntry(entry)
  const missingEvidence = entryMissingEvidence(entry)
  const unknownOwner = archiveOwner === 'unknown-release-excluded-archive'
  const redlines = [
    ...entry.redlines,
    ...(missingEvidence ? ['release-excluded archive replacement evidence is missing'] : []),
    ...(unknownOwner ? ['release-excluded pending deletion entry has no archive owner mapping'] : []),
  ]

  return {
    id: `PDL-02.${entry.id.split('.').at(-1) ?? entry.id}`,
    sourceEntryId: entry.id,
    owner: entry.owner,
    targetOwner: entry.targetOwner,
    archiveOwner,
    releaseBoundary: releaseBoundaryForOwner(archiveOwner),
    status: redlines.length > 0 ? 'BLOCKED' : 'PARTIAL',
    pathCount: entry.pathCount,
    replacementEvidence: entry.replacementEvidence,
    samplePaths: entry.samplePaths,
    requiredAction: entry.requiredAction,
    restorePolicy: entry.restorePolicy,
    forbiddenActions: [
      ...entry.forbiddenActions,
      'do not restore private/history/eval files into source to lower pending deletion count',
      'do not add release-excluded archive material to clean export or release payload',
      'do not convert old eval scripts into a product runtime or benchmark shortcut',
    ],
    redlines,
  }
}

export function buildPendingDeletionReleaseExcludedArchiveRegister(
  source: PendingDeletionReviewLanesRegister,
): PendingDeletionReleaseExcludedArchiveRegister {
  const sourceLane = source.lanes.find(lane => lane.id === 'PDL-02')
  const entries = (sourceLane?.entries ?? []).map(buildEntry)
  const missingReplacementEvidenceEntryCount = entries
    .filter(entry => entry.redlines.some(redline => /missing/i.test(redline))).length
  const unknownArchiveOwnerEntryCount = entries
    .filter(entry => entry.archiveOwner === 'unknown-release-excluded-archive').length
  const blockers = [
    ...(!sourceLane ? ['PDL-02 source lane is missing'] : []),
    ...(source.blockers.length > 0 ? ['source pending deletion review lanes register has blockers'] : []),
    ...(missingReplacementEvidenceEntryCount > 0 ? ['release-excluded archive entries have missing evidence'] : []),
    ...(unknownArchiveOwnerEntryCount > 0 ? ['release-excluded archive entries have unknown owner mapping'] : []),
  ]
  const status: OwnerGitClosureStatus = blockers.length > 0
    ? 'BLOCKED'
    : entries.length > 0
      ? 'PARTIAL'
      : 'PASS'

  return {
    schemaVersion: 'dsxu.pending-deletion-release-excluded-archive-register.v1',
    status,
    sourceLaneStatus: sourceLane?.status ?? 'BLOCKED',
    sourceLaneId: 'PDL-02',
    entryCount: entries.length,
    pathCount: entries.reduce((sum, entry) => sum + entry.pathCount, 0),
    privateStateEntryCount: entries.filter(entry => entry.archiveOwner === 'release-private-state').length,
    historicalEvidenceEntryCount: entries.filter(entry => entry.archiveOwner === 'historical-milestone-evidence').length,
    benchGoldenFixtureEntryCount: entries.filter(entry => entry.archiveOwner === 'dsevo-bench-golden-fixtures').length,
    evalBenchScriptEntryCount: entries.filter(entry => entry.archiveOwner === 'eval-bench-scripts').length,
    missingReplacementEvidenceEntryCount,
    unknownArchiveOwnerEntryCount,
    releasePayloadAllowed: false,
    boardAuthorizesMutation: false,
    mustNotStageDeleteRestoreReset: status !== 'PASS',
    entries,
    blockers,
    safeguards: [
      'register is evidence-only and does not stage, delete, restore, reset, move, commit, or export files',
      'PDL-02 closes only through normal Git review after release/export exclusion evidence is signed',
      'private config, historical milestones, and old eval artifacts must stay out of release/export payloads',
      'old eval scripts must not be restored as benchmark, product, or provider runtimes',
      'P12/raw comparison evidence must be real evidence, not reconstructed from deleted archive paths',
    ],
    nextAction: blockers.length > 0
      ? 'fix-release-excluded-archive-evidence'
      : entries.length > 0
        ? 'release-excluded-archive-git-review-required'
        : 'release-excluded-archive-review-closed',
  }
}
