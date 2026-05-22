import type { Opportunity } from '../opportunity-discovery'

export class ScoringAnalyzer {
  async analyze(opportunities: Opportunity[]): Promise<Opportunity[]> {
    return opportunities.map((opportunity) => {
      let delta = 0
      if (opportunity.executionDifficulty === 'low') delta += 0.8
      if (opportunity.executionDifficulty === 'high') delta -= 0.8
      if (/10|20|high/i.test(opportunity.revenuePotential)) delta += 0.7
      return {
        ...opportunity,
        priorityScore: clampScore(opportunity.priorityScore + delta),
      }
    })
  }
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(10, Number(value.toFixed(2))))
}
