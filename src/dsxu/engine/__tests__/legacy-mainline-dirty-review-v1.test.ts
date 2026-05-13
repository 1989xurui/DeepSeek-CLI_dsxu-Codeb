import { existsSync } from 'fs'
import { describe, expect, test } from 'bun:test'
import { buildLegacyMainlineDirtyReview } from '../legacy-mainline-dirty-review-v1'
import { buildV18DirtyQuarantineLedger } from '../v18-dirty-quarantine-ledger'
import { runLegacyMainlineDirtyReviewHarness } from '../../integration/harness/legacy-mainline-dirty-review-v1-harness'

describe('MDR-01 - Legacy Mainline Dirty Review V1', () => {
  test('splits legacy mainline paths into migration and owner groups', () => {
    const ledger = buildV18DirtyQuarantineLedger({
      nowIso: '2026-05-12T00:00:00.000Z',
      lines: [
        ' M src/tools/ShellTool.ts',
        ' M src/components/App.tsx',
        ' M src/components/LogoV2/Clawd.tsx',
        ' M src/buddy/companion.ts',
        ' M src/context/session.ts',
        ' M src/history.ts',
        ' M src/QueryEngine.ts',
        '?? src/__tests__/legacy.test.ts',
        ' M src/random/other.ts',
        ' D src/skills/bundled/claudeApi.ts',
        '?? src/skills/bundled/dsxuApi.ts',
        ' D src/migrations/migrateOpusToOpus1m.ts',
        '?? src/migrations/dsxuLegacyModelMigrations.ts',
        ' M src/migrations/migrateFennecToOpus.ts',
        ' D src/types/generated/events_mono/claude_code/v1/claude_code_internal_event.ts',
        '?? src/types/providerSdk.ts',
        ' D src/replLauncher.tsx',
        ' M src/dsxu/engine/release-test-gate.ts',
      ],
    })
    const review = buildLegacyMainlineDirtyReview(ledger)

    expect(review.schemaVersion).toBe('dsxu.legacy-mainline-dirty-review.v1')
    expect(review.status).toBe('PARTIAL')
    expect(review.total).toBe(17)
    expect(review.canCloseLegacyMainlineGate).toBe(false)
    expect(review.mustNotStageOrRestore).toBe(true)
    expect(review.batches.map(batch => batch.id)).toEqual([
      'LMR-01',
      'LMR-02',
      'LMR-03',
      'LMR-04',
      'LMR-05',
      'LMR-06',
    ])
    expect(review.batches.find(batch => batch.id === 'LMR-01')?.targetOwner).toContain('Tool Evidence Pack')
    expect(review.batches.find(batch => batch.id === 'LMR-03')?.ownerSlices?.map(slice => slice.group)).toEqual([
      'remote-control-surface',
      'skill-bundle-surface',
      'type-schema-surface',
      'migration-policy-surface',
      'misc-legacy-surface',
    ])
    expect(review.batches.find(batch => batch.id === 'LMR-03')?.ownerSlices?.flatMap(slice => slice.subSlices ?? []).map(slice => slice.group)).toEqual([
      'deleted-legacy-provider-skills',
      'dsxu-api-browser-skills',
      'deleted-legacy-generated-event-schema',
      'provider-sdk-contract-types',
      'dsxu-legacy-model-facade',
      'legacy-provider-model-boundary',
      'deleted-legacy-model-migration',
    ])
    expect(review.batches.find(batch => batch.id === 'LMR-03')?.ownerSlices
      ?.flatMap(slice => slice.subSlices ?? [])
      .find(slice => slice.group === 'legacy-provider-model-boundary')?.semanticDecision).toBe('keep-mainline')
    expect(review.batches.find(batch => batch.id === 'LMR-04')?.ownerSlices?.map(slice => slice.group)).toEqual(['context-provider-state', 'history-session-state'])
    expect(review.batches.find(batch => batch.id === 'LMR-03')?.ownerSlices
      ?.find(slice => slice.group === 'remote-control-surface')?.semanticDecision).toBe('replace-delete-candidate')
    expect(review.batches.find(batch => batch.id === 'LMR-05')?.ownerSlices?.map(slice => slice.group)).toEqual(['query-engine-core'])
    expect(review.batches.find(batch => batch.id === 'LMR-06')?.ownerSlices?.map(slice => slice.semanticDecision)).toEqual(['review-before-keep'])
    const uiProductSlices = review.batches.find(batch => batch.id === 'LMR-02')?.uiProductSlices ?? []
    expect(uiProductSlices.map(slice => slice.id)).toEqual(['LMR-02C', 'LMR-02K'])
    expect(uiProductSlices.every(slice => slice.canOwnRuntime === false)).toBe(true)
    expect(uiProductSlices.find(slice => slice.id === 'LMR-02C')?.subSlices?.map(slice => slice.id)).toEqual(['LMR-02C.01', 'LMR-02C.08'])
    expect(uiProductSlices.find(slice => slice.id === 'LMR-02K')?.subSlices?.map(slice => slice.semanticDecision)).toEqual(['replace-delete-candidate'])
    expect(review.uiProductReplaceDeleteCandidateCount).toBe(2)
    expect(review.legacyOwnerSliceCount).toBe(9)
    expect(review.legacyOwnerSubSliceCount).toBe(7)
    expect(review.legacyOwnerReplaceDeleteCandidateCount).toBe(4)
    expect(review.legacyOwnerReviewBeforeKeepCount).toBe(2)
    expect(review.batches.find(batch => batch.id === 'LMR-05')?.targetOwner).toContain('Query Loop')
    expect(review.batches.every(batch => batch.canAutoClose === false)).toBe(true)
    expect(review.nextAction).toBe('review-tool-runtime-migration')
  })

  test('passes only when no legacy mainline entries remain', () => {
    const ledger = buildV18DirtyQuarantineLedger({
      nowIso: '2026-05-12T00:00:00.000Z',
      lines: [' M src/dsxu/engine/release-test-gate.ts'],
    })
    const review = buildLegacyMainlineDirtyReview(ledger)

    expect(review.status).toBe('PASS')
    expect(review.total).toBe(0)
    expect(review.canCloseLegacyMainlineGate).toBe(true)
    expect(review.mustNotStageOrRestore).toBe(false)
    expect(review.batches).toEqual([])
    expect(review.nextAction).toBe('legacy-mainline-gate-closed')
  })

  test('writes current legacy mainline review without changing git state', async () => {
    const review = await runLegacyMainlineDirtyReviewHarness()

    expect(review.evidencePath).toContain('legacy-mainline-dirty-review.evidence.json')
    expect(review.tracePath).toContain('legacy-mainline-dirty-review.trace.json')
    expect(existsSync(review.evidencePath)).toBe(true)
    expect(existsSync(review.tracePath)).toBe(true)
    expect(review.status).toBe('PARTIAL')
    expect(review.total).toBeGreaterThan(0)
    expect(review.batches.length).toBeGreaterThanOrEqual(3)
    expect(review.highRiskBatchCount).toBeGreaterThanOrEqual(1)
    expect(review.toolRuntimeReviewStatus).toBe('PARTIAL')
    expect(review.toolRuntimeReviewBatchCount).toBeGreaterThanOrEqual(4)
    expect(review.uiProductSliceCount).toBeGreaterThan(0)
    expect(review.uiProductSubSliceCount).toBeGreaterThan(0)
    expect(review.uiProductReplaceDeleteCandidateCount).toBeGreaterThan(0)
    expect(review.uiProductReviewBeforeKeepCount).toBe(0)
    expect(review.legacyOwnerSliceCount).toBeGreaterThan(0)
    expect(review.legacyOwnerSubSliceCount).toBeGreaterThan(0)
    expect(review.legacyOwnerReplaceDeleteCandidateCount).toBeGreaterThan(0)
    expect(review.legacyOwnerReviewBeforeKeepCount).toBe(0)
    expect(review.batches
      .flatMap(batch => batch.ownerSlices ?? [])
      .every(slice => slice.targetOwner.length > 0 && slice.requiredAction.length > 0)).toBe(true)
    expect(review.batches
      .flatMap(batch => batch.uiProductSlices ?? [])
      .every(slice => slice.canOwnRuntime === false)).toBe(true)
    expect(review.batches
      .flatMap(batch => batch.uiProductSlices ?? [])
      .flatMap(slice => slice.subSlices ?? [])
      .some(slice => slice.semanticDecision === 'replace-delete-candidate')).toBe(true)
    expect(review.batches
      .flatMap(batch => batch.uiProductSlices ?? [])
      .some(slice => slice.obsoletePathCount > 0 && slice.semanticDecision === 'keep-mainline')).toBe(true)
    expect(review.mustNotStageOrRestore).toBe(true)
  }, 60_000)
})
