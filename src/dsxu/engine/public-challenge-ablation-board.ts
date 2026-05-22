export type DSXUPublicChallengeAblationStatus =
  | 'PASS_PUBLIC_CHALLENGE_ABLATION_ACCEPTANCE'
  | 'BLOCKED_PUBLIC_CHALLENGE_ABLATION_ACCEPTANCE'

export type DSXUPublicChallengeReviewMetrics = {
  id: string
  score: number
  passed: boolean
  totalCostUSD: number
  requestCount: number
  proRequestCount: number
  cacheHitInputTokens: number
  cacheMissInputTokens: number
  outputTokens: number
  cacheHitRatePct: number
  readToolCallCount: number
  toolResultCount: number
  toolResultChars: number
  uniqueSystemHashCount: number
  routeReasons: string[]
  models: string[]
  tracePath: string
  trajectoryPath: string
}

export type DSXUPublicChallengeRunSnapshot = {
  label: 'before' | 'after'
  reviews: DSXUPublicChallengeReviewMetrics[]
}

export type DSXUPublicChallengeAblationInput = {
  generatedAt?: string
  before: DSXUPublicChallengeRunSnapshot
  after: DSXUPublicChallengeRunSnapshot
  expectedReviewIds: string[]
  cacheHitRateClaimTargetPct: number
  sourceTruthPolicy: string
  currentPackagePath?: string
  currentPackageStatus?: string
}

export type DSXUPublicChallengeAblationBoard = {
  schemaVersion: 'dsxu.public-challenge-ablation-board.v1'
  generatedAt: string
  status: DSXUPublicChallengeAblationStatus
  claimAblationRunnerAllowed: boolean
  claimObservedCacheTrendAllowed: boolean
  claimHighCacheRoiAllowed: boolean
  claimExternalComparisonAllowed: boolean
  claimPublic90Allowed: boolean
  sourceTruthPolicy: string
  currentPackagePath?: string
  currentPackageStatus?: string
  gates: Record<string, boolean>
  guards: string[]
  allowedClaims: string[]
  blockedClaims: string[]
  before: DSXUPublicChallengeRunSummary
  after: DSXUPublicChallengeRunSummary
  deltas: DSXUPublicChallengeAblationDeltas
}

export type DSXUPublicChallengeRunSummary = {
  label: 'before' | 'after'
  reviewIds: string[]
  reviewCount: number
  passCount: number
  scoreFloor: number
  averageScore: number
  totalCostUSD: number
  requestCount: number
  proRequestCount: number
  cacheHitInputTokens: number
  cacheMissInputTokens: number
  outputTokens: number
  cacheHitRatePct: number
  readToolCallCount: number
  toolResultCount: number
  toolResultChars: number
  maxUniqueSystemHashCount: number
  routeReasons: string[]
  models: string[]
  traces: string[]
  trajectories: string[]
}

export type DSXUPublicChallengeAblationDeltas = {
  scoreFloorDelta: number
  totalCostUSDDelta: number
  totalCostSavingsPct: number
  cacheHitRatePctDelta: number
  readToolCallDelta: number
  toolResultCountDelta: number
  toolResultCharsDelta: number
  requestCountDelta: number
  proRequestCountDelta: number
  maxUniqueSystemHashCountDelta: number
}

export function buildDSXUPublicChallengeAblationBoard(
  input: DSXUPublicChallengeAblationInput,
): DSXUPublicChallengeAblationBoard {
  const before = summarizeRun(input.before)
  const after = summarizeRun(input.after)
  const deltas = buildDeltas(before, after)

  const gates = {
    sameReviewIds: sameIds(before.reviewIds, after.reviewIds) && sameIds(after.reviewIds, input.expectedReviewIds),
    afterAllPassed: after.reviewCount > 0 && after.passCount === after.reviewCount,
    scoreFloorNotLower: after.scoreFloor >= before.scoreFloor,
    costReduced: after.totalCostUSD < before.totalCostUSD,
    cacheHitRateNotLower: after.cacheHitRatePct >= before.cacheHitRatePct,
    readToolCallsReduced: after.readToolCallCount <= before.readToolCallCount && after.readToolCallCount === 0,
    toolResultCharsReduced: after.toolResultChars <= before.toolResultChars && after.toolResultChars === 0,
    proUsageRemoved: after.proRequestCount <= before.proRequestCount && after.proRequestCount === 0,
    systemPromptStable: after.maxUniqueSystemHashCount <= before.maxUniqueSystemHashCount && after.maxUniqueSystemHashCount <= 1,
  }
  const status: DSXUPublicChallengeAblationStatus = Object.values(gates).every(Boolean)
    ? 'PASS_PUBLIC_CHALLENGE_ABLATION_ACCEPTANCE'
    : 'BLOCKED_PUBLIC_CHALLENGE_ABLATION_ACCEPTANCE'
  const claimHighCacheRoiAllowed =
    status === 'PASS_PUBLIC_CHALLENGE_ABLATION_ACCEPTANCE' &&
    after.cacheHitRatePct >= input.cacheHitRateClaimTargetPct

  const guards: string[] = []
  if (!gates.sameReviewIds) guards.push('before/after review ids differ from the expected same-task public challenge set')
  if (!gates.afterAllPassed) guards.push('after run did not pass every public challenge review')
  if (!gates.scoreFloorNotLower) guards.push('after score floor regressed')
  if (!gates.costReduced) guards.push('after cost did not decrease')
  if (!gates.cacheHitRateNotLower) guards.push('after cache hit rate did not improve or hold')
  if (!gates.readToolCallsReduced) guards.push('after run still used Read tool calls')
  if (!gates.toolResultCharsReduced) guards.push('after run still returned large tool result chars')
  if (!gates.proUsageRemoved) guards.push('after run still used Pro admission on the Flash-first public challenge lane')
  if (!gates.systemPromptStable) guards.push('after run did not keep a stable system prompt hash')
  if (!claimHighCacheRoiAllowed) {
    guards.push(`high-cache ROI claim remains blocked until public challenge cache hit rate reaches ${input.cacheHitRateClaimTargetPct}%`)
  }

  return {
    schemaVersion: 'dsxu.public-challenge-ablation-board.v1',
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    status,
    claimAblationRunnerAllowed: status === 'PASS_PUBLIC_CHALLENGE_ABLATION_ACCEPTANCE',
    claimObservedCacheTrendAllowed: status === 'PASS_PUBLIC_CHALLENGE_ABLATION_ACCEPTANCE',
    claimHighCacheRoiAllowed,
    claimExternalComparisonAllowed: false,
    claimPublic90Allowed: false,
    sourceTruthPolicy: input.sourceTruthPolicy,
    currentPackagePath: input.currentPackagePath,
    currentPackageStatus: input.currentPackageStatus,
    gates,
    guards,
    allowedClaims: status === 'PASS_PUBLIC_CHALLENGE_ABLATION_ACCEPTANCE'
      ? [
        'DSXU may claim same-task public challenge ablation evidence for source capsule, no-Read default, route latch, and tool-result hygiene.',
        'DSXU may claim cost/tool-result/pro-admission reduction on this three-review public challenge lane without score-floor regression.',
        'DSXU may claim observed cache-hit improvement as an optimization trend, not as a fixed public cache ROI guarantee.',
      ]
      : [],
    blockedClaims: [
      'Do not claim external comparison win without same-task target-reference raw transcripts and target manifest intake.',
      'Do not claim public 90% top-tier coding/complex-task ability from this internal ablation board.',
      'Do not claim high-cache ROI until the public challenge lane reaches the configured cache target with repeated evidence.',
      'Do not claim copied reference-product parity, standalone benchmark runtime, or standalone tool/provider/MCP runtime.',
    ],
    before,
    after,
    deltas,
  }
}

export function summarizeRun(snapshot: DSXUPublicChallengeRunSnapshot): DSXUPublicChallengeRunSummary {
  const reviews = snapshot.reviews
  const cacheHitInputTokens = sum(reviews, review => review.cacheHitInputTokens)
  const cacheMissInputTokens = sum(reviews, review => review.cacheMissInputTokens)
  const totalInputTokens = cacheHitInputTokens + cacheMissInputTokens

  return {
    label: snapshot.label,
    reviewIds: reviews.map(review => review.id).sort(),
    reviewCount: reviews.length,
    passCount: reviews.filter(review => review.passed).length,
    scoreFloor: reviews.length > 0 ? Math.min(...reviews.map(review => review.score)) : 0,
    averageScore: round(reviews.length > 0 ? sum(reviews, review => review.score) / reviews.length : 0, 1),
    totalCostUSD: round(sum(reviews, review => review.totalCostUSD), 10),
    requestCount: sum(reviews, review => review.requestCount),
    proRequestCount: sum(reviews, review => review.proRequestCount),
    cacheHitInputTokens,
    cacheMissInputTokens,
    outputTokens: sum(reviews, review => review.outputTokens),
    cacheHitRatePct: round(totalInputTokens > 0 ? (cacheHitInputTokens / totalInputTokens) * 100 : 0, 1),
    readToolCallCount: sum(reviews, review => review.readToolCallCount),
    toolResultCount: sum(reviews, review => review.toolResultCount),
    toolResultChars: sum(reviews, review => review.toolResultChars),
    maxUniqueSystemHashCount: reviews.length > 0 ? Math.max(...reviews.map(review => review.uniqueSystemHashCount)) : 0,
    routeReasons: uniqueSorted(reviews.flatMap(review => review.routeReasons)),
    models: uniqueSorted(reviews.flatMap(review => review.models)),
    traces: reviews.map(review => review.tracePath),
    trajectories: reviews.map(review => review.trajectoryPath),
  }
}

function buildDeltas(
  before: DSXUPublicChallengeRunSummary,
  after: DSXUPublicChallengeRunSummary,
): DSXUPublicChallengeAblationDeltas {
  return {
    scoreFloorDelta: round(after.scoreFloor - before.scoreFloor, 1),
    totalCostUSDDelta: round(after.totalCostUSD - before.totalCostUSD, 10),
    totalCostSavingsPct: round(before.totalCostUSD > 0 ? ((before.totalCostUSD - after.totalCostUSD) / before.totalCostUSD) * 100 : 0, 1),
    cacheHitRatePctDelta: round(after.cacheHitRatePct - before.cacheHitRatePct, 1),
    readToolCallDelta: after.readToolCallCount - before.readToolCallCount,
    toolResultCountDelta: after.toolResultCount - before.toolResultCount,
    toolResultCharsDelta: after.toolResultChars - before.toolResultChars,
    requestCountDelta: after.requestCount - before.requestCount,
    proRequestCountDelta: after.proRequestCount - before.proRequestCount,
    maxUniqueSystemHashCountDelta: after.maxUniqueSystemHashCount - before.maxUniqueSystemHashCount,
  }
}

function sameIds(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false
  const leftSorted = [...left].sort()
  const rightSorted = [...right].sort()
  return leftSorted.every((value, index) => value === rightSorted[index])
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort()
}

function sum<T>(values: T[], fn: (value: T) => number): number {
  return values.reduce((acc, value) => acc + fn(value), 0)
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}
