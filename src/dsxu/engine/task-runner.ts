import * as fs from 'fs/promises';
import * as path from 'path';
import { ClassificationAnalyzer } from './analyzers/classification-analyzer';
import { FilteringAnalyzer } from './analyzers/filtering-analyzer';
import { ScoringAnalyzer } from './analyzers/scoring-analyzer';
import { BlockchainDataSource } from './data-sources/blockchain-source';
import { GithubDataSource } from './data-sources/github-source';
import { MarketDataSource } from './data-sources/market-source';
import { OpportunityDiscoveryEngine } from './opportunity-discovery';
import { DailyMarkdownReporter } from './reporters/daily-markdown-reporter';

export class OpportunityTaskRunner {
  private engine: OpportunityDiscoveryEngine;
  private reportsDir: string;

  constructor(reportsDir: string = './opportunity_reports') {
    this.engine = new OpportunityDiscoveryEngine();
    this.reportsDir = reportsDir;
    this.setupEngine();
  }

  private setupEngine(): void {
    this.engine.registerDataSource(new GithubDataSource());
    this.engine.registerDataSource(new MarketDataSource());
    this.engine.registerDataSource(new BlockchainDataSource());

    this.engine.registerAnalyzer(new ScoringAnalyzer());
    this.engine.registerAnalyzer(new ClassificationAnalyzer());
    this.engine.registerAnalyzer(
      new FilteringAnalyzer({
        minScore: 5,
      }),
    );

    this.engine.registerReporter(new DailyMarkdownReporter());
  }

  async runDiscovery(): Promise<void> {
    console.log('Starting opportunity discovery...');

    try {
      const result = await this.engine.runFullDiscovery();

      console.log('Discovery completed:');
      console.log(`  Raw opportunities: ${result.rawOpportunities.length}`);
      console.log(
        `  Analyzed opportunities: ${result.analyzedOpportunities.length}`,
      );

      await this.saveReport(result.report);
      await this.saveOpportunities(result.analyzedOpportunities);
      await this.sendNotification(result.analyzedOpportunities.length);

      console.log('Report generated successfully.');
    } catch (error) {
      console.error('Error during discovery:', error);
      throw error;
    }
  }

  private async saveReport(report: string): Promise<void> {
    await fs.mkdir(this.reportsDir, { recursive: true });

    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `opportunity-report-${dateStr}.md`;
    const filepath = path.join(this.reportsDir, filename);

    await fs.writeFile(filepath, report, 'utf-8');
    console.log(`Report saved to: ${filepath}`);
  }

  private async saveOpportunities(opportunities: unknown[]): Promise<void> {
    const dataDir = path.join(this.reportsDir, 'data');
    await fs.mkdir(dataDir, { recursive: true });

    const date = new Date();
    const dateStr = date.toISOString().split('T')[0];
    const filename = `opportunities-${dateStr}.json`;
    const filepath = path.join(dataDir, filename);

    const data = {
      generatedAt: date.toISOString(),
      count: opportunities.length,
      opportunities,
    };

    await fs.writeFile(filepath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`Opportunities data saved to: ${filepath}`);
  }

  private async sendNotification(opportunityCount: number): Promise<void> {
    console.log(`Notification: found ${opportunityCount} opportunities today.`);
  }

  async runScheduled(intervalHours: number = 24): Promise<void> {
    console.log(
      `Setting up scheduled discovery every ${intervalHours} hours...`,
    );

    await this.runDiscovery();

    const intervalMs = intervalHours * 60 * 60 * 1000;
    setInterval(async () => {
      console.log('Running scheduled discovery...');
      await this.runDiscovery();
    }, intervalMs);
  }
}
