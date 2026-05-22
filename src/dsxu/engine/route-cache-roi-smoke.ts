import { mkdir, readFile, writeFile } from 'fs/promises'
import { join, relative, resolve } from 'path'
import { buildDSXUModelCostEvidenceFromUsage } from './final-report-usage-evidence'
import { normalizeV18EvidenceJsonText } from './go-stop-decision'

type V18ModelUsage = {
  inputTokens?: number
  outputTokens?: number
  cacheReadInputTokens?: number
  cacheCreationInputTokens?: number
  costUSD?: number
}

type V18LiveReportCase = {
  id?: string
  category?: string
  status?: string
  routeExpectation?: {
    routeReason?: string
    workflowKind?: string
    expectedModel?: string
  }
  metrics?: {
    modelsUsed?: string[]
    modelUsage?: Record<string, V18ModelUsage>
    totalCostUSD?: number
  }
}

type V18LiveReport = {
  generatedAt?: string
  mode?: string
  cases?: V18LiveReportCase[]
}

export type V18RouteCacheRoiCase = {
  id: string
  category: string
  status: string
  sourceReport: string
  routeReason: string
  modelsUsed: string[]
  cacheHitInputTokens: number
  cacheMissInputTokens: number
  outputTokens: number
  cacheHitRatePct: number
  totalCostUSD: number
  proWithoutFlashAttempt: boolean
}

export type V18RouteCacheRoiRecommendation = {
  routeReason: string
  currentModel: string
  recommendedTarget: string
  cacheHitRatePct: number
  cacheMissInputTokens: number
  proRoiRatePct: number
  proNodeCount: number
  reason: string
}

export type V18RouteCacheRoiSmokeEvidence = {
  ok: boolean
  status: 'DONE_EVIDENCED' | 'PARTIAL_ROUTE_CACHE_ROI'
  generatedAt: string
  evidencePath: string
  sourceReports: string[]
  aggregate: ReturnType<typeof buildDSXUModelCostEvidenceFromUsage>
  cases: V18RouteCacheRoiCase[]
  demotionCandidates: V18RouteCacheRoiRecommendation[]
  keepProRoutes: V18RouteCacheRoiRecommendation[]
  guards: string[]
  recommendations: string[]
}

function pct(hit: number, miss: number): number {
  return Math.round((hit / Math.max(1, hit + miss)) * 1000) / 10
}

function usageNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0
}

function normalizeRouteReason(testCase: V18LiveReportCase): string {
  return testCase.routeExpectation?.routeReason ?? `missing_route_reason_${testCase.category ?? 'unknown'}`
}

function isProModel(model: string): boolean {
  return model === 'deepseek-v4-pro'
}

function isFlashModel(model: string): boolean {
  return model === 'deepseek-v4-flash'
}

function isHardSafetyProRoute(routeReason: string): boolean {
  return /high[_-]?risk|permission|security|approval/i.test(routeReason)
}

function recommendedTargetForRoute(routeReason: string): string {
  if (/review|planning/i.test(routeReason)) return 'planning_flash_thinking_max'
  if (/recovery/i.test(routeReason)) return 'recovery_flash_thinking_max'
  if (/repo/i.test(routeReason)) return 'repo_understanding_flash_thinking_high'
  return 'flash_max_before_pro'
}

function routeReasonForRecord(testCase: V18LiveReportCase, model: string): string {
  const routeReason = normalizeRouteReason(testCase)
  if (!isProModel(model)) return routeReason
  return routeReason
}

function caseToRecords(input: {
  sourceReport: string
  testCase: V18LiveReportCase
}) {
  const modelUsage = input.testCase.metrics?.modelUsage ?? {}
  const sameCaseFlashNodeIds = Object.keys(modelUsage)
    .filter(isFlashModel)
    .map(model => `${input.testCase.id ?? 'unknown'}:${model}`)
  return Object.entries(modelUsage).map(([model, usage]) => {
    const routeReason = routeReasonForRecord(input.testCase, model)
    const isPro = isProModel(model)
    return {
      nodeId: `${input.testCase.id ?? 'unknown'}:${model}`,
      model,
      routeReason,
      modelEvidence:
        `DSXU live route smoke: ${model}; case=${input.testCase.id ?? 'unknown'}; route=${routeReason}; source=${input.sourceReport}.`,
      proAdmissionReason: isPro ? routeReason : undefined,
      flashAttemptedBeforePro: isPro ? sameCaseFlashNodeIds.length > 0 : undefined,
      flashAttemptNodeIds: isPro ? sameCaseFlashNodeIds : undefined,
      proSavedTask: isPro ? sameCaseFlashNodeIds.length > 0 && input.testCase.status === 'pass' : undefined,
      proSaveEvidence: isPro
        ? sameCaseFlashNodeIds.length > 0 && input.testCase.status === 'pass'
          ? 'same-case Flash attempt existed and final live case passed after Pro'
          : 'no same-case Flash attempt evidence in live report'
        : undefined,
      usage: {
        input_tokens: usageNumber(usage.inputTokens),
        output_tokens: usageNumber(usage.outputTokens),
        cache_read_input_tokens: usageNumber(usage.cacheReadInputTokens),
        cache_creation_input_tokens: usageNumber(usage.cacheCreationInputTokens),
        dsxu: {
          model,
          route_reason: routeReason,
          model_evidence:
            `DSXU live route smoke: ${model}; case=${input.testCase.id ?? 'unknown'}; route=${routeReason}.`,
        },
      },
    }
  })
}

function summarizeCase(input: {
  sourceReport: string
  testCase: V18LiveReportCase
}): V18RouteCacheRoiCase {
  const usageValues = Object.values(input.testCase.metrics?.modelUsage ?? {})
  const cacheHitInputTokens = usageValues.reduce((sum, usage) => sum + usageNumber(usage.cacheReadInputTokens), 0)
  const cacheMissInputTokens = usageValues.reduce((sum, usage) => sum + usageNumber(usage.cacheCreationInputTokens), 0)
  const outputTokens = usageValues.reduce((sum, usage) => sum + usageNumber(usage.outputTokens), 0)
  const modelUsage = input.testCase.metrics?.modelUsage ?? {}
  const modelsUsed = Object.keys(modelUsage).length > 0
    ? Object.keys(modelUsage)
    : input.testCase.metrics?.modelsUsed ?? []
  const hasPro = modelsUsed.some(isProModel)
  const hasFlash = modelsUsed.some(isFlashModel)
  return {
    id: input.testCase.id ?? 'unknown',
    category: input.testCase.category ?? 'unknown',
    status: input.testCase.status ?? 'unknown',
    sourceReport: input.sourceReport,
    routeReason: normalizeRouteReason(input.testCase),
    modelsUsed: [...new Set(modelsUsed)].sort(),
    cacheHitInputTokens,
    cacheMissInputTokens,
    outputTokens,
    cacheHitRatePct: pct(cacheHitInputTokens, cacheMissInputTokens),
    totalCostUSD: usageNumber(input.testCase.metrics?.totalCostUSD),
    proWithoutFlashAttempt: hasPro && !hasFlash,
  }
}

function buildRecommendations(
  aggregate: ReturnType<typeof buildDSXUModelCostEvidenceFromUsage>,
): {
  demotionCandidates: V18RouteCacheRoiRecommendation[]
  keepProRoutes: V18RouteCacheRoiRecommendation[]
} {
  const proEntriesByRoute = new Map<string, { count: number; saved: number }>()
  for (const entry of aggregate.proRoi?.entries ?? []) {
    const current = proEntriesByRoute.get(entry.routeReason) ?? { count: 0, saved: 0 }
    current.count += 1
    if (entry.proSavedTask) current.saved += 1
    proEntriesByRoute.set(entry.routeReason, current)
  }
  const demotionCandidates: V18RouteCacheRoiRecommendation[] = []
  const keepProRoutes: V18RouteCacheRoiRecommendation[] = []

  for (const bucket of aggregate.cacheByRouteReason ?? []) {
    if (!/_pro_|pro_/i.test(bucket.routeReason)) continue
    const roi = proEntriesByRoute.get(bucket.routeReason) ?? { count: 0, saved: 0 }
    const proRoiRatePct = pct(roi.saved, Math.max(0, roi.count - roi.saved))
    const recommendation: V18RouteCacheRoiRecommendation = {
      routeReason: bucket.routeReason,
      currentModel: 'deepseek-v4-pro',
      recommendedTarget: recommendedTargetForRoute(bucket.routeReason),
      cacheHitRatePct: bucket.cacheHitRatePct,
      cacheMissInputTokens: bucket.cacheMissInputTokens,
      proRoiRatePct,
      proNodeCount: roi.count,
      reason: '',
    }
    if (isHardSafetyProRoute(bucket.routeReason)) {
      keepProRoutes.push({
        ...recommendation,
        recommendedTarget: 'keep_pro_for_safety_gate',
        reason: 'high-risk permission/security routes are safety gates; do not demote based on ROI alone',
      })
      continue
    }
    if (roi.count > 0 && roi.saved === 0) {
      demotionCandidates.push({
        ...recommendation,
        reason: 'Pro route has no same-case Flash attempt and no saved-task evidence',
      })
      continue
    }
    if (roi.saved > 0) {
      keepProRoutes.push({
        ...recommendation,
        reason:
          bucket.cacheMissInputTokens >= 10_000 && bucket.cacheHitRatePct < 80
            ? 'Pro route has saved-task evidence; keep Pro admission and optimize stable-prefix cache separately'
            : 'Pro route has saved-task evidence; keep Pro admission',
      })
      continue
    }
    if (bucket.cacheMissInputTokens >= 10_000 && bucket.cacheHitRatePct < 80) {
      demotionCandidates.push({
        ...recommendation,
        reason: 'Pro route has high cache-miss input, sub-80% cache hit rate, and no saved-task evidence',
      })
      continue
    }
    keepProRoutes.push({
      ...recommendation,
      reason: 'Pro route has acceptable cache/ROI evidence or insufficient samples for demotion',
    })
  }
  return { demotionCandidates, keepProRoutes }
}

export function buildV18RouteCacheRoiSmokeEvidence(input: {
  generatedAt: string
  evidencePath: string
  sourceReports: readonly string[]
  reports: readonly V18LiveReport[]
}): V18RouteCacheRoiSmokeEvidence {
  const cases = input.reports.flatMap((report, reportIndex) =>
    (report.cases ?? []).map(testCase =>
      summarizeCase({
        sourceReport: input.sourceReports[reportIndex] ?? `report-${reportIndex}`,
        testCase,
      }),
    ),
  )
  const records = input.reports.flatMap((report, reportIndex) =>
    (report.cases ?? []).flatMap(testCase =>
      caseToRecords({
        sourceReport: input.sourceReports[reportIndex] ?? `report-${reportIndex}`,
        testCase,
      }),
    ),
  )
  const aggregate = buildDSXUModelCostEvidenceFromUsage({
    scenario: 'v18_live_route_cache_roi_smoke',
    solved: cases.length > 0 && cases.every(testCase => testCase.status === 'pass'),
    records,
  })
  const { demotionCandidates, keepProRoutes } = buildRecommendations(aggregate)
  const guards: string[] = []
  const recommendations: string[] = []

  if (records.length === 0) {
    guards.push('no model usage records were found in live reports')
  }
  if (demotionCandidates.length > 0) {
    recommendations.push(
      'Demote non-safety Pro routes with no saved-task evidence to Flash-MAX first, then admit Pro only after failed verification or explicit high-risk gate.',
    )
  }
  if (keepProRoutes.length > 0) {
    recommendations.push(
      'Keep high-risk permission/security Pro routes even when Pro ROI is not a saved-task signal.',
    )
  }
  const status: V18RouteCacheRoiSmokeEvidence['status'] =
    records.length > 0 ? 'DONE_EVIDENCED' : 'PARTIAL_ROUTE_CACHE_ROI'

  return {
    ok: records.length > 0,
    status,
    generatedAt: input.generatedAt,
    evidencePath: input.evidencePath,
    sourceReports: [...input.sourceReports],
    aggregate,
    cases,
    demotionCandidates,
    keepProRoutes,
    guards,
    recommendations,
  }
}

async function readJson(path: string): Promise<V18LiveReport> {
  return JSON.parse(normalizeV18EvidenceJsonText(await readFile(path, 'utf8'))) as V18LiveReport
}

export async function runV18RouteCacheRoiSmokeHarness(options: {
  sourceReports?: readonly string[]
  evidenceDir?: string
  nowIso?: string
} = {}): Promise<V18RouteCacheRoiSmokeEvidence> {
  const root = process.cwd()
  const sourceReports = (
    options.sourceReports ?? [
      join(root, '.dsxu/runs/v18-code-10-live-flashfirst-20260507-1033/live-report.json'),
      join(root, '.dsxu/runs/v18-terminal-10-live-done-20260507-0953/live-report.json'),
    ]
  ).map(report => resolve(root, report))
  const evidenceDir =
    options.evidenceDir ?? join(root, '.dsxu', 'trace', 'v18-cost-router')
  const evidencePath = join(
    evidenceDir,
    'live-route-cache-roi-smoke-20260507.evidence.json',
  )
  await mkdir(evidenceDir, { recursive: true })
  const reports = await Promise.all(sourceReports.map(readJson))
  const evidence = buildV18RouteCacheRoiSmokeEvidence({
    generatedAt: options.nowIso ?? new Date().toISOString(),
    evidencePath,
    sourceReports: sourceReports.map(report => relative(root, report).replace(/[\\/]+/g, '/')),
    reports,
  })
  await writeFile(evidencePath, JSON.stringify(evidence, null, 2), 'utf8')
  return evidence
}
