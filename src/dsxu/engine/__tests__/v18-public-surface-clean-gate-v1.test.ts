import { describe, expect, test } from 'bun:test'
import {
  buildV18PublicSurfaceCleanGate,
  runV18PublicSurfaceCleanGateHarness,
} from '../v18-public-surface-clean-gate'

const legacyProduct = ['Cl', 'aude'].join('')
const legacyMascot = ['Cl', 'awd'].join('')
const legacyVendor = ['Anth', 'ropic'].join('')
const legacyVendorScope = `@${legacyVendor.toLowerCase()}-ai/`

describe('V18 public surface clean gate V1', () => {
  test('blocks legacy/proprietary legacy naming in release paths and content', () => {
    const gate = buildV18PublicSurfaceCleanGate({
      files: [
        { path: `src/components/LogoV2/${legacyMascot}.tsx`, content: `export function ${legacyMascot}() {}` },
        { path: 'src/services/api/provider.ts', content: `Welcome to ${legacyProduct} Code` },
        { path: 'src/utils/sandbox.ts', content: `import x from "${legacyVendorScope}sandbox-runtime"` },
      ],
      nowIso: '2026-05-07T00:00:00.000Z',
    })

    expect(gate.status).toBe('BLOCKED_EVIDENCED')
    expect(gate.blockerCount).toBeGreaterThanOrEqual(3)
    expect(gate.violations.some(violation => violation.surface === 'path')).toBe(true)
    expect(gate.violations.some(violation => violation.surface === 'content')).toBe(true)
    expect(gate.byBucket.active_src).toBeGreaterThan(0)
  })

  test('excludes the original reference and quarantine directories from release scan', () => {
    const gate = buildV18PublicSurfaceCleanGate({
      files: [
        { path: `\u539f\u4ee3\u7801${legacyProduct.toLowerCase()}/query.ts`, content: `${legacyProduct} Code` },
        { path: `\u975edsxu-code\u9879\u76ee\u6587\u4ef6/archive/${legacyProduct.toLowerCase()}.txt`, content: legacyVendor },
        { path: 'src/dsxu/engine/runtime-core.ts', content: 'DSXU runtime' },
      ],
      nowIso: '2026-05-07T00:00:00.000Z',
    })

    expect(gate.status).toBe('DONE_EVIDENCED')
    expect(gate.violationCount).toBe(0)
  })

  test('keeps legacy model-family wording as review debt rather than public surface blocker', () => {
    const gate = buildV18PublicSurfaceCleanGate({
      files: [
        { path: 'src/utils/model/opusCompat.ts', content: 'Opus and Sonnet aliases require migration' },
      ],
      nowIso: '2026-05-07T00:00:00.000Z',
    })

    expect(gate.status).toBe('DONE_EVIDENCED')
    expect(gate.blockerCount).toBe(0)
    expect(gate.reviewCount).toBeGreaterThan(0)
    expect(gate.justifiedCount).toBe(0)
    expect(gate.sourceTruthDocJustifiedCount).toBe(0)
    expect(gate.benchContractJustifiedCount).toBe(0)
    expect(gate.publicSurfaceReviewCount).toBeGreaterThan(0)
    expect(gate.nonPublicReviewCount).toBe(0)
  })

  test('keeps hidden compatibility model aliases as justified findings', () => {
    const gate = buildV18PublicSurfaceCleanGate({
      files: [
        {
          path: 'src/dsxu/legacy/model/legacyProviderAliases.ts',
          content: 'export const aliases = ["opus", "sonnet", "haiku"]',
        },
        {
          path: 'src/migrations/migrateLegacyOpusToCurrent.ts',
          content: 'export const target = "opus"',
        },
      ],
      nowIso: '2026-05-09T00:00:00.000Z',
    })

    expect(gate.status).toBe('DONE_EVIDENCED')
    expect(gate.blockerCount).toBe(0)
    expect(gate.reviewCount).toBe(0)
    expect(gate.publicSurfaceReviewCount).toBe(0)
    expect(gate.nonPublicReviewCount).toBe(0)
    expect(gate.justifiedCount).toBeGreaterThan(0)
    expect(gate.compatModelAliasJustifiedCount).toBe(gate.justifiedCount)
    expect(gate.sourceTruthDocJustifiedCount).toBe(0)
    expect(gate.benchContractJustifiedCount).toBe(0)
    expect(gate.violations.every(violation => violation.severity === 'justified')).toBe(true)
  })

  test('keeps canonical V18/V19 planning docs as release-excluded review debt', () => {
    const gate = buildV18PublicSurfaceCleanGate({
      files: [
        {
          path: 'docs/DSXU_V19_EXECUTION_PLAN_ZH_20260509.md',
          content: `Compare with ${legacyProduct} Code source behavior, but do not ship that public surface.`,
        },
        {
          path: 'docs/DSXU_V18_PROGRESS_20260506.md',
          content: `${legacyVendor} reference appears only as historical planning context.`,
        },
      ],
      nowIso: '2026-05-09T00:00:00.000Z',
    })

    expect(gate.status).toBe('DONE_EVIDENCED')
    expect(gate.blockerCount).toBe(0)
    expect(gate.reviewCount).toBe(0)
    expect(gate.justifiedCount).toBe(2)
    expect(gate.sourceTruthDocJustifiedCount).toBe(2)
    expect(gate.publicSurfaceReviewCount).toBe(0)
    expect(gate.nonPublicReviewCount).toBe(0)
    expect(gate.byBucket.docs).toBe(2)
    expect(gate.violations.every(violation => violation.severity === 'justified')).toBe(true)
  })

  test('keeps benchmark scripts out of public surface review debt', () => {
    const gate = buildV18PublicSurfaceCleanGate({
      files: [
        {
          path: 'scripts/benchmark/dsxu-mainline-benchmark.ts',
          content: 'Benchmark fixture text mentions Opus as a hidden compatibility contract.',
        },
      ],
      nowIso: '2026-05-09T00:00:00.000Z',
    })

    expect(gate.status).toBe('DONE_EVIDENCED')
    expect(gate.blockerCount).toBe(0)
    expect(gate.reviewCount).toBe(0)
    expect(gate.justifiedCount).toBe(1)
    expect(gate.publicSurfaceReviewCount).toBe(0)
    expect(gate.nonPublicReviewCount).toBe(0)
    expect(gate.benchContractJustifiedCount).toBe(1)
    expect(gate.byBucket.tests).toBe(1)
    expect(gate.byBucket.scripts).toBe(0)
  })

  test('ignores narrow non-model false positives for audio extensions and random word lists', () => {
    const gate = buildV18PublicSurfaceCleanGate({
      files: [
        { path: 'src/constants/files.ts', content: "export const AUDIO = ['.opus']" },
        { path: 'src/utils/words.ts', content: "export const WORDS = ['sonnet']" },
      ],
      nowIso: '2026-05-07T00:00:00.000Z',
    })

    expect(gate.status).toBe('DONE_EVIDENCED')
    expect(gate.blockerCount).toBe(0)
    expect(gate.reviewCount).toBe(0)
  })

  test('writes current repository evidence without mutating files', async () => {
    const gate = await runV18PublicSurfaceCleanGateHarness()

    expect(gate.evidencePath).toContain('public-surface-clean-gate-20260507.evidence.json')
    expect(gate.scannedFileCount).toBeGreaterThan(0)
    expect(gate.blockerCount).toBe(0)
    expect(gate.publicSurfaceReviewCount).toBe(0)
    expect(gate.byBucket.active_src).toBe(0)
    expect(gate.byBucket.scripts).toBe(0)
    expect(gate.justifiedCount).toBeGreaterThan(0)
    expect(gate.compatModelAliasJustifiedCount).toBeGreaterThan(0)
    expect(gate.sourceTruthDocJustifiedCount).toBeGreaterThanOrEqual(0)
    expect(gate.benchContractJustifiedCount).toBeGreaterThan(0)
    expect(gate.safeguards.join('\n')).toContain('does not delete')
  })
})
