import { TRAINING_TRAJECTORY_SCHEMA_VERSION, type DsxuTrainingTrajectory } from './schema'
import type { DsxuTrainingValidationStatus } from './validator'

export const TRAINING_FIXTURE_SCHEMA_VERSION = 'dsxu.training-fixture.v1' as const

export interface DsxuTrainingFixtureExpected {
  validationStatus: DsxuTrainingValidationStatus
  hardGateViolations?: readonly string[]
  seesRange: readonly [number, number]
}

export interface DsxuTrainingFixture {
  schemaVersion: typeof TRAINING_FIXTURE_SCHEMA_VERSION
  fixtureId: string
  category: string
  description: string
  expected: DsxuTrainingFixtureExpected
  trajectory: DsxuTrainingTrajectory
}

export function isTrainingFixture(value: unknown): value is DsxuTrainingFixture {
  return Boolean(
    value &&
      typeof value === 'object' &&
      (value as Record<string, unknown>).schemaVersion === TRAINING_FIXTURE_SCHEMA_VERSION &&
      (value as Record<string, unknown>).trajectory &&
      (value as Record<string, unknown>).expected,
  )
}

export function unwrapTrainingFixture(value: unknown): DsxuTrainingTrajectory | unknown {
  if (isTrainingFixture(value)) return value.trajectory
  if (
    value &&
    typeof value === 'object' &&
    (value as Record<string, unknown>).trajectory &&
    ((value as Record<string, unknown>).trajectory as Record<string, unknown>).schemaVersion === TRAINING_TRAJECTORY_SCHEMA_VERSION
  ) {
    return (value as Record<string, unknown>).trajectory
  }
  if (
    value &&
    typeof value === 'object' &&
    (value as Record<string, unknown>).import &&
    ((value as Record<string, unknown>).import as Record<string, unknown>).trajectory &&
    (((value as Record<string, unknown>).import as Record<string, unknown>).trajectory as Record<string, unknown>).schemaVersion === TRAINING_TRAJECTORY_SCHEMA_VERSION
  ) {
    return ((value as Record<string, unknown>).import as Record<string, unknown>).trajectory
  }
  return value
}

export function getTrainingFixtureExpected(value: unknown): DsxuTrainingFixtureExpected | undefined {
  return isTrainingFixture(value) ? value.expected : undefined
}
