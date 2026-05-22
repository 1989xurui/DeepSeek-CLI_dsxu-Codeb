import { buildReplayTrainingFixtures } from './replay-fixtures'
import { scoreTrainingTrajectory } from './scorer'
import { validateTrainingTrajectory } from './validator'

export type DsxuTrainingReplaySuite = 'core-300'

export interface DsxuTrainingReplayReport {
  schemaVersion: 'dsxu.training-replay.v1'
  generatedAt: string
  suite: DsxuTrainingReplaySuite
  datasetKind: 'internal_synthetic_replay'
  publicClaimAllowed: false
  sampleCount: number
  acceptedCount: number
  rejectedCount: number
  expectedMatchedCount: number
  expectedMismatchedCount: number
  falsePassRate: number
  invalidToolCallRate: number
  longTaskResumeSuccess: number
  sameFailedActionRetryRate: number
  status: 'PASS_INTERNAL_SYNTHETIC_REPLAY' | 'FAIL_INTERNAL_SYNTHETIC_REPLAY'
  hardGates: {
    sampleCountAtLeast300: boolean
    falsePassRateZero: boolean
    invalidToolCallRateAtMostFivePercent: boolean
    longTaskResumeAtLeastEightyFivePercent: boolean
    expectedMatchesAllSamples: boolean
  }
  rule: string
}

export function buildTrainingReplayReport(suite: DsxuTrainingReplaySuite = 'core-300'): DsxuTrainingReplayReport {
  if (suite !== 'core-300') {
    throw new Error(`Unsupported training replay suite: ${suite}`)
  }

  const fixtures = buildReplayTrainingFixtures()
  const validations = fixtures.map(fixture => validateTrainingTrajectory(fixture))
  const scores = fixtures.map(fixture => scoreTrainingTrajectory(fixture))
  const expectedMatchedCount = validations.filter((validation, index) => {
    const score = scores[index]
    return validation.status === fixtures[index].expected.validationStatus &&
      score.expectedSeesMatched !== false
  }).length
  const expectedMismatchedCount = fixtures.length - expectedMatchedCount
  const rejectedCount = validations.filter(validation => validation.status === 'rejected').length
  const acceptedCount = fixtures.length - rejectedCount
  const escapedFalsePassCount = validations.filter((validation, index) =>
    validation.status === 'accepted' &&
    fixtures[index].trajectory.outcome.status === 'success' &&
    !fixtures[index].trajectory.verification.claimBound,
  ).length
  const invalidToolCallCount = validations.filter(validation => validation.hardGateViolations.includes('unpaired_tool_result')).length
  const longTaskSamples = fixtures.filter(fixture => fixture.category === 'long-task')
  const longTaskExpectedMatched = longTaskSamples.filter(fixture => {
    const validation = validateTrainingTrajectory(fixture)
    const score = scoreTrainingTrajectory(fixture)
    return validation.status === fixture.expected.validationStatus && score.expectedSeesMatched !== false
  })
  const retryWithoutStrategyChange = fixtures.filter(fixture =>
    fixture.trajectory.recovery?.recoveryDecision === 'retry' &&
    fixture.trajectory.recovery.changedStrategy === false,
  ).length

  const hardGates = {
    sampleCountAtLeast300: fixtures.length >= 300,
    falsePassRateZero: escapedFalsePassCount === 0,
    invalidToolCallRateAtMostFivePercent: ratio(invalidToolCallCount, fixtures.length) <= 0.05,
    longTaskResumeAtLeastEightyFivePercent: ratio(longTaskExpectedMatched.length, longTaskSamples.length) >= 0.85,
    expectedMatchesAllSamples: expectedMismatchedCount === 0,
  }

  return {
    schemaVersion: 'dsxu.training-replay.v1',
    generatedAt: new Date().toISOString(),
    suite,
    datasetKind: 'internal_synthetic_replay',
    publicClaimAllowed: false,
    sampleCount: fixtures.length,
    acceptedCount,
    rejectedCount,
    expectedMatchedCount,
    expectedMismatchedCount,
    falsePassRate: ratio(escapedFalsePassCount, fixtures.length),
    invalidToolCallRate: ratio(invalidToolCallCount, fixtures.length),
    longTaskResumeSuccess: ratio(longTaskExpectedMatched.length, longTaskSamples.length),
    sameFailedActionRetryRate: ratio(retryWithoutStrategyChange, fixtures.length),
    status: Object.values(hardGates).every(Boolean)
      ? 'PASS_INTERNAL_SYNTHETIC_REPLAY'
      : 'FAIL_INTERNAL_SYNTHETIC_REPLAY',
    hardGates,
    rule: 'Internal synthetic replay calibrates DSXU training gates. It is not a live provider benchmark or public score.',
  }
}

function ratio(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0
  return Math.round((numerator / denominator) * 10000) / 10000
}
