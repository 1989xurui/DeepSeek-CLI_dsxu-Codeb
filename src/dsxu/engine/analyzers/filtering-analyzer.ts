import { Analyzer, Opportunity } from '../opportunity-discovery';

export interface FilterOptions {
  minScore?: number;
  maxScore?: number;
  categories?: string[];
  difficulties?: Array<'low' | 'medium' | 'high'>;
  excludeSources?: string[];
}

export class FilteringAnalyzer implements Analyzer {
  name = 'filtering-analyzer';
  private options: FilterOptions;

  constructor(options: FilterOptions = {}) {
    this.options = {
      minScore: 5,
      maxScore: 10,
      ...options
    };
  }

  async analyze(opportunities: Opportunity[]): Promise<Opportunity[]> {
    return opportunities.filter(opp => {
      // Filter by score
      if (this.options.minScore !== undefined && opp.priorityScore < this.options.minScore) {
        return false;
      }
      if (this.options.maxScore !== undefined && opp.priorityScore > this.options.maxScore) {
        return false;
      }

      // Filter by category
      if (this.options.categories && this.options.categories.length > 0) {
        if (!this.options.categories.includes(opp.category)) {
          return false;
        }
      }

      // Filter by difficulty
      if (this.options.difficulties && this.options.difficulties.length > 0) {
        if (!this.options.difficulties.includes(opp.executionDifficulty)) {
          return false;
        }
      }

      // Filter by source
      if (this.options.excludeSources && this.options.excludeSources.length > 0) {
        if (this.options.excludeSources.includes(opp.source)) {
          return false;
        }
      }

      return true;
    });
  }
}