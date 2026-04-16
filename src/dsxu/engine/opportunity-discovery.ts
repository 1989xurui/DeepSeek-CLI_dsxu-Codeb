/**
 * Opportunity Discovery Engine
 *
 * Core engine for discovering, analyzing, and reporting opportunities.
 */

export interface Opportunity {
  id: string;
  title: string;
  description: string;
  category: string;
  source: string;
  revenuePotential: string; // e.g. "3-8万/月"
  executionDifficulty: 'low' | 'medium' | 'high';
  timeline: string; // e.g. "2-4周"
  priorityScore: number; // 0-10
  discoveredAt: Date;
  metadata?: Record<string, any>;
}

export interface DataSource {
  name: string;
  type: string;
  collect(): Promise<Opportunity[]>;
}

export interface Analyzer {
  name: string;
  analyze(opportunities: Opportunity[]): Promise<Opportunity[]>;
}

export interface Reporter {
  name: string;
  generateReport(opportunities: Opportunity[]): Promise<string>;
}

export class OpportunityDiscoveryEngine {
  private dataSources: DataSource[] = [];
  private analyzers: Analyzer[] = [];
  private reporters: Reporter[] = [];

  registerDataSource(source: DataSource): void {
    this.dataSources.push(source);
  }

  registerAnalyzer(analyzer: Analyzer): void {
    this.analyzers.push(analyzer);
  }

  registerReporter(reporter: Reporter): void {
    this.reporters.push(reporter);
  }

  async discover(): Promise<Opportunity[]> {
    const allOpportunities: Opportunity[] = [];

    for (const source of this.dataSources) {
      try {
        const opportunities = await source.collect();
        allOpportunities.push(...opportunities);
      } catch (error) {
        console.error(`Error collecting from source ${source.name}:`, error);
      }
    }

    return allOpportunities;
  }

  async analyze(opportunities: Opportunity[]): Promise<Opportunity[]> {
    let analyzedOpportunities = [...opportunities];

    for (const analyzer of this.analyzers) {
      try {
        analyzedOpportunities = await analyzer.analyze(analyzedOpportunities);
      } catch (error) {
        console.error(`Error in analyzer ${analyzer.name}:`, error);
      }
    }

    return analyzedOpportunities;
  }

  async generateReport(opportunities: Opportunity[]): Promise<string> {
    if (this.reporters.length === 0) {
      throw new Error('No reporters registered');
    }

    return this.reporters[0].generateReport(opportunities);
  }

  async runFullDiscovery(): Promise<{
    rawOpportunities: Opportunity[];
    analyzedOpportunities: Opportunity[];
    report: string;
  }> {
    const rawOpportunities = await this.discover();
    const analyzedOpportunities = await this.analyze(rawOpportunities);
    const report = await this.generateReport(analyzedOpportunities);

    return {
      rawOpportunities,
      analyzedOpportunities,
      report,
    };
  }

  categorizeByPriority(opportunities: Opportunity[]): {
    high: Opportunity[];
    medium: Opportunity[];
    low: Opportunity[];
  } {
    const high: Opportunity[] = [];
    const medium: Opportunity[] = [];
    const low: Opportunity[] = [];

    for (const opportunity of opportunities) {
      if (opportunity.priorityScore >= 8) {
        high.push(opportunity);
      } else if (opportunity.priorityScore >= 6) {
        medium.push(opportunity);
      } else {
        low.push(opportunity);
      }
    }

    high.sort((a, b) => b.priorityScore - a.priorityScore);
    medium.sort((a, b) => b.priorityScore - a.priorityScore);
    low.sort((a, b) => b.priorityScore - a.priorityScore);

    return { high, medium, low };
  }
}
