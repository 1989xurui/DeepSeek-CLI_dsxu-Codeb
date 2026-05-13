import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { normalizeV18EvidenceJsonText } from './v18-go-stop-decision'

export type V18RealTaskCaseEvidence = {
  id: string
  nativeVerification?: string
  toolCalls: number
  editCalls: number
  failedEditCalls: number
  costUSD: number
}

export type V18RealTaskPackEvidence = {
  status?: string
  cases?: string[]
  aggregate?: {
    totalCases: number
    pass: number
    fail: number
    policyFail: number
    timedOut: number
    totalToolCalls: number
    totalEditCalls: number
    failedEditCalls: number
    postMarkerToolCalls: number
    totalCostUSD: number
    modelsUsed: string[]
  }
  caseEvidence?: V18RealTaskCaseEvidence[]
}

export type V18MixedRouteEvidence = {
  status?: string
  flashSmoke?: {
    actualModelUsage?: string
    costUSD?: number
  }
  proPlanningSmoke?: {
    actualModelUsage?: string
    costUSD?: number
  }
}

export type V18ControlledFailureTaxonomyEvidence = {
  ok?: boolean
  taxonomy?: {
    ok?: boolean
    sampleCount?: number
    categories?: string[]
    actions?: string[]
  }
}

export type V18RealTaskRoutePlanEvidence = {
  ok?: boolean
  plannedMixedRoute?: boolean
  actualMixedRoute?: boolean
  plannedModels?: string[]
  actualModels?: string[]
  costOptimizationOpportunityCount?: number
}

export type V18BenchmarkReadiness = {
  ok: boolean
  internalCode10: 'GO_WITH_GUARDS' | 'STOP'
  internalCode30: 'GO_AFTER_MORE_TASKS' | 'STOP'
  publicBenchmark: 'STOP_PUBLIC_BENCH'
  totalCases: number
  passRate: number
  totalToolCalls: number
  averageToolCalls: number
  editCallRatio: number
  failedEditRate: number
  postMarkerToolCalls: number
  totalCostUSD: number
  modelsUsed: string[]
  realTaskMixedRoute: boolean
  realTaskPlannedMixedRoute: boolean
  plannedRouteModels: string[]
  routePlanOpportunityCount: number
  mixedRouteSmoke: boolean
  failureTaxonomy: {
    failed: number
    policyFail: number
    timedOut: number
    missingFailureDiversity: boolean
    controlledSampleCount: number
    controlledCategories: string[]
  }
  blockers: string[]
  guards: string[]
}

export type V18BenchmarkReadinessReport = {
  ok: boolean
  generatedAt: string
  evidencePath: string
  markdownPath: string
  readiness: V18BenchmarkReadiness
  sourceEvidence: {
    realTaskPack: string
    mixedRoute: string
    realTaskRoutePlan?: string
  }
}

export type V18BenchmarkReadinessHarnessOptions = {
  evidenceDir?: string
  markdownPath?: string
  nowIso?: string
}

function round(value: number, digits = 4): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

export function buildV18BenchmarkReadiness(input: {
  realTaskPack: V18RealTaskPackEvidence
  mixedRoute: V18MixedRouteEvidence
  controlledFailureTaxonomy?: V18ControlledFailureTaxonomyEvidence
  realTaskRoutePlan?: V18RealTaskRoutePlanEvidence
}): V18BenchmarkReadiness {
  const aggregate = input.realTaskPack.aggregate
  const totalCases = aggregate?.totalCases ?? input.realTaskPack.caseEvidence?.length ?? 0
  const pass = aggregate?.pass ?? 0
  const fail = aggregate?.fail ?? 0
  const policyFail = aggregate?.policyFail ?? 0
  const timedOut = aggregate?.timedOut ?? 0
  const totalToolCalls = aggregate?.totalToolCalls ?? 0
  const totalEditCalls = aggregate?.totalEditCalls ?? 0
  const failedEditCalls = aggregate?.failedEditCalls ?? 0
  const postMarkerToolCalls = aggregate?.postMarkerToolCalls ?? 0
  const totalCostUSD = aggregate?.totalCostUSD ?? 0
  const modelsUsed = aggregate?.modelsUsed ?? []
  const passRate = totalCases > 0 ? pass / totalCases : 0
  const averageToolCalls = totalCases > 0 ? totalToolCalls / totalCases : 0
  const editCallRatio = totalToolCalls > 0 ? totalEditCalls / totalToolCalls : 0
  const failedEditRate = totalEditCalls > 0 ? failedEditCalls / totalEditCalls : 0
  const mixedRouteSmoke =
    input.mixedRoute.flashSmoke?.actualModelUsage === 'deepseek-v4-flash' &&
    input.mixedRoute.proPlanningSmoke?.actualModelUsage === 'deepseek-v4-pro'
  const realTaskMixedRoute =
    modelsUsed.includes('deepseek-v4-flash') && modelsUsed.includes('deepseek-v4-pro')
  const realTaskPlannedMixedRoute =
    input.realTaskRoutePlan?.ok === true &&
    input.realTaskRoutePlan.plannedMixedRoute === true
  const plannedRouteModels = input.realTaskRoutePlan?.plannedModels ?? []
  const routePlanOpportunityCount =
    input.realTaskRoutePlan?.costOptimizationOpportunityCount ?? 0
  const controlledTaxonomy = input.controlledFailureTaxonomy?.taxonomy
  const controlledCategories = controlledTaxonomy?.categories ?? []
  const controlledSampleCount = controlledTaxonomy?.sampleCount ?? 0
  const controlledTaxonomyOk =
    input.controlledFailureTaxonomy?.ok === true &&
    controlledTaxonomy?.ok !== false &&
    controlledSampleCount >= 4 &&
    controlledCategories.length >= 4
  const blockers: string[] = []
  const guards: string[] = []

  if (totalCases < 4 || passRate < 1 || policyFail > 0 || timedOut > 0) {
    blockers.push('real-task-pack-core is not fully green')
  }
  if (totalCases < 10) {
    guards.push('Internal Code-10 needs at least ten cases before reporting a stable score')
  }
  if (totalCases < 30) {
    guards.push('Internal Code-30 is blocked until at least thirty replayable cases exist')
  }
  if (!mixedRouteSmoke) {
    blockers.push('mixed Pro/Flash route smoke is missing')
  }
  if (!realTaskMixedRoute && realTaskPlannedMixedRoute) {
    guards.push('actual real task execution is still Pro-only; phase route plan is mixed and runner wiring remains')
  } else if (!realTaskMixedRoute) {
    guards.push('real task pack is still Pro-only; mixed route is proven by smoke, not by multi-step real tasks')
  }
  if (fail + policyFail + timedOut === 0 && !controlledTaxonomyOk) {
    guards.push('failure taxonomy has no failing samples yet; add controlled failure tasks before public benchmark spend')
  } else if (fail + policyFail + timedOut === 0 && controlledTaxonomyOk) {
    guards.push('failure taxonomy is controlled-only; add live failing samples before public benchmark spend')
  }

  const internalCode10 =
    blockers.length === 0 && totalCases >= 4 ? 'GO_WITH_GUARDS' : 'STOP'
  const internalCode30 =
    blockers.length === 0 && totalCases >= 30 ? 'GO_AFTER_MORE_TASKS' : 'STOP'

  return {
    ok: blockers.length === 0,
    internalCode10,
    internalCode30,
    publicBenchmark: 'STOP_PUBLIC_BENCH',
    totalCases,
    passRate: round(passRate),
    totalToolCalls,
    averageToolCalls: round(averageToolCalls, 2),
    editCallRatio: round(editCallRatio, 4),
    failedEditRate: round(failedEditRate, 4),
    postMarkerToolCalls,
    totalCostUSD: round(totalCostUSD, 6),
    modelsUsed,
    realTaskMixedRoute,
    realTaskPlannedMixedRoute,
    plannedRouteModels,
    routePlanOpportunityCount,
    mixedRouteSmoke,
    failureTaxonomy: {
      failed: fail,
      policyFail,
      timedOut,
      missingFailureDiversity: fail + policyFail + timedOut === 0 && !controlledTaxonomyOk,
      controlledSampleCount,
      controlledCategories,
    },
    blockers,
    guards,
  }
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(normalizeV18EvidenceJsonText(await readFile(path, 'utf8')))
}

function renderMarkdown(report: V18BenchmarkReadinessReport): string {
  const readiness = report.readiness
  return [
    '# DSXU V18 Internal Benchmark Readiness',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '## Decision',
    '',
    `- Internal Code-10: ${readiness.internalCode10}`,
    `- Internal Code-30: ${readiness.internalCode30}`,
    `- Public Benchmark: ${readiness.publicBenchmark}`,
    `- Overall OK For Local Aggregation: ${readiness.ok}`,
    '',
    '## Metrics',
    '',
    `- Cases: ${readiness.totalCases}`,
    `- Pass rate: ${readiness.passRate}`,
    `- Total tool calls: ${readiness.totalToolCalls}`,
    `- Average tool calls: ${readiness.averageToolCalls}`,
    `- Edit/tool ratio: ${readiness.editCallRatio}`,
    `- Failed edit rate: ${readiness.failedEditRate}`,
    `- Post-marker tool calls: ${readiness.postMarkerToolCalls}`,
    `- Total cost USD: ${readiness.totalCostUSD}`,
    `- Models used in real task pack: ${readiness.modelsUsed.join(', ') || 'none'}`,
    `- Mixed-route smoke: ${readiness.mixedRouteSmoke}`,
    `- Real-task mixed route: ${readiness.realTaskMixedRoute}`,
    `- Real-task planned mixed route: ${readiness.realTaskPlannedMixedRoute}`,
    `- Planned route models: ${readiness.plannedRouteModels.join(', ') || 'none'}`,
    `- Route plan opportunities: ${readiness.routePlanOpportunityCount}`,
    '',
    '## Blockers',
    '',
    ...(readiness.blockers.length > 0
      ? readiness.blockers.map(blocker => `- ${blocker}`)
      : ['- None']),
    '',
    '## Guards',
    '',
    ...(readiness.guards.length > 0
      ? readiness.guards.map(guard => `- ${guard}`)
      : ['- None']),
    '',
  ].join('\n')
}

export async function runV18BenchmarkReadinessHarness(
  options: V18BenchmarkReadinessHarnessOptions = {},
): Promise<V18BenchmarkReadinessReport> {
  const root = process.cwd()
  const evidenceDir =
    options.evidenceDir ?? join(root, '.dsxu', 'trace', 'v18-benchmark')
  const evidencePath = join(
    evidenceDir,
    'internal-code-terminal-readiness-20260506.evidence.json',
  )
  const markdownPath =
    options.markdownPath ??
    join(root, 'docs', 'DSXU_V18_INTERNAL_BENCHMARK_READINESS_20260506.md')
  const realTaskPackPath = join(
    root,
    '.dsxu/trace/v18-stage-close/real-task-pack-core-live-20260506.evidence.json',
  )
  const mixedRoutePath = join(
    root,
    '.dsxu/trace/v18-cost/mixed-pro-flash-live-route-20260506.evidence.json',
  )
  const controlledFailurePath = join(
    root,
    '.dsxu/trace/v18-benchmark/controlled-failure-taxonomy-20260506.evidence.json',
  )
  const realTaskRoutePlanPath = join(
    root,
    '.dsxu/trace/v18-cost-router/real-task-phase-route-plan-20260506.evidence.json',
  )
  await mkdir(evidenceDir, { recursive: true })

  let controlledFailureTaxonomy: V18ControlledFailureTaxonomyEvidence | undefined
  try {
    controlledFailureTaxonomy = (await readJson(
      controlledFailurePath,
    )) as V18ControlledFailureTaxonomyEvidence
  } catch {
    controlledFailureTaxonomy = undefined
  }
  let realTaskRoutePlan: V18RealTaskRoutePlanEvidence | undefined
  try {
    realTaskRoutePlan = (await readJson(
      realTaskRoutePlanPath,
    )) as V18RealTaskRoutePlanEvidence
  } catch {
    realTaskRoutePlan = undefined
  }
  const readiness = buildV18BenchmarkReadiness({
    realTaskPack: (await readJson(realTaskPackPath)) as V18RealTaskPackEvidence,
    mixedRoute: (await readJson(mixedRoutePath)) as V18MixedRouteEvidence,
    controlledFailureTaxonomy,
    realTaskRoutePlan,
  })
  const report: V18BenchmarkReadinessReport = {
    ok: readiness.ok,
    generatedAt: options.nowIso ?? new Date().toISOString(),
    evidencePath,
    markdownPath,
    readiness,
    sourceEvidence: {
      realTaskPack: realTaskPackPath,
      mixedRoute: mixedRoutePath,
      realTaskRoutePlan: realTaskRoutePlanPath,
    },
  }
  await writeFile(evidencePath, JSON.stringify(report, null, 2), 'utf8')
  await writeFile(markdownPath, renderMarkdown(report), 'utf8')
  return report
}
