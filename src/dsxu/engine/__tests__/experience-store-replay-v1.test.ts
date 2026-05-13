import { describe, expect, test } from 'bun:test'
import { existsSync } from 'fs'
import { runExperienceStoreReplayHarness } from '../../integration/harness/experience-store-replay-v1-harness'

describe('ExperienceStore replay V1', () => {
  test('records, recalls, deletes, explains, resumes, and reduces repeated exploration', async () => {
    const result = await runExperienceStoreReplayHarness()

    expect(result.ok).toBe(true)
    expect(result.deletedIds).toContain('exp-user-pref-delete-me')
    expect(result.recordedKinds).not.toContain('user_preference')
    expect(result.recallIds).toContain('exp-cart-negative-discount-failure')
    expect(result.recallIds).toContain('exp-cart-focused-verification')
    expect(result.recallIds).toContain('exp-cart-success-fix')
    expect(result.recordedKinds).toContain('cost_route')
    expect(result.costRouteEvidence.model).toBe('deepseek-v4-pro')
    expect(result.costRouteEvidence.routeReason).toBe('failed_verification_pro_thinking_max')
    expect(result.costRouteEvidence.modelEvidence).toContain('DSXU model evidence')
    expect(result.costRouteEvidence.costUsd).toBeGreaterThan(0)
    expect(result.traceIndexed).toBe(true)
    expect(result.traceIndex.eventCount).toBeGreaterThanOrEqual(8)
    expect(result.sourceTruthRefreshRequired).toBe(true)
    expect(result.mayClaimPassBeforeVerify).toBe(false)
    expect(result.readBeforeEdit).toBe(true)
    expect(result.verified).toBe(true)
    expect(result.events).toEqual([
      'fixture_created',
      'cold_verification_failed',
      'experience_recorded',
      'cost_route_recorded',
      'experience_deleted',
      'experience_recalled',
      'warm_read_source_truth',
      'warm_edit_source',
      'warm_verify_passed',
      'trace_indexed',
    ])
    expect(result.replayReport.repeatedExplorationReduced).toBe(true)
    expect(result.replayReport.toolCallReductionPct).toBeGreaterThanOrEqual(30)
    expect(result.replayReport.readReductionPct).toBeGreaterThanOrEqual(30)
    expect(result.replayReport.tokenReductionPct).toBeGreaterThanOrEqual(30)
    expect(result.replayReport.planningQuality.grade).toBe('strong')
    expect(result.replayReport.planningQuality.score).toBeGreaterThanOrEqual(90)
    expect(result.replayReport.planningQuality.hitRateEstimatePct).toBeGreaterThanOrEqual(85)
    expect(result.replayReport.planningQuality.wasteToolCallsAvoided).toBeGreaterThan(0)
    expect(result.replayReport.planningQuality.signals).toMatchObject({
      sourceTruthRefreshPresent: true,
      actionableVerificationPresent: true,
      failureAvoidancePresent: true,
      successfulFixPresent: true,
    })
    expect(result.explanation).toContain('deletablePath')
    expect(result.explanation).toContain('current source files must be reread')
    expect(`${result.stdout}\n${result.stderr}`).toContain('1 pass')
    expect(existsSync(result.tracePath)).toBe(true)
    expect(existsSync(result.evidencePath)).toBe(true)
  })
})
