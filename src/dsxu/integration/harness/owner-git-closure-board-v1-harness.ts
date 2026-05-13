import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import {
  buildOwnerGitClosureBoard,
  type OwnerGitClosureBoard,
  type OwnerGitClosureSignoffItem,
} from '../../engine/owner-git-closure-board-v1'
import { buildCleanExportReadiness } from '../../engine/clean-export-readiness-v1'
import { buildDirtyWorktreeReview } from '../../engine/dirty-worktree-review-v1'
import { buildLegacyMainlineDirtyReview } from '../../engine/legacy-mainline-dirty-review-v1'
import { buildMainlineDirtyReview } from '../../engine/mainline-dirty-review-v1'
import { buildPendingDeletionReview } from '../../engine/pending-deletion-review-v1'
import { buildReleaseClosureBoard } from '../../engine/release-closure-board-v1'
import { buildToolRuntimeDirtyReview } from '../../engine/tool-runtime-dirty-review-v1'
import { buildToolRuntimeDuplicationDecision } from '../../engine/tool-runtime-duplication-decision-v1'
import {
  WORKSPACE_PERMISSION_BLOCKED_RESIDUES,
  validateWorkspacePermissionResidueClosureManifest,
} from '../../engine/workspace-artifact-policy-register-v1'
import {
  buildDeferredProductAbsorptionReviewState,
  validateDeferredProductAbsorptionReviewManifest,
} from '../../engine/deferred-product-absorption-register-v1'
import {
  DEFERRED_EVAL_RAW_EVIDENCE_SPECS,
  validateDeferredEvalRawLiveManifest,
} from '../../engine/raw-evidence-readiness-register-v1'
import { runP12RawComparisonHarness } from './phase12-raw-comparison-v1-harness'
import { runV18DirtyQuarantineLedgerHarness } from '../../engine/v18-dirty-quarantine-ledger'
import { runV18OpenSourcePackageGateHarness } from '../../engine/v18-open-source-package-gate'

const DEFERRED_PRODUCT_IDS = ['PZ01', 'PZ02', 'PZ04', 'PZ05', 'PZ06', 'PZ08'] as const

export type OwnerGitClosureBoardHarnessResult = OwnerGitClosureBoard & {
  evidencePath: string
  tracePath: string
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function readJsonIfExists(path: string): Promise<unknown | null> {
  try {
    return JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, ''))
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') return null
    throw error
  }
}

function hasBlockingSignoffRedline(redlines: readonly string[]): boolean {
  return redlines.some(redline => /missing|unknown|no entries|restore policy/i.test(redline))
}

function buildPermissionResidueExternalClosureState(input: unknown | null): {
  status: 'PASS' | 'PARTIAL' | 'BLOCKED' | 'NOT_PROVIDED'
  signedCount: number
  rejectedCount: number
  adjustRequestedCount: number
  staleCount: number
  unsignedCount: number
  redlines: readonly string[]
} {
  if (!input) {
    return {
      status: 'NOT_PROVIDED',
      signedCount: 0,
      rejectedCount: 0,
      adjustRequestedCount: 0,
      staleCount: 0,
      unsignedCount: WORKSPACE_PERMISSION_BLOCKED_RESIDUES.length,
      redlines: [],
    }
  }
  const validation = validateWorkspacePermissionResidueClosureManifest(input)
  if (validation.status === 'BLOCKED') {
    return {
      status: 'BLOCKED',
      signedCount: 0,
      rejectedCount: 0,
      adjustRequestedCount: 0,
      staleCount: 0,
      unsignedCount: WORKSPACE_PERMISSION_BLOCKED_RESIDUES.length,
      redlines: validation.redlines,
    }
  }
  const states = WORKSPACE_PERMISSION_BLOCKED_RESIDUES.map(residue => {
    const decision = validation.acceptedDecisions.find(item => item.residueId === residue.residueId)
    const stale = Boolean(decision && decision.sourcePath !== residue.sourcePath)
    return { decision, stale }
  })
  const signedCount = states.filter(item => item.decision?.decision === 'sign' && !item.stale).length
  const rejectedCount = states.filter(item => item.decision?.decision === 'reject').length
  const adjustRequestedCount = states.filter(item => item.decision?.decision === 'adjust').length
  const staleCount = states.filter(item => item.stale).length
  const unsignedCount = states.filter(item => !item.decision).length
  const status = signedCount === WORKSPACE_PERMISSION_BLOCKED_RESIDUES.length &&
    rejectedCount === 0 &&
    adjustRequestedCount === 0 &&
    staleCount === 0 &&
    unsignedCount === 0
    ? 'PASS'
    : rejectedCount > 0 || adjustRequestedCount > 0 || staleCount > 0
      ? 'BLOCKED'
      : 'PARTIAL'

  return {
    status,
    signedCount,
    rejectedCount,
    adjustRequestedCount,
    staleCount,
    unsignedCount,
    redlines: [
      ...states.flatMap((item, index) => item.stale
        ? [`${WORKSPACE_PERMISSION_BLOCKED_RESIDUES[index].residueId}: signed sourcePath does not match current residue path`]
        : []),
      ...(rejectedCount > 0 ? ['permission residue closure rejected one or more residues'] : []),
      ...(adjustRequestedCount > 0 ? ['permission residue closure requested adjustment for one or more residues'] : []),
    ],
  }
}

export async function runOwnerGitClosureBoardHarness(options: {
  evidenceDir?: string
  targetReferenceManifestPath?: string
  deferredEvalRawLiveManifestPath?: string
  permissionResidueClosureManifestPath?: string
  deferredProductReviewManifestPath?: string
} = {}): Promise<OwnerGitClosureBoardHarnessResult> {
  const evidenceDir = options.evidenceDir ?? join(process.cwd(), '.dsxu', 'trace', 'owner-git-closure-board-v1')
  await mkdir(evidenceDir, { recursive: true })
  const evidencePath = join(evidenceDir, 'owner-git-closure-board.evidence.json')
  const tracePath = join(evidenceDir, 'owner-git-closure-board.trace.json')

  const [packageGate, dirtyLedger, rawComparison] = await Promise.all([
    runV18OpenSourcePackageGateHarness({ evidenceDir: join(evidenceDir, 'package-gate') }),
    runV18DirtyQuarantineLedgerHarness({ evidenceDir: join(evidenceDir, 'dirty-ledger') }),
    runP12RawComparisonHarness({
      evidenceDir: join(evidenceDir, 'p12-raw-comparison'),
      targetReferenceManifestPath: options.targetReferenceManifestPath,
    }),
  ])
  const permissionResidueClosureManifestPath = options.permissionResidueClosureManifestPath ??
    join(process.cwd(), '.dsxu', 'trace', 'workspace-permission-residue-closure-v1', 'workspace-permission-residue-closure-manifest.json')
  const permissionResidueExternalClosure = buildPermissionResidueExternalClosureState(
    await readJsonIfExists(permissionResidueClosureManifestPath),
  )
  const deferredProductReviewManifestPath = options.deferredProductReviewManifestPath ??
    join(process.cwd(), '.dsxu', 'trace', 'deferred-product-absorption-reviewed-v1', 'deferred-product-absorption-review-manifest.json')
  const deferredProductReviewInput = await readJsonIfExists(deferredProductReviewManifestPath)
  const deferredProductReviewManifest = deferredProductReviewInput
    ? validateDeferredProductAbsorptionReviewManifest(deferredProductReviewInput)
    : undefined
  const deferredProductAbsorptionReview = buildDeferredProductAbsorptionReviewState(
    DEFERRED_PRODUCT_IDS,
    deferredProductReviewManifest,
  )
  const deferredEvalRawLiveManifestPath = options.deferredEvalRawLiveManifestPath ??
    join(process.cwd(), '.dsxu', 'trace', 'deferred-eval-raw-live-codex-runner-v1', 'deferred-eval-raw-live-manifest.json')
  const deferredEvalRawLiveInput = await readJsonIfExists(deferredEvalRawLiveManifestPath)
  const deferredEvalRawLiveManifest = deferredEvalRawLiveInput
    ? validateDeferredEvalRawLiveManifest(deferredEvalRawLiveInput)
    : undefined
  const signedDeferredEvalIds = new Set(
    deferredEvalRawLiveManifest?.status === 'PASS'
      ? deferredEvalRawLiveManifest.acceptedLogs.map(log => log.id)
      : [],
  )
  const openDeferredEvalIds = DEFERRED_EVAL_RAW_EVIDENCE_SPECS
    .filter(spec => !signedDeferredEvalIds.has(spec.id))
    .map(spec => spec.id)

  const pendingDeletionReview = buildPendingDeletionReview(packageGate.pendingDeletionClosure)
  const dirtyWorktreeReview = buildDirtyWorktreeReview(dirtyLedger)
  const legacyMainlineReview = buildLegacyMainlineDirtyReview(dirtyLedger)
  const mainlineDirtyReview = buildMainlineDirtyReview(dirtyLedger, {
    legacyMainlineReviewStatus: legacyMainlineReview.status,
    legacyMainlineReviewBatchCount: legacyMainlineReview.batchCount,
  })
  const toolRuntimeReview = buildToolRuntimeDirtyReview(dirtyLedger)
  const toolRuntimeDuplicationDecision = buildToolRuntimeDuplicationDecision(toolRuntimeReview)
  const pendingDeletionReplacementEvidenceStatus = pendingDeletionReview.batches.some(batch => batch.replacementEvidenceStatus === 'MISSING')
    ? 'MISSING'
    : pendingDeletionReview.batches.some(batch => batch.replacementEvidenceStatus === 'READY_FOR_REVIEW')
      ? 'READY_FOR_REVIEW'
      : pendingDeletionReview.batches.length === 0
        ? 'NOT_APPLICABLE'
        : 'VERIFIED_FOR_REVIEW'
  const cleanExportReadiness = buildCleanExportReadiness({
    releaseBlockerCount: packageGate.releaseBlockerCount,
    rewriteOrExcludeCount: packageGate.cleanExportSummary.rewriteOrExcludeCount,
    pendingDeletionCount: packageGate.pendingDeletionCount,
    pendingDeletionByRule: packageGate.pendingDeletionClosure.byRule,
    pendingDeletionReviewStatus: pendingDeletionReview.status,
    pendingDeletionReplacementEvidenceStatus,
    dirtyTotal: dirtyLedger.total,
    unknownDirtyCount: dirtyLedger.countsByCategory.unknown,
    dirtyWorktreeReviewStatus: dirtyWorktreeReview.status,
    dirtyWorktreeReviewBatchCount: dirtyWorktreeReview.batchCount,
    mainlineDirtyReviewStatus: mainlineDirtyReview.status,
    mainlineDirtyReviewBatchCount: mainlineDirtyReview.batchCount,
    legacyMainlineReviewStatus: legacyMainlineReview.status,
    legacyMainlineReviewBatchCount: legacyMainlineReview.batchCount,
    toolRuntimeReviewStatus: toolRuntimeReview.status,
    toolRuntimeReviewBatchCount: toolRuntimeReview.batchCount,
    toolRuntimeDuplicationDecisionStatus: toolRuntimeDuplicationDecision.status,
    toolRuntimeDuplicationDecisionBatchCount: toolRuntimeDuplicationDecision.batchCount,
    p12RawStatus: rawComparison.status,
    p12PairedRawLogCount: rawComparison.pairedRawLogCount,
    p12MinimumPairedRawLogsForPass: rawComparison.minimumPairedRawLogsForPass,
    p12ReplayFamilyGapCount: rawComparison.replayFamilyGapCount,
    p12UnmappedPairedRawLogCount: rawComparison.unmappedPairedRawLogCount,
    p12RawNextAction: rawComparison.nextAction,
    cleanExportReady: packageGate.cleanExportReady,
    destructiveActionRequested: false,
    evidencePaths: [
      packageGate.evidencePath,
      dirtyLedger.evidencePath,
      rawComparison.evidencePath,
      rawComparison.deltaReportPath,
    ],
  })
  const realReplayStatus = rawComparison.cases.every(item => item.dsxu.status === 'PASS')
    ? 'PASS'
    : rawComparison.cases.some(item => item.dsxu.status === 'BLOCKED')
      ? 'BLOCKED'
      : 'PARTIAL'
  const releaseClosureBoard = buildReleaseClosureBoard({
    docsLedgerReady: true,
    traceEvidenceReferenced: true,
    pendingDeletionCount: packageGate.pendingDeletionCount,
    pendingDeletionHasClosureEntries: packageGate.pendingDeletionClosure.total === packageGate.pendingDeletionCount,
    dirtyTotal: dirtyLedger.total,
    unknownDirtyCount: dirtyLedger.countsByCategory.unknown,
    releaseSurfaceBlockerCount: packageGate.releaseBlockerCount,
    sourcePolicyReviewCount: packageGate.cleanExportSummary.rewriteOrExcludeCount,
    cleanExportReady: packageGate.cleanExportReady,
    p12RawStatus: rawComparison.status,
    p12PairedRawLogCount: rawComparison.pairedRawLogCount,
    p12ReplayFamilyGapCount: rawComparison.replayFamilyGapCount,
    p12UnmappedPairedRawLogCount: rawComparison.unmappedPairedRawLogCount,
    realReplayStatus,
    mainlineContractsReady: true,
    destructiveActionRequested: false,
    evidencePaths: [
      packageGate.evidencePath,
      dirtyLedger.evidencePath,
      rawComparison.evidencePath,
      rawComparison.deltaReportPath,
      cleanExportReadiness.evidencePaths[0] ?? '',
    ].filter(Boolean),
  })
  const pendingDeletionSubSlices = pendingDeletionReview.batches.flatMap(batch => batch.subSlices)
  const legacyOwnerReviewUnits = legacyMainlineReview.batches
    .flatMap(batch => batch.ownerSlices ?? [])
    .flatMap(slice => slice.subSlices && slice.subSlices.length > 0 ? slice.subSlices : [slice])
  const legacyUiReviewUnits = legacyMainlineReview.batches
    .flatMap(batch => batch.uiProductSlices ?? [])
    .flatMap(slice => slice.subSlices && slice.subSlices.length > 0 ? slice.subSlices : [slice])
  const legacyReplaceDeleteSignoffItems: OwnerGitClosureSignoffItem[] = [
    ...legacyOwnerReviewUnits
      .filter(slice => slice.semanticDecision === 'replace-delete-candidate')
      .map((slice): OwnerGitClosureSignoffItem => ({
        id: slice.id,
        laneId: 'OGC-01',
        owner: slice.owner,
        targetOwner: slice.targetOwner,
        decision: slice.semanticDecision,
        count: slice.count,
        requiredAction: slice.requiredAction,
        evidence: ['legacy-mainline-dirty-review-v1.test.ts'],
        samplePaths: slice.samplePaths,
        status: hasBlockingSignoffRedline(slice.redlines) ? 'BLOCKED' : 'PARTIAL',
        redlines: slice.redlines,
      })),
    ...legacyUiReviewUnits
      .filter(slice => slice.semanticDecision === 'replace-delete-candidate' || slice.obsoletePathCount > 0)
      .map((slice): OwnerGitClosureSignoffItem => ({
        id: slice.id,
        laneId: 'OGC-01',
        owner: slice.owner,
        targetOwner: slice.targetOwner,
        decision: slice.semanticDecision === 'replace-delete-candidate'
          ? slice.semanticDecision
          : 'path-level-replace-delete-candidate',
        count: slice.semanticDecision === 'replace-delete-candidate' ? slice.count : slice.obsoletePathCount,
        requiredAction: slice.requiredAction,
        evidence: ['legacy-mainline-dirty-review-v1.test.ts', 'query-loop-visible-copy-v1.test.ts', 'tool-evidence-pack-contract-v1.test.ts'],
        samplePaths: slice.semanticDecision === 'replace-delete-candidate'
          ? slice.samplePaths
          : slice.obsoleteSamplePaths,
        status: hasBlockingSignoffRedline(slice.redlines) ? 'BLOCKED' : 'PARTIAL',
        redlines: slice.redlines,
      })),
  ]
  const mainlineSignoffItems: OwnerGitClosureSignoffItem[] = mainlineDirtyReview.batches
    .flatMap(batch => batch.ownerSlices)
    .map((slice): OwnerGitClosureSignoffItem => ({
      id: slice.id,
      laneId: 'OGC-01',
      owner: slice.owner,
      targetOwner: slice.targetOwner,
      decision: slice.semanticDecision,
      count: slice.count,
      requiredAction: slice.requiredAction,
      evidence: [...new Set([
        ...slice.ownerEvidence,
        ...slice.replacementEvidence,
      ])],
      samplePaths: slice.samplePaths,
      status: hasBlockingSignoffRedline(slice.redlines) ? 'BLOCKED' : 'PARTIAL',
      redlines: slice.redlines,
    }))
  const pendingDeletionSignoffItems: OwnerGitClosureSignoffItem[] = pendingDeletionSubSlices
    .map((slice): OwnerGitClosureSignoffItem => ({
      id: slice.id,
      laneId: 'OGC-02',
      owner: slice.owner,
      targetOwner: slice.targetOwner,
      decision: slice.closureDecision,
      count: slice.count,
      requiredAction: slice.requiredAction,
      evidence: slice.replacementEvidence,
      samplePaths: slice.samplePaths,
      status: hasBlockingSignoffRedline(slice.redlines) ? 'BLOCKED' : 'PARTIAL',
      redlines: slice.redlines,
    }))
  const board = buildOwnerGitClosureBoard({
    dirtyTotal: dirtyLedger.total,
    trackedDirtyCount: dirtyLedger.total - dirtyLedger.untrackedCount,
    untrackedCount: dirtyLedger.untrackedCount,
    deletedCount: dirtyLedger.deletedCount,
    unknownDirtyCount: dirtyLedger.countsByCategory.unknown,
    mainlineDirtyStatus: mainlineDirtyReview.status,
    mainlineDirtyNextAction: mainlineDirtyReview.nextAction,
    mainlineKeepOwnerSliceCount: mainlineDirtyReview.ownerSliceCount - mainlineDirtyReview.replaceDeleteCandidateCount,
    mainlineReviewBeforeKeepCount: mainlineDirtyReview.reviewBeforeKeepCount,
    replaceDeleteCandidateCount: mainlineDirtyReview.replaceDeleteCandidateCount,
    replaceDeleteEvidenceVerifiedCount: mainlineDirtyReview.replaceDeleteEvidenceVerifiedCount,
    replaceDeleteMissingEvidenceCount: mainlineDirtyReview.replaceDeleteMissingEvidenceCount,
    legacyMainlineKeepOwnerSliceCount: legacyOwnerReviewUnits
      .filter(slice => slice.semanticDecision === 'keep-mainline').length +
      legacyUiReviewUnits.filter(slice => slice.semanticDecision === 'keep-mainline').length,
    legacyMainlineReviewBeforeKeepCount: legacyMainlineReview.legacyOwnerReviewBeforeKeepCount +
      legacyMainlineReview.uiProductReviewBeforeKeepCount,
    legacyMainlineReplaceDeleteCandidateCount: legacyReplaceDeleteSignoffItems.length,
    pendingDeletionCount: packageGate.pendingDeletionCount,
    pendingDeletionStatus: pendingDeletionReview.status,
    pendingDeletionSubSliceCount: pendingDeletionReview.subSliceCount,
    pendingDeletionVerifiedSubSliceCount: pendingDeletionSubSlices
      .filter(slice => slice.replacementEvidenceStatus === 'VERIFIED_FOR_REVIEW').length,
    pendingDeletionMissingEvidenceCount: pendingDeletionSubSlices
      .filter(slice => slice.replacementEvidenceStatus === 'MISSING').length,
    p12RawStatus: rawComparison.status,
    p12PairedRawLogCount: rawComparison.pairedRawLogCount,
    p12MinimumPairedRawLogsForPass: rawComparison.minimumPairedRawLogsForPass,
    p12ReplayFamilyGapCount: rawComparison.replayFamilyGapCount,
    p12UnmappedPairedRawLogCount: rawComparison.unmappedPairedRawLogCount,
    p12UnpairedTargetReferenceRawLogCount: rawComparison.unpairedTargetReferenceRawLogCount,
    p12CollectionBacklogCount: rawComparison.collectionPack.expansionBacklog.length,
    p12CollectionBacklogSlots: rawComparison.collectionPack.expansionBacklog.map(task => task.slotId),
    p12RawNextAction: rawComparison.nextAction,
    deferredEvalIds: openDeferredEvalIds,
    deferredProductIds: DEFERRED_PRODUCT_IDS,
    deferredProductAbsorptionStatus: deferredProductAbsorptionReview.status,
    localArtifactPolicyKnown: true,
    permissionBlockedResidualCount: 5,
    permissionResidueExternalClosureStatus: permissionResidueExternalClosure.status,
    cleanExportReady: packageGate.cleanExportReady,
    releaseClosureStatus: releaseClosureBoard.status === 'PRECHECK_PARTIAL' ? 'PARTIAL' : releaseClosureBoard.status,
    canCreateCleanExport: cleanExportReadiness.canCreateCleanExport && releaseClosureBoard.canPerformActualCleanup,
    destructiveActionRequested: false,
    signoffItems: [
      ...mainlineSignoffItems,
      ...legacyReplaceDeleteSignoffItems,
      ...pendingDeletionSignoffItems,
    ],
    evidencePaths: [
      packageGate.evidencePath,
      dirtyLedger.evidencePath,
      rawComparison.evidencePath,
      rawComparison.deltaReportPath,
      evidencePath,
      tracePath,
    ],
  })
  const result: OwnerGitClosureBoardHarnessResult = {
    ...board,
    evidencePath,
    tracePath,
  }

  await writeJson(join(evidenceDir, 'pending-deletion-review.evidence.json'), pendingDeletionReview)
  await writeJson(join(evidenceDir, 'dirty-worktree-review.evidence.json'), dirtyWorktreeReview)
  await writeJson(join(evidenceDir, 'mainline-dirty-review.evidence.json'), mainlineDirtyReview)
  await writeJson(join(evidenceDir, 'legacy-mainline-dirty-review.evidence.json'), legacyMainlineReview)
  await writeJson(join(evidenceDir, 'tool-runtime-dirty-review.evidence.json'), toolRuntimeReview)
  await writeJson(join(evidenceDir, 'tool-runtime-duplication-decision.evidence.json'), toolRuntimeDuplicationDecision)
  await writeJson(join(evidenceDir, 'clean-export-readiness.evidence.json'), cleanExportReadiness)
  await writeJson(join(evidenceDir, 'release-closure-board.evidence.json'), releaseClosureBoard)
  await writeJson(tracePath, {
    packageGate,
    dirtyLedger,
    pendingDeletionReview,
    dirtyWorktreeReview,
    mainlineDirtyReview,
    legacyMainlineReview,
    toolRuntimeReview,
    toolRuntimeDuplicationDecision,
    deferredProductAbsorptionReview,
    permissionResidueExternalClosure,
    deferredEvalRawLiveManifest,
    rawComparison,
    cleanExportReadiness,
    releaseClosureBoard,
    board,
  })
  await writeJson(evidencePath, result)
  return result
}
