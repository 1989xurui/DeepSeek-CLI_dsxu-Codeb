import { describe, expect, test } from 'bun:test'
import { buildTrainingPreferencePairsReport } from '../preference'

describe('DSXU training preference pair generator', () => {
  test('builds enough internal pairs with rejected reasons and public claims blocked', () => {
    const report = buildTrainingPreferencePairsReport({ minPairs: 2000 })

    expect(report.schemaVersion).toBe('dsxu.training-preference-pairs.v1')
    expect(report.publicClaimAllowed).toBe(false)
    expect(report.pairCount).toBeGreaterThanOrEqual(2000)
    expect(report.rejectedReasonCoverage).toBeGreaterThanOrEqual(0.95)
    expect(Object.values(report.hardGates).every(Boolean)).toBe(true)
    expect(report.pairs.every(pair => pair.rejectedReasons.length > 0)).toBe(true)
  })
})
