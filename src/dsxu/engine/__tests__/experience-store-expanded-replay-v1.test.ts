import { describe, expect, test } from 'bun:test'
import { existsSync } from 'fs'
import { runExperienceStoreExpandedReplayHarness } from '../../integration/harness/experience-store-expanded-replay-v1-harness'

describe('ExperienceStore expanded replay V1', () => {
  test('covers feature native test and failed-verification recovery with source-truth replay', async () => {
    const result = await runExperienceStoreExpandedReplayHarness()

    expect(result.ok, JSON.stringify(result, null, 2)).toBe(true)
    expect(result.scenarioKinds).toEqual([
      'feature_native_test',
      'failed_verification_recovery',
    ])
    expect(result.aggregate).toMatchObject({
      scenarioCount: 2,
      allReadBeforeEdit: true,
      allVerified: true,
      allReducedExploration: true,
      failedVerificationUsesRecoveryRoute: true,
      featureCanStayFlash: true,
      strategyChangedAfterFailure: true,
      noRepeatedCommandWithoutStrategyChange: true,
    })

    const feature = result.scenarios.find(scenario => scenario.kind === 'feature_native_test')
    expect(feature?.costRoute.model).toBe('deepseek-v4-flash')
    expect(feature?.recallIds).toContain('exp-feature-tags-success')
    expect(feature?.replayReport.toolCallReductionPct).toBeGreaterThanOrEqual(30)
    expect(feature?.replayReport.readReductionPct).toBeGreaterThanOrEqual(30)
    expect(feature?.replayReport.planningQuality.grade).toBe('strong')
    expect(feature?.replayReport.planningQuality.signals.successfulFixPresent).toBe(true)
    expect(feature?.replayReport.planningQuality.signals.actionableVerificationPresent).toBe(true)

    const recovery = result.scenarios.find(scenario => scenario.kind === 'failed_verification_recovery')
    expect(recovery?.costRoute.model).toBe('deepseek-v4-flash')
    expect(recovery?.costRoute.routeReason).toBe('failed_verification_flash_thinking_max')
    expect(recovery?.strategyChangedAfterFailure).toBe(true)
    expect(recovery?.repeatedCommandWithoutStrategyChange).toBe(false)
    expect(recovery?.recallIds).toContain('exp-retry-failure-taxonomy')
    expect(recovery?.replayReport.warm.verificationRuns).toBeLessThan(
      recovery?.replayReport.cold.verificationRuns ?? 0,
    )
    expect(recovery?.replayReport.readReductionPct).toBeGreaterThanOrEqual(30)
    expect(recovery?.replayReport.planningQuality.grade).toBe('strong')
    expect(recovery?.replayReport.planningQuality.score).toBeGreaterThanOrEqual(95)
    expect(recovery?.replayReport.planningQuality.signals.failureAvoidancePresent).toBe(true)

    expect(existsSync(result.tracePath)).toBe(true)
    expect(existsSync(result.evidencePath)).toBe(true)
  })
})
