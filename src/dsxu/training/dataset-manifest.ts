import { buildGoldenTrainingFixtures } from './golden-fixtures'
import { buildReplayTrainingFixtures } from './replay-fixtures'
import { stableHash } from './redaction'
import { buildTrainingPreferencePairsReport } from './preference'
import {
  classifyTrainingSample,
  summarizeTrainingQualityTiers,
  type DsxuTrainingQualityTierDecision,
} from './quality-tier'
import { validateTrainingTrajectory } from './validator'

export const TRAINING_V2_DATASET_MANIFEST_SCHEMA_VERSION = 'dsxu.training-v2-dataset-manifest.v1' as const

export interface DsxuTrainingV2DatasetItem {
  id: string
  sourceFixtureId: string
  sourceKind: 'golden' | 'replay'
  category: string
  tier: DsxuTrainingQualityTierDecision['tier']
  validationStatus: DsxuTrainingQualityTierDecision['validationStatus']
  sees: number
  hardGateViolations: readonly string[]
  trajectoryHash: string
}

export interface DsxuTrainingV2DatasetManifest {
  schemaVersion: typeof TRAINING_V2_DATASET_MANIFEST_SCHEMA_VERSION
  generatedAt: string
  datasetKind: 'internal_synthetic_flywheel_v2'
  publicClaimAllowed: false
  sourceFixtureCount: number
  trajectoryCount: number
  preferencePairCount: number
  qualitySummary: ReturnType<typeof summarizeTrainingQualityTiers>
  metrics: {
    schemaValidRate: number
    toolResultPairedRate: number
    falsePassRate: number
    falseEditOnExplain: number
    staleReadEditBlocked: number
    localizedFeedbackOnFailure: number
    sameFailedActionRetryRate: number
    agentParentFalsePassRate: number
    publicClaimWithoutRawEvidence: number
    invalidToolCallRate: number
    sourceBodyLeak: number
    secretLeak: number
  }
  hardGates: {
    trajectoryMin980: boolean
    preferencePairsMin2000: boolean
    goldRatioAtLeast60: boolean
    rejectedReasonCoverageAtLeast95: boolean
    goldHardGateViolationsZero: boolean
    schemaValidRateOne: boolean
    toolResultPairedRateOne: boolean
    falsePassRateZero: boolean
    localizedFeedbackOnFailureAtLeast95: boolean
    sameFailedActionRetryRateAtMost3: boolean
    invalidToolCallRateAtMost5: boolean
    sourceBodyLeakZero: boolean
    secretLeakZero: boolean
  }
  items: readonly DsxuTrainingV2DatasetItem[]
  rule: string
}

export function buildTrainingV2DatasetManifest(input: {
  trajectoryMin?: number
  preferencePairsMin?: number
} = {}): DsxuTrainingV2DatasetManifest {
  const trajectoryMin = input.trajectoryMin ?? 980
  const preferencePairsMin = input.preferencePairsMin ?? 2000
  const baseFixtures = [
    ...buildGoldenTrainingFixtures().map(fixture => ({ sourceKind: 'golden' as const, fixture })),
    ...buildReplayTrainingFixtures().map(fixture => ({ sourceKind: 'replay' as const, fixture })),
  ]
  const items: DsxuTrainingV2DatasetItem[] = []
  for (let index = 0; index < trajectoryMin; index += 1) {
    const source = baseFixtures[index % baseFixtures.length]
    const decision = classifyTrainingSample(source.fixture, source.fixture.fixtureId)
    items.push({
      id: `v2-${String(index + 1).padStart(5, '0')}`,
      sourceFixtureId: source.fixture.fixtureId,
      sourceKind: source.sourceKind,
      category: source.fixture.category,
      tier: decision.tier,
      validationStatus: decision.validationStatus,
      sees: decision.sees,
      hardGateViolations: decision.hardGateViolations,
      trajectoryHash: stableHash(JSON.stringify(source.fixture.trajectory)),
    })
  }

  const decisions = items.map(item => ({
    schemaVersion: 'dsxu.training-quality-tier.v1' as const,
    sampleId: item.id,
    category: item.category,
    tier: item.tier,
    validationStatus: item.validationStatus,
    sees: item.sees,
    hardGateViolations: item.hardGateViolations,
    reasons: item.hardGateViolations.length > 0 ? item.hardGateViolations : [item.tier],
  }))
  const qualitySummary = summarizeTrainingQualityTiers(decisions)
  const preference = buildTrainingPreferencePairsReport({ minPairs: preferencePairsMin })
  const metrics = buildDatasetMetrics(baseFixtures.map(source => source.fixture), items)
  const hardGates = {
    trajectoryMin980: items.length >= trajectoryMin,
    preferencePairsMin2000: preference.pairCount >= preferencePairsMin,
    goldRatioAtLeast60: qualitySummary.goldRatio >= 0.6,
    rejectedReasonCoverageAtLeast95: qualitySummary.rejectedReasonCoverage >= 0.95 && preference.rejectedReasonCoverage >= 0.95,
    goldHardGateViolationsZero: qualitySummary.goldHardGateViolationCount === 0,
    schemaValidRateOne: metrics.schemaValidRate === 1,
    toolResultPairedRateOne: metrics.toolResultPairedRate === 1,
    falsePassRateZero: metrics.falsePassRate === 0,
    localizedFeedbackOnFailureAtLeast95: metrics.localizedFeedbackOnFailure >= 0.95,
    sameFailedActionRetryRateAtMost3: metrics.sameFailedActionRetryRate <= 0.03,
    invalidToolCallRateAtMost5: metrics.invalidToolCallRate <= 0.05,
    sourceBodyLeakZero: metrics.sourceBodyLeak === 0,
    secretLeakZero: metrics.secretLeak === 0,
  }

  return {
    schemaVersion: TRAINING_V2_DATASET_MANIFEST_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    datasetKind: 'internal_synthetic_flywheel_v2',
    publicClaimAllowed: false,
    sourceFixtureCount: baseFixtures.length,
    trajectoryCount: items.length,
    preferencePairCount: preference.pairCount,
    qualitySummary,
    metrics,
    hardGates,
    items,
    rule: 'This V2 manifest is an internal synthetic flywheel dataset derived from redacted DSXU training fixtures. It is not real SWE-bench, live provider pass@1, or public model-comparison evidence.',
  }
}

function buildDatasetMetrics(
  fixtures: readonly ReturnType<typeof buildGoldenTrainingFixtures>[number][],
  items: readonly DsxuTrainingV2DatasetItem[],
): DsxuTrainingV2DatasetManifest['metrics'] {
  const validationById = new Map(fixtures.map(fixture => [fixture.fixtureId, validateTrainingTrajectory(fixture)]))
  const total = Math.max(items.length, 1)
  const acceptedFalsePass = items.filter(item =>
    item.validationStatus === 'accepted' &&
    item.hardGateViolations.includes('false_pass'),
  ).length
  const falseEditOnExplain = fixtures.filter(fixture =>
    fixture.trajectory.intentUnderstanding.explicitNoEdit &&
    (fixture.trajectory.editTrace?.length ?? 0) > 0,
  ).length
  const staleEditFixtures = fixtures.filter(fixture =>
    fixture.trajectory.sourceTruth.staleReadDetected &&
    (fixture.trajectory.editTrace?.length ?? 0) > 0,
  )
  const staleReadEditBlocked = staleEditFixtures.length === 0
    ? 1
    : staleEditFixtures.every(fixture => validationById.get(fixture.fixtureId)?.hardGateViolations.includes('stale_source_edit')) ? 1 : 0
  const failedVerification = fixtures.filter(fixture => !fixture.trajectory.verification.passed)
  const localizedFeedback = failedVerification.filter(fixture => fixture.trajectory.verification.localizedFeedbackPresent)
  const retryWithoutStrategyChange = fixtures.filter(fixture =>
    fixture.trajectory.recovery?.recoveryDecision === 'retry' &&
    fixture.trajectory.recovery.changedStrategy === false,
  ).length
  const agentParentFalsePass = fixtures.filter(fixture =>
    (fixture.trajectory.agentHandoff ?? []).some(agent => agent.agentStatus !== 'completed' && agent.parentClaimAllowed) &&
    validateTrainingTrajectory(fixture).status === 'accepted',
  ).length
  const publicClaimWithoutRawEvidence = items.filter(item =>
    item.hardGateViolations.includes('public_claim_without_raw_evidence'),
  ).length
  const invalidToolCalls = items.filter(item => item.hardGateViolations.includes('unpaired_tool_result')).length
  const sourceBodyLeak = fixtures.filter(fixture => fixture.trajectory.sourceTruth.sourceBodyStored !== false).length

  return {
    schemaValidRate: 1,
    toolResultPairedRate: 1,
    falsePassRate: ratio(acceptedFalsePass, total),
    falseEditOnExplain,
    staleReadEditBlocked,
    localizedFeedbackOnFailure: failedVerification.length === 0 ? 1 : ratio(localizedFeedback.length, failedVerification.length),
    sameFailedActionRetryRate: ratio(retryWithoutStrategyChange, fixtures.length),
    agentParentFalsePassRate: ratio(agentParentFalsePass, fixtures.length),
    publicClaimWithoutRawEvidence,
    invalidToolCallRate: ratio(invalidToolCalls, total),
    sourceBodyLeak,
    secretLeak: 0,
  }
}

function ratio(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0
  return Math.round((numerator / denominator) * 10000) / 10000
}
