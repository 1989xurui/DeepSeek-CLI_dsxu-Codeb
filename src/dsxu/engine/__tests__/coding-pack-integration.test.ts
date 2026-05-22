import { beforeEach, describe, expect, it } from 'bun:test'
import { createSession, createTask } from '../session'
import { ReviewerSubagent } from '../reviewer-subagent'
import { runVerifyGate } from '../verify-gate'
import type { Session, Task } from '../session'
import type { QueryEvent, QueryResult } from '../types'

function editEvent(id: string, content = 'file edit applied'): QueryEvent {
  return {
    type: 'tool_result',
    toolName: 'FileEdit',
    toolUseId: id,
    result: {
      toolUseId: id,
      content,
      isError: false,
    },
  }
}

function passingVerificationEvent(id = 'bash-verify'): QueryEvent {
  return {
    type: 'tool_result',
    toolName: 'Bash',
    toolUseId: id,
    result: {
      toolUseId: id,
      content: 'bun test src/example.test.ts\n1 pass\n0 fail',
      isError: false,
      exitCode: 0,
    },
  }
}

function baseResult(overrides: Partial<QueryResult> = {}): QueryResult {
  return {
    exitReason: 'end_turn',
    finalMessage: 'task completed',
    turns: 3,
    totalUsage: { inputTokens: 100, outputTokens: 50 },
    finalGear: 1,
    messages: [],
    memories: [],
    ...overrides,
  }
}

describe('Coding Pack integration', () => {
  let session: Session
  let task: Task

  beforeEach(() => {
    session = createSession({
      cwd: '/test/path',
      title: 'test session',
    })
    task = createTask({
      sessionId: session.id,
      title: 'test task',
      description: 'coding pack integration task',
    })
  })

  it('runs Verify before Reviewer with real post-edit evidence', async () => {
    expect(session.id).toBeDefined()
    expect(task.sessionId).toBe(session.id)

    const verifyResult = await runVerifyGate(
      [editEvent('edit-1'), passingVerificationEvent()],
      baseResult(),
      {
        enabled: true,
        triggerOnFileEdit: true,
        minScore: 70,
        onFailure: 'block',
      },
    )

    expect(verifyResult.verification?.passed).toBe(true)

    const reviewer = new ReviewerSubagent()
    const reviewResult = reviewer.review(
      [editEvent('edit-1'), passingVerificationEvent()],
      verifyResult.result,
    )

    expect(reviewResult.approved).toBe(true)
    expect(reviewResult.comments).toBeInstanceOf(Array)
  })

  it('keeps review usable when verification warns on missing evidence', async () => {
    const verifyResult = await runVerifyGate([editEvent('edit-1')], baseResult(), {
      enabled: true,
      triggerOnFileEdit: true,
      minScore: 90,
      onFailure: 'warn',
    })

    expect(verifyResult.verification?.passed).toBe(false)
    expect(verifyResult.result.finalMessage).toContain('Verification warning')

    const reviewer = new ReviewerSubagent()
    const reviewResult = reviewer.review([editEvent('edit-1')], verifyResult.result)

    expect(reviewResult).toBeDefined()
    expect(reviewResult.approved).toBeDefined()
  })

  it('marks rollback events as review risk', () => {
    const events: QueryEvent[] = [
      {
        type: 'transaction_rolled_back',
        txId: 'tx-1',
        filesChanged: ['src/file1.ts'],
        reason: 'tool_error',
      },
      editEvent('edit-1', 'recovery edit applied'),
    ]

    const reviewer = new ReviewerSubagent({ failOnRollback: true })
    const reviewResult = reviewer.review(events, baseResult())

    expect(reviewResult.approved).toBe(false)
    expect(reviewResult.score).toBeLessThan(100)
  })

  it('penalizes repeated circuit-breaker skips', () => {
    const events: QueryEvent[] = [
      {
        type: 'tool_skipped_by_circuit_breaker',
        toolName: 'Bash',
        reason: 'high_failure_rate',
      },
      {
        type: 'tool_skipped_by_circuit_breaker',
        toolName: 'FileEdit',
        reason: 'high_failure_rate',
      },
      {
        type: 'tool_skipped_by_circuit_breaker',
        toolName: 'Bash',
        reason: 'high_failure_rate',
      },
    ]

    const reviewer = new ReviewerSubagent({ failOnCircuitSkipThreshold: 2 })
    const reviewResult = reviewer.review(events, baseResult({ turns: 2 }))

    expect(reviewResult.score).toBeLessThan(100)
  })

  it('completes the coding pack workflow with final verification evidence', async () => {
    const events: QueryEvent[] = [
      editEvent('edit-1', 'created feature file'),
      passingVerificationEvent('bash-1'),
      editEvent('edit-2', 'fixed edge case'),
      passingVerificationEvent('bash-2'),
    ]

    const verifyResult = await runVerifyGate(events, baseResult({ turns: 6 }), {
      enabled: true,
      triggerOnFileEdit: true,
      triggerOnBash: true,
      minScore: 70,
      onFailure: 'block',
    })

    expect(verifyResult.verification?.passed).toBe(true)

    const reviewer = new ReviewerSubagent({
      minScoreToApprove: 70,
      failOnRollback: true,
      failOnCircuitSkipThreshold: 2,
    })
    const reviewResult = reviewer.review(events, verifyResult.result)

    expect(reviewResult.approved).toBe(true)
    expect(reviewResult.score).toBeGreaterThanOrEqual(70)
    expect(reviewResult.riskLevel).toBeDefined()
  })

  it('keeps recoverable tool errors visible to review', () => {
    const events: QueryEvent[] = [
      {
        type: 'error',
        error: 'tool execution failed',
        recoverable: true,
      },
      editEvent('edit-1', 'recovery edit applied'),
    ]

    const reviewer = new ReviewerSubagent()
    const reviewResult = reviewer.review(events, baseResult({ turns: 3 }))

    expect(reviewResult.score).toBeLessThan(100)
    expect(reviewResult.comments.length).toBeGreaterThan(0)
  })

  it('rejects api-error exits in review', () => {
    const reviewer = new ReviewerSubagent()
    const reviewResult = reviewer.review(
      [],
      baseResult({
        exitReason: 'api_error',
        finalMessage: 'api error exit',
        turns: 1,
      }),
    )

    expect(reviewResult.approved).toBe(false)
    expect(reviewResult.score).toBeLessThan(100)
  })
})
