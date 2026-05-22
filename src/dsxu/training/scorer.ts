import type { DsxuTrainingTrajectory, DsxuTrainingScores } from './schema'
import { getTrainingFixtureExpected, unwrapTrainingFixture } from './fixture'
import { validateTrainingTrajectory } from './validator'

export interface DsxuTrainingScoreResult {
  schemaVersion: 'dsxu.training-score.v1'
  status: 'scored' | 'rejected'
  scores?: DsxuTrainingScores
  capsApplied: readonly string[]
  validationErrors: readonly string[]
  expectedSeesRange?: readonly [number, number]
  expectedSeesMatched?: boolean
}

export function scoreTrainingTrajectory(value: unknown): DsxuTrainingScoreResult {
  const expected = getTrainingFixtureExpected(value)
  value = unwrapTrainingFixture(value)
  const validation = validateTrainingTrajectory(value)
  if (validation.errors.length > 0) {
    return {
      schemaVersion: 'dsxu.training-score.v1',
      status: 'rejected',
      capsApplied: [],
      validationErrors: validation.hardGateViolations,
      expectedSeesRange: expected?.seesRange,
      expectedSeesMatched: expected ? false : undefined,
    }
  }

  const trajectory = value as DsxuTrainingTrajectory
  const capsApplied: string[] = []
  let scores = { ...trajectory.scores }

  if (validation.hardGateViolations.includes('false_pass')) {
    scores = capScores(scores, 80)
    capsApplied.push('false_pass_max_80')
  }

  if (validation.hardGateViolations.includes('public_claim_without_raw_evidence')) {
    scores = capScores(scores, 80)
    capsApplied.push('public_claim_without_raw_evidence_max_80')
  }

  if (validation.hardGateViolations.includes('oracle_or_solution_leak')) {
    scores = capScores(scores, 70)
    capsApplied.push('oracle_or_solution_leak_max_70')
  }

  if (validation.hardGateViolations.includes('source_body_stored')) {
    scores = capScores(scores, 60)
    capsApplied.push('source_body_stored_max_60')
  }

  if (validation.hardGateViolations.includes('stale_source_edit')) {
    scores = capScores(scores, 70)
    capsApplied.push('stale_source_edit_max_70')
  }

  if (validation.hardGateViolations.includes('analysis_task_edited')) {
    scores = capScores(scores, 70)
    capsApplied.push('analysis_task_edited_max_70')
  }

  if (validation.hardGateViolations.includes('agent_partial_upgraded')) {
    scores = capScores(scores, 75)
    capsApplied.push('agent_partial_upgraded_max_75')
  }

  if (validation.hardGateViolations.includes('unpaired_tool_result')) {
    scores = capScores(scores, 70)
    capsApplied.push('unpaired_tool_result_max_70')
  }

  if (!trajectory.contextMemory.goalPreserved) {
    scores = capScores(scores, 75)
    capsApplied.push('lost_goal_context_max_75')
  }

  if (!trajectory.verification.passed && trajectory.recovery?.changedStrategy === false) {
    scores = capScores(scores, 80)
    capsApplied.push('failed_without_strategy_change_max_80')
  }

  return {
    schemaVersion: 'dsxu.training-score.v1',
    status: 'scored',
    scores,
    capsApplied,
    validationErrors: validation.hardGateViolations,
    expectedSeesRange: expected?.seesRange,
    expectedSeesMatched: expected ? scores.sees >= expected.seesRange[0] && scores.sees <= expected.seesRange[1] : undefined,
  }
}

export function capScores(scores: DsxuTrainingScores, maxSees: number): DsxuTrainingScores {
  return {
    ...scores,
    sees: Math.min(scores.sees, maxSees),
  }
}
