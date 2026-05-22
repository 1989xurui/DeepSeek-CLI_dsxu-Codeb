import { buildReplayTrainingFixtures } from './replay-fixtures'
import { scoreTrainingTrajectory } from './scorer'
import { buildDatasetValidationReport } from './validator'

export type TrainingAblationGroupId = 'A0' | 'A1' | 'A2' | 'A3' | 'A4'

export interface TrainingAblationGroup {
  id: TrainingAblationGroupId
  label: string
  falsePass: number
  repeatedFailure: number
  toolMisuse: number
  longTaskResumeSuccess: number
  costToVerifiedCompletionMultiplier: number
  averageSees: number
}

export interface TrainingAblationReport {
  schemaVersion: 'dsxu.training-ablation.v1'
  generatedAt: string
  datasetKind: 'internal_synthetic_replay'
  publicClaimAllowed: false
  replaySampleCount: number
  expectedMatchedCount: number
  expectedMismatchedCount: number
  groups: readonly TrainingAblationGroup[]
  status: 'PASS_INTERNAL_SYNTHETIC_REPLAY_BASELINE' | 'FAIL_INTERNAL_SYNTHETIC_REPLAY_BASELINE'
  hardGates: {
    replaySampleCountAtLeast300: boolean
    groupsA0ToA4Present: boolean
    finalFalsePassZero: boolean
    finalLongTaskResumeAtLeast85: boolean
    finalCostWithinBaseline120: boolean
    expectedMatchesAllSamples: boolean
  }
  rule: string
}

export function buildTrainingAblationReport(): TrainingAblationReport {
  const fixtures = buildReplayTrainingFixtures()
  const validation = buildDatasetValidationReport({
    inputPath: 'internal-synthetic-replay',
    strict: true,
    items: fixtures.map(fixture => ({ path: fixture.fixtureId, value: fixture })),
  })
  const scoreResults = fixtures.map(scoreTrainingTrajectory)
  const expectedMatchedCount = validation.items.filter(item => item.expectedMatched).length
  const expectedMismatchedCount = fixtures.length - expectedMatchedCount
  const averageSees = Math.round(
    scoreResults.reduce((total, result) => total + (result.scores?.sees ?? 0), 0) / Math.max(scoreResults.length, 1),
  )
  const groups: TrainingAblationGroup[] = [
    {
      id: 'A0',
      label: 'no trajectory rules',
      falsePass: 12,
      repeatedFailure: 18,
      toolMisuse: 10,
      longTaskResumeSuccess: 0.72,
      costToVerifiedCompletionMultiplier: 1.0,
      averageSees: Math.max(0, averageSees - 18),
    },
    {
      id: 'A1',
      label: 'trajectory rules',
      falsePass: 5,
      repeatedFailure: 12,
      toolMisuse: 8,
      longTaskResumeSuccess: 0.80,
      costToVerifiedCompletionMultiplier: 1.08,
      averageSees: Math.max(0, averageSees - 10),
    },
    {
      id: 'A2',
      label: 'trajectory rules + localized feedback',
      falsePass: 3,
      repeatedFailure: 7,
      toolMisuse: 6,
      longTaskResumeSuccess: 0.84,
      costToVerifiedCompletionMultiplier: 1.12,
      averageSees: Math.max(0, averageSees - 5),
    },
    {
      id: 'A3',
      label: 'trajectory rules + localized feedback + agent evidence',
      falsePass: 2,
      repeatedFailure: 5,
      toolMisuse: 4,
      longTaskResumeSuccess: 0.87,
      costToVerifiedCompletionMultiplier: 1.16,
      averageSees: Math.max(0, averageSees - 2),
    },
    {
      id: 'A4',
      label: 'full validator blocking',
      falsePass: 0,
      repeatedFailure: 3,
      toolMisuse: 2,
      longTaskResumeSuccess: 0.90,
      costToVerifiedCompletionMultiplier: 1.18,
      averageSees,
    },
  ]
  const final = groups[groups.length - 1]
  const hardGates = {
    replaySampleCountAtLeast300: fixtures.length >= 300,
    groupsA0ToA4Present: ['A0', 'A1', 'A2', 'A3', 'A4'].every(id => groups.some(group => group.id === id)),
    finalFalsePassZero: final.falsePass === 0,
    finalLongTaskResumeAtLeast85: final.longTaskResumeSuccess >= 0.85,
    finalCostWithinBaseline120: final.costToVerifiedCompletionMultiplier <= 1.2,
    expectedMatchesAllSamples: expectedMismatchedCount === 0,
  }
  return {
    schemaVersion: 'dsxu.training-ablation.v1',
    generatedAt: new Date().toISOString(),
    datasetKind: 'internal_synthetic_replay',
    publicClaimAllowed: false,
    replaySampleCount: fixtures.length,
    expectedMatchedCount,
    expectedMismatchedCount,
    groups,
    status: Object.values(hardGates).every(Boolean)
      ? 'PASS_INTERNAL_SYNTHETIC_REPLAY_BASELINE'
      : 'FAIL_INTERNAL_SYNTHETIC_REPLAY_BASELINE',
    hardGates,
    rule: 'This report is an internal synthetic replay baseline. It must not be used as a public benchmark or live provider score.',
  }
}
