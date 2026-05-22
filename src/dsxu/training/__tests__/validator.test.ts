import { describe, expect, test } from 'bun:test'
import { createDryRunTrainingTrajectory, exportTrainingTrajectory } from '../exporter'
import { validateTrainingTrajectory } from '../validator'

describe('DSXU training trajectory validator', () => {
  test('accepts valid dry-run trajectory', () => {
    const { trajectory } = createDryRunTrainingTrajectory()
    const validation = validateTrainingTrajectory(trajectory)

    expect(validation.status).toBe('accepted')
    expect(validation.hardGateViolations).toEqual([])
  })

  test('rejects invalid schema', () => {
    const validation = validateTrainingTrajectory({ schemaVersion: 'wrong' })

    expect(validation.status).toBe('rejected')
    expect(validation.hardGateViolations.some(item => item.startsWith('schema:'))).toBe(true)
  })

  test('rejects false pass final claim', () => {
    const { trajectory } = createDryRunTrainingTrajectory()
    const validation = validateTrainingTrajectory({
      ...trajectory,
      verification: { ...trajectory.verification, claimBound: false },
      outcome: { ...trajectory.outcome, status: 'success' },
    })

    expect(validation.status).toBe('rejected')
    expect(validation.hardGateViolations).toContain('false_pass')
  })

  test('rejects analysis-only task edits', () => {
    const { trajectory } = exportTrainingTrajectory({
      intentUnderstanding: { explicitNoEdit: true },
      edits: [{ file: 'src/a.ts', intent: 'unexpected edit', sourceTruthFresh: true }],
      verification: { passed: false, claimBound: false },
    })
    const validation = validateTrainingTrajectory(trajectory)

    expect(validation.status).toBe('rejected')
    expect(validation.hardGateViolations).toContain('analysis_task_edited')
  })

  test('rejects agent partial upgraded to parent complete', () => {
    const { trajectory } = exportTrainingTrajectory({
      verification: { passed: true, claimBound: true },
      agentHandoff: [{
        agentId: 'worker-1',
        agentRole: 'worker',
        agentStatus: 'failed',
        evidencePacketPresent: false,
        parentClaimAllowed: true,
      }],
      outcome: { status: 'success', verified: true, publicClaimAllowed: false },
    })
    const validation = validateTrainingTrajectory(trajectory)

    expect(validation.status).toBe('rejected')
    expect(validation.hardGateViolations).toContain('agent_partial_upgraded')
  })

  test('rejects oracle or old report evidence flags', () => {
    const { trajectory } = exportTrainingTrajectory({
      verification: { passed: true, claimBound: true },
      antiCheat: { oracleLeakFlag: true },
      outcome: { status: 'success', verified: true, publicClaimAllowed: false },
    })
    const validation = validateTrainingTrajectory(trajectory)

    expect(validation.status).toBe('rejected')
    expect(validation.hardGateViolations).toContain('oracle_or_solution_leak')
  })
})
