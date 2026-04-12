/**
 * R5-23 Self-Consistency Voting — Interface Contract
 *
 * N 路并行采样 + 语义聚类 + 投票，取共识最高的候选。
 */

export interface Candidate {
  id: number;
  content: string;
  samplingParams: SamplingParams;
  durationMs: number;
  tokenUsage: { input: number; output: number };
}

export interface SamplingParams {
  temperature: number;
  topP: number;
  seed?: number;
}

export interface Cluster {
  id: number;
  members: number[];
  representative: number;
  avgSimilarity: number;
}

export interface VoteResult {
  winner: Candidate;
  clusters: Cluster[];
  consensusRate: number;
  totalCandidates: number;
  totalDurationMs: number;
  totalTokenUsage: { input: number; output: number };
  degraded: boolean;
}

export interface VoteConfig {
  n: number;
  similarityThreshold: number;
  similarityMethod: 'levenshtein' | 'jaccard' | 'exact';
  mockCandidates?: Candidate[];
}

export interface TaskInput {
  prompt: string;
  baseSamplingParams: SamplingParams;
}
