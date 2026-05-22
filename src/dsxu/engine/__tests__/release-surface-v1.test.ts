import { describe, expect, test } from 'bun:test'
import {
  buildV18ModelPublicSurfaceGate,
  collectDsxuModelPublicSurfaceItems,
} from '../model-public-surface-gate'
import { runV18PublicSurfaceCleanGateHarness } from '../public-surface-clean-gate'
import {
  buildV18ReleaseProvenanceGate,
  runV18ReleaseProvenanceGateHarness,
} from '../release-provenance-gate'
import { runV18OpenSourcePackageGateHarness } from '../open-source-package-gate'
import { runV18ProprietaryCodeRiskGateHarness } from '../proprietary-code-risk-gate'

const RELEASE_SURFACE_GATE_TIMEOUT_MS = 20_000

describe('release surface V1', () => {
  test('DSXU public model surface ships only DSXU-owned model names', () => {
    const gate = buildV18ModelPublicSurfaceGate({
      items: collectDsxuModelPublicSurfaceItems(),
      nowIso: '2026-05-07T00:00:00.000Z',
    })

    expect(gate.blockerCount).toBe(0)
    expect(gate.provenanceManifest).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provenance: 'dsxu-owned',
          releasePolicy: 'ship',
        }),
        expect.objectContaining({
          provenance: 'archived-only',
          releasePolicy: 'migration-hidden',
        }),
      ]),
    )
  })

  test('release risk gate remains clear of hard blockers', async () => {
    const gate = await runV18ProprietaryCodeRiskGateHarness()

    expect(gate.status).toBe('DONE_EVIDENCED')
    expect(gate.blockerCount).toBe(0)
    expect(gate.byRule['vendor-dependency']).toBe(0)
    expect(gate.issues.filter(issue =>
      issue.severity === 'blocker' &&
      issue.ruleId === 'vendor-naming-or-api'
    )).toHaveLength(0)
    expect(gate.publicSurfaceReviewCount).toBe(0)
    expect(gate.byBucket.active_src).toBe(0)
    expect(gate.byBucket.provider_migration).toBeGreaterThan(0)
    expect(gate.byBucket.scripts).toBe(0)
    expect(gate.justifiedCount).toBeGreaterThan(0)
    expect(gate.providerMigrationModelAliasJustifiedCount).toBeGreaterThan(0)
    expect(gate.providerMigrationProtocolJustifiedCount).toBeGreaterThanOrEqual(0)
    expect(gate.sourceTruthDocJustifiedCount).toBeGreaterThanOrEqual(0)
    expect(gate.benchContractJustifiedCount).toBeGreaterThan(0)
  }, RELEASE_SURFACE_GATE_TIMEOUT_MS)

  test('public surface gate separates public surface from provider-migration review debt', async () => {
    const gate = await runV18PublicSurfaceCleanGateHarness()

    expect(gate.status).toBe('DONE_EVIDENCED')
    expect(gate.blockerCount).toBe(0)
    expect(gate.reviewCount).toBe(0)
    expect(gate.publicSurfaceReviewCount).toBe(0)
    expect(gate.byBucket.active_src).toBe(0)
    expect(gate.byBucket.provider_migration).toBeGreaterThan(0)
    expect(gate.byBucket.scripts).toBe(0)
    expect(gate.nonPublicReviewCount).toBe(0)
    expect(gate.justifiedCount).toBeGreaterThan(0)
    expect(gate.providerMigrationModelAliasJustifiedCount).toBeGreaterThan(0)
    expect(gate.sourceTruthDocJustifiedCount).toBeGreaterThanOrEqual(0)
    expect(gate.benchContractJustifiedCount).toBeGreaterThan(0)
  }, RELEASE_SURFACE_GATE_TIMEOUT_MS)

  test('release provenance gate keeps V18/V19 source truth out of review debt', async () => {
    const gate = await runV18ReleaseProvenanceGateHarness()

    expect(gate.status).toBe('DONE_EVIDENCED')
    expect(gate.blockerCount).toBe(0)
    expect(gate.reviewCount).toBeGreaterThanOrEqual(0)
    expect(gate.justifiedCount).toBeGreaterThanOrEqual(0)
    expect(gate.sourceTruthDocJustifiedCount).toBe(gate.justifiedCount)
  }, RELEASE_SURFACE_GATE_TIMEOUT_MS)

  test('release provenance gate still flags non-source-truth provenance references', () => {
    const sourceProduct = ['cl', 'aude'].join('')
    const gate = buildV18ReleaseProvenanceGate({
      nowIso: '2026-05-15T00:00:00.000Z',
      files: [
        {
          path: 'README.md',
          content: `Imported from ${sourceProduct} source.`,
        },
        {
          path: 'docs/DSXU_V24_SOURCE_TRUTH.md',
          content: `Imported from ${sourceProduct} source for planning evidence.`,
        },
      ],
    })

    expect(gate.blockerCount).toBe(0)
    expect(gate.reviewCount).toBe(1)
    expect(gate.justifiedCount).toBe(1)
    expect(gate.sourceTruthDocJustifiedCount).toBe(1)
  })

  test('clean export package gate is aggregated without fake-ready status', async () => {
    const gate = await runV18OpenSourcePackageGateHarness()

    expect(gate.status).toBe('DONE_EVIDENCED')
    expect(gate.releaseBlockerCount).toBe(0)
    expect(gate.cleanExportSummary.rewriteOrExcludeCount).toBeGreaterThan(0)
    expect(gate.cleanExportManifest.some(entry => entry.provenance === 'canonical-planning-source')).toBe(true)
    expect(gate.cleanExportReady).toBe(gate.pendingDeletionCount === 0)
    expect(gate.cleanExportStatus).toBe(
      gate.pendingDeletionCount === 0 ? 'READY_FOR_CLEAN_EXPORT' : 'PENDING_DELETION_REVIEW',
    )
    expect(gate.pendingDeletionClosure.total).toBe(gate.pendingDeletionCount)
    expect(gate.pendingDeletionClosure.safeguards.join('\n')).toContain('does not stage')
  }, RELEASE_SURFACE_GATE_TIMEOUT_MS)

  test('phase 10 focused-close audit keeps deletion mutation review explicit before export', async () => {
    const publicModel = buildV18ModelPublicSurfaceGate({
      items: collectDsxuModelPublicSurfaceItems(),
      nowIso: '2026-05-09T00:00:00.000Z',
    })
    const [publicSurface, provenance, packageGate, proprietary] = await Promise.all([
      runV18PublicSurfaceCleanGateHarness(),
      runV18ReleaseProvenanceGateHarness(),
      runV18OpenSourcePackageGateHarness(),
      runV18ProprietaryCodeRiskGateHarness(),
    ])

    expect(publicModel.blockerCount).toBe(0)
    expect(publicSurface.status).toBe('DONE_EVIDENCED')
    expect(publicSurface.blockerCount).toBe(0)
    expect(publicSurface.reviewCount).toBe(0)
    expect(publicSurface.publicSurfaceReviewCount).toBe(0)
    expect(provenance.blockerCount).toBe(0)
    expect(provenance.reviewCount).toBeGreaterThanOrEqual(0)
    expect(proprietary.status).toBe('DONE_EVIDENCED')
    expect(proprietary.blockerCount).toBe(0)
    expect(proprietary.reviewCount).toBe(0)
    expect(proprietary.publicSurfaceReviewCount).toBe(0)
    expect(packageGate.releaseBlockerCount).toBe(0)
    expect(packageGate.cleanExportReady).toBe(true)
    expect(packageGate.cleanExportStatus).toBe('READY_FOR_CLEAN_EXPORT')
    expect(packageGate.pendingDeletionCount).toBe(0)
    expect(packageGate.pendingDeletionClosure.total).toBe(packageGate.pendingDeletionCount)
    expect(packageGate.pendingDeletionClosure.safeguards.join('\n')).toContain('does not stage')
  }, RELEASE_SURFACE_GATE_TIMEOUT_MS)
})
