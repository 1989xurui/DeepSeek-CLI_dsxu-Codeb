import { describe, expect, test } from 'bun:test'
import { runQuery } from '../query-loop'
import { ToolRegistry } from '../tool-registry'
import type { LLMCallFn } from '../types'

describe('query-loop runQuery V1', () => {
  test('runQuery consumes one queryLoop generator pass and does not double-call the model', async () => {
    let callCount = 0
    const llmCall: LLMCallFn = async () => {
      callCount += 1
      return {
        content: 'done once',
        toolCalls: [],
        stopReason: 'end_turn',
        usage: {
          inputTokens: 7,
          outputTokens: 3,
        },
      }
    }

    const result = await runQuery(
      {
        llmCall,
        maxTurns: 3,
        cwd: process.cwd(),
      },
      [{ role: 'user', content: 'finish without tools' }],
      new ToolRegistry(),
      {
        sessionId: 'run-query-single-pass-test',
        taskQuery: 'finish without tools',
      },
    )

    expect(callCount).toBe(1)
    expect(result.finalMessage).toBe('done once')
    expect(result.exitReason).toBe('end_turn')
    expect(result.turns).toBe(1)
    expect(result.totalUsage).toEqual({ inputTokens: 7, outputTokens: 3 })
  })
})
