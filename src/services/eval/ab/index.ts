/**
 * R5-35 Live A/B harness against a configurable baseline runner.
 */

type RunnerResult = {
  score: number
  patch: string
  durationMs: number
  tokens: number
  cost: number
}

export interface AbTaskResult {
  taskId: string
  dsxu: RunnerResult
  baseline: RunnerResult
  winner: 'dsxu' | 'baseline' | 'tie'
}

export interface AbReport {
  milestone: string
  totalTasks: number
  dsxuWins: number
  baselineWins: number
  ties: number
  weightedGap: number
  perCategory: Record<string, number>
  generatedAt: string
}

export interface AbConfig {
  concurrency?: number
  mockDsxuRunner?: (taskId: string) => Promise<RunnerResult>
  mockBaselineRunner?: (taskId: string) => Promise<RunnerResult>
}

/**
 * Run A/B comparison tasks.
 */
export async function runAb(
  milestone: string,
  taskIds: string[],
  config?: AbConfig,
): Promise<AbReport> {
  const results: AbTaskResult[] = []

  for (const taskId of taskIds) {
    const [dsxu, baseline] = await Promise.all([
      runDsxu(taskId, config),
      runBaseline(taskId, config),
    ])

    const winner =
      dsxu.score > baseline.score
        ? 'dsxu'
        : baseline.score > dsxu.score
          ? 'baseline'
          : 'tie'

    results.push({ taskId, dsxu, baseline, winner })
  }

  const dsxuWins = results.filter(r => r.winner === 'dsxu').length
  const baselineWins = results.filter(r => r.winner === 'baseline').length
  const ties = results.filter(r => r.winner === 'tie').length

  const dsxuAvg =
    results.reduce((sum, result) => sum + result.dsxu.score, 0) /
    (results.length || 1)
  const baselineAvg =
    results.reduce((sum, result) => sum + result.baseline.score, 0) /
    (results.length || 1)

  return {
    milestone,
    totalTasks: results.length,
    dsxuWins,
    baselineWins,
    ties,
    weightedGap: baselineAvg - dsxuAvg,
    perCategory: {},
    generatedAt: new Date().toISOString(),
  }
}

async function runDsxu(taskId: string, config?: AbConfig): Promise<RunnerResult> {
  if (config?.mockDsxuRunner) return config.mockDsxuRunner(taskId)
  return { score: 0, patch: '', durationMs: 0, tokens: 0, cost: 0 }
}

async function runBaseline(
  taskId: string,
  config?: AbConfig,
): Promise<RunnerResult> {
  if (config?.mockBaselineRunner) return config.mockBaselineRunner(taskId)
  return { score: 0, patch: '', durationMs: 0, tokens: 0, cost: 0 }
}
