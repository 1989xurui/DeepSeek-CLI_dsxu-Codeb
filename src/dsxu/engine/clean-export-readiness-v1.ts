export type CleanExportReadinessStatus = 'PASS' | 'PARTIAL' | 'BLOCKED'

export type CleanExportReadinessGateId =
  | 'CER-01'
  | 'CER-02'
  | 'CER-03'
  | 'CER-04'
  | 'CER-05'

export type CleanExportReadinessInput = {
  releaseBlockerCount: number
  rewriteOrExcludeCount: number
  pendingDeletionCount: number
  pendingDeletionByRule: Readonly<Record<string, number>>
  pendingDeletionReviewStatus?: 'PASS' | 'PARTIAL' | 'BLOCKED'
  pendingDeletionReplacementEvidenceStatus?: 'VERIFIED_FOR_REVIEW' | 'READY_FOR_REVIEW' | 'MISSING' | 'NOT_APPLICABLE'
  dirtyTotal: number
  unknownDirtyCount: number
  dirtyWorktreeReviewStatus?: 'PASS' | 'PARTIAL' | 'BLOCKED'
  dirtyWorktreeReviewBatchCount?: number
  mainlineDirtyReviewStatus?: 'PASS' | 'PARTIAL' | 'BLOCKED' | 'NOT_RUN'
  mainlineDirtyReviewBatchCount?: number
  legacyMainlineReviewStatus?: 'PASS' | 'PARTIAL' | 'BLOCKED' | 'NOT_RUN'
  legacyMainlineReviewBatchCount?: number
  toolRuntimeReviewStatus?: 'PASS' | 'PARTIAL' | 'BLOCKED' | 'NOT_RUN'
  toolRuntimeReviewBatchCount?: number
  toolRuntimeDuplicationDecisionStatus?: 'PASS' | 'PARTIAL' | 'BLOCKED' | 'NOT_RUN'
  toolRuntimeDuplicationDecisionBatchCount?: number
  p12RawStatus: 'PASS' | 'PARTIAL' | 'BLOCKED'
  p12PairedRawLogCount: number
  p12MinimumPairedRawLogsForPass: number
  p12ReplayFamilyGapCount?: number
  p12UnmappedPairedRawLogCount?: number
  p12RawNextAction?: string
  cleanExportReady: boolean
  destructiveActionRequested: boolean
  evidencePaths: readonly string[]
}

export type CleanExportReadinessGate = {
  id: CleanExportReadinessGateId
  name: string
  status: CleanExportReadinessStatus
  owner: string
  redlines: readonly string[]
  requiredAction: string
}

export type CleanExportReadiness = {
  schemaVersion: 'dsxu.clean-export-readiness.v1'
  status: CleanExportReadinessStatus
  canCreateCleanExport: boolean
  mustNotExport: boolean
  gateCount: number
  pass: number
  partial: number
  blocked: number
  gates: readonly CleanExportReadinessGate[]
  releaseBlockers: readonly string[]
  pendingDeletionByRule: Readonly<Record<string, number>>
  precheckSummary: {
    pendingDeletionReviewStatus: 'PASS' | 'PARTIAL' | 'BLOCKED' | 'NOT_RUN'
    pendingDeletionReplacementEvidenceStatus: 'VERIFIED_FOR_REVIEW' | 'READY_FOR_REVIEW' | 'MISSING' | 'NOT_APPLICABLE'
    dirtyWorktreeReviewStatus: 'PASS' | 'PARTIAL' | 'BLOCKED' | 'NOT_RUN'
    dirtyWorktreeReviewBatchCount: number
    mainlineDirtyReviewStatus: 'PASS' | 'PARTIAL' | 'BLOCKED' | 'NOT_RUN'
    mainlineDirtyReviewBatchCount: number
    legacyMainlineReviewStatus: 'PASS' | 'PARTIAL' | 'BLOCKED' | 'NOT_RUN'
    legacyMainlineReviewBatchCount: number
    toolRuntimeReviewStatus: 'PASS' | 'PARTIAL' | 'BLOCKED' | 'NOT_RUN'
    toolRuntimeReviewBatchCount: number
    toolRuntimeDuplicationDecisionStatus: 'PASS' | 'PARTIAL' | 'BLOCKED' | 'NOT_RUN'
    toolRuntimeDuplicationDecisionBatchCount: number
    p12RawNextAction: string
  }
  safeguards: readonly string[]
  evidencePaths: readonly string[]
  nextAction:
    | 'fix-release-surface-blockers'
    | 'review-pending-deletions'
    | 'close-dirty-worktree'
    | 'collect-paired-raw-logs'
    | 'prepare-export-artifact'
}

function gateStatus(redlines: readonly string[], partial: boolean): CleanExportReadinessStatus {
  if (redlines.length > 0) return 'BLOCKED'
  return partial ? 'PARTIAL' : 'PASS'
}

export function buildCleanExportReadiness(input: CleanExportReadinessInput): CleanExportReadiness {
  const gates: CleanExportReadinessGate[] = []
  const p12ReplayFamilyGapCount = input.p12ReplayFamilyGapCount ?? 0
  const p12UnmappedPairedRawLogCount = input.p12UnmappedPairedRawLogCount ?? 0

  gates.push({
    id: 'CER-01',
    name: 'release surface policy',
    status: gateStatus(
      input.releaseBlockerCount > 0 ? ['release surface has present blockers'] : [],
      input.rewriteOrExcludeCount > 0,
    ),
    owner: 'Release Surface',
    redlines: input.releaseBlockerCount > 0 ? ['release surface has present blockers'] : [],
    requiredAction: input.releaseBlockerCount > 0
      ? 'remove present release surface blockers before export'
      : input.rewriteOrExcludeCount > 0
        ? 'review rewrite-or-exclude source policy before export copy'
        : 'surface policy is clear',
  })

  gates.push({
    id: 'CER-02',
    name: 'pending deletion review',
    status: gateStatus(
      input.pendingDeletionCount > 0 ? ['pending deletions remain uncommitted'] : [],
      false,
    ),
    owner: 'Release / Git Review',
    redlines: input.pendingDeletionCount > 0 ? ['pending deletions remain uncommitted'] : [],
    requiredAction: input.pendingDeletionCount > 0
      ? input.pendingDeletionReplacementEvidenceStatus === 'VERIFIED_FOR_REVIEW'
        ? 'replacement evidence is verified for review; close pending deletions through normal git review'
        : 'review and commit or otherwise close pending deletion entries with replacement evidence'
      : 'pending deletion review is closed',
  })

  gates.push({
    id: 'CER-03',
    name: 'dirty worktree attribution',
    status: gateStatus(
      input.unknownDirtyCount > 0 ? ['unknown dirty paths remain'] : [],
      input.dirtyTotal > 0,
    ),
    owner: 'Worktree Ledger',
    redlines: input.unknownDirtyCount > 0 ? ['unknown dirty paths remain'] : [],
    requiredAction: input.unknownDirtyCount > 0
      ? 'classify all unknown dirty paths before export'
      : input.dirtyTotal > 0
        ? input.dirtyWorktreeReviewStatus === 'PARTIAL'
          ? 'dirty review is batched; close intentional review groups before export artifact creation'
          : 'close or intentionally stage/review dirty entries before export artifact creation'
        : 'dirty worktree is closed',
  })

  const p12Redlines = [
    ...(input.p12RawStatus === 'BLOCKED' ? ['P12 raw comparison is blocked'] : []),
    ...(input.p12PairedRawLogCount === 0 ? ['paired target-reference raw logs are missing'] : []),
    ...(p12ReplayFamilyGapCount > 0 ? [`paired raw logs do not cover original-side replay families: ${p12ReplayFamilyGapCount} gap(s)`] : []),
    ...(p12UnmappedPairedRawLogCount > 0 ? [`paired raw logs outside original-side replay families do not count: ${p12UnmappedPairedRawLogCount}`] : []),
  ]
  gates.push({
    id: 'CER-04',
    name: 'same-task raw comparison evidence',
    status: gateStatus(
      p12Redlines,
      input.p12RawStatus === 'PARTIAL' ||
        input.p12PairedRawLogCount < input.p12MinimumPairedRawLogsForPass ||
        p12ReplayFamilyGapCount > 0 ||
        p12UnmappedPairedRawLogCount > 0,
    ),
    owner: 'Evaluation Evidence',
    redlines: p12Redlines,
    requiredAction: input.p12PairedRawLogCount < input.p12MinimumPairedRawLogsForPass ||
      p12ReplayFamilyGapCount > 0 ||
      p12UnmappedPairedRawLogCount > 0
      ? 'collect enough paired same-task raw logs with original-side replay family coverage before final comparison claims'
      : 'raw comparison evidence is complete enough for delta review',
  })

  const exportRedlines = [
    ...(input.cleanExportReady ? [] : ['clean export gate is not ready']),
    ...(input.destructiveActionRequested ? ['destructive action requested during readiness check'] : []),
  ]
  gates.push({
    id: 'CER-05',
    name: 'export artifact creation',
    status: gateStatus(exportRedlines, false),
    owner: 'Release',
    redlines: exportRedlines,
    requiredAction: input.cleanExportReady
      ? 'prepare export artifact after all prechecks pass'
      : 'keep export artifact creation blocked until all gates pass',
  })

  const pass = gates.filter(gate => gate.status === 'PASS').length
  const partial = gates.filter(gate => gate.status === 'PARTIAL').length
  const blocked = gates.filter(gate => gate.status === 'BLOCKED').length
  const releaseBlockers = gates.flatMap(gate => gate.redlines.map(redline => `${gate.id}: ${redline}`))
  const canCreateCleanExport = blocked === 0 && partial === 0
  const status: CleanExportReadinessStatus = blocked > 0
    ? 'BLOCKED'
    : partial > 0
      ? 'PARTIAL'
      : 'PASS'

  return {
    schemaVersion: 'dsxu.clean-export-readiness.v1',
    status,
    canCreateCleanExport,
    mustNotExport: !canCreateCleanExport,
    gateCount: gates.length,
    pass,
    partial,
    blocked,
    gates,
    releaseBlockers,
    pendingDeletionByRule: input.pendingDeletionByRule,
    precheckSummary: {
      pendingDeletionReviewStatus: input.pendingDeletionReviewStatus ?? 'NOT_RUN',
      pendingDeletionReplacementEvidenceStatus: input.pendingDeletionReplacementEvidenceStatus ?? 'NOT_APPLICABLE',
      dirtyWorktreeReviewStatus: input.dirtyWorktreeReviewStatus ?? 'NOT_RUN',
      dirtyWorktreeReviewBatchCount: input.dirtyWorktreeReviewBatchCount ?? 0,
      mainlineDirtyReviewStatus: input.mainlineDirtyReviewStatus ?? 'NOT_RUN',
      mainlineDirtyReviewBatchCount: input.mainlineDirtyReviewBatchCount ?? 0,
      legacyMainlineReviewStatus: input.legacyMainlineReviewStatus ?? 'NOT_RUN',
      legacyMainlineReviewBatchCount: input.legacyMainlineReviewBatchCount ?? 0,
      toolRuntimeReviewStatus: input.toolRuntimeReviewStatus ?? 'NOT_RUN',
      toolRuntimeReviewBatchCount: input.toolRuntimeReviewBatchCount ?? 0,
      toolRuntimeDuplicationDecisionStatus: input.toolRuntimeDuplicationDecisionStatus ?? 'NOT_RUN',
      toolRuntimeDuplicationDecisionBatchCount: input.toolRuntimeDuplicationDecisionBatchCount ?? 0,
      p12RawNextAction: input.p12RawNextAction ?? 'not-recorded',
    },
    safeguards: [
      'readiness does not delete, move, archive, stage, commit, reset, restore, or export files',
      'pending deletions must be closed through normal review rather than hidden cleanup',
      'dirty attribution is a release hygiene input, not a product capability score',
      'same-task raw comparison evidence cannot be replaced by dry plans',
      'paired raw log quantity cannot override original-side replay family gaps',
      'export artifact creation is blocked until every gate is PASS',
    ],
    evidencePaths: [...new Set(input.evidencePaths)],
    nextAction: input.releaseBlockerCount > 0
      ? 'fix-release-surface-blockers'
      : input.pendingDeletionCount > 0
        ? 'review-pending-deletions'
        : input.dirtyTotal > 0
          ? 'close-dirty-worktree'
          : input.p12PairedRawLogCount < input.p12MinimumPairedRawLogsForPass ||
              p12ReplayFamilyGapCount > 0 ||
              p12UnmappedPairedRawLogCount > 0
            ? 'collect-paired-raw-logs'
            : 'prepare-export-artifact',
  }
}
