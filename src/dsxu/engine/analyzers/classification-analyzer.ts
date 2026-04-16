import { Analyzer, Opportunity } from '../opportunity-discovery';

export class ClassificationAnalyzer implements Analyzer {
  name = 'classification-analyzer';

  async analyze(opportunities: Opportunity[]): Promise<Opportunity[]> {
    return opportunities.map(opp => {
      // Add classification tags based on category and other factors
      const tags: string[] = [];

      // Category-based tags
      if (opp.category.includes('ai') || opp.category.includes('AI')) {
        tags.push('ai', 'technology');
      }
      if (opp.category.includes('blockchain') || opp.category.includes('defi')) {
        tags.push('blockchain', 'crypto');
      }
      if (opp.category.includes('developer') || opp.category.includes('devops')) {
        tags.push('developer-tools', 'software');
      }
      if (opp.category.includes('content')) {
        tags.push('content', 'marketing');
      }

      // Difficulty-based tags
      tags.push(`difficulty-${opp.executionDifficulty}`);

      // Revenue potential tags
      const revenueMatch = opp.revenuePotential.match(/(\d+)-(\d+)/);
      if (revenueMatch) {
        const minRevenue = parseInt(revenueMatch[1]);
        if (minRevenue >= 5) {
          tags.push('high-revenue');
        } else if (minRevenue >= 2) {
          tags.push('medium-revenue');
        } else {
          tags.push('low-revenue');
        }
      }

      // Timeline tags
      const timelineMatch = opp.timeline.match(/(\d+)/);
      if (timelineMatch) {
        const weeks = parseInt(timelineMatch[1]);
        if (weeks <= 2) {
          tags.push('quick-win');
        } else if (weeks <= 4) {
          tags.push('medium-term');
        } else {
          tags.push('long-term');
        }
      }

      return {
        ...opp,
        metadata: {
          ...opp.metadata,
          tags: [...(opp.metadata?.tags || []), ...tags]
        }
      };
    });
  }
}