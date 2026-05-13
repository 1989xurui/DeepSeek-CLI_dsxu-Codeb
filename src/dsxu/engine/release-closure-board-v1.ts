export type ReleaseClosureBatchId =
  | 'RC-01'
  | 'RC-02'
  | 'RC-03'
  | 'RC-04'
  | 'RC-05'
  | 'RC-06'

export type ReleaseClosureBatchStatus = 'PASS' | 'PARTIAL' | 'BLOCKED'
export type ReleaseClosureBoardStatus =
  | 'READY_FOR_ACTUAL_CLEANUP'
  | 'PRECHECK_PARTIAL'
  | 'BLOCKED'

export type ReleaseClosureInput = {
  docsLedgerReady: boolean
  traceEvidenceReferenced: boolean
  pendingDeletionCount: number
  pendingDeletionHasClosureEntries: boolean
  dirtyTotal: number
  unknownDirtyCount: number
  releaseSurfaceBlockerCount: number
  sourcePolicyReviewCount: number
  releaseSurfaceSourcePolicyReviewStatus?: 'PASS' | 'PARTIAL' | 'BLOCKED' | 'NOT_PROVIDED'
  releaseSurfaceSourcePolicyRedlines?: readonly string[]
  cleanExportReady: boolean
  p12RawStatus: 'PASS' | 'PARTIAL' | 'BLOCKED'
  p12PairedRawLogCount: number
  p12ReplayFamilyGapCount?: number
  p12UnmappedPairedRawLogCount?: number
  realReplayStatus: 'PASS' | 'PARTIAL' | 'BLOCKED'
  mainlineContractsReady: boolean
  destructiveActionRequested: boolean
  evidencePaths: readonly string[]
}

export type ReleaseClosureBatch = {
  id: ReleaseClosureBatchId
  name: string
  status: ReleaseClosureBatchStatus
  action: 'keep-mainline' | 'keep-evidence' | 'review-delete-candidate' | 'review-dirty-attribution' | 'prepare-export'
  owner: string
  evidence: readonly string[]
  redlines: readonly string[]
  nextAction: string
}

export type ReleaseClosureBoard = {
  schemaVersion: 'dsxu.release-closure-board.v1'
  status: ReleaseClosureBoardStatus
  canPerformActualCleanup: boolean
  mustNotDeleteOrStage: boolean
  batchCount: number
  pass: number
  partial: number
  blocked: number
  batches: readonly ReleaseClosureBatch[]
  releaseBlockers: readonly string[]
  safeguards: readonly string[]
  evidencePaths: readonly string[]
  nextAction: 'fix-blockers' | 'review-pending-deletions' | 'classify-dirty-worktree' | 'prepare-clean-export'
}

function statusFromRedlines(redlines: readonly string[], partial: boolean): ReleaseClosureBatchStatus {
  if (redlines.length > 0) return 'BLOCKED'
  return partial ? 'PARTIAL' : 'PASS'
}

export function buildReleaseClosureBoard(input: ReleaseClosureInput): ReleaseClosureBoard {
  const batches: ReleaseClosureBatch[] = []
  const p12ReplayFamilyGapCount = input.p12ReplayFamilyGapCount ?? 0
  const p12UnmappedPairedRawLogCount = input.p12UnmappedPairedRawLogCount ?? 0
  const releaseSurfaceSourcePolicyReviewStatus = input.releaseSurfaceSourcePolicyReviewStatus ?? 'NOT_PROVIDED'
  const releaseSurfaceSourcePolicyReady = input.sourcePolicyReviewCount === 0 ||
    releaseSurfaceSourcePolicyReviewStatus === 'PASS'
  const releaseSurfaceSourcePolicyRedlines = releaseSurfaceSourcePolicyReviewStatus === 'BLOCKED'
    ? input.releaseSurfaceSourcePolicyRedlines ?? ['release surface source policy review is blocked']
    : []

  batches.push({
    id: 'RC-01',
    name: 'document source ledger',
    status: statusFromRedlines(
      input.docsLedgerReady ? [] : ['document source ledger is not ready'],
      false,
    ),
    action: 'keep-mainline',
    owner: 'Docs / Audit',
    evidence: input.evidencePaths,
    redlines: input.docsLedgerReady ? [] : ['document source ledger is not ready'],
    nextAction: input.docsLedgerReady
      ? 'keep the single merged audit file as current source truth'
      : 'finish document source and usage audit before cleanup',
  })

  batches.push({
    id: 'RC-02',
    name: 'trace and run evidence',
    status: statusFromRedlines(
      input.traceEvidenceReferenced ? [] : ['trace evidence is not linked to current audit'],
      false,
    ),
    action: 'keep-evidence',
    owner: 'Evidence',
    evidence: input.evidencePaths,
    redlines: input.traceEvidenceReferenced ? [] : ['trace evidence is not linked to current audit'],
    nextAction: input.traceEvidenceReferenced
      ? 'preserve referenced trace artifacts until final export policy is reviewed'
      : 'link raw evidence paths before any archive decision',
  })

  batches.push({
    id: 'RC-03',
    name: 'pending deletion review',
    status: statusFromRedlines(
      input.pendingDeletionCount > 0 && !input.pendingDeletionHasClosureEntries
        ? ['pending deletions lack closure entries']
        : [],
      input.pendingDeletionCount > 0,
    ),
    action: 'review-delete-candidate',
    owner: 'Release / Git Review',
    evidence: input.evidencePaths,
    redlines: input.pendingDeletionCount > 0 && !input.pendingDeletionHasClosureEntries
      ? ['pending deletions lack closure entries']
      : [],
    nextAction: input.pendingDeletionCount > 0
      ? 'review pending deletion entries with owner, replacement evidence, and rollback note'
      : 'no pending deletion review remains',
  })

  batches.push({
    id: 'RC-04',
    name: 'dirty attribution',
    status: statusFromRedlines(
      input.unknownDirtyCount > 0
        ? ['unknown dirty paths remain']
        : [],
      input.dirtyTotal > 0,
    ),
    action: 'review-dirty-attribution',
    owner: 'Worktree Ledger',
    evidence: input.evidencePaths,
    redlines: input.unknownDirtyCount > 0
      ? ['unknown dirty paths remain']
      : [],
    nextAction: input.dirtyTotal > 0
      ? 'review dirty attribution by mainline, evidence, history, quarantine, and unknown buckets'
      : 'dirty worktree attribution is clear',
  })

  batches.push({
    id: 'RC-05',
    name: 'release surface',
    status: statusFromRedlines(
      [
        ...(input.releaseSurfaceBlockerCount > 0
          ? ['release surface has blockers']
          : []),
        ...releaseSurfaceSourcePolicyRedlines,
      ],
      !releaseSurfaceSourcePolicyReady,
    ),
    action: 'keep-mainline',
    owner: 'Release Surface',
    evidence: input.evidencePaths,
    redlines: [
      ...(input.releaseSurfaceBlockerCount > 0
        ? ['release surface has blockers']
        : []),
      ...releaseSurfaceSourcePolicyRedlines,
    ],
    nextAction: input.releaseSurfaceBlockerCount > 0
      ? 'fix release surface blockers before export'
      : input.sourcePolicyReviewCount > 0 && releaseSurfaceSourcePolicyReviewStatus !== 'PASS'
        ? 'review source policy findings before export copy is prepared'
        : input.sourcePolicyReviewCount > 0
          ? 'source policy findings are signed for rewrite/exclude during export preparation'
        : 'release surface is clear for export preparation',
  })

  const cleanExportRedlines = [
    ...(input.cleanExportReady ? [] : ['clean export is not ready']),
    ...(input.p12RawStatus === 'BLOCKED' ? ['P12 raw comparison has blocked evidence'] : []),
    ...(input.p12PairedRawLogCount === 0 ? ['target reference paired raw logs are missing'] : []),
    ...(p12ReplayFamilyGapCount > 0 ? [`target reference raw logs do not cover original-side replay families: ${p12ReplayFamilyGapCount} gap(s)`] : []),
    ...(p12UnmappedPairedRawLogCount > 0 ? [`target reference paired raw logs outside original-side replay families do not count: ${p12UnmappedPairedRawLogCount}`] : []),
    ...(input.realReplayStatus === 'PASS' ? [] : ['real task replay is not PASS']),
    ...(input.mainlineContractsReady ? [] : ['mainline contracts are not ready']),
  ]
  batches.push({
    id: 'RC-06',
    name: 'clean export readiness',
    status: statusFromRedlines(
      cleanExportRedlines,
      input.p12RawStatus === 'PARTIAL' ||
        p12ReplayFamilyGapCount > 0 ||
        p12UnmappedPairedRawLogCount > 0,
    ),
    action: 'prepare-export',
    owner: 'Release',
    evidence: input.evidencePaths,
    redlines: cleanExportRedlines,
    nextAction: input.cleanExportReady
      ? 'prepare clean export only after paired raw comparison policy is reviewed'
      : 'keep export blocked until pending deletion and dirty review are closed',
  })

  const pass = batches.filter(batch => batch.status === 'PASS').length
  const partial = batches.filter(batch => batch.status === 'PARTIAL').length
  const blocked = batches.filter(batch => batch.status === 'BLOCKED').length
  const releaseBlockers = [
    ...(input.destructiveActionRequested ? ['destructive cleanup was requested inside precheck'] : []),
    ...batches.flatMap(batch => batch.redlines.map(redline => `${batch.id}: ${redline}`)),
  ]
  const canPerformActualCleanup = releaseBlockers.length === 0 && partial === 0
  const status: ReleaseClosureBoardStatus = releaseBlockers.length > 0
    ? 'BLOCKED'
    : partial > 0
      ? 'PRECHECK_PARTIAL'
      : 'READY_FOR_ACTUAL_CLEANUP'

  return {
    schemaVersion: 'dsxu.release-closure-board.v1',
    status,
    canPerformActualCleanup,
    mustNotDeleteOrStage: !canPerformActualCleanup,
    batchCount: batches.length,
    pass,
    partial,
    blocked,
    batches,
    releaseBlockers,
    safeguards: [
      'board is evidence-only and does not delete, move, archive, stage, commit, reset, or restore files',
      'cleanup count is not a product capability score',
      'pending deletions require normal review with replacement evidence and rollback note',
      'dirty attribution must remain separate from feature completion',
      'P12 raw comparison cannot be replaced by dry plans or subjective ranking',
      'P12 paired raw log quantity cannot override original-side replay family gaps',
    ],
    evidencePaths: [...new Set(input.evidencePaths)],
    nextAction: blocked > 0
      ? 'fix-blockers'
      : input.pendingDeletionCount > 0
        ? 'review-pending-deletions'
        : input.dirtyTotal > 0
          ? 'classify-dirty-worktree'
          : 'prepare-clean-export',
  }
}
