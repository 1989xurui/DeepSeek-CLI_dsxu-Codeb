import { describe, expect, test } from 'bun:test'
import { buildTrainingReplayReport } from '../replay'

describe('DSXU training replay report', () => {
  test('passes the core-300 internal replay gates without public benchmark claim', () => {
    const report = buildTrainingReplayReport('core-300')

    expect(report.status).toBe('PASS_INTERNAL_SYNTHETIC_REPLAY')
    expect(report.publicClaimAllowed).toBe(false)
    expect(report.sampleCount).toBe(300)
    expect(report.expectedMismatchedCount).toBe(0)
    expect(report.falsePassRate).toBe(0)
    expect(report.invalidToolCallRate).toBeLessThanOrEqual(0.05)
    expect(report.longTaskResumeSuccess).toBeGreaterThanOrEqual(0.85)
  })
})
