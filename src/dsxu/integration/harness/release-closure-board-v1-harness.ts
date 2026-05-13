import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import {
  buildReleaseClosureBoard,
  type ReleaseClosureBoard,
} from '../../engine/release-closure-board-v1'
import { runP12RawComparisonHarness } from './phase12-raw-comparison-v1-harness'
import { runV18DirtyQuarantineLedgerHarness } from '../../engine/v18-dirty-quarantine-ledger'
import { runV18OpenSourcePackageGateHarness } from '../../engine/v18-open-source-package-gate'
import { buildCleanExportReadiness } from '../../engine/clean-export-readiness-v1'
import { buildDirtyWorktreeReview } from '../../engine/dirty-worktree-review-v1'
import { buildMainlineDirtyReview } from '../../engine/mainline-dirty-review-v1'
import { buildLegacyMainlineDirtyReview } from '../../engine/legacy-mainline-dirty-review-v1'
import { buildToolRuntimeDirtyReview } from '../../engine/tool-runtime-dirty-review-v1'
import { buildToolRuntimeDuplicationDecision } from '../../engine/tool-runtime-duplication-decision-v1'
import { buildReleaseSurfaceSourcePolicyReviewState } from '../../engine/release-surface-source-policy-review-v1'

export type ReleaseClosureBoardHarnessResult = ReleaseClosureBoard & {
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

export async function runReleaseClosureBoardHarness(options: {
  evidenceDir?: string
  targetReferenceManifestPath?: string
  releaseSurfaceSourcePolicyReviewManifestPath?: string
} = {}): Promise<ReleaseClosureBoardHarnessResult> {
  const evidenceDir = options.evidenceDir ?? join(process.cwd(), '.dsxu', 'trace', 'release-closure-board-v1')
  await mkdir(evidenceDir, { recursive: true })
  const evidencePath = join(evidenceDir, 'release-closure-board.evidence.json')
  const tracePath = join(evidenceDir, 'release-closure-board.trace.json')

  const [packageGate, dirtyLedger, rawComparison] = await Promise.all([
    runV18OpenSourcePackageGateHarness({ evidenceDir: join(evidenceDir, 'package-gate') }),
    runV18DirtyQuarantineLedgerHarness({ evidenceDir: join(evidenceDir, 'dirty-ledger') }),
    runP12RawComparisonHarness({
      evidenceDir: join(evidenceDir, 'p12-raw-comparison'),
      targetReferenceManifestPath: options.targetReferenceManifestPath,
    }),
  ])
  const realReplayStatus = rawComparison.cases.every(item => item.dsxu.status === 'PASS')
    ? 'PASS'
    : rawComparison.cases.some(item => item.dsxu.status === 'BLOCKED')
      ? 'BLOCKED'
      : 'PARTIAL'
  const dirtyWorktreeReview = buildDirtyWorktreeReview(dirtyLedger)
  const mainlineDirtyReview = buildMainlineDirtyReview(dirtyLedger)
  const legacyMainlineReview = buildLegacyMainlineDirtyReview(dirtyLedger)
  const toolRuntimeReview = buildToolRuntimeDirtyReview(dirtyLedger)
  const toolRuntimeDuplicationDecision = buildToolRuntimeDuplicationDecision(toolRuntimeReview)
  const releaseSurfaceSourcePolicyReviewManifestPath = options.releaseSurfaceSourcePolicyReviewManifestPath ??
    join(process.cwd(), '.dsxu', 'trace', 'release-surface-source-policy-review-v1', 'release-surface-source-policy-review-manifest.json')
  const releaseSurfaceSourcePolicyReview = buildReleaseSurfaceSourcePolicyReviewState(
    packageGate.cleanExportManifest.filter(entry => entry.releasePolicy === 'rewrite-or-exclude'),
    await readJsonIfExists(releaseSurfaceSourcePolicyReviewManifestPath),
  )
  const cleanExportReadiness = buildCleanExportReadiness({
    releaseBlockerCount: packageGate.releaseBlockerCount,
    rewriteOrExcludeCount: packageGate.cleanExportSummary.rewriteOrExcludeCount,
    releaseSurfaceSourcePolicyReviewStatus: releaseSurfaceSourcePolicyReview.status,
    releaseSurfaceSourcePolicyReviewedCount: releaseSurfaceSourcePolicyReview.reviewedCount,
    releaseSurfaceSourcePolicyRequiredCount: releaseSurfaceSourcePolicyReview.requiredCount,
    releaseSurfaceSourcePolicyRedlines: releaseSurfaceSourcePolicyReview.redlines,
    pendingDeletionCount: packageGate.pendingDeletionCount,
    pendingDeletionByRule: packageGate.pendingDeletionClosure.byRule,
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
    cleanExportReady: packageGate.cleanExportReady,
    destructiveActionRequested: false,
    evidencePaths: [
      packageGate.evidencePath,
      dirtyLedger.evidencePath,
      join(evidenceDir, 'dirty-worktree-review.evidence.json'),
      join(evidenceDir, 'mainline-dirty-review.evidence.json'),
      join(evidenceDir, 'legacy-mainline-dirty-review.evidence.json'),
      join(evidenceDir, 'tool-runtime-dirty-review.evidence.json'),
      join(evidenceDir, 'tool-runtime-duplication-decision.evidence.json'),
      rawComparison.evidencePath,
      rawComparison.deltaReportPath,
      releaseSurfaceSourcePolicyReviewManifestPath,
    ],
  })

  const board = buildReleaseClosureBoard({
    docsLedgerReady: true,
    traceEvidenceReferenced: true,
    pendingDeletionCount: packageGate.pendingDeletionCount,
    pendingDeletionHasClosureEntries: packageGate.pendingDeletionClosure.total === packageGate.pendingDeletionCount,
    dirtyTotal: dirtyLedger.total,
    unknownDirtyCount: dirtyLedger.countsByCategory.unknown,
    releaseSurfaceBlockerCount: packageGate.releaseBlockerCount,
    sourcePolicyReviewCount: packageGate.cleanExportSummary.rewriteOrExcludeCount,
    releaseSurfaceSourcePolicyReviewStatus: releaseSurfaceSourcePolicyReview.status,
    releaseSurfaceSourcePolicyRedlines: releaseSurfaceSourcePolicyReview.redlines,
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
      join(evidenceDir, 'dirty-worktree-review.evidence.json'),
      join(evidenceDir, 'mainline-dirty-review.evidence.json'),
      join(evidenceDir, 'legacy-mainline-dirty-review.evidence.json'),
      join(evidenceDir, 'tool-runtime-dirty-review.evidence.json'),
      join(evidenceDir, 'tool-runtime-duplication-decision.evidence.json'),
      rawComparison.evidencePath,
      rawComparison.deltaReportPath,
      releaseSurfaceSourcePolicyReviewManifestPath,
    ],
  })
  const result: ReleaseClosureBoardHarnessResult = {
    ...board,
    evidencePath,
    tracePath,
  }

  await writeJson(join(evidenceDir, 'dirty-worktree-review.evidence.json'), dirtyWorktreeReview)
  await writeJson(join(evidenceDir, 'mainline-dirty-review.evidence.json'), mainlineDirtyReview)
  await writeJson(join(evidenceDir, 'legacy-mainline-dirty-review.evidence.json'), legacyMainlineReview)
  await writeJson(join(evidenceDir, 'tool-runtime-dirty-review.evidence.json'), toolRuntimeReview)
  await writeJson(join(evidenceDir, 'tool-runtime-duplication-decision.evidence.json'), toolRuntimeDuplicationDecision)
  await writeJson(tracePath, { packageGate, dirtyLedger, dirtyWorktreeReview, mainlineDirtyReview, legacyMainlineReview, toolRuntimeReview, toolRuntimeDuplicationDecision, releaseSurfaceSourcePolicyReview, rawComparison, realReplayStatus, cleanExportReadiness, board })
  await writeJson(evidencePath, result)
  return result
}
