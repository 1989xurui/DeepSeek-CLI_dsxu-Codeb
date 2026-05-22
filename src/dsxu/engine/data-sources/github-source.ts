import type { Opportunity, OpportunityDataSource } from '../opportunity-discovery'

export class GithubDataSource implements OpportunityDataSource {
  name = 'github'
  type = 'mock'

  async collect(): Promise<Opportunity[]> {
    return [
      {
        id: 'github-ai-review',
        title: 'AI代码审查工具',
        description: 'Mock GitHub opportunity used by owner evidence tests.',
        category: 'ai-tools',
        source: 'github',
        revenuePotential: '3-8万/月',
        executionDifficulty: 'medium',
        timeline: '2周',
        priorityScore: 7.8,
        discoveredAt: new Date(),
      },
    ]
  }
}
