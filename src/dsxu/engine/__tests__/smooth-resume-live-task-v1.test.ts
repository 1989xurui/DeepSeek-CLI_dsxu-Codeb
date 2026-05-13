import { describe, expect, test } from 'bun:test'
import { existsSync } from 'fs'
import { runSmoothResumeLiveTaskHarness } from '../../integration/harness/smooth-resume-live-task-v1-harness'

describe('smooth resume live task V1', () => {
  test('resumes from snapshot through source reread, edit, and focused verification', async () => {
    const result = await runSmoothResumeLiveTaskHarness()

    expect(result.ok).toBe(true)
    expect(result.readBeforeEdit).toBe(true)
    expect(result.verified).toBe(true)
    expect(result.mayClaimPassBeforeVerify).toBe(false)
    expect(result.failedCommandPreserved).toBe(true)
    expect(result.sourceTruthRefreshRequired).toBe(true)
    expect(result.secondTurnContextPreserved).toBe(true)
    expect(result.secondTurnSourceTruthReread).toBe(true)
    expect(result.secondTurnVerified).toBe(true)
    expect(result.secondTurnMayClaimPassBeforeVerify).toBe(false)
    expect(result.preservedGoal).toBe(true)
    expect(result.preservedCurrentPlan).toBe(true)
    expect(result.preservedTouchedFiles).toBe(true)
    expect(result.preservedDirtyState).toBe(true)
    expect(result.preservedToolEvidence).toBe(true)
    expect(result.preservedFailedAttempts).toBe(true)
    expect(result.preservedNextAction).toBe(true)
    expect(result.preservedConstraints).toBe(true)
    expect(result.preservedVerificationState).toBe(true)
    expect(result.replayReport.repeatedExplorationReduced).toBe(true)
    expect(result.replayReport.toolCallReductionPct).toBeGreaterThanOrEqual(30)
    expect(result.replayReport.tokenReductionPct).toBeGreaterThanOrEqual(30)
    expect(result.events).toEqual([
      'fixture_created',
      'precompact_verification_failed',
      'snapshot_created',
      'resume_plan_created',
      'read_source_truth',
      'edit_source',
      'verify_passed',
      'continuation_snapshot_created',
      'second_turn_resume_plan_created',
      'second_turn_read_source_truth',
      'second_turn_verify_passed',
    ])
    expect(`${result.stdout}\n${result.stderr}`).toContain('1 pass')
    expect(existsSync(result.tracePath)).toBe(true)
    expect(existsSync(result.evidencePath)).toBe(true)
  })
})
