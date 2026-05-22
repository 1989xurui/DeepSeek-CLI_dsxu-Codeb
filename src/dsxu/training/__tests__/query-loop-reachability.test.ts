import { describe, expect, it } from 'bun:test'
import {
  buildQueryLoopReachabilityArtifact,
  runQueryLoopReachabilityProbe,
} from '../query-loop-reachability'

describe('query-loop training trajectory reachability', () => {
  it('runs the real query-loop event stream into a valid training trajectory', async () => {
    const { artifact, events, result } = await runQueryLoopReachabilityProbe({
      sessionId: 'test-query-loop-reachability-session',
      requestId: 'test-query-loop-reachability-request',
      task: 'Probe query-loop event reachability for training trajectory export.',
    })

    expect(result.exitReason).toBe('end_turn')
    expect(artifact.validation.status).toBe('accepted')
    expect(artifact.score.status).toBe('scored')
    expect(artifact.publicClaimAllowed).toBe(false)
    expect(artifact.trajectory.outcome.publicClaimAllowed).toBe(false)
    expect(artifact.probe.requiredEventTypesPresent).toBe(true)
    expect(artifact.probe.eventTypes).toEqual(expect.arrayContaining([
      'loop_started',
      'model_called',
      'tool_start',
      'tool_result',
      'loop_finished',
    ]))
    expect(artifact.trajectory.toolTrace.map(tool => tool.toolName)).toEqual(['Read', 'Bash'])
    expect(artifact.trajectory.verification.passed).toBe(true)
    expect(artifact.trajectory.verification.claimBound).toBe(true)
    expect(artifact.trajectory.sourceTruth.sourceBodyStored).toBe(false)
    expect(events.length).toBeGreaterThanOrEqual(8)
  })

  it('keeps claim boundary closed if artifact is rebuilt from the event stream', async () => {
    const run = await runQueryLoopReachabilityProbe()
    const artifact = buildQueryLoopReachabilityArtifact({
      sessionId: 'rebuilt-session',
      requestId: 'rebuilt-request',
      task: 'Rebuild query-loop reachability artifact.',
      events: run.events,
      result: run.result,
    })

    expect(artifact.publicClaimAllowed).toBe(false)
    expect(artifact.trajectory.outcome.publicClaimAllowed).toBe(false)
    expect(artifact.validation.status).toBe('accepted')
  })
})
