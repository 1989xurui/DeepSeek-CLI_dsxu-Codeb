import { describe, expect, test } from 'bun:test'
import { buildTrainingV2DatasetManifest } from '../dataset-manifest'

describe('DSXU training V2 dataset manifest', () => {
  test('meets V2 dataset hard gates while keeping public claims blocked', () => {
    const manifest = buildTrainingV2DatasetManifest({
      trajectoryMin: 980,
      preferencePairsMin: 2000,
    })

    expect(manifest.schemaVersion).toBe('dsxu.training-v2-dataset-manifest.v1')
    expect(manifest.publicClaimAllowed).toBe(false)
    expect(manifest.trajectoryCount).toBeGreaterThanOrEqual(980)
    expect(manifest.preferencePairCount).toBeGreaterThanOrEqual(2000)
    expect(manifest.qualitySummary.goldRatio).toBeGreaterThanOrEqual(0.6)
    expect(manifest.qualitySummary.rejectedReasonCoverage).toBeGreaterThanOrEqual(0.95)
    expect(manifest.qualitySummary.goldHardGateViolationCount).toBe(0)
    expect(Object.values(manifest.hardGates).every(Boolean)).toBe(true)
  })
})
