import { describe, expect, test } from 'bun:test'
import { buildTrainingAblationReport } from '../ablation'

describe('DSXU training ablation report', () => {
  test('compares A0-A4 and keeps public benchmark claim blocked', () => {
    const report = buildTrainingAblationReport()

    expect(report.status).toBe('PASS_INTERNAL_SYNTHETIC_REPLAY_BASELINE')
    expect(report.publicClaimAllowed).toBe(false)
    expect(report.replaySampleCount).toBe(300)
    expect(report.expectedMismatchedCount).toBe(0)
    expect(report.groups.map(group => group.id)).toEqual(['A0', 'A1', 'A2', 'A3', 'A4'])
    expect(report.hardGates.finalFalsePassZero).toBe(true)
    expect(report.hardGates.finalLongTaskResumeAtLeast85).toBe(true)
    expect(report.hardGates.finalCostWithinBaseline120).toBe(true)
  })
})
