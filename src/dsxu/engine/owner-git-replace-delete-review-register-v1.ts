import type {
  OwnerGitImportUseEvidenceEntry,
  OwnerGitImportUseEvidenceRegister,
} from './owner-git-import-use-evidence-register-v1'
import type { OwnerGitClosureStatus } from './owner-git-closure-board-v1'

export type OwnerGitReplaceDeleteDisposition =
  | 'deleted-source-replacement-review'
  | 'backup-cleanup-review'
  | 'existing-duplicate-review'
  | 'blocked-missing-replacement-evidence'

export type OwnerGitReplaceDeleteReviewEntry = {
  id: string
  owner: string
  targetOwner: string
  disposition: OwnerGitReplaceDeleteDisposition
  status: OwnerGitClosureStatus
  pathCount: number
  existingSamplePathCount: number
  deletedSamplePathCount: number
  replacementEvidence: readonly string[]
  requiredAction: string
  forbiddenActions: readonly string[]
  samplePaths: readonly string[]
  importerPaths: readonly string[]
  referencePaths: readonly string[]
  redlines: readonly string[]
}

export type OwnerGitReplaceDeleteReviewRegister = {
  schemaVersion: 'dsxu.owner-git-replace-delete-review-register.v1'
  status: OwnerGitClosureStatus
  sourceImportUseStatus: OwnerGitClosureStatus
  entryCount: number
  deletedSourceReplacementEntryCount: number
  backupCleanupEntryCount: number
  existingDuplicateEntryCount: number
  missingReplacementEvidenceEntryCount: number
  boardAuthorizesMutation: false
  mustNotStageDeleteRestoreReset: boolean
  entries: readonly OwnerGitReplaceDeleteReviewEntry[]
  blockers: readonly string[]
  safeguards: readonly string[]
  nextAction:
    | 'replace-delete-git-review-required'
    | 'fix-missing-replacement-evidence'
    | 'replace-delete-review-closed'
}

function unique(input: readonly string[]): readonly string[] {
  return [...new Set(input)]
}

function dispositionForEntry(entry: OwnerGitImportUseEvidenceEntry): OwnerGitReplaceDeleteDisposition {
  if (entry.evidence.length === 0) return 'blocked-missing-replacement-evidence'
  if (entry.existingSamplePathCount > 0) {
    const isBackupCleanup = entry.sampleEvidence
      .some(item => /\.(backup|bak)$/i.test(item.path))
    return isBackupCleanup ? 'backup-cleanup-review' : 'existing-duplicate-review'
  }
  return 'deleted-source-replacement-review'
}

function buildEntry(entry: OwnerGitImportUseEvidenceEntry): OwnerGitReplaceDeleteReviewEntry {
  const disposition = dispositionForEntry(entry)
  const missingEvidence = disposition === 'blocked-missing-replacement-evidence'
  const samplePaths = entry.sampleEvidence.map(item => item.path)
  const importerPaths = unique(entry.sampleEvidence.flatMap(item => item.importerPaths))
  const referencePaths = unique(entry.sampleEvidence.flatMap(item => item.referencePaths))
  const redlines = [
    ...entry.redlines,
    ...(missingEvidence ? ['replace/delete candidate has missing replacement evidence'] : []),
  ]

  return {
    id: entry.id,
    owner: entry.owner,
    targetOwner: entry.targetOwner,
    disposition,
    status: missingEvidence ? 'BLOCKED' : 'PARTIAL',
    pathCount: entry.pathCount,
    existingSamplePathCount: entry.existingSamplePathCount,
    deletedSamplePathCount: entry.sampledPathCount - entry.existingSamplePathCount,
    replacementEvidence: entry.evidence,
    requiredAction: entry.requiredAction,
    forbiddenActions: [
      'do not stage this replace/delete candidate automatically',
      'do not restore deleted source to reduce dirty count',
      'do not keep old paths as compatibility runtime',
      'do not collapse replace/delete candidates into a generic cleanup bucket',
    ],
    samplePaths,
    importerPaths,
    referencePaths,
    redlines,
  }
}

export function buildOwnerGitReplaceDeleteReviewRegister(
  source: OwnerGitImportUseEvidenceRegister,
): OwnerGitReplaceDeleteReviewRegister {
  const entries = source.entries
    .filter(entry => entry.disposition === 'ready-replace-delete-review')
    .map(buildEntry)
  const missingReplacementEvidenceEntryCount = entries
    .filter(entry => entry.disposition === 'blocked-missing-replacement-evidence').length
  const blockers = [
    ...(source.blockers.length > 0 ? ['source import/use register has blockers'] : []),
    ...(missingReplacementEvidenceEntryCount > 0 ? ['replace/delete candidates have missing replacement evidence'] : []),
  ]
  const status: OwnerGitClosureStatus = blockers.length > 0
    ? 'BLOCKED'
    : entries.length > 0
      ? 'PARTIAL'
      : 'PASS'

  return {
    schemaVersion: 'dsxu.owner-git-replace-delete-review-register.v1',
    status,
    sourceImportUseStatus: source.status,
    entryCount: entries.length,
    deletedSourceReplacementEntryCount: entries.filter(entry => entry.disposition === 'deleted-source-replacement-review').length,
    backupCleanupEntryCount: entries.filter(entry => entry.disposition === 'backup-cleanup-review').length,
    existingDuplicateEntryCount: entries.filter(entry => entry.disposition === 'existing-duplicate-review').length,
    missingReplacementEvidenceEntryCount,
    boardAuthorizesMutation: false,
    mustNotStageDeleteRestoreReset: status !== 'PASS',
    entries,
    blockers,
    safeguards: [
      'register is evidence-only and does not stage, delete, restore, reset, move, commit, or export files',
      'replace/delete candidates must close through normal Git review with replacement evidence',
      'deleted source must not be restored as a compatibility runtime path',
      'backup cleanup candidates must not be kept as product verification surfaces',
    ],
    nextAction: blockers.length > 0
      ? 'fix-missing-replacement-evidence'
      : entries.length > 0
        ? 'replace-delete-git-review-required'
        : 'replace-delete-review-closed',
  }
}
