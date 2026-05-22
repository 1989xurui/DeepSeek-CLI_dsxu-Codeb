import { describe, expect, test } from 'bun:test'
import { shouldSuppressDsxuFinalUsageEvidence } from '../SystemTextMessage'

describe('shouldSuppressDsxuFinalUsageEvidence', () => {
  test('keeps final usage evidence out of normal chat rows', () => {
    const shouldSuppress = shouldSuppressDsxuFinalUsageEvidence([
      'DSXU final usage evidence: model=deepseek-v4-flash',
      'route=ordinary-verification',
      'workflow=bugfix',
      'estimated_cost_usd=0.012345',
      'cache_hit_input_tokens=1200',
    ].join('; '))

    expect(shouldSuppress).toBe(true)
  })

  test('keeps missing-usage evidence in trust state instead of chat rows', () => {
    const shouldSuppress = shouldSuppressDsxuFinalUsageEvidence([
      'DSXU final usage evidence: model=deepseek-v4-flash',
      'route=default',
      'workflow=generic_chat',
      'usage=unavailable',
    ].join('; '))

    expect(shouldSuppress).toBe(true)
  })

  test('suppresses short model cost/cache evidence rows from normal chat output', () => {
    expect(
      shouldSuppressDsxuFinalUsageEvidence(
        'Evidence: deepseek-v4-flash | cost=$0.0001 | cache=22656',
      ),
    ).toBe(true)
  })

  test('does not suppress ordinary system text', () => {
    expect(shouldSuppressDsxuFinalUsageEvidence('Welcome back!')).toBe(false)
  })
})
