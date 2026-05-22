import { beforeEach, describe, expect, it } from 'bun:test'
import { createSession, createTask } from '../session'
import { MemorySystemImpl } from '../memory/memory-system'
import { runVerifyGate } from '../verify-gate'
import { ReviewerSubagent } from '../reviewer-subagent'
import type { Session, Task } from '../session'
import type { QueryEvent, QueryResult, Message } from '../types'

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

function result(overrides: Partial<QueryResult> = {}): QueryResult {
  return {
    exitReason: 'end_turn',
    finalMessage: 'task completed',
    turns: 5,
    totalUsage: { inputTokens: 250, outputTokens: 125 },
    finalGear: 1,
    messages: [],
    memories: [],
    ...overrides,
  }
}

describe('A/B/C end-to-end workflow', () => {
  let session: Session
  let task: Task
  let memorySystem: MemorySystemImpl

  beforeEach(() => {
    session = createSession({
      cwd: '/test/project',
      title: 'end-to-end session',
    })
    task = createTask({
      sessionId: session.id,
      title: 'end-to-end task',
      description: 'tests session, memory, verify, and review integration',
    })
    memorySystem = new MemorySystemImpl()
  })

  it('connects session, memory, verify, review, and compact with real verification evidence', async () => {
    expect(session.id).toMatch(/^session-/)
    expect(task.id).toMatch(/^task-/)
    expect(task.sessionId).toBe(session.id)

    const memoryId = await memorySystem.addMemory({
      type: 'extracted',
      content: 'important execution memory',
      sessionId: session.id,
      taskId: task.id,
      metadata: {
        importance: 85,
        quality: 0.9,
        tags: ['end-to-end', 'memory'],
      },
    })

    const memory = await memorySystem.getMemory(memoryId)
    expect(memory?.sessionId).toBe(session.id)
    expect(memory?.taskId).toBe(task.id)

    const queryResult = await memorySystem.query({
      where: {
        sessionId: session.id,
        taskId: task.id,
      },
    })
    expect(queryResult.length).toBeGreaterThan(0)

    const events: QueryEvent[] = [
      editEvent('edit-1', 'created feature file'),
      passingVerificationEvent('bash-1'),
    ]

    const verifyResult = await runVerifyGate(
      events,
      result({ memories: [memoryId] }),
      {
        enabled: true,
        triggerOnFileEdit: true,
        triggerOnBash: true,
        minScore: 70,
        onFailure: 'block',
      },
    )

    expect(verifyResult.verification?.passed).toBe(true)

    const reviewer = new ReviewerSubagent({
      minScoreToApprove: 70,
      failOnRollback: true,
    })
    const reviewResult = reviewer.review(events, verifyResult.result)

    expect(reviewResult.approved).toBe(true)
    expect(reviewResult.score).toBeGreaterThanOrEqual(70)

    const messages: Message[] = [
      { role: 'user', content: 'implement feature' },
      { role: 'assistant', content: 'created initial implementation' },
      { role: 'user', content: 'add tests' },
      { role: 'assistant', content: 'added focused tests' },
    ]

    const compactResult = await memorySystem.runCompactPipeline(session.id, messages)
    expect(compactResult.type).toBe('compact')
    expect(compactResult.originalMessageCount).toBe(messages.length)

    expect(memoryId).toBeDefined()
    expect(verifyResult.verification.ruleResults?.length).toBeGreaterThan(0)
    expect(reviewResult.ruleResults?.length).toBeGreaterThan(0)
  })

  it('keeps rollback recovery visible and rejected by strict review', async () => {
    const errorSession = createSession({
      cwd: '/error/test',
      title: 'error recovery session',
    })
    const errorTask = createTask({
      sessionId: errorSession.id,
      title: 'error recovery task',
      description: 'tests rollback review path',
    })

    expect(errorTask.sessionId).toBe(errorSession.id)

    const events: QueryEvent[] = [
      {
        type: 'transaction_rolled_back',
        txId: 'tx-error-1',
        filesChanged: ['src/error.ts'],
        reason: 'tool_error',
      },
      editEvent('edit-recovery', 'recovery edit applied'),
    ]

    const verifyResult = await runVerifyGate(events, result({ turns: 3 }), {
      enabled: true,
      triggerOnFileEdit: true,
      onFailure: 'continue',
    })

    expect(verifyResult.verification?.passed).toBe(false)

    const reviewer = new ReviewerSubagent({ failOnRollback: true })
    const reviewResult = reviewer.review(events, verifyResult.result)

    expect(reviewResult.approved).toBe(false)
    expect(reviewResult.score).toBeLessThan(100)
    expect(reviewResult.comments.length).toBeGreaterThan(0)
  })

  it('exposes integration components', () => {
    expect(typeof createSession).toBe('function')
    expect(typeof createTask).toBe('function')
    expect(MemorySystemImpl).toBeDefined()
    expect(typeof runVerifyGate).toBe('function')
    expect(ReviewerSubagent).toBeDefined()
  })
})
