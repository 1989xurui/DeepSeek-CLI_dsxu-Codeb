import { existsSync } from 'fs'
import { describe, expect, test } from 'bun:test'
import { buildReleaseClosureBoard } from '../release-closure-board-v1'
import { runReleaseClosureBoardHarness } from '../../integration/harness/release-closure-board-v1-harness'

const baseInput = {
  docsLedgerReady: true,
  traceEvidenceReferenced: true,
  pendingDeletionCount: 0,
  pendingDeletionHasClosureEntries: true,
  dirtyTotal: 0,
  unknownDirtyCount: 0,
  releaseSurfaceBlockerCount: 0,
  sourcePolicyReviewCount: 0,
  cleanExportReady: true,
  p12RawStatus: 'PASS' as const,
  p12PairedRawLogCount: 14,
  realReplayStatus: 'PASS' as const,
  mainlineContractsReady: true,
  destructiveActionRequested: false,
  evidencePaths: ['.dsxu/trace/release/input.json'],
}

describe('WP-08 - Release Closure Board V1', () => {
  test('allows actual cleanup only when every release batch is clear', () => {
    const board = buildReleaseClosureBoard(baseInput)

    expect(board.schemaVersion).toBe('dsxu.release-closure-board.v1')
    expect(board.status).toBe('READY_FOR_ACTUAL_CLEANUP')
    expect(board.canPerformActualCleanup).toBe(true)
    expect(board.mustNotDeleteOrStage).toBe(false)
    expect(board.batchCount).toBe(6)
    expect(board.releaseBlockers).toEqual([])
    expect(board.nextAction).toBe('prepare-clean-export')
  })

  test('keeps current workspace in precheck when pending deletion and dirty work remain', () => {
    const board = buildReleaseClosureBoard({
      ...baseInput,
      pendingDeletionCount: 69,
      dirtyTotal: 2574,
      cleanExportReady: false,
      p12RawStatus: 'PARTIAL',
      p12PairedRawLogCount: 0,
      p12ReplayFamilyGapCount: 14,
      sourcePolicyReviewCount: 2,
    })

    expect(board.status).toBe('BLOCKED')
    expect(board.canPerformActualCleanup).toBe(false)
    expect(board.mustNotDeleteOrStage).toBe(true)
    expect(board.batches.find(batch => batch.id === 'RC-03')?.status).toBe('PARTIAL')
    expect(board.batches.find(batch => batch.id === 'RC-04')?.status).toBe('PARTIAL')
    expect(board.batches.find(batch => batch.id === 'RC-06')?.status).toBe('BLOCKED')
    expect(board.releaseBlockers.join('\n')).toContain('clean export is not ready')
    expect(board.releaseBlockers.join('\n')).toContain('target reference paired raw logs are missing')
    expect(board.releaseBlockers.join('\n')).toContain('original-side replay families')
    expect(board.nextAction).toBe('fix-blockers')
  })

  test('blocks destructive cleanup requests even if other inputs look ready', () => {
    const board = buildReleaseClosureBoard({
      ...baseInput,
      destructiveActionRequested: true,
    })

    expect(board.status).toBe('BLOCKED')
    expect(board.canPerformActualCleanup).toBe(false)
    expect(board.mustNotDeleteOrStage).toBe(true)
    expect(board.releaseBlockers).toContain('destructive cleanup was requested inside precheck')
    expect(board.safeguards.join('\n')).toContain('does not delete')
  })

  test('writes current release closure evidence without staging or deleting files', async () => {
    const board = await runReleaseClosureBoardHarness()

    expect(board.evidencePath).toContain('release-closure-board.evidence.json')
    expect(board.tracePath).toContain('release-closure-board.trace.json')
    expect(existsSync(board.evidencePath)).toBe(true)
    expect(existsSync(board.tracePath)).toBe(true)
    expect(board.status).toBe('BLOCKED')
    expect(board.canPerformActualCleanup).toBe(false)
    expect(board.mustNotDeleteOrStage).toBe(true)
    expect(board.batchCount).toBe(6)
    expect(board.batches.map(batch => batch.id)).toEqual([
      'RC-01',
      'RC-02',
      'RC-03',
      'RC-04',
      'RC-05',
      'RC-06',
    ])
    expect(board.releaseBlockers.join('\n')).toContain('clean export is not ready')
    expect(board.releaseBlockers.join('\n')).toContain('target reference paired raw logs are missing')
    expect(board.releaseBlockers.join('\n')).toContain('original-side replay families')
    expect(board.evidencePaths.join('\n')).toContain('dirty-worktree-review.evidence.json')
    expect(board.evidencePaths.join('\n')).toContain('mainline-dirty-review.evidence.json')
    expect(board.evidencePaths.join('\n')).toContain('legacy-mainline-dirty-review.evidence.json')
    expect(board.evidencePaths.join('\n')).toContain('tool-runtime-dirty-review.evidence.json')
    expect(board.evidencePaths.join('\n')).toContain('phase12-raw-delta-report.evidence.json')
    expect(board.safeguards.join('\n')).toContain('does not delete')
  }, 120_000)
})
