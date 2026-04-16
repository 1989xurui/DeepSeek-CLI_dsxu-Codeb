import type { EvoMetrics, EvoProposal, EvoSuggestion, QueryEngineConfig } from './types'

export interface EvoEngineConfig {
  enabled?: boolean
  maxMutationsPerRun?: number
  allowModelSwitch?: boolean
}

export class EvoEngine {
  private readonly config: EvoEngineConfig

  constructor(config?: EvoEngineConfig) {
    this.config = {
      enabled: config?.enabled ?? false,
      maxMutationsPerRun: Math.max(1, config?.maxMutationsPerRun ?? 3),
      allowModelSwitch: config?.allowModelSwitch ?? false,
    }
  }

  propose(metrics: EvoMetrics, current: QueryEngineConfig): EvoProposal {
    if (!this.config.enabled) {
      return { safe: true, mutations: [], notes: ['EvoEngine disabled.'] }
    }

    const mutations: EvoSuggestion[] = []
    const notes: string[] = []

    if (metrics.toolSuccessRate < 0.99) {
      const from = current.toolSubset?.maxTools
      const to = clampInt((from ?? 12) + 2, 6, 24)
      if (from !== to) {
        mutations.push({
          path: 'toolSubset.maxTools',
          from,
          to,
          reason: 'Raise candidate tools to improve tool hit rate.',
        })
      }
    }

    if (metrics.avgRepairRounds > 2) {
      const from = current.toolSubset?.minTools
      const to = clampInt((from ?? 6) + 1, 4, 12)
      if (from !== to) {
        mutations.push({
          path: 'toolSubset.minTools',
          from,
          to,
          reason: 'Increase floor to reduce over-pruning and retries.',
        })
      }
    }

    if (metrics.longTaskRecoveryRate < 0.9) {
      const from = current.toolTransaction?.enabled
      if (from !== true) {
        mutations.push({
          path: 'toolTransaction.enabled',
          from,
          to: true,
          reason: 'Enable turn transactions to improve long-task recoverability.',
        })
      }
    }

    if (metrics.firstPassRate < 0.8) {
      const from = current.reviewerSubagent?.enabled
      if (from !== true) {
        mutations.push({
          path: 'reviewerSubagent.enabled',
          from,
          to: true,
          reason: 'Enable reviewer to catch regressions before final response.',
        })
      }
    }

    const limited = mutations.slice(0, this.config.maxMutationsPerRun)
    if (mutations.length > limited.length) {
      notes.push(`Trimmed mutations from ${mutations.length} to ${limited.length} by maxMutationsPerRun.`)
    }

    return { safe: true, mutations: limited, notes }
  }

  apply(current: QueryEngineConfig, proposal: EvoProposal): QueryEngineConfig {
    if (!proposal.safe || proposal.mutations.length === 0) return current
    const next: QueryEngineConfig = {
      ...current,
      toolSubset: { ...(current.toolSubset ?? {}) },
      toolTransaction: { ...(current.toolTransaction ?? {}) },
      reviewerSubagent: { ...(current.reviewerSubagent ?? {}) },
    }
    for (const m of proposal.mutations) {
      if (m.path === 'toolSubset.maxTools') next.toolSubset!.maxTools = Number(m.to)
      if (m.path === 'toolSubset.minTools') next.toolSubset!.minTools = Number(m.to)
      if (m.path === 'toolTransaction.enabled') next.toolTransaction!.enabled = Boolean(m.to)
      if (m.path === 'reviewerSubagent.enabled') next.reviewerSubagent!.enabled = Boolean(m.to)
    }
    return next
  }
}

function clampInt(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(n)))
}

