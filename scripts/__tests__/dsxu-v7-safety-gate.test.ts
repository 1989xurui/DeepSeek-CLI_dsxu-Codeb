import { mkdtemp, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, test } from 'bun:test'
import { buildV7SafetyGate } from '../dsxu-v7-safety-gate'

describe('V7 safety gate', () => {
  test('passes only when V7 evidence remains observe-only, prompt-safe, and claim-bounded', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsxu-v7-safety-'))
    const paths = {
      docsRegistry: join(dir, 'docs-registry.json'),
      signals: join(dir, 'signals.json'),
      promptAllowlist: join(dir, 'prompt-allowlist.json'),
      reachability: join(dir, 'reachability.json'),
      archiveWatchlist: join(dir, 'archive-watchlist.json'),
      deleteReview: join(dir, 'delete-review.json'),
      deleteReviewReplacementEvidence: join(dir, 'delete-review-replacement-evidence.json'),
      replayBank: join(dir, 'replay-bank.json'),
      replayLayerEvidence: join(dir, 'replay-layer-evidence.json'),
      claimBoundary: join(dir, 'claim-boundary.json'),
      ownerFocusedEvidence: join(dir, 'owner-focused-evidence.json'),
      remainingEvidenceQueue: join(dir, 'remaining-evidence-queue.json'),
      ownerDecisions: join(dir, 'owner-decisions.json'),
    }

    await writeFile(paths.docsRegistry, JSON.stringify({
      summary: { fileCount: 397 },
    }), 'utf8')
    await writeFile(paths.signals, JSON.stringify({
      summary: { p0DocCount: 7, p0DocsWithSignals: 7 },
    }), 'utf8')
    await writeFile(paths.promptAllowlist, JSON.stringify({
      summary: {
        deleteReviewPromptItems: 0,
        generatedHistoricalRawDocs: 0,
        supersededPlanRawDocs: 0,
      },
    }), 'utf8')
    await writeFile(paths.reachability, JSON.stringify({
      summary: { mainlineOwnerRows: 4, publicClaimAllowedRows: 0 },
    }), 'utf8')
    await writeFile(paths.archiveWatchlist, JSON.stringify({
      summary: { deleteNow: 0, activeRowsInWatchlist: 0 },
    }), 'utf8')
    await writeFile(paths.deleteReview, JSON.stringify({
      summary: { deleteReviewRows: 6, deleteReadyRows: 0 },
    }), 'utf8')
    await writeFile(paths.deleteReviewReplacementEvidence, JSON.stringify({
      summary: {
        rows: 6,
        replacementEvidenceRows: 6,
        failedCommands: 0,
        deleteReadyRows: 0,
        mutationAllowedRows: 0,
      },
    }), 'utf8')
    await writeFile(paths.replayBank, JSON.stringify({
      summary: { totalCases: 5, publicBenchmarkClaimAllowedRows: 0 },
    }), 'utf8')
    await writeFile(paths.replayLayerEvidence, JSON.stringify({
      summary: { rows: 5, missingSourceDocRows: 0, publicBenchmarkClaimAllowedRows: 0, publicClaimReadyRows: 0 },
    }), 'utf8')
    await writeFile(paths.claimBoundary, JSON.stringify({
      summary: { c3BelowPublicAllowed: 0, public90Allowed: false },
    }), 'utf8')
    await writeFile(paths.ownerFocusedEvidence, JSON.stringify({
      summary: { commands: 2, failed: 0, coveredRows: 12 },
    }), 'utf8')
    await writeFile(paths.remainingEvidenceQueue, JSON.stringify({
      summary: { totalRows: 4, needsFocusedOwnerTest: 0, publicClaimAllowedRows: 0 },
    }), 'utf8')
    await writeFile(paths.ownerDecisions, JSON.stringify({
      summary: { reviewedUnclassifiedRows: 208, deleteReview: 6, remainingClassifyBeforeClaim: 0 },
      rows: Array.from({ length: 208 }, (_, index) => ({
        path: `src/example-${index}.ts`,
        decision: 'mainline-owner',
      })),
    }), 'utf8')

    const report = await buildV7SafetyGate({
      paths,
      generatedAt: '2026-05-19T00:00:00.000Z',
    })

    expect(report.status).toBe('PASS_DSXU_V7_SAFETY_GATE')
    expect(report.summary.blocked).toBe(0)
    expect(report.checks.every(check => check.status === 'PASS')).toBe(true)
  })

  test('blocks public claim leakage and delete-review promotion', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsxu-v7-safety-blocked-'))
    const paths = {
      docsRegistry: join(dir, 'docs-registry.json'),
      signals: join(dir, 'signals.json'),
      promptAllowlist: join(dir, 'prompt-allowlist.json'),
      reachability: join(dir, 'reachability.json'),
      archiveWatchlist: join(dir, 'archive-watchlist.json'),
      deleteReview: join(dir, 'delete-review.json'),
      deleteReviewReplacementEvidence: join(dir, 'delete-review-replacement-evidence.json'),
      replayBank: join(dir, 'replay-bank.json'),
      replayLayerEvidence: join(dir, 'replay-layer-evidence.json'),
      claimBoundary: join(dir, 'claim-boundary.json'),
      ownerFocusedEvidence: join(dir, 'owner-focused-evidence.json'),
      remainingEvidenceQueue: join(dir, 'remaining-evidence-queue.json'),
      ownerDecisions: join(dir, 'owner-decisions.json'),
    }

    await writeFile(paths.docsRegistry, JSON.stringify({ summary: { fileCount: 397 } }), 'utf8')
    await writeFile(paths.signals, JSON.stringify({ summary: { p0DocCount: 1, p0DocsWithSignals: 1 } }), 'utf8')
    await writeFile(paths.promptAllowlist, JSON.stringify({
      summary: { deleteReviewPromptItems: 1, generatedHistoricalRawDocs: 0, supersededPlanRawDocs: 0 },
    }), 'utf8')
    await writeFile(paths.reachability, JSON.stringify({ summary: { mainlineOwnerRows: 4, publicClaimAllowedRows: 1 } }), 'utf8')
    await writeFile(paths.archiveWatchlist, JSON.stringify({ summary: { deleteNow: 0, activeRowsInWatchlist: 0 } }), 'utf8')
    await writeFile(paths.deleteReview, JSON.stringify({ summary: { deleteReviewRows: 6, deleteReadyRows: 0 } }), 'utf8')
    await writeFile(paths.deleteReviewReplacementEvidence, JSON.stringify({
      summary: { rows: 6, replacementEvidenceRows: 6, failedCommands: 0, deleteReadyRows: 0, mutationAllowedRows: 0 },
    }), 'utf8')
    await writeFile(paths.replayBank, JSON.stringify({ summary: { totalCases: 1, publicBenchmarkClaimAllowedRows: 0 } }), 'utf8')
    await writeFile(paths.replayLayerEvidence, JSON.stringify({
      summary: { rows: 1, missingSourceDocRows: 0, publicBenchmarkClaimAllowedRows: 0, publicClaimReadyRows: 0 },
    }), 'utf8')
    await writeFile(paths.claimBoundary, JSON.stringify({ summary: { c3BelowPublicAllowed: 1, public90Allowed: false } }), 'utf8')
    await writeFile(paths.ownerFocusedEvidence, JSON.stringify({ summary: { commands: 1, failed: 0, coveredRows: 1 } }), 'utf8')
    await writeFile(paths.remainingEvidenceQueue, JSON.stringify({ summary: { totalRows: 4, needsFocusedOwnerTest: 0, publicClaimAllowedRows: 0 } }), 'utf8')
    await writeFile(paths.ownerDecisions, JSON.stringify({
      summary: { reviewedUnclassifiedRows: 208, deleteReview: 6, remainingClassifyBeforeClaim: 0 },
      rows: Array.from({ length: 208 }, (_, index) => ({ path: `src/example-${index}.ts` })),
    }), 'utf8')

    const report = await buildV7SafetyGate({
      paths,
      generatedAt: '2026-05-19T00:00:00.000Z',
    })

    expect(report.status).toBe('BLOCKED_DSXU_V7_SAFETY_GATE')
    expect(report.blockers).toEqual(expect.arrayContaining([
      expect.stringContaining('prompt-delete-review-blocked'),
      expect.stringContaining('reachability-no-public-claim'),
      expect.stringContaining('claim-boundary-holds'),
    ]))
  })
})
