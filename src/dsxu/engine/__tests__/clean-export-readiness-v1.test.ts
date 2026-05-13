import { existsSync } from 'fs'
import { describe, expect, test } from 'bun:test'
import { buildCleanExportReadiness } from '../clean-export-readiness-v1'
import { runCleanExportReadinessHarness } from '../../integration/harness/clean-export-readiness-v1-harness'

const readyInput = {
  releaseBlockerCount: 0,
  rewriteOrExcludeCount: 0,
  pendingDeletionCount: 0,
  pendingDeletionByRule: {},
  dirtyTotal: 0,
  unknownDirtyCount: 0,
  p12RawStatus: 'PASS' as const,
  p12PairedRawLogCount: 14,
  p12MinimumPairedRawLogsForPass: 14,
  cleanExportReady: true,
  destructiveActionRequested: false,
  evidencePaths: ['.dsxu/trace/clean-export/input.json'],
}

describe('RC-06 - Clean Export Readiness V1', () => {
  test('passes only when every export gate is closed', () => {
    const readiness = buildCleanExportReadiness(readyInput)

    expect(readiness.schemaVersion).toBe('dsxu.clean-export-readiness.v1')
    expect(readiness.status).toBe('PASS')
    expect(readiness.canCreateCleanExport).toBe(true)
    expect(readiness.mustNotExport).toBe(false)
    expect(readiness.gateCount).toBe(5)
    expect(readiness.releaseBlockers).toEqual([])
    expect(readiness.precheckSummary.pendingDeletionReviewStatus).toBe('NOT_RUN')
    expect(readiness.precheckSummary.pendingDeletionReplacementEvidenceStatus).toBe('NOT_APPLICABLE')
    expect(readiness.precheckSummary.dirtyWorktreeReviewStatus).toBe('NOT_RUN')
    expect(readiness.precheckSummary.dirtyWorktreeReviewBatchCount).toBe(0)
    expect(readiness.precheckSummary.mainlineDirtyReviewStatus).toBe('NOT_RUN')
    expect(readiness.precheckSummary.mainlineDirtyReviewBatchCount).toBe(0)
    expect(readiness.precheckSummary.legacyMainlineReviewStatus).toBe('NOT_RUN')
    expect(readiness.precheckSummary.legacyMainlineReviewBatchCount).toBe(0)
    expect(readiness.precheckSummary.toolRuntimeReviewStatus).toBe('NOT_RUN')
    expect(readiness.precheckSummary.toolRuntimeReviewBatchCount).toBe(0)
    expect(readiness.nextAction).toBe('prepare-export-artifact')
  })

  test('blocks current unresolved export conditions without doing cleanup', () => {
    const readiness = buildCleanExportReadiness({
      ...readyInput,
      rewriteOrExcludeCount: 40,
      pendingDeletionCount: 69,
      pendingDeletionByRule: {
        'legacy-control-plane-shell': 37,
        'legacy-private-state': 24,
        'old-root-shims': 8,
      },
      dirtyTotal: 2625,
      p12RawStatus: 'PARTIAL',
      p12PairedRawLogCount: 0,
      p12ReplayFamilyGapCount: 14,
      cleanExportReady: false,
    })

    expect(readiness.status).toBe('BLOCKED')
    expect(readiness.canCreateCleanExport).toBe(false)
    expect(readiness.mustNotExport).toBe(true)
    expect(readiness.gates.find(gate => gate.id === 'CER-01')?.status).toBe('PARTIAL')
    expect(readiness.gates.find(gate => gate.id === 'CER-02')?.status).toBe('BLOCKED')
    expect(readiness.gates.find(gate => gate.id === 'CER-03')?.status).toBe('PARTIAL')
    expect(readiness.gates.find(gate => gate.id === 'CER-04')?.status).toBe('BLOCKED')
    expect(readiness.gates.find(gate => gate.id === 'CER-05')?.status).toBe('BLOCKED')
    expect(readiness.releaseBlockers.join('\n')).toContain('pending deletions remain uncommitted')
    expect(readiness.releaseBlockers.join('\n')).toContain('paired target-reference raw logs are missing')
    expect(readiness.releaseBlockers.join('\n')).toContain('original-side replay families')
    expect(readiness.releaseBlockers.join('\n')).toContain('clean export gate is not ready')
    expect(readiness.nextAction).toBe('review-pending-deletions')
    expect(readiness.safeguards.join('\n')).toContain('does not delete')
  })

  test('blocks destructive readiness attempts even when other inputs are ready', () => {
    const readiness = buildCleanExportReadiness({
      ...readyInput,
      destructiveActionRequested: true,
    })

    expect(readiness.status).toBe('BLOCKED')
    expect(readiness.canCreateCleanExport).toBe(false)
    expect(readiness.mustNotExport).toBe(true)
    expect(readiness.releaseBlockers.join('\n')).toContain('destructive action requested')
  })

  test('requires signed source policy review for rewrite-or-exclude release surface entries', () => {
    const partial = buildCleanExportReadiness({
      ...readyInput,
      rewriteOrExcludeCount: 1,
    })
    const signed = buildCleanExportReadiness({
      ...readyInput,
      rewriteOrExcludeCount: 1,
      releaseSurfaceSourcePolicyReviewStatus: 'PASS',
      releaseSurfaceSourcePolicyReviewedCount: 1,
      releaseSurfaceSourcePolicyRequiredCount: 1,
    })

    expect(partial.status).toBe('PARTIAL')
    expect(partial.gates.find(gate => gate.id === 'CER-01')?.status).toBe('PARTIAL')
    expect(signed.status).toBe('PASS')
    expect(signed.gates.find(gate => gate.id === 'CER-01')?.status).toBe('PASS')
    expect(signed.precheckSummary.releaseSurfaceSourcePolicyReviewStatus).toBe('PASS')
  })

  test('writes current readiness evidence without exporting files', async () => {
    const readiness = await runCleanExportReadinessHarness()

    expect(readiness.evidencePath).toContain('clean-export-readiness.evidence.json')
    expect(readiness.tracePath).toContain('clean-export-readiness.trace.json')
    expect(existsSync(readiness.evidencePath)).toBe(true)
    expect(existsSync(readiness.tracePath)).toBe(true)
    expect(readiness.status).toBe('BLOCKED')
    expect(readiness.canCreateCleanExport).toBe(false)
    expect(readiness.mustNotExport).toBe(true)
    expect(readiness.precheckSummary.pendingDeletionReviewStatus).toBe('PASS')
    expect(readiness.precheckSummary.pendingDeletionReplacementEvidenceStatus).toBe('NOT_APPLICABLE')
    expect(readiness.precheckSummary.dirtyWorktreeReviewStatus).toBe('PASS')
    expect(readiness.precheckSummary.dirtyWorktreeReviewBatchCount).toBe(0)
    expect(readiness.precheckSummary.mainlineDirtyReviewStatus).toBe('PASS')
    expect(readiness.precheckSummary.mainlineDirtyReviewBatchCount).toBe(0)
    expect(readiness.precheckSummary.legacyMainlineReviewStatus).toBe('PASS')
    expect(readiness.precheckSummary.legacyMainlineReviewBatchCount).toBe(0)
    expect(readiness.precheckSummary.toolRuntimeReviewStatus).toBe('PASS')
    expect(readiness.precheckSummary.toolRuntimeReviewBatchCount).toBe(0)
    expect(readiness.precheckSummary.toolRuntimeDuplicationDecisionStatus).toBe('PASS')
    expect(readiness.precheckSummary.toolRuntimeDuplicationDecisionBatchCount).toBe(0)
    expect(readiness.precheckSummary.p12RawNextAction).toBe('collect-target-reference-raw-logs')
    expect(readiness.releaseBlockers.join('\n')).toContain('paired target-reference raw logs are missing')
    expect(readiness.releaseBlockers.join('\n')).toContain('original-side replay families')
    expect(readiness.evidencePaths.join('\n')).toContain('dirty-worktree-review.evidence.json')
    expect(readiness.evidencePaths.join('\n')).toContain('mainline-dirty-review.evidence.json')
    expect(readiness.evidencePaths.join('\n')).toContain('legacy-mainline-dirty-review.evidence.json')
    expect(readiness.evidencePaths.join('\n')).toContain('tool-runtime-dirty-review.evidence.json')
    expect(readiness.evidencePaths.join('\n')).toContain('phase12-raw-delta-report.evidence.json')
  }, 120_000)
})
