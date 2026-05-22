import { describe, expect, test } from 'bun:test'
import {
  TRAINING_TRAJECTORY_REQUIRED_TOP_LEVEL_FIELDS,
  TRAINING_TRAJECTORY_SCHEMA_VERSION,
  TRAINING_TRAJECTORY_STATES,
  validateTrainingTrajectoryShape,
} from '../schema'
import { createDryRunTrainingTrajectory } from '../exporter'

describe('DSXU training trajectory schema', () => {
  test('defines the v1 schema contract expected by the execution plan', () => {
    expect(TRAINING_TRAJECTORY_SCHEMA_VERSION).toBe('dsxu.training-trajectory.v1')
    expect(TRAINING_TRAJECTORY_REQUIRED_TOP_LEVEL_FIELDS).toContain('task')
    expect(TRAINING_TRAJECTORY_REQUIRED_TOP_LEVEL_FIELDS).toContain('toolTrace')
    expect(TRAINING_TRAJECTORY_REQUIRED_TOP_LEVEL_FIELDS).toContain('scores')
    expect(TRAINING_TRAJECTORY_STATES).toEqual([
      'plan',
      'retrieve',
      'edit',
      'execute',
      'verify',
      'review',
      'recovery',
      'rollback',
      'final',
    ])
  })

  test('accepts a dry-run trajectory with no source body storage', () => {
    const { trajectory, validation } = createDryRunTrainingTrajectory()

    expect(validation.ok).toBe(true)
    expect(validation.errors).toEqual([])
    expect(trajectory.sourceTruth.sourceBodyStored).toBe(false)
    expect(trajectory.toolTrace.every(tool => tool.resultPaired)).toBe(true)
    expect(trajectory.scores.sees).toBeGreaterThanOrEqual(0)
    expect(trajectory.scores.sees).toBeLessThanOrEqual(100)
  })

  test('keeps schema validation focused on structure, not behavioral gates', () => {
    const { trajectory } = createDryRunTrainingTrajectory()
    const structurallyValidFalsePass = {
      ...trajectory,
      verification: {
        ...trajectory.verification,
        claimBound: false,
      },
      outcome: {
        ...trajectory.outcome,
        status: 'success',
      },
    }

    const validation = validateTrainingTrajectoryShape(structurallyValidFalsePass)

    expect(validation.ok).toBe(true)
    expect(validation.errors).toEqual([])
  })
})
