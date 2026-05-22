export type OpportunityDifficulty = 'low' | 'medium' | 'high'

export type Opportunity = {
  id: string
  title: string
  description: string
  category: string
  source: string
  revenuePotential: string
  executionDifficulty: OpportunityDifficulty
  timeline: string
  priorityScore: number
  discoveredAt: Date
  metadata?: {
    tags?: string[]
    [key: string]: unknown
  }
}

export type OpportunityDataSource = {
  name: string
  type: string
  collect: () => Promise<Opportunity[]>
}

export class OpportunityDiscoveryEngine {
  private dataSources: OpportunityDataSource[] = []

  registerDataSource(source: OpportunityDataSource): void {
    this.dataSources.push(source)
  }

  async discover(): Promise<Opportunity[]> {
    const batches = await Promise.all(this.dataSources.map((source) => source.collect()))
    return batches.flat()
  }

  categorizeByPriority(opportunities: Opportunity[]): {
    high: Opportunity[]
    medium: Opportunity[]
    low: Opportunity[]
  } {
    return {
      high: opportunities.filter((item) => item.priorityScore >= 8),
      medium: opportunities.filter((item) => item.priorityScore >= 6 && item.priorityScore < 8),
      low: opportunities.filter((item) => item.priorityScore < 6),
    }
  }
}
