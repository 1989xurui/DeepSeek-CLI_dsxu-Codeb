import {
  DEEPSEEK_V4_FLASH_MODEL,
  DEEPSEEK_V4_PRO_MODEL,
  estimateDeepSeekV4Cost,
  normalizeDeepSeekV4Model,
  type DeepSeekV4Model,
} from '../../utils/model/deepseekV4Control'

export type DSXUCostQualityScenarioSource =
  | 'controlled-local-harness'
  | 'public-challenge'
  | 'live-provider'
  | 'release-evidence'

export type DSXUCostQualityClaimStatus = 'ALLOWED' | 'TREND_ONLY' | 'BLOCKED'

export type DSXUCostQualityTurn = {
  nodeId: string
  model: string
  routeReason: string
  cacheHitInputTokens: number
  cacheMissInputTokens: number
  outputTokens: number
  flashAttemptedBeforePro?: boolean
  proAdmissionReason?: string
  proSavedTask?: boolean
  publicRoute?: 'flash' | 'flash-max' | 'pro'
}

export type DSXUCostQualityScenario = {
  id: string
  label: string
  source: DSXUCostQualityScenarioSource
  solved: boolean
  evidencePaths: readonly string[]
  turns: readonly DSXUCostQualityTurn[]
  scoreFloor?: number
  scoreTarget?: number
  cacheTargetHitRatePct?: number
  toolResultChars?: number
  readToolCallCount?: number
  stablePrefixStable?: boolean
  dynamicTailVaried?: boolean
  publicClaimScope: 'internal-proof' | 'public-demo' | 'release-claim'
}

export type DSXUCostQualityScenarioSummary = {
  id: string
  label: string
  source: DSXUCostQualityScenarioSource
  solved: boolean
  publicClaimScope: DSXUCostQualityScenario['publicClaimScope']
  turnCount: number
  flashTurnCount: number
  proTurnCount: number
  flashTurnRatioPct: number
  proTurnRatioPct: number
  cacheHitInputTokens: number
  cacheMissInputTokens: number
  outputTokens: number
  cacheHitRatePct: number
  totalCostUsd: number
  proOnlyCostUsd: number
  savingsVsProOnlyPct: number
  proAdmissionViolations: readonly string[]
  cacheClaimStatus: DSXUCostQualityClaimStatus
  public90ClaimStatus: DSXUCostQualityClaimStatus
  claimStatus: DSXUCostQualityClaimStatus
  evidencePaths: readonly string[]
}

export type DSXUCostQualityBoard = {
  status: 'PASS_DEEPSEEK_COST_QUALITY_ACCEPTANCE' | 'NEEDS_DEEPSEEK_COST_QUALITY_EVIDENCE'
  generatedAt: string
  scenarioCount: number
  solvedScenarioCount: number
  totalTurnCount: number
  flashTurnCount: number
  proTurnCount: number
  flashTurnRatioPct: number
  proTurnRatioPct: number
  cacheHitInputTokens: number
  cacheMissInputTokens: number
  outputTokens: number
  cacheHitRatePct: number
  totalCostUsd: number
  proOnlyCostUsd: number
  savingsVsProOnlyPct: number
  public90ClaimAllowed: boolean
  cacheHighRoiClaimAllowed: boolean
  flashFirstCostClaimAllowed: boolean
  proAdmissionClaimAllowed: boolean
  allowedClaims: readonly string[]
  trendOnlyClaims: readonly string[]
  blockedClaims: readonly string[]
  guards: readonly string[]
  scenarios: readonly DSXUCostQualityScenarioSummary[]
}

export type DSXUDeepSeekRepairSignalKind =
  | 'json_tool_scavenged'
  | 'truncated_json_repaired'
  | 'identical_tool_call_storm'
  | 'search_text_not_found'
  | 'schema_validation_failed'

export type DSXUDeepSeekRepairSignalSeverity = 'info' | 'recoverable' | 'blocking'

export type DSXUDeepSeekRepairSignal = {
  kind: DSXUDeepSeekRepairSignalKind
  severity: DSXUDeepSeekRepairSignalSeverity
  turnId: string
  evidence: string
}

export type DSXUDeepSeekRepairAdmissionLedger = {
  schemaVersion: 'dsxu.deepseek.repair-admission-ledger.v1'
  status: 'FLASH_CONTINUE' | 'PRO_ADMISSION_READY' | 'PRO_ADMISSION_BLOCKED'
  proAdmissionAllowed: boolean
  proAdmissionCount: number
  priorFlashAttempted: boolean
  threshold: number
  signalScore: number
  signalKinds: readonly DSXUDeepSeekRepairSignalKind[]
  signals: readonly DSXUDeepSeekRepairSignal[]
  admissionReason?: string
  guards: readonly string[]
}

function nonNegative(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0
}

function pct(numerator: number, denominator: number): number {
  return denominator <= 0 ? 0 : Math.round((numerator / denominator) * 1000) / 10
}

function roundUsd(value: number): number {
  return Math.round(value * 1_000_000_000) / 1_000_000_000
}

function repairSignalWeight(signal: DSXUDeepSeekRepairSignal): number {
  if (signal.severity === 'blocking') return 2
  if (signal.severity === 'recoverable') return 1
  return 0
}

export function buildDSXUDeepSeekRepairAdmissionLedger(input: {
  priorFlashAttempted: boolean
  signals: readonly DSXUDeepSeekRepairSignal[]
  threshold?: number
}): DSXUDeepSeekRepairAdmissionLedger {
  const threshold = Math.max(1, Math.floor(input.threshold ?? 3))
  const signals = [...input.signals]
  const signalScore = signals.reduce((sum, signal) => sum + repairSignalWeight(signal), 0)
  const signalKinds = [...new Set(signals.map(signal => signal.kind))]
  const guards: string[] = []

  if (!input.priorFlashAttempted && signalScore >= threshold) {
    guards.push('Pro admission blocked: missing prior Flash attempt')
  }
  if (signals.length === 0) {
    guards.push('No repair/failure signals recorded; keep Flash-first default')
  }
  if (signalScore > 0 && signalScore < threshold) {
    guards.push(`Repair signal score ${signalScore} is below threshold ${threshold}; keep Flash-first default`)
  }

  const proAdmissionAllowed = input.priorFlashAttempted && signalScore >= threshold
  const status: DSXUDeepSeekRepairAdmissionLedger['status'] =
    proAdmissionAllowed
      ? 'PRO_ADMISSION_READY'
      : signalScore >= threshold
        ? 'PRO_ADMISSION_BLOCKED'
        : 'FLASH_CONTINUE'

  return {
    schemaVersion: 'dsxu.deepseek.repair-admission-ledger.v1',
    status,
    proAdmissionAllowed,
    proAdmissionCount: proAdmissionAllowed ? 1 : 0,
    priorFlashAttempted: input.priorFlashAttempted,
    threshold,
    signalScore,
    signalKinds,
    signals,
    admissionReason: proAdmissionAllowed
      ? `Pro admission allowed after prior Flash attempt and repair signal score ${signalScore}/${threshold}: ${signalKinds.join(', ')}`
      : undefined,
    guards,
  }
}

function isFlash(model: string): boolean {
  return normalizeDeepSeekV4Model(model) === DEEPSEEK_V4_FLASH_MODEL
}

function isPro(model: string): boolean {
  return normalizeDeepSeekV4Model(model) === DEEPSEEK_V4_PRO_MODEL
}

function turnCost(turn: DSXUCostQualityTurn, model?: DeepSeekV4Model): number {
  return estimateDeepSeekV4Cost({
    model: model ?? normalizeDeepSeekV4Model(turn.model),
    cacheHitInputTokens: nonNegative(turn.cacheHitInputTokens),
    cacheMissInputTokens: nonNegative(turn.cacheMissInputTokens),
    outputTokens: nonNegative(turn.outputTokens),
  })
}

function summarizeScenario(scenario: DSXUCostQualityScenario): DSXUCostQualityScenarioSummary {
  const turns = [...scenario.turns]
  const flashTurnCount = turns.filter(turn => isFlash(turn.model)).length
  const proTurnCount = turns.filter(turn => isPro(turn.model)).length
  const cacheHitInputTokens = turns.reduce((sum, turn) => sum + nonNegative(turn.cacheHitInputTokens), 0)
  const cacheMissInputTokens = turns.reduce((sum, turn) => sum + nonNegative(turn.cacheMissInputTokens), 0)
  const outputTokens = turns.reduce((sum, turn) => sum + nonNegative(turn.outputTokens), 0)
  const totalCostUsd = turns.reduce((sum, turn) => sum + turnCost(turn), 0)
  const proOnlyCostUsd = turns.reduce((sum, turn) => sum + turnCost(turn, DEEPSEEK_V4_PRO_MODEL), 0)
  const savingsVsProOnlyPct = pct(Math.max(0, proOnlyCostUsd - totalCostUsd), proOnlyCostUsd)
  const cacheHitRatePct = pct(cacheHitInputTokens, cacheHitInputTokens + cacheMissInputTokens)
  const proAdmissionViolations = turns
    .filter(turn => isPro(turn.model))
    .flatMap(turn => {
      const violations: string[] = []
      if (turn.flashAttemptedBeforePro !== true) violations.push(`${turn.nodeId}:missing prior Flash attempt`)
      if (!turn.proAdmissionReason?.trim()) violations.push(`${turn.nodeId}:missing Pro admission reason`)
      if (turn.proSavedTask !== true) violations.push(`${turn.nodeId}:missing saved-task evidence`)
      return violations
    })
  const cacheTarget = scenario.cacheTargetHitRatePct ?? 70
  const cacheClaimStatus: DSXUCostQualityClaimStatus =
    cacheHitRatePct >= cacheTarget &&
    (scenario.toolResultChars ?? 0) === 0 &&
    (scenario.readToolCallCount ?? 0) === 0 &&
    scenario.stablePrefixStable !== false
      ? 'ALLOWED'
      : cacheHitRatePct > 0
        ? 'TREND_ONLY'
        : 'BLOCKED'
  const scoreTarget = scenario.scoreTarget ?? 90
  const public90ClaimStatus: DSXUCostQualityClaimStatus =
    scenario.scoreFloor === undefined
      ? 'TREND_ONLY'
      : scenario.scoreFloor >= scoreTarget
        ? 'ALLOWED'
        : 'BLOCKED'
  const claimStatus: DSXUCostQualityClaimStatus =
    !scenario.solved || turns.length === 0 || proAdmissionViolations.length > 0
      ? 'BLOCKED'
      : scenario.publicClaimScope === 'release-claim' && public90ClaimStatus === 'BLOCKED'
        ? 'TREND_ONLY'
        : 'ALLOWED'

  return {
    id: scenario.id,
    label: scenario.label,
    source: scenario.source,
    solved: scenario.solved,
    publicClaimScope: scenario.publicClaimScope,
    turnCount: turns.length,
    flashTurnCount,
    proTurnCount,
    flashTurnRatioPct: pct(flashTurnCount, turns.length),
    proTurnRatioPct: pct(proTurnCount, turns.length),
    cacheHitInputTokens,
    cacheMissInputTokens,
    outputTokens,
    cacheHitRatePct,
    totalCostUsd: roundUsd(totalCostUsd),
    proOnlyCostUsd: roundUsd(proOnlyCostUsd),
    savingsVsProOnlyPct,
    proAdmissionViolations,
    cacheClaimStatus,
    public90ClaimStatus,
    claimStatus,
    evidencePaths: [...scenario.evidencePaths],
  }
}

export function buildDSXUDeepSeekCostQualityBoard(input: {
  scenarios: readonly DSXUCostQualityScenario[]
  generatedAt?: string
}): DSXUCostQualityBoard {
  const scenarios = input.scenarios.map(summarizeScenario)
  const totalTurnCount = scenarios.reduce((sum, item) => sum + item.turnCount, 0)
  const flashTurnCount = scenarios.reduce((sum, item) => sum + item.flashTurnCount, 0)
  const proTurnCount = scenarios.reduce((sum, item) => sum + item.proTurnCount, 0)
  const cacheHitInputTokens = scenarios.reduce((sum, item) => sum + item.cacheHitInputTokens, 0)
  const cacheMissInputTokens = scenarios.reduce((sum, item) => sum + item.cacheMissInputTokens, 0)
  const outputTokens = scenarios.reduce((sum, item) => sum + item.outputTokens, 0)
  const totalCostUsd = scenarios.reduce((sum, item) => sum + item.totalCostUsd, 0)
  const proOnlyCostUsd = scenarios.reduce((sum, item) => sum + item.proOnlyCostUsd, 0)
  const proAdmissionViolations = scenarios.flatMap(item => item.proAdmissionViolations)
  const guards: string[] = []

  if (scenarios.length === 0) guards.push('missing cost-quality scenarios')
  if (totalTurnCount === 0) guards.push('missing route/cost/cache turns')
  if (scenarios.some(item => !item.solved)) guards.push('one or more scenarios are unsolved')
  if (proAdmissionViolations.length > 0) guards.push(`Pro admission violations: ${proAdmissionViolations.join('; ')}`)
  if (scenarios.some(item => item.evidencePaths.length === 0)) guards.push('one or more scenarios lack evidence paths')

  const public90ClaimAllowed = scenarios
    .filter(item => item.publicClaimScope === 'release-claim')
    .some(item => item.public90ClaimStatus === 'ALLOWED')
  const publicOrLiveCacheScenarios = scenarios
    .filter(item => item.source === 'public-challenge' || item.source === 'live-provider')
  const cacheHighRoiClaimAllowed =
    publicOrLiveCacheScenarios.length > 0 &&
    publicOrLiveCacheScenarios.every(item => item.cacheClaimStatus === 'ALLOWED')
  const flashFirstCostClaimAllowed =
    guards.length === 0 &&
    totalTurnCount > 0 &&
    pct(flashTurnCount, totalTurnCount) >= 75 &&
    totalCostUsd < proOnlyCostUsd
  const proAdmissionClaimAllowed =
    guards.length === 0 &&
    proTurnCount > 0 &&
    proAdmissionViolations.length === 0

  const allowedClaims = [
    flashFirstCostClaimAllowed
      ? `Flash-first route/cost claim allowed: ${pct(flashTurnCount, totalTurnCount)}% turns on Flash/Flash-MAX; cost $${roundUsd(totalCostUsd)} vs Pro-only $${roundUsd(proOnlyCostUsd)}.`
      : null,
    proAdmissionClaimAllowed
      ? 'Pro admission claim allowed for evidenced rescue nodes only: every Pro turn has prior Flash attempt, admission reason, and saved-task evidence.'
      : null,
    cacheHighRoiClaimAllowed
      ? `High cache ROI claim allowed for observed public/live evidence: aggregate hit rate ${pct(cacheHitInputTokens, cacheHitInputTokens + cacheMissInputTokens)}%.`
      : null,
  ].filter((item): item is string => Boolean(item))

  const trendOnlyClaims = [
    !cacheHighRoiClaimAllowed && cacheHitInputTokens > 0
      ? `Cache optimization is trend-only: aggregate hit rate ${pct(cacheHitInputTokens, cacheHitInputTokens + cacheMissInputTokens)}%; use observed values, not a high-ROI claim.`
      : null,
    !public90ClaimAllowed
      ? 'Public 90% top-tier coding/complex-task ability claim remains blocked until fixed raw task score floor reaches around 90.'
      : null,
  ].filter((item): item is string => Boolean(item))

  const blockedClaims = [
    !public90ClaimAllowed
      ? 'Do not claim public 90% coding/complex-task ability from this board.'
      : null,
    !cacheHighRoiClaimAllowed
      ? 'Do not claim high cache ROI; publish exact observed cache hit rates and before/after trend only.'
      : null,
    proAdmissionViolations.length > 0
      ? 'Do not claim Pro admission discipline until all Pro turns have prior Flash attempt, admission reason, and saved-task evidence.'
      : null,
  ].filter((item): item is string => Boolean(item))

  return {
    status: guards.length === 0
      ? 'PASS_DEEPSEEK_COST_QUALITY_ACCEPTANCE'
      : 'NEEDS_DEEPSEEK_COST_QUALITY_EVIDENCE',
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    scenarioCount: scenarios.length,
    solvedScenarioCount: scenarios.filter(item => item.solved).length,
    totalTurnCount,
    flashTurnCount,
    proTurnCount,
    flashTurnRatioPct: pct(flashTurnCount, totalTurnCount),
    proTurnRatioPct: pct(proTurnCount, totalTurnCount),
    cacheHitInputTokens,
    cacheMissInputTokens,
    outputTokens,
    cacheHitRatePct: pct(cacheHitInputTokens, cacheHitInputTokens + cacheMissInputTokens),
    totalCostUsd: roundUsd(totalCostUsd),
    proOnlyCostUsd: roundUsd(proOnlyCostUsd),
    savingsVsProOnlyPct: pct(Math.max(0, proOnlyCostUsd - totalCostUsd), proOnlyCostUsd),
    public90ClaimAllowed,
    cacheHighRoiClaimAllowed,
    flashFirstCostClaimAllowed,
    proAdmissionClaimAllowed,
    allowedClaims,
    trendOnlyClaims,
    blockedClaims,
    guards,
    scenarios,
  }
}
