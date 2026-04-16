import { DataSource, Opportunity } from '../opportunity-discovery';

export class GithubDataSource implements DataSource {
  name = 'github';
  type = 'code-repository';

  async collect(): Promise<Opportunity[]> {
    // Mock implementation. A production version should query GitHub APIs or
    // repository snapshots instead of returning hard-coded examples.
    return [
      {
        id: `github-${Date.now()}-1`,
        title: 'AI代码审查工具',
        description: '基于 AI 的自动化代码审查工具，可提升代码质量和评审效率。',
        category: 'developer-tools',
        source: 'github',
        revenuePotential: '3-8万/月',
        executionDifficulty: 'medium',
        timeline: '2-4周',
        priorityScore: 8.3,
        discoveredAt: new Date(),
        metadata: {
          stars: 1500,
          forks: 300,
          language: 'TypeScript',
        },
      },
      {
        id: `github-${Date.now()}-2`,
        title: '自动化部署工具',
        description: '围绕 CI/CD 的自动化部署解决方案，适合中小团队快速落地。',
        category: 'devops',
        source: 'github',
        revenuePotential: '2-5万/月',
        executionDifficulty: 'low',
        timeline: '1-3周',
        priorityScore: 7.5,
        discoveredAt: new Date(),
        metadata: {
          stars: 800,
          forks: 150,
          language: 'Go',
        },
      },
    ];
  }
}
