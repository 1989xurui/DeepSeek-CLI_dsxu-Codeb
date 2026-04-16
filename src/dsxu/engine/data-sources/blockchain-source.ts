import { DataSource, Opportunity } from '../opportunity-discovery';

export class BlockchainDataSource implements DataSource {
  name = 'blockchain';
  type = 'blockchain-analysis';

  async collect(): Promise<Opportunity[]> {
    // Mock implementation. This stays useful as a schema example until we
    // connect real on-chain or market data sources.
    return [
      {
        id: `blockchain-${Date.now()}-1`,
        title: '智能合约审计服务',
        description: '面向链上项目的智能合约安全审计服务，需求稳定但交付门槛较高。',
        category: 'blockchain-security',
        source: 'blockchain',
        revenuePotential: '5-15万/月',
        executionDifficulty: 'high',
        timeline: '3-6周',
        priorityScore: 7.8,
        discoveredAt: new Date(),
        metadata: {
          blockchain: 'Ethereum',
          auditComplexity: '高',
          demand: '高',
        },
      },
      {
        id: `blockchain-${Date.now()}-2`,
        title: 'DeFi收益聚合器',
        description: '自动化优化 DeFi 收益策略的平台，适合做研究型或实验型机会池。',
        category: 'defi',
        source: 'blockchain',
        revenuePotential: '4-10万/月',
        executionDifficulty: 'medium',
        timeline: '3-5周',
        priorityScore: 7.2,
        discoveredAt: new Date(),
        metadata: {
          blockchain: 'Multi-chain',
          tvlPotential: '高',
          risk: '中等',
        },
      },
    ];
  }
}
