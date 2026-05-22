/**
 * Quality Gate Mainline V1 tests.
 *
 * These tests verify the DSXU verification gate behavior without depending on
 * localized UI copy. User-facing text can change; gate state and evidence shape
 * must stay stable.
 */

import { describe, test, expect, beforeEach } from 'bun:test'
import { runVerifyGate } from '../verify-gate'
import type { QueryEvent, QueryResult } from '../types'

describe('Quality Gate Mainline V1', () => {
  let mockEvents: QueryEvent[]
  let mockResult: QueryResult

  beforeEach(() => {
    mockEvents = [
      {
        type: 'tool_result',
        toolName: 'FileEdit',
        result: { content: 'test content' },
        timestamp: Date.now(),
      },
      {
        type: 'tool_result',
        toolName: 'Bash',
        result: { content: 'bun test src/example.test.ts\n1 pass\n0 fail' },
        timestamp: Date.now(),
      },
    ] as QueryEvent[]

    mockResult = {
      exitReason: 'success',
      finalMessage: 'Test completed',
      sessionId: 'test-session-123',
      taskId: 'test-task-456',
    }
  })

  test('runs verification when file edits are present', async () => {
    const result = await runVerifyGate(mockEvents, mockResult, {
      enabled: true,
      triggerOnFileEdit: true,
      minScore: 70,
      onFailure: 'warn',
    })

    expect(result.verification).toBeDefined()
    expect(result.verification?.passed).toBe(true)
    expect(result.verification?.score).toBeGreaterThanOrEqual(70)
    expect(result.verification?.findings).toHaveLength(0)
  })

  test('skips verification when no configured mutation event exists', async () => {
    const noEditEvents: QueryEvent[] = [
      {
        type: 'tool_result',
        toolName: 'Bash',
        result: { content: 'ls -la' },
        timestamp: Date.now(),
      },
    ] as QueryEvent[]

    const result = await runVerifyGate(noEditEvents, mockResult, {
      enabled: true,
      triggerOnFileEdit: true,
      triggerOnBash: false,
      minScore: 70,
    })

    expect(result.verification).toBeUndefined()
  })

  test('blocks the final result when configured to block on failed verification', async () => {
    const result = await runVerifyGate(mockEvents, mockResult, {
      enabled: true,
      triggerOnFileEdit: true,
      minScore: 96,
      onFailure: 'block',
    })

    expect(result.verification).toBeDefined()
    if (!result.verification?.passed) {
      expect(result.result.exitReason).toBe('max_errors')
      expect(result.result.finalMessage).toContain('Task blocked by verification gate')
      expect(result.result.verification).toBe(result.verification)
    }
  })

  test('includes rule-level verification evidence', async () => {
    const result = await runVerifyGate(mockEvents, mockResult, {
      enabled: true,
      triggerOnFileEdit: true,
      minScore: 70,
    })

    expect(result.verification?.ruleResults).toBeDefined()
    expect(Array.isArray(result.verification?.ruleResults)).toBe(true)
    expect(result.verification?.ruleResults?.length).toBeGreaterThan(0)

    const ruleResult = result.verification?.ruleResults?.[0]
    expect(ruleResult?.ruleId).toBeDefined()
    expect(ruleResult?.status).toBeDefined()
    expect(ruleResult?.target).toBeDefined()
  })

  test('warn mode preserves success exit while surfacing warning evidence', async () => {
    const result = await runVerifyGate(mockEvents, mockResult, {
      enabled: true,
      triggerOnFileEdit: true,
      minScore: 96,
      onFailure: 'warn',
    })

    expect(result.verification).toBeDefined()
    if (!result.verification?.passed) {
      expect(result.result.exitReason).toBe('success')
      expect(result.result.finalMessage).toContain('[Verification warning]')
      expect(result.result.verification).toBe(result.verification)
    }
  })

  test('continue mode keeps the original final message while retaining verification evidence', async () => {
    const result = await runVerifyGate(mockEvents, mockResult, {
      enabled: true,
      triggerOnFileEdit: true,
      minScore: 96,
      onFailure: 'continue',
    })

    expect(result.verification).toBeDefined()
    if (!result.verification?.passed) {
      expect(result.result.exitReason).toBe('success')
      expect(result.result.finalMessage).toBe('Test completed')
      expect(result.result.verification).toBe(result.verification)
    }
  })
})
