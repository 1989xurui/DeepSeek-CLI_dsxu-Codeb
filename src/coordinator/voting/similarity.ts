/**
 * R5-23 相似度计算 — 3 种算法
 */

import type { VoteConfig } from './contract';

/**
 * 计算两个字符串的相似度 (0-1)
 */
export function computeSimilarity(
  a: string,
  b: string,
  method: VoteConfig['similarityMethod'] = 'levenshtein'
): number {
  switch (method) {
    case 'exact':
      return a === b ? 1.0 : 0;
    case 'levenshtein':
      return levenshteinSimilarity(a, b);
    case 'jaccard':
      return jaccardSimilarity(a, b);
    default:
      return levenshteinSimilarity(a, b);
  }
}

/**
 * Levenshtein: 1 - editDistance / max(len_a, len_b)
 * 两空串 → 1.0
 */
function levenshteinSimilarity(a: string, b: string): number {
  if (a === b) return 1.0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshteinDistance(a, b);
  return 1 - dist / maxLen;
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  // 优化：使用单行 DP
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);

  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1];
      } else {
        curr[j] = 1 + Math.min(prev[j - 1], prev[j], curr[j - 1]);
      }
    }
    [prev, curr] = [curr, prev];
  }

  return prev[n];
}

/**
 * Jaccard: 按行分割，|交集| / |并集|
 * 两空串 → 1.0
 */
function jaccardSimilarity(a: string, b: string): number {
  if (a === b) return 1.0;
  const setA = new Set(a.split('\n'));
  const setB = new Set(b.split('\n'));

  // 两个都是空集（只有一个空行）
  if (setA.size === 0 && setB.size === 0) return 1.0;

  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  if (union === 0) return 1.0;

  return intersection / union;
}
