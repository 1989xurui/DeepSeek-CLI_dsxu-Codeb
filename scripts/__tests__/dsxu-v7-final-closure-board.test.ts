import { mkdtemp, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, test } from 'bun:test'
import { buildV7FinalClosureBoard } from '../dsxu-v7-final-closure-board'

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, JSON.stringify(value), 'utf8')
}

describe('V7 final closure board', () => {
  test('passes only when V7 evidence queues are closed and public/release/delete gates remain blocked', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsxu-v7-final-closure-'))
    const paths = {
      docsRegistry: join(dir, 'docs-registry.json'),
      signals: join(dir, 'signals.json'),
      promptAllowlist: join(dir, 'prompt-allowlist.json'),
      reachability: join(dir, 'reachability.json'),
      archiveWatchlist: join(dir, 'archive-watchlist.json'),
      deleteReview: join(dir, 'delete-review.json'),
      deleteReviewReplacementEvidence: join(dir, 'delete-review-replacement.json'),
      replayBank: join(dir, 'replay-bank.json'),
      replayLayerEvidence: join(dir, 'replay-layer.json'),
      claimBoundary: join(dir, 'claim-boundary.json'),
      ownerFocusedEvidence: join(dir, 'owner-focused.json'),
      remainingEvidenceQueue: join(dir, 'remaining-evidence.json'),
      ownerDecisions: join(dir, 'owner-decisions.json'),
      safetyGate: join(dir, 'safety.json'),
    }

    await writeJson(paths.docsRegistry, { summary: { fileCount: 401 } })
    await writeJson(paths.signals, { summary: { p0DocCount: 328, p0DocsWithSignals: 328 } })
    await writeJson(paths.promptAllowlist, {
      summary: { deleteReviewPromptItems: 0, generatedHistoricalRawDocs: 0, supersededPlanRawDocs: 0 },
    })
    await writeJson(paths.reachability, { summary: { mainlineOwnerRows: 96 } })
    await writeJson(paths.archiveWatchlist, { summary: { deleteNow: 0 } })
    await writeJson(paths.deleteReview, { summary: { deleteReviewRows: 6 } })
    await writeJson(paths.deleteReviewReplacementEvidence, {
      summary: { deleteReadyRows: 0, mutationAllowedRows: 0 },
    })
    await writeJson(paths.replayBank, { summary: { totalCases: 300, 'external-benchmark': 49 } })
    await writeJson(paths.replayLayerEvidence, {
      summary: { rows: 300, mockRows: 251, mockContractPassRows: 251, externalBenchmarkBlockedRows: 49, publicClaimReadyRows: 0 },
    })
    await writeJson(paths.claimBoundary, {
      summary: { c3BelowPublicAllowed: 0, public90Allowed: false },
    })
    await writeJson(paths.ownerFocusedEvidence, { summary: { failed: 0 } })
    await writeJson(paths.remainingEvidenceQueue, {
      summary: { totalRows: 96, needsFocusedOwnerTest: 0 },
    })
    await writeJson(paths.ownerDecisions, {
      summary: { reviewedUnclassifiedRows: 208, remainingClassifyBeforeClaim: 0, deleteReview: 6 },
      rows: Array.from({ length: 208 }, (_, index) => ({ path: `src/example-${index}.ts` })),
    })
    await writeJson(paths.safetyGate, {
      status: 'PASS_DSXU_V7_SAFETY_GATE',
      summary: { blocked: 0 },
    })

    const report = await buildV7FinalClosureBoard({
      paths,
      generatedAt: '2026-05-19T00:00:00.000Z',
    })

    expect(report.status).toBe('PASS_DSXU_V7_FINAL_CLOSURE_BOARD')
    expect(report.summary.blocked).toBe(0)
    expect(report.summary.publicBenchmarkAllowed).toBe(false)
    expect(report.summary.deletionAllowed).toBe(false)
    expect(report.nextNonV7Gates.length).toBeGreaterThan(0)
  })

  test('blocks when safety gate or public claim boundary is not closed', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsxu-v7-final-closure-blocked-'))
    const paths = {
      docsRegistry: join(dir, 'docs-registry.json'),
      signals: join(dir, 'signals.json'),
      promptAllowlist: join(dir, 'prompt-allowlist.json'),
      reachability: join(dir, 'reachability.json'),
      archiveWatchlist: join(dir, 'archive-watchlist.json'),
      deleteReview: join(dir, 'delete-review.json'),
      deleteReviewReplacementEvidence: join(dir, 'delete-review-replacement.json'),
      replayBank: join(dir, 'replay-bank.json'),
      replayLayerEvidence: join(dir, 'replay-layer.json'),
      claimBoundary: join(dir, 'claim-boundary.json'),
      ownerFocusedEvidence: join(dir, 'owner-focused.json'),
      remainingEvidenceQueue: join(dir, 'remaining-evidence.json'),
      ownerDecisions: join(dir, 'owner-decisions.json'),
      safetyGate: join(dir, 'safety.json'),
    }

    await writeJson(paths.docsRegistry, { summary: { fileCount: 401 } })
    await writeJson(paths.signals, { summary: { p0DocCount: 328, p0DocsWithSignals: 328 } })
    await writeJson(paths.promptAllowlist, {
      summary: { deleteReviewPromptItems: 0, generatedHistoricalRawDocs: 0, supersededPlanRawDocs: 0 },
    })
    await writeJson(paths.reachability, { summary: { mainlineOwnerRows: 96 } })
    await writeJson(paths.archiveWatchlist, { summary: { deleteNow: 0 } })
    await writeJson(paths.deleteReview, { summary: { deleteReviewRows: 6 } })
    await writeJson(paths.deleteReviewReplacementEvidence, { summary: { deleteReadyRows: 0, mutationAllowedRows: 0 } })
    await writeJson(paths.replayBank, { summary: { totalCases: 300, 'external-benchmark': 49 } })
    await writeJson(paths.replayLayerEvidence, {
      summary: { rows: 300, mockRows: 251, mockContractPassRows: 251, externalBenchmarkBlockedRows: 49, publicClaimReadyRows: 0 },
    })
    await writeJson(paths.claimBoundary, { summary: { c3BelowPublicAllowed: 1, public90Allowed: false } })
    await writeJson(paths.ownerFocusedEvidence, { summary: { failed: 0 } })
    await writeJson(paths.remainingEvidenceQueue, { summary: { totalRows: 96, needsFocusedOwnerTest: 0 } })
    await writeJson(paths.ownerDecisions, {
      summary: { reviewedUnclassifiedRows: 208, remainingClassifyBeforeClaim: 0, deleteReview: 6 },
      rows: Array.from({ length: 208 }, (_, index) => ({ path: `src/example-${index}.ts` })),
    })
    await writeJson(paths.safetyGate, { status: 'BLOCKED_DSXU_V7_SAFETY_GATE', summary: { blocked: 1 } })

    const report = await buildV7FinalClosureBoard({
      paths,
      generatedAt: '2026-05-19T00:00:00.000Z',
    })

    expect(report.status).toBe('BLOCKED_DSXU_V7_FINAL_CLOSURE_BOARD')
    expect(report.blockers).toEqual(expect.arrayContaining([
      expect.stringContaining('claim-boundary-and-safety-gate-pass'),
    ]))
  })
})
