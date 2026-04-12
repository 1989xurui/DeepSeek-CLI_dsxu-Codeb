/**
 * R5-23 Self-Consistency Voting — 统一导出
 */

export * from './contract';
export { computeSimilarity } from './similarity';
export { clusterCandidates } from './clusterer';
export { vote } from './voter';

/**
 * 根据任务特征推荐 N 值
 *
 * - 简单任务（description < 50 字符，单文件）→ 3
 * - 复杂任务（含 refactor/redesign，多文件≥3）→ 8
 * - 其他 → 6
 */
export function recommendN(task: { description: string; targetFiles: string[] }): number {
  const desc = task.description.toLowerCase();

  // 复杂任务
  if (desc.includes('refactor') || desc.includes('redesign') || task.targetFiles.length >= 3) {
    return 8;
  }

  // 简单任务
  if (desc.length < 50 && task.targetFiles.length <= 1) {
    return 3;
  }

  // 默认
  return 6;
}
