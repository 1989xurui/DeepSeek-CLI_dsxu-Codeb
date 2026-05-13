import { mkdir, readFile, writeFile } from 'fs/promises'
import { join, resolve } from 'path'
import {
  decideDeepSeekV4Route,
  type DeepSeekV4WorkflowKind,
} from '../../utils/model/deepseekV4Control'
import { normalizeV18EvidenceJsonText } from './v18-go-stop-decision'

export type V18LiveReportCase = {
  id: string
  category?: string
  prompt?: string
  status?: string
  metrics?: {
    modelsUsed?: string[]
    totalCostUSD?: number
    toolCalls?: number
    editCalls?: number
    failedEditCalls?: number
  }
}

export type V18LiveReport = {
  cases?: V18LiveReportCase[]
}

export type V18RealTaskPackRouteSource = {
  reports?: string[]
  aggregate?: {
    totalCases?: number
    pass?: number
    fail?: number
    policyFail?: number
    timedOut?: number
    modelsUsed?: string[]
  }
}

export type V18RealTaskRoutePhase = {
  caseId: string
  category: string
  phase: 'execution' | 'review' | 'recovery' | 'repo_understanding'
  workflowKind: DeepSeekV4WorkflowKind
  plannedModel: string
  apiMode: string
  reasoningEffort?: string
  reason: string
  maxTokens: number
}

export type V18RealTaskRouteCasePlan = {
  id: string
  category: string
  status: string
  actualModels: string[]
  plannedModels: string[]
  phases: V18RealTaskRoutePhase[]
  costOptimizationOpportunity: boolean
}

export type V18RealTaskRoutePlanEvidence = {
  ok: boolean
  status: 'DONE_EVIDENCED' | 'PARTIAL_ROUTE_PLAN' | 'BLOCKED_NON_GREEN'
  generatedAt: string
  evidenceMode: 'route_plan_over_real_task_pack'
  sourceRealTaskPack: string
  evidencePath: string
  cases: V18RealTaskRouteCasePlan[]
  actualModels: string[]
  plannedModels: string[]
  actualMixedRoute: boolean
  plannedMixedRoute: boolean
  actualRouteWired: boolean
  costOptimizationOpportunityCount: number
  guards: string[]
}

export type V18RealTaskRoutePlanOptions = {
  realTaskPackPath?: string
  evidenceDir?: string
  nowIso?: string
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort()
}

function normalizeReportPath(root: string, reportPath: string): string {
  return resolve(root, reportPath)
}

function inferWorkflowFromCategory(category: string): DeepSeekV4WorkflowKind {
  switch (category) {
    case 'bugfix':
      return 'bugfix'
    case 'feature':
      return 'feature'
    case 'review':
      return 'review'
    case 'recovery':
      return 'recovery'
    case 'repo_understanding':
      return 'repo_understanding'
    default:
      return 'feature'
  }
}

function phaseForWorkflow(
  workflowKind: DeepSeekV4WorkflowKind,
): V18RealTaskRoutePhase['phase'] {
  if (workflowKind === 'review') return 'review'
  if (workflowKind === 'recovery') return 'recovery'
  if (workflowKind === 'repo_understanding') return 'repo_understanding'
  return 'execution'
}

function categoryFromCase(testCase: V18LiveReportCase): string {
  if (testCase.category) return testCase.category
  const id = testCase.id.toLowerCase()
  if (id.includes('review')) return 'review'
  if (id.includes('recovery')) return 'recovery'
  if (id.includes('bugfix')) return 'bugfix'
  if (id.includes('repo')) return 'repo_understanding'
  return 'feature'
}

function planCaseRoute(testCase: V18LiveReportCase): V18RealTaskRouteCasePlan {
  const category = categoryFromCase(testCase)
  const workflowKind = inferWorkflowFromCategory(category)
  const decision = decideDeepSeekV4Route({ workflowKind })
  const phase: V18RealTaskRoutePhase = {
    caseId: testCase.id,
    category,
    phase: phaseForWorkflow(workflowKind),
    workflowKind,
    plannedModel: decision.model,
    apiMode: decision.apiMode,
    reasoningEffort: decision.reasoningEffort,
    reason: decision.reason,
    maxTokens: decision.maxTokens,
  }
  const actualModels = testCase.metrics?.modelsUsed ?? []
  const plannedModels = [decision.model]
  const costOptimizationOpportunity =
    plannedModels.includes('deepseek-v4-flash') &&
    actualModels.includes('deepseek-v4-pro') &&
    !actualModels.includes('deepseek-v4-flash')

  return {
    id: testCase.id,
    category,
    status: testCase.status ?? 'unknown',
    actualModels: unique(actualModels),
    plannedModels: unique(plannedModels),
    phases: [phase],
    costOptimizationOpportunity,
  }
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(normalizeV18EvidenceJsonText(await readFile(path, 'utf8'))) as T
}

async function readLiveReportCases(
  root: string,
  realTaskPack: V18RealTaskPackRouteSource,
): Promise<V18LiveReportCase[]> {
  const reports = realTaskPack.reports ?? []
  const byId = new Map<string, V18LiveReportCase>()
  for (const reportPath of reports) {
    const report = await readJson<V18LiveReport>(
      normalizeReportPath(root, reportPath),
    )
    for (const testCase of report.cases ?? []) {
      byId.set(testCase.id, testCase)
    }
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id))
}

export function buildV18RealTaskRoutePlan(input: {
  generatedAt: string
  sourceRealTaskPack: string
  evidencePath: string
  realTaskPack: V18RealTaskPackRouteSource
  cases: V18LiveReportCase[]
}): V18RealTaskRoutePlanEvidence {
  const plannedCases = input.cases.map(planCaseRoute)
  const actualModels = unique(
    plannedCases.flatMap(testCase => testCase.actualModels),
  )
  const plannedModels = unique(
    plannedCases.flatMap(testCase => testCase.plannedModels),
  )
  const actualMixedRoute =
    actualModels.includes('deepseek-v4-flash') &&
    actualModels.includes('deepseek-v4-pro')
  const plannedMixedRoute =
    plannedModels.includes('deepseek-v4-flash') &&
    plannedModels.includes('deepseek-v4-pro')
  const costOptimizationOpportunityCount = plannedCases.filter(
    testCase => testCase.costOptimizationOpportunity,
  ).length
  const aggregate = input.realTaskPack.aggregate
  const realTaskPackGreen =
    aggregate?.pass === aggregate?.totalCases &&
    (aggregate?.fail ?? 0) === 0 &&
    (aggregate?.policyFail ?? 0) === 0 &&
    (aggregate?.timedOut ?? 0) === 0
  const guards: string[] = []

  if (!actualMixedRoute && plannedMixedRoute) {
    guards.push(
      'actual live task execution remains Pro-only; phase route plan is mixed and needs runner wiring',
    )
  }
  if (costOptimizationOpportunityCount > 0) {
    guards.push(
      'low-risk bugfix/feature cases have measurable Flash execution opportunities',
    )
  }
  const actualRouteWired = actualMixedRoute && costOptimizationOpportunityCount === 0
  const ok =
    realTaskPackGreen &&
    plannedCases.length > 0 &&
    plannedMixedRoute &&
    actualRouteWired
  const status: V18RealTaskRoutePlanEvidence['status'] =
    !realTaskPackGreen
      ? 'BLOCKED_NON_GREEN'
      : ok
        ? 'DONE_EVIDENCED'
        : 'PARTIAL_ROUTE_PLAN'

  return {
    ok,
    status,
    generatedAt: input.generatedAt,
    evidenceMode: 'route_plan_over_real_task_pack',
    sourceRealTaskPack: input.sourceRealTaskPack,
    evidencePath: input.evidencePath,
    cases: plannedCases,
    actualModels,
    plannedModels,
    actualMixedRoute,
    plannedMixedRoute,
    actualRouteWired,
    costOptimizationOpportunityCount,
    guards,
  }
}

export async function runV18RealTaskRoutePlanHarness(
  options: V18RealTaskRoutePlanOptions = {},
): Promise<V18RealTaskRoutePlanEvidence> {
  const root = process.cwd()
  const realTaskPackPath =
    options.realTaskPackPath ??
    join(root, '.dsxu/trace/v18-stage-close/real-task-pack-core-live-20260506.evidence.json')
  const evidenceDir =
    options.evidenceDir ?? join(root, '.dsxu', 'trace', 'v18-cost-router')
  const evidencePath = join(
    evidenceDir,
    'real-task-phase-route-plan-20260506.evidence.json',
  )
  await mkdir(evidenceDir, { recursive: true })

  const realTaskPack = await readJson<V18RealTaskPackRouteSource>(
    realTaskPackPath,
  )
  const cases = await readLiveReportCases(root, realTaskPack)
  const evidence = buildV18RealTaskRoutePlan({
    generatedAt: options.nowIso ?? new Date().toISOString(),
    sourceRealTaskPack: realTaskPackPath,
    evidencePath,
    realTaskPack,
    cases,
  })
  await writeFile(evidencePath, JSON.stringify(evidence, null, 2), 'utf8')
  return evidence
}
