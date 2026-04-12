/**
 * R5-23 贪心单链聚类
 */

import type { Candidate, Cluster, VoteConfig } from './contract';
import { computeSimilarity } from './similarity';

/**
 * 对候选列表做聚类
 *
 * 贪心单链：遍历候选，找第一个已有簇使得与簇内所有成员相似度 ≥ threshold。
 * 找到加入，否则新建簇。结果按簇大小降序。
 */
export function clusterCandidates(
  candidates: Candidate[],
  threshold: number,
  method: VoteConfig['similarityMethod'] = 'levenshtein'
): Cluster[] {
  if (candidates.length === 0) return [];

  const clusters: Array<{ members: number[] }> = [];

  for (const candidate of candidates) {
    let placed = false;

    for (const cluster of clusters) {
      // 检查与簇内所有成员的相似度是否 ≥ threshold
      const allAbove = cluster.members.every(memberId => {
        const memberContent = candidates.find(c => c.id === memberId)!.content;
        const sim = computeSimilarity(candidate.content, memberContent, method);
        return sim >= threshold;
      });

      if (allAbove) {
        cluster.members.push(candidate.id);
        placed = true;
        break;
      }
    }

    if (!placed) {
      clusters.push({ members: [candidate.id] });
    }
  }

  // 按簇大小降序排
  clusters.sort((a, b) => b.members.length - a.members.length);

  // 构建 Cluster 对象，计算 representative 和 avgSimilarity
  return clusters.map((c, idx) => {
    const representative = pickRepresentative(c.members, candidates, method);
    const avgSim = computeAvgSimilarity(c.members, candidates, method);
    return {
      id: idx,
      members: c.members,
      representative,
      avgSimilarity: avgSim,
    };
  });
}

/**
 * 选簇内与其他成员平均相似度最高的候选作为 representative
 */
function pickRepresentative(
  members: number[],
  candidates: Candidate[],
  method: VoteConfig['similarityMethod']
): number {
  if (members.length === 1) return members[0];

  let bestId = members[0];
  let bestAvg = -1;

  for (const id of members) {
    const content = candidates.find(c => c.id === id)!.content;
    let sum = 0;
    for (const otherId of members) {
      if (otherId === id) continue;
      const otherContent = candidates.find(c => c.id === otherId)!.content;
      sum += computeSimilarity(content, otherContent, method);
    }
    const avg = sum / (members.length - 1);
    if (avg > bestAvg) {
      bestAvg = avg;
      bestId = id;
    }
  }

  return bestId;
}

/**
 * 计算簇内平均相似度
 */
function computeAvgSimilarity(
  members: number[],
  candidates: Candidate[],
  method: VoteConfig['similarityMethod']
): number {
  if (members.length <= 1) return 1.0;

  let sum = 0;
  let count = 0;

  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const a = candidates.find(c => c.id === members[i])!.content;
      const b = candidates.find(c => c.id === members[j])!.content;
      sum += computeSimilarity(a, b, method);
      count++;
    }
  }

  return count > 0 ? sum / count : 1.0;
}
