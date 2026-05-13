import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { normalizeV18EvidenceJsonText } from './v18-go-stop-decision'

export type V18EvalVariant =
  | 'flash_bare'
  | 'pro_bare'
  | 'dsxu_cold'
  | 'benchmax'

export type V18EvalSuite = 'code' | 'terminal' | 'mixed'

export type V18EvalScore = {
  variant: V18EvalVariant
  suite: V18EvalSuite
  totalCases: number
  pass: number
  fail: number
  policyFail: number
  timedOut: number
  costUSD: number
  proRatio: number
  toolCalls: number
  tracePath?: string
  source: 'measured' | 'derived' | 'missing'
}

export type V18AblationStep = {
  id: string
  label: string
  enabledModules: string[]
  totalCases: number
  passRate: number
  costUSD: number
  deltaPassRate?: number
  deltaCostUSD?: number
  source: 'measured' | 'derived' | 'missing'
}

export type V18EvidenceEvalPack = {
  ok: boolean
  status: 'DONE_EVIDENCED' | 'PARTIAL_EVAL_PACK' | 'BLOCKED'
  generatedAt: string
  evidencePath: string
  markdownPath: string
  miniReportPath: string
  excelIds: string[]
  baselineScores: V18EvalScore[]
  ablationSteps: V18AblationStep[]
  goStop: {
    code10: 'GO' | 'STOP'
    terminal10: 'GO' | 'STOP'
    publicReport: 'GO' | 'STOP'
    nextStep: string
  }
  blockers: string[]
  guards: string[]
}

export type V18EvidenceEvalPackOptions = {
  evidenceDir?: string
  markdownPath?: string
  miniReportPath?: string
  nowIso?: string
  realTaskPackPath?: string
  code10ReportPath?: string
  terminal10ReportPath?: string
  flashBareCodeReportPath?: string
  proBareCodeReportPath?: string
  benchmaxCodeReportPath?: string
  baselineScores?: V18EvalScore[]
  ablationSteps?: V18AblationStep[]
}

type RealTaskPackEvidence = {
  aggregate?: {
    totalCases?: number
    pass?: number
    fail?: number
    policyFail?: number
    timedOut?: number
    totalToolCalls?: number
    totalCostUSD?: number
    modelsUsed?: string[]
  }
}

type BenchmarkLiveReportEvidence = {
  mode?: string
  entryModelMode?: string
  entryModel?: string | null
  semanticToolsEnabled?: boolean
  baselineProfile?: string | null
  benchMode?: string
  benchmaxCandidateCount?: number
  total?: number
  summary?: {
    pass?: number
    fail?: number
    policyFail?: number
    timedOut?: number
    totalToolCalls?: number
    totalCostUSD?: number
    modelsUsed?: string[]
  }
  cases?: Array<{
    metrics?: {
      totalCostUSD?: number
      modelsUsed?: string[]
      modelUsage?: Record<string, { costUSD?: number }>
    }
  }>
}

type BaselineDerivation = {
  score?: V18EvalScore
  blockers: string[]
}

const REQUIRED_VARIANTS: readonly V18EvalVariant[] = [
  'flash_bare',
  'pro_bare',
  'dsxu_cold',
  'benchmax',
]

function round(value: number, digits = 4): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)]
}

function variantLabel(variant: V18EvalVariant): string {
  switch (variant) {
    case 'flash_bare':
      return 'Flash bare'
    case 'pro_bare':
      return 'Pro bare'
    case 'dsxu_cold':
      return 'DSXU Cold'
    case 'benchmax':
      return 'BenchMax'
  }
}

function missingScore(variant: V18EvalVariant, suite: V18EvalSuite): V18EvalScore {
  return {
    variant,
    suite,
    totalCases: 0,
    pass: 0,
    fail: 0,
    policyFail: 0,
    timedOut: 0,
    costUSD: 0,
    proRatio: 0,
    toolCalls: 0,
    source: 'missing',
  }
}

function deriveDsxuColdScoreFromRealTaskPack(
  realTaskPack: RealTaskPackEvidence | undefined,
  tracePath: string | undefined,
): V18EvalScore | undefined {
  const aggregate = realTaskPack?.aggregate
  if (!aggregate) return undefined
  const modelsUsed = aggregate.modelsUsed ?? []
  const proRatio =
    modelsUsed.length === 0
      ? 0
      : modelsUsed.includes('deepseek-v4-pro') &&
          !modelsUsed.includes('deepseek-v4-flash')
        ? 1
        : modelsUsed.includes('deepseek-v4-pro')
          ? 0.25
          : 0
  return {
    variant: 'dsxu_cold',
    suite: 'mixed',
    totalCases: aggregate.totalCases ?? 0,
    pass: aggregate.pass ?? 0,
    fail: aggregate.fail ?? 0,
    policyFail: aggregate.policyFail ?? 0,
    timedOut: aggregate.timedOut ?? 0,
    costUSD: aggregate.totalCostUSD ?? 0,
    proRatio,
    toolCalls: aggregate.totalToolCalls ?? 0,
    tracePath,
    source: 'derived',
  }
}

function deriveDsxuColdScoreFromBenchmarkReport(
  report: BenchmarkLiveReportEvidence | undefined,
  suite: V18EvalSuite,
  tracePath: string | undefined,
): V18EvalScore | undefined {
  return deriveScoreFromBenchmarkReport(report, 'dsxu_cold', suite, tracePath)
}

function deriveScoreFromBenchmarkReport(
  report: BenchmarkLiveReportEvidence | undefined,
  variant: V18EvalVariant,
  suite: V18EvalSuite,
  tracePath: string | undefined,
): V18EvalScore | undefined {
  const summary = report?.summary
  if (!summary) return undefined
  const totalCost =
    summary.totalCostUSD ??
    report?.cases?.reduce(
      (sum, item) => sum + (item.metrics?.totalCostUSD ?? 0),
      0,
    ) ??
    0
  const proCost =
    report?.cases?.reduce((sum, item) => {
      const modelUsage = item.metrics?.modelUsage ?? {}
      return sum + (modelUsage['deepseek-v4-pro']?.costUSD ?? 0)
    }, 0) ?? 0
  const modelsUsed = summary.modelsUsed ?? []
  const fallbackProRatio =
    modelsUsed.length === 0
      ? 0
      : variant === 'pro_bare'
        ? 1
        : variant === 'flash_bare'
          ? 0
          : modelsUsed.includes('deepseek-v4-pro') &&
              !modelsUsed.includes('deepseek-v4-flash')
            ? 1
            : modelsUsed.includes('deepseek-v4-pro')
              ? 0.25
              : 0
  return {
    variant,
    suite,
    totalCases: report?.total ?? 0,
    pass: summary.pass ?? 0,
    fail: summary.fail ?? 0,
    policyFail: summary.policyFail ?? 0,
    timedOut: summary.timedOut ?? 0,
    costUSD: totalCost,
    proRatio: totalCost > 0 ? round(proCost / totalCost, 4) : fallbackProRatio,
    toolCalls: summary.totalToolCalls ?? 0,
    tracePath,
    source: 'measured',
  }
}

function deriveValidatedBaselineScoreFromBenchmarkReport(
  report: BenchmarkLiveReportEvidence | undefined,
  variant: 'flash_bare' | 'pro_bare' | 'benchmax',
  suite: V18EvalSuite,
  tracePath: string | undefined,
): BaselineDerivation {
  if (!report) return { blockers: [] }
  const blockers: string[] = []
  const label = variantLabel(variant)
  const modelsUsed = report.summary?.modelsUsed ?? []

  if (report.mode !== 'live') {
    blockers.push(`${label} report must be live, not ${report.mode ?? 'unknown'}`)
  }

  if (variant === 'flash_bare' || variant === 'pro_bare') {
    const expectedMode = variant === 'flash_bare' ? 'flash' : 'pro'
    const expectedModel =
      variant === 'flash_bare' ? 'deepseek-v4-flash' : 'deepseek-v4-pro'
    const deniedModel =
      variant === 'flash_bare' ? 'deepseek-v4-pro' : 'deepseek-v4-flash'
    if (report.baselineProfile !== 'model_forced_bare') {
      blockers.push(
        `${label} report must set DSXU_BENCH_BASELINE_PROFILE=model_forced_bare`,
      )
    }
    if (report.semanticToolsEnabled !== false) {
      blockers.push(`${label} report must have semantic tools disabled`)
    }
    if (report.entryModelMode !== expectedMode || report.entryModel !== expectedModel) {
      blockers.push(
        `${label} report must use --entry-model=${expectedMode} (${expectedModel})`,
      )
    }
    if (modelsUsed.includes(deniedModel)) {
      blockers.push(`${label} report used unexpected model ${deniedModel}`)
    }
  }

  if (variant === 'benchmax') {
    if (
      report.baselineProfile !== 'benchmax' ||
      report.benchMode !== 'benchmax'
    ) {
      blockers.push(
        'BenchMax report must set DSXU_BENCH_BASELINE_PROFILE=benchmax and DSXU_BENCH_MODE=benchmax',
      )
    }
    if ((report.benchmaxCandidateCount ?? 0) < 2) {
      blockers.push('BenchMax report must include at least two patch candidates')
    }
  }

  if (blockers.length > 0) return { blockers }
  return {
    score: deriveScoreFromBenchmarkReport(report, variant, suite, tracePath),
    blockers,
  }
}

function normalizeScores(
  scores: readonly V18EvalScore[],
): V18EvalScore[] {
  const byKey = new Map<string, V18EvalScore>()
  for (const score of scores) {
    byKey.set(`${score.variant}:${score.suite}`, score)
  }
  for (const variant of REQUIRED_VARIANTS) {
    const hasVariant = [...byKey.values()].some(score => score.variant === variant)
    if (!hasVariant) byKey.set(`${variant}:mixed`, missingScore(variant, 'mixed'))
  }
  return [...byKey.values()].sort((a, b) =>
    `${a.variant}:${a.suite}`.localeCompare(`${b.variant}:${b.suite}`),
  )
}

function aggregateVariantScore(
  variant: V18EvalVariant,
  scores: readonly V18EvalScore[],
): V18EvalScore | undefined {
  const variantScores = scores.filter(
    score => score.variant === variant && score.source !== 'missing',
  )
  if (variantScores.length === 0) return undefined
  const splitScores = variantScores.filter(
    score => score.suite === 'code' || score.suite === 'terminal',
  )
  const selected = splitScores.length > 0 ? splitScores : variantScores
  const totalCases = selected.reduce((sum, score) => sum + score.totalCases, 0)
  const costUSD = selected.reduce((sum, score) => sum + score.costUSD, 0)
  const weightedProCost = selected.reduce(
    (sum, score) => sum + score.costUSD * score.proRatio,
    0,
  )
  return {
    variant,
    suite: selected.length === 1 ? selected[0]!.suite : 'mixed',
    totalCases,
    pass: selected.reduce((sum, score) => sum + score.pass, 0),
    fail: selected.reduce((sum, score) => sum + score.fail, 0),
    policyFail: selected.reduce((sum, score) => sum + score.policyFail, 0),
    timedOut: selected.reduce((sum, score) => sum + score.timedOut, 0),
    costUSD,
    proRatio: costUSD > 0 ? round(weightedProCost / costUSD, 4) : 0,
    toolCalls: selected.reduce((sum, score) => sum + score.toolCalls, 0),
    source: selected.every(score => score.source === 'measured')
      ? 'measured'
      : 'derived',
  }
}

function buildDefaultAblation(scores: readonly V18EvalScore[]): V18AblationStep[] {
  const byVariant = new Map(
    REQUIRED_VARIANTS.flatMap(variant => {
      const score = aggregateVariantScore(variant, scores)
      return score ? ([[variant, score]] as const) : []
    }),
  )
  const definitions: Array<{
    id: string
    label: string
    variant?: V18EvalVariant
    enabledModules: string[]
  }> = [
    {
      id: 'A0',
      label: 'Flash bare',
      variant: 'flash_bare',
      enabledModules: ['model.flash'],
    },
    {
      id: 'A1',
      label: 'Pro bare',
      variant: 'pro_bare',
      enabledModules: ['model.pro'],
    },
    {
      id: 'A2',
      label: 'DSXU Cold routing',
      variant: 'dsxu_cold',
      enabledModules: ['query_loop', 'tools', 'cost_router'],
    },
    {
      id: 'A3',
      label: 'DSXU Cold + evidence gates',
      enabledModules: ['query_loop', 'tools', 'cost_router', 'verification', 'trace'],
    },
    {
      id: 'A4',
      label: 'DSXU Cold + memory/context',
      enabledModules: [
        'query_loop',
        'tools',
        'cost_router',
        'verification',
        'trace',
        'experience_store',
      ],
    },
    {
      id: 'A5',
      label: 'Terminal/TUI lifecycle',
      enabledModules: ['terminal_lifecycle', 'permission', 'background_tasks'],
    },
    {
      id: 'A6',
      label: 'BenchMax',
      variant: 'benchmax',
      enabledModules: ['benchmax', 'candidate_search', 'pro_review'],
    },
  ]

  let previous: V18AblationStep | undefined
  return definitions.map(definition => {
    const score = definition.variant ? byVariant.get(definition.variant) : undefined
    const passRate =
      score && score.totalCases > 0 ? score.pass / score.totalCases : 0
    const step: V18AblationStep = {
      id: definition.id,
      label: definition.label,
      enabledModules: definition.enabledModules,
      totalCases: score?.totalCases ?? 0,
      passRate: round(passRate),
      costUSD: round(score?.costUSD ?? 0, 6),
      deltaPassRate: previous ? round(passRate - previous.passRate) : undefined,
      deltaCostUSD: previous ? round((score?.costUSD ?? 0) - previous.costUSD, 6) : undefined,
      source: score?.source === 'missing' || !score ? 'missing' : score.source,
    }
    previous = step
    return step
  })
}

function validateEvalPack(input: {
  scores: readonly V18EvalScore[]
  ablationSteps: readonly V18AblationStep[]
}): { blockers: string[]; guards: string[] } {
  const blockers: string[] = []
  const guards: string[] = []
  const measuredVariants = unique(
    input.scores
      .filter(score => score.source !== 'missing' && score.totalCases > 0)
      .map(score => score.variant),
  )
  const missingVariants = REQUIRED_VARIANTS.filter(
    variant => !measuredVariants.includes(variant),
  )
  if (missingVariants.length > 0) {
    blockers.push(
      `missing baseline variants: ${missingVariants.map(variantLabel).join(', ')}`,
    )
  }

  const code10Ready = input.scores.some(
    score =>
      score.source !== 'missing' &&
      score.suite === 'code' &&
      score.variant === 'dsxu_cold' &&
      score.totalCases >= 10,
  )
  const terminal10Ready = input.scores.some(
    score =>
      score.source !== 'missing' &&
      score.suite === 'terminal' &&
      score.variant === 'dsxu_cold' &&
      score.totalCases >= 10,
  )
  if (!code10Ready) {
    blockers.push('Code-10 DSXU Cold baseline is missing')
  }
  if (!terminal10Ready) {
    blockers.push('Terminal-10 DSXU Cold baseline is missing')
  }

  const a0a4Steps = input.ablationSteps.filter(step =>
    ['A0', 'A1', 'A2', 'A3', 'A4'].includes(step.id),
  )
  if (
    a0a4Steps.length < 5 ||
    a0a4Steps.some(step => step.source === 'missing' || step.totalCases === 0)
  ) {
    blockers.push('A0-A4 ablation table is incomplete')
  }
  if (
    input.scores.some(
      score => score.source !== 'missing' && score.totalCases < 10,
    )
  ) {
    guards.push('existing measured evidence is below 10 cases; keep it local-only')
  }
  if (
    input.scores.some(
      score =>
        score.variant === 'dsxu_cold' &&
        score.source !== 'missing' &&
        score.suite === 'mixed',
    )
  ) {
    const hasSplitDsxuCold = input.scores.some(
      score =>
        score.variant === 'dsxu_cold' &&
        score.source !== 'missing' &&
        (score.suite === 'code' || score.suite === 'terminal'),
    )
    guards.push(
      hasSplitDsxuCold
        ? 'additional mixed-suite DSXU Cold evidence is local-only; Code/Terminal split rows are used for score claims'
        : 'current DSXU Cold evidence is mixed-suite; split Code and Terminal before score claims',
    )
  }
  return { blockers, guards }
}

function renderMarkdown(report: V18EvidenceEvalPack): string {
  return [
    '# DSXU V18 Evidence Eval Pack',
    '',
    `Generated: ${report.generatedAt}`,
    `Status: ${report.status}`,
    '',
    '## Go/Stop',
    '',
    `- Code-10: ${report.goStop.code10}`,
    `- Terminal-10: ${report.goStop.terminal10}`,
    `- Public report: ${report.goStop.publicReport}`,
    `- Next: ${report.goStop.nextStep}`,
    '',
    '## Baseline',
    '',
    '| Variant | Suite | Cases | Pass | Fail | PolicyFail | Timeout | CostUSD | ProRatio | Source |',
    '|---|---|---:|---:|---:|---:|---:|---:|---:|---|',
    ...report.baselineScores.map(
      score =>
        `| ${variantLabel(score.variant)} | ${score.suite} | ${score.totalCases} | ${score.pass} | ${score.fail} | ${score.policyFail} | ${score.timedOut} | ${round(score.costUSD, 6)} | ${round(score.proRatio, 4)} | ${score.source} |`,
    ),
    '',
    '## Ablation',
    '',
    '| ID | Label | Cases | PassRate | CostUSD | DeltaPassRate | DeltaCostUSD | Source |',
    '|---|---|---:|---:|---:|---:|---:|---|',
    ...report.ablationSteps.map(
      step =>
        `| ${step.id} | ${step.label} | ${step.totalCases} | ${step.passRate} | ${step.costUSD} | ${step.deltaPassRate ?? ''} | ${step.deltaCostUSD ?? ''} | ${step.source} |`,
    ),
    '',
    '## Blockers',
    '',
    ...(report.blockers.length > 0
      ? report.blockers.map(blocker => `- ${blocker}`)
      : ['- None']),
    '',
    '## Guards',
    '',
    ...(report.guards.length > 0
      ? report.guards.map(guard => `- ${guard}`)
      : ['- None']),
    '',
  ].join('\n')
}

function renderMiniReport(report: V18EvidenceEvalPack): string {
  return [
    '# DSXU V18 Mini Report',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    report.ok
      ? 'This report is backed by complete baseline and ablation evidence.'
      : 'This report is local-only and must not be used as a public benchmark claim.',
    '',
    '## Summary',
    '',
    `- Status: ${report.status}`,
    `- Baseline rows: ${report.baselineScores.length}`,
    `- Ablation rows: ${report.ablationSteps.length}`,
    `- Blockers: ${report.blockers.length}`,
    '',
    '## Required Before Public Use',
    '',
    ...(report.blockers.length > 0
      ? report.blockers.map(blocker => `- ${blocker}`)
      : ['- None']),
    '',
  ].join('\n')
}

export function buildV18EvidenceEvalPack(input: {
  generatedAt: string
  evidencePath: string
  markdownPath: string
  miniReportPath: string
  realTaskPack?: RealTaskPackEvidence
  realTaskPackPath?: string
  code10Report?: BenchmarkLiveReportEvidence
  code10ReportPath?: string
  terminal10Report?: BenchmarkLiveReportEvidence
  terminal10ReportPath?: string
  flashBareCodeReport?: BenchmarkLiveReportEvidence
  flashBareCodeReportPath?: string
  proBareCodeReport?: BenchmarkLiveReportEvidence
  proBareCodeReportPath?: string
  benchmaxCodeReport?: BenchmarkLiveReportEvidence
  benchmaxCodeReportPath?: string
  baselineScores?: V18EvalScore[]
  ablationSteps?: V18AblationStep[]
}): V18EvidenceEvalPack {
  const derivedDsxuCold = deriveDsxuColdScoreFromRealTaskPack(
    input.realTaskPack,
    input.realTaskPackPath,
  )
  const code10DsxuCold = deriveDsxuColdScoreFromBenchmarkReport(
    input.code10Report,
    'code',
    input.code10ReportPath,
  )
  const terminal10DsxuCold = deriveDsxuColdScoreFromBenchmarkReport(
    input.terminal10Report,
    'terminal',
    input.terminal10ReportPath,
  )
  const flashBareCode = deriveValidatedBaselineScoreFromBenchmarkReport(
    input.flashBareCodeReport,
    'flash_bare',
    'code',
    input.flashBareCodeReportPath,
  )
  const proBareCode = deriveValidatedBaselineScoreFromBenchmarkReport(
    input.proBareCodeReport,
    'pro_bare',
    'code',
    input.proBareCodeReportPath,
  )
  const benchmaxCode = deriveValidatedBaselineScoreFromBenchmarkReport(
    input.benchmaxCodeReport,
    'benchmax',
    'code',
    input.benchmaxCodeReportPath,
  )
  const baselineScores = normalizeScores([
    ...(input.baselineScores ?? []),
    ...(flashBareCode.score ? [flashBareCode.score] : []),
    ...(proBareCode.score ? [proBareCode.score] : []),
    ...(benchmaxCode.score ? [benchmaxCode.score] : []),
    ...(derivedDsxuCold ? [derivedDsxuCold] : []),
    ...(code10DsxuCold ? [code10DsxuCold] : []),
    ...(terminal10DsxuCold ? [terminal10DsxuCold] : []),
  ])
  const ablationSteps = input.ablationSteps ?? buildDefaultAblation(baselineScores)
  const baselineValidationBlockers = [
    ...flashBareCode.blockers,
    ...proBareCode.blockers,
    ...benchmaxCode.blockers,
  ]
  const { blockers: evalBlockers, guards } = validateEvalPack({
    scores: baselineScores,
    ablationSteps,
  })
  const blockers = [...baselineValidationBlockers, ...evalBlockers]
  const ok = blockers.length === 0 && guards.length === 0
  const code10 = blockers.some(blocker => blocker.includes('Code-10'))
    ? 'STOP'
    : 'GO'
  const terminal10 = blockers.some(blocker => blocker.includes('Terminal-10'))
    ? 'STOP'
    : 'GO'
  const publicReport = ok ? 'GO' : 'STOP'
  const status: V18EvidenceEvalPack['status'] = ok
    ? 'DONE_EVIDENCED'
    : baselineScores.some(score => score.source !== 'missing')
      ? 'PARTIAL_EVAL_PACK'
      : 'BLOCKED'

  return {
    ok,
    status,
    generatedAt: input.generatedAt,
    evidencePath: input.evidencePath,
    markdownPath: input.markdownPath,
    miniReportPath: input.miniReportPath,
    excelIds: ['E01', 'E02', 'E03', 'E04', 'E05', 'E06', 'E07', 'A16', 'B13'],
    baselineScores,
    ablationSteps,
    goStop: {
      code10,
      terminal10,
      publicReport,
      nextStep: ok
        ? 'Run the stage-close 22-case only after Code-10 and Terminal-10 stay green.'
        : 'Collect same-run Flash bare, Pro bare, DSXU Cold, BenchMax, Code-10, Terminal-10, and A0-A4 ablation evidence.',
    },
    blockers,
    guards,
  }
}

async function readJsonIfExists<T>(path: string): Promise<T | undefined> {
  try {
    return JSON.parse(normalizeV18EvidenceJsonText(await readFile(path, 'utf8'))) as T
  } catch {
    return undefined
  }
}

export async function runV18EvidenceEvalPackHarness(
  options: V18EvidenceEvalPackOptions = {},
): Promise<V18EvidenceEvalPack> {
  const root = process.cwd()
  const evidenceDir =
    options.evidenceDir ?? join(root, '.dsxu', 'trace', 'v18-eval')
  const evidencePath = join(evidenceDir, 'evidence-eval-pack-20260507.evidence.json')
  const markdownPath =
    options.markdownPath ??
    join(root, 'docs', 'DSXU_V18_EVIDENCE_EVAL_PACK_20260507.md')
  const miniReportPath =
    options.miniReportPath ??
    join(root, 'docs', 'DSXU_V18_MINI_REPORT_20260507.md')
  const realTaskPackPath =
    options.realTaskPackPath ??
    join(root, '.dsxu/trace/v18-stage-close/real-task-pack-core-live-20260506.evidence.json')
  const code10ReportPath =
    options.code10ReportPath ??
    join(root, '.dsxu/runs/v18-code-10-live-flashfirst-20260507-1033/live-report.json')
  const terminal10ReportPath =
    options.terminal10ReportPath ??
    join(root, '.dsxu/runs/v18-terminal-10-live-done-20260507-0953/live-report.json')
  const flashBareCodeReportPath =
    options.flashBareCodeReportPath ??
    join(root, '.dsxu/runs/v18-eval-flash-bare-code-20260507/live-report.json')
  const proBareCodeReportPath =
    options.proBareCodeReportPath ??
    join(root, '.dsxu/runs/v18-eval-pro-bare-code-20260507/live-report.json')
  const benchmaxCodeReportPath =
    options.benchmaxCodeReportPath ??
    join(root, '.dsxu/runs/v18-eval-benchmax-code-20260507/live-report.json')
  await mkdir(evidenceDir, { recursive: true })
  await mkdir(dirname(markdownPath), { recursive: true })
  await mkdir(dirname(miniReportPath), { recursive: true })

  const report = buildV18EvidenceEvalPack({
    generatedAt: options.nowIso ?? new Date().toISOString(),
    evidencePath,
    markdownPath,
    miniReportPath,
    realTaskPack: await readJsonIfExists<RealTaskPackEvidence>(realTaskPackPath),
    realTaskPackPath,
    code10Report:
      await readJsonIfExists<BenchmarkLiveReportEvidence>(code10ReportPath),
    code10ReportPath,
    terminal10Report:
      await readJsonIfExists<BenchmarkLiveReportEvidence>(terminal10ReportPath),
    terminal10ReportPath,
    flashBareCodeReport:
      await readJsonIfExists<BenchmarkLiveReportEvidence>(flashBareCodeReportPath),
    flashBareCodeReportPath,
    proBareCodeReport:
      await readJsonIfExists<BenchmarkLiveReportEvidence>(proBareCodeReportPath),
    proBareCodeReportPath,
    benchmaxCodeReport:
      await readJsonIfExists<BenchmarkLiveReportEvidence>(benchmaxCodeReportPath),
    benchmaxCodeReportPath,
    baselineScores: options.baselineScores,
    ablationSteps: options.ablationSteps,
  })

  await writeFile(evidencePath, JSON.stringify(report, null, 2), 'utf8')
  await writeFile(markdownPath, renderMarkdown(report), 'utf8')
  await writeFile(miniReportPath, renderMiniReport(report), 'utf8')
  return report
}
