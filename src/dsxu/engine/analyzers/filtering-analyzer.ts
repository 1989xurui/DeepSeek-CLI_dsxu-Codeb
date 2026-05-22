import type { Opportunity } from '../opportunity-discovery'

export class FilteringAnalyzer {
  constructor(private readonly options: { minScore?: number; categories?: string[] } = {}) {}

  async analyze(opportunities: Opportunity[]): Promise<Opportunity[]> {
    return opportunities.filter((opportunity) => {
      if (this.options.minScore !== undefined && opportunity.priorityScore < this.options.minScore) {
        return false
      }
      if (
        this.options.categories &&
        this.options.categories.length > 0 &&
        !this.options.categories.includes(opportunity.category)
      ) {
        return false
      }
      return true
    })
  }
}
