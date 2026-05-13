/**
 * R5-35 Live A/B harness unit tests.
 */
import { describe, expect, test } from 'bun:test'
import { runAb } from '../index'

describe('R5-35: DSXU wins', () => {
  test('all 3 DSXU wins', async () => {
    const r = await runAb('M2', ['t1', 't2', 't3'], {
      mockDsxuRunner: async () => ({
        score: 90,
        patch: 'fix',
        durationMs: 1000,
        tokens: 500,
        cost: 0.01,
      }),
      mockBaselineRunner: async () => ({
        score: 80,
        patch: 'fix',
        durationMs: 2000,
        tokens: 800,
        cost: 0.05,
      }),
    })
    expect(r.dsxuWins).toBe(3)
    expect(r.baselineWins).toBe(0)
    expect(r.ties).toBe(0)
    expect(r.totalTasks).toBe(3)
    expect(r.milestone).toBe('M2')
  })

  test('weightedGap negative when DSXU ahead', async () => {
    const r = await runAb('M2', ['t1'], {
      mockDsxuRunner: async () => ({
        score: 95,
        patch: 'a',
        durationMs: 500,
        tokens: 300,
        cost: 0.01,
      }),
      mockBaselineRunner: async () => ({
        score: 70,
        patch: 'b',
        durationMs: 1000,
        tokens: 500,
        cost: 0.05,
      }),
    })
    expect(r.weightedGap).toBeLessThan(0)
  })
})

describe('R5-35: baseline wins', () => {
  test('all baseline wins', async () => {
    const r = await runAb('M3', ['t1', 't2'], {
      mockDsxuRunner: async () => ({
        score: 60,
        patch: '',
        durationMs: 5000,
        tokens: 1000,
        cost: 0.02,
      }),
      mockBaselineRunner: async () => ({
        score: 95,
        patch: 'better',
        durationMs: 3000,
        tokens: 600,
        cost: 0.08,
      }),
    })
    expect(r.baselineWins).toBe(2)
    expect(r.dsxuWins).toBe(0)
    expect(r.weightedGap).toBeGreaterThan(0)
  })
})

describe('R5-35: ties', () => {
  test('equal scores result in tie', async () => {
    const r = await runAb('M4', ['t1'], {
      mockDsxuRunner: async () => ({
        score: 85,
        patch: 'a',
        durationMs: 1000,
        tokens: 500,
        cost: 0.01,
      }),
      mockBaselineRunner: async () => ({
        score: 85,
        patch: 'b',
        durationMs: 2000,
        tokens: 500,
        cost: 0.05,
      }),
    })
    expect(r.ties).toBe(1)
    expect(r.weightedGap).toBe(0)
  })
})

describe('R5-35: empty tasks', () => {
  test('returns 0 totals', async () => {
    const r = await runAb('M5', [], {})
    expect(r.totalTasks).toBe(0)
    expect(r.dsxuWins).toBe(0)
    expect(r.baselineWins).toBe(0)
    expect(r.ties).toBe(0)
  })

  test('has generatedAt', async () => {
    const r = await runAb('M5', [], {})
    expect(typeof r.generatedAt).toBe('string')
    expect(r.generatedAt.length).toBeGreaterThan(0)
  })
})

describe('R5-35: no mock fallback', () => {
  test('returns zero scores without mock', async () => {
    const r = await runAb('M1', ['t1'], {})
    expect(r.ties).toBe(1)
    expect(r.weightedGap).toBe(0)
  })
})
