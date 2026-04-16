import { describe, it, expect } from 'vitest'
import { EvoEngine } from '../evo-engine'
import type { QueryEngineConfig } from '../types'

const baseConfig: QueryEngineConfig = {
  llmCall: async () => ({
    content: 'ok',
    toolCalls: [],
    stopReason: 'end_turn',
    usage: { inputTokens: 1, outputTokens: 1 },
  }),
  toolSubset: { enabled: true, maxTools: 8, minTools: 4 },
}

describe('EvoEngine', () => {
  it('should return empty proposal when disabled', () => {
    const evo = new EvoEngine({ enabled: false })
    const p = evo.propose(
      {
        taskSuccessRate: 0.9,
        firstPassRate: 0.9,
        toolSuccessRate: 0.995,
        avgRepairRounds: 1.2,
        longTaskRecoveryRate: 0.95,
        costPerTask: 0.2,
      },
      baseConfig,
    )
    expect(p.mutations).toHaveLength(0)
  })

  it('should propose bounded safe mutations when metrics degrade', () => {
    const evo = new EvoEngine({ enabled: true, maxMutationsPerRun: 2 })
    const p = evo.propose(
      {
        taskSuccessRate: 0.7,
        firstPassRate: 0.6,
        toolSuccessRate: 0.9,
        avgRepairRounds: 3.5,
        longTaskRecoveryRate: 0.7,
        costPerTask: 0.5,
      },
      baseConfig,
    )
    expect(p.safe).toBe(true)
    expect(p.mutations.length).toBeLessThanOrEqual(2)
  })

  it('should apply proposal to config copy', () => {
    const evo = new EvoEngine({ enabled: true })
    const proposal = {
      safe: true,
      notes: [],
      mutations: [
        { path: 'toolSubset.maxTools', from: 8, to: 10, reason: 'test' },
        { path: 'toolTransaction.enabled', from: undefined, to: true, reason: 'test' },
      ],
    }
    const next = evo.apply(baseConfig, proposal)
    expect(next.toolSubset?.maxTools).toBe(10)
    expect(next.toolTransaction?.enabled).toBe(true)
    expect(baseConfig.toolSubset?.maxTools).toBe(8)
  })
})

