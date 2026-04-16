import { DataSource, Opportunity } from '../opportunity-discovery';

export class MarketDataSource implements DataSource {
  name = 'market';
  type = 'market-analysis';

  async collect(): Promise<Opportunity[]> {
    // Mock implementation. Replace with trend feeds, market crawlers, or
    // structured business signals when the pipeline is ready.
    return [
      {
        id: `market-${Date.now()}-1`,
        title: '自动化技术博客平台',
        description: 'AI 生成和发布技术内容的自动化平台，适合内容获客和产品教育。',
        category: 'content-creation',
        source: 'market',
        revenuePotential: '2-5万/月',
        executionDifficulty: 'low',
        timeline: '1-2周',
        priorityScore: 8.2,
        discoveredAt: new Date(),
        metadata: {
          marketSize: '中等',
          competition: '低',
          trend: '上升',
        },
      },
      {
        id: `market-${Date.now()}-2`,
        title: '本地化AI工具套件',
        description: '面向本地市场的 AI 工具集合，强调中文场景和行业流程适配。',
        category: 'ai-tools',
        source: 'market',
        revenuePotential: '2-4万/月',
        executionDifficulty: 'low',
        timeline: '2-3周',
        priorityScore: 7.9,
        discoveredAt: new Date(),
        metadata: {
          marketSize: '大',
          competition: '中等',
          trend: '快速增长',
        },
      },
    ];
  }
}
