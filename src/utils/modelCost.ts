import type { BetaUsage as Usage } from 'src/types/providerSdk.js'
import type { AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS } from 'src/services/analytics/index.js'
import { logEvent } from 'src/services/analytics/index.js'
import { setHasUnknownModelCost } from '../bootstrap/state.js'
import { isFastModeEnabled } from './fastMode.js'
import {
  getDeepSeekV4Pricing,
  normalizeDeepSeekV4Model,
} from './model/deepseekV4Control.js'
import {
  HAIKU_3_5_PROVIDER_CONFIG,
  HAIKU_4_5_PROVIDER_CONFIG,
  OPUS_4_1_PROVIDER_CONFIG,
  OPUS_4_5_PROVIDER_CONFIG,
  OPUS_4_6_PROVIDER_CONFIG,
  OPUS_4_PROVIDER_CONFIG,
  SONNET_3_5_V2_PROVIDER_CONFIG,
  SONNET_3_7_PROVIDER_CONFIG,
  SONNET_4_5_PROVIDER_CONFIG,
  SONNET_4_6_PROVIDER_CONFIG,
  SONNET_4_PROVIDER_CONFIG,
} from './model/configs.js'
import {
  firstPartyNameToCanonical,
  getCanonicalName,
  getDefaultMainLoopModelSetting,
  type ModelShortName,
} from './model/model.js'

// @see provider pricing docs
export type ModelCosts = {
  inputTokens: number
  outputTokens: number
  promptCacheWriteTokens: number
  promptCacheReadTokens: number
  webSearchRequests: number
}

// Standard coding-model pricing tier: $3 input / $15 output per Mtok
export const COST_TIER_3_15 = {
  inputTokens: 3,
  outputTokens: 15,
  promptCacheWriteTokens: 3.75,
  promptCacheReadTokens: 0.3,
  webSearchRequests: 0.01,
} as const satisfies ModelCosts

// High-capacity pricing tier: $15 input / $75 output per Mtok
export const COST_TIER_15_75 = {
  inputTokens: 15,
  outputTokens: 75,
  promptCacheWriteTokens: 18.75,
  promptCacheReadTokens: 1.5,
  webSearchRequests: 0.01,
} as const satisfies ModelCosts

// Updated high-capacity pricing tier: $5 input / $25 output per Mtok
export const COST_TIER_5_25 = {
  inputTokens: 5,
  outputTokens: 25,
  promptCacheWriteTokens: 6.25,
  promptCacheReadTokens: 0.5,
  webSearchRequests: 0.01,
} as const satisfies ModelCosts

// Fast-mode high-capacity pricing tier: $30 input / $150 output per Mtok
export const COST_TIER_30_150 = {
  inputTokens: 30,
  outputTokens: 150,
  promptCacheWriteTokens: 37.5,
  promptCacheReadTokens: 3,
  webSearchRequests: 0.01,
} as const satisfies ModelCosts

// Lightweight pricing tier: $0.80 input / $4 output per Mtok
export const COST_HAIKU_35 = {
  inputTokens: 0.8,
  outputTokens: 4,
  promptCacheWriteTokens: 1,
  promptCacheReadTokens: 0.08,
  webSearchRequests: 0.01,
} as const satisfies ModelCosts

// Updated lightweight pricing tier: $1 input / $5 output per Mtok
export const COST_HAIKU_45 = {
  inputTokens: 1,
  outputTokens: 5,
  promptCacheWriteTokens: 1.25,
  promptCacheReadTokens: 0.1,
  webSearchRequests: 0.01,
} as const satisfies ModelCosts

const DEFAULT_UNKNOWN_MODEL_COST = COST_TIER_5_25

function numberFromEnv(name: string, fallback: number): number {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

function getDeepSeekCosts(model: string): ModelCosts {
  const pricing = getDeepSeekV4Pricing(normalizeDeepSeekV4Model(model))
  const inputTokens = numberFromEnv(
    'DSXU_DEEPSEEK_INPUT_USD_PER_MTOKENS',
    pricing.cacheMissInputPerMillion,
  )
  return {
    inputTokens,
    outputTokens: numberFromEnv(
      'DSXU_DEEPSEEK_OUTPUT_USD_PER_MTOKENS',
      pricing.outputPerMillion,
    ),
    promptCacheWriteTokens: numberFromEnv(
      'DSXU_DEEPSEEK_CACHE_CREATE_USD_PER_MTOKENS',
      inputTokens,
    ),
    promptCacheReadTokens: numberFromEnv(
      'DSXU_DEEPSEEK_CACHE_READ_USD_PER_MTOKENS',
      pricing.cacheHitInputPerMillion,
    ),
    webSearchRequests: 0,
  }
}

function isDeepSeekModel(model: string): boolean {
  return /^(deepseek|dsxu)|deepseek/i.test(model)
}

/**
 * Get the compatibility provider cost tier based on fast mode.
 */
export function getFastModeProviderCostTier(fastMode: boolean): ModelCosts {
  if (isFastModeEnabled() && fastMode) {
    return COST_TIER_30_150
  }
  return COST_TIER_5_25
}

// @[MODEL LAUNCH]: Add a pricing entry for the new model below.
// Costs from provider pricing docs
// Web search cost: $10 per 1000 requests = $0.01 per request
export const MODEL_COSTS: Record<ModelShortName, ModelCosts> = {
  [firstPartyNameToCanonical(HAIKU_3_5_PROVIDER_CONFIG.firstParty)]:
    COST_HAIKU_35,
  [firstPartyNameToCanonical(HAIKU_4_5_PROVIDER_CONFIG.firstParty)]:
    COST_HAIKU_45,
  [firstPartyNameToCanonical(SONNET_3_5_V2_PROVIDER_CONFIG.firstParty)]:
    COST_TIER_3_15,
  [firstPartyNameToCanonical(SONNET_3_7_PROVIDER_CONFIG.firstParty)]:
    COST_TIER_3_15,
  [firstPartyNameToCanonical(SONNET_4_PROVIDER_CONFIG.firstParty)]:
    COST_TIER_3_15,
  [firstPartyNameToCanonical(SONNET_4_5_PROVIDER_CONFIG.firstParty)]:
    COST_TIER_3_15,
  [firstPartyNameToCanonical(SONNET_4_6_PROVIDER_CONFIG.firstParty)]:
    COST_TIER_3_15,
  [firstPartyNameToCanonical(OPUS_4_PROVIDER_CONFIG.firstParty)]:
    COST_TIER_15_75,
  [firstPartyNameToCanonical(OPUS_4_1_PROVIDER_CONFIG.firstParty)]:
    COST_TIER_15_75,
  [firstPartyNameToCanonical(OPUS_4_5_PROVIDER_CONFIG.firstParty)]:
    COST_TIER_5_25,
  [firstPartyNameToCanonical(OPUS_4_6_PROVIDER_CONFIG.firstParty)]:
    COST_TIER_5_25,
}

/**
 * Calculates the USD cost based on token usage and model cost configuration
 */
function tokensToUSDCost(modelCosts: ModelCosts, usage: Usage): number {
  return (
    (usage.input_tokens / 1_000_000) * modelCosts.inputTokens +
    (usage.output_tokens / 1_000_000) * modelCosts.outputTokens +
    ((usage.cache_read_input_tokens ?? 0) / 1_000_000) *
      modelCosts.promptCacheReadTokens +
    ((usage.cache_creation_input_tokens ?? 0) / 1_000_000) *
      modelCosts.promptCacheWriteTokens +
    (usage.server_tool_use?.web_search_requests ?? 0) *
      modelCosts.webSearchRequests
  )
}

function deepSeekTokensToUSDCost(modelCosts: ModelCosts, usage: Usage): number {
  const hasCacheBreakdown =
    usage.cache_creation_input_tokens != null ||
    usage.cache_read_input_tokens != null
  const cacheReadTokens = usage.cache_read_input_tokens ?? 0
  const cacheCreationTokens = hasCacheBreakdown
    ? usage.cache_creation_input_tokens ??
      Math.max(0, usage.input_tokens - cacheReadTokens)
    : 0
  const uncachedInputTokens = hasCacheBreakdown ? 0 : usage.input_tokens

  return (
    (uncachedInputTokens / 1_000_000) * modelCosts.inputTokens +
    (cacheCreationTokens / 1_000_000) * modelCosts.promptCacheWriteTokens +
    (cacheReadTokens / 1_000_000) * modelCosts.promptCacheReadTokens +
    (usage.output_tokens / 1_000_000) * modelCosts.outputTokens
  )
}

export function getModelCosts(model: string, usage: Usage): ModelCosts {
  if (isDeepSeekModel(model)) {
    return getDeepSeekCosts(model)
  }

  const shortName = getCanonicalName(model)

  // Check if this is the compatibility fast-mode model with fast mode active.
  if (
    shortName === firstPartyNameToCanonical(OPUS_4_6_PROVIDER_CONFIG.firstParty)
  ) {
    const isFastMode = usage.speed === 'fast'
    return getFastModeProviderCostTier(isFastMode)
  }

  const costs = MODEL_COSTS[shortName]
  if (!costs) {
    trackUnknownModelCost(model, shortName)
    return (
      MODEL_COSTS[getCanonicalName(getDefaultMainLoopModelSetting())] ??
      DEFAULT_UNKNOWN_MODEL_COST
    )
  }
  return costs
}

function trackUnknownModelCost(model: string, shortName: ModelShortName): void {
  logEvent('tengu_unknown_model_cost', {
    model: model as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    shortName:
      shortName as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  })
  setHasUnknownModelCost()
}

// Calculate the cost of a query in US dollars.
// If the model's costs are not found, use the default model's costs.
export function calculateUSDCost(resolvedModel: string, usage: Usage): number {
  const modelCosts = getModelCosts(resolvedModel, usage)
  if (isDeepSeekModel(resolvedModel)) {
    return deepSeekTokensToUSDCost(modelCosts, usage)
  }
  return tokensToUSDCost(modelCosts, usage)
}

/**
 * Calculate cost from raw token counts without requiring a full BetaUsage object.
 * Useful for side queries (e.g. classifier) that track token counts independently.
 */
export function calculateCostFromTokens(
  model: string,
  tokens: {
    inputTokens: number
    outputTokens: number
    cacheReadInputTokens: number
    cacheCreationInputTokens: number
  },
): number {
  const usage: Usage = {
    input_tokens: tokens.inputTokens,
    output_tokens: tokens.outputTokens,
    cache_read_input_tokens: tokens.cacheReadInputTokens,
    cache_creation_input_tokens: tokens.cacheCreationInputTokens,
  } as Usage
  return calculateUSDCost(model, usage)
}

function formatPrice(price: number): string {
  // Format price: integers without decimals, others with 2 decimal places
  // e.g., 3 -> "$3", 0.8 -> "$0.80", 22.5 -> "$22.50"
  if (Number.isInteger(price)) {
    return `$${price}`
  }
  return `$${price.toFixed(2)}`
}

/**
 * Format model costs as a pricing string for display
 * e.g., "$3/$15 per Mtok"
 */
export function formatModelPricing(costs: ModelCosts): string {
  return `${formatPrice(costs.inputTokens)}/${formatPrice(costs.outputTokens)} per Mtok`
}

/**
 * Get formatted pricing string for a model
 * Accepts either a short name or full model name
 * Returns undefined if model is not found
 */
export function getModelPricingString(model: string): string | undefined {
  if (isDeepSeekModel(model)) {
    return formatModelPricing(getDeepSeekCosts(model))
  }

  const shortName = getCanonicalName(model)
  const costs = MODEL_COSTS[shortName]
  if (!costs) return undefined
  return formatModelPricing(costs)
}
