import type { DsxuTrainingDatasetValidationReport } from './validator'
import type { DsxuTrainingScoreResult } from './scorer'

export interface DsxuTrainingScoreReport {
  schemaVersion: 'dsxu.training-score-report.v1'
  generatedAt: string
  inputPath: string
  sampleCount: number
  scoredCount: number
  rejectedCount: number
  averageSees: number
  capsApplied: Record<string, number>
  expectedScoreMatchedCount: number
  expectedScoreMismatchedCount: number
  validation?: DsxuTrainingDatasetValidationReport
  items: readonly {
    path: string
    result: DsxuTrainingScoreResult
  }[]
}

export function buildTrainingScoreReport(input: {
  inputPath: string
  items: readonly { path: string; result: DsxuTrainingScoreResult }[]
  validation?: DsxuTrainingDatasetValidationReport
}): DsxuTrainingScoreReport {
  const scored = input.items.filter(item => item.result.status === 'scored' && item.result.scores)
  const seesTotal = scored.reduce((total, item) => total + (item.result.scores?.sees ?? 0), 0)
  const expectedItems = input.items.filter(item => item.result.expectedSeesMatched !== undefined)
  const capsApplied: Record<string, number> = {}
  for (const item of input.items) {
    for (const cap of item.result.capsApplied) {
      capsApplied[cap] = (capsApplied[cap] ?? 0) + 1
    }
  }

  return {
    schemaVersion: 'dsxu.training-score-report.v1',
    generatedAt: new Date().toISOString(),
    inputPath: input.inputPath,
    sampleCount: input.items.length,
    scoredCount: scored.length,
    rejectedCount: input.items.length - scored.length,
    averageSees: scored.length === 0 ? 0 : Math.round(seesTotal / scored.length),
    capsApplied,
    expectedScoreMatchedCount: expectedItems.filter(item => item.result.expectedSeesMatched).length,
    expectedScoreMismatchedCount: expectedItems.filter(item => item.result.expectedSeesMatched === false).length,
    validation: input.validation,
    items: input.items,
  }
}
