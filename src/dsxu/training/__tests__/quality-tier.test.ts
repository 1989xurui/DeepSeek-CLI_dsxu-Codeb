import { describe, expect, test } from 'bun:test'
import { buildGoldenTrainingFixtures } from '../golden-fixtures'
import { buildReplayTrainingFixtures } from '../replay-fixtures'
import { classifyTrainingSample, summarizeTrainingQualityTiers } from '../quality-tier'

describe('DSXU training quality tiering', () => {
  test('classifies verified high-score samples as gold and hard-gate failures as rejected', () => {
    const samples = [...buildGoldenTrainingFixtures(), ...buildReplayTrainingFixtures()]
    const decisions = samples.map(sample => classifyTrainingSample(sample, sample.fixtureId))
    const summary = summarizeTrainingQualityTiers(decisions)

    expect(summary.sampleCount).toBe(360)
    expect(summary.counts.gold).toBeGreaterThan(200)
    expect(summary.counts.rejected).toBeGreaterThan(0)
    expect(summary.goldRatio).toBeGreaterThanOrEqual(0.6)
    expect(summary.rejectedReasonCoverage).toBe(1)
    expect(summary.goldHardGateViolationCount).toBe(0)
  })
})
