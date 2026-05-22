import { describe, expect, test } from 'bun:test'
import {
  buildV18OpenSourcePackageGate,
  runV18OpenSourcePackageGateHarness,
  shouldShipCleanExportManifestEntry,
} from '../open-source-package-gate'

const SOURCE_REFERENCE_PRODUCT = ['cl', 'aude'].join('')
const SOURCE_REFERENCE_ROOT = `\u539f\u4ee3\u7801${SOURCE_REFERENCE_PRODUCT}`

describe('V18 open-source package gate V1', () => {
  test('blocks old, scratch, and external reference paths from tracked release files', () => {
    const gate = buildV18OpenSourcePackageGate({
      trackedFiles: [
        'src/dsxu/engine/query-loop.ts',
        'tmp/v8-live-fixtures/example.ts',
        `${SOURCE_REFERENCE_ROOT}/package.json`,
        'src/bridge/bridgeMain.ts',
        'deepseek-proxy.ts',
      ],
      nowIso: '2026-05-07T00:00:00.000Z',
    })

    expect(gate.status).toBe('BLOCKED_EVIDENCED')
    expect(gate.violationCount).toBe(4)
    expect(gate.violations.map(violation => violation.ruleId)).toEqual([
      'local-runtime-scratch',
      'external-reference-source',
      'legacy-control-plane-shell',
      'old-root-shims',
    ])
    expect(gate.cleanExportStatus).toBe('BLOCKED_PRESENT_FORBIDDEN_PATHS')
    expect(gate.cleanExportReady).toBe(false)
    expect(gate.cleanExportSummary.excludeCount).toBe(4)
  })

  test('allows DSXU mainline source, focused tests, docs, and package metadata', () => {
    const gate = buildV18OpenSourcePackageGate({
      trackedFiles: [
        'src/dsxu/engine/query-loop.ts',
        'src/dsxu/engine/__tests__/release-test-gate-v1.test.ts',
        'docs/DSXU_V18_FINAL_EXECUTION_PLAN_20260506.md',
        'package.json',
        '.gitignore',
      ],
      nowIso: '2026-05-07T00:00:00.000Z',
    })

    expect(gate.status).toBe('DONE_EVIDENCED')
    expect(gate.ok).toBe(true)
    expect(gate.violationCount).toBe(0)
  })

  test('keeps canonical V18/V19 planning docs as rewrite-or-exclude source truth', () => {
    const gate = buildV18OpenSourcePackageGate({
      trackedFiles: [
        'src/dsxu/engine/query-loop.ts',
        'docs/DSXU_V19_EXECUTION_PLAN_ZH_20260509.md',
      ],
      nowIso: '2026-05-09T00:00:00.000Z',
    })

    const planningDoc = gate.cleanExportManifest.find(
      entry => entry.path === 'docs/DSXU_V19_EXECUTION_PLAN_ZH_20260509.md',
    )

    expect(gate.status).toBe('DONE_EVIDENCED')
    expect(gate.cleanExportStatus).toBe('READY_FOR_CLEAN_EXPORT')
    expect(gate.cleanExportReady).toBe(true)
    expect(gate.violationCount).toBe(0)
    expect(planningDoc?.provenance).toBe('canonical-planning-source')
    expect(planningDoc?.releasePolicy).toBe('rewrite-or-exclude')
    expect(gate.cleanExportSummary.shipCount).toBe(1)
    expect(gate.cleanExportSummary.rewriteOrExcludeCount).toBe(1)
  })

  test('ships only curated public docs while excluding internal DSXU evidence docs', () => {
    const gate = buildV18OpenSourcePackageGate({
      trackedFiles: [
        'README.md',
        'docs/BENCHMARK.md',
        'docs/assets/dsxu-routing-mix.svg',
        'docs/DSXU_V26_MASTER_PLAN_20260515.md',
        'docs/DSXU_REASONIX_COMPARATIVE_CODE_AUDIT_20260517.md',
        'docs/generated/DSXU_EVIDENCE_DASHBOARD_20260518.json',
      ],
      nowIso: '2026-05-18T00:00:00.000Z',
    })

    const shipped = gate.cleanExportManifest
      .filter(shouldShipCleanExportManifestEntry)
      .map(entry => entry.path)
    const internalEvidence = gate.cleanExportManifest.filter(entry =>
      entry.provenance === 'canonical-planning-source' ||
      entry.provenance === 'internal-generated-evidence'
    )

    expect(shipped).toEqual([
      'README.md',
      'docs/BENCHMARK.md',
      'docs/assets/dsxu-routing-mix.svg',
    ])
    expect(internalEvidence.map(entry => entry.path)).toEqual([
      'docs/DSXU_V26_MASTER_PLAN_20260515.md',
      'docs/DSXU_REASONIX_COMPARATIVE_CODE_AUDIT_20260517.md',
      'docs/generated/DSXU_EVIDENCE_DASHBOARD_20260518.json',
    ])
    expect(internalEvidence.every(entry => entry.releasePolicy === 'rewrite-or-exclude')).toBe(true)
    expect(gate.cleanExportSummary.shipCount).toBe(3)
    expect(gate.cleanExportSummary.rewriteOrExcludeCount).toBe(3)
    expect(gate.cleanExportReady).toBe(true)
  })

  test('separates tracked pending deletions from present release blockers', () => {
    const gate = buildV18OpenSourcePackageGate({
      trackedFiles: [
        'src/dsxu/engine/query-loop.ts',
        'src/bridge/bridgeMain.ts',
        'deepseek-proxy.ts',
      ],
      presentFiles: [
        'src/dsxu/engine/query-loop.ts',
      ],
      nowIso: '2026-05-07T00:00:00.000Z',
    })

    expect(gate.status).toBe('DONE_EVIDENCED')
    expect(gate.ok).toBe(true)
    expect(gate.violationCount).toBe(2)
    expect(gate.releaseBlockerCount).toBe(0)
    expect(gate.pendingDeletionCount).toBe(2)
    expect(gate.cleanExportStatus).toBe('PENDING_DELETION_REVIEW')
    expect(gate.cleanExportReady).toBe(false)
    expect(gate.pendingDeletionClosure.total).toBe(2)
    expect(gate.pendingDeletionClosure.byRule['legacy-control-plane-shell']).toBe(1)
    expect(gate.pendingDeletionClosure.byRule['old-root-shims']).toBe(1)
    expect(gate.pendingDeletionClosure.requiresMainlineReplacementEvidenceCount).toBe(2)
    expect(gate.pendingDeletions.map(violation => violation.path)).toEqual([
      'src/bridge/bridgeMain.ts',
      'deepseek-proxy.ts',
    ])
    expect(gate.cleanExportManifest.find(entry => entry.path === 'src/bridge/bridgeMain.ts')).toMatchObject({
      releasePolicy: 'pending-delete',
      provenance: 'pending-deletion-debt',
    })
    expect(gate.pendingDeletionClosure.entries.find(entry => entry.path === 'src/bridge/bridgeMain.ts')).toMatchObject({
      requiredAction: 'verify-mainline-replacement-then-commit-deletion',
      restorePolicy: 'do-not-restore-old-runtime-shell',
    })
  })

  test('writes current tracked package evidence without mutating files', async () => {
    const gate = await runV18OpenSourcePackageGateHarness()

    expect(gate.evidencePath).toContain('open-source-package-gate-20260507.evidence.json')
    expect(gate.trackedFileCount).toBeGreaterThan(0)
    expect(gate.candidateFileCount).toBe(gate.trackedFileCount)
    expect(gate.releaseBlockerCount).toBe(0)
    expect(gate.cleanExportStatus).toBe('READY_FOR_CLEAN_EXPORT')
    expect(gate.cleanExportReady).toBe(true)
    expect(gate.cleanExportSummary.pendingDeleteCount).toBe(gate.pendingDeletionCount)
    expect(gate.pendingDeletionClosure.total).toBe(gate.pendingDeletionCount)
    expect(gate.pendingDeletionCount).toBe(0)
    expect(gate.pendingDeletionClosure.byRule).toEqual({})
    expect(gate.pendingDeletionClosure.requiresMainlineReplacementEvidenceCount).toBe(0)
    expect(gate.pendingDeletionClosure.requiresNormalGitDeletionReviewCount).toBe(0)
    expect(gate.pendingDeletionClosure.safeguards.join('\n')).toContain('does not stage')
    expect(gate.cleanExportManifest.some(entry => entry.provenance === 'canonical-planning-source')).toBe(true)
    expect(gate.safeguards.join('\n')).toContain('does not delete')
  })
})
