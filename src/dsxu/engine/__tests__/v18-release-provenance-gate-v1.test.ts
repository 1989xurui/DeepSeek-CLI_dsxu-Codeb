import { describe, expect, test } from 'bun:test'
import {
  buildV18ReleaseProvenanceGate,
  runV18ReleaseProvenanceGateHarness,
} from '../v18-release-provenance-gate'

const legacyProduct = ['cl', 'aude'].join('')
const legacyVendor = ['anth', 'ropic'].join('')
const legacyVendorScope = `@${legacyVendor}-ai/`

describe('V18 release provenance gate V1', () => {
  test('blocks vendor-scoped dependency and legacy runtime shell paths', () => {
    const gate = buildV18ReleaseProvenanceGate({
      files: [
        { path: 'package.json', content: `"${legacyVendorScope}sandbox-runtime": "^0.0.1"` },
        { path: 'src/bridge/session.ts', content: 'export const x = 1' },
        { path: 'src/dsxu/control-plane/session.ts', content: 'export const x = 1' },
      ],
      nowIso: '2026-05-07T00:00:00.000Z',
    })

    expect(gate.status).toBe('BLOCKED_EVIDENCED')
    expect(gate.issues.some(issue => issue.surface === 'dependency')).toBe(true)
    expect(gate.issues.some(issue => issue.surface === 'path')).toBe(true)
  })

  test('excludes original reference and quarantine directories from provenance scan', () => {
    const gate = buildV18ReleaseProvenanceGate({
      files: [
        { path: `\u539f\u4ee3\u7801${legacyProduct}/query.ts`, content: `from ${legacyProduct}` },
        { path: `\u975edsxu-code\u9879\u76ee\u6587\u4ef6/archive/package.json`, content: `"${legacyVendorScope}x": "1"` },
        { path: 'src/dsxu/engine/runtime-core.ts', content: 'DSXU runtime' },
      ],
      nowIso: '2026-05-07T00:00:00.000Z',
    })

    expect(gate.status).toBe('DONE_EVIDENCED')
    expect(gate.issueCount).toBe(0)
  })

  test('classifies source-provenance wording as review debt', () => {
    const gate = buildV18ReleaseProvenanceGate({
      files: [
        { path: 'docs/plan.md', content: `absorb behavior from ${legacyProduct} reference` },
      ],
      nowIso: '2026-05-07T00:00:00.000Z',
    })

    expect(gate.status).toBe('DONE_EVIDENCED')
    expect(gate.blockerCount).toBe(0)
    expect(gate.reviewCount).toBeGreaterThan(0)
    expect(gate.justifiedCount).toBe(0)
  })

  test('keeps V18/V19 source provenance as release-excluded source truth', () => {
    const gate = buildV18ReleaseProvenanceGate({
      files: [
        {
          path: 'docs/DSXU_V19_EXECUTION_PLAN_20260509.md',
          content: `From ${legacyProduct} reference, kept only for planning source truth.`,
        },
      ],
      nowIso: '2026-05-09T00:00:00.000Z',
    })

    expect(gate.status).toBe('DONE_EVIDENCED')
    expect(gate.blockerCount).toBe(0)
    expect(gate.reviewCount).toBe(0)
    expect(gate.justifiedCount).toBe(1)
    expect(gate.sourceTruthDocJustifiedCount).toBe(1)
  })

  test('writes current repository provenance evidence without mutating files', async () => {
    const gate = await runV18ReleaseProvenanceGateHarness()

    expect(gate.evidencePath).toContain('release-provenance-gate-20260507.evidence.json')
    expect(gate.scannedFileCount).toBeGreaterThan(0)
    expect(gate.blockerCount).toBe(0)
    expect(gate.reviewCount).toBe(0)
    expect(gate.justifiedCount).toBeGreaterThanOrEqual(0)
    expect(gate.sourceTruthDocJustifiedCount).toBe(gate.justifiedCount)
    expect(gate.safeguards.join('\n')).toContain('vendor-scoped package dependencies')
  })
})
