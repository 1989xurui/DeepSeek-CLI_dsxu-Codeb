import { beforeEach, describe, expect, it, vi } from 'vitest'
import { runVerifyGate } from '../verify-gate'
import { ReviewerSubagent } from '../reviewer-subagent'
import type { QueryEvent, QueryResult } from '../types'

describe('GateIntegration', () => {
  const baseResult: QueryResult = {
    exitReason: 'end_turn',
    finalMessage: 'task completed',
    turns: 1,
    memories: [],
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('runs the edit verification and reviewer path without blocking safe edits', async () => {
    const events: QueryEvent[] = [
      {
        type: 'tool_result',
        toolName: 'FileEdit',
        toolUseId: 'edit-1',
        result: {
          toolUseId: 'edit-1',
          content: 'edited src/index.ts',
          isError: false,
        },
      },
    ]

    const { result: verifiedResult, verification } = await runVerifyGate(
      events,
      baseResult,
      {
        enabled: true,
        triggerOnFileEdit: true,
        minScore: 50,
        onFailure: 'warn',
      },
    )

    expect(verification).toBeDefined()
    expect(verifiedResult.verification).toBeDefined()

    const reviewer = new ReviewerSubagent({
      minScoreToApprove: 50,
      failOnRollback: false,
    })
    const reviewResult = reviewer.review(events, verifiedResult)

    expect(reviewResult.score).toBeGreaterThanOrEqual(50)
    expect(verifiedResult.exitReason).toBe('end_turn')
  })

  it('continues after recoverable shell verification when configured to continue', async () => {
    const events: QueryEvent[] = [
      {
        type: 'tool_result',
        toolName: 'Bash',
        toolUseId: 'bash-1',
        result: {
          toolUseId: 'bash-1',
          content: 'command failed',
          isError: true,
        },
      },
    ]

    const { result } = await runVerifyGate(events, baseResult, {
      enabled: true,
      triggerOnBash: true,
      minScore: 70,
      onFailure: 'continue',
    })

    expect(result.exitReason).toBe('end_turn')
  })
})