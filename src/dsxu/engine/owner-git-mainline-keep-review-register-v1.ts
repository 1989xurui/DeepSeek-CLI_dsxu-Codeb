import type {
  OwnerGitImportUseEvidenceEntry,
  OwnerGitImportUseEvidenceRegister,
} from './owner-git-import-use-evidence-register-v1'
import type { OwnerGitClosureStatus } from './owner-git-closure-board-v1'

export type OwnerGitMainlineKeepEvidenceState =
  | 'import-or-reference-evidence'
  | 'sample-exists-owner-evidence'
  | 'blocked-missing-owner-evidence'

export type OwnerGitMainlineKeepReviewEntry = {
  id: string
  owner: string
  targetOwner: string
  status: OwnerGitClosureStatus
  pathCount: number
  sampledPathCount: number
  existingSamplePathCount: number
  importedSamplePathCount: number
  referencedSamplePathCount: number
  evidenceState: OwnerGitMainlineKeepEvidenceState
  ownerEvidence: readonly string[]
  requiredAction: string
  forbiddenActions: readonly string[]
  samplePaths: readonly string[]
  importerPaths: readonly string[]
  referencePaths: readonly string[]
  redlines: readonly string[]
}

export type OwnerGitMainlineKeepReviewRegister = {
  schemaVersion: 'dsxu.owner-git-mainline-keep-review-register.v1'
  status: OwnerGitClosureStatus
  sourceImportUseStatus: OwnerGitClosureStatus
  entryCount: number
  importOrReferenceEvidenceEntryCount: number
  sampleExistsOwnerEvidenceEntryCount: number
  missingOwnerEvidenceEntryCount: number
  uniqueOwnerCount: number
  boardAuthorizesMutation: false
  mustNotStageDeleteRestoreReset: boolean
  entries: readonly OwnerGitMainlineKeepReviewEntry[]
  owners: readonly string[]
  blockers: readonly string[]
  safeguards: readonly string[]
  nextAction:
    | 'mainline-keep-owner-signoff-required'
    | 'fix-missing-mainline-owner-evidence'
    | 'mainline-keep-review-closed'
}

function unique(input: readonly string[]): readonly string[] {
  return [...new Set(input)]
}

function buildEntry(entry: OwnerGitImportUseEvidenceEntry): OwnerGitMainlineKeepReviewEntry {
  const samplePaths = entry.sampleEvidence.map(item => item.path)
  const importerPaths = unique(entry.sampleEvidence.flatMap(item => item.importerPaths))
  const referencePaths = unique(entry.sampleEvidence.flatMap(item => item.referencePaths))
  const missingOwnerEvidence = entry.ownerEvidenceStatus === 'MISSING_SAMPLE_PATH' || entry.evidence.length === 0
  const evidenceState: OwnerGitMainlineKeepEvidenceState = missingOwnerEvidence
    ? 'blocked-missing-owner-evidence'
    : entry.importedSamplePathCount > 0 || entry.referencedSamplePathCount > 0
      ? 'import-or-reference-evidence'
      : 'sample-exists-owner-evidence'
  const redlines = [
    ...entry.redlines,
    ...(missingOwnerEvidence ? ['mainline keep entry is missing owner/import-use evidence'] : []),
  ]

  return {
    id: entry.id,
    owner: entry.owner,
    targetOwner: entry.targetOwner,
    status: missingOwnerEvidence ? 'BLOCKED' : 'PARTIAL',
    pathCount: entry.pathCount,
    sampledPathCount: entry.sampledPathCount,
    existingSamplePathCount: entry.existingSamplePathCount,
    importedSamplePathCount: entry.importedSamplePathCount,
    referencedSamplePathCount: entry.referencedSamplePathCount,
    evidenceState,
    ownerEvidence: entry.evidence,
    requiredAction: entry.requiredAction,
    forbiddenActions: [
      'do not stage this mainline keep entry automatically',
      'do not collapse owner-specific keep entries into a generic dirty bucket',
      'do not treat import/use evidence as owner signoff',
      'do not use focused tests to authorize unrelated dirty paths',
    ],
    samplePaths,
    importerPaths,
    referencePaths,
    redlines,
  }
}

export function buildOwnerGitMainlineKeepReviewRegister(
  source: OwnerGitImportUseEvidenceRegister,
): OwnerGitMainlineKeepReviewRegister {
  const entries = source.entries
    .filter(entry => entry.disposition === 'ready-mainline-owner-signoff')
    .map(buildEntry)
  const missingOwnerEvidenceEntryCount = entries
    .filter(entry => entry.evidenceState === 'blocked-missing-owner-evidence').length
  const blockers = [
    ...(source.blockers.length > 0 ? ['source import/use register has blockers'] : []),
    ...(missingOwnerEvidenceEntryCount > 0 ? ['mainline keep entries have missing owner/import-use evidence'] : []),
  ]
  const status: OwnerGitClosureStatus = blockers.length > 0
    ? 'BLOCKED'
    : entries.length > 0
      ? 'PARTIAL'
      : 'PASS'
  const owners = unique(entries.map(entry => entry.owner)).sort((left, right) => left.localeCompare(right))

  return {
    schemaVersion: 'dsxu.owner-git-mainline-keep-review-register.v1',
    status,
    sourceImportUseStatus: source.status,
    entryCount: entries.length,
    importOrReferenceEvidenceEntryCount: entries.filter(entry => entry.evidenceState === 'import-or-reference-evidence').length,
    sampleExistsOwnerEvidenceEntryCount: entries.filter(entry => entry.evidenceState === 'sample-exists-owner-evidence').length,
    missingOwnerEvidenceEntryCount,
    uniqueOwnerCount: owners.length,
    boardAuthorizesMutation: false,
    mustNotStageDeleteRestoreReset: status !== 'PASS',
    entries,
    owners,
    blockers,
    safeguards: [
      'register is evidence-only and does not stage, delete, restore, reset, move, commit, or export files',
      'mainline keep entries require owner/Git signoff even when import/use evidence exists',
      'owner-specific keep entries must not be collapsed into a generic dirty bucket',
      'focused tests and import/use references narrow review scope but never authorize release closure by themselves',
    ],
    nextAction: blockers.length > 0
      ? 'fix-missing-mainline-owner-evidence'
      : entries.length > 0
        ? 'mainline-keep-owner-signoff-required'
        : 'mainline-keep-review-closed',
  }
}
