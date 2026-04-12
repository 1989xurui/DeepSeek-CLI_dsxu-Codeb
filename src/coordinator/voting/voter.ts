/**
 * R5-23 Vote 主函数
 */

import type { Candidate, VoteConfig, VoteResult, TaskInput } from './contract';
import { clusterCandidates } from './clusterer';

const DEFAULT_CONFIG: VoteConfig = {
  n: 6,
  similarityThreshold: 0.6,
  similarityMethod: 'levenshtein',
};

/**
 * 对同一输入做 N 路采样 + 聚类 + 投票
 *
 * mockCandidates 存在时跳过真实采样。
 * N=1 → 直接返回唯一候选，degraded=true。
 * 全不同 → 选第一个，degraded=true。
 */
export async function vote(
  input: TaskInput,
  config?: Partial<VoteConfig>
): Promise<VoteResult> {
  const startTime = Date.now();
  const fullConfig: VoteConfig = { ...DEFAULT_CONFIG, ...config };

  // 获取候选（mock 或真实采样）
  let candidates: Candidate[];
  if (fullConfig.mockCandidates) {
    candidates = fullConfig.mockCandidates;
  } else {
    // 真实采样（预留，当前返回空）
    candidates = await sampleCandidates(input, fullConfig);
  }

  const totalCandidates = candidates.length;

  // 汇总 token
  const totalTokenUsage = {
    input: candidates.reduce((s, c) => s + c.tokenUsage.input, 0),
    output: candidates.reduce((s, c) => s + c.tokenUsage.output, 0),
  };

  // N=1 降级
  if (candidates.length <= 1) {
    const winner = candidates[0] || {
      id: 0, content: '', samplingParams: input.baseSamplingParams,
      durationMs: 0, tokenUsage: { input: 0, output: 0 },
    };
    return {
      winner,
      clusters: [{ id: 0, members: [winner.id], representative: winner.id, avgSimilarity: 1.0 }],
      consensusRate: 1.0,
      totalCandidates,
      totalDurationMs: Date.now() - startTime,
      totalTokenUsage,
      degraded: true,
    };
  }

  // 聚类
  const clusters = clusterCandidates(candidates, fullConfig.similarityThreshold, fullConfig.similarityMethod);

  // 最大簇
  const largestCluster = clusters[0];
  const consensusRate = largestCluster.members.length / totalCandidates;

  // 判断是否降级（每簇都只有 1 个成员 = 全不同）
  const allSingleton = clusters.every(c => c.members.length === 1);
  const degraded = allSingleton;

  // 选 winner
  let winner: Candidate;
  if (degraded) {
    // 全不同 → 选第一个
    winner = candidates[0];
  } else {
    // 选最大簇的 representative
    winner = candidates.find(c => c.id === largestCluster.representative) || candidates[0];
  }

  return {
    winner,
    clusters,
    consensusRate,
    totalCandidates,
    totalDurationMs: Date.now() - startTime,
    totalTokenUsage,
    degraded,
  };
}

/**
 * 真实 N 路采样（预留，G4 用 mock）
 */
async function sampleCandidates(input: TaskInput, config: VoteConfig): Promise<Candidate[]> {
  // TODO: 集成真实 LLM 调用
  return [];
}
