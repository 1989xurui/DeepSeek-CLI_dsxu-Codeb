export type V18CodingScenario =
  | 'bugfix'
  | 'feature'
  | 'review'
  | 'repo_understanding'
  | 'recovery'

export type V18ReleaseGateRun = {
  scenario: V18CodingScenario
  iteration: number
  evidenceMode: 'synthetic_dry_run'
  passed: boolean
  durationMs: number
  estimatedCostUsd: number
  toolCalls: string[]
  failureReason: string | null
  failureTaxonomy: string | null
}

const SCENARIOS: V18CodingScenario[] = [
  'bugfix',
  'feature',
  'review',
  'repo_understanding',
  'recovery',
]

const TOOL_PLAN: Record<V18CodingScenario, string[]> = {
  bugfix: ['Read', 'Grep', 'Edit', 'Bash(test)', 'Review'],
  feature: ['Glob', 'Read', 'Edit', 'Bash(test)', 'Diff'],
  review: ['Read', 'Grep', 'Semgrep', 'Review'],
  repo_understanding: ['Repomix', 'ast-grep', 'Read', 'Evidence'],
  recovery: ['Bash(test)', 'FailureTaxonomy', 'Edit', 'Bash(retry)'],
}

export function runV18FiveTaskReleaseGate(iterations = 3): {
  runs: V18ReleaseGateRun[]
  summary: {
    scenarioCount: number
    totalRuns: number
    passRate: number
    totalEstimatedCostUsd: number
    verdict: 'dry_run_only_not_release_evidence'
    releaseEvidence: false
  }
} {
  const runs: V18ReleaseGateRun[] = []
  for (const scenario of SCENARIOS) {
    for (let i = 1; i <= iterations; i++) {
      const base = 900 + SCENARIOS.indexOf(scenario) * 130 + i * 17
      runs.push({
        scenario,
        iteration: i,
        evidenceMode: 'synthetic_dry_run',
        passed: true,
        durationMs: base,
        estimatedCostUsd: Number((0.002 + base / 10_000_000).toFixed(6)),
        toolCalls: TOOL_PLAN[scenario],
        failureReason: null,
        failureTaxonomy: null,
      })
    }
  }

  const passCount = runs.filter(run => run.passed).length
  const totalEstimatedCostUsd = Number(
    runs.reduce((sum, run) => sum + run.estimatedCostUsd, 0).toFixed(6),
  )
  return {
    runs,
    summary: {
      scenarioCount: SCENARIOS.length,
      totalRuns: runs.length,
      passRate: passCount / runs.length,
      totalEstimatedCostUsd,
      verdict: 'dry_run_only_not_release_evidence',
      releaseEvidence: false,
    },
  }
}
