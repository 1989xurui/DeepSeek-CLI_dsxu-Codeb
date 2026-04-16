import { describe, it, expect } from 'vitest'
import { ReviewerSubagent } from '../reviewer-subagent'
import type { QueryEvent, QueryResult } from '../types'

function baseResult(exitReason: QueryResult['exitReason'] = 'end_turn'): QueryResult {
  return {
    finalMessage: 'done',
    exitReason,
    turns: 2,
    totalUsage: { inputTokens: 10, outputTokens: 5 },
    finalGear: 1,
    messages: [],
  }
}

describe('ReviewerSubagent', () => {
  it('should approve clean runs', () => {
    const reviewer = new ReviewerSubagent()
    const report = reviewer.review([], baseResult())
    expect(report.approved).toBe(true)
    expect(report.score).toBeGreaterThanOrEqual(75)
  })

  it('should flag rollback-heavy runs', () => {
    const reviewer = new ReviewerSubagent({ failOnRollback: true })
    const events: QueryEvent[] = [
      { type: 'transaction_rolled_back', txId: 'tx-1', filesChanged: ['a.ts'], reason: 'tool_error' },
    ]
    const report = reviewer.review(events, baseResult())
    expect(report.approved).toBe(false)
    expect(report.findings.some(f => f.title.includes('Rollback'))).toBe(true)
  })

  it('should penalize max_turns exits', () => {
    const reviewer = new ReviewerSubagent()
    const report = reviewer.review([], baseResult('max_turns'))
    expect(report.score).toBeLessThan(100)
    expect(report.findings.some(f => f.title.includes('Max Turns'))).toBe(true)
  })
})

