export type V18RouteTraceSource = {
  path: string
  text: string
}

export type V18RouteCacheDynamicTailCase = {
  path: string
  routeReasons: string[]
  models: string[]
  responseCount: number
  inputTokens: number
  outputTokens: number
  cacheHitInputTokens: number
  cacheMissInputTokens: number
  maxCacheMissInputTokensPerRequest: number
  warmResponseCount: number
  warmCacheHitInputTokens: number
  warmCacheMissInputTokens: number
  maxWarmCacheMissInputTokensPerRequest: number
  warmCacheHitRatePct: number
  cacheHitRatePct: number
  uniqueStablePrefixHashes: number
  uniqueDynamicTailHashes: number
  uniqueSystemHashes: number
  maxDynamicTailApproxTokens: number
  maxCacheMissBudgetTokens: number
  cacheMissOverBudget: boolean
  volatileFindingCount: number
  status: 'CACHE_STABLE' | 'CACHE_RISK'
  risks: string[]
}

export type V18RouteCacheDynamicTailEvidence = {
  ok: boolean
  status: 'DONE_EVIDENCED' | 'PARTIAL_CACHE_RISK'
  generatedAt: string
  sourceTraceFiles: string[]
  cases: V18RouteCacheDynamicTailCase[]
  recommendations: string[]
}

type JsonRecord = Record<string, unknown>

function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function pct(hit: number, miss: number): number {
  return Math.round((hit / Math.max(1, hit + miss)) * 1000) / 10
}

function parseJsonl(text: string): JsonRecord[] {
  return text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .flatMap(line => {
      try {
        return [JSON.parse(line) as JsonRecord]
      } catch {
        return []
      }
    })
}

function unique(values: Iterable<string | null>): string[] {
  return [...new Set([...values].filter((value): value is string => !!value))].sort()
}

function summarizeTrace(source: V18RouteTraceSource): V18RouteCacheDynamicTailCase {
  const records = parseJsonl(source.text)
  const promptEvidence = records.filter(record => record.event === 'prompt_prefix_cache_evidence')
  const requestPlans = records.filter(record => record.event === 'request_plan')
  const usage = records.filter(record => record.event === 'response_usage')
  const seenRouteModel = new Set<string>()
  const warmUsage = usage.filter(record => {
    const routeModel = [
      asString(record.routeReason) ?? 'unknown_route',
      asString(record.modelName) ?? asString(record.requestedModel) ?? 'unknown_model',
    ].join(':')
    if (seenRouteModel.has(routeModel)) return true
    seenRouteModel.add(routeModel)
    return false
  })

  const cacheHitInputTokens = usage.reduce((sum, record) => sum + asNumber(record.cacheHitInputTokens), 0)
  const cacheMissInputTokens = usage.reduce((sum, record) => sum + asNumber(record.cacheMissInputTokens), 0)
  const warmCacheHitInputTokens = warmUsage.reduce((sum, record) => sum + asNumber(record.cacheHitInputTokens), 0)
  const warmCacheMissInputTokens = warmUsage.reduce((sum, record) => sum + asNumber(record.cacheMissInputTokens), 0)
  const maxCacheMissInputTokensPerRequest = Math.max(
    0,
    ...usage.map(record => asNumber(record.cacheMissInputTokens)),
  )
  const maxWarmCacheMissInputTokensPerRequest = Math.max(
    0,
    ...warmUsage.map(record => asNumber(record.cacheMissInputTokens)),
  )
  const inputTokens = usage.reduce((sum, record) => sum + asNumber(record.inputTokens), 0)
  const outputTokens = usage.reduce((sum, record) => sum + asNumber(record.outputTokens), 0)
  const uniqueStablePrefixHashes = unique(promptEvidence.map(record => asString(record.stablePrefixHash))).length
  const uniqueDynamicTailHashes = unique(promptEvidence.map(record => asString(record.dynamicTailHash))).length
  const uniqueSystemHashes = unique(requestPlans.map(record => {
    const summary = record.systemPromptSummary
    if (!summary || typeof summary !== 'object') return null
    return asString((summary as JsonRecord).normalizedHash)
  })).length
  const maxDynamicTailApproxTokens = Math.max(
    0,
    ...promptEvidence.map(record => asNumber(record.dynamicTailApproxTokens)),
  )
  const maxCacheMissBudgetTokens = Math.max(
    0,
    ...promptEvidence.map(record => asNumber(record.cacheMissBudgetTokens)),
  )
  const volatileFindingCount = promptEvidence.reduce(
    (sum, record) => sum + asNumber(record.volatileFindingCount),
    0,
  )

  const risks: string[] = []
  if (promptEvidence.length === 0) risks.push('missing prompt_prefix_cache_evidence events')
  if (uniqueStablePrefixHashes > 1) risks.push('stable prefix hash changed within one trace')
  if (uniqueSystemHashes > unique(requestPlans.map(record => asString(record.modelName))).length && uniqueSystemHashes > 1) {
    risks.push('DeepSeek normalized system hash changed more often than model changes')
  }
  if (maxWarmCacheMissInputTokensPerRequest > Math.max(1, maxCacheMissBudgetTokens || 0) && maxCacheMissBudgetTokens > 0) {
    risks.push('warm cache miss input exceeded route cache miss budget')
  }
  if (volatileFindingCount > 0) risks.push('volatile findings remain in stable prefix evidence')
  if (pct(warmCacheHitInputTokens, warmCacheMissInputTokens) < 80 && warmUsage.length > 0) {
    risks.push('sub-80 warm cache hit rate after cold start')
  }

  return {
    path: source.path,
    routeReasons: unique([
      ...promptEvidence.map(record => asString(record.routeReason)),
      ...usage.map(record => asString(record.routeReason)),
    ]),
    models: unique([
      ...requestPlans.map(record => asString(record.modelName)),
      ...usage.map(record => asString(record.modelName)),
      ...usage.map(record => asString(record.requestedModel)),
    ]),
    responseCount: usage.length,
    inputTokens,
    outputTokens,
    cacheHitInputTokens,
    cacheMissInputTokens,
    maxCacheMissInputTokensPerRequest,
    warmResponseCount: warmUsage.length,
    warmCacheHitInputTokens,
    warmCacheMissInputTokens,
    maxWarmCacheMissInputTokensPerRequest,
    warmCacheHitRatePct: pct(warmCacheHitInputTokens, warmCacheMissInputTokens),
    cacheHitRatePct: pct(cacheHitInputTokens, cacheMissInputTokens),
    uniqueStablePrefixHashes,
    uniqueDynamicTailHashes,
    uniqueSystemHashes,
    maxDynamicTailApproxTokens,
    maxCacheMissBudgetTokens,
    cacheMissOverBudget: maxCacheMissBudgetTokens > 0 && maxWarmCacheMissInputTokensPerRequest > maxCacheMissBudgetTokens,
    volatileFindingCount,
    status: risks.length === 0 ? 'CACHE_STABLE' : 'CACHE_RISK',
    risks,
  }
}

export function buildV18RouteCacheDynamicTailEvidence(input: {
  generatedAt: string
  traces: readonly V18RouteTraceSource[]
}): V18RouteCacheDynamicTailEvidence {
  const cases = input.traces.map(summarizeTrace)
  const riskCases = cases.filter(testCase => testCase.status === 'CACHE_RISK')
  const recommendations = [
    ...riskCases.flatMap(testCase =>
      testCase.risks.map(risk => `${testCase.path}: ${risk}`),
    ),
  ]
  if (riskCases.some(testCase => testCase.cacheMissOverBudget)) {
    recommendations.push('Keep volatile route/task evidence in trace/final usage reports when possible; do not add more model-visible system context for cache diagnostics.')
  }
  if (riskCases.some(testCase => testCase.uniqueSystemHashes > 1)) {
    recommendations.push('Inspect system prompt sections that vary per turn before changing model routing.')
  }
  return {
    ok: riskCases.length === 0,
    status: riskCases.length === 0 ? 'DONE_EVIDENCED' : 'PARTIAL_CACHE_RISK',
    generatedAt: input.generatedAt,
    sourceTraceFiles: input.traces.map(trace => trace.path),
    cases,
    recommendations,
  }
}
