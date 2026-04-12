/**
 * R5-35 Live A/B harness (vs Claude Opus)
 */

export interface AbTaskResult {
  taskId: string;
  dsxu: { score: number; patch: string; durationMs: number; tokens: number; cost: number };
  opus: { score: number; patch: string; durationMs: number; tokens: number; cost: number };
  winner: 'dsxu' | 'opus' | 'tie';
}

export interface AbReport {
  milestone: string;
  totalTasks: number;
  dsxuWins: number;
  opusWins: number;
  ties: number;
  weightedGap: number;
  perCategory: Record<string, number>;
  generatedAt: string;
}

export interface AbConfig {
  concurrency?: number;  // 默认 5
  mockDsxuRunner?: (taskId: string) => Promise<{ score: number; patch: string; durationMs: number; tokens: number; cost: number }>;
  mockOpusRunner?: (taskId: string) => Promise<{ score: number; patch: string; durationMs: number; tokens: number; cost: number }>;
}

/**
 * 运行 A/B 对照测试
 */
export async function runAb(
  milestone: string,
  taskIds: string[],
  config?: AbConfig
): Promise<AbReport> {
  const results: AbTaskResult[] = [];

  for (const taskId of taskIds) {
    const [dsxu, opus] = await Promise.all([
      runDsxu(taskId, config),
      runOpus(taskId, config),
    ]);

    const winner = dsxu.score > opus.score ? 'dsxu'
      : opus.score > dsxu.score ? 'opus'
      : 'tie';

    results.push({ taskId, dsxu, opus, winner });
  }

  const dsxuWins = results.filter(r => r.winner === 'dsxu').length;
  const opusWins = results.filter(r => r.winner === 'opus').length;
  const ties = results.filter(r => r.winner === 'tie').length;

  const dsxuAvg = results.reduce((s, r) => s + r.dsxu.score, 0) / (results.length || 1);
  const opusAvg = results.reduce((s, r) => s + r.opus.score, 0) / (results.length || 1);

  return {
    milestone,
    totalTasks: results.length,
    dsxuWins,
    opusWins,
    ties,
    weightedGap: opusAvg - dsxuAvg,
    perCategory: {},
    generatedAt: new Date().toISOString(),
  };
}

async function runDsxu(taskId: string, config?: AbConfig) {
  if (config?.mockDsxuRunner) return config.mockDsxuRunner(taskId);
  return { score: 0, patch: '', durationMs: 0, tokens: 0, cost: 0 };
}

async function runOpus(taskId: string, config?: AbConfig) {
  if (config?.mockOpusRunner) return config.mockOpusRunner(taskId);
  return { score: 0, patch: '', durationMs: 0, tokens: 0, cost: 0 };
}
