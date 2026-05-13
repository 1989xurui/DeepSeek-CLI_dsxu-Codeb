import type {
  OwnerGitSignoffEntry,
  OwnerGitSignoffRegister,
} from './owner-git-signoff-register-v1'
import type { OwnerGitClosureStatus } from './owner-git-closure-board-v1'

export type OwnerGitSampleUsageEvidence = {
  path: string
  exists: boolean
  importerPaths: readonly string[]
  referencePaths: readonly string[]
}

export type OwnerGitImportUseEvidenceEntry = {
  id: string
  owner: string
  targetOwner: string
  decision: string
  disposition: OwnerGitSignoffEntry['disposition']
  status: OwnerGitClosureStatus
  pathCount: number
  sampledPathCount: number
  existingSamplePathCount: number
  importedSamplePathCount: number
  referencedSamplePathCount: number
  ownerEvidenceStatus: 'IMPORT_OR_REFERENCE_FOUND' | 'SAMPLE_EXISTS_WITH_OWNER_EVIDENCE' | 'MISSING_SAMPLE_PATH'
  requiredAction: string
  sampleEvidence: readonly OwnerGitSampleUsageEvidence[]
  evidence: readonly string[]
  redlines: readonly string[]
}

export type OwnerGitImportUseEvidenceRegister = {
  schemaVersion: 'dsxu.owner-git-import-use-evidence-register.v1'
  status: OwnerGitClosureStatus
  sourceSignoffStatus: OwnerGitClosureStatus
  entryCount: number
  mainlineKeepEntryCount: number
  replaceDeleteEntryCount: number
  importedOrReferencedEntryCount: number
  sampleExistsOnlyEntryCount: number
  missingSamplePathEntryCount: number
  boardAuthorizesMutation: false
  mustNotStageDeleteRestoreReset: boolean
  entries: readonly OwnerGitImportUseEvidenceEntry[]
  blockers: readonly string[]
  safeguards: readonly string[]
  nextAction:
    | 'owner-git-import-use-review-required'
    | 'fix-missing-sample-path-evidence'
    | 'owner-git-import-use-closed'
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/')
}

function evidenceForPath(
  path: string,
  sampleUsageEvidence: ReadonlyMap<string, OwnerGitSampleUsageEvidence>,
): OwnerGitSampleUsageEvidence {
  const normalized = normalizePath(path)
  return sampleUsageEvidence.get(normalized) ?? {
    path: normalized,
    exists: false,
    importerPaths: [],
    referencePaths: [],
  }
}

function buildEntry(
  entry: OwnerGitSignoffEntry,
  sampleUsageEvidence: ReadonlyMap<string, OwnerGitSampleUsageEvidence>,
): OwnerGitImportUseEvidenceEntry {
  const sampleEvidence = entry.samplePaths.map(path => evidenceForPath(path, sampleUsageEvidence))
  const existingSamplePathCount = sampleEvidence.filter(item => item.exists).length
  const importedSamplePathCount = sampleEvidence.filter(item => item.importerPaths.length > 0).length
  const referencedSamplePathCount = sampleEvidence.filter(item => item.referencePaths.length > 0).length
  const hasImportOrReference = importedSamplePathCount > 0 || referencedSamplePathCount > 0
  const missingSamplePath = existingSamplePathCount === 0 && entry.disposition === 'ready-mainline-owner-signoff'
  const ownerEvidenceStatus = missingSamplePath
    ? 'MISSING_SAMPLE_PATH'
    : hasImportOrReference
      ? 'IMPORT_OR_REFERENCE_FOUND'
      : 'SAMPLE_EXISTS_WITH_OWNER_EVIDENCE'
  const redlines = [
    ...entry.redlines,
    ...(missingSamplePath ? ['mainline owner sample paths are missing from workspace'] : []),
  ]

  return {
    id: entry.id,
    owner: entry.owner,
    targetOwner: entry.targetOwner,
    decision: entry.decision,
    disposition: entry.disposition,
    status: missingSamplePath ? 'BLOCKED' : 'PARTIAL',
    pathCount: entry.pathCount,
    sampledPathCount: sampleEvidence.length,
    existingSamplePathCount,
    importedSamplePathCount,
    referencedSamplePathCount,
    ownerEvidenceStatus,
    requiredAction: entry.requiredAction,
    sampleEvidence,
    evidence: entry.evidence,
    redlines,
  }
}

export function buildOwnerGitImportUseEvidenceRegister(input: {
  signoffRegister: OwnerGitSignoffRegister
  sampleUsageEvidence: readonly OwnerGitSampleUsageEvidence[]
}): OwnerGitImportUseEvidenceRegister {
  const evidenceByPath = new Map(input.sampleUsageEvidence.map(item => [normalizePath(item.path), item]))
  const entries = input.signoffRegister.entries.map(entry => buildEntry(entry, evidenceByPath))
  const missingSamplePathEntryCount = entries.filter(entry => entry.ownerEvidenceStatus === 'MISSING_SAMPLE_PATH').length
  const importedOrReferencedEntryCount = entries.filter(entry => entry.ownerEvidenceStatus === 'IMPORT_OR_REFERENCE_FOUND').length
  const sampleExistsOnlyEntryCount = entries.filter(entry => entry.ownerEvidenceStatus === 'SAMPLE_EXISTS_WITH_OWNER_EVIDENCE').length
  const blockers = [
    ...(input.signoffRegister.missingEvidenceEntryCount > 0 ? ['source signoff register has missing evidence'] : []),
    ...(missingSamplePathEntryCount > 0 ? ['mainline owner entries have missing sample path evidence'] : []),
  ]
  const status: OwnerGitClosureStatus = blockers.length > 0
    ? 'BLOCKED'
    : entries.length > 0 || input.signoffRegister.sourceDirtyTotal > 0
      ? 'PARTIAL'
      : 'PASS'

  return {
    schemaVersion: 'dsxu.owner-git-import-use-evidence-register.v1',
    status,
    sourceSignoffStatus: input.signoffRegister.status,
    entryCount: entries.length,
    mainlineKeepEntryCount: entries.filter(entry => entry.disposition === 'ready-mainline-owner-signoff').length,
    replaceDeleteEntryCount: entries.filter(entry => entry.disposition === 'ready-replace-delete-review').length,
    importedOrReferencedEntryCount,
    sampleExistsOnlyEntryCount,
    missingSamplePathEntryCount,
    boardAuthorizesMutation: false,
    mustNotStageDeleteRestoreReset: status !== 'PASS',
    entries,
    blockers,
    safeguards: [
      'register is evidence-only and does not stage, delete, restore, reset, move, commit, or export files',
      'import/use evidence narrows owner review but does not replace human owner/Git signoff',
      'replace/delete candidates remain review items even when sample paths are absent or unreferenced',
      'sample existence without importer/reference is not a cleanup decision; owner evidence and normal review still decide',
    ],
    nextAction: blockers.length > 0
      ? 'fix-missing-sample-path-evidence'
      : entries.length > 0 || input.signoffRegister.sourceDirtyTotal > 0
        ? 'owner-git-import-use-review-required'
        : 'owner-git-import-use-closed',
  }
}
