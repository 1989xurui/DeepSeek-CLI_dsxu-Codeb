import { inspectTrainingTrajectoryAntiCheat, type DsxuTrainingAntiCheatFinding } from './anti-cheat'
import { getTrainingFixtureExpected, isTrainingFixture, unwrapTrainingFixture, type DsxuTrainingFixtureExpected } from './fixture'
import {
  TRAINING_TRAJECTORY_SCHEMA_VERSION,
  type DsxuTrainingTrajectory,
  validateTrainingTrajectoryShape,
} from './schema'

export type DsxuTrainingValidationStatus = 'accepted' | 'rejected'

export interface DsxuTrainingTrajectoryValidation {
  schemaVersion: 'dsxu.training-validation.v1'
  status: DsxuTrainingValidationStatus
  errors: readonly string[]
  antiCheatFindings: readonly DsxuTrainingAntiCheatFinding[]
  hardGateViolations: readonly string[]
}

export interface DsxuTrainingDatasetValidationReport {
  schemaVersion: 'dsxu.training-dataset-validation.v1'
  generatedAt: string
  inputPath: string
  strict: boolean
  sampleCount: number
  acceptedCount: number
  rejectedCount: number
  status: 'PASS' | 'FAIL'
  items: readonly {
    path: string
    validation: DsxuTrainingTrajectoryValidation
    expected?: DsxuTrainingFixtureExpected
    expectedMatched: boolean
  }[]
}

export function validateTrainingTrajectory(value: unknown): DsxuTrainingTrajectoryValidation {
  value = unwrapTrainingFixture(value)
  const shape = validateTrainingTrajectoryShape(value)
  const antiCheatFindings = shape.ok
    ? inspectTrainingTrajectoryAntiCheat(value as DsxuTrainingTrajectory)
    : []
  const errors = [...shape.errors]
  const hardGateViolations = [
    ...errors.map(error => `schema:${error}`),
    ...antiCheatFindings.map(finding => finding.blocker),
  ]

  return {
    schemaVersion: 'dsxu.training-validation.v1',
    status: hardGateViolations.length === 0 ? 'accepted' : 'rejected',
    errors,
    antiCheatFindings,
    hardGateViolations,
  }
}

export function assertTrainingTrajectory(value: unknown): asserts value is DsxuTrainingTrajectory {
  const validation = validateTrainingTrajectory(value)
  if (validation.status !== 'accepted') {
    throw new Error(`Invalid ${TRAINING_TRAJECTORY_SCHEMA_VERSION}: ${validation.hardGateViolations.join('; ')}`)
  }
}

export function buildDatasetValidationReport(input: {
  inputPath: string
  strict: boolean
  items: readonly { path: string; value: unknown }[]
}): DsxuTrainingDatasetValidationReport {
  const items = input.items.map(item => ({
    path: item.path,
    validation: validateTrainingTrajectory(item.value),
    expected: getTrainingFixtureExpected(item.value),
    expectedMatched: matchesExpectedValidation(
      validateTrainingTrajectory(item.value),
      getTrainingFixtureExpected(item.value),
    ),
  }))
  const acceptedCount = items.filter(item => item.validation.status === 'accepted').length
  const rejectedCount = items.length - acceptedCount
  const failedExpectationCount = items.filter(item => !item.expectedMatched).length
  return {
    schemaVersion: 'dsxu.training-dataset-validation.v1',
    generatedAt: new Date().toISOString(),
    inputPath: input.inputPath,
    strict: input.strict,
    sampleCount: items.length,
    acceptedCount,
    rejectedCount,
    status: failedExpectationCount === 0 && (input.strict ? items.every(item => item.expected || item.validation.status === 'accepted') : true)
      ? 'PASS'
      : 'FAIL',
    items,
  }
}

export function validateTrainingFixtureShape(value: unknown): string[] {
  const errors: string[] = []
  if (!isTrainingFixture(value)) return ['fixture must use dsxu.training-fixture.v1 envelope']
  if (!value.fixtureId) errors.push('fixtureId is required')
  if (!value.category) errors.push('category is required')
  if (!value.description) errors.push('description is required')
  if (!value.expected) errors.push('expected is required')
  if (!Array.isArray(value.expected.seesRange) || value.expected.seesRange.length !== 2) {
    errors.push('expected.seesRange must be [min,max]')
  }
  return errors
}

function matchesExpectedValidation(
  validation: DsxuTrainingTrajectoryValidation,
  expected?: DsxuTrainingFixtureExpected,
): boolean {
  if (!expected) return validation.status === 'accepted'
  if (validation.status !== expected.validationStatus) return false
  const expectedViolations = expected.hardGateViolations ?? []
  return expectedViolations.every(violation => validation.hardGateViolations.includes(violation))
}
