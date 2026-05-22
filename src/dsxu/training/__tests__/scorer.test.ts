import { describe, expect, test } from 'bun:test'
import { createDryRunTrainingTrajectory } from '../exporter'
import { scoreTrainingTrajectory } from '../scorer'

describe('DSXU training trajectory scorer', () => {
  test('scores a valid trajectory', () => {
    const { trajectory } = createDryRunTrainingTrajectory()
    const result = scoreTrainingTrajectory(trajectory)

    expect(result.status).toBe('scored')
    expect(result.scores?.sees).toBeGreaterThan(0)
    expect(result.capsApplied).toEqual([])
  })

  test('caps false pass at 80', () => {
    const { trajectory } = createDryRunTrainingTrajectory()
    const result = scoreTrainingTrajectory({
      ...trajectory,
      verification: {
        ...trajectory.verification,
        claimBound: false,
      },
      outcome: {
        ...trajectory.outcome,
        status: 'success',
      },
      scores: {
        ...trajectory.scores,
        sees: 96,
      },
    })

    expect(result.status).toBe('scored')
    expect(result.scores?.sees).toBeLessThanOrEqual(80)
    expect(result.capsApplied).toContain('false_pass_max_80')
  })

  test('caps public claim without raw evidence at 80', () => {
    const { trajectory } = createDryRunTrainingTrajectory()
    const result = scoreTrainingTrajectory({
      ...trajectory,
      task: {
        ...trajectory.task,
        claimScope: 'public',
      },
      sourceTruth: {
        ...trajectory.sourceTruth,
        evidenceHashes: [],
      },
      toolTrace: trajectory.toolTrace.map(tool => ({ ...tool, outputHash: undefined })),
      verification: {
        ...trajectory.verification,
        artifactPaths: [],
      },
      outcome: {
        ...trajectory.outcome,
        publicClaimAllowed: true,
      },
      scores: {
        ...trajectory.scores,
        sees: 98,
      },
    })

    expect(result.status).toBe('scored')
    expect(result.scores?.sees).toBeLessThanOrEqual(80)
    expect(result.capsApplied).toContain('public_claim_without_raw_evidence_max_80')
  })

  test('does not score schema invalid input', () => {
    const result = scoreTrainingTrajectory({ schemaVersion: 'wrong' })

    expect(result.status).toBe('rejected')
    expect(result.scores).toBeUndefined()
  })
})
