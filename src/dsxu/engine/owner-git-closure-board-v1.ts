export type OwnerGitClosureStatus = 'PASS' | 'PARTIAL' | 'BLOCKED'

export type OwnerGitClosureLaneId =
  | 'OGC-01'
  | 'OGC-02'
  | 'OGC-03'
  | 'OGC-04'
  | 'OGC-05'
  | 'OGC-06'

export type OwnerGitClosureLane = {
  id: OwnerGitClosureLaneId
  name: string
  status: OwnerGitClosureStatus
  owner: string
  scope: string
  currentEvidence: readonly string[]
  signoffCondition: string
  nextAction: string
  redlines: readonly string[]
}

export type OwnerGitClosureSignoffItem = {
  id: string
  laneId: OwnerGitClosureLaneId
  owner: string
  targetOwner: string
  decision: string
  count: number
  requiredAction: string
  evidence: readonly string[]
  samplePaths: readonly string[]
  status: OwnerGitClosureStatus
  redlines: readonly string[]
}

export type OwnerGitClosureBoardInput = {
  dirtyTotal: number
  trackedDirtyCount: number
  untrackedCount: number
  deletedCount: number
  unknownDirtyCount: number
  mainlineDirtyStatus: OwnerGitClosureStatus
  mainlineDirtyNextAction: string
  mainlineKeepOwnerSliceCount: number
  mainlineReviewBeforeKeepCount: number
  replaceDeleteCandidateCount: number
  replaceDeleteEvidenceVerifiedCount: number
  replaceDeleteMissingEvidenceCount: number
  legacyMainlineKeepOwnerSliceCount?: number
  legacyMainlineReviewBeforeKeepCount?: number
  legacyMainlineReplaceDeleteCandidateCount?: number
  pendingDeletionCount: number
  pendingDeletionStatus: OwnerGitClosureStatus
  pendingDeletionSubSliceCount: number
  pendingDeletionVerifiedSubSliceCount: number
  pendingDeletionMissingEvidenceCount: number
  p12RawStatus: OwnerGitClosureStatus
  p12PairedRawLogCount: number
  p12MinimumPairedRawLogsForPass: number
  p12ReplayFamilyGapCount?: number
  p12UnmappedPairedRawLogCount?: number
  p12UnpairedTargetReferenceRawLogCount?: number
  p12CollectionBacklogCount?: number
  p12CollectionBacklogSlots?: readonly string[]
  p12RawNextAction: string
  deferredEvalIds: readonly string[]
  deferredProductIds: readonly string[]
  deferredProductAbsorptionStatus?: OwnerGitClosureStatus | 'NOT_PROVIDED'
  localArtifactPolicyKnown: boolean
  permissionBlockedResidualCount: number
  permissionResidueExternalClosureStatus?: OwnerGitClosureStatus | 'NOT_PROVIDED'
  cleanExportReady: boolean
  releaseClosureStatus: OwnerGitClosureStatus
  canCreateCleanExport: boolean
  destructiveActionRequested: boolean
  signoffItems?: readonly OwnerGitClosureSignoffItem[]
  evidencePaths: readonly string[]
}

export type OwnerGitClosureBoard = {
  schemaVersion: 'dsxu.owner-git-closure-board.v1'
  status: OwnerGitClosureStatus
  boardAuthorizesMutation: false
  mustNotStageDeleteRestoreReset: boolean
  laneCount: number
  pass: number
  partial: number
  blocked: number
  dirtySummary: {
    total: number
    trackedDirtyCount: number
    untrackedCount: number
    deletedCount: number
    unknownDirtyCount: number
  }
  ownerReviewSummary: {
    mainlineKeepOwnerSliceCount: number
    mainlineReviewBeforeKeepCount: number
    replaceDeleteCandidateCount: number
    replaceDeleteEvidenceVerifiedCount: number
    replaceDeleteMissingEvidenceCount: number
    legacyMainlineKeepOwnerSliceCount: number
    legacyMainlineReviewBeforeKeepCount: number
    legacyMainlineReplaceDeleteCandidateCount: number
    pendingDeletionSubSliceCount: number
    pendingDeletionVerifiedSubSliceCount: number
    pendingDeletionMissingEvidenceCount: number
  }
  signoffItemCount: number
  replaceDeleteSignoffItemCount: number
  pendingDeletionSignoffItemCount: number
  lanes: readonly OwnerGitClosureLane[]
  signoffItems: readonly OwnerGitClosureSignoffItem[]
  releaseBlockers: readonly string[]
  safeguards: readonly string[]
  evidencePaths: readonly string[]
  nextAction:
    | 'review-owner-git-signoff'
    | 'review-pending-deletion-signoff'
    | 'collect-target-reference-raw-logs'
    | 'collect-deferred-eval-raw-live-logs'
    | 'review-deferred-product-absorption'
    | 'resolve-workspace-artifact-policy'
    | 'run-final-release-tests'
}

function laneStatus(
  blockingRedlines: readonly string[],
  partialCondition: boolean,
): OwnerGitClosureStatus {
  if (blockingRedlines.length > 0) return 'BLOCKED'
  return partialCondition ? 'PARTIAL' : 'PASS'
}

function unique(input: readonly string[]): readonly string[] {
  return [...new Set(input)]
}

export function buildOwnerGitClosureBoard(
  input: OwnerGitClosureBoardInput,
): OwnerGitClosureBoard {
  const p12ReplayFamilyGapCount = input.p12ReplayFamilyGapCount ?? 0
  const p12UnmappedPairedRawLogCount = input.p12UnmappedPairedRawLogCount ?? 0
  const p12UnpairedTargetReferenceRawLogCount = input.p12UnpairedTargetReferenceRawLogCount ?? 0
  const p12CollectionBacklogCount = input.p12CollectionBacklogCount ?? 0
  const p12CollectionBacklogSlots = input.p12CollectionBacklogSlots ?? []
  const legacyMainlineKeepOwnerSliceCount = input.legacyMainlineKeepOwnerSliceCount ?? 0
  const legacyMainlineReviewBeforeKeepCount = input.legacyMainlineReviewBeforeKeepCount ?? 0
  const legacyMainlineReplaceDeleteCandidateCount = input.legacyMainlineReplaceDeleteCandidateCount ?? 0
  const deferredProductAbsorptionStatus = input.deferredProductAbsorptionStatus ?? 'NOT_PROVIDED'
  const permissionResidueExternalClosureStatus = input.permissionResidueExternalClosureStatus ?? 'NOT_PROVIDED'
  const ownerDirtyBlocking = [
    ...(input.unknownDirtyCount > 0 ? ['unknown dirty paths remain'] : []),
    ...(input.mainlineReviewBeforeKeepCount > 0 ? ['mainline review-before-keep slices remain'] : []),
    ...(legacyMainlineReviewBeforeKeepCount > 0 ? ['legacy mainline review-before-keep slices remain'] : []),
    ...(input.replaceDeleteMissingEvidenceCount > 0 ? ['replace/delete candidates have missing replacement evidence'] : []),
    ...(
      input.dirtyTotal > 0 && input.mainlineDirtyNextAction !== 'review-owner-git-closure'
        ? [`mainline dirty nextAction is ${input.mainlineDirtyNextAction}`]
        : []
    ),
  ]
  const pendingDeletionBlocking = [
    ...(input.pendingDeletionMissingEvidenceCount > 0 ? ['pending deletion sub-slices have missing replacement evidence'] : []),
  ]
  const p12Blocking = [
    ...(input.p12RawStatus === 'BLOCKED' ? ['P12 raw comparison is blocked'] : []),
    ...(input.p12PairedRawLogCount === 0 ? ['target reference paired raw logs are missing'] : []),
    ...(p12ReplayFamilyGapCount > 0 ? [`P12 original-side replay family gaps remain: ${p12ReplayFamilyGapCount}`] : []),
    ...(p12UnmappedPairedRawLogCount > 0 ? [`P12 paired raw logs outside original-side replay families do not count: ${p12UnmappedPairedRawLogCount}`] : []),
    ...(p12CollectionBacklogCount > 0 ? [`P12 target collection family backlog slots remain: ${p12CollectionBacklogCount}`] : []),
  ]
  const workspaceBlocking = [
    ...(input.localArtifactPolicyKnown ? [] : ['local artifact policy is not recorded']),
    ...(permissionResidueExternalClosureStatus === 'BLOCKED' ? ['permission residue external closure is blocked'] : []),
  ]
  const productBlocking = [
    ...(deferredProductAbsorptionStatus === 'BLOCKED' ? ['deferred product absorption review is blocked'] : []),
  ]
  const finalBlocking = [
    ...(input.cleanExportReady ? [] : ['clean export is not ready']),
    ...(input.canCreateCleanExport ? [] : ['clean export artifact creation is not allowed']),
    ...(input.releaseClosureStatus === 'BLOCKED' ? ['release closure board is blocked'] : []),
    ...(input.destructiveActionRequested ? ['destructive action requested inside evidence board'] : []),
  ]

  const lanes: OwnerGitClosureLane[] = [
    {
      id: 'OGC-01',
      name: 'owner dirty signoff',
      status: laneStatus(ownerDirtyBlocking, input.dirtyTotal > 0 || input.mainlineDirtyStatus === 'PARTIAL'),
      owner: 'Owner / Git Review',
      scope: 'mainline keep owner slices and dirty worktree signoff',
      currentEvidence: [
        `dirtyTotal=${input.dirtyTotal}`,
        `mainlineKeepOwnerSliceCount=${input.mainlineKeepOwnerSliceCount}`,
        `legacyMainlineKeepOwnerSliceCount=${legacyMainlineKeepOwnerSliceCount}`,
        `replaceDeleteCandidateCount=${input.replaceDeleteCandidateCount}`,
        `legacyMainlineReplaceDeleteCandidateCount=${legacyMainlineReplaceDeleteCandidateCount}`,
      ],
      signoffCondition: 'dirty mainline changes are owner-signed and replace/delete candidates have explicit handling records',
      nextAction: input.dirtyTotal > 0
        ? 'sign off mainline keep slices and replace/delete candidates through normal owner/Git review'
        : 'owner dirty signoff is closed',
      redlines: ownerDirtyBlocking,
    },
    {
      id: 'OGC-02',
      name: 'pending deletion signoff',
      status: laneStatus(pendingDeletionBlocking, input.pendingDeletionCount > 0 || input.pendingDeletionStatus === 'PARTIAL'),
      owner: 'Release / Git Review',
      scope: 'pending deletion 69 plus replace/delete candidates that must not be restored',
      currentEvidence: [
        `pendingDeletionCount=${input.pendingDeletionCount}`,
        `pendingDeletionSubSliceCount=${input.pendingDeletionSubSliceCount}`,
        `pendingDeletionVerifiedSubSliceCount=${input.pendingDeletionVerifiedSubSliceCount}`,
      ],
      signoffCondition: 'every deletion candidate has owner, replacement evidence, restore policy, and normal Git review closure',
      nextAction: input.pendingDeletionCount > 0
        ? 'close pending deletions only through normal review; do not restore old runtime paths'
        : 'pending deletion signoff is closed',
      redlines: pendingDeletionBlocking,
    },
    {
      id: 'OGC-03',
      name: 'raw target reference evidence',
      status: laneStatus(
        p12Blocking,
        input.p12RawStatus === 'PARTIAL' ||
          input.p12PairedRawLogCount < input.p12MinimumPairedRawLogsForPass ||
          p12ReplayFamilyGapCount > 0 ||
          p12UnmappedPairedRawLogCount > 0 ||
          p12CollectionBacklogCount > 0 ||
          input.deferredEvalIds.length > 0,
      ),
      owner: 'Phase 12 / Eval Evidence',
      scope: 'P12-19 paired target raw logs plus deferred external eval raw/live evidence',
      currentEvidence: [
        `p12RawStatus=${input.p12RawStatus}`,
        `p12PairedRawLogCount=${input.p12PairedRawLogCount}`,
        `p12ReplayFamilyGapCount=${p12ReplayFamilyGapCount}`,
        `p12UnmappedPairedRawLogCount=${p12UnmappedPairedRawLogCount}`,
        `p12UnpairedTargetReferenceRawLogCount=${p12UnpairedTargetReferenceRawLogCount}`,
        `p12CollectionBacklogCount=${p12CollectionBacklogCount}`,
        `p12CollectionBacklogSlots=${p12CollectionBacklogSlots.join(',')}`,
        `deferredEvalIds=${input.deferredEvalIds.join(',')}`,
      ],
      signoffCondition: 'same-task target-reference raw logs and delta report are complete; deferred evals use the same evidence schema',
      nextAction: input.p12RawStatus === 'PASS' && input.deferredEvalIds.length > 0
        ? 'collect deferred eval raw/live evidence through the same evidence schema'
        : input.p12RawNextAction,
      redlines: p12Blocking,
    },
    {
      id: 'OGC-04',
      name: 'deferred product absorption',
      status: laneStatus(
        productBlocking,
        input.deferredProductIds.length > 0 && deferredProductAbsorptionStatus !== 'PASS',
      ),
      owner: 'Product Runtime Owners',
      scope: 'deferred product and adapter surfaces mapped back to query-loop/tool/permission/agent/evidence owners',
      currentEvidence: [
        `deferredProductIds=${input.deferredProductIds.join(',')}`,
        `deferredProductAbsorptionStatus=${deferredProductAbsorptionStatus}`,
      ],
      signoffCondition: 'deferred product surfaces are absorbed by original mainline owners or kept deferred; no standalone runtime remains',
      nextAction: input.deferredProductIds.length > 0 && deferredProductAbsorptionStatus !== 'PASS'
        ? 'review deferred product surfaces against original-side owners before implementation'
        : 'deferred product absorption is closed',
      redlines: productBlocking,
    },
    {
      id: 'OGC-05',
      name: 'workspace artifact policy',
      status: laneStatus(
        workspaceBlocking,
        input.untrackedCount > 0 ||
          (input.permissionBlockedResidualCount > 0 && permissionResidueExternalClosureStatus !== 'PASS'),
      ),
      owner: 'Workspace / Release Hygiene',
      scope: '.git, node_modules, .dsxu evidence store, untracked files, and permission-blocked residues',
      currentEvidence: [
        `untrackedCount=${input.untrackedCount}`,
        `deletedCount=${input.deletedCount}`,
        `permissionBlockedResidualCount=${input.permissionBlockedResidualCount}`,
        `permissionResidueExternalClosureStatus=${permissionResidueExternalClosureStatus}`,
      ],
      signoffCondition: 'local-only artifacts are excluded from release/export and permission-blocked residues remain explicit external closure items',
      nextAction: input.permissionBlockedResidualCount > 0 && permissionResidueExternalClosureStatus !== 'PASS'
        ? 'resolve permission-blocked residues externally; do not force local cleanup'
        : 'keep artifact exclusion policy until final export review',
      redlines: workspaceBlocking,
    },
    {
      id: 'OGC-06',
      name: 'final tests and clean export',
      status: laneStatus(finalBlocking, input.releaseClosureStatus === 'PARTIAL'),
      owner: 'Release',
      scope: 'final comprehensive tests, release closure board, and clean export creation',
      currentEvidence: [
        `releaseClosureStatus=${input.releaseClosureStatus}`,
        `cleanExportReady=${input.cleanExportReady}`,
        `canCreateCleanExport=${input.canCreateCleanExport}`,
      ],
      signoffCondition: 'all upstream lanes are closed before final full tests and clean export',
      nextAction: 'run final comprehensive tests only after owner, deletion, raw evidence, product absorption, and workspace policy lanes are closed',
      redlines: finalBlocking,
    },
  ]

  const pass = lanes.filter(lane => lane.status === 'PASS').length
  const partial = lanes.filter(lane => lane.status === 'PARTIAL').length
  const blocked = lanes.filter(lane => lane.status === 'BLOCKED').length
  const signoffItems = input.signoffItems ?? []
  const status: OwnerGitClosureStatus = blocked > 0
    ? 'BLOCKED'
    : partial > 0
      ? 'PARTIAL'
      : 'PASS'
  const releaseBlockers = lanes.flatMap(lane =>
    lane.redlines.map(redline => `${lane.id}: ${redline}`),
  )

  return {
    schemaVersion: 'dsxu.owner-git-closure-board.v1',
    status,
    boardAuthorizesMutation: false,
    mustNotStageDeleteRestoreReset: status !== 'PASS',
    laneCount: lanes.length,
    pass,
    partial,
    blocked,
    dirtySummary: {
      total: input.dirtyTotal,
      trackedDirtyCount: input.trackedDirtyCount,
      untrackedCount: input.untrackedCount,
      deletedCount: input.deletedCount,
      unknownDirtyCount: input.unknownDirtyCount,
    },
    ownerReviewSummary: {
      mainlineKeepOwnerSliceCount: input.mainlineKeepOwnerSliceCount,
      mainlineReviewBeforeKeepCount: input.mainlineReviewBeforeKeepCount,
      replaceDeleteCandidateCount: input.replaceDeleteCandidateCount,
      replaceDeleteEvidenceVerifiedCount: input.replaceDeleteEvidenceVerifiedCount,
      replaceDeleteMissingEvidenceCount: input.replaceDeleteMissingEvidenceCount,
      legacyMainlineKeepOwnerSliceCount,
      legacyMainlineReviewBeforeKeepCount,
      legacyMainlineReplaceDeleteCandidateCount,
      pendingDeletionSubSliceCount: input.pendingDeletionSubSliceCount,
      pendingDeletionVerifiedSubSliceCount: input.pendingDeletionVerifiedSubSliceCount,
      pendingDeletionMissingEvidenceCount: input.pendingDeletionMissingEvidenceCount,
    },
    signoffItemCount: signoffItems.length,
    replaceDeleteSignoffItemCount: signoffItems
      .filter(item => item.decision.includes('replace-delete')).length,
    pendingDeletionSignoffItemCount: signoffItems
      .filter(item => item.laneId === 'OGC-02').length,
    lanes,
    signoffItems,
    releaseBlockers,
    safeguards: [
      'board is evidence-only and does not stage, delete, restore, reset, move, commit, or export files',
      'equivalent duplicate behavior must be merged into original owner or remain a replace/delete candidate',
      'different behavior must map to a named mainline owner before keep',
      'compatibility labels are allowed only for test evidence or adapter projection, never as product runtime holding paths',
      'final comprehensive tests run after problem lanes are closed, not before',
    ],
    evidencePaths: unique(input.evidencePaths),
    nextAction: lanes.find(lane => lane.status !== 'PASS')?.id === 'OGC-01'
      ? 'review-owner-git-signoff'
      : lanes.find(lane => lane.status !== 'PASS')?.id === 'OGC-02'
        ? 'review-pending-deletion-signoff'
        : lanes.find(lane => lane.status !== 'PASS')?.id === 'OGC-03'
          ? input.p12RawStatus === 'PASS' && input.deferredEvalIds.length > 0
            ? 'collect-deferred-eval-raw-live-logs'
            : 'collect-target-reference-raw-logs'
          : lanes.find(lane => lane.status !== 'PASS')?.id === 'OGC-04'
            ? 'review-deferred-product-absorption'
            : lanes.find(lane => lane.status !== 'PASS')?.id === 'OGC-05'
              ? 'resolve-workspace-artifact-policy'
              : 'run-final-release-tests',
  }
}
