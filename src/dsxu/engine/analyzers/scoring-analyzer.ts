import { Analyzer, Opportunity } from '../opportunity-discovery';

export class ScoringAnalyzer implements Analyzer {
  name = 'scoring-analyzer';

  async analyze(opportunities: Opportunity[]): Promise<Opportunity[]> {
    return opportunities.map(opp => {
      // Enhance scoring based on various factors
      let enhancedScore = opp.priorityScore;

      // Adjust based on execution difficulty
      if (opp.executionDifficulty === 'low') {
        enhancedScore += 0.5;
      } else if (opp.executionDifficulty === 'high') {
        enhancedScore -= 0.3;
      }

      // Adjust based on revenue potential (parse the revenue string)
      const revenueMatch = opp.revenuePotential.match(/(\d+)-(\d+)/);
      if (revenueMatch) {
        const minRevenue = parseInt(revenueMatch[1]);
        const maxRevenue = parseInt(revenueMatch[2]);
        const avgRevenue = (minRevenue + maxRevenue) / 2;

        if (avgRevenue >= 10) {
          enhancedScore += 0.8;
        } else if (avgRevenue >= 5) {
          enhancedScore += 0.5;
        } else if (avgRevenue >= 2) {
          enhancedScore += 0.2;
        }
      }

      // Cap score at 10
      enhancedScore = Math.min(10, enhancedScore);

      return {
        ...opp,
        priorityScore: parseFloat(enhancedScore.toFixed(1))
      };
    });
  }
}