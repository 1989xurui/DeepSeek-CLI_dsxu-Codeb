import { beforeEach, describe, expect, it } from 'bun:test';
import { ClassificationAnalyzer } from '../src/dsxu/engine/analyzers/classification-analyzer';
import { FilteringAnalyzer } from '../src/dsxu/engine/analyzers/filtering-analyzer';
import { ScoringAnalyzer } from '../src/dsxu/engine/analyzers/scoring-analyzer';
import { GithubDataSource } from '../src/dsxu/engine/data-sources/github-source';
import {
  Opportunity,
  OpportunityDiscoveryEngine,
} from '../src/dsxu/engine/opportunity-discovery';
import { DailyMarkdownReporter } from '../src/dsxu/engine/reporters/daily-markdown-reporter';

describe('Opportunity Discovery Engine', () => {
  let engine: OpportunityDiscoveryEngine;

  beforeEach(() => {
    engine = new OpportunityDiscoveryEngine();
  });

  describe('Basic functionality', () => {
    it('should register and use data sources', async () => {
      const mockDataSource = {
        name: 'test-source',
        type: 'test',
        collect: async () => [
          {
            id: 'test-1',
            title: 'Test Opportunity',
            description: 'Test description',
            category: 'test',
            source: 'test',
            revenuePotential: '1-2万/月',
            executionDifficulty: 'low' as const,
            timeline: '1周',
            priorityScore: 7.5,
            discoveredAt: new Date(),
          },
        ],
      };

      engine.registerDataSource(mockDataSource);
      const opportunities = await engine.discover();

      expect(opportunities).toHaveLength(1);
      expect(opportunities[0].title).toBe('Test Opportunity');
    });

    it('should categorize opportunities by priority', () => {
      const opportunities: Opportunity[] = [
        {
          id: '1',
          title: 'High Priority',
          description: 'Test',
          category: 'test',
          source: 'test',
          revenuePotential: '1-2万/月',
          executionDifficulty: 'low',
          timeline: '1周',
          priorityScore: 8.5,
          discoveredAt: new Date(),
        },
        {
          id: '2',
          title: 'Medium Priority',
          description: 'Test',
          category: 'test',
          source: 'test',
          revenuePotential: '1-2万/月',
          executionDifficulty: 'medium',
          timeline: '2周',
          priorityScore: 7.0,
          discoveredAt: new Date(),
        },
        {
          id: '3',
          title: 'Low Priority',
          description: 'Test',
          category: 'test',
          source: 'test',
          revenuePotential: '1-2万/月',
          executionDifficulty: 'high',
          timeline: '3周',
          priorityScore: 4.0,
          discoveredAt: new Date(),
        },
      ];

      const categorized = engine.categorizeByPriority(opportunities);

      expect(categorized.high).toHaveLength(1);
      expect(categorized.medium).toHaveLength(1);
      expect(categorized.low).toHaveLength(1);
    });
  });

  describe('Scoring Analyzer', () => {
    it('should enhance scores based on difficulty', async () => {
      const analyzer = new ScoringAnalyzer();
      const opportunities: Opportunity[] = [
        {
          id: '1',
          title: 'Low Difficulty',
          description: 'Test',
          category: 'test',
          source: 'test',
          revenuePotential: '1-2万/月',
          executionDifficulty: 'low',
          timeline: '1周',
          priorityScore: 7.0,
          discoveredAt: new Date(),
        },
        {
          id: '2',
          title: 'High Difficulty',
          description: 'Test',
          category: 'test',
          source: 'test',
          revenuePotential: '1-2万/月',
          executionDifficulty: 'high',
          timeline: '1周',
          priorityScore: 7.0,
          discoveredAt: new Date(),
        },
      ];

      const result = await analyzer.analyze(opportunities);
      expect(result[0].priorityScore).toBeGreaterThan(7.0);
      expect(result[1].priorityScore).toBeLessThan(7.0);
    });

    it('should enhance scores based on revenue', async () => {
      const analyzer = new ScoringAnalyzer();
      const opportunities: Opportunity[] = [
        {
          id: '1',
          title: 'High Revenue',
          description: 'Test',
          category: 'test',
          source: 'test',
          revenuePotential: '10-20万/月',
          executionDifficulty: 'medium',
          timeline: '1周',
          priorityScore: 7.0,
          discoveredAt: new Date(),
        },
      ];

      const result = await analyzer.analyze(opportunities);
      expect(result[0].priorityScore).toBeGreaterThan(7.0);
    });
  });

  describe('Classification Analyzer', () => {
    it('should add tags based on category', async () => {
      const analyzer = new ClassificationAnalyzer();
      const opportunities: Opportunity[] = [
        {
          id: '1',
          title: 'AI Tool',
          description: 'Test',
          category: 'ai-tools',
          source: 'test',
          revenuePotential: '1-2万/月',
          executionDifficulty: 'low',
          timeline: '1周',
          priorityScore: 7.0,
          discoveredAt: new Date(),
        },
      ];

      const result = await analyzer.analyze(opportunities);
      const tags = result[0].metadata?.tags || [];

      expect(tags).toContain('ai');
      expect(tags).toContain('technology');
      expect(tags).toContain('difficulty-low');
    });
  });

  describe('Filtering Analyzer', () => {
    it('should filter by minimum score', async () => {
      const analyzer = new FilteringAnalyzer({ minScore: 6 });
      const opportunities: Opportunity[] = [
        {
          id: '1',
          title: 'High Score',
          description: 'Test',
          category: 'test',
          source: 'test',
          revenuePotential: '1-2万/月',
          executionDifficulty: 'low',
          timeline: '1周',
          priorityScore: 8.0,
          discoveredAt: new Date(),
        },
        {
          id: '2',
          title: 'Low Score',
          description: 'Test',
          category: 'test',
          source: 'test',
          revenuePotential: '1-2万/月',
          executionDifficulty: 'low',
          timeline: '1周',
          priorityScore: 4.0,
          discoveredAt: new Date(),
        },
      ];

      const result = await analyzer.analyze(opportunities);
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('High Score');
    });

    it('should filter by category', async () => {
      const analyzer = new FilteringAnalyzer({ categories: ['ai-tools'] });
      const opportunities: Opportunity[] = [
        {
          id: '1',
          title: 'AI Tool',
          description: 'Test',
          category: 'ai-tools',
          source: 'test',
          revenuePotential: '1-2万/月',
          executionDifficulty: 'low',
          timeline: '1周',
          priorityScore: 8.0,
          discoveredAt: new Date(),
        },
        {
          id: '2',
          title: 'Other Tool',
          description: 'Test',
          category: 'other',
          source: 'test',
          revenuePotential: '1-2万/月',
          executionDifficulty: 'low',
          timeline: '1周',
          priorityScore: 8.0,
          discoveredAt: new Date(),
        },
      ];

      const result = await analyzer.analyze(opportunities);
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('AI Tool');
    });
  });

  describe('Daily Markdown Reporter', () => {
    it('should generate markdown report', async () => {
      const reporter = new DailyMarkdownReporter();
      const opportunities: Opportunity[] = [
        {
          id: '1',
          title: 'Test Opportunity',
          description: 'Test description',
          category: 'test',
          source: 'test',
          revenuePotential: '1-2万/月',
          executionDifficulty: 'low',
          timeline: '1周',
          priorityScore: 8.5,
          discoveredAt: new Date(),
        },
      ];

      const report = await reporter.generateReport(opportunities);

      expect(report).toContain('# 机会发现日报');
      expect(report).toContain('Test Opportunity');
      expect(report).toContain('8.5/10');
      expect(report).toContain('今日扫描摘要');
      expect(report).toContain('高优先级机会');
    });

    it('should handle empty opportunities', async () => {
      const reporter = new DailyMarkdownReporter();
      const report = await reporter.generateReport([]);

      expect(report).toContain('# 机会发现日报');
      expect(report).toContain('发现机会：0个');
    });
  });

  describe('Data sources', () => {
    it('github source should return readable mock data', async () => {
      const source = new GithubDataSource();
      const opportunities = await source.collect();

      expect(opportunities.length).toBeGreaterThan(0);
      expect(opportunities[0].title).toBe('AI代码审查工具');
      expect(opportunities[0].revenuePotential).toBe('3-8万/月');
    });
  });
});
