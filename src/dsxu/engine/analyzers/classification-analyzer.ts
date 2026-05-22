import type { Opportunity } from '../opportunity-discovery'

export class ClassificationAnalyzer {
  async analyze(opportunities: Opportunity[]): Promise<Opportunity[]> {
    return opportunities.map((opportunity) => {
      const tags = new Set(opportunity.metadata?.tags ?? [])
      if (opportunity.category.includes('ai')) {
        tags.add('ai')
        tags.add('technology')
      }
      tags.add(`difficulty-${opportunity.executionDifficulty}`)
      return {
        ...opportunity,
        metadata: {
          ...opportunity.metadata,
          tags: Array.from(tags),
        },
      }
    })
  }
}
