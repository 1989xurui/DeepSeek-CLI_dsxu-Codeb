import { getTrainingFixtureExpected, unwrapTrainingFixture } from './fixture'
import { scoreTrainingTrajectory } from './scorer'
import type { DsxuTrainingTrajectory } from './schema'
import { validateTrainingTrajectory } from './validator'

export type DsxuTrainingQualityTier = 'gold' | 'silver' | 'bronze' | 'rejected'

export interface DsxuTrainingQualityTierDecision {
  schemaVersion: 'dsxu.training-quality-tier.v1'
  sampleId: string
  category: string
  tier: DsxuTrainingQualityTier
  validationStatus: 'accepted' | 'rejected'
  sees: number
  hardGateViolations: readonly string[]
  reasons: readonly string[]
}

export interface DsxuTrainingQualityTierSummary {
  schemaVersion: 'dsxu.training-quality-tier-summary.v1'
  sampleCount: number
  counts: Record<DsxuTrainingQualityTier, number>
  goldRatio: number
  rejectedReasonCoverage: number
  goldHardGateViolationCount: number
}

export function classifyTrainingSample(value: unknown, sampleId = 'unknown'): DsxuTrainingQualityTierDecision {
  const trajectory = unwrapTrainingFixture(value) as Partial<DsxuTrainingTrajectory>
  const validation = validateTrainingTrajectory(value)
  const score = scoreTrainingTrajectory(value)
  const sees = score.scores?.sees ?? 0
  const expected = getTrainingFixtureExpected(value)
  const category = typeof trajectory.task?.category === 'string'
    ? trajectory.task.category
    : 'unknown'
  const reasons: string[] = []

  let tier: DsxuTrainingQualityTier
  if (validation.status === 'rejected') {
    tier = 'rejected'
    reasons.push(...validation.hardGateViolations)
    if (expected?.validationStatus === 'rejected') reasons.push('expected_negative_fixture')
  } else if (
    sees >= 85 &&
    validation.hardGateViolations.length === 0 &&
    trajectory.verification?.passed === true &&
    trajectory.verification?.claimBound === true &&
    trajectory.sourceTruth?.sourceBodyStored === false &&
    trajectory.toolTrace?.every(tool => tool.resultPaired) === true
  ) {
    tier = 'gold'
    reasons.push('verified_high_sees_no_hard_gate')
  } else if (sees >= 70) {
    tier = 'silver'
    reasons.push('accepted_medium_or_high_sees')
  } else {
    tier = 'bronze'
    reasons.push('accepted_low_score_or_partial_evidence')
  }

  return {
    schemaVersion: 'dsxu.training-quality-tier.v1',
    sampleId,
    category,
    tier,
    validationStatus: validation.status,
    sees,
    hardGateViolations: validation.hardGateViolations,
    reasons,
  }
}

export function summarizeTrainingQualityTiers(
  decisions: readonly DsxuTrainingQualityTierDecision[],
): DsxuTrainingQualityTierSummary {
  const counts: Record<DsxuTrainingQualityTier, number> = {
    gold: 0,
    silver: 0,
    bronze: 0,
    rejected: 0,
  }
  for (const decision of decisions) counts[decision.tier] += 1

  const rejected = decisions.filter(decision => decision.tier === 'rejected')
  const rejectedWithReason = rejected.filter(decision => decision.hardGateViolations.length > 0)
  const goldHardGateViolationCount = decisions
    .filter(decision => decision.tier === 'gold')
    .reduce((total, decision) => total + decision.hardGateViolations.length, 0)

  return {
    schemaVersion: 'dsxu.training-quality-tier-summary.v1',
    sampleCount: decisions.length,
    counts,
    goldRatio: decisions.length === 0 ? 0 : round(counts.gold / decisions.length),
    rejectedReasonCoverage: rejected.length === 0 ? 1 : round(rejectedWithReason.length / rejected.length),
    goldHardGateViolationCount,
  }
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000
}
