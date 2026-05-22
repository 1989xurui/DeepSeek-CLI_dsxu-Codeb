import { buildGoldenTrainingFixtures } from './golden-fixtures'
import { buildReplayTrainingFixtures } from './replay-fixtures'
import {
  classifyTrainingSample,
  summarizeTrainingQualityTiers,
  type DsxuTrainingQualityTier,
} from './quality-tier'

export const TRAINING_PREFERENCE_PAIRS_SCHEMA_VERSION = 'dsxu.training-preference-pairs.v1' as const

export interface DsxuTrainingPreferencePair {
  id: string
  category: string
  winnerSampleId: string
  rejectedSampleId: string
  winnerTier: Exclude<DsxuTrainingQualityTier, 'rejected'>
  rejectedTier: DsxuTrainingQualityTier
  rejectedReasons: readonly string[]
  preferenceReason: string
  hardGateFocus: string
}

export interface DsxuTrainingPreferencePairsReport {
  schemaVersion: typeof TRAINING_PREFERENCE_PAIRS_SCHEMA_VERSION
  generatedAt: string
  datasetKind: 'internal_synthetic_preference_pairs'
  publicClaimAllowed: false
  sourceSampleCount: number
  pairCount: number
  qualitySummary: ReturnType<typeof summarizeTrainingQualityTiers>
  rejectedReasonCoverage: number
  hardGates: {
    pairCountAtLeast2000: boolean
    rejectedReasonCoverageAtLeast95: boolean
    noPublicClaim: boolean
  }
  pairs: readonly DsxuTrainingPreferencePair[]
  rule: string
}

export function buildTrainingPreferencePairsReport(input: {
  minPairs?: number
} = {}): DsxuTrainingPreferencePairsReport {
  const minPairs = input.minPairs ?? 2000
  const fixtures = [...buildGoldenTrainingFixtures(), ...buildReplayTrainingFixtures()]
  const decisions = fixtures.map(fixture => classifyTrainingSample(fixture, fixture.fixtureId))
  const decisionById = new Map(decisions.map(decision => [decision.sampleId, decision]))
  const winners = fixtures.filter(fixture => {
    const tier = decisionById.get(fixture.fixtureId)?.tier
    return tier === 'gold' || tier === 'silver'
  })
  const rejected = fixtures.filter(fixture => {
    const decision = decisionById.get(fixture.fixtureId)
    return decision?.tier === 'rejected' && decision.hardGateViolations.length > 0
  })

  if (winners.length === 0 || rejected.length === 0) {
    throw new Error('Cannot build preference pairs without both winners and rejected samples')
  }

  const pairs: DsxuTrainingPreferencePair[] = []
  for (let index = 0; index < minPairs; index += 1) {
    const winner = winners[index % winners.length]
    const loser = rejected[(index * 7 + Math.floor(index / winners.length)) % rejected.length]
    const winnerDecision = decisionById.get(winner.fixtureId)
    const rejectedDecision = decisionById.get(loser.fixtureId)
    if (!winnerDecision || !rejectedDecision || winnerDecision.tier === 'rejected') continue
    const rejectedReasons = rejectedDecision.hardGateViolations.length > 0
      ? rejectedDecision.hardGateViolations
      : rejectedDecision.reasons
    pairs.push({
      id: `pref-${String(index + 1).padStart(5, '0')}`,
      category: winner.category === loser.category ? winner.category : `${winner.category}_vs_${loser.category}`,
      winnerSampleId: winner.fixtureId,
      rejectedSampleId: loser.fixtureId,
      winnerTier: winnerDecision.tier,
      rejectedTier: rejectedDecision.tier,
      rejectedReasons,
      preferenceReason: 'Prefer verification-bound, source-grounded DSXU trajectory over hard-gate violation.',
      hardGateFocus: rejectedReasons[0] ?? 'quality_gap',
    })
  }

  const rejectedReasonCoverage = ratio(
    pairs.filter(pair => pair.rejectedReasons.length > 0).length,
    pairs.length,
  )
  const hardGates = {
    pairCountAtLeast2000: pairs.length >= minPairs,
    rejectedReasonCoverageAtLeast95: rejectedReasonCoverage >= 0.95,
    noPublicClaim: true,
  }

  return {
    schemaVersion: TRAINING_PREFERENCE_PAIRS_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    datasetKind: 'internal_synthetic_preference_pairs',
    publicClaimAllowed: false,
    sourceSampleCount: fixtures.length,
    pairCount: pairs.length,
    qualitySummary: summarizeTrainingQualityTiers(decisions),
    rejectedReasonCoverage,
    hardGates,
    pairs,
    rule: 'Preference pairs are internal synthetic training-policy evidence. They must not be published as benchmark wins or live task success rates.',
  }
}

function ratio(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0
  return Math.round((numerator / denominator) * 10000) / 10000
}
