import { describe, expect, test } from 'bun:test'
import { buildTrainingV2RunnerReport } from '../v2-runner'

describe('DSXU training V2 flywheel runner', () => {
  test('passes internal V2 stages and keeps external claims blocked', () => {
    const report = buildTrainingV2RunnerReport()

    expect(report.schemaVersion).toBe('dsxu.training-data-flywheel-v2-runner.v1')
    expect(report.status).toBe('PASS_INTERNAL_TRAINING_FLYWHEEL')
    expect(report.publicClaimAllowed).toBe(false)
    expect(report.stages).toHaveLength(8)
    expect(report.stages.every(stage => stage.passed)).toBe(true)
    expect(report.globalHardGates.every(gate => gate.passed)).toBe(true)
    expect(report.artifacts.datasetManifest.trajectoryCount).toBeGreaterThanOrEqual(980)
    expect(report.artifacts.preference.pairCount).toBeGreaterThanOrEqual(2000)
  })
})
