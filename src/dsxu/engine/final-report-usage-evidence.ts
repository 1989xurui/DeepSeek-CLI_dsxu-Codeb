import {
  DEEPSEEK_V4_FLASH_MODEL,
  DEEPSEEK_V4_PRO_MODEL,
  estimateDeepSeekV4Cost,
  normalizeDeepSeekV4Model,
} from '../../utils/model/deepseekV4Control'
import type { DSXUFinalPatchReport } from './code-mode-surgical-loop'

export type DSXUUsageEvidenceRecord = {
  nodeId: string
  model?: string
  routeReason?: string
  modelEvidence?: string
  proAdmissionReason?: string
  flashAttemptedBeforePro?: boolean
  flashAttemptNodeIds?: readonly string[]
  proSavedTask?: boolean
  proSaveEvidence?: string
  usage: {
    input_tokens?: number
    output_tokens?: number
    cache_creation_input_tokens?: number
    cache_read_input_tokens?: number
    dsxu?: {
      model?: string
      route_reason?: string
      model_evidence?: string
      estimated_cost_usd?: number
    }
  }
}

export type DSXUUsageModelCostEvidence = NonNullable<DSXUFinalPatchReport['modelCostEvidence']>
type DSXUProRoiEntry = NonNullable<DSXUUsageModelCostEvidence['proRoi']>['entries'][number]

type DSXUUsageTokenSummary = {
  cacheHitInputTokens: number
  cacheMissInputTokens: number
  outputTokens: number
}

type DSXUUsageCacheBucket = DSXUUsageTokenSummary & {
  key: string
}

function usageNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0
}

function getUsageTokens(record: DSXUUsageEvidenceRecord): {
  cacheHitInputTokens: number
  cacheMissInputTokens: number
  outputTokens: number
} {
  const inputTokens = usageNumber(record.usage.input_tokens)
  const cacheHitInputTokens = usageNumber(record.usage.cache_read_input_tokens)
  const explicitCacheMiss = record.usage.cache_creation_input_tokens
  const cacheMissInputTokens =
    typeof explicitCacheMiss === 'number'
      ? usageNumber(explicitCacheMiss)
      : Math.max(0, inputTokens - cacheHitInputTokens)
  return {
    cacheHitInputTokens,
    cacheMissInputTokens,
    outputTokens: usageNumber(record.usage.output_tokens),
  }
}

function roundPct(numerator: number, denominator: number): number {
  return Math.round((numerator / Math.max(1, denominator)) * 1000) / 10
}

function addTokens(target: DSXUUsageTokenSummary, tokens: DSXUUsageTokenSummary): void {
  target.cacheHitInputTokens += tokens.cacheHitInputTokens
  target.cacheMissInputTokens += tokens.cacheMissInputTokens
  target.outputTokens += tokens.outputTokens
}

function buildCacheBuckets(
  normalized: readonly Array<{ tokens: DSXUUsageTokenSummary }>,
  keyOf: (record: { model: string; routeReason: string }) => string,
): readonly Array<DSXUUsageCacheBucket & { cacheHitRatePct: number }> {
  const buckets = new Map<string, DSXUUsageCacheBucket>()
  for (const record of normalized) {
    const key = keyOf(record as { model: string; routeReason: string })
    const bucket =
      buckets.get(key) ??
      {
        key,
        cacheHitInputTokens: 0,
        cacheMissInputTokens: 0,
        outputTokens: 0,
      }
    addTokens(bucket, record.tokens)
    buckets.set(key, bucket)
  }
  return [...buckets.values()]
    .map(bucket => ({
      ...bucket,
      cacheHitRatePct: roundPct(bucket.cacheHitInputTokens, bucket.cacheHitInputTokens + bucket.cacheMissInputTokens),
    }))
    .sort((a, b) => b.cacheMissInputTokens - a.cacheMissInputTokens || a.key.localeCompare(b.key))
}

function isFlashModel(model: string): boolean {
  return model === DEEPSEEK_V4_FLASH_MODEL
}

function isProModel(model: string): boolean {
  return model === DEEPSEEK_V4_PRO_MODEL
}

function defaultProSavedTask(input: { solved: boolean; routeReason: string }): boolean {
  if (!input.solved) return false
  return /failed[_-]?verification|recovery|high[_-]?risk|permission|security|rollback/i.test(input.routeReason)
}

export function buildDSXUModelCostEvidenceFromUsage(input: {
  scenario: string
  records: readonly DSXUUsageEvidenceRecord[]
  solved: boolean
}): DSXUUsageModelCostEvidence {
  const normalized = input.records.map(record => {
    const model = normalizeDeepSeekV4Model(record.model ?? record.usage.dsxu?.model)
    const tokens = getUsageTokens(record)
    const costUsd =
      typeof record.usage.dsxu?.estimated_cost_usd === 'number'
        ? record.usage.dsxu.estimated_cost_usd
        : estimateDeepSeekV4Cost({ model, ...tokens })
    const proOnlyCostUsd = estimateDeepSeekV4Cost({
      model: DEEPSEEK_V4_PRO_MODEL,
      ...tokens,
    })
    const routeReason = record.routeReason ?? record.usage.dsxu?.route_reason ?? 'missing_route_reason'
    const modelEvidence =
      record.modelEvidence ??
      record.usage.dsxu?.model_evidence ??
      `DSXU model evidence missing for ${record.nodeId}; route=${routeReason}.`
    return {
      ...record,
      model,
      routeReason,
      modelEvidence,
      tokens,
      costUsd,
      proOnlyCostUsd,
    }
  })
  const totalTokens: DSXUUsageTokenSummary = {
    cacheHitInputTokens: 0,
    cacheMissInputTokens: 0,
    outputTokens: 0,
  }
  for (const record of normalized) {
    addTokens(totalTokens, record.tokens)
  }
  const cacheHitRatePct = roundPct(
    totalTokens.cacheHitInputTokens,
    totalTokens.cacheHitInputTokens + totalTokens.cacheMissInputTokens,
  )
  const cacheByModel = buildCacheBuckets(normalized, record => record.model).map(bucket => ({
    model: bucket.key,
    cacheHitInputTokens: bucket.cacheHitInputTokens,
    cacheMissInputTokens: bucket.cacheMissInputTokens,
    outputTokens: bucket.outputTokens,
    cacheHitRatePct: bucket.cacheHitRatePct,
  }))
  const cacheByRouteReason = buildCacheBuckets(normalized, record => record.routeReason).map(bucket => ({
    routeReason: bucket.key,
    cacheHitInputTokens: bucket.cacheHitInputTokens,
    cacheMissInputTokens: bucket.cacheMissInputTokens,
    outputTokens: bucket.outputTokens,
    cacheHitRatePct: bucket.cacheHitRatePct,
  }))
  const priorFlashNodeIds: string[] = []
  const proRoiEntries: DSXUProRoiEntry[] = []
  for (const record of normalized) {
    if (isFlashModel(record.model)) {
      priorFlashNodeIds.push(record.nodeId)
    }
    if (!isProModel(record.model)) continue
    const flashAttemptNodeIds = record.flashAttemptNodeIds ?? priorFlashNodeIds
    const flashAttemptedBeforePro = record.flashAttemptedBeforePro ?? flashAttemptNodeIds.length > 0
    const proAdmissionReason = record.proAdmissionReason ?? record.routeReason
    const proSavedTask = record.proSavedTask ?? defaultProSavedTask({
      solved: input.solved,
      routeReason: record.routeReason,
    })
    const proSaveEvidence =
      record.proSaveEvidence ??
      (proSavedTask
        ? 'solved_after_pro_admission'
        : 'no_saved_task_evidence')
    proRoiEntries.push({
      nodeId: record.nodeId,
      routeReason: record.routeReason,
      proAdmissionReason,
      flashAttemptedBeforePro,
      flashAttemptNodeIds: [...flashAttemptNodeIds],
      proSavedTask,
      proSaveEvidence,
    })
  }
  const proRoi = {
    proNodeCount: proRoiEntries.length,
    proNodesWithPriorFlashAttempt: proRoiEntries.filter(entry => entry.flashAttemptedBeforePro).length,
    proNodesWithAdmissionReason: proRoiEntries.filter(entry => entry.proAdmissionReason.trim().length > 0).length,
    proNodesMarkedSavedTask: proRoiEntries.filter(entry => entry.proSavedTask).length,
    proRoiRatePct: roundPct(proRoiEntries.filter(entry => entry.proSavedTask).length, proRoiEntries.length),
    entries: proRoiEntries,
  }
  const totalCostUsd = normalized.reduce((sum, record) => sum + record.costUsd, 0)
  const proOnlyCostUsd = normalized.reduce((sum, record) => sum + record.proOnlyCostUsd, 0)
  const proNodeRatio = Math.round(
    (normalized.filter(record => record.model === DEEPSEEK_V4_PRO_MODEL).length / Math.max(1, normalized.length)) *
      1000,
  ) / 10
  const savingsVsProOnlyPct =
    Math.round(((proOnlyCostUsd - totalCostUsd) / Math.max(0.000001, proOnlyCostUsd)) * 1000) / 10
  const routeReasons = normalized.map(record => `${record.nodeId}:${record.routeReason}`)
  const modelEvidence = normalized.map(record => `${record.nodeId}: ${record.modelEvidence}`).join('\n')
  const costComplete =
    normalized.length > 0 &&
    normalized.every(record =>
      record.routeReason !== 'missing_route_reason' &&
      !record.modelEvidence.includes('model evidence missing'),
    )

  return {
    scenario: input.scenario,
    totalCostUsd,
    proOnlyCostUsd,
    costPerSolvedUsd: input.solved ? totalCostUsd : null,
    savingsVsProOnlyPct,
    proNodeRatio,
    cacheHitInputTokens: totalTokens.cacheHitInputTokens,
    cacheMissInputTokens: totalTokens.cacheMissInputTokens,
    outputTokens: totalTokens.outputTokens,
    cacheHitRatePct,
    cacheByModel,
    cacheByRouteReason,
    proRoi,
    routeReasons,
    modelEvidence,
    costComplete,
  }
}
